/**
 * 繁體中文電影兩段式精準定錨解析服務
 * 結合維基百科繁中 API、Wikidata (IMDb P345)、iTunes 台灣電影 API 與 IMDb Suggestion API，
 * 徹底解決中文電影名稱與影評連結在 IMDb 搜尋配對失準的問題。
 */

import { toTaiwaneseTraditional } from './chineseConverter';

export interface ChineseMovieResolution {
  success: boolean;
  title: string;
  originalTitle?: string;
  releaseYear?: string;
  imdbId?: string;
  synopsis?: string;
  posterUrl?: string;
  director?: string;
  genres?: string[];
  source: string;
}

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * 清除標題雜訊，萃取純粹電影關鍵字
 */
export function cleanMovieSearchTitle(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^movie:/i, '')
    .replace(/【.*?】|\[.*?\]|《.*?》|「.*?」|（.*?）|\(.*?\)/g, ' ')
    .replace(/(?:電影|影評|解析|預告|彩蛋|Shorts|Reels|特輯|續集|解說|心得|大結局|講電影)/gi, ' ')
    .replace(/[：:·・\s\-_—]+/g, ' ')
    .trim();
}

/**
 * 透過維基百科繁中 API 與 Wikidata 查詢精準資料與 IMDb ID
 */
async function queryWikipediaAndWikidata(cleanTitle: string): Promise<{
  title?: string;
  synopsis?: string;
  posterUrl?: string;
  imdbId?: string;
  releaseYear?: string;
}> {
  if (!cleanTitle) return {};

  const searchCandidates = [
    cleanTitle,
    `${cleanTitle} (電影)`,
    `${cleanTitle} (台灣電影)`,
  ];

  for (const cand of searchCandidates) {
    try {
      const summaryUrl = `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cand)}`;
      const res = await fetch(summaryUrl, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.type === 'standard' && data.title) {
          const wikiTitle = data.title.replace(/\s*\(.*?\)/, '').trim();
          const synopsis = data.extract ? data.extract.trim() : undefined;
          const posterUrl = data.originalimage?.source || data.thumbnail?.source;
          const wikibaseItem = data.wikibase_item;

          // 上映年份提取 (從 description 或 extract 如 "2023年臺灣電影")
          let releaseYear: string | undefined;
          const descMatch = (data.description || synopsis || '').match(/(\d{4})年/);
          if (descMatch) {
            releaseYear = descMatch[1];
          }

          let imdbId: string | undefined;
          // 若有 Wikidata ID，查詢 IMDb 屬性 P345
          if (wikibaseItem) {
            try {
              const wdUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${wikibaseItem}&property=P345&format=json`;
              const wdRes = await fetch(wdUrl, {
                headers: { 'User-Agent': BROWSER_UA },
                signal: AbortSignal.timeout(3500),
              });
              if (wdRes.ok) {
                const wdData = await wdRes.json();
                const p345Value = wdData.claims?.P345?.[0]?.mainsnak?.datavalue?.value;
                if (typeof p345Value === 'string' && p345Value.startsWith('tt')) {
                  imdbId = p345Value;
                }
              }
            } catch (wdErr) {
              console.warn('[ChineseMovieResolver] Wikidata P345 lookup failed:', wdErr);
            }
          }

          return {
            title: wikiTitle,
            synopsis,
            posterUrl,
            imdbId,
            releaseYear,
          };
        }
      }
    } catch (e) {
      // 嘗試下一個候選詞
    }
  }

  // 若 summary 未直接命中，改用 opensearch 尋找首個電影條目
  try {
    const osUrl = `https://zh.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanTitle)}&limit=5&namespace=0&format=json`;
    const osRes = await fetch(osUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(4000),
    });

    if (osRes.ok) {
      const osData = await osRes.json();
      const titles: string[] = Array.isArray(osData?.[1]) ? osData[1] : [];
      const match = titles.find((t) => t.includes('電影') || t === cleanTitle) || titles[0];

      if (match && match !== cleanTitle) {
        return queryWikipediaAndWikidata(match);
      }
    }
  } catch {}

  return {};
}

/**
 * 查詢 iTunes 台灣電影 API
 */
async function queryItunesTw(cleanTitle: string): Promise<{
  title?: string;
  releaseYear?: string;
  posterUrl?: string;
  director?: string;
}> {
  if (!cleanTitle) return {};
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&country=tw&entity=movie&limit=5`;
    const res = await fetch(itunesUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.resultCount > 0 && Array.isArray(data.results)) {
        const item = data.results[0];
        const artwork: string | undefined = item.artworkUrl100;
        const hdArtwork = artwork
          ? artwork.replace(/100x100bb\.jpg$/i, '1000x1000bb.jpg')
          : undefined;

        let releaseYear: string | undefined;
        if (item.releaseDate) {
          releaseYear = String(new Date(item.releaseDate).getFullYear());
        }

        return {
          title: item.trackName || item.collectionName,
          releaseYear,
          posterUrl: hdArtwork,
          director: item.artistName,
        };
      }
    }
  } catch (err) {
    console.warn('[ChineseMovieResolver] iTunes TW query failed:', err);
  }
  return {};
}

/**
 * 根據 IMDb ID (tt...) 查詢官方 Suggestion API
 */
async function queryImdbSuggestionById(imdbId: string): Promise<{
  originalTitle?: string;
  releaseYear?: string;
  posterUrl?: string;
}> {
  if (!imdbId || !imdbId.startsWith('tt')) return {};
  try {
    const sugUrl = `https://v3.sg.media-imdb.com/suggestion/t/${imdbId}.json`;
    const res = await fetch(sugUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      const item = data.d?.[0];
      if (item) {
        const rawImg = item.i?.imageUrl;
        const hdPoster = rawImg
          ? rawImg.replace(/\._V1_.*\.jpg$/i, '._V1_FMjpg_UX1000_.jpg')
          : undefined;
        return {
          originalTitle: item.l,
          releaseYear: String(item.y || item.tl || ''),
          posterUrl: hdPoster,
        };
      }
    }
  } catch (e) {
    console.warn(`[ChineseMovieResolver] IMDb suggestion for ${imdbId} failed:`, e);
  }
  return {};
}

/**
 * 兩段式繁中電影定錨解析核心
 */
export async function resolveChineseMovie(rawInput: string): Promise<ChineseMovieResolution> {
  const cleanTitle = cleanMovieSearchTitle(rawInput);
  if (!cleanTitle) {
    return {
      success: false,
      title: rawInput,
      source: 'empty',
    };
  }

  // 1. 維基百科 ＋ Wikidata (IMDb P345) 查詢
  const [wikiResult, itunesResult] = await Promise.all([
    queryWikipediaAndWikidata(cleanTitle),
    queryItunesTw(cleanTitle),
  ]);

  const targetImdbId = wikiResult.imdbId;
  let imdbDetails: { originalTitle?: string; releaseYear?: string; posterUrl?: string } = {};

  if (targetImdbId) {
    imdbDetails = await queryImdbSuggestionById(targetImdbId);
  }

  const finalTitle = toTaiwaneseTraditional(wikiResult.title || itunesResult.title || cleanTitle);
  const finalOriginalTitle = imdbDetails.originalTitle;
  const finalYear =
    imdbDetails.releaseYear || wikiResult.releaseYear || itunesResult.releaseYear;
  const finalPoster =
    imdbDetails.posterUrl || itunesResult.posterUrl || wikiResult.posterUrl;
  const finalSynopsis = wikiResult.synopsis ? toTaiwaneseTraditional(wikiResult.synopsis) : undefined;
  const finalDirector = itunesResult.director ? toTaiwaneseTraditional(itunesResult.director) : undefined;

  return {
    success: Boolean(targetImdbId || finalOriginalTitle || finalPoster),
    title: finalTitle,
    originalTitle: finalOriginalTitle,
    releaseYear: finalYear,
    imdbId: targetImdbId,
    synopsis: finalSynopsis,
    posterUrl: finalPoster,
    director: finalDirector,
    source: targetImdbId ? 'wiki+wikidata+imdb' : 'heuristic',
  };
}
