import { ShoppingItem } from '@/types/item';

export interface WarehouseItemTemplate {
  name: string;
  category: string;
  store: 'Costco 好市多' | '全聯福利中心' | '家樂福' | 'IKEA' | '大創' | string;
  spec: string;
  estimatedPrice: number;
  keywords: string[];
}

/**
 * 台灣主流大賣場與倉儲參考行情資料庫
 */
export const DEFAULT_WAREHOUSE_CATALOG: WarehouseItemTemplate[] = [
  // --- Costco 好市多 ---
  {
    name: '科克蘭 美國特選冷藏牛五花火鍋片',
    category: '生鮮食材',
    store: 'Costco 好市多',
    spec: '約 1.5kg / 盒',
    estimatedPrice: 799,
    keywords: ['牛五花', '牛肉片', '牛肉', '肉片', '火鍋肉片'],
  },
  {
    name: '科克蘭 台灣冷藏去骨雞腿排',
    category: '生鮮食材',
    store: 'Costco 好市多',
    spec: '6包裝 (約 2.5kg)',
    estimatedPrice: 589,
    keywords: ['雞腿排', '去骨雞腿', '雞肉', '雞排'],
  },
  {
    name: '科克蘭 冷凍空運特選大鮭魚排',
    category: '生鮮食材',
    store: 'Costco 好市多',
    spec: '1.2kg / 包',
    estimatedPrice: 659,
    keywords: ['鮭魚', '鮭魚排', '魚排', '生鮮魚肉'],
  },
  {
    name: '科克蘭 特級初榨橄欖油',
    category: '乾貨調味',
    store: 'Costco 好市多',
    spec: '2公升 / 瓶',
    estimatedPrice: 599,
    keywords: ['橄欖油', '特級橄欖油', '油', '食用油'],
  },
  {
    name: '科克蘭 無鹽奶油',
    category: '生鮮食材',
    store: 'Costco 好市多',
    spec: '453g x 4入組',
    estimatedPrice: 389,
    keywords: ['無鹽奶油', '奶油', '發酵奶油', '牛油'],
  },
  {
    name: '科克蘭 無調味綜合堅果',
    category: '乾貨調味',
    store: 'Costco 好市多',
    spec: '1.13kg / 罐',
    estimatedPrice: 529,
    keywords: ['堅果', '綜合堅果', '腰果', '核桃'],
  },
  {
    name: 'Iris 多功能重型大容量滑輪收納箱',
    category: '日用百貨',
    store: 'Costco 好市多',
    spec: '70L x 2入',
    estimatedPrice: 749,
    keywords: ['收納箱', '整理箱', '儲物箱', '露營箱'],
  },

  // --- 全聯福利中心 ---
  {
    name: '冷藏台灣豬五花火鍋肉片',
    category: '生鮮食材',
    store: '全聯福利中心',
    spec: '250g / 盒',
    estimatedPrice: 119,
    keywords: ['豬五花', '豬肉片', '五花肉', '肉片'],
  },
  {
    name: '生鮮精選青蔥',
    category: '生鮮食材',
    store: '全聯福利中心',
    spec: '200g / 束',
    estimatedPrice: 45,
    keywords: ['蔥', '青蔥', '青菜', '辛香料'],
  },
  {
    name: '生鮮進口洋蔥 (3入袋裝)',
    category: '生鮮食材',
    store: '全聯福利中心',
    spec: '3入 / 袋',
    estimatedPrice: 55,
    keywords: ['洋蔥', '黃洋蔥', '紫洋蔥'],
  },
  {
    name: '雲林精選特級蒜球',
    category: '生鮮食材',
    store: '全聯福利中心',
    spec: '300g / 網袋',
    estimatedPrice: 69,
    keywords: ['蒜頭', '蒜球', '蒜碎', '大蒜'],
  },
  {
    name: '萬家香 大吟釀純釀造醬油',
    category: '乾貨調味',
    store: '全聯福利中心',
    spec: '450ml / 瓶',
    estimatedPrice: 85,
    keywords: ['醬油', '純釀造醬油', '生抽', '白醬油'],
  },
  {
    name: '三好米 一等台梗九號米',
    category: '乾貨調味',
    store: '全聯福利中心',
    spec: '2kg / 包',
    estimatedPrice: 169,
    keywords: ['米', '白米', '台梗九號', '壽司米'],
  },

  // --- 家樂福量販 ---
  {
    name: 'Barilla 百味來 義大利直麵 (No.5)',
    category: '乾貨調味',
    store: '家樂福',
    spec: '500g / 盒',
    estimatedPrice: 75,
    keywords: ['義大利麵', '直麵', '通心粉', 'Spaghetti'],
  },
  {
    name: '可果美 義大利蕃茄糊濃縮番茄罐',
    category: '乾貨調味',
    store: '家樂福',
    spec: '400g / 罐',
    estimatedPrice: 58,
    keywords: ['蕃茄糊', '番茄醬', '番茄罐頭', '蕃茄'],
  },
  {
    name: '妙潔 耐高溫烘焙紙 / 防沾氣炸鍋紙',
    category: '日用百貨',
    store: '家樂福',
    spec: '30cm x 10m',
    estimatedPrice: 89,
    keywords: ['烘焙紙', '氣炸鍋紙', '料理紙', '烤盤紙'],
  },

  // --- IKEA / 大創 ---
  {
    name: 'IKEA 365+ 耐熱玻璃附竹蓋食物保鮮盒',
    category: '日用百貨',
    store: 'IKEA',
    spec: '1.0L 長方形',
    estimatedPrice: 169,
    keywords: ['保鮮盒', '玻璃保鮮盒', '食物盒', '收納盒'],
  },
  {
    name: 'IKEA SAMLA 附蓋透明收納盒',
    category: '日用百貨',
    store: 'IKEA',
    spec: '22L',
    estimatedPrice: 149,
    keywords: ['透明收納盒', '塑膠箱', '衣物收納', '整理盒'],
  },
  {
    name: '大創 百元日系廚房調味料旋轉架/瀝水架',
    category: '日用百貨',
    store: '大創',
    spec: '單入裝',
    estimatedPrice: 49,
    keywords: ['調味架', '旋轉架', '大創小物', '廚房置物'],
  },
];

const CUSTOM_INVENTORY_STORAGE_KEY = 'albo_custom_warehouse_inventory';

/**
 * 讀取使用者自訂倉儲/家中庫存清單 (Client-Side)
 */
export function getCustomInventory(): ShoppingItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_INVENTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load custom inventory:', err);
    return [];
  }
}

/**
 * 儲存使用者自訂倉儲清單
 */
export function saveCustomInventory(items: ShoppingItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_INVENTORY_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('albo_inventory_updated'));
  } catch (err) {
    console.error('Failed to save custom inventory:', err);
  }
}

/**
 * 匯入 CSV 格式的倉儲/庫存清單
 * 支援格式：品名,分類,賣場,規格,預估單價,現貨
 */
export function importInventoryFromCSV(csvText: string): ShoppingItem[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const items: ShoppingItem[] = [];
  const startIndex = lines[0].includes('品名') || lines[0].includes('name') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim());
    if (parts.length < 2) continue;

    const name = parts[0];
    const category = parts[1] || '日用百貨';
    const store = parts[2] || 'Costco 好市多';
    const spec = parts[3] || '常規規格';
    const priceNum = parseInt(parts[4]?.replace(/[^0-9]/g, '') || '100', 10);
    const inStock = parts[5] ? /是|有|true|1|yes/i.test(parts[5]) : true;

    if (name) {
      items.push({
        name,
        category,
        store,
        spec,
        estimatedPrice: isNaN(priceNum) ? 100 : priceNum,
        inStock,
      });
    }
  }

  return items;
}

/**
 * 檢查某品項是否在使用者的自訂倉儲庫存中
 */
export function checkItemInCustomStock(
  itemName: string,
  inventory: ShoppingItem[]
): boolean {
  if (!itemName || inventory.length === 0) return false;
  const cleanName = itemName.toLowerCase().replace(/\s+/g, '');

  return inventory.some((inv) => {
    const invName = inv.name.toLowerCase().replace(/\s+/g, '');
    return (
      inv.inStock !== false &&
      (cleanName.includes(invName) || invName.includes(cleanName))
    );
  });
}
