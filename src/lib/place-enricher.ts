import { ParsedItem } from '@/types/item';
import { generateWithFallback, extractJsonFromText } from './gemini-client';
import { normalizeCityName, fixPlaceMetadata } from './location-normalizer';
import { isSamePlace, mergePlaceItems } from './place-normalizer';

/**
 * 檢查店家是否缺少真實門牌地址（例如地址為空、與店名相同、或是缺少路/街/號）
 */
export function isMissingStreetAddress(item: ParsedItem): boolean {
  if (item.category !== 'place') return false;
  const addr = (item.placeInfo?.address || '').trim();
  const shopName = (item.placeInfo?.locationName || item.title || '').trim();

  if (!addr) return true;
  if (addr === shopName || addr === item.title) return true;
  if (addr === 'undefined' || addr === 'null') return true;

  // 必須包含 路/街/道/巷 且包含 門牌號碼「號」
  const hasStreet = /[路街道路巷弄]/.test(addr);
  const hasNumber = /\d+號?/.test(addr);

  return !(hasStreet && hasNumber);
}

/**
 * 透過 Google Search (Gemini) 查詢該店真實完整地址、正確縣市、評分與必點招牌
 */
export async function enrichPlaceWithGoogleMaps(item: ParsedItem): Promise<ParsedItem> {
  if (item.category !== 'place') return item;
  if (!isMissingStreetAddress(item)) {
    return fixPlaceMetadata(item);
  }

  const shopName = (item.placeInfo?.locationName || item.title || '').trim();
  if (!shopName || shopName.length < 2) return item;

  const cityHint = item.placeInfo?.city || (item.title.includes('嘉義') || item.summary?.includes('嘉義') ? '嘉義' : '');

  const prompt = `你是一個專業的地圖與美食資料探勘助手。請針對台灣店家「${shopName}」（所在地區/縣市提示：${cityHint || '台灣'}），使用 Google 搜尋查詢該店家的真實營業資訊。

請嚴格以純 JSON 格式回傳，格式如下：
{
  "address": "店家真實完整門牌地址，包含縣市、行政區、路街與門牌號（例如：嘉義市東區東仁街102號。若查無確切地址請填空字串）",
  "city": "所在大範圍縣市統稱，例如：嘉義、臺北、新北、臺中、臺南、高雄、屏東（台灣縣市請統一用正體字「臺」，勿帶縣/市尾綴，若在嘉義縣或嘉義市一律填「嘉義」）",
  "district": "所在具體鄉鎮市區或商圈，例如：東區、西區、民雄、恆春、萬里、大安區、信義區",
  "rating": 4.6, // Google Maps 評分數字（1.0 ~ 5.0），若無請填 null
  "mustTry": ["招牌菜1", "必點料理2"] // 2~4 道精簡招牌餐點名稱，切勿填寫長句、價格或地址
}

請直接回傳純 JSON 字串，不要包含任何開頭結尾說明文字。`;

  try {
    const res = await generateWithFallback({
      contents: prompt,
      tools: [{ googleSearch: {} }],
      // 🚨 絕不可帶 responseMimeType: 'application/json' 以免 400 錯誤
      temperature: 0.1,
      modelList: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'],
    });

    const parsedJson = JSON.parse(extractJsonFromText(res.text));

    const enrichedItem: ParsedItem = {
      ...item,
      placeInfo: {
        ...item.placeInfo,
        locationName: shopName,
      },
      tags: Array.isArray(item.tags) ? [...item.tags] : [],
    };

    const placeInfo = enrichedItem.placeInfo!;

    if (parsedJson.address && typeof parsedJson.address === 'string' && parsedJson.address.length >= 6) {
      placeInfo.address = parsedJson.address.trim();
      placeInfo.googleMapsQuery = `${shopName} ${placeInfo.address}`.trim();
    }

    if (parsedJson.city && typeof parsedJson.city === 'string') {
      placeInfo.city = normalizeCityName(parsedJson.city.trim());
    }

    if (parsedJson.district && typeof parsedJson.district === 'string') {
      placeInfo.district = parsedJson.district.trim();
    }

    if (typeof parsedJson.rating === 'number' && parsedJson.rating >= 1 && parsedJson.rating <= 5) {
      placeInfo.rating = parsedJson.rating;
    }

    if (Array.isArray(parsedJson.mustTry) && parsedJson.mustTry.length > 0) {
      const cleanMustTry = parsedJson.mustTry
        .filter((d: any) => typeof d === 'string' && d.trim().length >= 2 && d.trim().length <= 20)
        .map((d: string) => d.trim());
      if (cleanMustTry.length > 0) {
        placeInfo.mustTryDishes = Array.from(
          new Set([...(placeInfo.mustTryDishes || []), ...cleanMustTry])
        );
      }
    }

    return fixPlaceMetadata(enrichedItem);
  } catch (err) {
    console.warn(`[PlaceEnricher] Failed to enrich "${shopName}" via Google Maps:`, err);
    return fixPlaceMetadata(item);
  }
}

import { normalizeSocialUrl, deduplicateSources } from './video';

/**
 * 對項目清單執行完整清洗、同名異字模糊去重合併與地名校正
 */
export function sanitizeAndConsolidatePlaces(items: ParsedItem[]): {
  consolidatedItems: ParsedItem[];
  changed: boolean;
} {
  const result: ParsedItem[] = [];
  let hasMergedOrChanged = false;

  // 1. 深度校正每一張卡片的地點屬性（地址提取、嘉義校正、清理必吃、sources 去重）
  const calibrated = items.map((i) => {
    let item = { ...i };
    if (item.sources && item.sources.length > 0) {
      const dedupedSources = deduplicateSources(item.sources);
      if (dedupedSources.length !== item.sources.length) {
        item.sources = dedupedSources;
        hasMergedOrChanged = true;
      }
      if (!item.originalVideoTitle && item.sources[0]?.title) {
        item.originalVideoTitle = item.sources[0].title;
        hasMergedOrChanged = true;
      }
    }

    if (item.category === 'place') {
      const fixed = fixPlaceMetadata(item);
      if (JSON.stringify(fixed) !== JSON.stringify(item)) {
        hasMergedOrChanged = true;
      }
      return fixed;
    }
    return item;
  });

  // 2. 依序執行實體判定與智慧去重歸戶
  for (const item of calibrated) {
    if (!item || !item.id) continue;

    if (item.category === 'place') {
      // 尋找已入結果庫中是否有一致的店家
      const matchIdx = result.findIndex((existing) => isSamePlace(existing, item));
      if (matchIdx !== -1) {
        // 合併兩張卡片為單一主卡
        const merged = mergePlaceItems(result[matchIdx], item);
        result[matchIdx] = merged;
        hasMergedOrChanged = true;
      } else {
        result.push(item);
      }
    } else {
      // 非 place 項目，依 URL 去重
      const matchIdx = result.findIndex(
        (existing) =>
          existing.category === item.category &&
          existing.url &&
          item.url &&
          existing.url.trim() === item.url.trim() &&
          !item.url.startsWith('https://example.com')
      );
      if (matchIdx !== -1) {
        hasMergedOrChanged = true;
      } else {
        result.push(item);
      }
    }
  }

  return {
    consolidatedItems: result,
    changed: hasMergedOrChanged || result.length !== items.length,
  };
}
