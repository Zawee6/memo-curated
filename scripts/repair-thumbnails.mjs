#!/usr/bin/env node

/**
 * Memo 舊卡片預覽圖批次健檢與自動修復腳本 (Repair & Auto-Heal Thumbnails)
 * 掃描 .data/db.json 與 .data/users/*.json 的所有卡片：
 * 1. 檢測卡片是否缺少縮圖或既有 IG 圖片是否回傳 403 / 404 過期。
 * 2. 針對失效項目，從原始貼文 url 自動爬取最新 og:image。
 * 3. 下載高畫質圖片並永久快取至 .data/thumbnails/item_{id}.jpg。
 * 4. 更新資料庫中的 thumbnailUrl。
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), '.data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const THUMBNAIL_DIR = path.join(DATA_DIR, 'thumbnails');
const DB_FILE = path.join(DATA_DIR, 'db.json');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function getCacheFilePath(id) {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(THUMBNAIL_DIR, `item_${safeId}.jpg`);
}

function extractYouTubeVideoId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:shorts\/|live\/|watch\?.*?v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : null;
}

function extractInstagramShortcode(url) {
  if (!url) return null;
  const match = url.match(
    /(?:instagram\.com|instagr\.am)\/(?:reel|reels|p|tv|share\/reel)\/([a-zA-Z0-9_\-]+)/i
  );
  return match ? match[1] : null;
}

async function isImageValid(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('http')) return false;
  const clean = imageUrl.replace(/&amp;/g, '&');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    };
    if (clean.includes('cdninstagram.com') || clean.includes('fbcdn.net')) {
      headers['Referer'] = 'https://www.instagram.com/';
    }
    const res = await fetch(clean, { method: 'GET', headers, signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchImageBuffer(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('http')) return null;
  const clean = imageUrl.replace(/&amp;/g, '&');
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
  };
  if (clean.includes('cdninstagram.com') || clean.includes('fbcdn.net')) {
    headers['Referer'] = 'https://www.instagram.com/';
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const res = await fetch(clean, { method: 'GET', headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const arrayBuf = await res.arrayBuffer();
    if (arrayBuf.byteLength < 50) return null;
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
}

async function healCoverUrl(postUrl) {
  if (!postUrl) return null;
  const cleanPostUrl = postUrl.trim().split('#')[0];

  // 1. YouTube
  const ytId = extractYouTubeVideoId(cleanPostUrl);
  if (ytId) {
    return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  }

  // 2. Facebook external hit UA (Instagram og:image)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    const res = await fetch(cleanPostUrl, {
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html',
        'Accept-Language': 'zh-TW,zh;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const html = await res.text();
      const m =
        html.match(/property="og:image"\s+content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"\s+property="og:image"/i) ||
        html.match(/name="twitter:image"\s+content="([^"]+)"/i);
      if (m && m[1]) {
        const fresh = m[1].replace(/&amp;/g, '&').trim();
        if (fresh.startsWith('http')) return fresh;
      }
    }
  } catch {}

  // 3. Instagram Embed page
  const igCode = extractInstagramShortcode(cleanPostUrl);
  if (igCode) {
    try {
      const embedUrl = `https://www.instagram.com/p/${igCode}/embed/captioned/`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(embedUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          'Accept-Language': 'zh-TW,zh;q=0.9',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const html = await res.text();
        const m =
          html.match(/class="EmbeddedMediaImage"[^>]*src="([^"]+)"/i) ||
          html.match(/src="([^"]+cdninstagram\.com[^"]+)"/i);
        if (m && m[1]) {
          const fresh = m[1].replace(/&amp;/g, '&').trim();
          if (fresh.startsWith('http')) return fresh;
        }
      }
    } catch {}
  }

  // 4. Microlink
  try {
    const microUrl = `https://api.microlink.io/?url=${encodeURIComponent(cleanPostUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(microUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const cand = data?.data?.image?.url || data?.data?.logo?.url;
      if (cand && typeof cand === 'string' && cand.startsWith('http')) {
        return cand.replace(/&amp;/g, '&').trim();
      }
    }
  } catch {}

  return null;
}

async function repairSpaceFile(filePath, spaceName) {
  console.log(`\n======================================================`);
  console.log(`📂 正在健檢空間: [${spaceName}] (${filePath})`);
  console.log(`======================================================`);

  let dbData;
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    dbData = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ 無法讀取資料庫檔案 ${filePath}:`, err.message);
    return;
  }

  const items = Array.isArray(dbData)
    ? dbData
    : Array.isArray(dbData.items)
    ? dbData.items
    : [];

  if (items.length === 0) {
    console.log(`ℹ️ 空間 [${spaceName}] 內尚無卡片。`);
    return;
  }

  console.log(`🔍 總共有 ${items.length} 張卡片，開始檢測預覽圖狀態...`);

  let alreadyCached = 0;
  let healthyRemote = 0;
  let repairedCount = 0;
  let failedCount = 0;
  let dbChanged = false;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const cachePath = getCacheFilePath(item.id);

    // 1. 檢查本機硬碟快取是否已經存在且有效
    try {
      const stat = await fs.stat(cachePath);
      if (stat.size >= 50) {
        alreadyCached++;
        continue;
      }
    } catch {
      // Not cached on disk
    }

    // 2. 檢查既有 thumbnailUrl 是否仍然有效
    const rawThumb =
      item.thumbnailUrl ||
      item.image ||
      item.coverImage ||
      item.coverUrl ||
      item.imageUrl ||
      item.placeInfo?.photoUrl ||
      item.placeInfo?.PhotoUrl;

    let needHeal = false;
    let validBuffer = null;

    if (rawThumb && rawThumb.startsWith('http')) {
      validBuffer = await fetchImageBuffer(rawThumb);
      if (validBuffer) {
        healthyRemote++;
        // 立即寫入本地硬碟作為永久快取
        await fs.writeFile(cachePath, validBuffer);
      } else {
        needHeal = true;
      }
    } else {
      needHeal = true;
    }

    // 3. 若失效或過期，啟動 Auto-Heal
    if (needHeal) {
      process.stdout.write(`🩺 [${idx + 1}/${items.length}] 修復中: ${item.title} ... `);
      const freshUrl = await healCoverUrl(item.url);

      if (freshUrl) {
        const freshBuffer = await fetchImageBuffer(freshUrl);
        if (freshBuffer) {
          await fs.writeFile(cachePath, freshBuffer);
          item.thumbnailUrl = freshUrl;
          dbChanged = true;
          repairedCount++;
          console.log(`✅ 成功 (${(freshBuffer.length / 1024).toFixed(1)} KB)`);
        } else {
          failedCount++;
          console.log(`⚠️ 抓到新 URL 但圖片下載失敗`);
        }
      } else {
        failedCount++;
        console.log(`❌ 無法取得最新封面`);
      }

      // 避免短時間連續請求過於密集
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (dbChanged) {
    if (Array.isArray(dbData)) {
      await fs.writeFile(filePath, JSON.stringify(items, null, 2), 'utf-8');
    } else {
      dbData.items = items;
      await fs.writeFile(filePath, JSON.stringify(dbData, null, 2), 'utf-8');
    }
    console.log(`💾 已將最新修復的 thumbnailUrl 寫回資料庫！`);
  }

  console.log(`\n📊 [${spaceName}] 健檢結果彙整:`);
  console.log(`   ⚡ 硬碟既有快取 (秒開): ${alreadyCached} 張`);
  console.log(`   🌐 既有遠端有效 (已存入硬碟): ${healthyRemote} 張`);
  console.log(`   🩺 過期成功修復並固化: ${repairedCount} 張`);
  console.log(`   ❌ 仍然無法取得: ${failedCount} 張`);
}

async function main() {
  await ensureDir(THUMBNAIL_DIR);

  console.log('🚀 開始執行全系統卡片預覽圖健檢與修復...');

  // 1. 主空間 (default)
  try {
    await fs.access(DB_FILE);
    await repairSpaceFile(DB_FILE, 'default (主空間)');
  } catch (e) {
    console.log('default space db.json not found');
  }

  // 2. 使用者空間 (.data/users/*.json)
  try {
    const userFiles = await fs.readdir(USERS_DIR);
    for (const f of userFiles) {
      if (f.endsWith('.json')) {
        const spaceName = f.replace(/\.json$/, '');
        const userDbPath = path.join(USERS_DIR, f);
        await repairSpaceFile(userDbPath, `用戶空間: ${spaceName}`);
      }
    }
  } catch (e) {
    // No users dir
  }

  console.log('\n🎉 全空間預覽圖健檢與修復作業完成！');
}

main().catch((err) => {
  console.error('Fatal error during repair:', err);
  process.exit(1);
});
