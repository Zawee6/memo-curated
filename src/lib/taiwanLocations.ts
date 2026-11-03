/**
 * 台灣縣市與鄉鎮市區智慧歸類字典
 * 提供完整的台灣行政區階層字典、熱門觀光地標別名，
 * 以及自動逆向推導縣市與統一「台 / 臺」異體字函式。
 */

import { PlaceInfo } from '@/types/item';

export interface LocationHierarchy {
  city: string;     // 縣市統稱，統一使用「臺」（如：臺北、新北、嘉義、屏東）
  district: string; // 鄉鎮市區（如：民雄、恆春、萬里、大安區、信義區）
}

export interface CityDistrictGroup {
  city: string;
  region: '北部' | '中部' | '南部' | '東部' | '離島' | '國外';
  districts: string[];
}

/**
 * 全台灣 22 縣市＋國外分區階層字典
 */
export const TAIWAN_LOCATION_HIERARCHY: CityDistrictGroup[] = [
  // 北部
  {
    city: '臺北',
    region: '北部',
    districts: [
      '大安區', '信義區', '中山區', '中正區', '松山區',
      '士林區', '北投區', '萬華區', '內湖區', '南港區',
      '文山區', '大同區', '西門町'
    ],
  },
  {
    city: '新北',
    region: '北部',
    districts: [
      '板橋區', '新莊區', '中和區', '永和區', '三重區',
      '新店區', '土城區', '蘆洲區', '汐止區', '樹林區',
      '淡水區', '鶯歌區', '三峽區', '五股區', '泰山區',
      '林口區', '八里區', '深坑區', '石碇區', '坪林區',
      '三芝區', '石門區', '金山區', '萬里區', '平溪區',
      '雙溪區', '貢寮區', '瑞芳區', '九份', '烏來區'
    ],
  },
  {
    city: '基隆',
    region: '北部',
    districts: [
      '仁愛區', '中正區', '信義區', '中山區', '安樂區', '暖暖區', '七堵區'
    ],
  },
  {
    city: '桃園',
    region: '北部',
    districts: [
      '桃園區', '中壢區', '平鎮區', '八德區', '楊梅區',
      '蘆竹區', '大溪區', '龜山區', '大園區', '觀音區',
      '新屋區', '龍潭區', '復興區'
    ],
  },
  {
    city: '新竹',
    region: '北部',
    districts: [
      '東區', '北區', '香山區', '竹北市', '竹東鎮',
      '新埔鎮', '關西鎮', '湖口鄉', '新豐鄉', '芎林鄉',
      '橫山鄉', '北埔鄉', '寶山鄉', '峨眉鄉', '尖石鄉', '五峰鄉'
    ],
  },
  {
    city: '宜蘭',
    region: '北部',
    districts: [
      '宜蘭市', '羅東鎮', '蘇澳鎮', '頭城鎮', '礁溪鄉',
      '壯圍鄉', '員山鄉', '冬山鄉', '五結鄉', '三星鄉',
      '大同鄉', '南澳鄉'
    ],
  },

  // 中部
  {
    city: '苗栗',
    region: '中部',
    districts: [
      '苗栗市', '頭份市', '竹南鎮', '後龍鎮', '通霄鎮',
      '苑裡鎮', '卓蘭鎮', '造橋鄉', '西湖鄉', '頭屋鄉',
      '公館鄉', '銅鑼鄉', '三義鄉', '大湖鄉', '獅潭鄉',
      '三灣鄉', '南庄鄉', '泰安鄉'
    ],
  },
  {
    city: '臺中',
    region: '中部',
    districts: [
      '西屯區', '北屯區', '南屯區', '西區', '北區',
      '中區', '南區', '東區', '豐原區', '大里區',
      '太平區', '清水區', '沙鹿區', '大甲區', '潭子區',
      '后里區', '烏日區', '神岡區', '大雅區', '東勢區',
      '霧峰區', '梧棲區', '新社區', '福壽山', '武陵',
      '梨山', '石岡區', '外埔區', '大安區', '和平區'
    ],
  },
  {
    city: '彰化',
    region: '中部',
    districts: [
      '彰化市', '鹿港鎮', '和美鎮', '線西鄉', '伸港鄉',
      '福興鄉', '秀水鄉', '花壇鄉', '芬園鄉', '員林市',
      '溪湖鎮', '田中鎮', '大村鄉', '埔鹽鄉', '埔心鄉',
      '永靖鄉', '社頭鄉', '二水鄉', '田尾鄉', '埤頭鄉',
      '芳苑鄉', '二林鎮', '大城鄉', '竹塘鄉', '溪州鄉'
    ],
  },
  {
    city: '南投',
    region: '中部',
    districts: [
      '南投市', '埔里鎮', '草屯鎮', '竹山鎮', '集集鎮',
      '名間鄉', '鹿谷鄉', '中寮鄉', '魚池鄉', '日月潭',
      '國姓鄉', '水里鄉', '信義鄉', '仁愛鄉', '清境'
    ],
  },
  {
    city: '雲林',
    region: '中部',
    districts: [
      '斗六市', '斗南鎮', '虎尾鎮', '西螺鎮', '土庫鎮',
      '北港鎮', '古坑鄉', '大埤鄉', '莿桐鄉', '林內鄉',
      '二崙鄉', '崙背鄉', '麥寮鄉', '東勢鄉', '褒忠鄉',
      '臺西鄉', '台西鄉', '元長鄉', '四湖鄉', '口湖鄉', '水林鄉'
    ],
  },

  // 南部
  {
    city: '嘉義',
    region: '南部',
    districts: [
      '東區', '西區', '民雄鄉', '阿里山鄉', '太保市',
      '朴子市', '水上鄉', '中埔鄉', '竹崎鄉', '梅山鄉',
      '大林鎮', '新港鄉', '六腳鄉', '東石鄉', '布袋鎮',
      '義竹鄉', '鹿草鄉', '溪口鄉', '番路鄉', '大埔鄉',
      '奮起湖'
    ],
  },
  {
    city: '臺南',
    region: '南部',
    districts: [
      '中西區', '東區', '南區', '北區', '安平區',
      '安南區', '永康區', '歸仁區', '新化區', '左鎮區',
      '玉井區', '楠西區', '南化區', '仁德區', '關廟區',
      '龍崎區', '官田區', '麻豆區', '佳里區', '西港區',
      '七股區', '將軍區', '北門區', '新營區', '後壁區',
      '白河區', '東山區', '六甲區', '下營區', '柳營區',
      '鹽水區', '善化區', '大內區', '山上區', '新市區',
      '安定區'
    ],
  },
  {
    city: '高雄',
    region: '南部',
    districts: [
      '苓雅區', '新興區', '前金區', '鹽埕區', '鼓山區',
      '旗津區', '前鎮區', '三民區', '楠梓區', '小港區',
      '左營區', '仁武區', '大社區', '岡山區', '路竹區',
      '阿蓮區', '田寮區', '燕巢區', '橋頭區', '梓官區',
      '彌陀區', '永安區', '湖內區', '鳳山區', '大寮區',
      '林園區', '鳥松區', '大樹區', '旗山區', '美濃區',
      '六龜區', '內門區', '杉林區', '甲仙區', '桃源區',
      '那瑪夏區', '茂林區', '茄萣區'
    ],
  },
  {
    city: '屏東',
    region: '南部',
    districts: [
      '屏東市', '恆春鎮', '墾丁', '東港鎮', '小琉球',
      '琉球鄉', '潮州鎮', '車城鄉', '滿州鄉', '萬巒鄉',
      '枋寮鄉', '內埔鄉', '佳冬鄉', '霧臺鄉', '瑪家鄉',
      '三地門鄉', '來義鄉', '春日鄉', '獅子鄉', '牡丹鄉',
      '泰武鄉', '高樹鄉', '里港鄉', '鹽埔鄉', '九如鄉',
      '長治鄉', '麟洛鄉', '竹田鄉', '新埤鄉', '崁頂鄉',
      '林邊鄉', '南州鄉', '枋山鄉'
    ],
  },

  // 東部
  {
    city: '花蓮',
    region: '東部',
    districts: [
      '花蓮市', '鳳林鎮', '玉里鎮', '新城鄉', '吉安鄉',
      '壽豐鄉', '光復鄉', '豐濱鄉', '瑞穗鄉', '富里鄉',
      '秀林鄉', '萬榮鄉', '卓溪鄉', '太魯閣'
    ],
  },
  {
    city: '臺東',
    region: '東部',
    districts: [
      '臺東市', '台東市', '成功鎮', '關山鎮', '卑南鄉',
      '鹿野鄉', '池上鄉', '東河鄉', '長濱鄉', '太麻里鄉',
      '大武鄉', '綠島鄉', '蘭嶼鄉', '延平鄉', '海端鄉',
      '達仁鄉', '金峰鄉'
    ],
  },

  // 離島
  {
    city: '澎湖',
    region: '離島',
    districts: ['馬公市', '湖西鄉', '白沙鄉', '西嶼鄉', '望安鄉', '七美鄉'],
  },
  {
    city: '金門',
    region: '離島',
    districts: ['金城鎮', '金湖鎮', '金沙鎮', '金寧鄉', '烈嶼鄉', '烏坵鄉'],
  },
  {
    city: '連江',
    region: '離島',
    districts: ['南竿鄉', '北竿鄉', '莒光鄉', '東引鄉', '馬祖'],
  },

  // 國外熱門
  {
    city: '日本',
    region: '國外',
    districts: ['東京', '大阪', '京都', '沖繩', '福岡', '北海道', '名古屋', '橫濱', '神戶', '奈良'],
  },
  {
    city: '國外',
    region: '國外',
    districts: ['韓國', '首爾', '釜山', '泰國', '曼谷', '清邁', '香港', '澳門', '新加坡', '越南', '歐美', '其他國外'],
  },
];

/**
 * 乾淨的鄉鎮市區名稱清洗函式：去除「市/區/鄉/鎮」尾綴，方便模糊比對
 * 例如：「民雄鄉」 -> 「民雄」，「大安區」 -> 「大安」，「東港鎮」 -> 「東港」
 */
export function cleanDistrictName(district: string): string {
  if (!district) return '';
  const trimmed = district.trim().replace(/^[•\-\s]+/, '');
  // 保留「臺東市」、「花蓮市」等若剛好是縣市同名，但若後面是區/鄉/鎮則去除
  return trimmed.replace(/(?:[鄉鎮市區])$/, '').trim() || trimmed;
}

/**
 * 具有唯一性、絕不重複的高辨識度鄉鎮與景點雜湊字典（鄉鎮名 -> 所屬縣市）
 * 例如：民雄 -> 嘉義，恆春 -> 屏東，九份 -> 新北，礁溪 -> 宜蘭，鹿港 -> 彰化
 */
const UNIQUE_DISTRICT_TO_CITY_MAP: Record<string, string> = {
  // 嘉義
  民雄: '嘉義', 民雄鄉: '嘉義',
  阿里山: '嘉義', 阿里山鄉: '嘉義',
  奮起湖: '嘉義',
  太保: '嘉義', 太保市: '嘉義',
  朴子: '嘉義', 朴子市: '嘉義',
  水上: '嘉義', 水上鄉: '嘉義',
  中埔: '嘉義', 中埔鄉: '嘉義',
  竹崎: '嘉義', 竹崎鄉: '嘉義',
  梅山: '嘉義', 梅山鄉: '嘉義',
  大林: '嘉義', 大林鎮: '嘉義',
  新港: '嘉義', 新港鄉: '嘉義',
  六腳: '嘉義', 六腳鄉: '嘉義',
  東石: '嘉義', 東石鄉: '嘉義',
  布袋: '嘉義', 布袋鎮: '嘉義',
  義竹: '嘉義', 義竹鄉: '嘉義',
  鹿草: '嘉義', 鹿草鄉: '嘉義',
  溪口: '嘉義', 溪口鄉: '嘉義',
  番路: '嘉義', 番路鄉: '嘉義',
  大埔: '嘉義', 大埔鄉: '嘉義',

  // 屏東
  恆春: '屏東', 恆春鎮: '屏東',
  墾丁: '屏東',
  小琉球: '屏東', 琉球鄉: '屏東',
  東港: '屏東', 東港鎮: '屏東',
  潮州: '屏東', 潮州鎮: '屏東',
  車城: '屏東', 車城鄉: '屏東',
  滿州: '屏東', 滿州鄉: '屏東',
  萬巒: '屏東', 萬巒鄉: '屏東',
  枋寮: '屏東', 枋寮鄉: '屏東',
  三地門: '屏東', 霧臺: '屏東', 瑪家: '屏東',
  枋山: '屏東', 枋山鄉: '屏東',

  // 新北
  萬里: '新北', 萬里區: '新北',
  淡水: '新北', 淡水區: '新北',
  九份: '新北',
  瑞芳: '新北', 瑞芳區: '新北',
  烏來: '新北', 烏來區: '新北',
  三峽: '新北', 三峽區: '新北',
  鶯歌: '新北', 鶯歌區: '新北',
  林口: '新北', 林口區: '新北',
  金山: '新北', 金山區: '新北',
  石門: '新北', 石門區: '新北',
  三芝: '新北', 三芝區: '新北',
  深坑: '新北', 深坑區: '新北',
  坪林: '新北', 坪林區: '新北',
  平溪: '新北', 平溪區: '新北',
  雙溪: '新北', 雙溪區: '新北',
  貢寮: '新北', 貢寮區: '新北',
  新莊: '新北', 新莊區: '新北',
  板橋: '新北', 板橋區: '新北',
  汐止: '新北', 汐止區: '新北',
  蘆洲: '新北', 蘆洲區: '新北',
  土城: '新北', 土城區: '新北',

  // 臺北
  西門町: '臺北',
  士林: '臺北', 士林區: '臺北',
  北投: '臺北', 北投區: '臺北',
  內湖: '臺北', 內湖區: '臺北',
  南港: '臺北', 南港區: '臺北',
  文山: '臺北', 文山區: '臺北',

  // 宜蘭
  礁溪: '宜蘭', 礁溪鄉: '宜蘭',
  羅東: '宜蘭', 羅東鎮: '宜蘭',
  頭城: '宜蘭', 頭城鎮: '宜蘭',
  蘇澳: '宜蘭', 蘇澳鎮: '宜蘭',
  冬山: '宜蘭', 冬山鄉: '宜蘭',
  五結: '宜蘭', 五結鄉: '宜蘭',
  三星: '宜蘭', 三星鄉: '宜蘭',

  // 彰化
  鹿港: '彰化', 鹿港鎮: '彰化',
  田尾: '彰化', 田尾鄉: '彰化',
  員林: '彰化', 員林市: '彰化',
  溪湖: '彰化', 溪湖鎮: '彰化',
  二林: '彰化', 二林鎮: '彰化',

  // 南投
  埔里: '南投', 埔里鎮: '南投',
  日月潭: '南投',
  清境: '南投',
  竹山: '南投', 竹山鎮: '南投',
  集集: '南投', 集集鎮: '南投',
  魚池: '南投', 魚池鄉: '南投',
  草屯: '南投', 草屯鎮: '南投',
  鹿谷: '南投', 鹿谷鄉: '南投',

  // 雲林
  斗六: '雲林', 斗六市: '雲林',
  虎尾: '雲林', 虎尾鎮: '雲林',
  西螺: '雲林', 西螺鎮: '雲林',
  北港: '雲林', 北港鎮: '雲林',
  古坑: '雲林', 古坑鄉: '雲林',
  麥寮: '雲林', 麥寮鄉: '雲林',

  // 臺南
  安平: '臺南', 安平區: '臺南',
  白河: '臺南', 白河區: '臺南',
  麻豆: '臺南', 麻豆區: '臺南',
  新營: '臺南', 新營區: '臺南',
  永康: '臺南', 永康區: '臺南',
  善化: '臺南', 善化區: '臺南',
  鹽水: '臺南', 鹽水區: '臺南',
  七股: '臺南', 七股區: '臺南',

  // 高雄
  旗山: '高雄', 旗山區: '高雄',
  美濃: '高雄', 美濃區: '高雄',
  六龜: '高雄', 六龜區: '高雄',
  岡山: '高雄', 岡山區: '高雄',
  鳳山: '高雄', 鳳山區: '高雄',
  左營: '高雄', 左營區: '高雄',
  楠梓: '高雄', 楠梓區: '高雄',
  旗津: '高雄', 旗津區: '高雄',

  // 花蓮
  太魯閣: '花蓮',
  吉安: '花蓮', 吉安鄉: '花蓮',
  壽豐: '花蓮', 壽豐鄉: '花蓮',
  瑞穗: '花蓮', 瑞穗鄉: '花蓮',
  玉里: '花蓮', 玉里鎮: '花蓮',

  // 臺東
  池上: '臺東', 池上鄉: '臺東',
  鹿野: '臺東', 鹿野鄉: '臺東',
  太麻里: '臺東', 太麻里鄉: '臺東',
  綠島: '臺東', 綠島鄉: '臺東',
  蘭嶼: '臺東', 蘭嶼鄉: '臺東',
  關山: '臺東', 關山鎮: '臺東',

  // 桃園
  中壢: '桃園', 中壢區: '桃園',
  平鎮: '桃園', 平鎮區: '桃園',
  大溪: '桃園', 大溪區: '桃園',
  龜山: '桃園', 龜山區: '桃園',
  蘆竹: '桃園', 蘆竹區: '桃園',

  // 新竹
  竹北: '新竹', 竹北市: '新竹',
  竹東: '新竹', 竹東鎮: '新竹',
  新埔: '新竹', 新埔鎮: '新竹',
  關西: '新竹', 關西鎮: '新竹',
  湖口: '新竹', 湖口鄉: '新竹',

  // 苗栗
  頭份: '苗栗', 頭份市: '苗栗',
  竹南: '苗栗', 竹南鎮: '苗栗',
  三義: '苗栗', 三義鄉: '苗栗',
  南庄: '苗栗', 南庄鄉: '苗栗',
  大湖: '苗栗', 大湖鄉: '苗栗',

  // 離島
  馬公: '澎湖', 七美: '澎湖',
  金城: '金門', 金湖: '金門',
  南竿: '連江', 北竿: '連江', 東引: '連江', 馬祖: '連江',

  // 國外
  東京: '日本', 大阪: '日本', 京都: '日本', 沖繩: '日本', 福岡: '日本', 北海道: '日本',
  首爾: '國外', 釜山: '國外', 曼谷: '國外', 香港: '國外', 澳門: '國外', 新加坡: '國外',
};

/**
 * 統一將所有「台」轉為正體「臺」並去除縣市尾綴
 */
export function standardizeCityName(raw?: string | null): string {
  if (!raw) return '';
  let str = raw.trim();
  // 統一「台」->「臺」
  str = str.replace(/台/g, '臺');

  // 特例判斷
  if (/^(?:臺北[市]?|taipei)/i.test(str)) return '臺北';
  if (/^(?:新北[市]?|new\s*taipei)/i.test(str)) return '新北';
  if (/^(?:基隆[市]?|keelung)/i.test(str)) return '基隆';
  if (/^(?:桃園[縣市]?|taoyuan)/i.test(str)) return '桃園';
  if (/^(?:新竹[縣市]?|hsinchu)/i.test(str)) return '新竹';
  if (/^(?:苗栗[縣市]?|miaoli)/i.test(str)) return '苗栗';
  if (/^(?:臺中[縣市]?|taichung)/i.test(str)) return '臺中';
  if (/^(?:彰化[縣市]?|changhua)/i.test(str)) return '彰化';
  if (/^(?:南投[縣市]?|nantou)/i.test(str)) return '南投';
  if (/^(?:雲林[縣]?|yunlin)/i.test(str)) return '雲林';
  if (/^(?:嘉義[縣市]?|chiayi)/i.test(str)) return '嘉義';
  if (/^(?:臺南[縣市]?|tainan)/i.test(str)) return '臺南';
  if (/^(?:高雄[縣市]?|kaohsiung)/i.test(str)) return '高雄';
  if (/^(?:屏東[縣市]?|pingtung)/i.test(str)) return '屏東';
  if (/^(?:宜蘭[縣市]?|yilan)/i.test(str)) return '宜蘭';
  if (/^(?:花蓮[縣市]?|hualien)/i.test(str)) return '花蓮';
  if (/^(?:臺東[縣市]?|taitung)/i.test(str)) return '臺東';
  if (/^(?:澎湖[縣]?|penghu)/i.test(str)) return '澎湖';
  if (/^(?:金門[縣]?|kinmen)/i.test(str)) return '金門';
  if (/^(?:連江[縣]?|馬祖|matsu)/i.test(str)) return '連江';
  if (/^(?:日本|japan|tokyo|osaka)/i.test(str)) return '日本';

  // 若以「縣」或「市」結尾且長度大於等於3，去除後綴
  if (str.length >= 3 && /[縣市]$/.test(str)) {
    return str.slice(0, -1);
  }

  return str;
}

/**
 * 取得特定縣市底下的所有鄉鎮市區列表
 */
export function getDistrictsForCity(city: string): string[] {
  const normCity = standardizeCityName(city);
  const group = TAIWAN_LOCATION_HIERARCHY.find((g) => g.city === normCity);
  return group ? group.districts : [];
}

/**
 * 核心自動解析函式：
 * 給定一個景點或卡片物件，自動推導標準化的 { city, district }。
 * 1. 統一「台 / 臺」為「臺」
 * 2. 舊資料無痛逆向推導：若 city 只寫了 "民雄"，自動回傳 { city: "嘉義", district: "民雄" }
 * 3. 自動從地址中萃取 "民雄鄉"、"大安區"、"恆春鎮"
 * 4. 支援從 title、tags、summary 中精準辨識
 */
export function resolvePlaceHierarchy(item: {
  placeInfo?: {
    city?: string;
    district?: string;
    address?: string;
    locationName?: string;
  } | null;
  title?: string;
  tags?: string[];
  summary?: string;
}): LocationHierarchy {
  const placeInfo = item.placeInfo || {};
  let rawCity = (placeInfo.city || '').trim();
  let rawDistrict = (placeInfo.district || '').trim();
  const address = (placeInfo.address || '').trim();
  const locationName = (placeInfo.locationName || '').trim();
  const title = (item.title || '').trim();
  const summary = (item.summary || '').trim();
  const tags = Array.isArray(item.tags) ? item.tags : [];

  // 全文字串組合（用來搜尋地區關鍵字）
  const fullText = [
    rawCity,
    rawDistrict,
    address,
    locationName,
    title,
    summary,
    tags.join(' '),
  ].join(' ');

  // 1. 先檢查 rawCity 本身是否其實是某個鄉鎮或景點（例如舊卡片 city: "民雄" 或 "恆春"）
  if (rawCity) {
    const cleanedRawCity = cleanDistrictName(rawCity);
    if (UNIQUE_DISTRICT_TO_CITY_MAP[rawCity] || UNIQUE_DISTRICT_TO_CITY_MAP[cleanedRawCity]) {
      const resolvedParentCity =
        UNIQUE_DISTRICT_TO_CITY_MAP[rawCity] || UNIQUE_DISTRICT_TO_CITY_MAP[cleanedRawCity];
      return {
        city: resolvedParentCity,
        district: cleanedRawCity,
      };
    }
  }

  // 2. 如果 rawDistrict 本身是某個已知唯一鄉鎮，且 rawCity 為空，則逆推 rawCity
  if (rawDistrict) {
    const cleanedRawDist = cleanDistrictName(rawDistrict);
    if (UNIQUE_DISTRICT_TO_CITY_MAP[rawDistrict] || UNIQUE_DISTRICT_TO_CITY_MAP[cleanedRawDist]) {
      const resolvedParentCity =
        UNIQUE_DISTRICT_TO_CITY_MAP[rawDistrict] || UNIQUE_DISTRICT_TO_CITY_MAP[cleanedRawDist];
      return {
        city: standardizeCityName(rawCity) || resolvedParentCity,
        district: cleanedRawDist,
      };
    }
  }

  // 3. 標準化 city
  let finalCity = standardizeCityName(rawCity);

  // 4. 若 city 仍為空，嘗試從地址或全文偵測縣市
  if (!finalCity) {
    // 優先檢查台灣縣市
    const cityMatch = fullText.match(
      /(?:台灣|臺灣)?(臺北|台北|新北|基隆|桃園|新竹|苗栗|臺中|台中|彰化|南投|雲林|嘉義|臺南|台南|高雄|屏東|宜蘭|花蓮|臺東|台東|澎湖|金門|連江|馬祖)[縣市]?/
    );
    if (cityMatch && cityMatch[1]) {
      finalCity = standardizeCityName(cityMatch[1]);
    } else {
      // 檢查唯一鄉鎮字眼
      for (const [districtKey, parentCity] of Object.entries(UNIQUE_DISTRICT_TO_CITY_MAP)) {
        if (fullText.includes(districtKey)) {
          finalCity = parentCity;
          if (!rawDistrict) {
            rawDistrict = cleanDistrictName(districtKey);
          }
          break;
        }
      }
    }
  }

  // 5. 萃取或確認 district（鄉鎮市區）
  let finalDistrict = rawDistrict ? cleanDistrictName(rawDistrict) : '';

  // 如果 district 仍為空，從 address 與全文中搜尋
  if (!finalDistrict) {
    // 5a. 若已知 finalCity，優先在其所屬 districts 內比對
    if (finalCity) {
      const cityGroup = TAIWAN_LOCATION_HIERARCHY.find((g) => g.city === finalCity);
      if (cityGroup) {
        for (const dist of cityGroup.districts) {
          const cleaned = cleanDistrictName(dist);
          // 在地址或全文中尋找
          if (address.includes(dist) || address.includes(cleaned) || fullText.includes(dist)) {
            finalDistrict = cleaned;
            break;
          }
        }
      }
    }

    // 5b. 若仍未找到，嘗試用台灣標準行政區正規表達式從 address 萃取（例如「...市東區...」、「...縣民雄鄉...」）
    if (!finalDistrict && address) {
      const addrMatch = address.match(/(?:[縣市])?([^\s\d,，]{1,4}[鄉鎮市區])/);
      if (addrMatch && addrMatch[1]) {
        const candidate = addrMatch[1].replace(/^[縣市]/, '');
        const candidateClean = cleanDistrictName(candidate);
        if (candidateClean && candidateClean.length >= 2) {
          finalDistrict = candidateClean;
        }
      }
    }

    // 5c. 若仍未找到，比對 UNIQUE_DISTRICT_TO_CITY_MAP
    if (!finalDistrict) {
      for (const [districtKey, parentCity] of Object.entries(UNIQUE_DISTRICT_TO_CITY_MAP)) {
        if (fullText.includes(districtKey)) {
          finalDistrict = cleanDistrictName(districtKey);
          if (!finalCity) {
            finalCity = parentCity;
          }
          break;
        }
      }
    }
  }

  // 保底：若 finalCity 仍為空但有 finalDistrict
  if (!finalCity && finalDistrict) {
    if (UNIQUE_DISTRICT_TO_CITY_MAP[finalDistrict]) {
      finalCity = UNIQUE_DISTRICT_TO_CITY_MAP[finalDistrict];
    }
  }

  // 清洗 finalDistrict：避免 district 和 city 相同（例如：臺北市 臺北區）
  if (finalDistrict === finalCity || finalDistrict === `${finalCity}市` || finalDistrict === `${finalCity}縣`) {
    finalDistrict = '';
  }

  return {
    city: finalCity || '',
    district: finalDistrict || '',
  };
}
