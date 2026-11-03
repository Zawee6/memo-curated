import OpenCC from 'opencc-js';

// 初始化簡體轉台灣繁體慣用語轉換器 (s2twp)
const s2twpConverter = OpenCC.Converter({ from: 'cn', to: 'twp' });

// 影視名詞、知名電影與常見演職員對照表（台灣官方慣用名）
const TAIWAN_MOVIE_TERMS: [RegExp, string][] = [
  [/搏[击擊]俱[乐樂]部|搏[击擊][会會]/g, '鬥陣俱樂部'],
  [/肖申克的救[赎贖]|月黑高[飞飛]/g, '刺激1995'],
  [/盗[梦夢]空[间間]/g, '全面啟動'],
  [/泰坦尼克[号號]/g, '鐵達尼號'],
  [/星[际際]穿越/g, '星際效應'],
  [/黑客帝[国國]/g, '駭客任務'],
  [/指[环環]王/g, '魔戒'],
  [/大[卫衛]·?芬奇/g, '大衛·芬奇'],
  [/布拉德·?皮特|布[莱萊]德·?皮特/g, '布萊德·彼特'],
  [/爱德华·?诺顿|愛德華·?諾頓/g, '愛德華·諾頓'],
  [/海[伦倫]娜·?博[纳納]姆·?卡特/g, '海倫娜·寶漢·卡特'],
  [/克里斯托弗·?诺兰|克里斯多福·?諾蘭/g, '克里斯多福·諾蘭'],
  [/昆汀·?塔[伦倫]蒂[诺諾]/g, '昆汀·塔倫提諾'],
  [/马丁·?斯科塞斯|馬丁·?史柯西斯/g, '馬丁·史柯西斯'],
];

/**
 * 將簡體中文、大陸翻譯詞彙轉換為 100% 台灣標準正體繁體中文
 */
export function toTaiwaneseTraditional(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let result = s2twpConverter(text);

  for (const [pattern, twTerm] of TAIWAN_MOVIE_TERMS) {
    result = result.replace(pattern, twTerm);
  }

  return result.trim();
}
