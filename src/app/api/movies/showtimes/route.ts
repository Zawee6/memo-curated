import { NextRequest, NextResponse } from 'next/server';
import { generateWithFallback } from '@/lib/gemini-client';
import { getEffectiveGeminiKey } from '@/lib/config';
import { MovieShowtimeResponse, TheaterShowtime, HotMovieItem, StreamingPlatformInfo } from '@/types/item';
import { extractCleanMovieTitle } from '../poster/route';

interface ParsedMovieSchedule {
  title: string;
  theaterName: string;
  times: string[];
  hallInfo?: string;
  posterUrl?: string;
}

/**
 * 從開眼電影網 Jina Reader Markdown 中解析出該戲院今日上映的每部電影與場次
 */
function parseTheaterMarkdown(markdown: string, theaterName: string): ParsedMovieSchedule[] {
  const results: ParsedMovieSchedule[] = [];
  if (!markdown) return results;

  // 每個電影區塊通常以 `*   ![Image...](http://www.atmovies.com.tw/movie/...` 或 `#### 電影名稱` 開頭
  const blocks = markdown.split(/\n(?=\*\s+!\[|\#\#\#\#\s+|[\*•]\s+\[.*?\]\(http:\/\/www\.atmovies\.com\.tw\/movie\/)/);

  for (const block of blocks) {
    // 1. 抓取電影標題
    const titleMatch =
      block.match(/\[([^\n\]]+)\]\(http:\/\/www\.atmovies\.com\.tw\/movie\/[^\)]+\)/i) ||
      block.match(/####\s+([^\n]+)/);

    if (!titleMatch) continue;
    const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    if (!title || title.includes('開眼') || title.includes('電影網') || title.includes('其他戲院')) {
      continue;
    }

    // 2. 抓取海報圖
    const posterMatch = block.match(/https?:\/\/[^\s\)"']+\/photo101\/[^\s\)"']+\.jpg/i);
    const posterUrl = posterMatch ? posterMatch[0] : undefined;

    // 3. 抓取放映廳別與版本
    const hallMatch = block.match(/(IMAX|MX4D|LUXE\s*巨幕廳?|數位國語|數位|3D|2D|一般廳)/i);
    const hallInfo = hallMatch ? hallMatch[0].trim() : '數位 2D';

    // 4. 抓取所有場次時間（例如 10：00 或 13:20）
    const rawTimes = [...block.matchAll(/(?:\b|\s)(\d{1,2}[:：]\d{2})(?:\b|\s)/g)].map((m) =>
      m[1].replace('：', ':')
    );

    // 排除重複與非時間數值
    const times = Array.from(new Set(rawTimes)).filter((t) => {
      const [h, m] = t.split(':').map(Number);
      return h >= 0 && h <= 24 && m >= 0 && m <= 59;
    });

    if (times.length > 0) {
      // 避免重複添加同名同廳電影
      const existing = results.find((r) => r.title === title && r.hallInfo === hallInfo);
      if (existing) {
        existing.times = Array.from(new Set([...existing.times, ...times]));
      } else {
        results.push({
          title,
          theaterName,
          times,
          hallInfo,
          posterUrl,
        });
      }
    }
  }

  return results;
}

/**
 * 比對目標電影名稱是否命中排程片單
 */
function matchTargetMovie(target: string, schedules: ParsedMovieSchedule[]): ParsedMovieSchedule | undefined {
  if (!target || schedules.length === 0) return undefined;
  const cleanTarget = target.replace(/[:：\s《》【】\(\)（）]/g, '').toLowerCase();

  // 1. 完全或包含比對
  for (const s of schedules) {
    const cleanS = s.title.replace(/[:：\s《》【】\(\)（）]/g, '').toLowerCase();
    if (cleanS === cleanTarget || cleanS.includes(cleanTarget) || cleanTarget.includes(cleanS)) {
      return s;
    }
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawMovieTitle = (body?.movieTitle || '').trim();
    const explicitEn = (body?.originalTitle || '').trim();

    if (!rawMovieTitle && !explicitEn) {
      return NextResponse.json(
        { success: false, error: '請提供有效的電影名稱 (movieTitle)。' },
        { status: 400 }
      );
    }

    const { cleanTitle, originalTitle: inferredEn } = extractCleanMovieTitle(rawMovieTitle);
    const originalTitle = explicitEn || inferredEn;
    const searchTitle = cleanTitle || rawMovieTitle;

    // 嘉義兩大影城官方網址
    const carnivalTimetableUrl = 'https://www.3d-movies.tw/time.aspx';
    const carnivalBookingUrl = 'http://booking.3d-movies.tw/';
    const in89TimetableUrl = 'https://www.in89cinemax.com/film_list.aspx?TheaterId=17';
    const in89BookingUrl = 'https://www.in89cinemax.com/index.aspx?TheaterId=17#';

    // 1. 並行透過 Jina Reader 爬取嘉義兩大影城即時真實時刻表
    // 嘉義嘉年華: t05502, 嘉義 in89: t05505
    const carnivalFetchUrl = 'https://r.jina.ai/http://www.atmovies.com.tw/showtime/t05502/a05/';
    const in89FetchUrl = 'https://r.jina.ai/http://www.atmovies.com.tw/showtime/t05505/a05/';

    const [carnivalText, in89Text] = await Promise.all([
      fetch(carnivalFetchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        signal: AbortSignal.timeout(6000),
      })
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => ''),
      fetch(in89FetchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        signal: AbortSignal.timeout(6000),
      })
        .then((r) => (r.ok ? r.text() : ''))
        .catch(() => ''),
    ]);

    // 2. 本地精準解析
    const carnivalSchedules = parseTheaterMarkdown(carnivalText, '🎪 嘉義嘉年華影城');
    const in89Schedules = parseTheaterMarkdown(in89Text, '🍿 嘉義 in89 豪華影城');

    const matchedCarnival =
      matchTargetMovie(searchTitle, carnivalSchedules) ||
      (originalTitle ? matchTargetMovie(originalTitle, carnivalSchedules) : undefined);

    const matchedIn89 =
      matchTargetMovie(searchTitle, in89Schedules) ||
      (originalTitle ? matchTargetMovie(originalTitle, in89Schedules) : undefined);

    const hasCarnival = Boolean(matchedCarnival && matchedCarnival.times.length > 0);
    const hasIn89 = Boolean(matchedIn89 && matchedIn89.times.length > 0);
    const isNowPlaying = hasCarnival || hasIn89;

    // 彙整「🔥 今日嘉義嘉年華 & in89 實際熱映中的電影與場次一覽」
    const todayChiayiHotMovies: HotMovieItem[] = [];
    const seenHot = new Set<string>();

    for (const item of [...in89Schedules, ...carnivalSchedules]) {
      const key = `${item.theaterName}_${item.title}`;
      if (!seenHot.has(key)) {
        seenHot.add(key);
        todayChiayiHotMovies.push({
          title: item.title,
          theaterName: item.theaterName,
          times: item.times.slice(0, 8),
          hallInfo: item.hallInfo,
          posterUrl: item.posterUrl,
        });
      }
    }

    // 建構兩大影城當前放映狀態
    const theatersResult: TheaterShowtime[] = [
      {
        name: '🎪 嘉義嘉年華影城',
        hasShowtimes: hasCarnival,
        times: matchedCarnival?.times || [],
        hallInfo: matchedCarnival?.hallInfo || '數位 2D / 嘉義中山路617號',
        timetableUrl: carnivalTimetableUrl,
        bookingUrl: carnivalBookingUrl,
        note: hasCarnival
          ? `今日熱映中（${matchedCarnival?.title}），點擊線上訂票劃位`
          : '今日暫無放映場次，可點擊查看嘉年華官方即時公告',
      },
      {
        name: '🍿 嘉義 in89 豪華影城',
        hasShowtimes: hasIn89,
        times: matchedIn89?.times || [],
        hallInfo: matchedIn89?.hallInfo || 'LUXE 旗艦巨幕 / 嘉義民族路328號',
        timetableUrl: in89TimetableUrl,
        bookingUrl: in89BookingUrl,
        note: hasIn89
          ? `今日熱映中（${matchedIn89?.title}），點擊前往 in89 官網劃位`
          : '今日暫無放映場次，可點擊查看 in89 官網（嘉義影食匯）',
      },
    ];

    // 3. 嘗試使用 Gemini 2.5 Flash 進行語意補充（精準查詢 Netflix, Disney+, HBO 3 大串流平台與排片場次）
    let status: '上映中' | '即將上映' | '已下檔 / 串流熱播' = isNowPlaying
      ? '上映中'
      : '已下檔 / 串流熱播';
    let streamingPlatforms: string[] = [];
    let netflixAvailable = false;
    let disneyAvailable = false;
    let hboAvailable = false;

    const apiKey = (await getEffectiveGeminiKey()) || process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const prompt = `你是一個極度精準的台灣院線電影與串流影音專家。
目標電影：「${searchTitle}」${originalTitle ? `（${originalTitle}）` : ''}

以下是從台灣嘉義兩間影城（嘉義嘉年華影城、嘉義 in89 豪華影城）今日抓取的即時排片時刻表文字摘要：
【嘉年華影城今日片單】：
${carnivalSchedules.map((s) => `• ${s.title}（${s.hallInfo}）：${s.times.join(', ')}`).join('\n')}

【in89 豪華影城今日片單】：
${in89Schedules.map((s) => `• ${s.title}（${s.hallInfo}）：${s.times.join(', ')}`).join('\n')}

請依據你的最新知識庫嚴格判斷：
1. 目標電影是否在上述任一間戲院上映？若有，列出完整場次。
2. 這部電影目前是否可在台灣的下列 3 大串流平台上觀看（訂閱或隨選隨看）：
   - Netflix (台灣)
   - Disney+ (台灣)
   - HBO / Max (台灣)
3. 若不在今日院線時刻表，請判定為「已下檔 / 串流熱播」或「即將上映」。

回傳乾淨 JSON：
{
  "status": "上映中" | "即將上映" | "已下檔 / 串流熱播",
  "streamingDetails": {
    "netflix": boolean,
    "disneyPlus": boolean,
    "hbo": boolean
  },
  "streamingPlatforms": ["上架的平台名稱"],
  "carnivalTimes": ["時間字串"],
  "in89Times": ["時間字串"]
}`;

        const aiRes = await generateWithFallback({
          contents: prompt,
          responseMimeType: 'application/json',
        });

        if (aiRes.text) {
          const parsed = JSON.parse(aiRes.text);
          if (parsed.status) status = parsed.status;
          if (Array.isArray(parsed.streamingPlatforms)) {
            streamingPlatforms = parsed.streamingPlatforms;
          }
          if (parsed.streamingDetails) {
            netflixAvailable = Boolean(parsed.streamingDetails.netflix);
            disneyAvailable = Boolean(parsed.streamingDetails.disneyPlus);
            hboAvailable = Boolean(parsed.streamingDetails.hbo);
          }
          if (Array.isArray(parsed.carnivalTimes) && parsed.carnivalTimes.length > 0 && !hasCarnival) {
            theatersResult[0].hasShowtimes = true;
            theatersResult[0].times = parsed.carnivalTimes;
            status = '上映中';
          }
          if (Array.isArray(parsed.in89Times) && parsed.in89Times.length > 0 && !hasIn89) {
            theatersResult[1].hasShowtimes = true;
            theatersResult[1].times = parsed.in89Times;
            status = '上映中';
          }
        }
      } catch (aiErr) {
        console.warn('[Showtimes API] Gemini enrichment skipped:', aiErr);
      }
    }

    // 若有平台命中，補充至 streamingPlatforms
    if (netflixAvailable && !streamingPlatforms.includes('Netflix')) streamingPlatforms.push('Netflix');
    if (disneyAvailable && !streamingPlatforms.includes('Disney+')) streamingPlatforms.push('Disney+');
    if (hboAvailable && !streamingPlatforms.includes('HBO')) streamingPlatforms.push('HBO');

    const netflixWatchUrl = `https://www.netflix.com/search?q=${encodeURIComponent(searchTitle)}`;
    const disneyWatchUrl = `https://www.disneyplus.com/search?q=${encodeURIComponent(searchTitle)}`;
    const hboWatchUrl = `https://www.max.com/search?q=${encodeURIComponent(searchTitle)}`;

    const streamingDetails: StreamingPlatformInfo[] = [
      {
        name: 'Netflix',
        isAvailable: netflixAvailable,
        watchUrl: netflixWatchUrl,
      },
      {
        name: 'Disney+',
        isAvailable: disneyAvailable,
        watchUrl: disneyWatchUrl,
      },
      {
        name: 'HBO',
        isAvailable: hboAvailable,
        watchUrl: hboWatchUrl,
      },
    ];

    return NextResponse.json({
      success: true,
      movieTitle: searchTitle,
      status,
      streamingPlatforms,
      streamingDetails,
      theaters: theatersResult,
      todayChiayiHotMovies: todayChiayiHotMovies.slice(0, 12),
      updatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('API /api/movies/showtimes error:', msg);
    return NextResponse.json(
      { success: false, error: `查詢場次失敗：${msg}` },
      { status: 500 }
    );
  }
}
