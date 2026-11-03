export type Category = 'place' | 'recipe' | 'media' | 'general' | 'account' | 'product';

export interface AccountInfo {
  platform?: 'instagram' | 'youtube' | 'threads' | 'twitter' | 'tiktok' | 'other';
  handle?: string;
  avatarUrl?: string;
  bio?: string;
  followerCount?: string;
  profileUrl?: string;
}

export interface PlaceInfo {
  locationName?: string;
  address?: string;
  city?: string;
  district?: string; // 鄉鎮市區（例如：民雄、恆春、萬里、大安區、信義區）
  googleMapsQuery?: string;
  lat?: number;
  lng?: number;
  rating?: string;
  mustTryDishes?: string[];
  reviewsSummary?: string[];
  smartTags?: string[]; // 1~2 個由 AI 自由精準判斷之專屬店鋪型態標籤（含 Emoji，例如：🥖 潛艇堡/三明治、🥟 中式早點、🧸 玩具模型）
}

export interface RecipeIngredient {
  name: string;
  amount: number | string;
  unit?: string;
  category?: string;
}

export interface RecipeTags {
  cuisine?: string;         // 如：日式、美式、義式、台式、韓式、法式、東南亞
  ingredientsType?: string; // 如：牛肉、豬肉、雞肉、海鮮、蔬食、蛋料理
  mealType?: string;        // 如：主食、湯品、甜點、飲料、小吃/點心、常備菜
}

export interface RecipeNutrition {
  calories?: string; // 單人份熱量 (例: "480 kcal")
  protein?: string;  // 蛋白質 (例: "28 g")
  carbs?: string;    // 碳水化合物 (例: "42 g")
  fat?: string;      // 脂肪 (例: "18 g")
}

export interface RecipeInfo {
  baseServings?: number;
  servings?: string;
  prepTime?: string;
  ingredients?: RecipeIngredient[];
  steps?: string[];
  recipeTags?: RecipeTags | null;
  nutrition?: RecipeNutrition | null;
}

export interface StreamingPlatformLink {
  name: string; // 'Netflix' | 'Disney+' | 'Apple TV' | 'Prime Video' | 'Catchplay+' | 'YouTube' | string;
  url: string;
  isAvailable?: boolean;
}

export interface MovieYoutubeReview {
  videoId: string;
  title: string;
  channelName?: string;
  thumbnail?: string;
  url: string;
}

export interface MediaInfo {
  creator?: string; // 影評創作者 / 頻道名稱
  releaseYear?: string; // 上映年份
  releaseDate?: string; // 具體首映日期 (例如: "2019-11-01")
  genre?: string; // 類型（例如：科幻 / 犯罪驚悚 / 劇情）
  genres?: string[]; // 類型陣列（例如：["科幻", "懸疑", "劇情"]）
  movieTitle?: string; // 台灣官方繁體中文片名（例如：小丑：雙重瘋狂、星際效應、逃出鯨吞）
  originalTitle?: string; // 原文/英文片名（例如：Interstellar、Whalefall）
  director?: string; // 導演
  rating?: string; // 影評結論或推薦度
  posterUrl?: string; // IMDb 官方電影 One-Sheet (27:40) 高清海報
  isMovie?: boolean; // 是否為電影/影集評論
  imdbId?: string; // IMDb 唯一識別碼 (例如: "tt0816692")
  imdbRating?: string; // IMDb 官方真實評分 (例如: "8.7")
  imdbRatingCount?: string; // IMDb 評分人數 (例如: "2,100,000")
  themeColor?: string; // 電影主視覺代表色 Hex (例如: "#C84B31")
  plotSynopsis?: string; // 電影官方故事大綱 / 劇情簡介
  streamingPlatforms?: StreamingPlatformLink[]; // 串流平台直達連結陣列
  youtubeReviews?: MovieYoutubeReview[]; // 自動搜尋到的 YouTube 熱門影評與解析
}

export type ItemAspectRatio = '9:16' | '16:9' | '27:40' | '4:3' | '4:5' | '1:1';

export interface TheaterShowtime {
  name: string; // "🎪 嘉義嘉年華影城" | "🍿 嘉義 in89 豪華影城"
  hasShowtimes: boolean;
  times: string[]; // 例如 ["13:20", "16:10", "19:00", "21:40"]
  hallInfo?: string; // 例如 "數位 2D" 或 "LUXE 旗艦巨幕"
  bookingUrl?: string; // 快速訂票網址
  timetableUrl?: string; // 官方即時時刻表網址
  note?: string;
}

export interface HotMovieItem {
  title: string;
  theaterName: string;
  times: string[];
  hallInfo?: string;
  posterUrl?: string;
}

export interface StreamingPlatformInfo {
  name: 'Netflix' | 'Disney+' | 'HBO';
  isAvailable: boolean;
  watchUrl: string;
}

export interface MovieShowtimeResponse {
  success: boolean;
  movieTitle: string;
  status: '上映中' | '即將上映' | '已下檔 / 串流熱播' | '未查詢到檔期';
  streamingPlatforms?: string[]; // 例如 ["Netflix", "Disney+", "Apple TV"]
  streamingDetails?: StreamingPlatformInfo[]; // 3 大串流平台專屬比對與直達連結
  theaters: TheaterShowtime[];
  todayChiayiHotMovies?: HotMovieItem[]; // 今日嘉義嘉年華 & in89 實際熱映中的電影與場次一覽
  updatedAt: string;
  error?: string;
}

export interface ShoppingItem {
  name: string;
  category: string; // '生鮮食材' | '乾貨調味' | '日用百貨' | '裝備' | string
  store: string; // '大潤發' | 'Costco 好市多' | '全聯福利中心' | '家樂福' | 'IKEA' | '大創' | string
  spec?: string; // 例如 '500g / 盒' 或 '好市多 2入組'
  estimatedPrice: number; // 預估售價 NT$
  inStock?: boolean; // 是否為自訂倉儲或家中現貨
}

export interface ShoppingPlan {
  recommendedStores: string[];
  totalEstimatedCost: number;
  savingTips?: string;
  items: ShoppingItem[];
}

export interface SourcePost {
  id: string;             // 來源唯一 ID
  url: string;            // 原始貼文/影片連結
  title: string;          // 該篇貼文原本的標題或影評標題
  summary: string;        // 該篇貼文的獨立重點摘要（例如該影評的觀點、該食記推薦的必點菜色）
  thumbnailUrl?: string;  // 該篇影片原始縮圖 (YouTube 16:9 或 Shorts 9:16)
  author?: string;        // 創作者/頻道名稱
  addedAt: string;        // 收錄時間戳記 (例如 '2026-10-18 03:00')
  aspectRatio?: ItemAspectRatio; // 該來源影片的長寬比 ('16:9' | '9:16')
}

export interface ProductInfo {
  brand?: string;            // 品牌與精確型號名稱 (例: Apple iPhone 16 Pro, Sony WH-1000XM5)
  priceRange?: string;       // 參考售價區間 (例: NT$ 36,900 ~ 40,400)
  specs?: string[];          // 關鍵規格亮點陣列（條列式）
  pros?: string[];           // 推薦入手原因
  cons?: string[];           // 注意事項或缺點
  officialImageUrl?: string; // 官方產品去背/宣傳首圖
}

export interface SubPlaceItem {
  name: string;
  shopName?: string;
  city?: string;
  district?: string; // 鄉鎮市區（例如：民雄、恆春、萬里、大安區、信義區）
  address?: string;
  highlight?: string;
  summary?: string;
  googleMapsQuery?: string;
  mustTryDishes?: string[];
  rating?: string;
  smartTags?: string[]; // 1~2 個由 AI 自由精準判斷之專屬店鋪型態標籤（含 Emoji）
}

export interface SubProductItem {
  name: string;
  brand?: string;
  price?: string;
  highlight?: string;
}

export interface ParsedItem {
  id: string;
  url: string;
  category: Category;
  title: string;
  originalVideoTitle?: string; // 原始合集影片/貼文標題（供主頁卡片折疊展示）
  summary: string;
  tags: string[];
  placeInfo?: PlaceInfo | null;
  recipeInfo?: RecipeInfo | null;
  recipeTags?: RecipeTags | null;
  mediaInfo?: MediaInfo | null;
  productInfo?: ProductInfo | null; // 3C生活好物與電子裝備結構化規格
  accountInfo?: AccountInfo | null; // 推薦帳號與創作者資料
  shoppingPlan?: ShoppingPlan | null;
  thumbnailUrl?: string | null;
  isFavorite?: boolean; // ⭐ 常用菜譜 / 最愛置頂
  isCompleted?: boolean; // ✅ 已完成狀態（已去過 / 已煮過 / 已看過）
  userNote?: string; // 📝 使用者私人評價筆記
  subPlaces?: SubPlaceItem[]; // 單支合集影片拆解出的多個推薦地點
  subProducts?: SubProductItem[]; // 單支合集影片拆解出的多樣推薦商品
  customTags?: string[]; // 使用者自訂風格標籤 (如 ["🇯🇵 日式", "⚡ 快手菜"])
  scrapeSources?: string[];
  needsManualSupplement?: boolean;
  createdAt: number;
  sources?: SourcePost[]; // 合併進此主卡的所有來源貼文清單
  aspectRatio?: ItemAspectRatio; // 外層卡片長寬比 ('27:40' | '16:9' | '9:16')
}

export type SavedItem = ParsedItem;

export interface AskQueryRequest {
  query: string;
  items: Array<{
    id: string;
    title: string;
    category: Category;
    summary: string;
    tags: string[];
    placeInfo?: PlaceInfo | null;
    recipeInfo?: RecipeInfo | null;
    shoppingPlan?: ShoppingPlan | null;
  }>;
}

export interface AskQueryResponse {
  success: boolean;
  answer?: string;
  reasoning?: string;
  matchedItemIds?: string[];
  suggestedFollowUps?: string[];
  error?: string;
}

export interface MovieCandidateItem {
  imdbId?: string;
  tmdbId?: string | number;
  title: string;
  originalTitle?: string;
  releaseYear?: string;
  posterUrl?: string;
  director?: string;
  cast?: string;
  overview?: string;
  source: string;
}

export interface ParseRequestBody {
  url?: string;
  imageBase64?: string;
  extraContent?: string;
  candidate?: MovieCandidateItem;
}

export interface ParseResponse {
  success: boolean;
  data?: ParsedItem;
  error?: string;
  sources?: string[];
}

export type TransportMode = 'driving' | 'two-wheeler' | 'transit' | 'walking';

export interface ItineraryStop {
  timeSlot: string;            // 例如「10:00 - 11:30」
  placeId?: string;            // 對應原資料庫地點 ID
  placeName: string;           // 地點名稱
  whatToDo?: string;           // 必吃必點招牌菜、拍照亮點與具體體驗
  activity?: string;           // 體驗內容
  stayDuration?: string;       // 建議停留時間，例如「90 分鐘」
  transitToNext?: string;      // 到下一站的交通指示（公車/捷運/機車路程/停車）
  transitSuggestion?: string;  // 交通銜接建議
  parkingInfo?: string;        // 🅿️ 附近停車場建議（開車/騎車）
  parkingName?: string;        // 🅿️ 推薦停車場名稱（如「嘟嘟房文昌站」、「府前地下停車場」）
  parkingNote?: string;        // 停車注意事項（收費、車位多寡、是否需提早進場）
  parkingMapUrl?: string;     // Google Maps 搜尋停車場超連結
  placeMapUrl?: string;       // Google Maps 導航/搜尋店家超連結
  transitDetail?: string;      // 🚆 大眾運輸搭乘方式（公車/捷運路線、上下車站點、步行時間）
  tips?: string;               // 避開人潮或預約排隊小撇步
  address?: string;            // 地址
  lat?: number;
  lng?: number;
  thumbnailUrl?: string;       // 地點封面縮圖
}

export interface ItineraryPlan {
  title: string;
  city?: string;
  dayOverview: string;
  transportMode?: TransportMode;
  departureTime?: string;      // 出發時間，例如「10:00」
  stops: ItineraryStop[];
}

export interface ItineraryResponse {
  success: boolean;
  data?: ItineraryPlan;
  error?: string;
}

// 模組 4：AI 私廚從收藏庫推薦今日菜單
export interface RecipePairing {
  recipeId: string;
  recipeTitle: string;
  role: string; // '主菜' | '配菜' | '湯品/甜點' | '主食'
  reason: string;
}

export interface AggregatedIngredient {
  name: string;
  category: string;
  totalAmount: number;
  unit: string;
  requiredAmountText: string;
  sourceRecipes: string[];
  isPantryStaple: boolean;
}

export interface RecipeSuggestion {
  menuTitle: string;
  chefReasoning: string;
  sharedIngredientsHighlight: string[];
  estimatedPrepTime: string;
  pairings: RecipePairing[];
  targetServings?: number;
  shoppingItems?: AggregatedIngredient[];
  recipeTitles?: string[];
}

export interface ShoppingNoteData extends Partial<RecipeSuggestion> {
  targetServings?: number;
  recipeTitles?: string[];
  shoppingItems?: AggregatedIngredient[];
  excludedNames?: string[];
}

export interface RecipeSuggestionResponse {
  success: boolean;
  data?: RecipeSuggestion;
  error?: string;
}

// 模組 5：勾選菜色後 ➔ 選擇賣場（含大潤發）➔ 即時爬蟲查價與雙重結算
export type TargetStoreId = 'rt-mart' | 'carrefour' | 'px-mart' | 'costco';

export interface CalculatedShoppingItem {
  id: string;
  ingredientName: string;
  category: string; // '生鮮肉品' | '海鮮水產' | '蔬菜水果' | '蛋奶豆製品' | '乾貨調味' | '其他'
  requiredAmount: number;
  requiredUnit: string;
  requiredAmountText: string; // 例如 '150g'
  storeName: string; // 例如 '大潤發'
  productName: string; // 賣場實際販售最小可買包裝名稱，例如 '安佳無鹽奶油 454g/條'
  packageSpec: string; // 例如 '454g / 條'
  retailPrice: number; // 賣場包裝結帳售價 NT$ (例如 185)
  usageRatio: number; // 本次料理耗用佔包裝比例 (0 ~ 1，例如 0.33)
  actualDishCost: number; // 本次料理實際耗用成本 NT$ (例如 61)
  sourceRecipes: string[]; // 使用到此食材的料理名稱
  isPantryStaple?: boolean; // 是否為常備調味料（如鹽巴、醬油、食用油）
  inStock?: boolean; // 是否家中已有 / 倉儲現貨（打勾後從結帳總額扣除）
}

export interface ShoppingCalculationResult {
  targetStoreId: TargetStoreId;
  targetStoreName: string;
  targetServings: number;
  selectedRecipeIds: string[];
  selectedRecipeTitles: string[];
  outOfPocketTotal: number; // 🏪 賣場收銀台結帳總金額
  actualDishCostTotal: number; // 🍲 本次料理實際耗用總成本
  costPerPerson: number; // 平均每人耗用成本
  savingTips: string;
  liveScrapedCount: number;
  items: CalculatedShoppingItem[];
}

export interface ShoppingCalculateResponse {
  success: boolean;
  data?: ShoppingCalculationResult;
  error?: string;
}

// 模組 6：📓 AI 背景思考記事本系統 (AI Notebook)
export type AINoteStatus = 'thinking' | 'ready' | 'failed';
export type AINoteType = 'itinerary' | 'shopping' | 'menu';

export interface AINoteItem {
  id: string;
  type: AINoteType;                    // 行程規劃 或 今日食材採買清單/私廚推薦
  status: AINoteStatus;
  title: string;                       // 例如：「🛵 嘉義半日順路行程 (4個點)」或「🔥 川味熱炒雙享今日菜單」
  requestParams?: Record<string, any>; // 交通方式、出發時間、人數、口味偏好等設定
  resultData?: any;                    // AI 思考完成後的結構化結果（ItineraryPlan 或 RecipeSuggestion）
  markdownNote?: string;               // 整理好可直接閱讀或複製到備忘錄的完整筆記排版
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface AINotebookResponse {
  success: boolean;
  notes?: AINoteItem[];
  note?: AINoteItem;
  error?: string;
}
