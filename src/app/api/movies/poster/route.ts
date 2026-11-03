import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getEffectiveGeminiKey, getEffectiveGeminiModel } from '@/lib/config';

/**
 * 智慧清理片名，去除社群影評常見的標題雜訊
 * 例如：他被鯨魚吞下肚，有可能逃出來嗎？《逃出鯨吞》（Whalefall） -> 逃出鯨吞
 */
export function extractCleanMovieTitle(rawTitle: string): {
  cleanTitle: string;
  originalTitle?: string;
} {
  let title = (rawTitle || '').trim();

  // 1. 優先嘗試從書名號《...》中提取
  const bookMarkMatch = title.match(/《([^》]+)》/);
  if (bookMarkMatch && bookMarkMatch[1].trim()) {
    const extracted = bookMarkMatch[1].trim();
    // 檢查是否有附帶英文片名，例如 （Whalefall）或 (Whalefall)
    const enMatch = title.match(/[\(（]([A-Za-z0-9\s:.'"-]+)[\)）]/);
    return {
      cleanTitle: extracted,
      originalTitle: enMatch ? enMatch[1].trim() : undefined,
    };
  }

  // 2. 去除常見標題字眼與標點符號
  title = title
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/#\S+/g, ' ')
    .replace(/(影評|解析|推薦|心得|結局|彩蛋|預告|解說|觀後感|電影|Shorts|Reels)/gi, ' ')
    .replace(/^[0-9\s.、\-]+/, '')
    .trim();

  // 再次檢查是否有括號內的英文片名
  const enMatch = title.match(/[\(（]([A-Za-z0-9\s:.'"-]+)[\)）]/);
  const originalTitle = enMatch ? enMatch[1].trim() : undefined;
  title = title.replace(/[\(（].*?[\)）]/g, ' ').trim();

  // 若清理後仍過長，取前 15 個字以內的有效片名
  const cleanTitle = title.split(/[，,。!！?？\s]+/)[0].trim() || rawTitle.trim();

  return { cleanTitle, originalTitle };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawTitle = (searchParams.get('title') || searchParams.get('q') || '').trim();
    const explicitEn = (searchParams.get('en') || '').trim();

    if (!rawTitle) {
      return NextResponse.json(
        { success: false, error: '請提供電影標題 (title)。' },
        { status: 400 }
      );
    }

    const { cleanTitle, originalTitle: inferredEn } = extractCleanMovieTitle(rawTitle);
    const originalTitle = explicitEn || inferredEn;

    let posterUrl = '';
    let summary = '';
    let director = '';
    let releaseYear = (searchParams.get('year') || '').trim();
    let source = '';

    const candidates = [cleanTitle];
    if (originalTitle && originalTitle !== cleanTitle) candidates.push(originalTitle);

    // ==========================================
    // 第零層：本地已下載高畫質海報優先命中 (0 延遲且保證顯示)
    // ==========================================
    const normalized = (cleanTitle + ' ' + (originalTitle || '') + ' ' + rawTitle).toLowerCase();
    if (
      normalized.includes('cyberpunk') ||
      normalized.includes('邊緣行者') ||
      normalized.includes('賽博朋克') ||
      normalized.includes('電馭叛客')
    ) {
      posterUrl = '/posters/cyberpunk.jpg';
      source = 'local-offline';
      releaseYear = releaseYear || '2022';
    } else if (
      normalized.includes('whalefall') ||
      normalized.includes('鯨吞') ||
      normalized.includes('逃出鯨吞')
    ) {
      posterUrl = '/posters/whalefall.jpg';
      source = 'local-offline';
      releaseYear = releaseYear || '2026';
    }

    // ==========================================
    // 第一層：IMDb 官方公開 Suggestion API (100% 官方 One-Sheet 高清原圖)
    // ==========================================
    if (!posterUrl) {
    const imdbQueries: string[] = [];
    if (originalTitle && releaseYear) imdbQueries.push(`${originalTitle} ${releaseYear}`);
    if (originalTitle) imdbQueries.push(originalTitle);
    if (cleanTitle && cleanTitle !== originalTitle) imdbQueries.push(cleanTitle);

    for (const query of imdbQueries) {
      try {
        const imdbUrl = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(query)}.json`;
        const imdbRes = await fetch(imdbUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(4000),
        });

        if (imdbRes.ok) {
          const data = await imdbRes.json();
          const items = Array.isArray(data?.d) ? data.d : [];
          const matched =
            items.find(
              (i: any) =>
                i.i?.imageUrl &&
                (i.qid === 'movie' || i.qid === 'tvSeries' || i.q === 'feature')
            ) || items.find((i: any) => i.i?.imageUrl);

          if (matched && matched.i?.imageUrl) {
            // 替換為 UX1000 One-Sheet 高畫質海報原圖
            const rawImg = matched.i.imageUrl;
            const hdImg = rawImg.replace(/\._V1_.*\.jpg$/i, '._V1_FMjpg_UX1000_.jpg');
            posterUrl = hdImg;
            source = 'imdb-official';
            if (!releaseYear && (matched.y || matched.tl)) {
              releaseYear = String(matched.y || matched.tl);
            }
            break;
          }
        }
      } catch (imdbErr) {
        console.warn(`[Poster Fetcher] IMDb failed for ${query}:`, imdbErr);
      }
    }
  }

    // ==========================================
    // 第二層：中文維基百科 REST API (極速、免 Key、官方直式劇照/海報)
    // ==========================================
    if (!posterUrl) {
      for (const cand of candidates) {
        try {
          const wikiRes = await fetch(
            `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cand)}`,
            {
              headers: {
                'User-Agent': 'Memo-MoviePosterFetcher/1.0 (https://memo.app; contact@memo.app)',
              },
              signal: AbortSignal.timeout(4000),
            }
          );

          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            const img = wikiData.originalimage?.source || wikiData.thumbnail?.source;
            if (img && !img.includes('disambig')) {
              posterUrl = img;
              summary = wikiData.extract || '';
              source = 'wikipedia-zh';
              if (wikiData.description && /\d{4}/.test(wikiData.description)) {
                const yearMatch = wikiData.description.match(/(\d{4})/);
                if (yearMatch) releaseYear = yearMatch[1];
              }
              break;
            }
          }
        } catch (e) {
          console.warn(`[Poster Fetcher] Wikipedia zh failed for ${cand}:`, e);
        }
      }
    }

    // 若中文維基未果且有英文片名，嘗試英文維基百科
    if (!posterUrl && originalTitle) {
      try {
        const enWikiRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(originalTitle)}`,
          {
            headers: {
              'User-Agent': 'Memo-MoviePosterFetcher/1.0 (https://memo.app; contact@memo.app)',
            },
            signal: AbortSignal.timeout(4000),
          }
        );
        if (enWikiRes.ok) {
          const enWikiData = await enWikiRes.json();
          const img = enWikiData.originalimage?.source || enWikiData.thumbnail?.source;
          if (img && !img.includes('disambig')) {
            posterUrl = img;
            if (!summary) summary = enWikiData.extract || '';
            source = 'wikipedia-en';
          }
        }
      } catch (e) {
        console.warn(`[Poster Fetcher] Wikipedia en failed for ${originalTitle}:`, e);
      }
    }

    // ==========================================
    // 第二層：Apple iTunes Movie API (取得高解析度官方直式海報)
    // ==========================================
    if (!posterUrl) {
      for (const cand of candidates) {
        try {
          const itunesRes = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(cand)}&country=tw&media=movie&limit=1`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
              },
              signal: AbortSignal.timeout(3500),
            }
          );
          if (itunesRes.ok) {
            const itunesData = await itunesRes.json();
            if (itunesData.resultCount > 0 && itunesData.results?.[0]?.artworkUrl100) {
              const art100 = itunesData.results[0].artworkUrl100;
              // 放大至 1000x1500 高清海報
              posterUrl = art100.replace('100x100bb.jpg', '1000x1500bb.jpg');
              source = 'itunes-tw';
              if (itunesData.results[0].artistName) director = itunesData.results[0].artistName;
              if (itunesData.results[0].releaseDate) {
                releaseYear = itunesData.results[0].releaseDate.slice(0, 4);
              }
              break;
            }
          }
        } catch (e) {
          console.warn(`[Poster Fetcher] iTunes failed for ${cand}:`, e);
        }
      }
    }

    // ==========================================
    // 第三層：開眼電影網搜尋爬蟲 (Jina Reader 抓取官方劇照與海報)
    // ==========================================
    if (!posterUrl) {
      try {
        const searchUrl = `https://r.jina.ai/http://search.atmovies.com.tw/search/?type=movie&search_term=${encodeURIComponent(
          cleanTitle
        )}`;
        const atmoviesRes = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          },
          signal: AbortSignal.timeout(5000),
        });

        if (atmoviesRes.ok) {
          const text = await atmoviesRes.text();
          // 開眼電影海報通常位於 http://www.atmovies.com.tw/photo101/.../pl_...jpg
          const posterMatch = text.match(/https?:\/\/[^\s\)"']+\/photo101\/[^\s\)"']+\.jpg/i);
          if (posterMatch) {
            posterUrl = posterMatch[0];
            source = 'atmovies';
          }
        }
      } catch (e) {
        console.warn('[Poster Fetcher] atmovies search failed:', e);
      }
    }

    // ==========================================
    // 第四層：Gemini 智慧輔助 (若仍無海報且具備 API Key)
    // ==========================================
    const apiKey = (await getEffectiveGeminiKey()) || process.env.GEMINI_API_KEY;
    if (!posterUrl && apiKey) {
      try {
        const effectiveModel = await getEffectiveGeminiModel();
        const ai = new GoogleGenAI({ apiKey });
        const aiRes = await ai.models.generateContent({
          model: effectiveModel || 'gemini-3.8-flash',
          contents: `請利用網路搜尋找出電影「${cleanTitle}」${
            originalTitle ? `（${originalTitle}）` : ''
          }的官方直式電影海報公開圖片網址（.jpg 或 .png），以及上映年份、導演、簡介。
回傳乾淨 JSON：
{
  "posterUrl": "https://... 高清官方直式海報網址，若無可靠直式海報可填空字串",
  "director": "導演名稱",
  "releaseYear": "四位數字年份",
  "summary": "100字以內電影劇情大綱"
}`,
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (aiRes.text) {
          const parsed = JSON.parse(aiRes.text);
          if (parsed.posterUrl && parsed.posterUrl.startsWith('http')) {
            posterUrl = parsed.posterUrl;
            source = 'gemini';
          }
          if (parsed.director && !director) director = parsed.director;
          if (parsed.releaseYear && !releaseYear) releaseYear = parsed.releaseYear;
          if (parsed.summary && !summary) summary = parsed.summary;
        }
      } catch (aiErr) {
        console.warn('[Poster Fetcher] Gemini fallback error:', aiErr);
      }
    }

    return NextResponse.json({
      success: true,
      cleanTitle,
      originalTitle,
      posterUrl: posterUrl || null,
      summary: summary || null,
      director: director || null,
      releaseYear: releaseYear || null,
      source: source || 'fallback',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('API /api/movies/poster error:', msg);
    return NextResponse.json(
      { success: false, error: `抓取電影海報失敗：${msg}` },
      { status: 500 }
    );
  }
}
