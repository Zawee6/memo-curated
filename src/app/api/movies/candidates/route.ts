import { NextRequest, NextResponse } from 'next/server';
import { toTaiwaneseTraditional } from '@/lib/chineseConverter';

import { MovieCandidateItem } from '@/types/item';
export type { MovieCandidateItem };

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q) {
    return NextResponse.json({ success: true, candidates: [] });
  }

  const cleanQ = q
    .replace(/【.*?】|\[.*?\]|《.*?》|「.*?」/g, ' ')
    .replace(/(?:電影|影評|解析|預告|彩蛋|Shorts|Reels|特輯|續集)/gi, ' ')
    .trim();

  const candidates: MovieCandidateItem[] = [];
  const seenIds = new Set<string>();

  // 1. 維基百科 Opensearch 尋找同名電影條目（如「罪人 (2025年電影)」、「罪人 (2021年電影)」）
  try {
    const osUrl = `https://zh.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanQ)}&limit=6&namespace=0&format=json`;
    const osRes = await fetch(osUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(3500),
    });

    if (osRes.ok) {
      const osData = await osRes.json();
      const titles: string[] = Array.isArray(osData?.[1]) ? osData[1] : [];
      const movieTitles = titles.filter(
        (t) => t.includes('電影') || t.includes('film') || t === cleanQ
      );

      for (const title of movieTitles.slice(0, 3)) {
        try {
          const sumUrl = `https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
          const sumRes = await fetch(sumUrl, {
            headers: { 'User-Agent': BROWSER_UA },
            signal: AbortSignal.timeout(3000),
          });
          if (sumRes.ok) {
            const sumData = await sumRes.json();
            const wikibaseItem = sumData.wikibase_item;
            let imdbId: string | undefined;

            if (wikibaseItem) {
              const wdUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${wikibaseItem}&property=P345&format=json`;
              const wdRes = await fetch(wdUrl, {
                headers: { 'User-Agent': BROWSER_UA },
                signal: AbortSignal.timeout(3000),
              });
              if (wdRes.ok) {
                const wdData = await wdRes.json();
                const p345 = wdData.claims?.P345?.[0]?.mainsnak?.datavalue?.value;
                if (typeof p345 === 'string' && p345.startsWith('tt')) {
                  imdbId = p345;
                }
              }
            }

            const yearMatch = (sumData.description || sumData.extract || '').match(/(\d{4})年/);
            const releaseYear = yearMatch ? yearMatch[1] : undefined;

            if (imdbId && !seenIds.has(imdbId)) {
              seenIds.add(imdbId);
              candidates.push({
                imdbId,
                title: toTaiwaneseTraditional(sumData.title.replace(/\s*\(.*?\)/, '').trim()),
                originalTitle: sumData.title,
                releaseYear,
                posterUrl: sumData.originalimage?.source || sumData.thumbnail?.source,
                overview: toTaiwaneseTraditional(sumData.extract?.slice(0, 120) || ''),
                source: 'wikipedia',
              });
            }
          }
        } catch {}
      }
    }
  } catch {}

  // 2. iTunes 台灣電影 API
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&country=tw&entity=movie&limit=5`;
    const itunesRes = await fetch(itunesUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(3500),
    });
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      for (const item of itunesData.results || []) {
        const title = toTaiwaneseTraditional(item.trackName || '');
        const idKey = `itunes_${item.trackId}`;
        if (!seenIds.has(idKey)) {
          seenIds.add(idKey);
          candidates.push({
            title,
            originalTitle: item.trackName,
            releaseYear: item.releaseDate ? item.releaseDate.slice(0, 4) : undefined,
            posterUrl: item.artworkUrl100
              ? item.artworkUrl100.replace(/100x100bb\.jpg$/i, '600x600bb.jpg')
              : undefined,
            director: item.artistName ? toTaiwaneseTraditional(item.artistName) : undefined,
            overview: item.longDescription
              ? toTaiwaneseTraditional(item.longDescription.slice(0, 120) + '...')
              : undefined,
            source: 'itunes-tw',
          });
        }
      }
    }
  } catch {}

  // 3. IMDb Suggestion API
  try {
    const sugUrl = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(cleanQ)}.json`;
    const sugRes = await fetch(sugUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(3500),
    });
    if (sugRes.ok) {
      const sugData = await sugRes.json();
      for (const item of sugData.d || []) {
        if (!item.id?.startsWith('tt')) continue;
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);

        const poster = item.i?.imageUrl
          ? item.i.imageUrl.replace(/\._V1_.*\.jpg$/i, '._V1_FMjpg_UX600_.jpg')
          : undefined;

        candidates.push({
          imdbId: item.id,
          title: toTaiwaneseTraditional(item.l || cleanQ),
          originalTitle: item.l,
          releaseYear: String(item.y || ''),
          posterUrl: poster,
          cast: item.s,
          overview: item.s ? `主演：${item.s}` : undefined,
          source: 'imdb-suggestion',
        });
      }
    }
  } catch {}

  // 4. 若候選包含 imdbId 但缺海報或導演，補充 OMDb 資料
  for (const cand of candidates.slice(0, 5)) {
    if (cand.imdbId && (!cand.posterUrl || !cand.director)) {
      try {
        const omdbRes = await fetch(
          `https://www.omdbapi.com/?i=${cand.imdbId}&apikey=trilogy`,
          { signal: AbortSignal.timeout(2000) }
        );
        if (omdbRes.ok) {
          const omdbData = await omdbRes.json();
          if (omdbData.Response === 'True') {
            if (!cand.posterUrl && omdbData.Poster && omdbData.Poster !== 'N/A') {
              cand.posterUrl = omdbData.Poster;
            }
            if (!cand.director && omdbData.Director && omdbData.Director !== 'N/A') {
              cand.director = toTaiwaneseTraditional(omdbData.Director);
            }
            if (!cand.overview && omdbData.Plot && omdbData.Plot !== 'N/A') {
              cand.overview = toTaiwaneseTraditional(omdbData.Plot);
            }
          }
        }
      } catch {}
    }
  }

  return NextResponse.json({
    success: true,
    query: cleanQ,
    candidates: candidates.slice(0, 6),
  });
}
