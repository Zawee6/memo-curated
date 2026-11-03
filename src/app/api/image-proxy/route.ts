import { NextRequest, NextResponse } from 'next/server';
import {
  getThumbnailCacheKey,
  readThumbnailFromDisk,
  saveThumbnailToDisk,
  fetchImageBuffer,
  healCoverUrlFromPostUrl,
} from '@/lib/thumbnailHealer';
import { updateItemThumbnailAcrossSpaces } from '@/lib/serverDb';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get('url')?.trim();
    const postUrl = searchParams.get('postUrl')?.trim();
    const id = searchParams.get('id')?.trim();

    // 1. 清理圖片 URL 中的 &amp; 避免 CDN 驗證失效
    let targetUrl = rawUrl ? rawUrl.replace(/&amp;/g, '&') : '';

    // 2. 計算本地快取鍵值 (依序：id -> postUrl -> targetUrl)
    const cacheKey = getThumbnailCacheKey(id, postUrl, targetUrl);

    // 3. 優先檢查本機硬碟快取 (.data/thumbnails/{cacheKey}.jpg)
    if (cacheKey) {
      const diskCached = await readThumbnailFromDisk(cacheKey);
      if (diskCached) {
        return new NextResponse(new Uint8Array(diskCached.buffer), {
          status: 200,
          headers: {
            'Content-Type': diskCached.contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
            'X-Thumbnail-Cache': 'HIT',
          },
        });
      }
    }

    if (!targetUrl && !postUrl) {
      return NextResponse.json(
        { error: 'Missing url or postUrl parameter' },
        { status: 400 }
      );
    }

    // 4. 若本地未快取且 targetUrl 有效，嘗試 fetch 取得原圖
    if (targetUrl && /^https?:\/\//i.test(targetUrl)) {
      const upstreamResult = await fetchImageBuffer(targetUrl);
      if (upstreamResult) {
        // 成功取得圖片：非同步持久化存入本機硬碟
        if (cacheKey) {
          saveThumbnailToDisk(cacheKey, upstreamResult.buffer).catch((err) =>
            console.warn('[Image Proxy] Failed to save disk cache:', err)
          );
        }

        return new NextResponse(new Uint8Array(upstreamResult.buffer), {
          status: 200,
          headers: {
            'Content-Type': upstreamResult.contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
            'X-Thumbnail-Cache': 'MISS-SAVED',
          },
        });
      }
    }

    // 5. 若 targetUrl 為空或 fetch 失敗 (例如 403 Forbidden / 404 過期)：
    //    觸發自動自癒機制 (Auto-Heal)，從原始 postUrl 重新爬取最新 og:image
    if (postUrl && /^https?:\/\//i.test(postUrl)) {
      console.log(`[Image Proxy Auto-Heal] 🩺 啟動自癒重抓: id=${id || '-'}, postUrl=${postUrl}`);
      const freshImageUrl = await healCoverUrlFromPostUrl(postUrl);

      if (freshImageUrl) {
        const freshResult = await fetchImageBuffer(freshImageUrl);
        if (freshResult) {
          // 寫入本地硬碟快取
          if (cacheKey) {
            await saveThumbnailToDisk(cacheKey, freshResult.buffer);
          }

          // 同步在背景更新資料庫中卡片的 thumbnailUrl
          if (id) {
            updateItemThumbnailAcrossSpaces(id, freshImageUrl).catch((err) =>
              console.warn('[Image Proxy Auto-Heal] Failed to update DB:', err)
            );
          }

          console.log(`[Image Proxy Auto-Heal] ✅ 自癒成功並寫入快取: id=${id || '-'}`);
          return new NextResponse(new Uint8Array(freshResult.buffer), {
            status: 200,
            headers: {
              'Content-Type': freshResult.contentType,
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Access-Control-Allow-Origin': '*',
              'X-Thumbnail-Cache': 'HEALED',
            },
          });
        }
      }
    }

    // 6. 所有備援皆失效時回傳 404
    return NextResponse.json(
      { error: 'Image proxy upstream failed and auto-heal exhausted' },
      { status: 404 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[Image Proxy Error]:', msg);
    return NextResponse.json({ error: 'Image proxy error', details: msg }, { status: 404 });
  }
}
