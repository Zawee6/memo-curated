/**
 * 串流平台直達連結產生器與片名清洗工具
 */

/**
 * 自動萃取純淨片名：
 * 優先提取書名號《...》、引號「...」內的正式片名，並過濾影評、解析、推薦語氣詞與無關雜訊。
 */
export function cleanMediaTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = rawTitle.trim();

  // 1. 若有《...》，為繁中影視作品最標準書名號，最優先取出
  const bookMatch = title.match(/《([^》]+)》/);
  if (bookMatch && bookMatch[1].trim()) {
    return sanitizeTitleString(bookMatch[1].trim());
  }

  // 2. 若有「...」或『...』引號，次優先取出
  const quoteMatch = title.match(/[「『]([^」』]+)[」』]/);
  if (quoteMatch && quoteMatch[1].trim()) {
    return sanitizeTitleString(quoteMatch[1].trim());
  }

  // 3. 若有【...】，避開純標籤字眼後取出候選片名
  const tagMatch = title.match(/【([^】]+)】/);
  if (tagMatch && tagMatch[1].trim()) {
    const candidate = tagMatch[1].trim();
    if (
      !/^(影評|劇評|預告|推薦|線上看|心得|有雷|無雷|解析|懶人包|討論|精華|短評|開箱|解說|HD|4K|完結)$/i.test(
        candidate
      )
    ) {
      return sanitizeTitleString(candidate);
    }
    // 若僅為分類標籤，則去除標籤後繼續向下清洗
    title = title.replace(/【[^】]*】/g, ' ');
  }

  // 移除常見的包覆方括號：[...]、(...)
  title = title.replace(/\[[^\]]*\]/g, ' ');
  title = title.replace(/【[^】]*】/g, ' ');

  // 4. 去除尾綴常見的影評、解析、推薦與宣傳關鍵字
  title = title
    .replace(
      /(?:全[0-9]+集|第[0-9]+集|完結篇|大結局|結局|結局解析|深度解析|彩蛋解析|解析|影評|劇評|心得|評價|觀後感|線上看|線上高清|完整版|預告片?|推薦|必看|神作|神劇|懶人包|懶人包整理|科普|解說|解讀|劇情介紹|劇情解析|亮點|重點整理|片單).*/i,
      ''
    )
    .trim();

  // 5. 移除常見畫質與串流平台雜訊
  title = title
    .replace(/\b(4K|1080[pP]|720[pP]|HD|UHD)\b/g, '')
    .replace(
      /\b(netflix|disney\+?|hbo\s*max|hbo|apple\s*tv\+?|prime\s*video|friday|myvideo|line\s*tv)\b/gi,
      ''
    )
    .trim();

  return sanitizeTitleString(title) || rawTitle.trim();
}

/**
 * 輔助清洗字串前後標點與空白
 */
function sanitizeTitleString(str: string): string {
  return str
    .replace(/^[\s:：\-—_\|｜#~·]+/g, '')
    .replace(/[\s:：\-—_\|｜#~·]+$/g, '')
    .trim();
}

/**
 * 根據串流平台名稱與片名，產生精準的官方直達跳轉連結。
 * 若已有有效的直接網址（且非通用 Google 搜尋），優先使用；否則產生該平台官方搜尋網址。
 */
export function getStreamingPlatformUrl(
  platformName: string,
  rawTitle: string,
  existingUrl?: string
): string {
  // 1. 若資料庫中已有直接網址且非 Google 搜尋，直接回傳
  if (
    existingUrl &&
    existingUrl.startsWith('http') &&
    !existingUrl.includes('google.com/search')
  ) {
    return existingUrl;
  }

  const title = cleanMediaTitle(rawTitle);
  const p = (platformName || '').trim();

  // 2. 台灣常用主流串流平台官方搜尋 URL 映射
  if (/netflix/i.test(p)) {
    return `https://www.netflix.com/search?q=${encodeURIComponent(title)}`;
  }
  if (/disney/i.test(p)) {
    return `https://www.disneyplus.com/search?q=${encodeURIComponent(title)}`;
  }
  if (/apple/i.test(p)) {
    return `https://tv.apple.com/tw/search?term=${encodeURIComponent(title)}`;
  }
  if (/prime|amazon/i.test(p)) {
    return `https://www.amazon.com/gp/video/storefront?phrase=${encodeURIComponent(title)}`;
  }
  if (/max|hbo/i.test(p)) {
    return `https://www.max.com/search?q=${encodeURIComponent(title)}`;
  }
  if (/巴哈|動畫瘋|gamer|ani/i.test(p)) {
    return `https://ani.gamer.com.tw/search.php?kw=${encodeURIComponent(title)}`;
  }
  if (/line\s*tv/i.test(p)) {
    return `https://www.linetv.tw/search?q=${encodeURIComponent(title)}`;
  }
  if (/friday|遠傳/i.test(p)) {
    return `https://video.friday.tw/search/${encodeURIComponent(title)}`;
  }
  if (/myvideo/i.test(p)) {
    return `https://www.myvideo.net.tw/search/${encodeURIComponent(title)}`;
  }
  if (/hami|中華電信/i.test(p)) {
    return `https://hamivideo.hinet.net/search.do?keyword=${encodeURIComponent(title)}`;
  }
  if (/catchplay/i.test(p)) {
    return `https://www.catchplay.com/tw/search?q=${encodeURIComponent(title)}`;
  }
  if (/愛奇藝|iqiyi|iq/i.test(p)) {
    return `https://www.iq.com/search?query=${encodeURIComponent(title)}`;
  }
  if (/youtube/i.test(p)) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' 電影')}`;
  }

  // 3. 通用預設備援：導向 Google 精準線上看搜尋
  return `https://www.google.com/search?q=${encodeURIComponent(title + ' ' + p + ' 線上看')}`;
}
