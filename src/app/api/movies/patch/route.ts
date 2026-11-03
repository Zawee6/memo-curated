import { NextRequest, NextResponse } from 'next/server';
import { getServerItems, saveServerItems } from '@/lib/serverDb';
import { enrichMovieData } from '@/lib/movieEnrichmentService';

// 嚴格安全守則：禁止 GET 請求執行寫入操作
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: '為確保資料庫安全，電影資料修補僅支援 POST 手動呼叫。',
    },
    { status: 405 }
  );
}

export async function POST(req: NextRequest) {
  try {
    let targetId: string | undefined;
    try {
      const body = await req.json();
      targetId = body?.id;
    } catch {}

    const items = await getServerItems();
    let patchedCount = 0;
    const patchedMovies: any[] = [];
    let updatedTargetItem: any = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // 若有指定 targetId，只處理該項目；若無則處理所有 media 項目
      if (targetId && item.id !== targetId) continue;

      if (item.category === 'media') {
        const movieTitle = item.mediaInfo?.movieTitle || item.title;
        const originalTitle = item.mediaInfo?.originalTitle;
        const releaseYear = item.mediaInfo?.releaseYear;

        console.log(`[Movie Patch] Enriching movie: "${movieTitle}"...`);
        const enriched = await enrichMovieData(movieTitle, originalTitle, releaseYear);

        // 保留原網紅影評觀點至 sources[0]
        if (!item.sources || item.sources.length === 0) {
          item.sources = [
            {
              id: `src_orig_${item.id}`,
              url: item.url,
              title: item.title,
              summary: item.summary,
              thumbnailUrl: item.thumbnailUrl || undefined,
              author: item.mediaInfo?.creator || undefined,
              addedAt: new Date(item.createdAt || Date.now()).toLocaleDateString('zh-TW'),
            },
          ];
        } else if (item.sources[0] && !item.sources[0].summary) {
          item.sources[0].summary = item.summary;
        }

        // 主卡片一律套用電影官方片名與官方劇情大綱
        item.title = enriched.movieTitle;
        item.summary = enriched.plotSynopsis;
        if (enriched.posterUrl) {
          item.thumbnailUrl = enriched.posterUrl;
        }
        item.aspectRatio = '27:40';

        item.mediaInfo = {
          ...item.mediaInfo,
          isMovie: true,
          movieTitle: enriched.movieTitle,
          originalTitle: enriched.originalTitle,
          releaseYear: enriched.releaseYear,
          releaseDate: enriched.releaseDate,
          director: enriched.director || item.mediaInfo?.director,
          genre: enriched.genre,
          genres: enriched.genres,
          themeColor: enriched.themeColor,
          plotSynopsis: enriched.plotSynopsis,
          imdbId: enriched.imdbId || item.mediaInfo?.imdbId,
          imdbRating: enriched.imdbRating || item.mediaInfo?.imdbRating,
          imdbRatingCount: enriched.imdbRatingCount || item.mediaInfo?.imdbRatingCount,
          posterUrl: enriched.posterUrl || item.mediaInfo?.posterUrl,
          streamingPlatforms: enriched.streamingPlatforms,
          youtubeReviews: enriched.youtubeReviews,
        };

        patchedCount++;
        patchedMovies.push({
          id: item.id,
          title: item.title,
          year: enriched.releaseYear,
          genres: enriched.genres,
          themeColor: enriched.themeColor,
          synopsis: item.summary,
        });

        if (targetId && item.id === targetId) {
          updatedTargetItem = item;
          break;
        }
      }
    }

    if (patchedCount > 0) {
      await saveServerItems(items);
    }

    return NextResponse.json({
      success: true,
      patchedCount,
      movies: patchedMovies,
      item: updatedTargetItem,
      items,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `電影資料修補失敗：${errMessage}` },
      { status: 500 }
    );
  }
}
