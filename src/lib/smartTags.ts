/**
 * 全站系統自動檢測智慧標籤 (Smart Tags) 引擎
 * 支援景點、好物、帳號、影視隨筆與私廚食譜
 */

import { ParsedItem } from '@/types/item';
import { getRecipeSmartTags as getRecipeInternalTags } from './recipeUtils';

export interface SmartTagCategoryMeta {
  category: 'place' | 'product' | 'account' | 'media' | 'recipe';
  tags: string[];
}

/**
 * 景點與店家智慧標籤 (Dynamic Smart Store Tags) 引擎：
 * 1. 優先回傳後端 Gemini 自由精準判斷之專屬店鋪型態標籤 (placeInfo.smartTags)
 * 2. 次之回傳項目自身標籤中帶有 Emoji 的型態標籤
 * 3. Fallback：根據店家真實特徵動態推導精準店型標籤（如：潛艇堡/三明治、中式早點、老屋喫茶等）
 */
export function getPlaceSmartTags(item: Partial<ParsedItem>): string[] {
  if (!item) return [];

  // 1. 優先採用 AI 動態生成的專屬店鋪型態標籤
  if (
    item.placeInfo?.smartTags &&
    Array.isArray(item.placeInfo.smartTags) &&
    item.placeInfo.smartTags.length > 0
  ) {
    return item.placeInfo.smartTags
      .filter((t) => typeof t === 'string' && t.trim().length > 0)
      .map((t) => t.trim());
  }

  // 2. 次之：若 item.tags 中已有帶有 Emoji 的型態標籤
  const emojiTags = (item.tags || []).filter(
    (t) => typeof t === 'string' && /[\p{Extended_Pictographic}]/u.test(t)
  );
  if (emojiTags.length > 0) {
    return emojiTags.map((t) => t.trim());
  }

  // 3. Fallback: 根據店家真實營業性質與招牌菜色動態推導精準店型標籤
  return inferDynamicPlaceTags(item);
}

/**
 * 當尚未由 AI 指派 smartTags 時的精確動態推導保底函式
 */
export function inferDynamicPlaceTags(item: Partial<ParsedItem>): string[] {
  const title = (item.title || '').toLowerCase();
  const summary = (item.summary || '').toLowerCase();
  const tagsStr = (item.tags || []).join(' ').toLowerCase();
  const placeName = (item.placeInfo?.locationName || '').toLowerCase();
  const address = (item.placeInfo?.address || '').toLowerCase();
  const dishes = (item.placeInfo?.mustTryDishes || []).join(' ').toLowerCase();
  const reviews = (item.placeInfo?.reviewsSummary || []).join(' ').toLowerCase();

  const allText = `${title} ${summary} ${tagsStr} ${placeName} ${address} ${dishes} ${reviews}`;
  const matched = new Set<string>();

  // 潛艇堡 / 三明治專賣
  if (/三明治|潛艇堡|sandwich|魯本|脆皮豬|肉排吐司/.test(allText) && !/德州燒烤|柴火低溫|慢燻/.test(allText)) {
    matched.add('🥖 潛艇堡/三明治');
  }

  // 中式早點 / 豆漿
  if (/豆漿|油條|燒餅|中式早餐|早點|萬里豆漿伯/.test(allText)) {
    matched.add('🥟 中式早點');
  }

  // 巨無霸飯糰
  if (/飯糰|控肉飯糰/.test(allText)) {
    matched.add('🍙 巨無霸飯糰');
  }

  // 鐵板燒
  if (/鐵板燒|teppanyaki/.test(allText)) {
    matched.add('🍳 鐵板燒');
  }

  // 美式德州燒烤
  if (/德州燒烤|慢燻|柴火低溫|牛胸肉漢堡|bbq/.test(allText)) {
    matched.add('🥩 美式德州燒烤');
  }

  // 街頭漢堡
  if (/漢堡|burger/.test(allText) && !matched.has('🥩 美式德州燒烤') && !matched.has('🍳 鐵板燒')) {
    matched.add('🍔 街頭風味漢堡');
  }

  // 沖繩美式塔可（必須明確提及塔可或 taco，不因一般莎莎醬誤判）
  if (/塔可|taco/.test(allText)) {
    matched.add('🌮 沖繩美式塔可');
  }

  // 法式可麗餅
  if (/可麗餅|法式可麗餅|crêpe/.test(allText)) {
    matched.add('🥞 法式可麗餅甜點');
  }

  // 泡芙 / 甜點烘焙
  if (/泡芙|乳凍蛋糕|生乳捲|可麗露|司康|肉桂捲|甜點店|烘焙坊/.test(allText) && !matched.has('🥞 法式可麗餅甜點')) {
    matched.add('🍰 泡芙/甜點烘焙');
  }

  // 炭火鱔魚意麵
  if (/鱔魚|鱔魚麵|炒鱔魚/.test(allText)) {
    matched.add('🍜 炭火鱔魚意麵');
  }

  // 傳統小吃
  if (/臭豆腐|火雞肉飯|滷肉飯|傳統小吃|小吃店/.test(allText) && !matched.has('🍜 炭火鱔魚意麵')) {
    matched.add('🍜 傳統小吃');
  }

  // 古早味炭烤
  if (/烤玉米|炭烤玉米|碳烤/.test(allText)) {
    matched.add('🌽 古早味炭烤');
  }

  // 鮮果手搖茶飲
  if (/手搖|葡萄柚綠茶|御香屋|鮮果茶|茶飲/.test(allText)) {
    matched.add('🧋 鮮果手搖茶飲');
  }

  // 昭和風喫茶咖啡
  if (/昭和風|喫茶|昭和|惜物製菓/.test(allText)) {
    matched.add('☕ 昭和風喫茶咖啡');
  }

  // 黑膠咖啡館
  if (/黑膠|黑膠唱片|曙光珈啡/.test(allText)) {
    matched.add('☕ 黑膠唱片咖啡館');
  }

  // 異國景觀咖啡廳
  if (/烏克蘭料理|景觀咖啡|說說咖啡|lumi|荷蘭小鬆餅|墾丁坑內路/.test(allText)) {
    matched.add('☕ 異國景觀咖啡廳');
  }

  // 一般咖啡館
  if (
    /咖啡|cafe|coffee|手沖|烘豆|拿鐵/.test(allText) &&
    !matched.has('☕ 昭和風喫茶咖啡') &&
    !matched.has('☕ 黑膠唱片咖啡館') &&
    !matched.has('☕ 異國景觀咖啡廳')
  ) {
    matched.add('☕ 獨立咖啡館');
  }

  // 印度料理 / 烤餅
  if (/印度料理|印度餐廳|印度烤餅|香料咖哩/.test(allText)) {
    matched.add('🍛 印度料理/烤餅');
  }

  // 青年旅館
  const isHotel = /青旅|睡覺盒子|背包客棧|hotel/.test(allText);
  if (isHotel) {
    matched.add('🏨 青年旅館/早餐');
  }

  // 港式料理（青年旅館純早餐供應港點不誤歸）
  if (/港式|港點|灌湯包|燒賣|小籠湯包/.test(allText) && !isHotel) {
    matched.add('🥟 港式點心/灌湯包');
  }

  // 韓式料理
  if (/韓式|韓料|燉雞|玫瑰奶油燉雞/.test(allText)) {
    matched.add('🥘 韓式燉雞/料理');
  }

  // 義式燉飯 / 排餐
  if (/燉飯|松露燉飯|義大利麵|pasta|risotto/.test(allText)) {
    matched.add('🍝 義式燉飯/排餐');
  }

  // 以色列 / 中東料理
  if (/以色列|鷹嘴豆泥|hummus/.test(allText)) {
    matched.add('🥙 以色列/中東料理');
  }

  // 深夜黑白切
  if (/崁仔頂|豬雜|深夜食堂.*魚市/.test(allText)) {
    matched.add('🌙 深夜黑白切/小吃');
  }

  // 深夜食堂 / 小料亭
  if (/一點散漫|小料亭|炙燒控肉飯/.test(allText)) {
    matched.add('🌙 深夜食堂/小料理');
  }

  // 復古古著店
  if (/古著|vintage|布吉公雞/.test(allText)) {
    matched.add('👕 復古古著店');
  }

  // 風格文具店
  if (/文具控|文具店|拾筆/.test(allText)) {
    matched.add('✒️ 風格文具店');
  }

  // 生活雜貨店
  if (/日系雜貨|生活雜貨|jxacces/.test(allText)) {
    matched.add('🏺 生活雜貨店');
  }

  // 日系女裝店
  if (/女裝店|日系女裝|小子/.test(allText)) {
    matched.add('👗 日系女裝店');
  }

  // 韓系選品
  if (/韓國風格|liliho|生活配件/.test(allText)) {
    matched.add('🛍️ 韓系風格選品');
  }

  // 溫馨手作小舖
  if (/宮崎駿|手作小舖|皓麻牌/.test(allText)) {
    matched.add('🧶 溫馨手作小舖');
  }

  // 復古生活選物
  if (
    /小獵犬商號|hunter goods|選物店|風格選品/.test(allText) &&
    !matched.has('✒️ 風格文具店') &&
    !matched.has('🏺 生活雜貨店') &&
    !matched.has('👕 復古古著店') &&
    !matched.has('🛍️ 韓系風格選品')
  ) {
    matched.add('🛍️ 復古生活選物');
  }

  // 老藥局 / 文化空間
  if (/七星藥局|藥局/.test(allText)) {
    matched.add('🏛️ 老藥局/文化空間');
  }

  // 復古相機店
  if (/ccd|底片相機|拍立得|喬影像/.test(allText)) {
    matched.add('📷 復古相機專賣店');
  }

  // 沉浸式模擬體驗館
  if (/模擬器|f16|熱氣球|戰鬥機駕駛/.test(allText)) {
    matched.add('🎮 沉浸式模擬體驗館');
  }

  // 青年旅館
  if (/青旅|睡覺盒子|背包客棧|hotel/.test(allText)) {
    matched.add('🏨 青年旅館/早餐');
  }

  if (matched.size === 0) {
    matched.add('📍 私房好店');
  }

  return Array.from(matched).slice(0, 2);
}

/**
 * 精選好物與推薦帳號智慧標籤自動檢測
 */
export function getProductSmartTags(item: Partial<ParsedItem>): string[] {
  const title = (item.title || '').toLowerCase();
  const summary = (item.summary || '').toLowerCase();
  const tagsStr = (item.tags || []).join(' ').toLowerCase();
  const brand = (item.productInfo?.brand || '').toLowerCase();
  const specs = (item.productInfo?.specs || []).join(' ').toLowerCase();
  const handle = (item.accountInfo?.handle || '').toLowerCase();
  const bio = (item.accountInfo?.bio || '').toLowerCase();

  const allText = `${title} ${summary} ${tagsStr} ${brand} ${specs} ${handle} ${bio}`;
  const matched = new Set<string>();

  // 推薦帳號
  if (item.category === 'account' || Boolean(item.accountInfo?.handle)) {
    matched.add('👤 靈感創作者');
  }

  // 1. 平板/筆電
  if (/ipad|平板|筆電|筆記型電腦|macbook|surface|平板電腦|touchpen|apple pencil/.test(allText)) {
    matched.add('📱 平板/筆電');
  }

  // 2. 3C數位 (若有平板/筆電或其他數位設備)
  if (/3c|數位|電腦|電競|科技|硬體|處理器|晶片|m2|m3|m4|m5|m6|intel|amd|cpu|gpu|mac mini|螢幕|擴充座|主機|桌面搭配/.test(allText)) {
    matched.add('💻 3C數位');
  }

  // 3. 音訊/耳機
  if (/耳機|降噪|藍牙耳機|聲學|音質|音響|喇叭|airpods|sony|bose|sennheiser|揚聲器|黑膠|擴大機|入耳式|頭戴式/.test(allText)) {
    matched.add('🎧 音訊/耳機');
  }

  // 4. 攝影器材
  if (/相機|單眼|微單|鏡頭|攝影|錄影|gopro|dji|穩定器|拍照|航拍|空拍機|insta360|富士|fujifilm|canon|nikon|sony alpha/.test(allText)) {
    matched.add('📷 攝影器材');
  }

  // 5. 質感居家
  if (/居家|家飾|香氛|燈具|桌子|椅子|沙發|收納|擺飾|衛浴|床寢|生活美學|ikea|辦公桌|升降桌|人體工學椅|擴香/.test(allText)) {
    matched.add('🏠 質感居家');
  }

  // 6. 穿搭服飾
  if (/穿搭|服飾|衣服|外套|t恤|襯衫|褲子|洋裝|裙子|品牌|ootd|古著|潮流|背心|羽絨|大衣|工裝/.test(allText)) {
    matched.add('👕 穿搭服飾');
  }

  // 7. 鞋履配件
  if (/鞋|球鞋|慢跑鞋|運動鞋|皮鞋|帆布鞋|包包|後背包|手錶|飾品|項鍊|戒指|帽子|墨鏡|皮夾|錢包|托特包|側背包/.test(allText)) {
    matched.add('👟 鞋履配件');
  }

  // 8. 保養香氛
  if (/保養|精華|乳液|香水|香氛|護膚|防曬|洗沐|洗髮|蠟燭|精油|化妝|美妝|面膜|淡香水|蠟燭/.test(allText)) {
    matched.add('🧴 保養香氛');
  }

  // 9. 廚房家電
  if (/廚房|家電|咖啡機|氣炸鍋|烤箱|果汁機|料理機|電鍋|冰箱|鍋具|不沾鍋|製冰機|洗碗機|保溫杯|水壺/.test(allText)) {
    matched.add('🍳 廚房家電');
  }

  return Array.from(matched);
}

/**
 * 影視隨筆智慧標籤自動檢測
 */
export function getMediaSmartTags(item: Partial<ParsedItem>): string[] {
  const title = (item.title || '').toLowerCase();
  const movieTitle = (item.mediaInfo?.movieTitle || '').toLowerCase();
  const summary = (item.summary || '').toLowerCase();
  const synopsis = (item.mediaInfo?.plotSynopsis || '').toLowerCase();
  const genre = (item.mediaInfo?.genre || '').toLowerCase();
  const genres = (item.mediaInfo?.genres || []).join(' ').toLowerCase();
  const tagsStr = (item.tags || []).join(' ').toLowerCase();

  const allText = `${title} ${movieTitle} ${summary} ${synopsis} ${genre} ${genres} ${tagsStr}`;
  const matched = new Set<string>();

  if (/科幻|太空|外星|宇宙|未來|ai|賽博龐克|sci-fi|時間旅行|星際/.test(allText)) {
    matched.add('科幻');
  }
  if (/懸疑|推理|驚悚|破案|偵探|燒腦|犯罪|兇手|反轉|謀殺|解謎|心理/.test(allText)) {
    matched.add('懸疑推理');
  }
  if (/動畫|動漫|劇場版|皮克斯|吉卜力|新海誠|迪士尼|anime|卡通/.test(allText)) {
    matched.add('動畫');
  }
  if (/劇情|溫馨|感人|人性|成長|文藝|傳記|寫實|家庭|愛情|浪漫/.test(allText)) {
    matched.add('劇情');
  }
  if (/喜劇|搞笑|幽默|歡樂|爆笑|喜劇片|逗趣/.test(allText)) {
    matched.add('喜劇');
  }
  if (/動作|冒險|特務|槍戰|動作片|武打|英雄|漫威|dc|格鬥|追逐/.test(allText)) {
    matched.add('動作');
  }
  if (/紀錄片|紀實|訪談|歷史|真實事件|探討/.test(allText)) {
    matched.add('紀錄片');
  }
  if (/影評|解析|彩蛋|講評|深度解析|劇情梳理|幕後|彩蛋解析|解析電影/.test(allText)) {
    matched.add('影評解析');
  }

  return Array.from(matched);
}

/**
 * 私房食譜智慧標籤自動檢測
 */
export function getRecipeSmartTags(item: Partial<ParsedItem>): string[] {
  const recipeTags = getRecipeInternalTags(item as ParsedItem);
  const list: string[] = [];
  if (recipeTags.cuisine) list.push(recipeTags.cuisine);
  if (recipeTags.ingredientsType) list.push(recipeTags.ingredientsType);
  if (recipeTags.mealType) list.push(recipeTags.mealType);
  return list;
}

/**
 * 全品類統一入口：自動檢測並回傳該項目專屬的智慧標籤陣列
 */
export function getItemSmartTags(item?: Partial<ParsedItem> | null): string[] {
  if (!item) return [];

  switch (item.category) {
    case 'place':
      return getPlaceSmartTags(item);
    case 'product':
    case 'account':
      return getProductSmartTags(item);
    case 'media':
      return getMediaSmartTags(item);
    case 'recipe':
      return getRecipeSmartTags(item);
    default: {
      // 通用類別嘗試探測
      const placeTags = getPlaceSmartTags(item);
      if (placeTags.length > 0) return placeTags;
      const productTags = getProductSmartTags(item);
      if (productTags.length > 0) return productTags;
      return [];
    }
  }
}

/**
 * 統一標籤擷取函式：
 * 同時提供給上方智慧標籤篩選列（統計各標籤數量）與下方 `.filter()` 過濾邏輯使用，
 * 整合 AI 智慧標籤 (placeInfo.smartTags / getItemSmartTags)、自訂標籤 (customTags) 與分類資訊，
 * 確保「產生篩選按鈕」與「點擊篩選過濾」100% 讀取同一套標籤來源。
 */
export function getItemAllTags(item?: Partial<ParsedItem> | null): string[] {
  if (!item) return [];

  const result = new Set<string>();

  // 1. 智慧標籤 (包含 placeInfo.smartTags、Emoji 型態標籤與動態推導標籤)
  const smartTags = getItemSmartTags(item);
  for (const t of smartTags) {
    if (typeof t === 'string' && t.trim()) {
      result.add(t.trim());
    }
  }

  // 2. 明確納入 placeInfo.smartTags（防止跨品類遺漏）
  if (Array.isArray(item.placeInfo?.smartTags)) {
    for (const t of item.placeInfo.smartTags) {
      if (typeof t === 'string' && t.trim()) {
        result.add(t.trim());
      }
    }
  }

  // 3. 使用者自訂標籤 (customTags)
  if (Array.isArray(item.customTags)) {
    for (const t of item.customTags) {
      if (typeof t === 'string' && t.trim()) {
        result.add(t.trim());
      }
    }
  }

  // 4. 若 placeInfo 帶有 category 字串且上述皆空時作為保底
  const placeCategory = (item.placeInfo as { category?: string } | undefined)?.category;
  if (result.size === 0 && typeof placeCategory === 'string' && placeCategory.trim()) {
    result.add(placeCategory.trim());
  }

  return Array.from(result);
}

