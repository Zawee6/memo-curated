import fs from 'fs/promises';
import path from 'path';
import { ParsedItem, AINoteItem } from '@/types/item';
import { NotificationConfig } from '@/lib/notificationService';
import { normalizeItemLocations, fixPlaceMetadata } from '@/lib/location-normalizer';
export { normalizeItemLocations, fixPlaceMetadata };
import { cleanLocationName } from '@/lib/entityDeduplication';
import {
  sanitizeAndConsolidatePlaces,
  enrichPlaceWithGoogleMaps,
  isMissingStreetAddress,
} from '@/lib/place-enricher';
export { sanitizeAndConsolidatePlaces, enrichPlaceWithGoogleMaps };

const DATA_DIR = path.join(process.cwd(), '.data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const TAGS_FILE = path.join(DATA_DIR, 'tags.json');

export const INITIAL_SEED_ITEMS: ParsedItem[] = [];

export interface DbSchema {
  items: ParsedItem[];
  aiNotebook: AINoteItem[];
  notificationConfig?: NotificationConfig;
}

export const MASTER_SPACE_ALIASES = ['boss', 'master'];

export function isMasterSpaceAlias(raw?: string | null): boolean {
  if (!raw) return false;
  const clean = raw.trim().toLowerCase();
  return MASTER_SPACE_ALIASES.includes(clean);
}

/**
 * 空間代號正規化與安全防護
 * 只允許小寫英數字、連字號與底線，長度限 50 字元，防止任何路徑穿越
 * 專屬暗號（boss / master）自動映射至主空間 default
 */
export function normalizeSpaceId(raw?: string | null): string {
  if (!raw) return 'default';
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === 'default') return 'default';
  if (isMasterSpaceAlias(trimmed)) return 'default';
  const cleaned = trimmed.replace(/[^a-z0-9_-]/g, '');
  if (!cleaned || cleaned === 'default' || isMasterSpaceAlias(cleaned)) return 'default';
  return cleaned.slice(0, 50);
}

/**
 * 取得指定空間的資料庫檔案路徑
 * - 'default' 或未指定：.data/db.json（100% 保留現有主資料庫，無縫相容）
 * - 其他朋友代號：.data/users/${spaceId}.json
 */
export function getDbFilePath(spaceId?: string): string {
  const cleanSpace = normalizeSpaceId(spaceId);
  if (cleanSpace === 'default') {
    return DB_FILE;
  }
  return path.join(USERS_DIR, `${cleanSpace}.json`);
}

/**
 * 從 HTTP Request（Header 或 Query）萃取空間代號
 * 1. 優先讀取 Header 'x-space-id'
 * 2. 次要讀取 URL Query '?space=xxx' 或 '?spaceId=xxx'
 * 3. 預設回傳 'default'
 */
export function getSpaceIdFromRequest(req: Request | any): string {
  if (!req) return 'default';

  // 1. Header 'x-space-id'
  try {
    const headerSpace =
      typeof req.headers?.get === 'function'
        ? req.headers.get('x-space-id')
        : req.headers?.['x-space-id'];
    if (headerSpace) {
      const clean = normalizeSpaceId(headerSpace);
      if (clean) return clean;
    }
  } catch {}

  // 2. Query param '?space=xxx' or '?spaceId=xxx'
  try {
    if (typeof req.url === 'string') {
      const url = new URL(req.url, 'http://localhost:3000');
      const querySpace = url.searchParams.get('space') || url.searchParams.get('spaceId');
      if (querySpace) {
        const clean = normalizeSpaceId(querySpace);
        if (clean) return clean;
      }
    }
  } catch {}

  return 'default';
}

export function getRawSpaceIdFromRequest(req: Request | any): string | null {
  if (!req) return null;
  try {
    const headerSpace =
      typeof req.headers?.get === 'function'
        ? req.headers.get('x-space-id')
        : req.headers?.['x-space-id'];
    if (headerSpace) {
      return headerSpace.trim().toLowerCase();
    }
  } catch {}

  try {
    if (typeof req.url === 'string') {
      const url = new URL(req.url, 'http://localhost:3000');
      const querySpace = url.searchParams.get('space') || url.searchParams.get('spaceId');
      if (querySpace) {
        return querySpace.trim().toLowerCase();
      }
    }
  } catch {}

  return null;
}

/**
 * 檢查請求是否具有讀取主空間 (default / .data/db.json) 的權限
 * 條件：
 * 1. 來自本機 (localhost / 127.0.0.1)
 * 2. 或持有管理員 Token (x-admin-token)
 * 3. 或傳入了專屬暗號別名 (如 ?space=boss 或 ?space=master)
 */
export function canAccessDefaultSpace(req: Request | any): boolean {
  if (!req) return true;
  if (checkIsAdminRequest(req)) return true;
  const raw = getRawSpaceIdFromRequest(req);
  if (isMasterSpaceAlias(raw)) return true;
  return false;
}


/**
 * 確保資料庫檔案與父目錄存在
 */
async function ensureDbInitialized(spaceId?: string): Promise<string> {
  const cleanSpace = normalizeSpaceId(spaceId);
  const targetFile = getDbFilePath(cleanSpace);
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    if (cleanSpace !== 'default') {
      await fs.mkdir(USERS_DIR, { recursive: true });
    }
    try {
      await fs.access(targetFile);
    } catch {
      await fs.writeFile(
        targetFile,
        JSON.stringify({ items: [], aiNotebook: [] }, null, 2),
        'utf-8'
      );
    }
  } catch (err) {
    console.error(`[ServerDB] Failed to initialize DB file (${targetFile}):`, err);
  }
  return targetFile;
}

let isEnrichingBackground = false;
function triggerBackgroundPlaceEnrichment(items: ParsedItem[], spaceId?: string) {
  if (isEnrichingBackground) return;
  const missing = items.find((i) => isMissingStreetAddress(i));
  if (!missing) return;

  isEnrichingBackground = true;
  setTimeout(async () => {
    try {
      const enriched = await enrichPlaceWithGoogleMaps(missing);
      if (!isMissingStreetAddress(enriched)) {
        console.log(
          `[ServerDB] 🗺️ Successfully enriched address for "${enriched.title}": ${enriched.placeInfo?.address}`
        );
        const db = await readDb(spaceId);
        const updatedItems = db.items.map((it) => (it.id === enriched.id ? enriched : it));
        const { consolidatedItems } = sanitizeAndConsolidatePlaces(updatedItems);
        await writeDb(
          { items: consolidatedItems, aiNotebook: db.aiNotebook, notificationConfig: db.notificationConfig },
          spaceId
        );
      }
    } catch (e) {
      console.warn(`[ServerDB] Background enrichment error for "${missing.title}":`, e);
    } finally {
      isEnrichingBackground = false;
    }
  }, 1500);
}

export function deduplicateItems(items: ParsedItem[]): ParsedItem[] {
  const { consolidatedItems } = sanitizeAndConsolidatePlaces(items);
  return consolidatedItems;
}

export async function readDb(spaceId?: string): Promise<DbSchema> {
  const cleanSpace = normalizeSpaceId(spaceId);
  const targetFile = await ensureDbInitialized(cleanSpace);
  try {
    const raw = await fs.readFile(targetFile, 'utf-8');
    if (!raw.trim()) return { items: [], aiNotebook: [] };
    const parsed = JSON.parse(raw);
    const rawItems: ParsedItem[] = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed.items) ? parsed.items : []);
    const aiNotebook: AINoteItem[] = Array.isArray(parsed.aiNotebook)
      ? parsed.aiNotebook.filter(Boolean).map((note: AINoteItem) => {
          if (note.resultData && typeof note.resultData === 'object') {
            return {
              ...note,
              resultData: {
                ...note.resultData,
                pairings: Array.isArray(note.resultData.pairings) ? note.resultData.pairings : [],
                sharedIngredientsHighlight: Array.isArray(
                  note.resultData.sharedIngredientsHighlight
                )
                  ? note.resultData.sharedIngredientsHighlight
                  : [],
                stops: Array.isArray(note.resultData.stops) ? note.resultData.stops : [],
                shoppingItems: Array.isArray(note.resultData.shoppingItems)
                  ? note.resultData.shoppingItems
                  : [],
              },
            };
          }
          return note;
        })
      : [];

    const { consolidatedItems: rawConsolidated, changed } = sanitizeAndConsolidatePlaces(rawItems);
    const consolidatedItems = rawConsolidated.filter(Boolean).map(normalizeItemLocations);

    // 比對是否發生資料自動校正，若有則立即持久化寫回磁碟
    const rawItemsSig = JSON.stringify(rawItems);
    const normItemsSig = JSON.stringify(consolidatedItems);
    if (changed || rawItemsSig !== normItemsSig) {
      await writeDb(
        { items: consolidatedItems, aiNotebook, notificationConfig: parsed.notificationConfig },
        cleanSpace
      );
    }

    // 僅在寫入時才需補全，讀取時不進行主動背景運算，防止產生讀取觸發寫入的循環
    // triggerBackgroundPlaceEnrichment(consolidatedItems, cleanSpace);

    return {
      items: consolidatedItems,
      aiNotebook,
      notificationConfig: parsed.notificationConfig,
    };
  } catch (err) {
    console.error(`[ServerDB] Error reading ${targetFile}:`, err);
    return { items: [], aiNotebook: [] };
  }
}

export async function writeDb(data: DbSchema, spaceId?: string): Promise<void> {
  const cleanSpace = normalizeSpaceId(spaceId);
  const targetFile = await ensureDbInitialized(cleanSpace);
  await fs.writeFile(targetFile, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getServerItems(spaceId?: string): Promise<ParsedItem[]> {
  const db = await readDb(spaceId);
  return db.items;
}

export async function saveServerItem(item: ParsedItem, spaceId?: string): Promise<ParsedItem[]> {
  const db = await readDb(spaceId);
  const normalized = normalizeItemLocations(item);
  const { consolidatedItems } = sanitizeAndConsolidatePlaces([normalized, ...db.items]);
  db.items = consolidatedItems;
  await writeDb(db, spaceId);
  return db.items;
}

export async function saveServerItems(items: ParsedItem[], spaceId?: string): Promise<ParsedItem[]> {
  const db = await readDb(spaceId);
  const { consolidatedItems } = sanitizeAndConsolidatePlaces(items);
  db.items = consolidatedItems;
  await writeDb(db, spaceId);
  return db.items;
}

export async function saveServerItemsBatch(
  newItems: ParsedItem[],
  spaceId?: string
): Promise<ParsedItem[]> {
  if (!Array.isArray(newItems) || newItems.length === 0) {
    return getServerItems(spaceId);
  }
  const db = await readDb(spaceId);
  const { consolidatedItems } = sanitizeAndConsolidatePlaces([...newItems, ...db.items]);
  db.items = consolidatedItems;
  await writeDb(db, spaceId);
  return db.items;
}

export async function updateServerItem(
  id: string,
  partial: Partial<ParsedItem>,
  spaceId?: string
): Promise<ParsedItem[]> {
  const db = await readDb(spaceId);
  db.items = db.items.map((item) =>
    item.id === id ? normalizeItemLocations({ ...item, ...partial, id }) : item
  );
  await writeDb(db, spaceId);
  return db.items;
}

export async function deleteServerItem(id: string, spaceId?: string): Promise<ParsedItem[]> {
  const db = await readDb(spaceId);
  db.items = db.items.filter((item) => item.id !== id);
  await writeDb(db, spaceId);
  return db.items;
}

export async function clearServerItems(spaceId?: string): Promise<ParsedItem[]> {
  const db = await readDb(spaceId);
  db.items = [];
  await writeDb(db, spaceId);
  return [];
}

/**
 * 列出所有已存在的空間代號（包含主空間 default）
 */
export async function listAllSpaces(): Promise<string[]> {
  const spaces = ['default'];
  try {
    await fs.mkdir(USERS_DIR, { recursive: true });
    const files = await fs.readdir(USERS_DIR);
    for (const f of files) {
      if (f.endsWith('.json')) {
        spaces.push(f.replace(/\.json$/, ''));
      }
    }
  } catch {}
  return spaces;
}

/**
 * 跨空間更新卡片之縮圖網址 (Auto-Heal 自癒專用)
 */
export async function updateItemThumbnailAcrossSpaces(
  id: string,
  newThumbnailUrl: string
): Promise<boolean> {
  if (!id || !newThumbnailUrl) return false;
  let updated = false;

  // 1. 檢查主空間 default
  try {
    const mainDb = await readDb('default');
    const itemIndex = mainDb.items.findIndex((i) => i.id === id);
    if (itemIndex !== -1) {
      mainDb.items[itemIndex].thumbnailUrl = newThumbnailUrl;
      await writeDb(mainDb, 'default');
      updated = true;
    }
  } catch (err) {
    console.warn('[serverDb] Failed to update thumbnail in default space:', err);
  }

  // 2. 檢查使用者空間 (.data/users/*.json)
  try {
    const files = await fs.readdir(USERS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const space = file.replace(/\.json$/, '');
        try {
          const userDb = await readDb(space);
          const idx = userDb.items.findIndex((i) => i.id === id);
          if (idx !== -1) {
            userDb.items[idx].thumbnailUrl = newThumbnailUrl;
            await writeDb(userDb, space);
            updated = true;
          }
        } catch {}
      }
    }
  } catch {}

  return updated;
}

// ==================== 📓 AI 背景思考記事本 (AI Notebook) ====================

export async function getAINotebook(spaceId?: string): Promise<AINoteItem[]> {
  const db = await readDb(spaceId);
  return [...db.aiNotebook].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function saveAINote(note: AINoteItem, spaceId?: string): Promise<AINoteItem[]> {
  const db = await readDb(spaceId);
  const existingIdx = db.aiNotebook.findIndex((n) => n.id === note.id);
  if (existingIdx >= 0) {
    db.aiNotebook[existingIdx] = note;
  } else {
    db.aiNotebook = [note, ...db.aiNotebook];
  }
  await writeDb(db, spaceId);
  return db.aiNotebook;
}

export async function updateAINote(
  id: string,
  partial: Partial<AINoteItem>,
  spaceId?: string
): Promise<AINoteItem[]> {
  const db = await readDb(spaceId);
  db.aiNotebook = db.aiNotebook.map((note) =>
    note.id === id ? { ...note, ...partial, id } : note
  );
  await writeDb(db, spaceId);
  return db.aiNotebook;
}

export async function deleteAINote(id: string, spaceId?: string): Promise<AINoteItem[]> {
  const db = await readDb(spaceId);
  db.aiNotebook = db.aiNotebook.filter((note) => note.id !== id);
  await writeDb(db, spaceId);
  return db.aiNotebook;
}

// ==================== 🏷️ 全域自訂標籤 (Custom Tags) ====================

export const DEFAULT_PRESET_TAGS = [
  '⭐ 常用菜譜',
  '🇯🇵 日式',
  '🍝 西式',
  '🥢 台式/中式',
  '🌶️ 韓式/泰式',
  '🥗 清淡/減脂',
  '⚡ 快手菜',
];

export async function getGlobalCustomTags(): Promise<string[]> {
  await ensureDbInitialized();
  try {
    const raw = await fs.readFile(TAGS_FILE, 'utf-8');
    if (!raw.trim()) return DEFAULT_PRESET_TAGS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_PRESET_TAGS;
    const set = new Set([...DEFAULT_PRESET_TAGS, ...parsed]);
    return Array.from(set);
  } catch {
    return DEFAULT_PRESET_TAGS;
  }
}

export async function addGlobalCustomTag(tag: string): Promise<string[]> {
  const current = await getGlobalCustomTags();
  const trimmed = tag.trim();
  if (!trimmed) return current;
  if (!current.includes(trimmed)) {
    const updated = [...current, trimmed];
    await fs.writeFile(TAGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }
  return current;
}

export async function removeGlobalCustomTag(tag: string): Promise<string[]> {
  const current = await getGlobalCustomTags();
  const trimmed = tag.trim();
  const updated = current.filter((t) => t !== trimmed);
  await fs.writeFile(TAGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

// =========================================================================
// 🔐 主機管理員驗證與多空間概覽 (Admin Auth & Spaces Discovery)
// =========================================================================

export const SYSTEM_ADMIN_PIN = process.env.ADMIN_PIN || '8888';

export function getAdminToken(): string {
  return 'memo_admin_' + Buffer.from(SYSTEM_ADMIN_PIN).toString('base64');
}

export function verifyAdminPin(pin?: string | null): boolean {
  if (!pin) return false;
  return pin.trim() === SYSTEM_ADMIN_PIN.trim();
}

/**
 * 檢查 HTTP 請求是否來自本機主機管理員，或帶有合法的管理員通行 Token
 */
export function checkIsAdminRequest(req: Request | any): boolean {
  if (!req) return false;

  // 1. 檢查 Header 'x-admin-token' 或 'x-is-host' 或專屬暗號別名 (boss / master)
  try {
    const token =
      typeof req.headers?.get === 'function'
        ? req.headers.get('x-admin-token')
        : req.headers?.['x-admin-token'];
    if (token && token === getAdminToken()) {
      return true;
    }

    const isHostHeader =
      typeof req.headers?.get === 'function'
        ? req.headers.get('x-is-host')
        : req.headers?.['x-is-host'];
    if (isHostHeader === 'true') {
      return true;
    }

    const rawSpace = getRawSpaceIdFromRequest(req);
    if (isMasterSpaceAlias(rawSpace)) {
      return true;
    }
  } catch {}

  // 2. 檢查是否為外部轉發代理 (例如 Cloudflare Tunnel、ngrok、外部反向代理)
  try {
    const xForwardedFor =
      typeof req.headers?.get === 'function'
        ? req.headers.get('x-forwarded-for')
        : req.headers?.['x-forwarded-for'];
    if (xForwardedFor) {
      const clientIp = xForwardedFor.split(',')[0].trim();
      if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1') {
        // 外部訪客 IP：必須持有 x-admin-token / x-is-host / 暗號才能視為管理員
        return false;
      }
    }

    // 3. 本機 localhost / 127.0.0.1 內部連線自動視為本機管理員
    const host =
      typeof req.headers?.get === 'function'
        ? req.headers.get('host')
        : req.headers?.['host'];
    if (
      host &&
      (host.includes('localhost') ||
        host.includes('127.0.0.1'))
    ) {
      return true;
    }
  } catch {}

  return false;
}

export interface SpaceSummaryItem {
  id: string;
  spaceId: string;
  name: string;
  itemCount: number;
  totalItems: number;
  countsByCategory: {
    recipe: number;
    place: number;
    media: number;
    product: number;
  };
  recipeCount: number;
  placeCount: number;
  mediaCount: number;
  pickCount: number;
  aiTasksCount: number;
  updatedAt: number;
  lastActiveAt: number;
  latestItemTitle: string | null;
  isDefault: boolean;
  hasPushConfig: boolean;
}

function buildSpaceSummary(
  spaceId: string,
  name: string,
  isDefault: boolean,
  db: DbSchema,
  statMtimeMs: number
): SpaceSummaryItem {
  const items = Array.isArray(db.items) ? db.items : [];
  const aiNotes = Array.isArray(db.aiNotebook) ? db.aiNotebook : [];

  let latestUpdate = statMtimeMs || 0;
  let latestItemTime = -1;
  let latestItemTitle: string | null = null;

  for (const item of items) {
    const t = item.createdAt || 0;
    if (t > latestUpdate) latestUpdate = t;
    if (t > latestItemTime && item.title) {
      latestItemTime = t;
      latestItemTitle = item.title;
    }
  }

  if (!latestItemTitle && items.length > 0) {
    latestItemTitle = items[0]?.title || null;
  }

  for (const note of aiNotes) {
    const rawCreated = note.createdAt;
    const t = typeof rawCreated === 'number' ? rawCreated : rawCreated ? Date.parse(String(rawCreated)) || 0 : 0;
    if (t > latestUpdate) latestUpdate = t;
  }

  const recipe = items.filter((i) => i.category === 'recipe').length;
  const place = items.filter((i) => i.category === 'place').length;
  const media = items.filter((i) => i.category === 'media').length;
  const product = items.filter(
    (i) => i.category === 'account' || i.category === 'product' || i.category === 'general'
  ).length;

  return {
    id: spaceId,
    spaceId,
    name,
    itemCount: items.length,
    totalItems: items.length,
    countsByCategory: {
      recipe,
      place,
      media,
      product,
    },
    recipeCount: recipe,
    placeCount: place,
    mediaCount: media,
    pickCount: product,
    aiTasksCount: aiNotes.length,
    updatedAt: latestUpdate,
    lastActiveAt: latestUpdate,
    latestItemTitle,
    isDefault,
    hasPushConfig: Boolean(
      db.notificationConfig?.barkKey || db.notificationConfig?.ntfyTopic
    ),
  };
}

/**
 * 掃描伺服器端所有空間（包含 default 主空間與 users/ 下所有朋友專屬空間）
 */
export async function getAllSpacesSummary(): Promise<SpaceSummaryItem[]> {
  await ensureDbInitialized();
  const list: SpaceSummaryItem[] = [];

  // 1. 主空間 default (.data/db.json)
  try {
    const defaultDb = await readDb('default');
    let mtime = 0;
    try {
      const stat = await fs.stat(DB_FILE);
      mtime = stat.mtimeMs;
    } catch {}

    list.push(
      buildSpaceSummary('default', '👑 主空間 (default)', true, defaultDb, mtime)
    );
  } catch (e) {
    console.warn('Failed to read default space summary:', e);
  }

  // 2. 朋友獨立空間 (.data/users/*.json)
  try {
    await fs.mkdir(USERS_DIR, { recursive: true });
    const userFiles = await fs.readdir(USERS_DIR);

    for (const file of userFiles) {
      if (!file.endsWith('.json') || file.endsWith('-notification.json')) continue;
      const spaceId = file.replace(/\.json$/, '');
      if (spaceId === 'default') continue;

      try {
        const filePath = path.join(USERS_DIR, file);
        const stat = await fs.stat(filePath);
        const userDb = await readDb(spaceId);

        list.push(
          buildSpaceSummary(
            spaceId,
            `👤 ${spaceId} 專屬空間`,
            false,
            userDb,
            stat.mtimeMs
          )
        );
      } catch (err) {
        console.warn(`Failed to inspect user space ${file}:`, err);
      }
    }
  } catch (e) {
    console.warn('Failed to read users directory:', e);
  }

  // 排序：default 永遠在最前，其餘依最近更新時間排序
  return list.sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return b.lastActiveAt - a.lastActiveAt;
  });
}

/**
 * 建立或初始化一個指定的朋友空間
 */
export async function createSpace(spaceId: string): Promise<SpaceSummaryItem[]> {
  const clean = normalizeSpaceId(spaceId);
  if (!clean || clean === 'default') {
    return getAllSpacesSummary();
  }
  await ensureDbInitialized(clean);
  return getAllSpacesSummary();
}

/**
 * 刪除或清空指定的朋友空間（嚴禁刪除 default 主空間）
 */
export async function deleteOrClearSpace(
  rawSpaceId: string,
  action: 'delete' | 'clear' = 'delete'
): Promise<SpaceSummaryItem[]> {
  const trimmed = (rawSpaceId || '').trim().toLowerCase();
  const clean = normalizeSpaceId(trimmed);

  // 安全防呆保護：嚴禁刪除或透過此 API 清空 'default' 主空間
  if (!trimmed || !clean || clean === 'default' || isMasterSpaceAlias(trimmed)) {
    throw new Error('安全保護：嚴禁刪除主機主空間 (default)！');
  }

  const targetFile = path.join(USERS_DIR, `${clean}.json`);
  const notifFile = path.join(USERS_DIR, `${clean}-notification.json`);

  if (action === 'clear') {
    await fs.mkdir(USERS_DIR, { recursive: true });
    await fs.writeFile(
      targetFile,
      JSON.stringify({ items: [], aiNotebook: [] }, null, 2),
      'utf-8'
    );
  } else {
    try {
      await fs.unlink(targetFile);
    } catch (e: any) {
      if (e?.code !== 'ENOENT') {
        throw e;
      }
    }
    try {
      await fs.unlink(notifFile);
    } catch {}
  }

  return getAllSpacesSummary();
}

