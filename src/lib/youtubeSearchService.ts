import { MovieYoutubeReview } from '@/types/item';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * 在 YouTube 搜尋指定電影的熱門影評與解析影片（前 3~4 支）
 */
export async function searchYoutubeReviews(movieTitle: string): Promise<MovieYoutubeReview[]> {
  const cleanTitle = (movieTitle || '')
    .replace(/【.*?】|\[.*?\]|《.*?》/g, ' ')
    .trim();

  if (!cleanTitle) return [];

  const query = `${cleanTitle} 影評`;
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      console.warn(`[YouTube Search] HTTP error: ${res.status}`);
      return [];
    }

    const html = await res.text();
    const match =
      html.match(/var ytInitialData = ({[\s\S]*?});<\/script>/) ||
      html.match(/ytInitialData\s*=\s*({[\s\S]+?});/);

    if (!match) {
      console.warn('[YouTube Search] ytInitialData not found in response');
      return [];
    }

    const data = JSON.parse(match[1]);
    const contents =
      data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents;
    const items = contents?.[0]?.itemSectionRenderer?.contents || [];

    const reviews: MovieYoutubeReview[] = [];

    for (const item of items) {
      const vr = item.videoRenderer;
      if (!vr) continue;

      const videoId = vr.videoId;
      const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText;
      const channelName = vr.ownerText?.runs?.[0]?.text;
      const thumbnail = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url;

      if (videoId && title) {
        reviews.push({
          videoId,
          title,
          channelName,
          thumbnail,
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }

      if (reviews.length >= 4) break;
    }

    return reviews;
  } catch (err) {
    console.warn('[YouTube Search] Failed to fetch reviews for:', movieTitle, err);
    return [];
  }
}
