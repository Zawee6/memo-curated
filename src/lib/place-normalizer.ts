import { ParsedItem, SourcePost } from '@/types/item';
import { normalizeCityName, extractCityFromAddress } from './location-normalizer';
import { formatDate } from './format';
import { getSourceAspectRatio, deduplicateSources } from './video';

/**
 * 智慧店家名稱正規化比對鍵
 * 將「Smoking Barbecue」、「Smoking Barbecues」、「Smokin\x27 BBQ」全部統一為「smokingbbq」
 * 將「一點散漫·小料亭（1.FOODNIA 嘉義創始店）」與「一點散漫·小料亭」統一為「一點散漫小料亭」
 */
export function getCanonicalShopKey(name?: string | null): string {
  if (!name) return '';

  let str = name.toLowerCase().trim();

  // 1. 去除括號與括號內文字（如：分店名、創始店、社群標記）
  str = str.replace(/【.*?】|\[.*?\]|\(.*?\)|（.*?）/g, '');

  // 2. 去除常見中文分店尾綴與贅詞
  str = str.replace(
    /(?:分店|旗艦店|創始店|總店|嘉義創始店|專賣店|嘉義店|台北店|台中店|高雄店|台南店|商圈|美食|特色小店)/gi,
    ''
  );

  // 3. 英文同義詞與縮寫統一 (先做完整單字替換)
  str = str
    .replace(/\bbarbecues\b/gi, 'bbq')
    .replace(/\bbarbecue\b/gi, 'bbq')
    .replace(/\bbbqs\b/gi, 'bbq')
    .replace(/\bsmokin(?:['’`])?\b/gi, 'smoking')
    .replace(/\bsmokey\b/gi, 'smoking')
    .replace(/\bsmokehouse\b/gi, 'smoking')
    .replace(/\brestaurants\b/gi, 'restaurant')
    .replace(/\bcafes\b/gi, 'cafe');

  // 4. 英文單字複數尾綴 s/es 移除
  str = str.replace(/\b([a-z]{3,})(?:es|s)\b/gi, '$1');

  // 5. 移除所有標點符號與特殊字元（', ’, ., ·, •, -, _, (), （）, 空格等）
  str = str.replace(/['’`'".·・•\-–—_~:：,，!！?？\\/|#+*&]/g, '');
  str = str.replace(/\s+/g, '');

  // 6. 次級保護：若經過拼裝後包含 barbecue / barbecues，再次替換為 bbq
  str = str.replace(/barbecues?/gi, 'bbq');

  return str.trim();
}

/**
 * 門牌地址正規化鍵
 * 移除郵遞區號、台灣/臺灣前綴、統一臺/台、去除標點空白
 */
export function getCanonicalAddressKey(address?: string | null): string {
  if (!address) return '';
  let str = address.trim().replace(/臺/g, '台');

  // 移除開頭的郵遞區號 (如 600, 640, 100)
  str = str.replace(/^\d{3,6}\s*/, '');

  // 移除 台灣/臺灣 前綴
  str = str.replace(/^(?:台灣|臺灣)\s*/, '');

  // 移除標點與空白
  str = str.replace(/['’`'".·・•\-–—_~:：,，!！?？\\/|#\s]/g, '');

  return str;
}

/**
 * 雙重判定是否為同一家店
 * 條件 A：店名 Canonical Key 相同，或核心店名相互包含且在同一城市（或城市未填）
 * 條件 B：雙方皆有真實門牌地址且地址正規化 Key 相同
 */
export function isSamePlace(itemA: ParsedItem, itemB: ParsedItem): boolean {
  if (!itemA || !itemB) return false;
  if (itemA.id === itemB.id) return true;

  // 兩者皆須為 place 分類（或具備 placeInfo）
  const isAPlace = itemA.category === 'place' || Boolean(itemA.placeInfo);
  const isBPlace = itemB.category === 'place' || Boolean(itemB.placeInfo);
  if (!isAPlace || !isBPlace) return false;

  const addrA = itemA.placeInfo?.address || '';
  const addrB = itemB.placeInfo?.address || '';

  // 條件 B（真實門牌地址完全相符）
  // 必須皆包含路/街/道/巷 且 包含 號
  const hasValidStreetNoA = /(?:[路街道路巷弄號樓]).*?\d+號?/.test(addrA);
  const hasValidStreetNoB = /(?:[路街道路巷弄號樓]).*?\d+號?/.test(addrB);
  if (hasValidStreetNoA && hasValidStreetNoB) {
    const keyAddrA = getCanonicalAddressKey(addrA);
    const keyAddrB = getCanonicalAddressKey(addrB);
    if (keyAddrA && keyAddrB && keyAddrA === keyAddrB) {
      return true;
    }
  }

  // 條件 A（店名正規化比對）
  const nameA = itemA.placeInfo?.locationName || itemA.title || '';
  const nameB = itemB.placeInfo?.locationName || itemB.title || '';
  const keyA = getCanonicalShopKey(nameA);
  const keyB = getCanonicalShopKey(nameB);

  if (!keyA || !keyB) return false;

  const cityA = normalizeCityName(itemA.placeInfo?.city || extractCityFromAddress(addrA));
  const cityB = normalizeCityName(itemB.placeInfo?.city || extractCityFromAddress(addrB));

  // 1. 完全相同
  if (keyA === keyB) {
    // 若雙方都有明確城市且城市不同，則不可合併（如：台北店 vs 台中店）
    if (cityA && cityB && cityA !== cityB) {
      return false;
    }
    return true;
  }

  // 2. 核心店名高度包含（例如 "smokingbbq" 與 "smokingbbq德州燒烤"，或 "一點散漫小料亭" 與 "一點散漫"）
  const minLen = Math.min(keyA.length, keyB.length);
  if (minLen >= 3 && (keyA.includes(keyB) || keyB.includes(keyA))) {
    // 在同一個城市，或至少一方未填寫城市
    if (!cityA || !cityB || cityA === cityB) {
      return true;
    }
  }

  return false;
}

/**
 * 智慧合併同一家店的兩張卡片為單一主卡
 * 保留最乾淨完整的店名與詳細門牌地址，合併必吃菜色清單、標籤與來源貼文 sources
 */
export function mergePlaceItems(masterItem: ParsedItem, incomingItem: ParsedItem): ParsedItem {
  // 決定主卡與次卡（偏好包含門牌號碼、或有評分、或較長的完整地址）
  const addrM = masterItem.placeInfo?.address || '';
  const addrI = incomingItem.placeInfo?.address || '';
  const masterHasNo = /\d+號/.test(addrM);
  const incomingHasNo = /\d+號/.test(addrI);

  let primary = masterItem;
  let secondary = incomingItem;

  if (!masterHasNo && incomingHasNo) {
    primary = incomingItem;
    secondary = masterItem;
  }

  const pPlace = primary.placeInfo || { locationName: primary.title };
  const sPlace = secondary.placeInfo || { locationName: secondary.title };

  // 1. 決定最佳店名 (去除括號贅詞，但保留辨識度高的中文名)
  const candidateNames = [
    pPlace.locationName,
    primary.title,
    sPlace.locationName,
    secondary.title,
  ].filter(Boolean) as string[];

  let bestTitle = primary.title;
  for (const name of candidateNames) {
    if (!name.includes('(') && !name.includes('（') && name.length >= 2 && name.length <= 30) {
      bestTitle = name;
      break;
    }
  }

  // 2. 決定最佳門牌地址
  let bestAddress = pPlace.address || sPlace.address || '';
  if (incomingHasNo && (!masterHasNo || addrI.length > addrM.length)) {
    bestAddress = addrI;
  } else if (masterHasNo) {
    bestAddress = addrM;
  }

  // 3. 決定最佳城市
  const cityM = pPlace.city ? normalizeCityName(pPlace.city) : '';
  const cityI = sPlace.city ? normalizeCityName(sPlace.city) : '';
  const bestCity = cityM || cityI || (bestAddress.includes('嘉義') ? '嘉義' : '');

  // 4. 決定最佳評分
  const bestRating = pPlace.rating || sPlace.rating;

  // 5. 合併必點菜色 (去重與清理)
  const allDishes = [
    ...(pPlace.mustTryDishes || []),
    ...(sPlace.mustTryDishes || []),
  ];
  const uniqueDishes: string[] = [];
  const seenDishKeys = new Set<string>();
  for (const dish of allDishes) {
    const cleaned = dish.trim();
    if (!cleaned || cleaned.length < 2) continue;
    const dKey = cleaned.toLowerCase().replace(/[\s\-_]/g, '');
    if (!seenDishKeys.has(dKey)) {
      seenDishKeys.add(dKey);
      uniqueDishes.push(cleaned);
    }
  }

  // 6. 合併來源貼文 (sources)，使用 deduplicateSources 進行嚴格去重
  const currentSources: SourcePost[] = Array.isArray(primary.sources) ? [...primary.sources] : [];
  if (currentSources.length === 0) {
    currentSources.push({
      id: `src_${primary.id}`,
      url: primary.url,
      title: primary.title,
      summary: primary.summary,
      thumbnailUrl: primary.thumbnailUrl || undefined,
      addedAt: formatDate(primary.createdAt || Date.now()),
      aspectRatio: getSourceAspectRatio(primary.url),
    });
  }

  const incomingSources = Array.isArray(secondary.sources) && secondary.sources.length > 0
    ? secondary.sources
    : [
        {
          id: `src_${secondary.id}`,
          url: secondary.url,
          title: secondary.title,
          summary: secondary.summary,
          thumbnailUrl: secondary.thumbnailUrl || undefined,
          addedAt: formatDate(secondary.createdAt || Date.now()),
          aspectRatio: getSourceAspectRatio(secondary.url),
        },
      ];

  const mergedSources = deduplicateSources([...currentSources, ...incomingSources]);

  // 7. 合併標籤 tags 與 customTags
  const mergedTags = Array.from(
    new Set([...(primary.tags || []), ...(secondary.tags || [])])
  ).filter((t) => t !== '台北' && t !== '#台北');
  if (bestCity && !mergedTags.includes(bestCity)) {
    mergedTags.unshift(bestCity);
  }

  const mergedCustomTags = Array.from(
    new Set([...(primary.customTags || []), ...(secondary.customTags || [])])
  );

  const bestOriginalVideoTitle =
    primary.originalVideoTitle ||
    secondary.originalVideoTitle ||
    primary.sources?.[0]?.title ||
    secondary.sources?.[0]?.title;

  return {
    ...primary,
    id: primary.id,
    title: bestTitle,
    originalVideoTitle: bestOriginalVideoTitle,
    summary: primary.summary || secondary.summary,
    tags: mergedTags,
    customTags: mergedCustomTags.length > 0 ? mergedCustomTags : undefined,
    thumbnailUrl: primary.thumbnailUrl || secondary.thumbnailUrl,
    sources: mergedSources,
    isFavorite: Boolean(primary.isFavorite || secondary.isFavorite),
    isCompleted: Boolean(primary.isCompleted || secondary.isCompleted),
    placeInfo: {
      locationName: bestTitle,
      city: bestCity,
      address: bestAddress,
      googleMapsQuery: `${bestTitle} ${bestAddress}`.trim(),
      rating: bestRating,
      mustTryDishes: uniqueDishes.length > 0 ? uniqueDishes : undefined,
      reviewsSummary: Array.from(
        new Set([...(pPlace.reviewsSummary || []), ...(sPlace.reviewsSummary || [])])
      ).slice(0, 5),
    },
  };
}
