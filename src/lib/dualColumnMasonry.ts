import { getSourceAspectRatio } from '@/lib/video';

export type MasonryBlock<T> =
  | {
      type: 'full-width'; // 16:9 橫式卡片積木（佔大欄 100% 寬）
      id: string;
      item: T;
      estimatedHeight: number;
    }
  | {
      type: 'paired-portrait'; // 2 張 9:16 直式卡片成雙並排積木（內部 grid-cols-2）
      id: string;
      left: T;
      right: T;
      estimatedHeight: number;
    }
  | {
      type: 'single-portrait'; // 尾端落單的單張 9:16 直式卡片
      id: string;
      item: T;
      estimatedHeight: number;
    };

export interface ColumnData<T> {
  blocks: MasonryBlock<T>[];
  totalHeight: number;
}

/**
 * 打包積木組 (packBlocks) 演算法：
 * - 建立 pendingPortrait: T | null = null 暫存槽
 * - 遍歷依時間排序的卡片陣列：
 *   1. 若遇到 16:9 橫式卡片：絕對不把暫存槽裡落單的 pendingPortrait 單獨推出去！
 *      直接先推入 full-width 橫式積木，讓 pendingPortrait 留在暫存槽等待下一張 9:16 吸上來湊成完整一對 paired-portrait。
 *   2. 只有當整個陣列全部遍歷完畢，最後還剩唯一 1 張落單的 9:16 時，才將它放在最底部。
 */
export function packBlocks<T>(
  items: T[],
  getItemMeta: (item: T) => { id: string; url: string; aspectRatio?: string }
): MasonryBlock<T>[] {
  const blocks: MasonryBlock<T>[] = [];
  let pendingHalf: T | null = null; // 暫存等待配對的半寬卡片（9:16 或 1:1 正方形）

  for (const item of items) {
    const meta = getItemMeta(item);
    const ratio = getSourceAspectRatio(meta.url, meta.aspectRatio);
    const isFullWidth = ratio === '16:9';

    if (isFullWidth) {
      blocks.push({
        type: 'full-width',
        id: `fw_${meta.id}`,
        item,
        estimatedHeight: 0.5625, // 9 / 16
      });
    } else {
      // 9:16 直式或 1:1 正方形均為半寬單元，彼此智慧配對成雙（grid-cols-2 左右並排）
      if (pendingHalf === null) {
        pendingHalf = item;
      } else {
        const pendingMeta = getItemMeta(pendingHalf);
        blocks.push({
          type: 'paired-portrait',
          id: `pair_${pendingMeta.id}_${meta.id}`,
          left: pendingHalf,
          right: item,
          estimatedHeight: 0.8889, // (1 / 2) * (16 / 9)
        });
        pendingHalf = null;
      }
    }
  }

  if (pendingHalf !== null) {
    const pendingMeta = getItemMeta(pendingHalf);
    blocks.push({
      type: 'single-portrait',
      id: `sp_${pendingMeta.id}`,
      item: pendingHalf,
      estimatedHeight: 0.8889,
    });
  }

  return blocks;
}

export const createMasonryBlocks = packBlocks;

/**
 * 將積木單元依 Shortest-Column-First 分配至左右雙大欄（或多大欄）：
 * 每一大欄都是獨立垂直的 flex column，矮欄優先放入，
 * 確保直式卡片無縫貼著橫卡下緣往上頂，達成 0 垂直空隙！
 */
export function distributeToMacroColumns<T>(
  blocks: MasonryBlock<T>[],
  columnCount: number = 2
): ColumnData<T>[] {
  const columns: ColumnData<T>[] = Array.from(
    { length: Math.max(1, columnCount) },
    () => ({
      blocks: [],
      totalHeight: 0,
    })
  );

  for (const block of blocks) {
    let shortestColIndex = 0;
    let minHeight = columns[0].totalHeight;

    for (let c = 1; c < columns.length; c++) {
      if (columns[c].totalHeight < minHeight) {
        minHeight = columns[c].totalHeight;
        shortestColIndex = c;
      }
    }

    columns[shortestColIndex].blocks.push(block);
    columns[shortestColIndex].totalHeight += block.estimatedHeight;
  }

  return columns;
}

/**
 * 依卡片預估高度（Shortest-Column-First）將項目分配至 N 個獨立垂直直欄（真・瀑布流 True Masonry）
 * 不再進行橫列配對，當上方出現 1:1 或 16:9 較短卡片時，下一張卡片自動無縫往上貼齊，0 垂直空隙！
 */
export function distributeToColumns<T>(
  items: T[],
  columnCount: number,
  getItemMeta: (item: T) => { id: string; url: string; aspectRatio?: string }
): T[][] {
  const safeCount = Math.max(1, columnCount);
  const cols: T[][] = Array.from({ length: safeCount }, () => []);
  const heights: number[] = new Array(safeCount).fill(0);

  for (const item of items) {
    const meta = getItemMeta(item);
    const ratio = getSourceAspectRatio(meta.url, meta.aspectRatio);
    let estimatedHeight = 1.7778; // 預設 9:16 直式滿版海報
    if (ratio === '1:1') {
      estimatedHeight = 1.0;
    } else if (ratio === '27:40') {
      estimatedHeight = 1.4815; // 40 / 27 電影海報
    } else {
      estimatedHeight = 1.7778; // 16 / 9 (包含 YouTube 橫片在內，外層卡片牆一律統一為 9:16 直式海報)
    }

    // 尋找當前累積高度最矮的欄位（優先分配，維持底部大致切齊且由左至右順序）
    let shortestIndex = 0;
    let minH = heights[0];
    for (let c = 1; c < safeCount; c++) {
      if (heights[c] < minH) {
        minH = heights[c];
        shortestIndex = c;
      }
    }

    cols[shortestIndex].push(item);
    heights[shortestIndex] += estimatedHeight;
  }

  return cols;
}

