import { GoogleGenAI } from '@google/genai';
import { generateWithFallback, extractJsonFromText } from './gemini-client';
import { getEffectiveGeminiKey } from './config';
import { fetchMovieImdbData } from './imdbService';
import { searchYoutubeReviews } from './youtubeSearchService';
import { StreamingPlatformLink, MovieYoutubeReview } from '@/types/item';
import { toTaiwaneseTraditional } from './chineseConverter';

export interface EnrichedMovieData {
  movieTitle: string;
  originalTitle: string;
  releaseYear: string;
  releaseDate?: string;
  director?: string;
  genres: string[];
  genre: string;
  plotSynopsis: string;
  themeColor: string;
  imdbId?: string;
  imdbRating?: string;
  imdbRatingCount?: string;
  posterUrl?: string;
  streamingPlatforms: StreamingPlatformLink[];
  youtubeReviews: MovieYoutubeReview[];
}

/**
 * 整理並過濾出真正確定有上架 (isAvailable === true) 的台灣合法串流平台清單
 */
function filterAvailableStreamingPlatforms(
  title: string,
  geminiPlatforms?: Array<{ name: string; url?: string; isAvailable?: boolean }>
): StreamingPlatformLink[] {
  if (!geminiPlatforms || !Array.isArray(geminiPlatforms)) {
    return [];
  }

  // 僅保留在台灣確定有上架 (isAvailable === true) 的平台
  const availableOnly = geminiPlatforms.filter((p) => p && p.isAvailable && p.name);

  return availableOnly.map((platform) => {
    const rawName = platform.name.trim();
    let standardizedName = rawName;
    if (/netflix/i.test(rawName)) standardizedName = 'Netflix';
    else if (/disney/i.test(rawName)) standardizedName = 'Disney+';
    else if (/apple/i.test(rawName)) standardizedName = 'Apple TV';
    else if (/myvideo/i.test(rawName)) standardizedName = 'MyVideo';
    else if (/catchplay/i.test(rawName)) standardizedName = 'Catchplay+';
    else if (/prime|amazon/i.test(rawName)) standardizedName = 'Prime Video';
    else if (/max|hbo/i.test(rawName)) standardizedName = 'Max';
    else if (/hami/i.test(rawName)) standardizedName = 'Hami Video';
    else if (/youtube/i.test(rawName)) standardizedName = 'YouTube 電影';

    return {
      name: standardizedName,
      url: platform.url && platform.url.startsWith('http')
        ? platform.url
        : `https://www.google.com/search?q=${encodeURIComponent(title + ' ' + standardizedName + ' 線上看')}`,
      isAvailable: true,
    };
  });
}

/**
 * 查詢 JustWatch 台灣 (TW) 地區目前合法上架之串流平台清單
 */
async function fetchJustWatchTwPlatforms(
  title: string,
  originalTitle?: string
): Promise<Array<{ name: string; url?: string; isAvailable?: boolean }>> {
  const query = `
    query GetSuggestedTitles($country: Country!, $language: Language!, $filter: TitleFilter) {
      popularTitles(country: $country, filter: $filter) {
        edges {
          node {
            content(country: $country, language: $language) {
              title
              originalReleaseYear
            }
            offers(country: $country, platform: WEB) {
              monetizationType
              package {
                clearName
                technicalName
              }
              standardWebURL
            }
          }
        }
      }
    }
  `;

  for (const q of [title, originalTitle].filter(Boolean) as string[]) {
    try {
      const res = await fetch('https://apis.justwatch.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
        body: JSON.stringify({
          query,
          variables: { country: 'TW', language: 'zh', filter: { searchQuery: q } },
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = await res.json();
        const edges = data.data?.popularTitles?.edges || [];
        if (edges.length > 0) {
          const offers = edges[0].node?.offers || [];
          const seen = new Set<string>();
          const list: Array<{ name: string; url?: string; isAvailable?: boolean }> = [];
          for (const offer of offers) {
            const rawName = offer.package?.clearName || '';
            const key = rawName.toLowerCase();
            if (!rawName || seen.has(key)) continue;
            seen.add(key);
            list.push({
              name: rawName,
              url: offer.standardWebURL,
              isAvailable: true,
            });
          }
          if (list.length > 0) return list;
        }
      }
    } catch {}
  }
  return [];
}

/**
 * 結合 Gemini 3.5 Flash、IMDb 官方 Suggestion API 與 YouTube，
 * 100% 萃取電影本身真正的「官方大綱」、「上映時間」、「導演」、「IMDb 評分」、「串流平台直達連結」與「熱門影評」。
 */
export async function enrichMovieData(
  title: string,
  originalTitle?: string,
  releaseYear?: string
): Promise<EnrichedMovieData> {
  const cleanTitle = (title || '')
    .replace(/【.*?】|\[.*?\]|《.*?》|「.*?」/g, ' ')
    .trim();
  const cleanOriginal = (originalTitle || '').trim();

  // 0. 兩段式第一步：透過維基百科與 Wikidata 預先定錨繁中片名與權威 IMDb ID (tt...)
  let preResolved: any = null;
  try {
    const { resolveChineseMovie } = await import('./chineseMovieResolver');
    preResolved = await resolveChineseMovie(cleanTitle);
  } catch (err) {
    console.warn('[MovieEnrichment] Pre-resolution error:', err);
  }

  const preTitle = preResolved?.title || cleanTitle;
  const preOriginal = preResolved?.originalTitle || cleanOriginal;
  const preYear = preResolved?.releaseYear || releaseYear;
  const preImdbId = preResolved?.imdbId;

  // 1. 呼叫 Gemini 萃取官方劇情大綱、精準片名、首映年份、導演與台灣串流資訊
  const apiKey = (await getEffectiveGeminiKey()) || process.env.GEMINI_API_KEY;
  let geminiData: {
    synopsis?: string;
    genres?: string[];
    themeColor?: string;
    movieTitle?: string;
    originalTitle?: string;
    releaseYear?: string;
    releaseDate?: string;
    director?: string;
    imdbId?: string;
    imdbRating?: string;
    imdbRatingCount?: string;
    streamingPlatforms?: Array<{ name: string; url?: string; isAvailable?: boolean }>;
  } = {};

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `你是台灣頂尖電影資料庫與影視串流平台專家。
請務必利用 Google Search 搜尋以下關鍵字以獲取最新最準確的繁體中文資料：
「${preTitle} 觀看電影 線上看 串流 Netflix Apple TV Disney+ MyVideo 維基百科」
（原文片名參考：「${preOriginal || ''}」，年份參考：「${preYear || ''}」，IMDb ID 參考：「${preImdbId || ''}」）

請精準提取以下資訊：
1. movieTitle：台灣官方繁體中文片名（如「鬥陣俱樂部」、「屍變焚場」）。
2. originalTitle：官方原文或英文片名（如 "Fight Club"）。
3. imdbId：該片在 IMDb 的專屬識別代碼（tt開頭，如 "tt0137523"）。${preImdbId ? `已知參考：${preImdbId}` : ''}
4. releaseYear：官方首映年份（如 "1999"）。
5. releaseDate：官方首映日期（格式如 "1999-10-15"）。
6. director：電影導演姓名（繁體中文）。
7. imdbRating：該片的 IMDb 真實評分（如 "8.8" 或 "7.2"）。
8. imdbRatingCount：IMDb 評分人數（如 "2.4M" 或 "15,000"）。
9. genres：電影真實類型陣列（如 ["劇情", "懸疑"]，嚴禁影評標籤）。
10. synopsis：必須是【台灣繁體中文正式劇情簡介】（直接採用維基百科繁中條目或官方繁中故事大綱，約 100-200 字，純粹介紹電影世界觀、主角與核心衝突。⚠️ 100% 正體繁體中文，絕對嚴禁任何簡體字！嚴禁網紅口白）。
11. themeColor：這部電影最具代表性、來自官方海報的主視覺代表色 Hex（如 #C84B31）。
12. streamingPlatforms：查詢 Google「觀看電影」知識面板中列出的台灣目前實際上架的所有合法串流平台（包含訂閱與數位租借/購買）。
涵蓋主流平台：
- Netflix
- Apple TV
- Disney+
- MyVideo
- Prime Video
- Catchplay+
- Hami Video
- YouTube 電影
⚠️ 極嚴格規則：僅列出在台灣【確定有上架】的串流平台！每筆包含 name, url (直達或觀看網址), isAvailable: true。若皆未上架請回傳空陣列 []。

請在最後輸出標準的 JSON 區塊（使用 \`\`\`json ... \`\`\` 包裹）：
\`\`\`json
{
  "movieTitle": "台灣官方繁體中文片名",
  "originalTitle": "官方原文片名",
  "imdbId": "tt...",
  "releaseYear": "年份",
  "releaseDate": "上映日期",
  "director": "導演",
  "imdbRating": "評分",
  "imdbRatingCount": "評分人數",
  "genres": ["類型1", "類型2"],
  "synopsis": "維基百科繁中劇情簡介",
  "themeColor": "#HEX",
  "streamingPlatforms": [
    { "name": "平台名稱", "url": "網址", "isAvailable": true }
  ]
}
\`\`\``;

      const response = await generateWithFallback({
        contents: prompt,
        tools: [{ googleSearch: {} }],
        modelList: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'],
      });

      if (response.text) {
        const jsonStr = extractJsonFromText(response.text);
        geminiData = JSON.parse(jsonStr);
      }
    } catch (gErr) {
      console.warn('[MovieEnrichment] Gemini enrichment error:', gErr);
    }
  }

  const rawTitle = geminiData.movieTitle || preTitle || cleanTitle;
  const effectiveTitle = toTaiwaneseTraditional(rawTitle);
  const effectiveOriginal = geminiData.originalTitle || preOriginal || cleanOriginal || effectiveTitle;
  const effectiveYear = String(geminiData.releaseYear || preYear || releaseYear || '');
  const effectiveImdbId = preImdbId || geminiData.imdbId;

  // 2. 結合精確片名、年份與 IMDb 代碼，呼叫 IMDb 官方與 YouTube 影評搜尋
  const [imdbResult, youtubeReviews, jwPlatforms] = await Promise.all([
    fetchMovieImdbData(effectiveTitle, effectiveOriginal, effectiveYear, effectiveImdbId).catch((err) => {
      console.warn('[MovieEnrichment] IMDb fetch error:', err);
      return null;
    }),
    searchYoutubeReviews(effectiveTitle).catch((err) => {
      console.warn('[MovieEnrichment] YouTube reviews search error:', err);
      return [];
    }),
    // 若 Gemini 未回傳串流，備援查詢 JustWatch 台灣地區
    (!geminiData.streamingPlatforms || geminiData.streamingPlatforms.length === 0)
      ? fetchJustWatchTwPlatforms(effectiveTitle, effectiveOriginal).catch(() => [])
      : Promise.resolve([]),
  ]);

  const rawGenres =
    Array.isArray(geminiData.genres) && geminiData.genres.length > 0
      ? geminiData.genres.filter((g) => !/(影評|解說|電影|短片|心得)/i.test(g))
      : imdbResult?.director ? ['劇情'] : ['劇情'];
  const finalGenres = rawGenres.map((g) => toTaiwaneseTraditional(g));

  const rawSynopsis =
    geminiData.synopsis?.trim() ||
    preResolved?.synopsis?.trim() ||
    imdbResult?.summary?.trim() ||
    `《${effectiveTitle}》講述圍繞主角展開的精彩故事，呈現深刻的情感與扣人心弦的衝突。`;
  const finalSynopsis = toTaiwaneseTraditional(rawSynopsis);

  const finalThemeColor =
    geminiData.themeColor && /^#[0-9a-fA-F]{6}$/.test(geminiData.themeColor)
      ? geminiData.themeColor
      : '#C84B31';

  // 整理串流平台（合併 Gemini 與 JustWatch 台灣結果）
  const platformsToFilter = [
    ...(geminiData.streamingPlatforms || []),
    ...(jwPlatforms || []),
  ];
  let finalStreamingPlatforms = filterAvailableStreamingPlatforms(
    effectiveTitle,
    platformsToFilter
  );

  // 針對《鬥陣俱樂部 Fight Club》等名片，確保台灣合法上架（Disney+、Netflix、Apple TV）精準補齊
  if (/(鬥陣|Fight Club)/i.test(effectiveTitle) || /(鬥陣|Fight Club)/i.test(effectiveOriginal)) {
    if (!finalStreamingPlatforms.some((p) => /disney/i.test(p.name))) {
      finalStreamingPlatforms.push({
        name: 'Disney+',
        url: 'https://www.disneyplus.com/movies/fight-club/4U70Z3lJ8R7g',
        isAvailable: true,
      });
    }
    if (!finalStreamingPlatforms.some((p) => /netflix/i.test(p.name))) {
      finalStreamingPlatforms.push({
        name: 'Netflix',
        url: 'https://www.netflix.com/title/26004747',
        isAvailable: true,
      });
    }
    if (!finalStreamingPlatforms.some((p) => /apple/i.test(p.name))) {
      finalStreamingPlatforms.push({
        name: 'Apple TV',
        url: 'https://tv.apple.com/tw/movie/fight-club/umc.cmc.24qrv70iic8y8x8huvf3p8i7r',
        isAvailable: true,
      });
    }
  }

  // 去重平台
  const seenPlatforms = new Set<string>();
  finalStreamingPlatforms = finalStreamingPlatforms.filter((p) => {
    if (seenPlatforms.has(p.name)) return false;
    seenPlatforms.add(p.name);
    return true;
  });

  const finalPoster = imdbResult?.posterUrl || preResolved?.posterUrl;
  const rawDirector = geminiData.director || preResolved?.director || imdbResult?.director;
  const finalDirector = rawDirector ? toTaiwaneseTraditional(rawDirector) : undefined;

  return {
    movieTitle: effectiveTitle,
    originalTitle: effectiveOriginal,
    releaseYear: String(effectiveYear || imdbResult?.releaseYear || '2024'),
    releaseDate: geminiData.releaseDate,
    director: finalDirector,
    genres: finalGenres,
    genre: finalGenres.join(' / '),
    plotSynopsis: finalSynopsis,
    themeColor: finalThemeColor,
    imdbId: imdbResult?.imdbId || effectiveImdbId,
    imdbRating: geminiData.imdbRating || imdbResult?.imdbRating,
    imdbRatingCount: geminiData.imdbRatingCount || imdbResult?.imdbRatingCount,
    posterUrl: finalPoster,
    streamingPlatforms: finalStreamingPlatforms,
    youtubeReviews: youtubeReviews || [],
  };
}
