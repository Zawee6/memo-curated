import { ParsedItem, RecipeSuggestion, ItineraryPlan } from '@/types/item';
import {
  normalizeItemLocations,
  normalizeItem,
  cleanLocationName,
} from './location-normalizer';
import { isSamePlace, mergePlaceItems } from './place-normalizer';
import { db, isFirebaseConfigured } from './firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

export { normalizeItem, normalizeItemLocations };

export const ALBO_SCHEMA_VER = '2026-v3';
const SCHEMA_VER_KEY = 'ALBO_SCHEMA_VER';
const DEFAULT_STORAGE_KEY = 'albo_saved_items_v2';
const LEGACY_STORAGE_KEY = 'albo_saved_items_v1';
const MIGRATED_FLAG_KEY = 'albo_migrated_to_server_v1';
const FIRESTORE_COLLECTION = 'albo_items';

/**
 * 強制檢查瀏覽器 localStorage 結構版本號 (ALBO_SCHEMA_VER === '2026-v3')：
 * 若版本不符，自動清除所有舊版壞快取鍵值並寫入新版本號，徹底消滅舊快取造成的連環崩潰
 */
export function ensureLocalStorageSchemaVersion(): void {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(SCHEMA_VER_KEY) !== ALBO_SCHEMA_VER) {
      const savedSpace = localStorage.getItem('memo_space_id');
      const savedToken = localStorage.getItem('memo_admin_token');
      const savedHost = localStorage.getItem('memo_is_host');
      localStorage.clear();
      if (savedSpace) localStorage.setItem('memo_space_id', savedSpace);
      if (savedToken) localStorage.setItem('memo_admin_token', savedToken);
      if (savedHost) localStorage.setItem('memo_is_host', savedHost);
      localStorage.setItem(SCHEMA_VER_KEY, ALBO_SCHEMA_VER);
    }
  } catch (e) {
    console.warn('Failed to verify localStorage schema version:', e);
  }
}

/**
 * 正規化 AI 私廚菜單 (aiSuggestion)，確保 pairings 與 sharedIngredientsHighlight 永遠為陣列
 */
export function normalizeRecipeSuggestion(raw: any): RecipeSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const pairings = Array.isArray(raw.pairings)
    ? raw.pairings.filter((p: any) => p && typeof p === 'object')
    : [];
  const sharedIngredientsHighlight = Array.isArray(raw.sharedIngredientsHighlight)
    ? raw.sharedIngredientsHighlight.filter((s: any) => typeof s === 'string')
    : [];
  return {
    ...raw,
    menuTitle: typeof raw.menuTitle === 'string' ? raw.menuTitle : '今日私廚推薦菜單',
    chefReasoning: typeof raw.chefReasoning === 'string' ? raw.chefReasoning : '',
    estimatedPrepTime: typeof raw.estimatedPrepTime === 'string' ? raw.estimatedPrepTime : '約 30 分鐘',
    pairings,
    sharedIngredientsHighlight,
  };
}

/**
 * 正規化 AI 順路行程 (itineraryPlan)，確保 stops 永遠為陣列
 */
export function normalizeItineraryPlan(raw: any): ItineraryPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const target = raw.itineraryPlan && typeof raw.itineraryPlan === 'object' ? raw.itineraryPlan : raw;
  const stops = Array.isArray(target.stops)
    ? target.stops.filter((s: any) => s && typeof s === 'object')
    : [];
  if (stops.length === 0 && !target.title && !target.dayOverview) return null;
  return {
    ...target,
    title: typeof target.title === 'string' ? target.title : 'AI 順路行程規劃',
    city: typeof target.city === 'string' ? target.city : '',
    dayOverview: typeof target.dayOverview === 'string' ? target.dayOverview : '',
    stops,
  };
}

export interface ItemStorageService {
  getItems(): Promise<ParsedItem[]>;
  saveItem(item: ParsedItem): Promise<void>;
  deleteItem(id: string): Promise<void>;
  clearAll(): Promise<void>;
  syncNow(): Promise<ParsedItem[]>;
  subscribeItems(callback: (items: ParsedItem[]) => void): () => void;
  isCloudSync(): boolean;
  setSpaceId(spaceId: string): void;
  getSpaceId(): string;
}

export class ServerAndCloudStorageService implements ItemStorageService {
  private listeners = new Set<(items: ParsedItem[]) => void>();
  private currentItems: ParsedItem[] = [];
  private isMigrating = false;
  private currentSpaceId = 'default';

  constructor() {
    if (typeof window !== 'undefined') {
      ensureLocalStorageSchemaVersion();
      try {
        const stored = localStorage.getItem('memo_space_id');
        if (stored) {
          const clean = stored.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
          if (clean) this.currentSpaceId = clean;
        }
      } catch {}
    }
  }

  private isClient(): boolean {
    return typeof window !== 'undefined';
  }

  setSpaceId(spaceId: string) {
    const clean = spaceId ? spaceId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : 'default';
    const target = clean || 'default';
    if (this.currentSpaceId !== target) {
      this.currentSpaceId = target;
      if (this.isClient()) {
        try {
          localStorage.setItem('memo_space_id', target);
        } catch {}
      }
      this.currentItems = [];
      const cached = this.getLocalCache();
      this.notify(cached);
      this.syncNow();
    }
  }

  getSpaceId(): string {
    return this.currentSpaceId;
  }

  private getStorageKey(): string {
    if (this.currentSpaceId === 'default' || this.currentSpaceId === 'boss' || this.currentSpaceId === 'master') {
      return DEFAULT_STORAGE_KEY;
    }
    return `${DEFAULT_STORAGE_KEY}_${this.currentSpaceId}`;
  }

  /**
   * 伺服器端統一資料庫 (.data/db.json) 已全面啟用，跨手機與電腦 100% 同步
   */
  isCloudSync(): boolean {
    return true;
  }

  getAuthHeaders(additional?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'x-space-id': this.currentSpaceId,
      ...(additional || {}),
    };
    if (this.isClient()) {
      try {
        const token = localStorage.getItem('memo_admin_token');
        if (token) {
          headers['x-admin-token'] = token;
        }
        const isHost = localStorage.getItem('memo_is_host');
        if (isHost === 'true') {
          headers['x-is-host'] = 'true';
        }
      } catch {}
    }
    return headers;
  }

  private notify(items: ParsedItem[]) {
    const safeItems = Array.isArray(items)
      ? items.filter(Boolean).map(normalizeItemLocations)
      : [];
    this.currentItems = safeItems;
    this.setLocalCache(safeItems);
    this.listeners.forEach((cb) => {
      try {
        cb(safeItems);
      } catch (e) {
        console.warn('Subscriber notification error:', e);
      }
    });
  }

  private isHostUser(): boolean {
    if (!this.isClient()) return false;
    try {
      return (
        localStorage.getItem('memo_is_host') === 'true' ||
        Boolean(localStorage.getItem('memo_admin_token'))
      );
    } catch {
      return false;
    }
  }

  private getLocalCache(): ParsedItem[] {
    if (!this.isClient()) return [];
    ensureLocalStorageSchemaVersion();
    // 🔒 空間隔離防護：未通過驗證的外部訪客嚴禁讀取 default 主資料庫快取
    if (this.currentSpaceId === 'default' && !this.isHostUser()) {
      return [];
    }
    try {
      const key = this.getStorageKey();
      const data =
        this.currentSpaceId === 'default'
          ? localStorage.getItem(key) || localStorage.getItem(LEGACY_STORAGE_KEY)
          : localStorage.getItem(key);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed)
        ? (parsed as ParsedItem[]).filter(Boolean).map(normalizeItemLocations)
        : [];
    } catch {
      return [];
    }
  }

  private setLocalCache(items: ParsedItem[]): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to set localStorage cache', e);
    }
  }

  /**
   * 從後端 /memo/api/items (.data/db.json) 同步最新資料（永遠以後端資料庫為唯一真實來源 Single Source of Truth）
   */
  async syncNow(): Promise<ParsedItem[]> {
    if (!this.isClient()) return [];

    try {
      // 1. 永遠優先從伺服器拉取最新清單 (帶入 x-space-id 與 ?space=)
      const res = await fetch(`/memo/api/items?space=${encodeURIComponent(this.currentSpaceId)}`, {
        method: 'GET',
        cache: 'no-store',
        headers: this.getAuthHeaders(),
      });
      const data = await res.json();

      // 🔒 伺服器端回傳 403 受保護狀態（未授權試圖存取 default 主空間）
      if (res.status === 403 || data.isProtected) {
        this.currentItems = [];
        this.notify([]);
        return [];
      }

      if (data.success && Array.isArray(data.items)) {
        const serverItems: ParsedItem[] = data.items.map(normalizeItemLocations);

        // 若伺服器為空且本地曾有舊版非空快取，才主動上傳合併（嚴禁在空陣列 [] 時覆寫後端）
        const localItems = this.getLocalCache();
        const migrationKey =
          this.currentSpaceId === 'default'
            ? MIGRATED_FLAG_KEY
            : `${MIGRATED_FLAG_KEY}_${this.currentSpaceId}`;
        const hasMigrated = localStorage.getItem(migrationKey) === 'true';
        const customLocalItems = localItems.filter(
          (i) =>
            i &&
            i.id &&
            !i.id.startsWith('demo-') &&
            !i.url?.startsWith('https://example.com')
        );

        if (!hasMigrated && serverItems.length === 0 && customLocalItems.length > 0 && !this.isMigrating) {
          this.isMigrating = true;
          try {
            localStorage.setItem(migrationKey, 'true');
            const upRes = await fetch('/memo/api/items', {
              method: 'POST',
              headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ items: customLocalItems }),
            });
            const upData = await upRes.json();
            if (upData.success && Array.isArray(upData.items)) {
              const merged = upData.items.map(normalizeItemLocations);
              this.notify(merged);
              return merged;
            }
          } catch (err) {
            console.warn('Failed to migrate localStorage to server:', err);
          } finally {
            this.isMigrating = false;
          }
        }

        // 比對是否有變更才觸發更新
        const prevSig = this.currentItems.map((i) => `${i.id}:${i.createdAt}`).join('|');
        const nextSig = serverItems.map((i: ParsedItem) => `${i.id}:${i.createdAt}`).join('|');
        if (prevSig !== nextSig || this.currentItems.length === 0) {
          this.notify(serverItems);
        }
        return serverItems;
      }
    } catch (e) {
      console.warn('Server /memo/api/items sync error, falling back to localStorage:', e);
    }

    const fallback = this.getLocalCache();
    if (fallback.length > 0 && this.currentItems.length === 0) {
      this.notify(fallback);
    }
    return this.currentItems.length > 0 ? this.currentItems : fallback;
  }

  subscribeItems(callback: (items: ParsedItem[]) => void): () => void {
    this.listeners.add(callback);

    if (this.isClient()) {
      // 1. 先立即回傳快取讓畫面零延遲顯示
      const cached = this.currentItems.length > 0 ? this.currentItems : this.getLocalCache();
      if (cached.length > 0) {
        this.currentItems = cached;
        callback(cached);
      }

      // 2. 立即向伺服器拉取並合併同步
      this.syncNow().then((serverItems) => {
        callback(serverItems);
      });

      // 3. 當手機/電腦切換視窗或喚醒時，自動從 /api/items 同步最新狀態
      const handleFocus = () => {
        this.syncNow();
      };
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          this.syncNow();
        }
      };

      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibility);

      // 4. 背景輪詢（每 5 秒同步一次，讓手機捷徑秒存後電腦畫面自動跳出新卡片）
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          this.syncNow();
        }
      }, 5000);

      return () => {
        this.listeners.delete(callback);
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibility);
        clearInterval(interval);
      };
    }

    return () => {
      this.listeners.delete(callback);
    };
  }

  async getItems(): Promise<ParsedItem[]> {
    return this.syncNow();
  }

  async saveItem(item: ParsedItem): Promise<void> {
    const normalizedItem = normalizeItemLocations(item);
    // 1. 樂觀更新本地狀態
    const current = this.currentItems.length > 0 ? this.currentItems : this.getLocalCache();
    let optimistic: ParsedItem[];

    if (normalizedItem.category === 'place') {
      const matchIdx = current.findIndex((i) => isSamePlace(i, normalizedItem));
      if (matchIdx !== -1) {
        const merged = mergePlaceItems(current[matchIdx], normalizedItem);
        optimistic = [...current];
        optimistic[matchIdx] = merged;
      } else {
        optimistic = [normalizedItem, ...current.filter((i) => i.id !== normalizedItem.id)];
      }
    } else {
      const filtered = current.filter((i) => {
        if (i.id === normalizedItem.id) return false;
        if (i.url && normalizedItem.url && i.url === normalizedItem.url && !i.url.startsWith('https://example.com')) {
          return false;
        }
        return true;
      });
      optimistic = [normalizedItem, ...filtered];
    }
    this.notify(optimistic);

    // 2. 寫入伺服器 /memo/api/items
    try {
      const res = await fetch('/memo/api/items', {
        method: 'POST',
        headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ item }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        this.notify(data.items);
      }
    } catch (e) {
      console.error('Failed to save item to /memo/api/items:', e);
    }

    // 3. 若為主空間且有設定 Firebase Firestore 亦同步備份
    if (this.currentSpaceId === 'default' && db && isFirebaseConfigured()) {
      try {
        const cleanItem = JSON.parse(JSON.stringify(item));
        await setDoc(doc(db, FIRESTORE_COLLECTION, item.id), cleanItem);
      } catch {}
    }
  }

  async updateItem(id: string, partial: Partial<ParsedItem>): Promise<void> {
    const current = this.currentItems.length > 0 ? this.currentItems : this.getLocalCache();
    const optimistic = current.map((i) => (i.id === id ? { ...i, ...partial } : i));
    this.notify(optimistic);

    try {
      const res = await fetch('/memo/api/items', {
        method: 'PUT',
        headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id, item: partial }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        this.notify(data.items);
      }
    } catch (e) {
      console.error('Failed to update item in /memo/api/items:', e);
    }
  }

  async deleteItem(id: string): Promise<void> {
    const current = this.currentItems.length > 0 ? this.currentItems : this.getLocalCache();
    const optimistic = current.filter((i) => i.id !== id);
    this.notify(optimistic);

    try {
      const res = await fetch(
        `/memo/api/items?id=${encodeURIComponent(id)}&space=${encodeURIComponent(this.currentSpaceId)}`,
        {
          method: 'DELETE',
          headers: this.getAuthHeaders(),
        }
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        this.notify(data.items);
      }
    } catch (e) {
      console.error('Failed to delete item from /memo/api/items:', e);
    }

    if (this.currentSpaceId === 'default' && db && isFirebaseConfigured()) {
      try {
        await deleteDoc(doc(db, FIRESTORE_COLLECTION, id));
      } catch {}
    }
  }

  async clearAll(): Promise<void> {
    this.notify([]);
    if (this.isClient()) {
      localStorage.removeItem(this.getStorageKey());
      if (this.currentSpaceId === 'default') {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }

    try {
      await fetch(`/memo/api/items?clearAll=true&space=${encodeURIComponent(this.currentSpaceId)}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
    } catch (e) {
      console.error('Failed to clear /memo/api/items:', e);
    }

    if (this.currentSpaceId === 'default' && db && isFirebaseConfigured()) {
      try {
        const batch = writeBatch(db);
        currentIdsForDelete(this.currentItems).forEach((id) => {
          batch.delete(doc(collection(db!, FIRESTORE_COLLECTION), id));
        });
        await batch.commit();
      } catch {}
    }
  }
}

function currentIdsForDelete(items: ParsedItem[]): string[] {
  return items.map((i) => i.id);
}

export const storageService = new ServerAndCloudStorageService();
