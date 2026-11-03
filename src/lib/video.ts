/**
 * 影音與卡片比例判斷輔助工具
 */

import type { ParsedItem } from '@/types/item';

export function extractYouTubeVideoId(url?: string | null): string | null {
  if (!url) return null;
  try {
    const clean = url.trim().split('#')[0];
    const u = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      // 1. query param v (e.g. ?v=xxxx or ?feature=share&v=xxxx)
      const v = u.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      // 2. /shorts/{id}
      const shortsMatch = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/i);
      if (shortsMatch) return shortsMatch[1];

      // 3. /live/{id}
      const liveMatch = u.pathname.match(/\/live\/([a-zA-Z0-9_-]{11})/i);
      if (liveMatch) return liveMatch[1];

      // 4. /embed/{id}
      const embedMatch = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/i);
      if (embedMatch) return embedMatch[1];

      // 5. youtu.be/{id}
      if (u.hostname.includes('youtu.be')) {
        const id = u.pathname.replace(/^\/+/, '').split('/')[0];
        if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
    }
  } catch {
    // fallback to regex
  }

  const match = url.match(
    /(?:shorts\/|live\/|watch\?.*?v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : null;
}

/**
 * 檢查是否為無效或受污染的圖片 (例如 Apple Wallet 預設圖、placeholder 等)
 */
export function isInvalidThumbnail(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const lower = url.toLowerCase().trim();
  if (!lower) return true;
  if (lower.includes('walletcalistoga') || lower.includes('wallet-icon') || lower.includes('wallet')) {
    return true;
  }
  if (lower.includes('placeholder') || lower.includes('default-avatar') || lower.includes('no-image')) {
    return true;
  }
  return false;
}

/**
 * 嚴格且全面的縮圖 Fallback 讀取鏈：
 * 依序檢查：
 * 1. item.thumbnailUrl
 * 2. item.coverImage
 * 3. item.imageUrl
 * 4. item.image
 * 5. item.mediaInfo?.posterUrl
 * 6. item.productInfo?.officialImageUrl
 * 7. item.sources?.[0]?.thumbnailUrl
 * 8. item.sources?.[0]?.imageUrl
 * 9. 若以上皆為空或無效，且 item.url 或 sources?.[0]?.url 為 YouTube 網址，自動產生 https://i.ytimg.com/vi/${videoId}/hqdefault.jpg
 */
export function getEffectiveThumbnail(
  item?: any | null,
  fallbackUrl?: string | null
): string | null {
  if (!item && !fallbackUrl) return null;

  const candidates = [
    item?.thumbnailUrl,
    item?.image,
    item?.coverImage,
    item?.coverUrl,
    item?.imageUrl,
    item?.placeInfo?.photoUrl,
    item?.placeInfo?.PhotoUrl,
    item?.placeInfo?.imageUrl,
    item?.placeInfo?.thumbnailUrl,
    item?.recipeInfo?.coverImage,
    item?.recipeInfo?.imageUrl,
    item?.mediaInfo?.posterUrl,
    item?.productInfo?.officialImageUrl,
    item?.accountInfo?.avatarUrl,
    item?.sources?.[0]?.thumbnailUrl,
    item?.sources?.[0]?.imageUrl,
  ];

  for (const c of candidates) {
    if (c && typeof c === 'string' && !isInvalidThumbnail(c)) {
      return c.trim();
    }
  }

  // 檢查所有可能包含 YouTube Video ID 的網址
  const candidateUrls = [
    item?.url,
    fallbackUrl,
    item?.sources?.[0]?.url,
    ...(Array.isArray(item?.sources) ? item.sources.map((s: any) => s?.url) : []),
  ];

  for (const u of candidateUrls) {
    const ytId = extractYouTubeVideoId(u);
    if (ytId) {
      return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
    }
  }

  return null;
}

/**
 * 擷取 Instagram 貼文或 Reels 之 Shortcode
 */
export function extractInstagramShortcode(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:instagram\.com|instagr\.am)\/(?:reel|reels|p|tv|share\/reel)\/([a-zA-Z0-9_\-]+)/i
  );
  return match ? match[1] : null;
}

export interface VideoEmbedInfo {
  type: 'youtube' | 'instagram' | 'none';
  embedUrl: string | null;
  aspectRatio: '16:9' | '9:16';
  id: string | null;
}

/**
 * 取得影音網址的類型與比例資訊 (YouTube / Shorts / Instagram Reels)
 * 依照極簡穩定化規範：全站徹底停用所有 iframe 內嵌播放（避免跨域阻擋與黑畫面崩潰），
 * embedUrl 一律回傳 null，全站以高品質靜態海報展示，並以 target="_blank" 外連開啟原網站。
 */
export function getVideoEmbedInfo(url?: string | null): VideoEmbedInfo {
  if (!url) {
    return { type: 'none', embedUrl: null, aspectRatio: '9:16', id: null };
  }

  // 1. YouTube & YouTube Shorts
  const ytId = extractYouTubeVideoId(url);
  if (ytId) {
    const isShorts = isYouTubeShorts(url);
    return {
      type: 'youtube',
      embedUrl: null,
      aspectRatio: isShorts ? '9:16' : '16:9',
      id: ytId,
    };
  }

  // 2. Instagram Reels & Posts
  const igCode = extractInstagramShortcode(url);
  if (igCode) {
    return {
      type: 'instagram',
      embedUrl: null,
      aspectRatio: '9:16',
      id: igCode,
    };
  }

  return { type: 'none', embedUrl: null, aspectRatio: '9:16', id: null };
}

/**
 * 判斷網址是否為 YouTube Shorts (直式 9:16 短影音)
 */
export function isYouTubeShorts(url?: string | null): boolean {
  if (!url) return false;
  return /\/shorts\//i.test(url);
}

/**
 * 判斷網址是否為 YouTube 一般橫向長影片 (16:9 橫向長影片)
 */
export function isYouTubeStandardVideo(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  const isYt =
    lower.includes('youtube.com/watch') ||
    lower.includes('youtube.com/embed') ||
    lower.includes('youtube.com/v/') ||
    lower.includes('youtu.be/');
  return isYt && !isYouTubeShorts(url);
}

/**
 * 判斷網址是否為社群平台個人主頁 / 創作者帳號（IG Profile, YouTube Channel, Threads Account）
 */
export function isSocialProfile(url?: string | null): boolean {
  if (!url) return false;
  try {
    const clean = url.trim();
    // 1. Instagram Profile (例如 instagram.com/albo_daily 且非 /p/ 或 /reel/)
    if (/(?:instagram\.com|instagr\.am)\/([^/?#]+)/i.test(clean)) {
      const match = clean.match(/(?:instagram\.com|instagr\.am)\/([^/?#]+)/i);
      const segment = match ? match[1].toLowerCase() : '';
      const nonProfileSegments = ['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'direct', 'accounts'];
      if (segment && !nonProfileSegments.includes(segment)) {
        return true;
      }
    }
    // 2. YouTube Channel (@handle 或 /channel/ 或 /c/)
    if (/(?:youtube\.com\/(?:@|channel\/|c\/))/i.test(clean)) {
      return true;
    }
    // 3. Threads Profile (threads.net/@username)
    if (/(?:threads\.net\/@)/i.test(clean)) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * 唯一的長寬比判斷鐵律函式
 * 1. 只要明定 '1:1' 或為個人主頁 Profile ➔ 回傳 '1:1' 正方形
 * 2. 只要明定 '27:40' ➔ 回傳 '27:40' 電影直式海報
 * 3. 只要包含 /shorts/、instagram.com(貼文/影片)、tiktok.com、threads.net ➔ 回傳 '9:16'
 * 4. YouTube 一般長影片與一般食譜網站/部落格 ➔ 回傳 '16:9'
 */
export function getSourceAspectRatio(
  url?: string | null,
  explicitRatio?: string | null
): '9:16' | '16:9' | '1:1' | '27:40' {
  if (explicitRatio === '1:1') return '1:1';
  if (explicitRatio === '27:40') return '27:40';
  if (explicitRatio === '16:9') return '16:9';
  if (explicitRatio === '9:16') return '9:16';

  if (!url) return '16:9';

  // 1. 若為社群帳號 / 創作者主頁 ➔ 鎖定 '1:1' 正方形
  if (isSocialProfile(url)) {
    return '1:1';
  }

  const lower = url.toLowerCase();

  // 2. YouTube Shorts, Instagram Reels/Posts, TikTok, Threads 貼文 -> 強制 9:16
  if (
    lower.includes('/shorts/') ||
    lower.includes('instagram.com') ||
    lower.includes('instagr.am') ||
    lower.includes('tiktok.com') ||
    lower.includes('threads.net')
  ) {
    return '9:16';
  }

  // 3. YouTube 一般橫向長影片與食譜網站 (icook / cookpad) -> 強制 16:9
  if (
    ((lower.includes('youtube.com/') || lower.includes('youtu.be/')) &&
      !lower.includes('/shorts/')) ||
    lower.includes('icook.tw') ||
    lower.includes('cookpad.com')
  ) {
    return '16:9';
  }

  // 4. 一般網站預設為 '16:9'
  return '16:9';
}

/**
 * 嚴格維持原本的時間由新到舊順序，廢除會打亂時間的 16:9 與 9:16 拆池輪抽。
 * 每張卡片依自身比例自然呈現（16:9 col-span-2, 9:16 col-span-1），
 * 並單純交由 CSS grid-flow-dense 在不破壞時間順序的前提下自動填補空隙。
 */
export function buildInterleavedFeed<T>(
  list: T[],
  _getRatio?: (entry: T) => '16:9' | '9:16'
): T[] {
  return list;
}

/**
 * 判斷卡片視覺呈現比例：
 * 1. 在「電影專頁 (/collections)」且 category === 'media' 時：標準 IMDb One-Sheet 海報規格 (27:40)
 * 2. 在「主頁 (/ - 原始動態牆)」或一般模式下：依原始影片來源嚴格遵循 16:9 vs 9:16
 */
export type MediaAspectType = 'poster-27-40' | 'video-16-9' | 'vertical-9-16' | 'square-1-1';

export function getMediaAspectType(
  category: string,
  url: string,
  isCollectionsMode: boolean = false,
  explicitRatio?: string | null
): MediaAspectType {
  // 1. 電影專頁或 media 類別使用 IMDb One-Sheet 27:40 海報
  if (category === 'media' && isCollectionsMode) {
    return 'poster-27-40';
  }
  // 2. 創作者帳號或商品使用 1:1 正方形
  if (
    explicitRatio === '1:1' ||
    category === 'account' ||
    category === 'product' ||
    isSocialProfile(url)
  ) {
    return 'square-1-1';
  }

  const ratio = getSourceAspectRatio(url, explicitRatio);
  if (ratio === '1:1') return 'square-1-1';
  if (ratio === '16:9') return 'video-16-9';
  return 'vertical-9-16';
}

export function getMediaAspectClass(
  category: string,
  url: string,
  isCollectionsMode: boolean = false,
  explicitRatio?: string | null
): string {
  const type = getMediaAspectType(category, url, isCollectionsMode, explicitRatio);
  switch (type) {
    case 'poster-27-40':
      return 'aspect-[27/40] ring-1 ring-black/10';
    case 'square-1-1':
      return 'aspect-square ring-1 ring-black/10';
    case 'video-16-9':
      return 'aspect-video';
    case 'vertical-9-16':
    default:
      return 'aspect-[9/16]';
  }
}

/**
 * 保留 100% 原始網址（不做任何 Instagram 網址改寫、重組或正則截取）
 */
export function normalizeSocialUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  return url.trim();
}

/**
 * 嚴格來源貼文 (sources) 去重函式：
 * 同一支原始影片永遠只保留 1 筆，優先保留帶有完整標題與摘要的紀錄
 */
export function deduplicateSources<T extends { url: string; title?: string; summary?: string; thumbnailUrl?: string }>(
  sources?: T[] | null
): T[] {
  if (!sources || !Array.isArray(sources) || sources.length === 0) return [];

  const result: T[] = [];

  for (const s of sources) {
    if (!s || !s.url) continue;

    const rawUrl = s.url.trim();
    const thumbKey = s.thumbnailUrl ? s.thumbnailUrl.split('?')[0] : '';

    const existingIdx = result.findIndex((item) => {
      const itemRawUrl = (item.url || '').trim();
      const itemThumb = item.thumbnailUrl ? item.thumbnailUrl.split('?')[0] : '';
      if (rawUrl && itemRawUrl && rawUrl === itemRawUrl) return true;
      if (thumbKey && itemThumb && thumbKey === itemThumb) return true;
      return false;
    });

    if (existingIdx !== -1) {
      const current = result[existingIdx];
      const curScore = (current.title?.length || 0) + (current.summary?.length || 0);
      const newScore = (s.title?.length || 0) + (s.summary?.length || 0);
      if (newScore > curScore) {
        result[existingIdx] = {
          ...s,
          url: s.url,
        };
      }
    } else {
      result.push({
        ...s,
        url: s.url,
      });
    }
  }

  return result;
}

/**
 * 合集多地點影片卡片折疊歸併機制：
 * 若同支影片被拆分成多間店家（具有相同 URL 或相同縮圖），在瀑布流卡片牆折疊顯示為 1 張卡片，
 * 並且標題優先顯示「原本那支影片的總標題 (originalVideoTitle 或 sources[0].title)」！
 * 點擊縮圖打開詳細資訊卡時，將在詳細資訊卡中完整瀏覽該合集內含的所有獨立店家！
 */
export function collapseItemsForCompilation(items: ParsedItem[]): ParsedItem[] {
  const result: ParsedItem[] = [];
  const seenVideoKeys = new Set<string>();

  for (const item of items) {
    if (item.category !== 'place') {
      result.push(item);
      continue;
    }

    const normUrl = normalizeSocialUrl(item.url);
    const thumbKey = item.thumbnailUrl ? item.thumbnailUrl.split('?')[0] : '';
    const videoKey = normUrl || thumbKey;

    if (!videoKey) {
      result.push(item);
      continue;
    }

    if (seenVideoKeys.has(videoKey)) {
      // 該影片已有代表卡片在卡片牆，略過後續重複店名卡
      continue;
    }

    seenVideoKeys.add(videoKey);

    // 尋找所有來自同一支影片的拆分店家
    const siblings = items.filter(
      (other) =>
        other.category === 'place' &&
        ((normUrl && normalizeSocialUrl(other.url) === normUrl) ||
          (thumbKey && other.thumbnailUrl?.split('?')[0] === thumbKey))
    );

    if (siblings.length > 1) {
      // 聚合所有子地點，提供點開詳細卡時瀏覽
      const originalTitle =
        item.originalVideoTitle ||
        item.sources?.[0]?.title ||
        siblings.find((s) => s.originalVideoTitle)?.originalVideoTitle ||
        siblings.find((s) => s.sources?.[0]?.title)?.sources?.[0]?.title ||
        `私房熱門美食景點推薦懶人包（共 ${siblings.length} 間）`;

      const subPlaces = siblings.map((s) => ({
        name: s.placeInfo?.locationName || s.title,
        shopName: s.placeInfo?.locationName || s.title,
        city: s.placeInfo?.city,
        address: s.placeInfo?.address,
        highlight: s.summary,
        googleMapsQuery: s.placeInfo?.googleMapsQuery,
        mustTryDishes: s.placeInfo?.mustTryDishes,
        rating: s.placeInfo?.rating ? String(s.placeInfo.rating) : undefined,
      }));

      result.push({
        ...item,
        title: originalTitle,
        subPlaces,
      });
    } else {
      result.push(item);
    }
  }

  return result;
}

