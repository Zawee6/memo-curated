import { ParsedItem, RecipeIngredient, RecipeTags, AggregatedIngredient } from '@/types/item';
export type { AggregatedIngredient };

export interface NormalizedIngredient {
  name: string;
  numericAmount: number;
  unit: string;
  category: string;
  isScalable: boolean;
}

const PANTRY_KEYWORDS = [
  '鹽', '海鹽', '粗鹽', '醬油', '味醂', '米酒', '料理酒', '清酒',
  '砂糖', '冰糖', '黑糖', '白糖', '糖', '黑胡椒', '白胡椒', '胡椒',
  '橄欖油', '沙拉油', '香油', '麻油', '食用油', '植物油',
  '太白粉', '玉米粉', '麵粉', '醋', '烏醋', '白醋', '水', '清水', '高湯',
];

export function isPantryIngredient(name: string): boolean {
  const n = name.trim();
  return PANTRY_KEYWORDS.some((kw) => n === kw || n.endsWith(kw) || n.includes('醬油') || n.includes('胡椒') || n.includes('橄欖油'));
}

export function inferIngredientCategory(name: string, existingCat?: string): string {
  const n = name.toLowerCase();
  const cat = (existingCat || '').trim();

  if (cat === '生鮮肉品' || cat === '海鮮水產' || /牛|豬|雞|羊|鴨|培根|火腿|香腸|肉|魚|蝦|蛤|蟹|透抽|中卷|鮭|海鮮|干貝|牡蠣/.test(n)) {
    return '生鮮肉品';
  }
  if (cat === '蔬菜水果' || /蔥|蒜|薑|洋蔥|馬鈴薯|紅蘿蔔|高麗菜|番茄|菇|菜|椒|瓜|筍|檸檬|酪梨|水果/.test(n)) {
    return '蔬菜水果';
  }
  if (cat === '蛋奶豆製品' || /蛋|奶|起司|乳酪|奶油|豆腐|豆乾|豆漿|優格/.test(n)) {
    return '蛋奶豆製品';
  }
  if (cat === '乾貨調味' || cat === '主食五穀' || /鹽|糖|醬油|醋|油|粉|胡椒|酒|麵|飯|米|冬粉|調味|香料|乾貨/.test(n)) {
    return '調味料與乾貨';
  }
  return '調味料與乾貨';
}

/**
 * 將任意格式 (新版結構化 amount:number + unit:string 或 舊版 amount:"200g") 正規化
 */
export function normalizeIngredient(ing: RecipeIngredient): NormalizedIngredient {
  const category = inferIngredientCategory(ing.name, ing.category);

  if (typeof ing.amount === 'number' && !isNaN(ing.amount)) {
    const unit = (ing.unit || '').trim() || '份';
    const isScalable = unit !== '適量' && unit !== '少許' && ing.amount > 0;
    return {
      name: ing.name.trim(),
      numericAmount: ing.amount,
      unit,
      category,
      isScalable,
    };
  }

  // 處理字串格式，例如 "200g", "1.5 顆", "2大匙", "適量"
  const rawStr = String(ing.amount || '').trim();
  const unitFromField = (ing.unit || '').trim();

  if (!rawStr || rawStr.includes('適量') || rawStr.includes('少許')) {
    return {
      name: ing.name.trim(),
      numericAmount: 1,
      unit: unitFromField || rawStr || '適量',
      category,
      isScalable: false,
    };
  }

  // 解析前綴數值與單位，例如 "250 g" 或 "1/2 顆"
  const fractionMatch = rawStr.match(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]) / parseFloat(fractionMatch[2]);
    const u = unitFromField || fractionMatch[3].trim() || '份';
    return {
      name: ing.name.trim(),
      numericAmount: num,
      unit: u,
      category,
      isScalable: true,
    };
  }

  const numMatch = rawStr.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    const u = unitFromField || numMatch[2].trim() || '份';
    return {
      name: ing.name.trim(),
      numericAmount: num,
      unit: u,
      category,
      isScalable: u !== '適量' && u !== '少許',
    };
  }

  return {
    name: ing.name.trim(),
    numericAmount: 1,
    unit: unitFromField || rawStr || '份',
    category,
    isScalable: false,
  };
}

/**
 * 取得食譜的基準人數 (預設 2 人份)
 */
export function getBaseServings(recipeInfo?: ParsedItem['recipeInfo']): number {
  if (!recipeInfo) return 2;
  if (typeof recipeInfo.baseServings === 'number' && recipeInfo.baseServings > 0) {
    return recipeInfo.baseServings;
  }
  if (recipeInfo.servings) {
    const m = recipeInfo.servings.match(/(\d+)/);
    if (m) {
      const parsed = parseInt(m[1], 10);
      if (parsed > 0 && parsed <= 20) return parsed;
    }
  }
  return 2;
}

/**
 * 格式化數值（四捨五入到小數點第 1 位，整數不顯示 .0）
 */
export function formatAmountNumber(val: number): string {
  if (val <= 0) return '';
  const rounded = Math.round(val * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

/**
 * 依目標人數動態換算單一食材顯示文字
 */
export function formatScaledIngredient(
  ing: RecipeIngredient,
  baseServings: number,
  targetServings: number
): {
  name: string;
  displayAmount: string;
  scaledNumeric: number;
  unit: string;
  category: string;
  isScaled: boolean;
} {
  const norm = normalizeIngredient(ing);
  const safeBase = baseServings > 0 ? baseServings : 2;
  const ratio = targetServings / safeBase;

  if (!norm.isScalable) {
    return {
      name: norm.name,
      displayAmount: norm.unit,
      scaledNumeric: norm.numericAmount,
      unit: norm.unit,
      category: norm.category,
      isScaled: false,
    };
  }

  const scaled = norm.numericAmount * ratio;
  const numStr = formatAmountNumber(scaled);
  // 若單位為英文 g, ml, kg 則緊貼，中文單位則加半形空格或直接相連
  const space = /^[a-zA-Z]+$/.test(norm.unit) ? '' : ' ';
  return {
    name: norm.name,
    displayAmount: `${numStr}${space}${norm.unit}`.trim(),
    scaledNumeric: Math.round(scaled * 10) / 10,
    unit: norm.unit,
    category: norm.category,
    isScaled: ratio !== 1,
  };
}

/**
 * 合併多道勾選食譜的食材清單（自動乘以 targetServings / baseServings 並合併同名食材）
 */
export function aggregateRecipeIngredients(
  recipes: ParsedItem[],
  targetServings: number
): AggregatedIngredient[] {
  const map = new Map<string, AggregatedIngredient>();

  for (const recipe of recipes) {
    const base = getBaseServings(recipe.recipeInfo);
    const ingredients = recipe.recipeInfo?.ingredients || [];

    for (const rawIng of ingredients) {
      const scaled = formatScaledIngredient(rawIng, base, targetServings);
      // 清除括號補充以利合併同名食材，例如 "雞蛋 (室溫)" -> "雞蛋"
      const canonicalName = scaled.name
        .replace(/（.*?）|\(.*?\)/g, '')
        .trim();
      const key = `${canonicalName.toLowerCase()}__${scaled.unit.toLowerCase()}`;

      const existing = map.get(key);
      if (existing) {
        existing.totalAmount = Math.round((existing.totalAmount + scaled.scaledNumeric) * 10) / 10;
        if (!existing.sourceRecipes.includes(recipe.title)) {
          existing.sourceRecipes.push(recipe.title);
        }
        existing.requiredAmountText =
          scaled.unit === '適量' || scaled.unit === '少許'
            ? scaled.unit
            : `${formatAmountNumber(existing.totalAmount)}${/^[a-zA-Z]+$/.test(existing.unit) ? '' : ' '}${existing.unit}`.trim();
      } else {
        map.set(key, {
          name: canonicalName || scaled.name,
          category: scaled.category,
          totalAmount: scaled.scaledNumeric,
          unit: scaled.unit,
          requiredAmountText: scaled.displayAmount,
          sourceRecipes: [recipe.title],
          isPantryStaple: isPantryIngredient(canonicalName || scaled.name),
        });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * 取得待採買之純淨食材品項（已過濾「家中已有 / 免買」）
 */
export function getToBuyIngredients(
  items: AggregatedIngredient[],
  excludedNames: Set<string> = new Set()
): AggregatedIngredient[] {
  return items.filter((it) => !excludedNames.has(it.name));
}

/**
 * 產生供 Apple 備忘錄（點擊鍵盤打勾圖示轉換）與 iPhone 提醒事項的純淨逐行文字
 * 嚴格保證每一行僅有「食材名稱 數量單位」，絕不夾雜空行、標題或裝飾符號
 * 例如：
 * 豬肋排 600g
 * 蒜末 12瓣
 * 牛排（牛小排或肋眼） 350g
 */
export function generateCleanChecklistPlainText(params: {
  items: AggregatedIngredient[];
  excludedNames?: Set<string>;
}): string {
  const { items, excludedNames = new Set() } = params;
  const toBuy = getToBuyIngredients(items, excludedNames);

  return toBuy
    .map((it) => `${it.name.trim()} ${it.requiredAmountText.trim()}`.trim())
    .filter(Boolean)
    .join('\n');
}

/**
 * 產生供 Rich Clipboard (text/html) 寫入的 HTML 無序清單結構
 * 貼入 Apple 備忘錄或支援 Rich Text 的筆記軟體時，可無縫識別為項目清單
 */
export function generateCleanChecklistHtml(params: {
  items: AggregatedIngredient[];
  excludedNames?: Set<string>;
}): string {
  const { items, excludedNames = new Set() } = params;
  const toBuy = getToBuyIngredients(items, excludedNames);

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const listItems = toBuy
    .map((it) => {
      const text = `${it.name.trim()} ${it.requiredAmountText.trim()}`.trim();
      return `  <li>${escapeHtml(text)}</li>`;
    })
    .join('\n');

  return `<ul>\n${listItems}\n</ul>`;
}

/**
 * 產生供 LINE Keep 筆記與社群通訊軟體分享的精美排版文字（含分類 emoji 與純淨食材品項）
 */
export function generateChecklistExportText(params: {
  targetServings: number;
  selectedRecipes: ParsedItem[];
  items: AggregatedIngredient[];
  excludedNames?: Set<string>;
}): string {
  const { targetServings, selectedRecipes, items, excludedNames = new Set() } = params;

  const lines: string[] = [];
  lines.push(`🛒 Memo 今日採買清單（${targetServings} 人份）`);
  lines.push('───────────────────────');

  if (selectedRecipes.length > 0) {
    lines.push('🍽️ 今日開伙菜單：');
    selectedRecipes.forEach((r) => {
      lines.push(`• ${r.title}`);
    });
    lines.push('');
  }

  // 4 大類別排序
  const categoryOrder = [
    { key: '生鮮肉品', icon: '🥩' },
    { key: '蔬菜水果', icon: '🥬' },
    { key: '蛋奶豆製品', icon: '🥚' },
    { key: '調味料與乾貨', icon: '🧂' },
    { key: '其他', icon: '📦' },
  ];

  const toBuyItems = items.filter((it) => !excludedNames.has(it.name));
  const excludedItems = items.filter((it) => excludedNames.has(it.name));

  categoryOrder.forEach(({ key, icon }) => {
    const groupItems = toBuyItems.filter((it) => it.category === key);
    if (groupItems.length > 0) {
      lines.push(`${icon} ${key}`);
      groupItems.forEach((it) => {
        lines.push(`${it.name} ${it.requiredAmountText}`);
      });
      lines.push('');
    }
  });

  if (excludedItems.length > 0) {
    lines.push('✅ 家中已有（免買）：');
    excludedItems.forEach((it) => {
      lines.push(`${it.name} ${it.requiredAmountText}`);
    });
    lines.push('');
  }

  lines.push('───────────────────────');
  lines.push('📝 由 Memo 智慧私廚生成');

  return lines.join('\n');
}

/**
 * 產生整合「🛒 採買食材清單」＋「👩‍🍳 料理作法與步驟」的完整備忘錄筆記
 * 上半部：一、今日採買總清單（按食材分類標籤）
 * 中間：══════════════════
 * 下半部：二、各別餐點食譜與作法（依料理分組）
 */
export function generateFullCookingGuideText(params: {
  targetServings: number;
  selectedRecipes: ParsedItem[];
  items: AggregatedIngredient[];
  excludedNames?: Set<string>;
}): string {
  const { targetServings, selectedRecipes, items, excludedNames = new Set() } = params;

  const lines: string[] = [];
  const recipeNames = selectedRecipes.map((r) => r.title).join('、');

  lines.push(`📋 今日私廚採買與料理備忘錄（共 ${targetServings} 人份）`);
  if (recipeNames) {
    lines.push(`包含料理：${recipeNames}`);
  }
  lines.push('');

  // 上半部：🛒 【一、今日採買總清單】（共 X 人份）
  lines.push(`🛒 【一、今日採買總清單】（共 ${targetServings} 人份）`);
  lines.push('');

  const toBuyItems = items.filter((it) => !excludedNames.has(it.name));
  const excludedItems = items.filter((it) => excludedNames.has(it.name));

  const categoryOrder = [
    { key: '生鮮肉品', label: '🥩 生鮮肉品 / 海鮮' },
    { key: '蔬菜水果', label: '🥬 蔬菜水果' },
    { key: '蛋奶豆製品', label: '🥚 蛋奶豆製品' },
    { key: '調味料與乾貨', label: '🧂 調味料與乾貨' },
    { key: '其他', label: '📦 其他' },
  ];

  if (toBuyItems.length === 0) {
    lines.push('（今日無待買食材，家中材料充足）');
    lines.push('');
  } else {
    categoryOrder.forEach(({ key, label }) => {
      const groupItems = toBuyItems.filter((it) => it.category === key);
      if (groupItems.length > 0) {
        lines.push(label);
        groupItems.forEach((it) => {
          lines.push(`${it.name} ${it.requiredAmountText}`);
        });
        lines.push('');
      }
    });
  }

  if (excludedItems.length > 0) {
    lines.push('【✅ 家中已有（免買）】');
    excludedItems.forEach((it) => {
      lines.push(`${it.name} ${it.requiredAmountText}`);
    });
    lines.push('');
  }

  // 中間：精緻質感分隔線
  lines.push('══════════════════');
  lines.push('');

  // 下半部：👩‍🍳 【二、各別餐點食譜與作法】
  lines.push('👩‍🍳 【二、各別餐點食譜與作法】');
  lines.push('');

  selectedRecipes.forEach((recipe, idx) => {
    const base = getBaseServings(recipe.recipeInfo);
    const rawIngs = recipe.recipeInfo?.ingredients || [];
    const steps = recipe.recipeInfo?.steps || [];

    lines.push(`🍲 餐點 ${idx + 1}：《${recipe.title}》（${targetServings} 人份）`);

    // 本道所需材料
    lines.push('▸ 本道所需材料：');
    if (rawIngs.length > 0) {
      rawIngs.forEach((ing) => {
        const scaled = formatScaledIngredient(ing, base, targetServings);
        lines.push(`  • ${scaled.name} ${scaled.displayAmount}`);
      });
    } else {
      lines.push('  • 適量基礎食材');
    }

    // 作法步驟
    lines.push('▸ 作法步驟：');
    if (steps.length > 0) {
      steps.forEach((step, sIdx) => {
        const cleanStep = step.replace(/^\d+[\.\、\:\s]+/, '').trim();
        lines.push(`  ${sIdx + 1}. ${cleanStep}`);
      });
    } else if (recipe.summary) {
      lines.push(`  1. ${recipe.summary}`);
    } else {
      lines.push('  1. 請依照食材進行料理，起鍋前適量調味即可。');
    }

    if (idx < selectedRecipes.length - 1) {
      lines.push('');
    }
  });

  lines.push('');
  lines.push('══════════════════');
  lines.push('📝 由 Memo 智慧私廚生成');

  return lines.join('\n');
}

/**
 * 取得或智慧推導食譜的多維智慧標籤（料理風格、主要肉品、餐點類型）
 */
export function getRecipeSmartTags(recipe: ParsedItem): RecipeTags {
  const existing = recipe.recipeInfo?.recipeTags || recipe.recipeTags;
  if (existing?.cuisine && existing?.ingredientsType && existing?.mealType) {
    return existing;
  }

  const title = (recipe.title || '').toLowerCase();
  const summary = (recipe.summary || '').toLowerCase();
  const tagsStr = (recipe.tags || []).join(' ').toLowerCase();
  const customTagsStr = (recipe.customTags || []).join(' ').toLowerCase();
  const ingsStr = (recipe.recipeInfo?.ingredients || [])
    .map((i) => i.name)
    .join(' ')
    .toLowerCase();
  const allText = `${title} ${summary} ${tagsStr} ${customTagsStr} ${ingsStr}`;

  // 1. 料理風格 (cuisine)
  let cuisine = existing?.cuisine;
  if (!cuisine) {
    if (/日式|日料|和風|壽喜燒|豚汁|丼|烏龍|拉麵|味噌|照燒|天婦羅/.test(allText)) {
      cuisine = '日式';
    } else if (/義式|義大利|義麵|披薩|燉飯|青醬|紅醬|白醬|肉醬/.test(allText)) {
      cuisine = '義式';
    } else if (/美式|漢堡|牛排|bbq|炸雞|烤肉/.test(allText)) {
      cuisine = '美式';
    } else if (/韓式|泡菜|年糕|部隊鍋|辣炒|石鍋|拌飯/.test(allText)) {
      cuisine = '韓式';
    } else if (/法式|舒芙蕾|法棍|油封/.test(allText)) {
      cuisine = '法式';
    } else if (/泰式|越式|東南亞|打拋|咖哩|椒麻|南洋/.test(allText)) {
      cuisine = '東南亞';
    } else if (/台式|家常|熱炒|三杯|滷肉|牛肉麵|炒飯|排骨飯|蔥油/.test(allText)) {
      cuisine = '台式';
    } else {
      cuisine = '台式家常';
    }
  }

  // 2. 主要肉品/食材 (ingredientsType)
  let ingredientsType = existing?.ingredientsType;
  if (!ingredientsType) {
    if (/牛|牛五花|牛小排|牛腩|牛肋|牛柳|牛腱|牛排|牛肉|肥牛/.test(allText)) {
      ingredientsType = '牛肉';
    } else if (/豬|五花肉|松阪|梅花|培根|排骨|火腿|絞肉|肉絲|叉燒|豬肉/.test(allText)) {
      ingredientsType = '豬肉';
    } else if (/雞|雞腿|雞胸|雞肉|雞翅|雞丁|雞柳/.test(allText)) {
      ingredientsType = '雞肉';
    } else if (/蝦|魚|鮭魚|鮪魚|鱈魚|海鮮|干貝|透抽|中卷|花枝|蛤蜊|牡蠣|鮮蚵|螃蟹/.test(allText)) {
      ingredientsType = '海鮮';
    } else if (/蛋|歐姆蛋|玉子燒|炒蛋|荷包蛋|水波蛋|溏心蛋|溫泉蛋/.test(allText)) {
      ingredientsType = '蛋料理';
    } else if (/豆腐|豆乾|豆皮|素|蔬食|沙拉|菇|青菜|時蔬/.test(allText)) {
      ingredientsType = '蔬食';
    } else {
      ingredientsType = '蔬食';
    }
  }

  // 3. 餐點類型 (mealType)
  let mealType = existing?.mealType;
  if (!mealType) {
    if (/湯|濃湯|肉湯|雞湯|排骨湯|魚湯|羹/.test(allText)) {
      mealType = '湯品';
    } else if (/甜點|蛋糕|布丁|奶酪|餅乾|鬆餅|塔|甜湯|巴斯克/.test(allText)) {
      mealType = '甜點';
    } else if (/飲|飲料|奶茶|拿鐵|果汁|咖啡|冰沙|特調/.test(allText)) {
      mealType = '飲料';
    } else if (/常備|小菜|涼拌|醃漬|沙拉/.test(allText)) {
      mealType = '常備菜';
    } else if (/點心|小吃|炸物|煎餃|鍋貼|烤串|春捲|包子/.test(allText)) {
      mealType = '小吃/點心';
    } else {
      mealType = '主食';
    }
  }

  return {
    cuisine,
    ingredientsType,
    mealType,
  };
}

