import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { extractYouTubeVideoId, isYouTubeShorts, extractInstagramShortcode } from '@/lib/video';

export const THUMBNAIL_CACHE_DIR = path.join(process.cwd(), '.data', 'thumbnails');

/**
 * 確保本地縮圖快取目錄存在
 */
export async function ensureThumbnailDir(): Promise<string> {
  await fs.mkdir(THUMBNAIL_CACHE_DIR, { recursive: true });
  return THUMBNAIL_CACHE_DIR;
}

/**
 * 根據 id, postUrl, targetUrl 生成唯一快取檔名
 */
export function getThumbnailCacheKey(
  id?: string | null,
  postUrl?: string | null,
  targetUrl?: string | null
): string | null {
  if (id && id.trim()) {
    const safeId = id.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `item_${safeId}`;
  }
  if (postUrl && postUrl.trim()) {
    const cleanPost = postUrl.trim().split('#')[0].replace(/\/+$/, '');
    return `post_${crypto.createHash('md5').update(cleanPost).digest('hex')}`;
  }
  if (targetUrl && targetUrl.trim()) {
    const cleanTarget = targetUrl.trim().replace(/&amp;/g, '&');
    return `url_${crypto.createHash('md5').update(cleanTarget).digest('hex')}`;
  }
  return null;
}

/**
 * 取得快取檔案的本機絕對路徑
 */
export function getThumbnailFilePath(cacheKey: string): string {
  return path.join(THUMBNAIL_CACHE_DIR, `${cacheKey}.jpg`);
}

/**
 * 透過圖片 Buffer Magic Bytes 偵測真實 MIME Type
 */
export function detectImageType(buffer: Buffer): string {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.length > 12 &&
    buffer.toString('utf8', 0, 4) === 'RIFF' &&
    buffer.toString('utf8', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

/**
 * 嘗試從磁碟讀取既有快取
 */
export async function readThumbnailFromDisk(cacheKey: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const filePath = getThumbnailFilePath(cacheKey);
    const buffer = await fs.readFile(filePath);
    if (buffer && buffer.length >= 50) {
      return {
        buffer,
        contentType: detectImageType(buffer),
      };
    }
  } catch {
    // File not found or read error
  }
  return null;
}

/**
 * 將圖片 Buffer 永久寫入本地硬碟
 */
export async function saveThumbnailToDisk(cacheKey: string, buffer: Buffer): Promise<string> {
  await ensureThumbnailDir();
  const filePath = getThumbnailFilePath(cacheKey);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/**
 * 嘗試下載圖片 URL 並回傳 Buffer
 */
export async function fetchImageBuffer(imageUrl: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return null;

  const clean = imageUrl.replace(/&amp;/g, '&').trim();
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  if (clean.includes('cdninstagram.com') || clean.includes('fbcdn.net')) {
    headers['Referer'] = 'https://www.instagram.com/';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    const res = await fetch(clean, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return null;
    }

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength < 50) {
      return null;
    }

    const buffer = Buffer.from(arrayBuf);
    return {
      buffer,
      contentType: detectImageType(buffer),
    };
  } catch (err) {
    return null;
  }
}

/**
 * 🩺 核心自癒邏輯 (Auto-Heal)：
 * 針對過期 403 的圖片，根據原始 postUrl 重新抓取最新可用的預覽圖 URL
 */
export async function healCoverUrlFromPostUrl(postUrl?: string | null): Promise<string | null> {
  if (!postUrl) return null;
  const cleanPostUrl = postUrl.trim().split('#')[0];
  if (!cleanPostUrl) return null;

  // 1. YouTube 優先直接返回官方 CDN 縮圖
  const ytId = extractYouTubeVideoId(cleanPostUrl);
  if (ytId) {
    return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  }

  // 2. 通道 1：使用 Facebook 爬蟲 UA (facebookexternalhit/1.1) 抓取最新 og:image
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);

    const res = await fetch(cleanPostUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const ogMatch =
        html.match(/property="og:image"\s+content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"\s+property="og:image"/i) ||
        html.match(/name="twitter:image"\s+content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"\s+name="twitter:image"/i);

      if (ogMatch && ogMatch[1]) {
        const freshUrl = ogMatch[1].replace(/&amp;/g, '&').trim();
        if (freshUrl.startsWith('http')) {
          return freshUrl;
        }
      }
    }
  } catch (e) {
    // Continue to next fallback
  }

  // 3. 通道 2：Instagram Embed 頁面爬取
  const igCode = extractInstagramShortcode(cleanPostUrl);
  if (igCode) {
    try {
      const embedUrl = `https://www.instagram.com/p/${igCode}/embed/captioned/`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(embedUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept-Language': 'zh-TW,zh;q=0.9',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        const imgMatch =
          html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/i) ||
          html.match(/src="([^"]+cdninstagram\.com[^"]+)"/i);

        if (imgMatch && imgMatch[1]) {
          const freshEmbedImg = imgMatch[1].replace(/&amp;/g, '&').trim();
          if (freshEmbedImg.startsWith('http')) {
            return freshEmbedImg;
          }
        }
      }
    } catch (e) {
      // Continue to next fallback
    }
  }

  // 4. 通道 3：Microlink 萬用 OpenGraph 備援服務
  try {
    const microUrl = `https://api.microlink.io/?url=${encodeURIComponent(cleanPostUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(microUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const candidate = data?.data?.image?.url || data?.data?.logo?.url;
      if (candidate && typeof candidate === 'string' && candidate.startsWith('http')) {
        return candidate.replace(/&amp;/g, '&').trim();
      }
    }
  } catch (e) {
    // ignore
  }

  return null;
}
