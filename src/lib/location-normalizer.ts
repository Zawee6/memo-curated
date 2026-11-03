/**
 * 台灣縣市地名正規化模組
 * 將「嘉義市」、「嘉義縣」、「Chiayi」全部統稱為「嘉義」，其他縣市亦去掉「縣/市」尾綴統一合併
 */

import { ParsedItem } from '@/types/item';
import { resolvePlaceHierarchy, standardizeCityName } from './taiwanLocations';

const CITY_MAPPINGS: { pattern: RegExp; normalized: string }[] = [
  // 嘉義 (Chiayi)
  { pattern: /^(?:嘉義[縣市]?|chiayi(?:\s*(?:city|county))?)$/i, normalized: '嘉義' },
  // 臺北 (Taipei)
  { pattern: /^(?:[臺台]北[市]?|taipei(?:\s*city)?)$/i, normalized: '臺北' },
  // 新北 (New Taipei)
  { pattern: /^(?:新北[市]?|new\s*taipei(?:\s*city)?)$/i, normalized: '新北' },
  // 基隆 (Keelung)
  { pattern: /^(?:基隆[市]?|keelung(?:\s*city)?)$/i, normalized: '基隆' },
  // 桃園 (Taoyuan)
  { pattern: /^(?:桃園[縣市]?|taoyuan(?:\s*(?:city|county))?)$/i, normalized: '桃園' },
  // 新竹 (Hsinchu)
  { pattern: /^(?:新竹[縣市]?|hsinchu(?:\s*(?:city|county))?)$/i, normalized: '新竹' },
  // 苗栗 (Miaoli)
  { pattern: /^(?:苗栗[縣市]?|miaoli(?:\s*(?:city|county))?)$/i, normalized: '苗栗' },
  // 臺中 (Taichung)
  { pattern: /^(?:[臺台]中[縣市]?|taichung(?:\s*(?:city|county))?)$/i, normalized: '臺中' },
  // 彰化 (Changhua)
  { pattern: /^(?:彰化[縣市]?|changhua(?:\s*(?:city|county))?)$/i, normalized: '彰化' },
  // 南投 (Nantou)
  { pattern: /^(?:南投[縣市]?|nantou(?:\s*(?:city|county))?)$/i, normalized: '南投' },
  // 雲林 (Yunlin)
  { pattern: /^(?:雲林[縣]?|yunlin(?:\s*county)?)$/i, normalized: '雲林' },
  // 臺南 (Tainan)
  { pattern: /^(?:[臺台]南[縣市]?|tainan(?:\s*(?:city|county))?)$/i, normalized: '臺南' },
  // 高雄 (Kaohsiung)
  { pattern: /^(?:[高髙]雄[縣市]?|kaohsiung(?:\s*(?:city|county))?)$/i, normalized: '高雄' },
  // 屏東 (Pingtung)
  { pattern: /^(?:屏東[縣市]?|pingtung(?:\s*(?:city|county))?)$/i, normalized: '屏東' },
  // 宜蘭 (Yilan)
  { pattern: /^(?:宜蘭[縣市]?|yilan(?:\s*(?:city|county))?)$/i, normalized: '宜蘭' },
  // 花蓮 (Hualien)
  { pattern: /^(?:花蓮[縣市]?|hualien(?:\s*(?:city|county))?)$/i, normalized: '花蓮' },
  // 臺東 (Taitung)
  { pattern: /^(?:[臺台]東[縣市]?|taitung(?:\s*(?:city|county))?)$/i, normalized: '臺東' },
  // 澎湖 (Penghu)
  { pattern: /^(?:澎湖[縣]?|penghu(?:\s*county)?)$/i, normalized: '澎湖' },
  // 金門 (Kinmen)
  { pattern: /^(?:金門[縣]?|kinmen(?:\s*county)?)$/i, normalized: '金門' },
  // 馬祖 / 連江 (Matsu / Lienchiang)
  { pattern: /^(?:連江[縣]?|馬祖|matsu|lienchiang(?:\s*county)?)$/i, normalized: '連江' },
];

/**
 * 清洗繁中電影片名：去除標點符號、括號字樣、影評前綴後綴
 */
export function cleanMovieTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/【.*?】|\[.*?\]|\(.*?\)|（.*?）/g, '')
    .replace(/(?:影評|解析|劇情|彩蛋|預告|短評|推薦|Shorts|Reels|電影|續集)/gi, '')
    .replace(/[：:·・\s\-_—]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * 清洗店家名稱：去除分店、商圈、括號
 */
export function cleanLocationName(name: string): string {
  if (!name) return '';
  return name
    .replace(/【.*?】|\[.*?\]|\(.*?\)|（.*?）/g, '')
    .replace(/(?:分店|旗艦店|創始店|總店|台北店|台中店|高雄店|台南店|嘉義店|商圈|美食)/gi, '')
    .replace(/[\s\-_—]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * 通用地名正規化函式
 * @param rawCity 原始輸入城市名稱
 * @returns 乾淨純粹的縣市統稱（例如：「嘉義」、「台北」、「台中」）
 */
export function normalizeCityName(rawCity?: string | null): string {
  if (!rawCity) return '';
  const trimmed = rawCity
    .trim()
    .replace(/台/g, '臺')
    .replace(/\s+/g, ' ');

  if (!trimmed) return '';

  // 1. 先比對已知台灣縣市正規表達式
  for (const { pattern, normalized } of CITY_MAPPINGS) {
    if (pattern.test(trimmed)) {
      return normalized;
    }
  }

  // 2. 若字串中包含特定台灣縣市關鍵字，也直接歸納
  if (trimmed.includes('嘉義') || /chiayi/i.test(trimmed)) return '嘉義';
  if (trimmed.includes('臺北') || trimmed.includes('台北') || /taipei/i.test(trimmed)) return '臺北';
  if (trimmed.includes('新北') || /new\s*taipei/i.test(trimmed)) return '新北';
  if (trimmed.includes('臺中') || trimmed.includes('台中') || /taichung/i.test(trimmed)) return '臺中';
  if (trimmed.includes('臺南') || trimmed.includes('台南') || /tainan/i.test(trimmed)) return '臺南';
  if (trimmed.includes('高雄') || /kaohsiung/i.test(trimmed)) return '高雄';
  if (trimmed.includes('基隆') || /keelung/i.test(trimmed)) return '基隆';
  if (trimmed.includes('桃園') || /taoyuan/i.test(trimmed)) return '桃園';
  if (trimmed.includes('新竹') || /hsinchu/i.test(trimmed)) return '新竹';
  if (trimmed.includes('苗栗') || /miaoli/i.test(trimmed)) return '苗栗';
  if (trimmed.includes('彰化') || /changhua/i.test(trimmed)) return '彰化';
  if (trimmed.includes('南投') || /nantou/i.test(trimmed)) return '南投';
  if (trimmed.includes('雲林') || /yunlin/i.test(trimmed)) return '雲林';
  if (trimmed.includes('屏東') || /pingtung/i.test(trimmed)) return '屏東';
  if (trimmed.includes('宜蘭') || /yilan/i.test(trimmed)) return '宜蘭';
  if (trimmed.includes('花蓮') || /hualien/i.test(trimmed)) return '花蓮';
  if (trimmed.includes('臺東') || trimmed.includes('台東') || /taitung/i.test(trimmed)) return '臺東';
  if (trimmed.includes('澎湖') || /penghu/i.test(trimmed)) return '澎湖';
  if (trimmed.includes('金門') || /kinmen/i.test(trimmed)) return '金門';
  if (trimmed.includes('連江') || trimmed.includes('馬祖')) return '連江';

  // 3. 一般通用邏輯：若以「縣」或「市」結尾，去掉最後一個字（如：東京都 -> 東京）
  if (trimmed.length >= 3 && /[縣市]$/.test(trimmed)) {
    return trimmed.slice(0, -1);
  }

  return trimmed;
}

/**
 * 從完整地址或店名萃取正規化縣市名稱
 */
export function extractCityFromAddress(address?: string | null): string {
  if (!address) return '';
  const normAddress = address.replace(/台/g, '臺');

  for (const { normalized } of CITY_MAPPINGS) {
    if (normAddress.includes(normalized)) {
      return normalized;
    }
  }

  // 額外正則匹配
  const match = normAddress.match(/(?:台灣|臺灣)?([^\s\d,，]{2,3}[縣市])/);
  if (match && match[1]) {
    return normalizeCityName(match[1]);
  }

  return '';
}

/**
 * 從任意全文內容中偵測台灣縣市名稱
 */
export function extractCityFromText(text?: string | null): string {
  if (!text) return '';
  const norm = text.replace(/台/g, '臺');

  // 1. 優先比對已知台灣縣市關鍵字
  if (norm.includes('嘉義') || /chiayi/i.test(norm)) return '嘉義';
  if (norm.includes('臺南') || norm.includes('台南') || /tainan/i.test(norm)) return '臺南';
  if (norm.includes('臺中') || norm.includes('台中') || /taichung/i.test(norm)) return '臺中';
  if (norm.includes('高雄') || /kaohsiung/i.test(norm)) return '高雄';
  if (norm.includes('新北') || /new\s*taipei/i.test(norm)) return '新北';
  if (norm.includes('桃園') || /taoyuan/i.test(norm)) return '桃園';
  if (norm.includes('新竹') || /hsinchu/i.test(norm)) return '新竹';
  if (norm.includes('苗栗') || /miaoli/i.test(norm)) return '苗栗';
  if (norm.includes('彰化') || /changhua/i.test(norm)) return '彰化';
  if (norm.includes('南投') || /nantou/i.test(norm)) return '南投';
  if (norm.includes('雲林') || /yunlin/i.test(norm)) return '雲林';
  if (norm.includes('屏東') || /pingtung/i.test(norm)) return '屏東';
  if (norm.includes('宜蘭') || /yilan/i.test(norm)) return '宜蘭';
  if (norm.includes('花蓮') || /hualien/i.test(norm)) return '花蓮';
  if (norm.includes('臺東') || norm.includes('台東') || /taitung/i.test(norm)) return '臺東';
  if (norm.includes('基隆') || /keelung/i.test(norm)) return '基隆';
  if (norm.includes('澎湖') || /penghu/i.test(norm)) return '澎湖';
  if (norm.includes('金門') || /kinmen/i.test(norm)) return '金門';
  if (norm.includes('連江') || norm.includes('馬祖')) return '連江';
  if (norm.includes('臺北') || norm.includes('台北') || /taipei/i.test(norm)) return '臺北';

  return '';
}

/**
 * 智慧地點城市與地址自動校正函式
 * 1. 修正「嘉義」被誤判為「台北」的問題，清除 #台北 標籤並填入 #嘉義
 * 2. 自動從全文中提取真實地址（如 嘉義市...號）並寫入 placeInfo.address
 * 3. 清理 summary 與 mustTryDishes 裡的「地址：...」字串，避免地址塞進必吃必點膠囊
 */
export function fixPlaceMetadata<T extends ParsedItem>(item: T): T {
  if (!item || item.category !== 'place') return item;

  const clone: T = {
    ...item,
    placeInfo: item.placeInfo ? { ...item.placeInfo } : { locationName: item.title },
    tags: Array.isArray(item.tags) ? [...item.tags] : [],
  };

  const placeInfo = clone.placeInfo!;

  // 蒐集卡片相關的所有全文文字
  const fullTextPieces = [
    item.title || '',
    item.summary || '',
    placeInfo.address || '',
    placeInfo.locationName || '',
    (item as any).rawCaption || '',
    ...(item.sources || []).map((s) => `${s.title || ''} ${s.summary || ''}`),
  ];
  const fullText = fullTextPieces.join(' ');

  // 1. 自動提取真實地址
  let extractedAddress = '';
  // 優先匹配「地址：...」模式
  const addressMatch = fullText.match(/(?:地址|店址|位址|住址)[：:\s]*([^\n，。；！？\(\)]+?[路街道路巷弄號樓層][\d\-號樓之\d]*)/);
  if (addressMatch && addressMatch[1]) {
    extractedAddress = addressMatch[1].trim();
  } else {
    // 匹配台灣縣市格式地址：如「嘉義市東區興業東路191號」
    const taiwanAddrMatch = fullText.match(/(?:(?:台灣|臺灣)?(?:嘉義|台北|新北|桃園|台中|台南|高雄|基隆|新竹|苗栗|彰化|南投|雲林|屏東|宜蘭|花蓮|台東|澎湖|金門|連江)[縣市]?[^\n，。；！？\(\)]+?[路街道路巷弄號樓層][\d\-號樓之\d]*)/);
    if (taiwanAddrMatch && taiwanAddrMatch[0]) {
      extractedAddress = taiwanAddrMatch[0].trim();
    }
  }

  if (extractedAddress) {
    // 若目前 address 為空，或是只有店名，或是原本過短，更新為真實地址
    if (!placeInfo.address || placeInfo.address === placeInfo.locationName || placeInfo.address === item.title || placeInfo.address.length < 5) {
      placeInfo.address = extractedAddress;
    }
    // 補齊 googleMapsQuery
    placeInfo.googleMapsQuery = `${placeInfo.locationName || item.title} ${placeInfo.address}`.trim();
  }

  // 2. 清理 summary 與 mustTryDishes 中的「地址：...」贅詞
  if (clone.summary) {
    clone.summary = clone.summary
      .replace(/(?:地址|店址|位址|住址)[：:\s]*[^\n。；！？]+[。；！？]?/g, '')
      .replace(/\s*Boundary:[^。]+[。]?/gi, '')
      .replace(/\s*freetext:[^。]+[。]?/gi, '')
      .trim();
  }

  if (placeInfo.mustTryDishes && Array.isArray(placeInfo.mustTryDishes)) {
    const cleanedDishes: string[] = [];
    for (const rawDish of placeInfo.mustTryDishes) {
      let cleaned = rawDish
        .replace(/(?:地址|店址|位址|住址)[：:\s]*[^\n。；！？]+[。；！？]?/g, '')
        .replace(/\s*Boundary:[^。]+[。]?/gi, '')
        .replace(/\s*freetext:[^。]+[。]?/gi, '')
        .trim();

      // 如果是一整句長描述且包含菜名與價格（例如「嘉義臭豆腐 ($50)，口味與沾醬整體偏清淡。」），
      // 提取核心菜色名稱（例如「嘉義臭豆腐 ($50)」或「嘉義臭豆腐」）
      if (cleaned.length > 25 && cleaned.includes('，')) {
        const firstSegment = cleaned.split(/[，,]/)[0].trim();
        if (firstSegment.length >= 2 && firstSegment.length <= 25) {
          cleaned = firstSegment;
        }
      }

      if (cleaned && cleaned.length >= 2) {
        cleanedDishes.push(cleaned);
      }
    }
    placeInfo.mustTryDishes = cleanedDishes;
  } else {
    placeInfo.mustTryDishes = [];
  }

  // 3. 透過 resolvePlaceHierarchy 進行全方位行政區與鄉鎮智慧解析
  const hierarchy = resolvePlaceHierarchy({
    placeInfo,
    title: item.title,
    tags: clone.tags,
    summary: clone.summary,
  });

  if (hierarchy.city) {
    placeInfo.city = hierarchy.city;
  }
  if (hierarchy.district) {
    placeInfo.district = hierarchy.district;
  }

  // 4. 強制根據全文校正城市與標籤 (移除錯填的台北預設值，標註正確城市)
  if (fullText.includes('嘉義') || (placeInfo.address && placeInfo.address.includes('嘉義'))) {
    placeInfo.city = '嘉義';
    clone.tags = Array.from(new Set(
      clone.tags
        .filter((t) => t !== '台北' && t !== '臺北' && t !== '#台北' && t !== '#臺北')
        .concat(['嘉義'])
    ));
  } else if (placeInfo.city) {
    const canonicalCity = normalizeCityName(placeInfo.city);
    placeInfo.city = canonicalCity;
    if (canonicalCity !== '臺北') {
      clone.tags = clone.tags.filter((t) => t !== '台北' && t !== '臺北' && t !== '#台北' && t !== '#臺北');
    }
    if (!clone.tags.includes(canonicalCity)) {
      clone.tags.push(canonicalCity);
    }
  } else if ((placeInfo.city === '台北' || placeInfo.city === '臺北') && !fullText.includes('台北') && !fullText.includes('臺北') && !fullText.includes('Taipei')) {
    placeInfo.city = '';
    clone.tags = clone.tags.filter((t) => t !== '台北' && t !== '臺北' && t !== '#台北' && t !== '#臺北');
  }

  return clone;
}

/**
 * 結構保底正規化函式 (normalizeItem)：
 * 在資料讀取與儲存源頭強制補齊所有陣列欄位的預設值 []，徹底消滅 undefined.map / .filter / .some 崩潰
 */
export function normalizeItem<T extends ParsedItem>(raw: T): T {
  if (!raw || typeof raw !== 'object') return raw;

  const item: any = {
    ...raw,
    title: typeof raw.title === 'string' ? raw.title : '未命名收藏',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    url: typeof raw.url === 'string' ? raw.url : '',
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string') : [],
    customTags: Array.isArray(raw.customTags)
      ? raw.customTags.filter((t) => typeof t === 'string')
      : [],
    sources: Array.isArray(raw.sources) ? raw.sources.filter(Boolean) : [],
    subPlaces: Array.isArray(raw.subPlaces)
      ? raw.subPlaces.filter(Boolean).map((sp: any) => ({
          ...sp,
          mustTryDishes: Array.isArray(sp?.mustTryDishes) ? sp.mustTryDishes : [],
        }))
      : [],
    subProducts: Array.isArray(raw.subProducts)
      ? raw.subProducts.filter(Boolean).map((sp: any) => ({
          ...sp,
          specs: Array.isArray(sp?.specs) ? sp.specs : [],
          pros: Array.isArray(sp?.pros) ? sp.pros : [],
          cons: Array.isArray(sp?.cons) ? sp.cons : [],
        }))
      : [],
  };

  if (item.recipeInfo && typeof item.recipeInfo === 'object') {
    item.recipeInfo = {
      ...item.recipeInfo,
      ingredients: Array.isArray(item.recipeInfo.ingredients)
        ? item.recipeInfo.ingredients.filter(Boolean).map((ing: any) => ({
            ...ing,
            name: typeof ing?.name === 'string' ? ing.name : String(ing?.name ?? ''),
          }))
        : [],
      steps: Array.isArray(item.recipeInfo.steps)
        ? item.recipeInfo.steps.filter((s: any) => typeof s === 'string')
        : [],
    };
  } else if (item.category === 'recipe') {
    item.recipeInfo = {
      ingredients: [],
      steps: [],
    };
  }

  if (item.placeInfo && typeof item.placeInfo === 'object') {
    item.placeInfo = {
      ...item.placeInfo,
      mustTryDishes: Array.isArray(item.placeInfo.mustTryDishes)
        ? item.placeInfo.mustTryDishes.filter((d: any) => typeof d === 'string')
        : [],
      reviewsSummary: Array.isArray(item.placeInfo.reviewsSummary)
        ? item.placeInfo.reviewsSummary.filter((r: any) => typeof r === 'string')
        : [],
    };
  } else if (item.category === 'place') {
    item.placeInfo = {
      locationName: item.title,
      mustTryDishes: [],
      reviewsSummary: [],
    };
  }

  if (typeof item.thumbnailUrl === 'string' && item.thumbnailUrl.startsWith('/posters/')) {
    item.thumbnailUrl = `/memo${item.thumbnailUrl}`;
  }

  if (item.mediaInfo && typeof item.mediaInfo === 'object') {
    const rawPoster = item.mediaInfo.posterUrl;
    const normalizedPoster =
      typeof rawPoster === 'string' && rawPoster.startsWith('/posters/')
        ? `/memo${rawPoster}`
        : rawPoster;
    item.mediaInfo = {
      ...item.mediaInfo,
      posterUrl: normalizedPoster,
      genres: Array.isArray(item.mediaInfo.genres)
        ? item.mediaInfo.genres.filter((g: any) => typeof g === 'string')
        : [],
      streamingPlatforms: Array.isArray(item.mediaInfo.streamingPlatforms)
        ? item.mediaInfo.streamingPlatforms.filter(Boolean)
        : [],
      youtubeReviews: Array.isArray(item.mediaInfo.youtubeReviews)
        ? item.mediaInfo.youtubeReviews.filter(Boolean)
        : [],
      theaters: Array.isArray((item.mediaInfo as any).theaters)
        ? (item.mediaInfo as any).theaters.filter(Boolean)
        : [],
    };
  } else if (item.category === 'media') {
    item.mediaInfo = {
      genres: [],
      streamingPlatforms: [],
      youtubeReviews: [],
      theaters: [],
    };
  }

  if (item.productInfo && typeof item.productInfo === 'object') {
    item.productInfo = {
      ...item.productInfo,
      specs: Array.isArray(item.productInfo.specs)
        ? item.productInfo.specs.filter((s: any) => typeof s === 'string')
        : [],
      pros: Array.isArray(item.productInfo.pros)
        ? item.productInfo.pros.filter((p: any) => typeof p === 'string')
        : [],
      cons: Array.isArray(item.productInfo.cons)
        ? item.productInfo.cons.filter((c: any) => typeof c === 'string')
        : [],
    };
  } else if (item.category === 'product') {
    item.productInfo = {
      specs: [],
      pros: [],
      cons: [],
    };
  }

  if (item.shoppingPlan && typeof item.shoppingPlan === 'object') {
    item.shoppingPlan = {
      ...item.shoppingPlan,
      recommendedStores: Array.isArray(item.shoppingPlan.recommendedStores)
        ? item.shoppingPlan.recommendedStores
        : [],
      items: Array.isArray(item.shoppingPlan.items) ? item.shoppingPlan.items : [],
    };
  }

  return item as T;
}

/**
 * 清洗並正規化單一 ParsedItem 中的地名、地址與所有巢狀陣列欄位
 */
export function normalizeItemLocations<T extends ParsedItem>(item: T): T {
  if (!item) return item;

  const safeBase = normalizeItem(item);

  // 優先經過 fixPlaceMetadata 深層校正
  let clone = safeBase.category === 'place' ? fixPlaceMetadata(safeBase) : { ...safeBase };

  if (clone.category === 'place' || clone.placeInfo) {
    const hierarchy = resolvePlaceHierarchy({
      placeInfo: clone.placeInfo,
      title: clone.title,
      tags: clone.tags,
      summary: clone.summary,
    });

    if (clone.placeInfo) {
      clone.placeInfo = {
        ...clone.placeInfo,
        city: hierarchy.city || normalizeCityName(clone.placeInfo.city),
        district: hierarchy.district || clone.placeInfo.district,
        mustTryDishes: Array.isArray(clone.placeInfo.mustTryDishes)
          ? clone.placeInfo.mustTryDishes
          : [],
        reviewsSummary: Array.isArray(clone.placeInfo.reviewsSummary)
          ? clone.placeInfo.reviewsSummary
          : [],
      };
    } else if (hierarchy.city) {
      clone.placeInfo = {
        city: hierarchy.city,
        district: hierarchy.district,
        mustTryDishes: [],
        reviewsSummary: [],
      };
    }

    // 清洗 tags 中的縣市名稱（例如將 '嘉義市' 或 '嘉義縣' 統一替換為 '嘉義'）
    if (Array.isArray(clone.tags)) {
      clone.tags = Array.from(
        new Set(
          clone.tags.map((tag) => {
            const normTag = normalizeCityName(tag);
            return CITY_MAPPINGS.some((m) => m.normalized === normTag) ? normTag : tag;
          })
        )
      );
    }

    // 清洗 subPlaces 裡面的 city 與 district
    if (Array.isArray(clone.subPlaces)) {
      clone.subPlaces = clone.subPlaces.map((sp) => {
        const spHierarchy = resolvePlaceHierarchy({
          placeInfo: {
            city: sp.city,
            district: sp.district,
            address: sp.address,
            locationName: sp.name || sp.shopName,
          },
          title: sp.name || sp.shopName,
          summary: sp.highlight || sp.summary,
        });
        return {
          ...sp,
          city: spHierarchy.city || normalizeCityName(sp.city) || sp.city,
          district: spHierarchy.district || sp.district,
          mustTryDishes: Array.isArray(sp.mustTryDishes) ? sp.mustTryDishes : [],
        };
      });
    }
  }

  return normalizeItem(clone);
}
