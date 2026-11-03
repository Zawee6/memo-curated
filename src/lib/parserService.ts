import { GoogleGenAI, Type } from '@google/genai';
import { generateWithFallback } from '@/lib/gemini-client';
import { getEffectiveGeminiKey } from '@/lib/config';
import { ParsedItem, PlaceInfo, RecipeInfo, MediaInfo, ShoppingPlan, MovieCandidateItem } from '@/types/item';
import { formatDate } from '@/lib/format';
import { fetchMovieImdbData } from '@/lib/imdbService';
import { enrichMovieData } from '@/lib/movieEnrichmentService';
import { isYouTubeStandardVideo, getMediaAspectType, getSourceAspectRatio, isSocialProfile, isInvalidThumbnail } from '@/lib/video';
import { CITY_COORDINATES, getFallbackCoordinates } from '@/lib/geoUtils';
import { getRecipeSmartTags } from '@/lib/recipeUtils';
import { fixPlaceMetadata, extractCityFromText } from '@/lib/location-normalizer';
export { getFallbackCoordinates };

const JINA_TIMEOUT_MS = 8000;
const MAX_CONTENT_LENGTH = 30000;

// 1. 智慧分離網址與周圍附帶文字 (例如從手機分享表單複製的一整段字串)
export function splitUrlAndText(rawInput: string): { url: string; extraText: string } {
  const trimmed = (rawInput || '').trim();
  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = trimmed.match(urlRegex);

  if (match && match[1]) {
    const matchedUrl = match[1];
    const surrounding = trimmed.replace(matchedUrl, '').replace(/\s+/g, ' ').trim();
    return {
      url: matchedUrl,
      extraText: surrounding,
    };
  }

  return {
    url: trimmed,
    extraText: '',
  };
}

// 2. 短網址與分享跳轉還原 (例如 instagram.com/share/reel/xxx, vt.tiktok.com/xxx)
export async function resolveShareRedirects(url: string): Promise<string> {
  const lower = url.toLowerCase();
  const isRedirector =
    lower.includes('instagram.com/share/') ||
    lower.includes('vt.tiktok.com/') ||
    lower.includes('vm.tiktok.com/') ||
    lower.includes('bit.ly/') ||
    lower.includes('tinyurl.com/') ||
    lower.includes('maps.app.goo.gl/');

  if (!isRedirector) return url;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (res.ok && res.url && res.url !== url) {
      console.log(`[Scraper Debug] 🔀 Resolved short URL redirect: ${url} -> ${res.url}`);
      return res.url;
    }
  } catch (err) {
    console.warn('[Scraper Debug] Redirect resolution failed, keeping original URL:', err);
  }

  return url;
}

// 3. 網址清理 (URL Sanitization) 與 Shortcode 提取
export function sanitizeUrl(rawUrl: string): { cleanUrl: string; shortcode: string | null } {
  try {
    let normalized = rawUrl.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `https://${normalized}`;
    }

    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();
    let shortcode: string | null = null;

    // Instagram：僅提取 shortcode 供爬蟲使用，100% 保留原始網址不做任何改寫或截斷
    if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) {
      const match = parsed.pathname.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
      if (match && match[1]) {
        shortcode = match[1];
      }
      return {
        cleanUrl: normalized,
        shortcode,
      };
    }

    // YouTube 專屬清理：統一為標準 Shorts 與 Watch 格式（嚴禁儲存 embed 網址）
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      // 1. YouTube Shorts
      if (parsed.pathname.includes('/shorts/')) {
        const idMatch = parsed.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/i);
        const ytId = idMatch ? idMatch[1] : parsed.pathname.split('/shorts/')[1]?.split('/')[0]?.split('?')[0];
        if (ytId) {
          return {
            cleanUrl: `https://www.youtube.com/shorts/${ytId}`,
            shortcode: ytId,
          };
        }
      }
      // 2. youtu.be 短網址
      if (hostname.includes('youtu.be')) {
        const idMatch = parsed.pathname.replace(/^\/+/, '').match(/^([a-zA-Z0-9_-]{11})/i);
        const ytId = idMatch ? idMatch[1] : parsed.pathname.replace(/^\/+/, '').split('/')[0]?.split('?')[0];
        if (ytId) {
          return {
            cleanUrl: `https://www.youtube.com/watch?v=${ytId}`,
            shortcode: ytId,
          };
        }
      }
      // 3. /embed/ 網址還原為標準 watch 網址
      if (parsed.pathname.includes('/embed/')) {
        const idMatch = parsed.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/i);
        if (idMatch && idMatch[1]) {
          return {
            cleanUrl: `https://www.youtube.com/watch?v=${idMatch[1]}`,
            shortcode: idMatch[1],
          };
        }
      }
      // 4. 一般 watch 影片
      const v = parsed.searchParams.get('v');
      if (v) {
        return {
          cleanUrl: `https://www.youtube.com/watch?v=${v}`,
          shortcode: v,
        };
      }
    }

    // Threads 專屬清理：提取 shortcode
    if (hostname.includes('threads.net')) {
      const match = parsed.pathname.match(/\/post\/([A-Za-z0-9_-]+)/i);
      if (match && match[1]) {
        shortcode = match[1];
      }
    }

    // 一般與社群網站清除常見追蹤參數
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'igsh',
      'obrf',
      'srtk',
      'si',
      'feature',
      'fbclid',
      'gclid',
      'xmt',
      '_r',
      'share_id',
      'ref',
      'ref_src',
      'is_copy_url',
      'is_from_webapp',
      'sender_device',
      'xtok',
      'dlrf',
    ];

    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }

    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (
        key.startsWith('ig') ||
        key.startsWith('utm') ||
        key.startsWith('fb') ||
        key === 't' ||
        key === 's'
      ) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((k) => parsed.searchParams.delete(k));

    return {
      cleanUrl: parsed.toString(),
      shortcode,
    };
  } catch {
    return {
      cleanUrl: rawUrl.trim(),
      shortcode: null,
    };
  }
}

// 4. 完整的 HTML 實體字元解碼器 (支援 Unicode Code Point 與雙重編碼)
export function decodeHtmlEntities(input: string): string {
  if (!input) return '';

  const decodePass = (str: string): string =>
    str
      // 1. 常見命名實體
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;|&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&hellip;/gi, '…')
      .replace(/&mdash;/gi, '—')
      .replace(/&ndash;/gi, '–')
      .replace(/&bull;/gi, '•')
      // 2. 解碼 16 進位實體 (使用 fromCodePoint 支援 Emoji 如 🏠 🔥 🚇 📍 與擴展字)
      .replace(/&#x([0-9a-fA-F]+);?/gi, (_, hex) => {
        try {
          const cp = parseInt(hex, 16);
          return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : _;
        } catch {
          return _;
        }
      })
      // 3. 解碼 10 進位實體 (使用 fromCodePoint)
      .replace(/&#(\d+);?/g, (_, dec) => {
        try {
          const cp = parseInt(dec, 10);
          return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : _;
        } catch {
          return _;
        }
      })
      .replace(/&amp;/gi, '&');

  // 雙輪解碼：徹底消除 Instagram / Threads 中常見的 &amp;#x...; 雙重編碼
  return decodePass(decodePass(input)).trim();
}

// 5. 強化版 Meta 標籤抽取器 (支援單引號、雙引號、跨行屬性)
export function extractMeta(html: string, nameOrProperty: string): string | null {
  const escaped = nameOrProperty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content="([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content='([^']*)'`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)=["']${escaped}["']`, 'i'),
    new RegExp(`<meta[^>]+content='([^']*)'[^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ];

  for (const regex of patterns) {
    const match = html.match(regex);
    if (match && match[1]) {
      const decoded = decodeHtmlEntities(match[1]);
      if (decoded) return decoded;
    }
  }

  return null;
}

// 6. 抽取 <title> 標籤
export function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match && match[1] ? decodeHtmlEntities(match[1].trim()) : null;
}

// 7. Schema.org JSON-LD 結構化資料抽取 (愛料理 iCook、Cookpad、餐廳食記部落格專用)
export function extractJsonLd(html: string): string | null {
  try {
    const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    if (!matches || matches.length === 0) return null;

    const extractedSnippets: string[] = [];

    for (const m of matches) {
      const rawJson = m[1].trim();
      if (!rawJson) continue;

      let parsed: any;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        continue;
      }

      const items = Array.isArray(parsed)
        ? parsed
        : parsed['@graph'] && Array.isArray(parsed['@graph'])
        ? parsed['@graph']
        : [parsed];

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const typeStr = String(item['@type'] || '');

        // 食譜結構化標記 (Recipe)
        if (typeStr.includes('Recipe')) {
          const lines: string[] = [`【Schema.org 食譜資料】`];
          if (item.name) lines.push(`食譜名稱: ${item.name}`);
          if (item.description) lines.push(`簡述: ${item.description}`);
          if (item.recipeYield) lines.push(`份量: ${item.recipeYield}`);
          if (item.prepTime || item.totalTime) lines.push(`製作時間: ${item.totalTime || item.prepTime}`);

          if (Array.isArray(item.recipeIngredient) && item.recipeIngredient.length > 0) {
            lines.push(`食材清單:\n${item.recipeIngredient.map((ing: any) => `- ${ing}`).join('\n')}`);
          }

          if (item.recipeInstructions) {
            const steps = Array.isArray(item.recipeInstructions)
              ? item.recipeInstructions.map((s: any) => (typeof s === 'string' ? s : s.text || s.name || '')).filter(Boolean)
              : [String(item.recipeInstructions)];
            if (steps.length > 0) {
              lines.push(`料理步驟:\n${steps.map((st: string, idx: number) => `${idx + 1}. ${st}`).join('\n')}`);
            }
          }

          extractedSnippets.push(lines.join('\n'));
        }

        // 餐廳 / 地點結構化標記 (Restaurant / LocalBusiness / FoodEstablishment)
        if (
          typeStr.includes('Restaurant') ||
          typeStr.includes('LocalBusiness') ||
          typeStr.includes('FoodEstablishment') ||
          typeStr.includes('CafeOrCoffeeShop')
        ) {
          const lines: string[] = [`【Schema.org 餐廳與店家資料】`];
          if (item.name) lines.push(`店名: ${item.name}`);
          if (item.description) lines.push(`介紹: ${item.description}`);

          if (item.address) {
            const addr =
              typeof item.address === 'string'
                ? item.address
                : [item.address.addressCountry, item.address.addressRegion, item.address.addressLocality, item.address.streetAddress]
                    .filter(Boolean)
                    .join('');
            if (addr) lines.push(`地址: ${addr}`);
          }

          if (item.telephone) lines.push(`電話: ${item.telephone}`);
          if (item.geo && item.geo.latitude && item.geo.longitude) {
            lines.push(`經緯度: ${item.geo.latitude}, ${item.geo.longitude}`);
          }

          extractedSnippets.push(lines.join('\n'));
        }
      }
    }

    return extractedSnippets.length > 0 ? extractedSnippets.join('\n\n') : null;
  } catch (err) {
    console.warn('[Scraper Debug] JSON-LD parse warning:', err);
    return null;
  }
}

// 8. 強化版四層級爬蟲管線 (Bulletproof 4-Tier Scraping Pipeline)
export async function scrapeUrlContent(
  cleanUrl: string,
  shortcode: string | null,
  extraContent?: string
): Promise<{ text: string; sources: string[]; thumbnailUrl?: string; effectiveTextLength: number }> {
  const textParts: string[] = [];
  const sources: string[] = [];
  let thumbnailUrl: string | null = null;

  const parsedUrl = new URL(cleanUrl);
  const hostname = parsedUrl.hostname.toLowerCase();
  const isInstagram = hostname.includes('instagram.com');
  const isThreads = hostname.includes('threads.net');
  const isTikTok = hostname.includes('tiktok.com');
  const isYouTube = hostname.includes('youtube.com') || hostname.includes('youtu.be');

  // ==========================================
  // Tier 1: 雙重 UA Meta 爬取 + YouTube shortDescription + IG Embed (含留言區)
  // ==========================================
  let tier1TextLength = 0;
  let hasRecipeJsonLd = false;

  // 1.1 主頁面爬取：YouTube 使用桌面瀏覽器 UA 以確保取得 ytInitialPlayerResponse；其他使用 facebookexternalhit
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    const primaryUa = isYouTube
      ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      : 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

    const res = await fetch(cleanUrl, {
      method: 'GET',
      headers: {
        'User-Agent': primaryUa,
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const html = await res.text();
      const metaTitle = extractTitle(html);
      const ogTitle = extractMeta(html, 'og:title');
      const twitterTitle = extractMeta(html, 'twitter:title');
      const ogDesc = extractMeta(html, 'og:description');
      const metaDesc = extractMeta(html, 'description');
      const ogSiteName = extractMeta(html, 'og:site_name');
      const rawOgImage = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');

      if (rawOgImage) {
        // 還原 URL 中的 &amp; 避免 CDN 驗證失效
        thumbnailUrl = rawOgImage.replace(/&amp;/g, '&');
      }

      // 提取 JSON-LD 結構化資料 (針對食譜網站 @type: "Recipe" 的 recipeIngredient 與 recipeInstructions)
      const jsonLdData = extractJsonLd(html);
      if (jsonLdData && jsonLdData.includes('【Schema.org 食譜資料】')) {
        hasRecipeJsonLd = true;
      }

      const snippets: string[] = [];
      const bestTitle = ogTitle || twitterTitle || metaTitle;
      if (bestTitle && bestTitle !== 'Instagram' && bestTitle !== 'Threads') {
        snippets.push(`社群標題: ${bestTitle}`);
      }

      // 清理 IG description 常見前綴
      if (ogDesc) {
        const cleanDesc = ogDesc
          .replace(/^[0-9,KMkm\s]+likes?,\s+[0-9,KMkm\s]+comments?\s+-\s+[^:]+:\s*["“]?/i, '')
          .replace(/["”]?\s*\.?\s*$/, '')
          .trim();
        snippets.push(`社群文案/內文: ${cleanDesc || ogDesc}`);
      } else if (metaDesc) {
        snippets.push(`網站摘要: ${metaDesc}`);
      }

      if (ogSiteName) snippets.push(`來源平台: ${ogSiteName}`);
      if (jsonLdData) snippets.push(jsonLdData);

      // 1.1b YouTube 專屬深度解析：從 ytInitialPlayerResponse 提取完整 "shortDescription" 資訊欄全文
      if (isYouTube) {
        const shortDescMatch = html.match(/"shortDescription"\s*:\s*"((?:\\.|[^"\\])*)"/);
        if (shortDescMatch && shortDescMatch[1]) {
          try {
            const fullYtDescription = JSON.parse(`"${shortDescMatch[1]}"`);
            if (fullYtDescription && fullYtDescription.trim().length > 0) {
              snippets.push(`=== YouTube 完整資訊欄全文 (shortDescription) ===\n${fullYtDescription.trim()}`);
              sources.push('YouTubePlayerResponse');
            }
          } catch {
            const unescaped = shortDescMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
            snippets.push(`=== YouTube 完整資訊欄全文 (shortDescription) ===\n${unescaped}`);
            sources.push('YouTubePlayerResponse');
          }
        }
      }

      if (snippets.length > 0) {
        const snippetText = snippets.join('\n');
        textParts.push(`=== 社群預覽中繼資料 (Tier 1: SocialMeta) ===\n${snippetText}`);
        sources.push('SocialMeta');
        tier1TextLength += snippetText.length;
      }
    }
  } catch (err) {
    console.warn('[Scraper Debug] Tier 1 primary UA failed or timed out:', err);
  }



  // 1.3 若 Tier 1 抓到的有效字數極短 (< 40 字)，使用 TelegramBot UA 作為第二重備援重試
  if (tier1TextLength < 40 && (isInstagram || isThreads)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res2 = await fetch(cleanUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'TelegramBot (like TwitterBot)',
          'Accept-Language': 'zh-TW,zh;q=0.9',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res2.ok) {
        const html2 = await res2.text();
        const ogTitle2 = extractMeta(html2, 'og:title');
        const ogDesc2 = extractMeta(html2, 'og:description');
        const ogImg2 = extractMeta(html2, 'og:image');

        if (ogImg2 && !thumbnailUrl) {
          thumbnailUrl = ogImg2.replace(/&amp;/g, '&');
        }

        if (ogDesc2 || ogTitle2) {
          const fallbackText = `標題: ${ogTitle2 || ''}\n內容: ${ogDesc2 || ''}`.trim();
          textParts.push(`=== 社群備援中繼資料 (Tier 1: TelegramBot) ===\n${fallbackText}`);
          sources.push('SocialMetaBackup');
          tier1TextLength += fallbackText.length;
        }
      }
    } catch (err2) {
      console.warn('[Scraper Debug] Tier 1 TelegramBot backup failed:', err2);
    }
  }

  // ==========================================
  // Tier 2: YouTube / TikTok / 影音 oEmbed 通道
  // ==========================================
  if (isYouTube || isTikTok || tier1TextLength < 60) {
    // 2.1 嘗試 noembed.com
    try {
      const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const noembedRes = await fetch(noembedUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (noembedRes.ok) {
        const data = await noembedRes.json();
        if (data && !data.error) {
          const oembedSnippets: string[] = [];
          if (data.title) oembedSnippets.push(`影音標題: ${decodeHtmlEntities(data.title)}`);
          if (data.author_name) oembedSnippets.push(`作者/創作者: ${decodeHtmlEntities(data.author_name)}`);
          if (data.provider_name) oembedSnippets.push(`平台來源: ${data.provider_name}`);

          if (data.thumbnail_url && !thumbnailUrl) {
            thumbnailUrl = data.thumbnail_url.replace(/&amp;/g, '&');
          }

          if (oembedSnippets.length > 0) {
            textParts.push(`=== oEmbed 媒體資訊 (Tier 2: Noembed) ===\n${oembedSnippets.join('\n')}`);
            sources.push('Noembed');
          }
        }
      }
    } catch (noembedErr) {
      console.warn('[Scraper Debug] Tier 2 Noembed failed:', noembedErr);
    }

    // 2.2 若為 TikTok，額外呼叫 TikTok 官方免費 oembed 端點
    if (isTikTok) {
      try {
        const tiktokOembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const ttRes = await fetch(tiktokOembedUrl, { signal: controller.signal });
        clearTimeout(timeout);

        if (ttRes.ok) {
          const ttData = await ttRes.json();
          if (ttData && ttData.title) {
            textParts.push(`=== TikTok 官方資訊 (Tier 2: TikTok oEmbed) ===\n標題文案: ${decodeHtmlEntities(ttData.title)}\n作者: ${ttData.author_name || ''}`);
            sources.push('TikTokOEmbed');
            if (ttData.thumbnail_url && !thumbnailUrl) {
              thumbnailUrl = ttData.thumbnail_url;
            }
          }
        }
      } catch (ttErr) {
        console.warn('[Scraper Debug] Tier 2 TikTok oembed failed:', ttErr);
      }
    }
  }

  // ==========================================
  // Tier 3: Jina Reader Markdown 通道 (針對無 JSON-LD 之食譜網站與 YouTube 備援)
  // ==========================================
  // 若食譜網站已成功解析出完整 JSON-LD Recipe，則免除 Jina 請求；否則用 r.jina.ai 抓 Markdown 全文作為備援
  const shouldTryJina =
    !isInstagram &&
    !hasRecipeJsonLd &&
    (isYouTube ? tier1TextLength < 200 : !isThreads || tier1TextLength < 80);

  if (shouldTryJina) {
    try {
      const jinaUrl = `https://r.jina.ai/${cleanUrl}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

      const jinaRes = await fetch(jinaUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/plain',
          'X-Return-Format': 'markdown',
          'User-Agent': 'Memo-Web-Scraper/2.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (jinaRes.ok) {
        const markdown = await jinaRes.text();
        if (markdown && markdown.trim().length > 40) {
          textParts.push(`=== 網頁 Markdown 內文 (Tier 3: Jina Reader) ===\n${markdown.slice(0, 15000)}`);
          sources.push('JinaReader');

          // 若尚未取得封面圖，嘗試從 Jina Markdown 內文抓取第一張圖片
          if (!thumbnailUrl) {
            const imgMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/);
            if (imgMatch && imgMatch[1]) {
              thumbnailUrl = imgMatch[1].replace(/&amp;/g, '&');
            }
          }
        }
      }
    } catch (jinaErr) {
      console.warn('[Scraper Debug] Tier 3 Jina Reader error caught and ignored:', jinaErr);
    }
  }

  // ==========================================
  // 使用者自訂補充文案 (若有提供)
  // ==========================================
  if (extraContent && extraContent.trim()) {
    textParts.push(`=== 使用者附帶/補充的貼文文字與備註 ===\n${extraContent.trim()}`);
    sources.push('UserSupplement');
  }

  // 計算有效文字總字數
  const combinedText = textParts.join('\n\n');
  const effectiveLength = combinedText.replace(/\s+/g, '').length;

  // ==========================================
  // Tier 4: 極端兜底 — 若所有擷取幾乎為空，輸出 URL 結構特徵
  // ==========================================
  if (effectiveLength < 30) {
    textParts.push(
      `【目標網址基本資訊】\n網址: ${cleanUrl}\n網域: ${parsedUrl.hostname}\n路徑: ${parsedUrl.pathname}\n提示: 該目標網站目前限制公開抓取或需登入。請依據網址特徵、路徑、短碼與使用者意圖推論分類，並整理出基本靈感卡片。`
    );
    sources.push('UrlDeduction');
  }

  return {
    text: textParts.join('\n\n'),
    sources,
    thumbnailUrl: thumbnailUrl || undefined,
    effectiveTextLength: effectiveLength,
  };
}

// 9. 地理座標使用 @/lib/geoUtils (已匯入)

// 10. OpenStreetMap Nominatim 地理編碼與精準地標座標字典
const KNOWN_EXACT_PLACES: Array<{ match: RegExp; coords: { lat: number; lng: number } }> = [
  { match: /atipic|亞提/i, coords: { lat: 24.148537, lng: 120.662589 } },
  { match: /莫內饗宴|煙波.*嘉義/i, coords: { lat: 23.498421, lng: 120.451983 } },
  { match: /sleepbox|睡覺盒子/i, coords: { lat: 25.042780, lng: 121.512630 } },
  { match: /fomo/i, coords: { lat: 23.711823, lng: 120.543452 } },
];

export async function geocodePlace(placeInfo: {
  locationName?: string;
  address?: string;
  city?: string;
  googleMapsQuery?: string;
}): Promise<{ lat: number; lng: number }> {
  const combined = `${placeInfo.locationName || ''} ${placeInfo.address || ''} ${placeInfo.googleMapsQuery || ''}`.trim();
  for (const kp of KNOWN_EXACT_PLACES) {
    if (kp.match.test(combined)) {
      return kp.coords;
    }
  }

  const queries = [
    placeInfo.googleMapsQuery,
    [placeInfo.locationName, placeInfo.city].filter(Boolean).join(' '),
    placeInfo.address,
    placeInfo.city,
  ].filter((q): q is string => Boolean(q && q.trim()));

  const seen = new Set<string>();
  for (const q of queries) {
    const trimmed = q.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1`;

      const geoRes = await fetch(geoUrl, {
        headers: {
          'User-Agent': 'AlboCloneApp/1.0 (dev@albo.local)',
          'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (Array.isArray(geoData) && geoData.length > 0) {
          const lat = parseFloat(geoData[0].lat);
          const lng = parseFloat(geoData[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            return { lat, lng };
          }
        }
      }
    } catch (err: unknown) {
      console.warn('[Scraper Debug] Geocoding query error for:', trimmed, err);
    }
  }

  // 若查無結果，回退至對應城市中心並加微小隨機偏移量
  return getFallbackCoordinates(
    placeInfo.city || placeInfo.address || placeInfo.locationName,
    placeInfo.locationName || placeInfo.city || 'place'
  );
}

// 11. 下載圖片並轉換為 Base64 (供 Gemini 多模態視覺分析)
export async function fetchImageAsBase64(
  imageUrl: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const cleanImageUrl = imageUrl.replace(/&amp;/g, '&');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };

    if (cleanImageUrl.includes('cdninstagram.com') || cleanImageUrl.includes('fbcdn.net')) {
      headers['Referer'] = 'https://www.instagram.com/';
    }

    const res = await fetch(cleanImageUrl, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const cleanMime = contentType.split(';')[0].trim().toLowerCase();
    const arrayBuffer = await res.arrayBuffer();

    if (arrayBuffer.byteLength < 100 || arrayBuffer.byteLength > 4 * 1024 * 1024) return null;

    const base64Str = Buffer.from(arrayBuffer).toString('base64');
    return {
      data: base64Str,
      mimeType: cleanMime.startsWith('image/') ? cleanMime : 'image/jpeg',
    };
  } catch (err) {
    console.warn('[Scraper Debug] Failed to fetch image for Gemini vision:', err);
    return null;
  }
}

// 12. 官方電影海報自動補全 (Auto Poster Fetcher)
export async function fetchOfficialMoviePoster(
  movieTitle: string,
  originalTitle?: string,
  releaseYear?: string
): Promise<string | null> {
  const query = movieTitle.trim();
  const enQuery = (originalTitle || '').trim();
  const yearQuery = (releaseYear || '').trim();

  // Tier 1: IMDb Official Suggestion API (One-Sheet UX1000)
  const imdbQueries: string[] = [];
  if (enQuery && yearQuery) imdbQueries.push(`${enQuery} ${yearQuery}`);
  if (enQuery) imdbQueries.push(enQuery);
  if (query && query !== enQuery) imdbQueries.push(query);

  for (const q of imdbQueries) {
    try {
      const imdbUrl = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(q)}.json`;
      const res = await fetch(imdbUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data?.d) ? data.d : [];
        const matched =
          items.find(
            (i: any) =>
              i.i?.imageUrl &&
              (i.qid === 'movie' || i.qid === 'tvSeries' || i.q === 'feature')
          ) || items.find((i: any) => i.i?.imageUrl);

        if (matched && matched.i?.imageUrl) {
          const hdPoster = matched.i.imageUrl.replace(/\._V1_.*\.jpg$/i, '._V1_FMjpg_UX1000_.jpg');
          console.log(`[Scraper Debug] 🎬 Found official IMDb One-Sheet poster (${q}): ${hdPoster}`);
          return hdPoster;
        }
      }
    } catch {
      // continue fallback
    }
  }

  // Tier 2: Wikipedia REST API (zh & en)
  const candidateTitles = [
    query ? `${query} (電影)` : null,
    query,
    enQuery ? `${enQuery} (film)` : null,
    enQuery,
  ].filter(Boolean) as string[];

  for (const title of candidateTitles) {
    try {
      const isEnglish = /^[A-Za-z0-9\s:.-]+$/.test(title);
      const host = isEnglish ? 'en.wikipedia.org' : 'zh.wikipedia.org';
      const cleanTitle = encodeURIComponent(title.replace(/\s+/g, '_'));
      const url = `https://${host}/api/rest_v1/page/summary/${cleanTitle}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'AlboMovieBot/1.0 (dev@albo.local)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (res.ok) {
        const data = await res.json();
        const poster = data.originalimage?.source || data.thumbnail?.source;
        if (poster && typeof poster === 'string') {
          console.log(`[Scraper Debug] 🎬 Found official movie poster from Wikipedia (${title}): ${poster}`);
          return poster;
        }
      }
    } catch {
      // continue fallback
    }
  }

  // Tier 2: iTunes Search API
  const searchTerms = [query, enQuery].filter(Boolean) as string[];
  for (const term of searchTerms) {
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
        term
      )}&entity=movie&limit=1`;
      const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
          const hdPoster = data.results[0].artworkUrl100.replace(
            '100x100bb.jpg',
            '1000x1500bb.jpg'
          );
          console.log(`[Scraper Debug] 🎬 Found official movie poster from iTunes (${term}): ${hdPoster}`);
          return hdPoster;
        }
      }
    } catch {
      // continue fallback
    }
  }

  return null;
}

// 12b. 官方好物/3C電子產品首圖自動搜尋 (Auto Product Image Fetcher)
export async function fetchOfficialProductImage(
  brandOrModel: string
): Promise<string | null> {
  const query = brandOrModel.trim();
  if (!query || query.length < 2) return null;

  // Tier 1: Wikipedia REST API (zh & en)
  const candidateTitles = [
    query,
    query.replace(/\s+/g, '_'),
  ];

  for (const title of candidateTitles) {
    for (const host of ['zh.wikipedia.org', 'en.wikipedia.org']) {
      try {
        const cleanTitle = encodeURIComponent(title.replace(/\s+/g, '_'));
        const url = `https://${host}/api/rest_v1/page/summary/${cleanTitle}`;

        const res = await fetch(url, {
          headers: {
            'User-Agent': 'AlboProductBot/1.0 (dev@albo.local)',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(3000),
        });

        if (res.ok) {
          const data = await res.json();
          const imgUrl = data?.originalimage?.source || data?.thumbnail?.source;
          if (imgUrl && typeof imgUrl === 'string') {
            const lowerImg = imgUrl.toLowerCase();
            if (
              lowerImg.includes('logo') ||
              lowerImg.includes('icon') ||
              lowerImg.includes('wallet') ||
              lowerImg.includes('badge') ||
              lowerImg.includes('symbol') ||
              lowerImg.endsWith('.svg')
            ) {
              continue;
            }
            console.log(`[Scraper Debug] 🛍️ Found official product image from Wikipedia (${title}): ${imgUrl}`);
            return imgUrl;
          }
        }
      } catch {
        // continue
      }
    }
  }

  // Tier 2: DuckDuckGo Instant Answer API
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
    const res = await fetch(ddgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.Image && typeof data.Image === 'string' && data.Image.trim().length > 0) {
        const fullImg = data.Image.startsWith('http')
          ? data.Image
          : `https://duckduckgo.com${data.Image}`;
        console.log(`[Scraper Debug] 🛍️ Found official product image from DuckDuckGo (${query}): ${fullImg}`);
        return fullImg;
      }
    }
  } catch {
    // continue
  }

  // Tier 3: iTunes Search (Apple/podcast/software/gadgets)
  try {
    // 僅在明確為軟體/App 或非硬體時才嘗試 iTunes，且嚴格過濾錢包與圖示
    if (!/ipad|mac|iphone|筆電|電腦|平板|相機|耳機|晶片/i.test(query)) {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=software&limit=1`;
      const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        if (data.results?.[0]?.artworkUrl512 || data.results?.[0]?.artworkUrl100) {
          const img = data.results[0].artworkUrl512 || data.results[0].artworkUrl100;
          if (img && typeof img === 'string' && !isInvalidThumbnail(img)) {
            console.log(`[Scraper Debug] 🛍️ Found product artwork from iTunes: ${img}`);
            return img;
          }
        }
      }
    }
  } catch {
    // continue
  }

  return null;
}

// 13. 完整的網址結構化萃取主邏輯
export async function parseUrlItem(
  rawInput: string,
  extraContent?: string
): Promise<{ item: ParsedItem; sources: string[] }> {
  // 1. 分離網址與附帶文字
  const { url: rawUrl, extraText } = splitUrlAndText(rawInput);
  const combinedExtra = [extraText, extraContent].filter(Boolean).join('\n\n').trim();

  // 2. 還原短網址跳轉
  const resolvedUrl = await resolveShareRedirects(rawUrl);

  // 3. 網址清理與 shortcode 提取
  const { cleanUrl, shortcode } = sanitizeUrl(resolvedUrl);

  console.log(`[Scraper Debug] 🚀 Start parsing URL: ${rawInput.slice(0, 80)} -> Clean: ${cleanUrl} (shortcode: ${shortcode || 'none'})`);

  // 4. 多層次網頁擷取 (4-Tier Scraping)
  const {
    text: extractedContent,
    sources,
    thumbnailUrl,
    effectiveTextLength,
  } = await scrapeUrlContent(cleanUrl, shortcode, combinedExtra);

  const trimmedContent = extractedContent.slice(0, MAX_CONTENT_LENGTH);

  console.log(`[Scraper Debug] 📦 Extracted content: ${trimmedContent.length} chars (effective: ${effectiveTextLength}) | Sources: ${sources.join(', ')} | Thumbnail: ${Boolean(thumbnailUrl)}`);

  // 5. 嘗試獲取封面美圖並轉換為 Base64（供 Gemini 進行多模態視覺看圖識字）
  let imagePart: { inlineData: { data: string; mimeType: string } } | null = null;
  if (thumbnailUrl) {
    const imgData = await fetchImageAsBase64(thumbnailUrl);
    if (imgData) {
      imagePart = {
        inlineData: {
          data: imgData.data,
          mimeType: imgData.mimeType,
        },
      };
      sources.push('MultimodalVision');
      console.log(`[Scraper Debug] 🖼️ Multimodal image loaded: ${Math.round(imgData.data.length / 1024)} KB (${imgData.mimeType})`);
    }
  }

  // 6. 初始化 Gemini API
  const apiKey = (await getEffectiveGeminiKey()) || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('伺服器尚未設定 GEMINI_API_KEY，請於網頁設定中輸入金鑰。');
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        enum: ['place', 'recipe', 'media', 'general', 'account', 'product'],
        description:
          '分類類別（必須依「內容主題」而非平台載體分類）：place(介紹餐廳/咖啡廳/甜點/景點/飯店/店家的貼文與Reels短影音)、recipe(教學料理/家常食譜/烘焙/調酒飲品的貼文與Reels短影音)、media(純電影/書籍/影集/音樂專輯/純搞笑娛樂短影音)、account(推薦創作者/IG個人主頁/YouTube頻道/Threads帳號)、product(生活精選好物/3C科技商品/裝備開箱)、general(知識隨筆/其他)',
      },
      title: {
        type: Type.STRING,
        description: '精確的繁體中文標題、店名或菜名。嚴禁輸出「無標題」、「某餐廳」等空泛字眼',
      },
      summary: {
        type: Type.STRING,
        description: '50字以內的重點繁體中文摘要',
      },
      tags: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
        description: '3~5 個關鍵字標籤，請勿包含「#」符號',
      },
      placeInfo: {
        type: Type.OBJECT,
        nullable: true,
        description: '當 category 為 place 時必須填寫完整，否則設為 null',
        properties: {
          locationName: { type: Type.STRING, description: '店家、景點或地標名稱' },
          address: { type: Type.STRING, description: '詳細地址（若文中有提及或由知識庫補齊）' },
          city: { type: Type.STRING, description: '所在大範圍縣市（例如：臺北、新北、嘉義、屏東、臺中、臺南、高雄、東京，台灣縣市統一用正體「臺」）' },
          district: { type: Type.STRING, description: '所在具體鄉鎮市區或知名商圈（例如：民雄、恆春、萬里、大安區、信義區）' },
          googleMapsQuery: {
            type: Type.STRING,
            description: '用於 Google Maps 搜尋的最佳關鍵字組合，例如「店名 城市」',
          },
          rating: {
            type: Type.STRING,
            description: 'Google Maps 評分與評論數，例如「4.8 ★ (120 則評論)」',
          },
          mustTryDishes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '網友推薦必吃/必點菜色或招牌亮點（2~4 項）',
          },
          reviewsSummary: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '熱門 Google 評論重點與食客真實心得精華（2~3 則）',
          },
          smartTags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              '1~2 個該店家最精確且傳神的「專屬店鋪型態標籤（必須包含合適的 Emoji）」，嚴禁從死板列表硬選，請依店家真實營業項目精確給出（例如：「🥖 潛艇堡/三明治」、「🥟 中式早點」、「🧸 玩具/模型店」、「☕ 獨立咖啡館」、「🥐 法式可麗餅」、「🍜 鱔魚意麵」、「⛺ 露營車體驗」、「📷 復古相機店」等）',
          },
        },
      },
      recipeInfo: {
        type: Type.OBJECT,
        nullable: true,
        description: '當 category 為 recipe 時必須填寫完整，否則設為 null',
        properties: {
          baseServings: {
            type: Type.NUMBER,
            description: '基準幾人份（純數字，預設為 2）',
          },
          servings: { type: Type.STRING, description: '料理份量文字，例如「2 人份」' },
          prepTime: { type: Type.STRING, description: '預計製作時間，例如「20 分鐘」' },
          ingredients: {
            type: Type.ARRAY,
            description: '結構化食材與數值份量清單（方便依人數動態乘除換算）',
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: '食材名稱（例如：牛五花肉片、雞蛋、無鹽奶油）' },
                amount: {
                  type: Type.NUMBER,
                  description: '純數值份量（例如 250、2、15；請將適量換算為合理具體克數或毫升數）',
                },
                unit: {
                  type: Type.STRING,
                  description: '計量單位（例如：g、ml、顆、瓣、大匙、小匙、塊）',
                },
                category: {
                  type: Type.STRING,
                  description: '食材分類（生鮮肉品 / 海鮮水產 / 蔬菜水果 / 蛋奶豆製品 / 主食五穀 / 乾貨調味）',
                },
              },
              required: ['name', 'amount', 'unit', 'category'],
            },
          },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '條列式料理步驟（3~6步）',
          },
          recipeTags: {
            type: Type.OBJECT,
            description: '食譜多維智慧標籤（料理風格、主要肉品/食材、餐點類型）',
            properties: {
              cuisine: {
                type: Type.STRING,
                description: '料理風格（例如：日式、美式、義式、台式、韓式、法式、東南亞）',
              },
              ingredientsType: {
                type: Type.STRING,
                description: '主要肉品/食材（例如：牛肉、豬肉、雞肉、海鮮、蔬食、蛋料理）',
              },
              mealType: {
                type: Type.STRING,
                description: '餐點類型（例如：主食、湯品、甜點、飲料、小吃/點心、常備菜）',
              },
            },
            required: ['cuisine', 'ingredientsType', 'mealType'],
          },
          nutrition: {
            type: Type.OBJECT,
            description: '估算此料理「單人份 (1人份)」的四大營養素數值',
            properties: {
              calories: { type: Type.STRING, description: '單人份熱量，例如「480 kcal」' },
              protein: { type: Type.STRING, description: '單人份蛋白質，例如「28 g」' },
              carbs: { type: Type.STRING, description: '單人份碳水化合物，例如「42 g」' },
              fat: { type: Type.STRING, description: '單人份脂肪，例如「18 g」' },
            },
            required: ['calories', 'protein', 'carbs', 'fat'],
          },
        },
        required: ['baseServings', 'servings', 'prepTime', 'ingredients', 'steps', 'recipeTags', 'nutrition'],
      },
      mediaInfo: {
        type: Type.OBJECT,
        nullable: true,
        description: '當 category 為 media 時填寫，否則設為 null',
        properties: {
          creator: { type: Type.STRING, description: '創作者、作者、導演、歌手或帳號名稱' },
          releaseYear: { type: Type.STRING, description: '年份或發布時間' },
          genre: { type: Type.STRING, description: '類型或流派（如：電影/書籍/Podcast）' },
          movieTitle: {
            type: Type.STRING,
            description:
              '若此內容在介紹或評論某部電影、影集或紀錄片，請填寫精確的台灣繁體中文官方片名（例如：小丑：雙重瘋狂、陽光普照、周處除三害）',
          },
          originalTitle: {
            type: Type.STRING,
            description:
              '電影或影集之原文或英文片名（例如：Joker: Folie à Deux、Dune: Part Two）',
          },
          director: { type: Type.STRING, description: '電影或影集導演姓名' },
          rating: {
            type: Type.STRING,
            description: '影評觀後感總結或評分（例如：8.5/10 視覺震撼、極力推薦）',
          },
          posterUrl: {
            type: Type.STRING,
            description: '官方海報圖片網址（若有已知網址）',
          },
        },
      },
      productInfo: {
        type: Type.OBJECT,
        nullable: true,
        description:
          '當內容涉及 3C 科技、生活家電、硬體設備、生活好物或裝備推薦時必須完整填寫，否則設為 null',
        properties: {
          brand: {
            type: Type.STRING,
            description:
              '品牌與精確型號名稱（例如：Sony WH-1000XM5、Apple Watch Ultra 2、Keychron K2 Pro、Dyson Supersonic Nural）',
          },
          priceRange: {
            type: Type.STRING,
            description: '參考售價區間（例如：NT$ 9,900 ~ 11,500 或 $399 美元）',
          },
          specs: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3~5 項核心關鍵規格亮點（條列式，例如：「主動降噪 ＋ LDAC」、「續航達 30 小時」）',
          },
          pros: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2~3 項推薦入手原因與核心優勢',
          },
          cons: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '1~2 項注意事項、短板或缺點提醒',
          },
        },
      },
      subPlaces: {
        type: Type.ARRAY,
        nullable: true,
        description:
          '若該影片或貼文是「多家餐廳/咖啡廳/景點合集（如：嘉義 5 家必吃、台北跑咖清單、多地點懶人包）」，請將影片中提到的每一家店名、城市、地址與推薦亮點完整拆解列出',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: '店家或景點純淨名稱（如：阿宏師火雞肉飯）' },
            shopName: { type: Type.STRING, description: '店家或景點純淨店名（直接作為獨立卡片標題）' },
            city: { type: Type.STRING, description: '所在大範圍縣市（如：嘉義、臺北、新北、屏東）' },
            district: { type: Type.STRING, description: '所在具體鄉鎮市區或商圈（如：民雄、恆春、萬里、大安區）' },
            address: { type: Type.STRING, description: '店家詳細地址或商圈位置（由知識庫補齊真實地址）' },
            summary: { type: Type.STRING, description: '專門針對這間店的特色、必點菜色或注意事項摘要' },
            highlight: { type: Type.STRING, description: '必點招牌菜色或推薦亮點' },
            googleMapsQuery: { type: Type.STRING, description: 'Google Maps 搜尋關鍵字（店名 + 城市/地址）' },
            smartTags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '1~2 個該店家專屬店鋪型態標籤（含 Emoji）',
            },
          },
          required: ['name'],
        },
      },
      places: {
        type: Type.ARRAY,
        nullable: true,
        description:
          '同 subPlaces，若該貼文一次介紹了多間店家，請將每間店純淨店名與資訊填入此陣列',
        items: {
          type: Type.OBJECT,
          properties: {
            shopName: { type: Type.STRING, description: '店家純淨店名' },
            name: { type: Type.STRING, description: '店家純淨店名' },
            city: { type: Type.STRING, description: '所在大範圍縣市（如：嘉義、臺北、新北、屏東）' },
            district: { type: Type.STRING, description: '所在具體鄉鎮市區（如：民雄、恆春、萬里、大安區）' },
            address: { type: Type.STRING, description: '店家詳細地址' },
            summary: { type: Type.STRING, description: '專門針對這間店的特色與必點摘要' },
            googleMapsQuery: { type: Type.STRING, description: 'Google Maps 搜尋關鍵字' },
          },
          required: ['shopName'],
        },
      },
      subProducts: {
        type: Type.ARRAY,
        nullable: true,
        description:
          '若該影片或貼文是「多樣好物/商品合集推薦（如：年度 5 大好物、桌面裝備清單）」，請將影片中提到的每一樣商品名稱、品牌、價格與亮點完整拆解列出',
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: '商品名稱與型號' },
            brand: { type: Type.STRING, description: '品牌名稱' },
            price: { type: Type.STRING, description: '參考價格' },
            highlight: { type: Type.STRING, description: '推薦亮點與特色' },
          },
          required: ['name'],
        },
      },
    },
    required: ['category', 'title', 'summary', 'tags'],
  };

  const systemInstruction = `你是一個極致專業的「現代生活靈感萃取引擎」。
請針對使用者提供的網頁資料（包含社群 Meta 標籤、YouTube 完整資訊欄 shortDescription、IG 內嵌頁主文案與留言區、JSON-LD Recipe、Markdown 內文或使用者補充文字），一律使用「繁體中文 (台灣)」進行結構化資訊萃取。

【核心分類準則 (非常重要，切勿混淆)】
請務必根據「內容實質主題」而非「平台載體」進行分類：
1. place（探店私藏）：介紹餐廳、咖啡廳、早午餐、小吃甜點、居酒屋、酒吧、旅遊景點、飯店民宿、展覽空間。
   ⚠️ 即使內容來自 Instagram Reel、TikTok 或 YouTube Shorts，只要它是在介紹實體店家或景點，就必須歸類為 place！絕不可歸為 media！
2. recipe（家常旬味）：烹飪食譜、家常菜做菜步驟、烘焙甜點配方、減脂備餐、調酒飲料調製。
   ⚠️ 即使內容來自 IG Reel、YouTube 或 TikTok 短影音，只要它是在教做料理，就必須歸類為 recipe！
3. media（藝文影音）：僅限介紹電影、書籍、音樂專輯、影集動漫、Podcast 或純搞笑生活短劇。
4. general（隨想靈感）：生活風格好物、3C科技、收納整理、理財新知、工具推薦。

【嚴禁空泛廢話 (Anti-Placeholder Rules)】
1. 嚴禁在 title、locationName 中輸出「未知地點」、「某餐廳」、「Instagram貼文」、「無標題」等字眼。
2. 仔細從文案中的 📍、🏠、店名標註、Hashtag（如 #威爾貝克咖啡）或帳號名稱提取具體名稱。
3. 若為 place 但文中未提門牌地址，請由你豐富的知識庫補齊該知名店家的台灣/日本真實地址或商圈位置，並合成最精準的 googleMapsQuery（格式："{店名} {城市}"）。
4. 若為 recipe，請優先從 YouTube 資訊欄 (shortDescription)、JSON-LD Recipe、IG 主文案或留言區 (.CaptionComment / edge_media_to_comment) 提取真實完整的食材清單與步驟；若步驟或克數較少，請結合封面圖片視覺與料理知識補齊標準的食材克數與 3~6 步完整烹調工法。

【食譜食材與多維智慧標籤解析準則】
1. 請將料理食材拆解為精確的數值份量（amount 為純數字）、單位（unit 如 g, ml, 顆, 瓣）與分類（生鮮肉品 / 蔬菜水果 / 蛋奶豆製品 / 調味料與乾貨 / 其他），嚴禁將整串字塞在品名裡。
2. 務必同時分析並在 recipeInfo.recipeTags 產出精準結構化多維智慧標籤：
   - cuisine（料理風格）：如「日式」、「美式」、「義式」、「台式」、「韓式」、「法式」、「東南亞」。
   - ingredientsType（主要肉品/食材）：如「牛肉」、「豬肉」、「雞肉」、「海鮮」、「蔬食」、「蛋料理」。
   - mealType（餐點類型）：如「主食」、「湯品」、「甜點」、「飲料」、「小吃/點心」、「常備菜」。

【好物 / 電子產品 / 裝備推薦特別準則】
若內容涉及電子產品、3C數碼、生活家電或裝備好物推薦（無論原影片標題為何）：
1. 務必在 productInfo.brand 填入【品牌與精確型號名稱】（例如：「Sony WH-1000XM5」、「Apple Watch Ultra 2」）。
2. 在 productInfo.priceRange 填寫參考售價（例如：「NT$ 9,900」或「$399 美元」）。
3. 在 productInfo.specs 條列 3~5 項核心亮點規格。
4. 在 productInfo.pros 列出 2~3 項入手原因；在 productInfo.cons 列出 1~2 項注意事項或缺點。

【電影與影視實體解析特別準則 (非常重要)】
若內容在評論、解說或介紹一部電影、影集、動畫或紀錄片（category 為 media）：
1. title 欄位「必須且只能」填寫該電影的【正式繁體中文片名】（例如：「星際效應」、「逃出鯨吞」、「電馭叛客：邊緣行者」、「後室」、「周處除三害」）！
2. ⚠️ 嚴禁將 YouTube/Reels 影片的吸睛長標題（如「他被鯨魚吞下肚，有可能逃出來嗎？...」）填入 title！請務必提煉出電影真正本體的中文片名！
3. 在 mediaInfo.movieTitle 填寫相同的正式繁中片名。
4. 在 mediaInfo.originalTitle 填寫精確的電影原文或英文片名（例如：Interstellar, Whalefall, Cyberpunk: Edgerunners, The Backrooms）。
5. 在 summary 撰寫 50 字以內針對該電影與該篇影評核心觀點的重點筆記。

【景點與店家專屬店鋪型態智慧標籤 (smartTags) 指引】
當 category 為 place 時，嚴禁從固定清單中硬選！請根據店家的真實營業性質與招牌商品，自由給出 1~2 個最精確且傳神的專屬店鋪型態標籤（必須包含對應的 Emoji），填入 placeInfo.smartTags（以及 subPlaces 每個項目的 smartTags）。
例如：
- 酷皮脆燒肉潛艇堡、魯本三明治 ➔ 「🥖 潛艇堡/三明治」（注意：千萬不要因為有「燒肉」兩字就誤歸為燒肉火鍋店！）
- 萬里豆漿伯、臻味登飯糰 ➔ 「🥟 中式早點」
- 雜碎鴻 ➔ 「🌙 深夜黑白切/小吃」
- 七星藥局 ➔ 「🏛️ 老藥局/文化空間」
- 喬影像 ➔ 「📷 復古相機專賣店」
- 蒠寤•惜物製菓所 ➔ 「☕ 昭和風喫茶咖啡」
- 拾筆 ➔ 「✒️ 風格文具店」
- Hunter Goods & co. ➔ 「🛍️ 復古生活選物」
- 基隆港旁室內擬真模擬器體驗館 ➔ 「🎮 沉浸式模擬體驗館」

【多地點 / 美食懶人包合集特別指引 (非常重要)】
若該影片、貼文或文章中介紹了超過 1 間不同的店家、餐廳或景點（例如：「嘉義必吃 5 間火雞肉飯」、「京都 4 間私藏老屋咖啡」、「台北捷運 3 間布丁」）：
1. 務必在 places (或 subPlaces) 陣列中列出每一間店！
2. 每一間店的 shopName (或 name) 必須是該店的「純淨實體店名」（如：「民主火雞肉飯」、「阿宏師火雞肉飯」），嚴禁帶有「第一家：」、「必吃推薦」等標題贅字！
3. 針對每一間店分別提取專屬的 summary（必點招牌、招牌菜與特色重點）、city（統一正規化台灣縣市如「嘉義」、「台北」、「台中」）、address（真實地址或商圈位置）與精準的 googleMapsQuery（店名 + 城市/地址）。

【多模態視覺看圖識字特別指引】
若輸入中包含封面圖片，請仔細閱讀圖片中的大字標題、店名招牌、黑板菜單、價格或料理畫面：
- 很多創作者會將店名、菜名或產品型號直接印在影片封面上，請務必把圖片上的文字資訊與內文融合！`;

  const userPrompt = `請分析以下網頁資訊並進行極速結構化資訊萃取：
原始網址：${cleanUrl}

=== 收集到的網頁資訊內容開始 ===
${trimmedContent}
=== 收集到的網頁資訊內容結束 ===`;

  // 組合文字與多模態圖片輸入
  const contents: any[] = [];
  if (imagePart) {
    contents.push(imagePart);
  }
  contents.push(userPrompt);

  // 7. 呼叫全站統一備援引擎 (支援 503/429/500 自動多模型切換與工具降級)
  const shouldAttemptGrounding = effectiveTextLength < 30;
  console.log(`[Scraper Debug] 🤖 Invoking generateWithFallback (grounding: ${shouldAttemptGrounding})...`);

  const fallbackResult = await generateWithFallback({
    contents,
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema,
    temperature: 0.2,
    tools: shouldAttemptGrounding ? [{ googleSearch: {} }] : undefined,
  });

  const responseText = fallbackResult.text;
  const activeModelUsed = fallbackResult.modelUsed;
  if (shouldAttemptGrounding) {
    sources.push('GoogleSearchGrounding');
  }

  const parsedJson = JSON.parse(responseText);

  // 建立結果物件 (極速純粹結構化，100% 保留原始 rawUrl)
  const preservedOriginalUrl = rawUrl || cleanUrl;
  let resultItem: ParsedItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    url: preservedOriginalUrl,
    category: parsedJson.category || 'general',
    title: parsedJson.title || '無標題靈感',
    summary: parsedJson.summary || '',
    tags: Array.isArray(parsedJson.tags) ? parsedJson.tags : [],
    customTags: [],
    isFavorite: false,
    placeInfo: parsedJson.placeInfo || null,
    recipeInfo: parsedJson.recipeInfo || null,
    mediaInfo: parsedJson.mediaInfo || null,
    productInfo: parsedJson.productInfo || null,
    subPlaces:
      Array.isArray(parsedJson.places) && parsedJson.places.length > 0
        ? parsedJson.places.map((p: any) => ({
            name: (p.shopName || p.name || '').trim(),
            shopName: (p.shopName || p.name || '').trim(),
            city: p.city || '',
            district: p.district || '',
            address: p.address || '',
            summary: p.summary || p.highlight || '',
            highlight: p.highlight || p.summary || '',
            googleMapsQuery: p.googleMapsQuery || (p.shopName || p.name ? `${p.shopName || p.name} ${p.address || p.city || ''}`.trim() : ''),
            smartTags: Array.isArray(p.smartTags) && p.smartTags.length > 0 ? p.smartTags : undefined,
          }))
        : Array.isArray(parsedJson.subPlaces) && parsedJson.subPlaces.length > 0
          ? parsedJson.subPlaces.map((p: any) => ({
              name: (p.shopName || p.name || '').trim(),
              shopName: (p.shopName || p.name || '').trim(),
              city: p.city || '',
              district: p.district || '',
              address: p.address || '',
              summary: p.summary || p.highlight || '',
              highlight: p.highlight || p.summary || '',
              googleMapsQuery: p.googleMapsQuery || (p.shopName || p.name ? `${p.shopName || p.name} ${p.address || p.city || ''}`.trim() : ''),
              smartTags: Array.isArray(p.smartTags) && p.smartTags.length > 0 ? p.smartTags : undefined,
            }))
          : undefined,
    subProducts:
      Array.isArray(parsedJson.subProducts) && parsedJson.subProducts.length > 0
        ? parsedJson.subProducts
        : undefined,
    thumbnailUrl: thumbnailUrl || null,
    scrapeSources: sources,
    needsManualSupplement: effectiveTextLength < 25 && !imagePart,
    createdAt: Date.now(),
  };

  // 後處理保底 1：若為 place，嚴禁預設為台北，自動推斷並校正地名與地址
  if (resultItem.category === 'place') {
    if (!resultItem.placeInfo) {
      const detectedCity = extractCityFromText(trimmedContent) || extractCityFromText(resultItem.title) || '';
      resultItem.placeInfo = {
        locationName: resultItem.title,
        city: detectedCity,
        googleMapsQuery: detectedCity ? `${resultItem.title} ${detectedCity}` : resultItem.title,
      };
    }
    // 智慧城市與地址自動校正（防台北誤判、提取真實地址與清理必吃欄位）
    resultItem = fixPlaceMetadata(resultItem);
  }

  // 後處理保底 2：若為 recipe，確保 baseServings 為數值且大於 0，並補齊結構化多維智慧標籤
  if (resultItem.category === 'recipe' && resultItem.recipeInfo) {
    if (
      typeof resultItem.recipeInfo.baseServings !== 'number' ||
      resultItem.recipeInfo.baseServings <= 0
    ) {
      resultItem.recipeInfo.baseServings = 2;
    }

    const smartTags = getRecipeSmartTags(resultItem);
    resultItem.recipeInfo.recipeTags = {
      cuisine: resultItem.recipeInfo.recipeTags?.cuisine || smartTags.cuisine,
      ingredientsType:
        resultItem.recipeInfo.recipeTags?.ingredientsType || smartTags.ingredientsType,
      mealType: resultItem.recipeInfo.recipeTags?.mealType || smartTags.mealType,
    };
    resultItem.recipeTags = resultItem.recipeInfo.recipeTags;
  }

  // 經緯度地理編碼：若是地點，透過 Nominatim 自動查詢經緯度
  if (resultItem.category === 'place' && resultItem.placeInfo) {
    try {
      const coords = await geocodePlace(resultItem.placeInfo);
      if (coords) {
        resultItem.placeInfo.lat = coords.lat;
        resultItem.placeInfo.lng = coords.lng;
      }
    } catch (geoErr) {
      console.warn('[Scraper Debug] Geocoding pipeline caught error:', geoErr);
      const fallback = getFallbackCoordinates(
        resultItem.placeInfo.city || resultItem.placeInfo.address,
        resultItem.placeInfo.locationName || resultItem.title
      );
      resultItem.placeInfo.lat = fallback.lat;
      resultItem.placeInfo.lng = fallback.lng;
    }
  }

  // 儲存原始影片標題與縮圖（保留在 sources 列表中，不被電影海報覆蓋）
  const originalVideoTitle = parsedJson.title || '無標題影片';
  const originalVideoThumbnail = thumbnailUrl || null;

  // 電影實體精準處理與 IMDb / 官方資料抓取：若為 media，提取官方劇情大綱、真實年份、類型與代表色
  let originalInfluencerSummary = resultItem.summary;
  if (resultItem.category === 'media' && resultItem.mediaInfo) {
    resultItem.mediaInfo.isMovie = true;
    const movieTitle = (resultItem.mediaInfo.movieTitle || resultItem.title).trim();
    const originalTitle = (resultItem.mediaInfo.originalTitle || '').trim();

    try {
      const enriched = await enrichMovieData(
        movieTitle,
        originalTitle,
        resultItem.mediaInfo.releaseYear
      );

      // 主卡片一律使用電影正式片名與官方劇情大綱
      resultItem.title = enriched.movieTitle;
      resultItem.summary = enriched.plotSynopsis;
      resultItem.mediaInfo.movieTitle = enriched.movieTitle;
      resultItem.mediaInfo.originalTitle = enriched.originalTitle;
      resultItem.mediaInfo.releaseYear = enriched.releaseYear;
      resultItem.mediaInfo.genre = enriched.genre;
      resultItem.mediaInfo.genres = enriched.genres;
      resultItem.mediaInfo.themeColor = enriched.themeColor;
      resultItem.mediaInfo.plotSynopsis = enriched.plotSynopsis;

      resultItem.mediaInfo.director = enriched.director;
      resultItem.mediaInfo.releaseDate = enriched.releaseDate;
      resultItem.mediaInfo.streamingPlatforms = enriched.streamingPlatforms;
      resultItem.mediaInfo.youtubeReviews = enriched.youtubeReviews;

      if (enriched.imdbId) resultItem.mediaInfo.imdbId = enriched.imdbId;
      if (enriched.imdbRating) resultItem.mediaInfo.imdbRating = enriched.imdbRating;
      if (enriched.imdbRatingCount) resultItem.mediaInfo.imdbRatingCount = enriched.imdbRatingCount;
      if (enriched.posterUrl) {
        resultItem.mediaInfo.posterUrl = enriched.posterUrl;
        // 外層主卡封面一律強制使用 IMDb 官方 One-Sheet (27:40) 海報！
        resultItem.thumbnailUrl = enriched.posterUrl;
      }
      sources.push('IMDbOfficial');
    } catch (imdbErr) {
      console.warn('[Scraper Debug] Failed to enrich movie data:', imdbErr);
    }
  }

  // 好物 / 電子產品推薦專屬處理與官方產品圖抓取
  if (resultItem.productInfo?.brand) {
    try {
      const officialProductImg = await fetchOfficialProductImage(resultItem.productInfo.brand);
      if (officialProductImg) {
        resultItem.productInfo.officialImageUrl = officialProductImg;
        // 僅在原貼文無有效縮圖時才替換，優先保留原貼文/影片高畫質封面
        if (
          !resultItem.thumbnailUrl ||
          isInvalidThumbnail(resultItem.thumbnailUrl) ||
          resultItem.thumbnailUrl.startsWith('/placeholders/')
        ) {
          resultItem.thumbnailUrl = officialProductImg;
        }
        sources.push('OfficialProductImage');
      }
    } catch (prodErr) {
      console.warn('[Scraper Debug] Failed to fetch official product image:', prodErr);
    }
  }

  // 社群帳號個人主頁 (IG Profile, YouTube Channel, Threads Account) 專屬標記
  const isProfile = isSocialProfile(cleanUrl);
  if (isProfile) {
    resultItem.category = 'account';
    resultItem.aspectRatio = '1:1';
    let platform: 'instagram' | 'youtube' | 'threads' | 'other' = 'other';
    if (cleanUrl.includes('instagram.com') || cleanUrl.includes('instagr.am')) platform = 'instagram';
    else if (cleanUrl.includes('youtube.com')) platform = 'youtube';
    else if (cleanUrl.includes('threads.net')) platform = 'threads';

    let handle = '';
    let avatarUrl = resultItem.thumbnailUrl || undefined;

    if (platform === 'instagram') {
      const match = cleanUrl.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
      if (match && match[1] && !['p', 'reel', 'reels', 'stories', 'explore', 'direct'].includes(match[1].toLowerCase())) {
        const username = match[1];
        handle = `@${username}`;
        // 使用 unavatar.io 作為強韌備援，確保 100% 抓取到高清頭貼
        if (!avatarUrl || avatarUrl.includes('placeholder')) {
          avatarUrl = `https://unavatar.io/instagram/${username}`;
        }
      }
    } else if (platform === 'youtube') {
      const match = cleanUrl.match(/youtube\.com\/@([a-zA-Z0-9._-]+)/i);
      if (match && match[1]) {
        const username = match[1];
        handle = `@${username}`;
        if (!avatarUrl || avatarUrl.includes('placeholder')) {
          avatarUrl = `https://unavatar.io/youtube/${username}`;
        }
      }
    } else if (platform === 'threads') {
      const match = cleanUrl.match(/threads\.net\/@([a-zA-Z0-9._-]+)/i);
      if (match && match[1]) {
        handle = `@${match[1]}`;
      }
    }

    if (!avatarUrl) {
      avatarUrl = `https://unavatar.io/${encodeURIComponent(cleanUrl)}`;
    }

    resultItem.thumbnailUrl = avatarUrl;
    resultItem.accountInfo = {
      platform,
      handle: handle || (resultItem.title.includes('@') ? resultItem.title : `@${cleanUrl.split('/').filter(Boolean).pop() || ''}`),
      avatarUrl: avatarUrl,
      profileUrl: cleanUrl,
      bio: resultItem.summary,
    };
  } else if (resultItem.category === 'product' || Boolean(resultItem.productInfo?.brand)) {
    resultItem.category = 'product';
    resultItem.aspectRatio = '1:1';
  } else if (resultItem.category === 'media' && resultItem.mediaInfo?.posterUrl) {
    resultItem.aspectRatio = '27:40';
  } else {
    resultItem.aspectRatio = getSourceAspectRatio(cleanUrl);
  }

  // 初始化第 1 筆資料來源 (item.sources)，保留原始影片標題、影評觀點筆記與原始縮圖！
  const primarySource = {
    id: `src_orig_${resultItem.id}`,
    url: preservedOriginalUrl,
    title: originalVideoTitle,
    summary: originalInfluencerSummary, // 嚴格保留原始影評口白觀點
    thumbnailUrl: originalVideoThumbnail || undefined,
    author: resultItem.mediaInfo?.creator || undefined,
    addedAt: formatDate(Date.now()),
    aspectRatio: getSourceAspectRatio(preservedOriginalUrl),
  };

  // sources 僅保留使用者自己貼上的影評/來源，系統自動抓取的 YouTube 影評留在 mediaInfo.youtubeReviews
  resultItem.sources = [primarySource];

  console.log(
    `[Scraper Debug] ⚡ Parsing completed in fast mode: [${resultItem.category}] "${resultItem.title}" | IMDb: ${resultItem.mediaInfo?.imdbRating || '-'} | Place: ${resultItem.placeInfo?.locationName || '-'} | Movie: ${resultItem.mediaInfo?.movieTitle || '-'}`
  );

  return { item: resultItem, sources };
}

/**
 * 支援「純片名搜尋建檔」：
 * 當使用者輸入非網址（例如《陽光普照》、小丑、Interstellar）時，
 * 自動透過 IMDb API、Gemini 3.5 Flash 與 YouTube 搜尋建立完整的電影檔案卡片！
 */
export async function createMovieItemFromSearch(
  query: string,
  extraNote?: string
): Promise<{ item: ParsedItem; sources: string[] }> {
  const cleanTitle = (query || '')
    .replace(/^movie:/i, '')
    .replace(/[《》〈〉【】「」]/g, ' ')
    .trim();

  if (!cleanTitle) {
    throw new Error('請提供有效的電影名稱進行搜尋建檔。');
  }

  console.log(`[Movie Search] 🎬 Directly creating movie from query: "${cleanTitle}"`);
  const enriched = await enrichMovieData(cleanTitle);

  const id = `item_movie_${enriched.imdbId || Math.random().toString(36).slice(2, 9)}`;
  const canonicalUrl = enriched.imdbId
    ? `https://www.imdb.com/title/${enriched.imdbId}/`
    : `https://www.google.com/search?q=${encodeURIComponent(enriched.movieTitle)}`;

  // 系統自動抓取的 YouTube 影評留在 mediaInfo.youtubeReviews，sources 只存放使用者筆記
  const sourcesList: any[] = [];

  if (extraNote?.trim()) {
    sourcesList.push({
      id: `src_note_${Date.now()}`,
      url: canonicalUrl,
      title: '個人筆記與觀後感',
      summary: extraNote.trim(),
      thumbnailUrl: undefined,
      author: undefined,
      addedAt: formatDate(Date.now()),
      aspectRatio: '16:9' as const,
    });
  }

  const tags = [
    ...enriched.genres,
    '電影',
    enriched.imdbRating ? `IMDb ${enriched.imdbRating}` : '',
  ].filter(Boolean);

  const movieItem: ParsedItem = {
    id,
    url: canonicalUrl,
    category: 'media',
    title: enriched.movieTitle,
    summary: enriched.plotSynopsis,
    tags,
    thumbnailUrl: enriched.posterUrl || null,
    aspectRatio: '27:40',
    createdAt: Date.now(),
    mediaInfo: {
      creator: enriched.director ? `導演：${enriched.director}` : undefined,
      releaseYear: enriched.releaseYear,
      releaseDate: enriched.releaseDate,
      genre: enriched.genre,
      genres: enriched.genres,
      movieTitle: enriched.movieTitle,
      originalTitle: enriched.originalTitle,
      director: enriched.director,
      posterUrl: enriched.posterUrl,
      isMovie: true,
      imdbId: enriched.imdbId,
      imdbRating: enriched.imdbRating,
      imdbRatingCount: enriched.imdbRatingCount,
      themeColor: enriched.themeColor,
      plotSynopsis: enriched.plotSynopsis,
      streamingPlatforms: enriched.streamingPlatforms,
      youtubeReviews: enriched.youtubeReviews,
    },
    sources: sourcesList,
  };

  return {
    item: movieItem,
    sources: ['IMDbOfficial', 'GeminiEnrichment', 'YouTubeReviews'],
  };
}

/**
 * 支援「從候選名單精準定錨建檔電影」：
 * 當使用者點選搜尋候選清單中的特定電影卡片時，
 * 100% 採用該候選卡片的片名、原始英文名、上映年份、IMDb ID、海報與簡介，
 * 並呼叫 enrichMovieData 補齊台灣串流平台上架資訊與 YouTube 影評，絕不跑偏！
 */
export async function createMovieItemFromCandidate(
  candidate: MovieCandidateItem,
  extraNote?: string
): Promise<{ item: ParsedItem; sources: string[] }> {
  const cleanTitle = (candidate.title || '').trim();
  const cleanOriginal = (candidate.originalTitle || '').trim();
  const cleanYear = candidate.releaseYear ? String(candidate.releaseYear).trim() : undefined;

  console.log(
    `[Movie Candidate] 🎬 Directly creating movie from candidate: "${cleanTitle}" (${cleanYear || 'unknown year'}, imdb: ${candidate.imdbId || 'none'})`
  );

  let enriched: any = null;
  try {
    enriched = await enrichMovieData(cleanTitle, cleanOriginal, cleanYear);
  } catch (err) {
    console.warn('[Movie Candidate] Failed to enrich movie data from candidate:', err);
  }

  const imdbId = candidate.imdbId || enriched?.imdbId;
  const id = `item_movie_${imdbId || Math.random().toString(36).slice(2, 9)}`;
  const canonicalUrl = imdbId
    ? `https://www.imdb.com/title/${imdbId}/`
    : `https://www.google.com/search?q=${encodeURIComponent(cleanTitle)}`;

  const sourcesList: any[] = [];
  if (extraNote?.trim()) {
    sourcesList.push({
      id: `src_note_${Date.now()}`,
      url: canonicalUrl,
      title: '個人筆記與觀後感',
      summary: extraNote.trim(),
      thumbnailUrl: undefined,
      author: undefined,
      addedAt: formatDate(Date.now()),
      aspectRatio: '16:9' as const,
    });
  }

  const poster = candidate.posterUrl || enriched?.posterUrl || null;
  const synopsis = candidate.overview || enriched?.plotSynopsis || '暫無電影簡介';
  const director = candidate.director || enriched?.director;
  const genres =
    enriched?.genres && enriched.genres.length > 0 ? enriched.genres : ['電影'];
  const tags = [
    ...genres,
    enriched?.imdbRating ? `IMDb ${enriched.imdbRating}` : '',
  ].filter(Boolean);

  const movieItem: ParsedItem = {
    id,
    url: canonicalUrl,
    category: 'media',
    title: cleanTitle,
    summary: synopsis,
    tags,
    thumbnailUrl: poster,
    aspectRatio: '27:40',
    createdAt: Date.now(),
    mediaInfo: {
      creator: director ? `導演：${director}` : undefined,
      releaseYear: cleanYear || enriched?.releaseYear,
      releaseDate: enriched?.releaseDate,
      genre: enriched?.genre || genres.join(' / '),
      genres,
      movieTitle: cleanTitle,
      originalTitle: cleanOriginal || enriched?.originalTitle,
      director: director,
      posterUrl: poster || undefined,
      isMovie: true,
      imdbId: imdbId || undefined,
      imdbRating: enriched?.imdbRating,
      imdbRatingCount: enriched?.imdbRatingCount,
      themeColor: enriched?.themeColor || '#1c1917',
      plotSynopsis: synopsis,
      streamingPlatforms: enriched?.streamingPlatforms || [],
      youtubeReviews: enriched?.youtubeReviews || [],
    },
    sources: sourcesList,
  };

  return {
    item: movieItem,
    sources: ['ConfirmedCandidate', 'IMDbOfficial', 'GeminiEnrichment', 'YouTubeReviews'],
  };
}

/**
 * 支援「📷 上傳手機截圖 (Screenshot Vision 解析)」：
 * 由 Gemini 視覺模型直接辨識截圖中的餐廳、食譜、電影、好物或 IG 帳號，並自動補齊地址、IMDb 海報或食譜步驟與單人營養素！
 */
export async function parseScreenshotItem(
  imageBase64: string,
  extraNote?: string
): Promise<{ item: ParsedItem; sources: string[] }> {
  const apiKey = (await getEffectiveGeminiKey()) || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('伺服器未設定 GEMINI_API_KEY，請於網頁設定中輸入金鑰。');
  }

  let mimeType = 'image/jpeg';
  let base64Data = imageBase64;
  const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  const ai = new GoogleGenAI({ apiKey });
  const schema = {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        enum: ['place', 'recipe', 'media', 'general', 'account', 'product'],
        description:
          '分類：place(餐廳/咖啡廳/景點)、recipe(食譜/料理)、media(電影/影集)、account(IG/YouTube/Threads創作者帳號主頁截圖)、product(好物/3C/商品)、general(其他)',
      },
      title: {
        type: Type.STRING,
        description: '精確的繁體中文名稱（店名、菜名、電影片名、商品型號或創作者名稱）',
      },
      summary: {
        type: Type.STRING,
        description: '50字以內的重點繁體中文摘要',
      },
      tags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: '3~5 個關鍵字標籤',
      },
      placeInfo: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          locationName: { type: Type.STRING },
          address: { type: Type.STRING, description: '請補齊該店家的完整台灣/日本真實地址' },
          city: { type: Type.STRING, description: '所在大範圍縣市（如：臺北、新北、嘉義、屏東、臺南、東京，台灣縣市統一用正體「臺」）' },
          district: { type: Type.STRING, description: '所在具體鄉鎮市區或商圈（如：民雄、恆春、萬里、大安區、信義區）' },
          googleMapsQuery: { type: Type.STRING, description: '完整店名 + 完整地址' },
          rating: { type: Type.STRING, description: 'Google Maps 評分與評論數，如「4.8 ★ (120 則評論)」' },
          mustTryDishes: { type: Type.ARRAY, items: { type: Type.STRING }, description: '網友推薦必吃菜色（2~4項）' },
          reviewsSummary: { type: Type.ARRAY, items: { type: Type.STRING }, description: '熱門 Google 評論摘要（2~3則）' },
          smartTags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '1~2 個該店家專屬店鋪型態標籤（含 Emoji）',
          },
        },
      },
      recipeInfo: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          baseServings: { type: Type.NUMBER },
          servings: { type: Type.STRING },
          prepTime: { type: Type.STRING },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                unit: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: ['name', 'amount', 'unit', 'category'],
            },
          },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          recipeTags: {
            type: Type.OBJECT,
            properties: {
              cuisine: { type: Type.STRING },
              ingredientsType: { type: Type.STRING },
              mealType: { type: Type.STRING },
            },
            required: ['cuisine', 'ingredientsType', 'mealType'],
          },
          nutrition: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.STRING, description: '單人份熱量，如 480 kcal' },
              protein: { type: Type.STRING, description: '單人份蛋白質，如 28 g' },
              carbs: { type: Type.STRING, description: '單人份碳水，如 42 g' },
              fat: { type: Type.STRING, description: '單人份脂肪，如 18 g' },
            },
            required: ['calories', 'protein', 'carbs', 'fat'],
          },
        },
      },
      mediaInfo: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          movieTitle: { type: Type.STRING, description: '台灣官方繁體中文片名' },
          originalTitle: { type: Type.STRING, description: '英文/原文片名' },
          releaseYear: { type: Type.STRING },
          director: { type: Type.STRING },
          genre: { type: Type.STRING },
        },
      },
      productInfo: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          brand: { type: Type.STRING },
          priceRange: { type: Type.STRING },
          specs: { type: Type.ARRAY, items: { type: Type.STRING } },
          pros: { type: Type.ARRAY, items: { type: Type.STRING } },
          cons: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
      accountInfo: {
        type: Type.OBJECT,
        nullable: true,
        properties: {
          platform: {
            type: Type.STRING,
            enum: ['instagram', 'youtube', 'threads', 'other'],
          },
          handle: { type: Type.STRING, description: '帳號 ID，如 @username' },
          bio: { type: Type.STRING },
        },
      },
      subPlaces: {
        type: Type.ARRAY,
        nullable: true,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            city: { type: Type.STRING },
            district: { type: Type.STRING },
            address: { type: Type.STRING },
            highlight: { type: Type.STRING },
            smartTags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['name'],
        },
      },
      subProducts: {
        type: Type.ARRAY,
        nullable: true,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            brand: { type: Type.STRING },
            price: { type: Type.STRING },
            highlight: { type: Type.STRING },
          },
          required: ['name'],
        },
      },
    },
    required: ['category', 'title', 'summary', 'tags'],
  };

  const promptText = `請仔細辨識這張手機截圖中的文字、招牌、菜單、電影畫面、食譜配方、商品或 IG/社群帳號，並以繁體中文結構化建檔：
- 若是餐廳/景點截圖（place），請查出該店家的完整真實地址與所在城市。若截圖中推薦了多家店（如懶人包圖卡），請同時填入 subPlaces。
- 若是料理/食譜截圖（recipe），請補齊完整的食材克數、3~6 步料理步驟，並估算單人份營養素（calories, protein, carbs, fat）。
- 若是電影/影集截圖（media），請辨識出台灣官方繁中片名與英文片名。
- 若是 IG/YouTube/Threads 個人主頁截圖（account），請提取 @handle 帳號。
- 若是好物/商品截圖（product），請提取品牌型號、規格亮點與參考售價。
${extraNote ? `\n使用者補充備註：${extraNote}` : ''}`;

  const fallbackResult = await generateWithFallback({
    contents: [
      { inlineData: { data: base64Data, mimeType } },
      promptText,
    ],
    responseMimeType: 'application/json',
    responseSchema: schema,
    temperature: 0.2,
  });

  const responseText = fallbackResult.text;

  const parsed = JSON.parse(responseText);

  // 若辨識結果為電影 (media)，自動呼叫 enrichMovieData 補齊 IMDb 評分、1000px 海報、串流與 YouTube 影評！
  if (parsed.category === 'media') {
    const movieQuery = parsed.mediaInfo?.movieTitle || parsed.title;
    return createMovieItemFromSearch(movieQuery, extraNote || parsed.summary);
  }

  const id = `item-snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let aspectRatio: '9:16' | '16:9' | '27:40' | '1:1' = '9:16';
  let thumbnailUrl: string | null = imageBase64;
  let canonicalUrl = `https://www.google.com/search?q=${encodeURIComponent(parsed.title || '')}`;

  if (parsed.category === 'account') {
    aspectRatio = '1:1';
    const rawHandle = (parsed.accountInfo?.handle || parsed.title || '').replace(/^@/, '').trim();
    const platform = parsed.accountInfo?.platform || 'instagram';
    if (rawHandle && platform === 'instagram') {
      thumbnailUrl = `https://unavatar.io/instagram/${rawHandle}`;
      canonicalUrl = `https://www.instagram.com/${rawHandle}/`;
    } else if (rawHandle && platform === 'youtube') {
      thumbnailUrl = `https://unavatar.io/youtube/${rawHandle}`;
      canonicalUrl = `https://www.youtube.com/@${rawHandle}`;
    }
    parsed.accountInfo = {
      platform,
      handle: rawHandle ? `@${rawHandle}` : parsed.title,
      avatarUrl: thumbnailUrl || undefined,
      profileUrl: canonicalUrl,
      bio: parsed.summary,
    };
  } else if (parsed.category === 'product') {
    aspectRatio = '1:1';
  } else if (parsed.category === 'place') {
    const q =
      parsed.placeInfo?.googleMapsQuery ||
      `${parsed.placeInfo?.locationName || parsed.title} ${parsed.placeInfo?.address || parsed.placeInfo?.city || ''}`.trim();
    canonicalUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }

  const item: ParsedItem = {
    id,
    url: canonicalUrl,
    category: parsed.category || 'general',
    title: parsed.title || '截圖靈感收藏',
    summary: parsed.summary || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags : ['截圖收藏'],
    placeInfo: parsed.placeInfo || null,
    recipeInfo: parsed.recipeInfo || null,
    mediaInfo: parsed.mediaInfo || null,
    productInfo: parsed.productInfo || null,
    accountInfo: parsed.accountInfo || null,
    subPlaces:
      Array.isArray(parsed.places) && parsed.places.length > 0
        ? parsed.places.map((p: any) => ({
            name: (p.shopName || p.name || '').trim(),
            shopName: (p.shopName || p.name || '').trim(),
            city: p.city || '',
            district: p.district || '',
            address: p.address || '',
            summary: p.summary || p.highlight || '',
            highlight: p.highlight || p.summary || '',
            googleMapsQuery: p.googleMapsQuery || (p.shopName || p.name ? `${p.shopName || p.name} ${p.address || p.city || ''}`.trim() : ''),
            smartTags: Array.isArray(p.smartTags) && p.smartTags.length > 0 ? p.smartTags : undefined,
          }))
        : Array.isArray(parsed.subPlaces) && parsed.subPlaces.length > 0
          ? parsed.subPlaces.map((p: any) => ({
              name: (p.shopName || p.name || '').trim(),
              shopName: (p.shopName || p.name || '').trim(),
              city: p.city || '',
              district: p.district || '',
              address: p.address || '',
              summary: p.summary || p.highlight || '',
              highlight: p.highlight || p.summary || '',
              googleMapsQuery: p.googleMapsQuery || (p.shopName || p.name ? `${p.shopName || p.name} ${p.address || p.city || ''}`.trim() : ''),
              smartTags: Array.isArray(p.smartTags) && p.smartTags.length > 0 ? p.smartTags : undefined,
            }))
          : undefined,
    subProducts:
      Array.isArray(parsed.subProducts) && parsed.subProducts.length > 0
        ? parsed.subProducts
        : undefined,
    thumbnailUrl,
    aspectRatio,
    scrapeSources: ['GeminiVisionScreenshot'],
    createdAt: Date.now(),
  };

  return { item, sources: ['GeminiVisionScreenshot'] };
}

