import { ParsedItem, ShoppingItem } from '@/types/item';

const CART_SELECTION_STORAGE_KEY = 'albo_cart_selection_v1';
const CART_CHECKED_STORAGE_KEY = 'albo_cart_checked_items_v1';

export interface CartStorageState {
  selectedItemIds: string[];
}

export function loadCartSelectedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_SELECTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCartSelectedIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_SELECTION_STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event('albo_cart_updated'));
  } catch (err) {
    console.error('Failed to save cart selected IDs:', err);
  }
}

export function loadCartCheckedKeys(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CART_CHECKED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCartCheckedKeys(keys: Record<string, boolean>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_CHECKED_STORAGE_KEY, JSON.stringify(keys));
  } catch (err) {
    console.error('Failed to save cart checked keys:', err);
  }
}

export interface MergedStoreGroup {
  store: string;
  items: Array<ShoppingItem & { sourceTitles: string[]; itemKey: string }>;
  subtotal: number;
}

export function buildMergedCart(
  allItems: ParsedItem[],
  selectedItemIds: string[]
): {
  groups: MergedStoreGroup[];
  totalCost: number;
  totalItemsCount: number;
  sourceCards: ParsedItem[];
} {
  // Filter cards with shopping plans that are selected
  // If selectedItemIds is empty, we include all cards that have shopping plans by default
  const validCards = allItems.filter(
    (card) => card.shoppingPlan && (card.shoppingPlan.items?.length ?? 0) > 0
  );

  const activeCards =
    selectedItemIds.length > 0
      ? validCards.filter((card) => selectedItemIds.includes(card.id))
      : validCards;

  const itemMap = new Map<
    string,
    ShoppingItem & { sourceTitles: string[]; itemKey: string }
  >();

  for (const card of activeCards) {
    const plan = card.shoppingPlan;
    if (!plan?.items) continue;

    for (const rawItem of plan.items) {
      const storeName = rawItem.store || '其他生活賣場';
      // Normalize key by store + name
      const key = `${storeName}___${rawItem.name.trim().toLowerCase()}`;

      if (itemMap.has(key)) {
        const existing = itemMap.get(key)!;
        if (!existing.sourceTitles.includes(card.title)) {
          existing.sourceTitles.push(card.title);
        }
        // If one of them is marked as in-stock, keep it in stock
        if (rawItem.inStock) {
          existing.inStock = true;
        }
      } else {
        itemMap.set(key, {
          ...rawItem,
          store: storeName,
          sourceTitles: [card.title],
          itemKey: key,
        });
      }
    }
  }

  // Group by store
  const storeMap = new Map<string, MergedStoreGroup>();

  for (const item of itemMap.values()) {
    if (!storeMap.has(item.store)) {
      storeMap.set(item.store, {
        store: item.store,
        items: [],
        subtotal: 0,
      });
    }
    const group = storeMap.get(item.store)!;
    group.items.push(item);
    group.subtotal += item.estimatedPrice || 0;
  }

  const groups = Array.from(storeMap.values()).sort(
    (a, b) => b.items.length - a.items.length
  );

  const totalCost = groups.reduce((acc, g) => acc + g.subtotal, 0);
  const totalItemsCount = itemMap.size;

  return {
    groups,
    totalCost,
    totalItemsCount,
    sourceCards: activeCards,
  };
}

export function exportShoppingListToMarkdown(
  groups: MergedStoreGroup[],
  totalCost: number
): string {
  const dateStr = new Date().toLocaleDateString('zh-TW');
  let md = `# 🛒 Memo 智慧採買清單 (${dateStr})\n\n`;
  md += `**預估總預算：NT$ ${totalCost.toLocaleString()}**\n\n`;

  for (const group of groups) {
    md += `## 🏬 ${group.store}（小計：NT$ ${group.subtotal.toLocaleString()}）\n`;
    for (const item of group.items) {
      const stockBadge = item.inStock ? ' [家中現貨]' : '';
      const specText = item.spec ? ` (${item.spec})` : '';
      md += `- [ ] **${item.name}**${specText} - NT$ ${item.estimatedPrice}${stockBadge}\n`;
      if (item.sourceTitles.length > 0) {
        md += `  *來源: ${item.sourceTitles.join(', ')}*\n`;
      }
    }
    md += '\n';
  }

  return md;
}
