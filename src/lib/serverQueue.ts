import fs from 'fs/promises';
import path from 'path';
import { QueueItem, QueueSummary, QueueStatus } from '@/types/queue';
import { ParsedItem } from '@/types/item';
import { normalizeSpaceId } from '@/lib/serverDb';

const DATA_DIR = path.join(process.cwd(), '.data');
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');

async function ensureQueueFileExists(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(QUEUE_FILE);
    } catch {
      await fs.writeFile(QUEUE_FILE, '[]', 'utf-8');
    }
  } catch (err) {
    console.error('[serverQueue] Failed to initialize queue.json:', err);
  }
}

/**
 * 讀取佇列項目
 * @param spaceId 若傳入 spaceId 則篩選該空間項目；若不傳則回傳全數佇列
 */
export async function getQueueItems(spaceId?: string): Promise<QueueItem[]> {
  await ensureQueueFileExists();
  try {
    const raw = await fs.readFile(QUEUE_FILE, 'utf-8');
    if (!raw.trim()) return [];
    const items: QueueItem[] = JSON.parse(raw);
    if (!Array.isArray(items)) return [];

    let filtered = items;
    if (spaceId) {
      const cleanSpace = normalizeSpaceId(spaceId);
      filtered = items.filter((i) => normalizeSpaceId(i.spaceId) === cleanSpace);
    }

    // 依據 createdAt 降序排列 (最新在最上面)
    return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (error) {
    console.error('[serverQueue] Error reading queue items:', error);
    return [];
  }
}

export async function saveQueueItems(items: QueueItem[]): Promise<void> {
  await ensureQueueFileExists();
  try {
    await fs.writeFile(QUEUE_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (error) {
    console.error('[serverQueue] Error writing queue items:', error);
    throw error;
  }
}

export async function enqueueUrl(
  url: string,
  note?: string,
  spaceId?: string
): Promise<QueueItem> {
  const cleanUrl = url.trim();
  const cleanSpace = normalizeSpaceId(spaceId);
  const allItems = await getQueueItems(); // 取得全域以進行儲存

  // 若該空間中已有完全相同 URL 且處於 unread 或 processing，直接回傳既有項目避免重複灌入
  const existingPending = allItems.find(
    (i) =>
      i.url === cleanUrl &&
      normalizeSpaceId(i.spaceId) === cleanSpace &&
      (i.status === 'unread' || i.status === 'processing')
  );
  if (existingPending) {
    return existingPending;
  }

  const now = Date.now();
  const newItem: QueueItem = {
    id: `queue_${now}_${Math.random().toString(36).slice(2, 7)}`,
    url: cleanUrl,
    note: note ? note.trim() : undefined,
    status: 'unread',
    stepNote: '📥 已入庫排隊中',
    createdAt: now,
    updatedAt: now,
    spaceId: cleanSpace,
  };

  const updated = [newItem, ...allItems];
  await saveQueueItems(updated);
  return newItem;
}

export async function updateQueueItem(
  id: string,
  partial: Partial<QueueItem>
): Promise<QueueItem | null> {
  const items = await getQueueItems();
  let found: QueueItem | null = null;

  const updated = items.map((item) => {
    if (item.id === id) {
      found = {
        ...item,
        ...partial,
        id,
        updatedAt: Date.now(),
      };
      return found;
    }
    return item;
  });

  if (found) {
    await saveQueueItems(updated);
  }
  return found;
}

export async function getNextUnprocessedItem(): Promise<QueueItem | null> {
  const items = await getQueueItems();
  // 找狀態為 unread 且最早進入排隊的項目 (createdAt 最早)
  const unreadItems = items
    .filter((i) => i.status === 'unread')
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  return unreadItems.length > 0 ? unreadItems[0] : null;
}

export async function retryQueueItem(id: string): Promise<QueueItem | null> {
  return updateQueueItem(id, {
    status: 'unread',
    stepNote: '🔄 準備重新解析...',
    error: undefined,
  });
}

export async function removeQueueItem(id: string): Promise<void> {
  const items = await getQueueItems();
  const updated = items.filter((i) => i.id !== id);
  await saveQueueItems(updated);
}

export async function clearDoneQueueItems(spaceId?: string): Promise<void> {
  const items = await getQueueItems();
  let updated: QueueItem[];
  if (spaceId) {
    const cleanSpace = normalizeSpaceId(spaceId);
    updated = items.filter(
      (i) => !(normalizeSpaceId(i.spaceId) === cleanSpace && i.status === 'done')
    );
  } else {
    updated = items.filter((i) => i.status !== 'done');
  }
  await saveQueueItems(updated);
}

export async function getQueueSummary(spaceId?: string): Promise<QueueSummary> {
  const items = await getQueueItems(spaceId);
  const summary: QueueSummary = {
    total: items.length,
    unread: 0,
    processing: 0,
    done: 0,
    failed: 0,
  };

  for (const item of items) {
    if (item.status === 'unread') summary.unread++;
    else if (item.status === 'processing') summary.processing++;
    else if (item.status === 'done') summary.done++;
    else if (item.status === 'failed') summary.failed++;
  }

  return summary;
}

// 供舊版 API 相容用之過渡函式
export async function getInboxItems(): Promise<ParsedItem[]> {
  return [];
}
export async function addInboxItem(_item: ParsedItem): Promise<void> {}
export async function clearInboxItems(): Promise<void> {
  await clearDoneQueueItems();
}
export async function deleteInboxItem(id: string): Promise<void> {
  await removeQueueItem(id);
}
