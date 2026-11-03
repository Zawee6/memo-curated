import { ParsedItem, SourcePost } from '@/types/item';
import { formatDate } from './format';
import { getSourceAspectRatio, normalizeSocialUrl } from '@/lib/video';
import { getServerItems, saveServerItem, updateServerItem } from '@/lib/serverDb';
import { normalizeCityName, cleanMovieTitle, cleanLocationName, fixPlaceMetadata } from '@/lib/location-normalizer';
import { isSamePlace, mergePlaceItems } from '@/lib/place-normalizer';
export { cleanMovieTitle, cleanLocationName, fixPlaceMetadata, isSamePlace, mergePlaceItems };

/**
 * 判斷兩筆項目是否屬於同一個實體 (Entity)
 */
export function isSameEntity(a: ParsedItem, b: ParsedItem): boolean {
  if (!a || !b) return false;

  // 1. 景點與美食分類比對 (place) - 使用智慧店家正規化比對（支援同名異字、縮寫、門牌匹配）
  if (a.category === 'place' && b.category === 'place') {
    // 若來自同一 URL，先確認店名是否有重大不同（合集拆分保護）
    if (a.url && b.url && a.url.trim() === b.url.trim()) {
      const locA = cleanLocationName(a.placeInfo?.locationName || a.title || '');
      const locB = cleanLocationName(b.placeInfo?.locationName || b.title || '');
      if (locA && locB && locA !== locB) {
        // 同 URL 但店名清洗後不同，為合集中的不同店家，絕不可合併！
        return false;
      }
    }
    return isSamePlace(a, b);
  }

  // 2. 電影/影音分類比對
  if (a.category === 'media' && b.category === 'media') {
    if (a.url && b.url && a.url.trim() === b.url.trim()) {
      return true;
    }
    const titleA = a.mediaInfo?.movieTitle || a.title;
    const titleB = b.mediaInfo?.movieTitle || b.title;
    const cleanA = cleanMovieTitle(titleA);
    const cleanB = cleanMovieTitle(titleB);

    if (cleanA && cleanB) {
      if (cleanA === cleanB) return true;
      if (cleanA.length >= 3 && cleanB.length >= 3) {
        if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
      }
    }

    const origA = a.mediaInfo?.originalTitle?.toLowerCase().replace(/[^a-z0-9]/g, '');
    const origB = b.mediaInfo?.originalTitle?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (origA && origB && origA.length >= 4 && origB.length >= 4) {
      if (origA === origB || origA.includes(origB) || origB.includes(origA)) {
        return true;
      }
    }
    return false;
  }

  // 3. 食譜與其他分類：若 URL 完全相同，視為同實體
  if (a.url && b.url && a.url.trim() === b.url.trim()) {
    return true;
  }

  return false;
}

/**
 * 在現有項目列表中尋找既有的主卡
 */
export function findMatchingMasterItem(
  newItem: ParsedItem,
  existingItems: ParsedItem[]
): ParsedItem | null {
  for (const item of existingItems) {
    if (isSameEntity(item, newItem)) {
      return item;
    }
  }
  return null;
}

/**
 * 將新貼文合併進既有主卡，並維護 sources 陣列
 */
export function mergeIntoMasterItem(
  masterItem: ParsedItem,
  incomingItem: ParsedItem
): ParsedItem {
  if (masterItem.category === 'place' && incomingItem.category === 'place') {
    return mergePlaceItems(masterItem, incomingItem);
  }

  const currentSources: SourcePost[] = Array.isArray(masterItem.sources)
    ? [...masterItem.sources]
    : [];

  // 若主卡原本沒有任何 sources，將主卡原本代表的貼文封裝為第 1 筆 source
  if (currentSources.length === 0) {
    currentSources.push({
      id: `src_orig_${masterItem.id}`,
      url: masterItem.url,
      title: masterItem.title,
      summary: masterItem.summary,
      thumbnailUrl: masterItem.thumbnailUrl || undefined,
      author: masterItem.mediaInfo?.creator || undefined,
      addedAt: formatDate(masterItem.createdAt || Date.now()),
      aspectRatio: getSourceAspectRatio(masterItem.url),
    });
  }

  // 檢查新貼文是否已存在於 sources 中 (以 URL + 標題/摘要 嚴格去重，絕不可重複塞入相同筆記)
  const incomingUrl = incomingItem.url.trim();
  const incomingSummary = (incomingItem.summary || incomingItem.title || '').trim();
  const alreadyExists = currentSources.some(
    (s) => s.url.trim() === incomingUrl && (!incomingSummary || (s.summary || s.title || '').trim() === incomingSummary)
  );

  if (!alreadyExists) {
    const incSrc = incomingItem.sources?.[0];
    currentSources.push({
      id: incSrc?.id || `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      url: incomingUrl,
      title: incSrc?.title || incomingItem.title,
      summary: incSrc?.summary || incomingItem.summary,
      thumbnailUrl: incSrc?.thumbnailUrl || incomingItem.thumbnailUrl || undefined,
      author: incSrc?.author || incomingItem.mediaInfo?.creator || undefined,
      addedAt: incSrc?.addedAt || formatDate(incomingItem.createdAt || Date.now()),
      aspectRatio: incSrc?.aspectRatio || getSourceAspectRatio(incomingUrl),
    });
  }

  // sources 陣列內部二次去重清理
  const uniqueSources: SourcePost[] = [];
  const seenSrcKeys = new Set<string>();
  for (const s of currentSources) {
    const sKey = `${(s.url || '').trim()}::${(s.summary || s.title || '').trim().slice(0, 40)}`;
    if (!seenSrcKeys.has(sKey)) {
      seenSrcKeys.add(sKey);
      uniqueSources.push(s);
    }
  }

  // 合併標籤與補充資訊
  const mergedTags = Array.from(
    new Set([...(masterItem.tags || []), ...(incomingItem.tags || [])])
  );

  const mergedCustomTags = Array.from(
    new Set([...(masterItem.customTags || []), ...(incomingItem.customTags || [])])
  );

  // 若主卡缺少官方海報，但新項目有海報，則補上
  const updatedMediaInfo = masterItem.mediaInfo
    ? {
        ...masterItem.mediaInfo,
        posterUrl: masterItem.mediaInfo.posterUrl || incomingItem.mediaInfo?.posterUrl,
      }
    : incomingItem.mediaInfo;

  return {
    ...masterItem,
    tags: mergedTags,
    customTags: mergedCustomTags.length > 0 ? mergedCustomTags : masterItem.customTags,
    mediaInfo: updatedMediaInfo,
    sources: currentSources,
  };
}

/**
 * 處理新項目入庫：支援多地點懶人包卡片自動拆分 ＋ 智慧實體去重合併
 * 若傳入的項目為景點/餐廳且包含多個店家 (places / subPlaces.length > 1)，
 * 則不產生模糊合集主卡，而是為每一間店獨立拆分卡片入庫，共用縮圖並個別去重！
 */
export async function processItemWithSplittingAndDeduplication(
  item: ParsedItem,
  spaceId?: string
): Promise<{
  finalItem: ParsedItem;
  allItems: ParsedItem[];
  isMerged: boolean;
  splitCount?: number;
  splitItems?: ParsedItem[];
}> {
  const existingItems = await getServerItems(spaceId);

  // 1. 若為地點類別且包含多個子地點 (places / subPlaces > 1)，進行多地點自動拆分卡片引擎
  if (item.category === 'place' && item.subPlaces && item.subPlaces.length > 1) {
    const savedCards: ParsedItem[] = [];
    let currentDb = existingItems;
    let anyMerged = false;

    for (let idx = 0; idx < item.subPlaces.length; idx++) {
      const sp = item.subPlaces[idx];
      const shopName = (sp.shopName || sp.name || '').trim();
      if (!shopName) continue;

      const city = normalizeCityName(sp.city || item.placeInfo?.city || '嘉義');
      const address = (sp.address || (sp.city ? `${sp.city} ${shopName}` : shopName)).trim();
      const googleMapsQuery = (sp.googleMapsQuery || `${shopName} ${address}`).trim();
      const summary = (sp.summary || sp.highlight || `來自「${item.title}」推薦地點`).trim();

      const normUrl = item.url;
      const originalVideoTitle = item.originalVideoTitle || item.title;

      const candidatePlaceCard: ParsedItem = {
        id: `item_${Date.now()}_place_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        url: normUrl,
        category: 'place',
        title: shopName,
        originalVideoTitle,
        summary,
        tags: Array.from(new Set([city, '美食', ...(item.tags || [])])).filter(Boolean).slice(0, 5),
        thumbnailUrl: item.thumbnailUrl,
        aspectRatio: item.aspectRatio || '9:16',
        createdAt: Date.now() - (item.subPlaces.length - idx) * 10,
        placeInfo: {
          locationName: shopName,
          city,
          district: sp.district || item.placeInfo?.district,
          address,
          googleMapsQuery,
          mustTryDishes: sp.mustTryDishes || (sp.highlight ? [sp.highlight] : undefined),
          rating: sp.rating,
          smartTags: Array.isArray(sp.smartTags) && sp.smartTags.length > 0 ? sp.smartTags : item.placeInfo?.smartTags,
        },
        sources: [
          {
            id: `src_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            url: normUrl,
            title: originalVideoTitle,
            summary,
            thumbnailUrl: item.thumbnailUrl || undefined,
            author: item.mediaInfo?.creator || undefined,
            addedAt: formatDate(Date.now()),
            aspectRatio: getSourceAspectRatio(item.url),
          },
        ],
      };

      // 深度校正地名與真實地址（修正嘉義誤判為台北）
      const calibratedCard = fixPlaceMetadata(candidatePlaceCard);

      // 針對每間拆分店家進行實體比對去重
      const matchedMaster = findMatchingMasterItem(calibratedCard, currentDb);
      if (matchedMaster) {
        const merged = mergeIntoMasterItem(matchedMaster, calibratedCard);
        currentDb = await updateServerItem(matchedMaster.id, merged, spaceId);
        savedCards.push(merged);
        anyMerged = true;
      } else {
        currentDb = await saveServerItem(calibratedCard, spaceId);
        savedCards.push(calibratedCard);
      }
    }

    const finalItem = savedCards[0] || item;
    return {
      finalItem,
      allItems: currentDb,
      isMerged: anyMerged,
      splitCount: savedCards.length,
      splitItems: savedCards,
    };
  }

  // 2. 一般單一項目（單一景點/餐廳、電影、食譜、好物、帳號）去重與儲存流程
  const matchedMaster = findMatchingMasterItem(item, existingItems);
  if (matchedMaster) {
    const mergedMaster = mergeIntoMasterItem(matchedMaster, item);
    const allItems = await updateServerItem(matchedMaster.id, mergedMaster, spaceId);
    return {
      finalItem: mergedMaster,
      allItems,
      isMerged: true,
    };
  } else {
    const finalItem = { ...item, createdAt: item.createdAt || Date.now() };
    const allItems = await saveServerItem(finalItem, spaceId);
    return {
      finalItem,
      allItems,
      isMerged: false,
    };
  }
}

