import { NextRequest, NextResponse } from 'next/server';
import {
  readDb,
  writeDb,
  listAllSpaces,
  checkIsAdminRequest,
} from '@/lib/serverDb';
import {
  getThumbnailCacheKey,
  readThumbnailFromDisk,
  saveThumbnailToDisk,
  fetchImageBuffer,
  healCoverUrlFromPostUrl,
} from '@/lib/thumbnailHealer';

export async function GET(req: NextRequest) {
  try {
    if (!checkIsAdminRequest(req)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const spaces = await listAllSpaces();
    let totalScanned = 0;
    let alreadyCachedCount = 0;
    let healthyRemoteCount = 0;
    let repairedCount = 0;
    let failedCount = 0;

    for (const space of spaces) {
      const db = await readDb(space);
      let changed = false;

      for (const item of db.items) {
        totalScanned++;
        const cacheKey = getThumbnailCacheKey(item.id, item.url, item.thumbnailUrl);
        if (!cacheKey) continue;

        // 1. 檢查本機快取
        const diskCached = await readThumbnailFromDisk(cacheKey);
        if (diskCached) {
          alreadyCachedCount++;
          continue;
        }

        // 2. 檢查既有圖片是否有效
        let valid = false;
        if (item.thumbnailUrl && item.thumbnailUrl.startsWith('http')) {
          const res = await fetchImageBuffer(item.thumbnailUrl);
          if (res) {
            valid = true;
            healthyRemoteCount++;
            await saveThumbnailToDisk(cacheKey, res.buffer);
          }
        }

        // 3. 若無效，啟動 Auto-Heal
        if (!valid) {
          const freshUrl = await healCoverUrlFromPostUrl(item.url);
          if (freshUrl) {
            const freshRes = await fetchImageBuffer(freshUrl);
            if (freshRes) {
              await saveThumbnailToDisk(cacheKey, freshRes.buffer);
              item.thumbnailUrl = freshUrl;
              changed = true;
              repairedCount++;
            } else {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        }
      }

      if (changed) {
        await writeDb(db, space);
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalScanned,
        alreadyCachedCount,
        healthyRemoteCount,
        repairedCount,
        failedCount,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('API /api/admin/repair-thumbnails error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
