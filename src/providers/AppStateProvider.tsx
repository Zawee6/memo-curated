'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { ParsedItem, AskQueryResponse, MovieCandidateItem, AINoteItem } from '@/types/item';
import { ToastItem } from '@/types/ui';
import {
  storageService,
  ensureLocalStorageSchemaVersion,
  normalizeItem,
} from '@/lib/storage';
import { loadCartSelectedIds, saveCartSelectedIds } from '@/lib/cart';
import { ToastContainer } from '@/components/ui/Toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessage';
import { SpaceGateModal } from '@/components/layout/SpaceGateModal';

export interface SpaceSummaryItem {
  spaceId: string;
  name: string;
  itemCount: number;
  totalItems?: number;
  countsByCategory?: {
    recipe: number;
    place: number;
    media: number;
    product: number;
  };
  recipeCount: number;
  placeCount: number;
  mediaCount: number;
  pickCount: number;
  aiTasksCount?: number;
  updatedAt: number;
  lastActiveAt?: number;
  latestItemTitle?: string | null;
  isDefault: boolean;
  hasPushConfig?: boolean;
}

export interface AppStateContextValue {
  items: ParsedItem[];
  isLoading: boolean;
  isCloudSync: boolean;

  // 👥 多人共享空間管理
  spaceId: string;
  setSpaceId: (id: string) => void;
  isDefaultSpace: boolean;
  isHostAdmin: boolean;
  formatSpaceHref: (href: string) => string;
  deleteOrClearFriendSpace: (
    targetSpaceId: string,
    action?: 'delete' | 'clear'
  ) => Promise<{ success: boolean; error?: string }>;

  // 🔐 管理員權限與多空間巡視
  isAdmin: boolean;
  unlockAdmin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  lockAdmin: () => void;
  allSpaces: SpaceSummaryItem[];
  refreshAllSpaces: () => Promise<void>;
  loadingSpaces: boolean;
  needsSpaceInput: boolean;
  setNeedsSpaceInput: (val: boolean) => void;

  // Detail Sheet & Random Decision ("幫我決定")
  selectedDetailItem: ParsedItem | null;
  isRandomDecision: boolean;
  openDetail: (item: ParsedItem) => void;
  openDetailById: (id: string) => void;
  openRandomDecision: (pool: ParsedItem[]) => void;
  rerollRandomDecision: () => void;
  closeDetail: () => void;

  // Storage actions
  saveItem: (item: ParsedItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  deleteSourcePost: (itemId: string, sourceId: string) => Promise<void>;
  clearAll: () => Promise<void>;

  // Parsing
  isParsing: boolean;
  parseUrl: (
    url: string,
    note?: string
  ) => Promise<{ success: boolean; data?: ParsedItem; error?: string }>;
  parseMovieCandidate: (
    candidate: MovieCandidateItem,
    note?: string
  ) => Promise<{ success: boolean; data?: ParsedItem; error?: string }>;
  parseScreenshot: (
    imageBase64: string,
    note?: string
  ) => Promise<{ success: boolean; data?: ParsedItem; error?: string }>;

  // Cart
  cartSelectedIds: string[];
  toggleCartItem: (id: string) => void;
  setCartSelectedIds: (ids: string[]) => void;

  // 食譜私廚開伙狀態 (幾人份動態換算 & 今日開伙勾選)
  targetServings: number;
  setTargetServings: (servings: number) => void;
  selectedCookingRecipeIds: string[];
  toggleCookingRecipe: (id: string) => void;
  setSelectedCookingRecipeIds: (ids: string[]) => void;

  // 景點勾選狀態 (跨城市記憶 & AI 行程規劃)
  selectedPlaceIds: string[];
  toggleSelectedPlace: (id: string) => void;
  setSelectedPlaceIds: (ids: string[]) => void;

  // 手動觸發伺服器同步
  syncFromServer: () => Promise<void>;

  // 個人化標籤、最愛、已完成追蹤與私人筆記
  toggleFavorite: (id: string) => Promise<void>;
  toggleCompleted: (id: string) => Promise<void>;
  updateUserNote: (id: string, userNote: string) => Promise<void>;
  updateItemTags: (id: string, tags: string[]) => Promise<void>;
  updateItemPlaceLocation: (id: string, city: string, district: string) => Promise<void>;
  globalCustomTags: string[];
  addGlobalCustomTag: (tag: string) => Promise<void>;

  // Toasts
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;

  // AI Ask & Search
  askQuery: string;
  setAskQuery: (q: string) => void;
  askResult: AskQueryResponse | null;
  setAskResult: (res: AskQueryResponse | null) => void;
  isAskingAI: boolean;
  submitAskAI: (query: string) => Promise<void>;
  clearAskAI: () => void;

  // 📓 AI 背景思考記事本
  isAINotebookOpen: boolean;
  setIsAINotebookOpen: (open: boolean) => void;
  openAINotebook: () => void;
  aiNotes: AINoteItem[];
  refreshAINotes: () => Promise<void>;
  thinkingTasksCount: number;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

const COOKING_SELECTED_KEY = 'memo_cooking_selected_ids_v1';
const TARGET_SERVINGS_KEY = 'memo_target_servings_v1';
const PLACE_SELECTED_KEY = 'memo_place_selected_ids_v1';

// 全站全域記憶體持久快取 (0ms 瞬間切換與 Stale-While-Revalidate，依 spaceId 隔離)
const globalMemoryItemsCache: Record<string, ParsedItem[]> = {};
const globalMemoryAINotesCache: Record<string, AINoteItem[]> = {};

function getInitialSpaceId(): string {
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const paramSpace = urlParams.get('space') || urlParams.get('spaceId');
      if (paramSpace) {
        const clean = paramSpace.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (clean) return clean;
      }
      const stored = localStorage.getItem('memo_space_id');
      if (stored) {
        const clean = stored.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (clean) return clean;
      }
    } catch {}
  }
  return 'default';
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [spaceId, setSpaceIdState] = useState<string>('default');
  const [isAdmin, setIsAdmin] = useState<boolean>(true);
  const [isHostAdmin, setIsHostAdmin] = useState<boolean>(false);
  const [needsSpaceInput, setNeedsSpaceInput] = useState<boolean>(false);

  const isDefaultSpace = spaceId === 'default' || spaceId === 'boss' || spaceId === 'master';

  const formatSpaceHref = useCallback(
    (href: string) => {
      if (!spaceId || spaceId === 'default' || spaceId === 'boss' || spaceId === 'master') {
        return href;
      }
      const [path, query] = href.split('?');
      const params = new URLSearchParams(query || '');
      if (!params.has('space')) {
        params.set('space', spaceId);
      }
      const newQuery = params.toString();
      return newQuery ? `${path}?${newQuery}` : path;
    },
    [spaceId]
  );

  const setSpaceId = useCallback((newId: string) => {
    const clean = newId ? newId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : 'default';
    const target = clean || 'default';
    setSpaceIdState(target);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('memo_space_id', target);
        localStorage.setItem('albo_space', target);
        if (target !== 'default' && target !== 'boss' && target !== 'master') {
          setIsHostAdmin(false);
          setIsAdmin(false);
        }
        const newUrl = new URL(window.location.href);
        if (target === 'default') {
          newUrl.searchParams.delete('space');
          newUrl.searchParams.delete('spaceId');
        } else {
          newUrl.searchParams.set('space', target);
        }
        window.history.replaceState({}, '', newUrl.toString());
      } catch {}
    }
    storageService.setSpaceId(target);
  }, []);

  // 永遠以空陣列初始化，嚴禁在 useState 中同步讀取 window.localStorage，確保 SSR 與 Client 初次渲染一致
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCloudSync, setIsCloudSync] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] =
    useState<ParsedItem | null>(null);
  const [isRandomDecision, setIsRandomDecision] = useState(false);
  const randomPoolRef = useRef<ParsedItem[]>([]);

  // Cart selection
  const [cartSelectedIds, setCartSelectedIdsState] = useState<string[]>([]);

  // 食譜私廚狀態
  const [targetServings, setTargetServingsState] = useState<number>(2);
  const [selectedCookingRecipeIds, setSelectedCookingRecipeIdsState] = useState<
    string[]
  >([]);

  // 景點勾選狀態
  const [selectedPlaceIds, setSelectedPlaceIdsState] = useState<string[]>([]);

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const newToast: ToastItem = { ...toast, id };
      setToasts((prev) => [...prev, newToast]);

      const duration = toast.duration ?? 4000;
      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  // 全域風格標籤
  const [globalCustomTags, setGlobalCustomTags] = useState<string[]>([
    '⭐ 常用菜譜',
    '🇯🇵 日式',
    '🍝 西式',
    '🥢 台式/中式',
    '🌶️ 韓式/泰式',
    '🥗 清淡/減脂',
    '⚡ 快手菜',
  ]);

  // AI Ask state
  const [askQuery, setAskQuery] = useState('');
  const [askResult, setAskResult] = useState<AskQueryResponse | null>(null);
  const [isAskingAI, setIsAskingAI] = useState(false);

  // 📓 AI 背景思考記事本
  const [isAINotebookOpen, setIsAINotebookOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState<AINoteItem[]>([]);

  // 👥 多空間管理与主機管理員視角判定
  const [allSpaces, setAllSpaces] = useState<SpaceSummaryItem[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState<boolean>(false);

  const refreshAllSpaces = useCallback(async () => {
    if (typeof window !== 'undefined') {
      const storedHost = localStorage.getItem('memo_is_host') === 'true';
      const urlParams = new URLSearchParams(window.location.search);
      const paramSpace = (urlParams.get('space') || urlParams.get('spaceId') || '')
        .trim()
        .toLowerCase();
      const isDefaultOrMaster =
        !paramSpace ||
        paramSpace === 'default' ||
        paramSpace === 'boss' ||
        paramSpace === 'master' ||
        spaceId === 'default' ||
        spaceId === 'boss' ||
        spaceId === 'master';
      const canFetchAdmin = isDefaultOrMaster || storedHost;
      if (!canFetchAdmin) {
        return;
      }
    }

    setLoadingSpaces(true);
    try {
      const res = await fetch('/memo/api/admin/spaces', {
        cache: 'no-store',
        headers: storageService.getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.spaces)) {
        setAllSpaces(data.spaces);
      }
    } catch (e) {
      console.warn('Failed to load all spaces:', e);
    } finally {
      setLoadingSpaces(false);
    }
  }, [spaceId]);

  useEffect(() => {
    if (isHostAdmin) {
      refreshAllSpaces();
    }
  }, [isHostAdmin, refreshAllSpaces]);

  const deleteOrClearFriendSpace = useCallback(
    async (targetSpaceId: string, action: 'delete' | 'clear' = 'delete') => {
      try {
        const res = await fetch(
          `/memo/api/admin/spaces?space=${encodeURIComponent(targetSpaceId)}&action=${action}`,
          {
            method: 'DELETE',
            headers: storageService.getAuthHeaders(),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || '操作失敗' };
        }
        if (Array.isArray(data.spaces)) {
          setAllSpaces(data.spaces);
        } else {
          await refreshAllSpaces();
        }
        delete globalMemoryItemsCache[targetSpaceId];
        delete globalMemoryAINotesCache[targetSpaceId];
        if (action === 'delete' && spaceId === targetSpaceId) {
          setSpaceId('default');
        } else if (action === 'clear' && spaceId === targetSpaceId) {
          setItems([]);
          setAiNotes([]);
        }
        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
      }
    },
    [refreshAllSpaces, spaceId, setSpaceId]
  );

  const unlockAdmin = useCallback(
    async (pin: string) => {
      try {
        const res = await fetch('/memo/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });
        const data = await res.json();
        if (data.success && data.token) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('memo_admin_token', data.token);
            localStorage.setItem('memo_is_host', 'true');
          }
          setIsAdmin(true);
          setIsHostAdmin(true);
          setNeedsSpaceInput(false);
          await refreshAllSpaces();
          const latest = await storageService.syncNow();
          setItems(latest);
          addToast({ type: 'success', message: '🔐 管理員身分已驗證解鎖！' });
          return { success: true };
        } else {
          return { success: false, error: data.error || '通行碼錯誤' };
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg || '驗證失敗' };
      }
    },
    [refreshAllSpaces, addToast]
  );

  const lockAdmin = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('memo_admin_token');
    }
    setIsAdmin(false);
    addToast({ type: 'info', message: '已鎖定管理員模式' });
  }, [addToast]);

  const refreshAINotes = useCallback(async (targetSpace = spaceId) => {
    try {
      const res = await fetch(`/memo/api/ai-tasks?space=${encodeURIComponent(targetSpace)}`, {
        cache: 'no-store',
        headers: storageService.getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.notes)) {
        const safeNotes: AINoteItem[] = data.notes.filter(Boolean).map((n: AINoteItem) => {
          if (n.resultData && typeof n.resultData === 'object') {
            return {
              ...n,
              resultData: {
                ...n.resultData,
                pairings: Array.isArray(n.resultData.pairings) ? n.resultData.pairings : [],
                sharedIngredientsHighlight: Array.isArray(
                  n.resultData.sharedIngredientsHighlight
                )
                  ? n.resultData.sharedIngredientsHighlight
                  : [],
                stops: Array.isArray(n.resultData.stops) ? n.resultData.stops : [],
                shoppingItems: Array.isArray(n.resultData.shoppingItems)
                  ? n.resultData.shoppingItems
                  : [],
              },
            };
          }
          return n;
        });
        globalMemoryAINotesCache[targetSpace] = safeNotes;
        setAiNotes(safeNotes);
      }
    } catch (e) {
      console.warn('Failed to refresh AI notes:', e);
    }
  }, [spaceId]);

  const thinkingTasksCount = (aiNotes ?? []).filter((n) => n?.status === 'thinking').length;

  // 監聽 URL 中的 ?space=xxx 變更或從 localStorage 恢復空間，並嚴格判定 isHostAdmin 與未授權保護
  useEffect(() => {
    if (typeof window === 'undefined') return;
    ensureLocalStorageSchemaVersion();
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const rawParam = (urlParams.get('space') || urlParams.get('spaceId') || '').trim().toLowerCase();
      const storedHost = localStorage.getItem('memo_is_host') === 'true';
      const storedSpace = (
        localStorage.getItem('albo_space') ||
        localStorage.getItem('memo_space_id') ||
        ''
      ).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

      // 1. 若 URL 帶有 ?space=boss 或 ?space=master -> 主機最高權限通道
      if (rawParam === 'boss' || rawParam === 'master') {
        localStorage.setItem('memo_is_host', 'true');
        localStorage.setItem('albo_space', 'default');
        localStorage.setItem('memo_space_id', 'default');
        setIsHostAdmin(true);
        setIsAdmin(true);
        setNeedsSpaceInput(false);
        setSpaceIdState('default');
        storageService.setSpaceId('default');
        return;
      }

      // 2. 若 URL 帶有具體朋友空間代碼 (例如 ?space=amy，且非 default)
      if (rawParam && rawParam !== 'default') {
        const cleanParam = rawParam.replace(/[^a-z0-9_-]/g, '');
        if (cleanParam) {
          localStorage.setItem('albo_space', cleanParam);
          localStorage.setItem('memo_space_id', cleanParam);
          // 朋友空間嚴禁擁有主機管理權限
          setIsHostAdmin(false);
          setIsAdmin(false);
          setNeedsSpaceInput(false);
          setSpaceIdState(cleanParam);
          storageService.setSpaceId(cleanParam);
          return;
        }
      }

      // 3. 若 URL 沒有空間參數，或為 ?space=default
      // 3A. 若以前是朋友身分（非 host），且本地有存過朋友空間（例如 amy）
      if (!storedHost && storedSpace && storedSpace !== 'default') {
        // 自動維持朋友空間，並使用 replaceState 補齊 URL，避免重整時丟失 ?space=amy
        setSpaceIdState(storedSpace);
        storageService.setSpaceId(storedSpace);
        setIsHostAdmin(false);
        setIsAdmin(false);
        setNeedsSpaceInput(false);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('space', storedSpace);
        window.history.replaceState({}, '', newUrl.toString());
        return;
      }

      // 3B. 若是主機本機（已認證為 host）
      if (storedHost) {
        setSpaceIdState('default');
        storageService.setSpaceId('default');
        setIsHostAdmin(true);
        setIsAdmin(true);
        setNeedsSpaceInput(false);
        return;
      }

      // 3C. 未授權的新訪客/外部存取 default 主機空間
      // 嚴格攔截：不可洩漏主機收藏，彈出 SpaceGateModal 要求輸入邀請代碼或 PIN
      setSpaceIdState('default');
      storageService.setSpaceId('default');
      setIsHostAdmin(false);
      setIsAdmin(false);
      setNeedsSpaceInput(true);
    } catch {}
  }, []);

  // 當 spaceId 切換時，重設本地快取與重新拉取該空間資料
  useEffect(() => {
    const cachedItems = (globalMemoryItemsCache[spaceId] || []).map(normalizeItem);
    setItems(cachedItems);
    setIsLoading(cachedItems.length === 0);
    setAiNotes(globalMemoryAINotesCache[spaceId] || []);
    refreshAINotes(spaceId);
  }, [spaceId, refreshAINotes]);

  // 當有任務在 thinking 時，每 2.5 秒自動輪詢更新狀態 (切換分頁時暫停)
  useEffect(() => {
    if (thinkingTasksCount === 0) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshAINotes(spaceId);
    }, 2500);
    return () => clearInterval(interval);
  }, [thinkingTasksCount, refreshAINotes, spaceId]);

  const openAINotebook = useCallback(() => {
    setIsAINotebookOpen(true);
    refreshAINotes(spaceId);
  }, [refreshAINotes, spaceId]);

  // Detail Sheet handlers
  const openDetail = useCallback((item: ParsedItem) => {
    setIsRandomDecision(false);
    setSelectedDetailItem(normalizeItem(item));
  }, []);

  const openDetailById = useCallback((id: string) => {
    setIsRandomDecision(false);
    const found = items.find((i) => i.id === id);
    if (found) {
      setSelectedDetailItem(normalizeItem(found));
    } else {
      fetch(`/memo/api/items?space=${encodeURIComponent(spaceId)}`, {
        cache: 'no-store',
        headers: { 'x-space-id': spaceId },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.items)) {
            const serverFound = data.items.find((i: ParsedItem) => i.id === id);
            if (serverFound) {
              setSelectedDetailItem(normalizeItem(serverFound));
            }
          }
        })
        .catch(() => {});
    }
  }, [items, spaceId]);

  const openRandomDecision = useCallback(
    (pool: ParsedItem[]) => {
      if (!pool || pool.length === 0) {
        addToast({
          type: 'info',
          message: '目前篩選範圍內沒有項目可供抽選！',
        });
        return;
      }
      randomPoolRef.current = pool;
      const candidates =
        pool.length > 1 && selectedDetailItem
          ? pool.filter((i) => i.id !== selectedDetailItem.id)
          : pool;
      const picked =
        candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
      setIsRandomDecision(true);
      setSelectedDetailItem(normalizeItem(picked));
      addToast({
        type: 'success',
        message: `🎲 已為你隨機選出：${picked.title}`,
      });
    },
    [selectedDetailItem, addToast]
  );

  const rerollRandomDecision = useCallback(() => {
    const pool = randomPoolRef.current;
    if (!pool || pool.length === 0) return;
    const candidates =
      pool.length > 1 && selectedDetailItem
        ? pool.filter((i) => i.id !== selectedDetailItem.id)
        : pool;
    const picked =
      candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
    setIsRandomDecision(true);
    setSelectedDetailItem(normalizeItem(picked));
    addToast({
      type: 'info',
      message: `🎲 換一個試試：${picked.title}`,
    });
  }, [selectedDetailItem, addToast]);

  const closeDetail = useCallback(() => {
    setIsRandomDecision(false);
    setSelectedDetailItem(null);
  }, []);

  // Subscribe to storage
  useEffect(() => {
    setIsCloudSync(storageService.isCloudSync());

    const unsubscribe = storageService.subscribeItems((newItems) => {
      const safeItems = (newItems ?? []).filter(Boolean).map(normalizeItem);
      const currentSpace = storageService.getSpaceId();
      globalMemoryItemsCache[currentSpace] = safeItems;
      setItems((prev) => {
        if (prev.length === safeItems.length) {
          const prevSig = prev.map((i) => `${i.id}:${i.createdAt || ''}:${i.isFavorite}:${i.isCompleted}:${i.userNote || ''}:${i.sources?.length || 0}`).join(';');
          const nextSig = safeItems.map((i) => `${i.id}:${i.createdAt || ''}:${i.isFavorite}:${i.isCompleted}:${i.userNote || ''}:${i.sources?.length || 0}`).join(';');
          if (prevSig === nextSig) return prev;
        }
        return safeItems;
      });
      setIsLoading(false);
      setSelectedDetailItem((current) => {
        if (!current) return null;
        const updated = safeItems.find((i) => i.id === current.id);
        return updated ? normalizeItem(updated) : normalizeItem(current);
      });

      // 嚴格清理：確保食譜選單僅含 recipe，景點行程僅含 place，絕不混入其他分類
      if (safeItems.length > 0) {
        const validRecipeIds = new Set(
          safeItems.filter((i) => i.category === 'recipe').map((i) => i.id)
        );
        const validPlaceIds = new Set(
          safeItems.filter((i) => i.category === 'place').map((i) => i.id)
        );
        setSelectedCookingRecipeIdsState((prev) => {
          const cleaned = prev.filter((id) => validRecipeIds.has(id));
          if (cleaned.length !== prev.length) {
            try {
              localStorage.setItem(COOKING_SELECTED_KEY, JSON.stringify(cleaned));
            } catch {}
            return cleaned;
          }
          return prev;
        });
        setSelectedPlaceIdsState((prev) => {
          const cleaned = prev.filter((id) => validPlaceIds.has(id));
          if (cleaned.length !== prev.length) {
            try {
              localStorage.setItem(PLACE_SELECTED_KEY, JSON.stringify(cleaned));
            } catch {}
            return cleaned;
          }
          return prev;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Load initial cart & cooking selections from localStorage
  useEffect(() => {
    ensureLocalStorageSchemaVersion();
    const saved = loadCartSelectedIds();
    setCartSelectedIdsState(saved);

    try {
      const savedCooking = localStorage.getItem(COOKING_SELECTED_KEY);
      if (savedCooking) {
        const parsed = JSON.parse(savedCooking);
        if (Array.isArray(parsed)) setSelectedCookingRecipeIdsState(parsed);
      }
      const savedServings = localStorage.getItem(TARGET_SERVINGS_KEY);
      if (savedServings) {
        const num = parseInt(savedServings, 10);
        if (num > 0 && num <= 30) setTargetServingsState(num);
      }
      const savedPlaces = localStorage.getItem(PLACE_SELECTED_KEY);
      if (savedPlaces) {
        const parsed = JSON.parse(savedPlaces);
        if (Array.isArray(parsed)) setSelectedPlaceIdsState(parsed);
      }
    } catch {}
  }, []);

  const setCartSelectedIds = useCallback((ids: string[]) => {
    setCartSelectedIdsState(ids);
    saveCartSelectedIds(ids);
  }, []);

  const toggleCartItem = useCallback((id: string) => {
    setCartSelectedIdsState((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((i) => i !== id) : [...prev, id];
      saveCartSelectedIds(next);
      return next;
    });
  }, []);

  const setTargetServings = useCallback((servings: number) => {
    const safe = Math.max(1, Math.min(30, Math.round(servings)));
    setTargetServingsState(safe);
    try {
      localStorage.setItem(TARGET_SERVINGS_KEY, String(safe));
    } catch {}
  }, []);

  const setSelectedCookingRecipeIds = useCallback((ids: string[]) => {
    setSelectedCookingRecipeIdsState(ids);
    try {
      localStorage.setItem(COOKING_SELECTED_KEY, JSON.stringify(ids));
    } catch {}
  }, []);

  const toggleCookingRecipe = useCallback(
    (id: string) => {
      const target = items.find((i) => i.id === id);
      if (target && target.category !== 'recipe') return;
      setSelectedCookingRecipeIdsState((prev) => {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((i) => i !== id) : [...prev, id];
        try {
          localStorage.setItem(COOKING_SELECTED_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [items]
  );

  const setSelectedPlaceIds = useCallback((ids: string[]) => {
    setSelectedPlaceIdsState(ids);
    try {
      localStorage.setItem(PLACE_SELECTED_KEY, JSON.stringify(ids));
    } catch {}
  }, []);

  const toggleSelectedPlace = useCallback(
    (id: string) => {
      const target = items.find((i) => i.id === id);
      if (target && target.category !== 'place') return;
      setSelectedPlaceIdsState((prev) => {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((i) => i !== id) : [...prev, id];
        try {
          localStorage.setItem(PLACE_SELECTED_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [items]
  );

  const syncFromServer = useCallback(async () => {
    const latest = await storageService.syncNow();
    const safeLatest = (latest ?? []).filter(Boolean).map(normalizeItem);
    setItems((prev) => {
      if (prev.length === safeLatest.length) {
        const prevSig = prev.map((i) => `${i.id}:${i.createdAt || ''}:${i.isFavorite}:${i.isCompleted}:${i.userNote || ''}:${i.sources?.length || 0}`).join(';');
        const nextSig = safeLatest.map((i) => `${i.id}:${i.createdAt || ''}:${i.isFavorite}:${i.isCompleted}:${i.userNote || ''}:${i.sources?.length || 0}`).join(';');
        if (prevSig === nextSig) return prev;
      }
      return safeLatest;
    });
    try {
      const res = await fetch(`/memo/api/items?space=${encodeURIComponent(spaceId)}`, {
        cache: 'no-store',
        headers: storageService.getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 || data.isProtected) {
        if (!isAdmin || !isHostAdmin) {
          setItems([]);
          setNeedsSpaceInput(true);
          setIsHostAdmin(false);
        }
        return;
      }
      if (data.success && Array.isArray(data.customTags)) {
        setGlobalCustomTags(data.customTags);
      }
    } catch {}
  }, [spaceId, isAdmin, isHostAdmin]);

  // 最愛收藏切換（僅切換該卡片自身的 isFavorite，絕不混入食譜選單或景點行程）
  const toggleFavorite = useCallback(
    async (id: string) => {
      const target = items.find((i) => i.id === id);
      if (!target) return;
      const nextFav = !target.isFavorite;

      // 樂觀更新
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isFavorite: nextFav } : i))
      );
      if (selectedDetailItem?.id === id) {
        setSelectedDetailItem((prev) =>
          prev ? { ...prev, isFavorite: nextFav } : null
        );
      }

      await storageService.updateItem(id, { isFavorite: nextFav });
    },
    [items, selectedDetailItem]
  );

  // 已完成狀態切換（已去過／已煮過／已看過）
  const toggleCompleted = useCallback(
    async (id: string) => {
      const target = items.find((i) => i.id === id);
      if (!target) return;
      const nextCompleted = !target.isCompleted;

      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isCompleted: nextCompleted } : i))
      );
      if (selectedDetailItem?.id === id) {
        setSelectedDetailItem((prev) =>
          prev ? { ...prev, isCompleted: nextCompleted } : null
        );
      }

      await storageService.updateItem(id, { isCompleted: nextCompleted });

      const doneLabel =
        target.category === 'recipe'
          ? '✅ 已標記為「已煮過」'
          : target.category === 'place'
            ? '✅ 已標記為「已去過」'
            : target.category === 'media'
              ? '✅ 已標記為「已看過」'
              : '✅ 已標記為「已完成」';

      addToast({
        type: 'success',
        message: nextCompleted ? doneLabel : '已改回「待體驗」',
      });
    },
    [items, selectedDetailItem, addToast]
  );

  // 私人評價與筆記更新（自動儲存）
  const updateUserNote = useCallback(
    async (id: string, userNote: string) => {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, userNote } : i))
      );
      if (selectedDetailItem?.id === id) {
        setSelectedDetailItem((prev) =>
          prev ? { ...prev, userNote } : null
        );
      }
      await storageService.updateItem(id, { userNote });
    },
    [selectedDetailItem]
  );

  const updateItemTags = useCallback(
    async (id: string, tags: string[]) => {
      const target = items.find((i) => i.id === id);
      if (!target) return;

      // 樂觀更新
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, customTags: tags } : i))
      );
      if (selectedDetailItem?.id === id) {
        setSelectedDetailItem((prev) =>
          prev ? { ...prev, customTags: tags } : null
        );
      }

      await storageService.updateItem(id, { customTags: tags });
      setGlobalCustomTags((prev) => Array.from(new Set([...prev, ...tags])));
      addToast({
        type: 'success',
        message: '🏷️ 已更新風格標籤！',
      });
    },
    [items, selectedDetailItem, addToast]
  );

  const updateItemPlaceLocation = useCallback(
    async (id: string, city: string, district: string) => {
      const target = items.find((i) => i.id === id);
      if (!target) return;
      const updatedPlaceInfo = {
        ...(target.placeInfo || {}),
        city,
        district,
      };

      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, placeInfo: updatedPlaceInfo } : i))
      );
      if (selectedDetailItem?.id === id) {
        setSelectedDetailItem((prev) =>
          prev ? { ...prev, placeInfo: updatedPlaceInfo } : null
        );
      }

      await storageService.updateItem(id, { placeInfo: updatedPlaceInfo });
      addToast({
        type: 'success',
        message: `📍 已更新地點地區：${city} ${district}`.trim(),
      });
    },
    [items, selectedDetailItem, addToast]
  );

  const addGlobalCustomTag = useCallback(async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setGlobalCustomTags((prev) => Array.from(new Set([...prev, trimmed])));
    try {
      await fetch('/memo/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-space-id': spaceId,
        },
        body: JSON.stringify({ addTag: trimmed, spaceId }),
      });
    } catch {}
  }, [spaceId]);

  // Save Item
  const saveItem = useCallback(
    async (item: ParsedItem) => {
      await storageService.saveItem(item);
      addToast({
        type: 'success',
        message: `已儲存：${item.title}`,
      });
    },
    [addToast]
  );

  // Delete Item
  const deleteItem = useCallback(
    async (id: string) => {
      const target = items.find((i) => i.id === id);
      await storageService.deleteItem(id);
      if (selectedDetailItem?.id === id) {
        setSelectedDetailItem(null);
      }
      setSelectedCookingRecipeIdsState((prev) =>
        prev.filter((rid) => rid !== id)
      );
      addToast({
        type: 'info',
        message: target ? `已刪除「${target.title}」` : '已刪除項目',
      });
    },
    [items, selectedDetailItem, addToast]
  );

  // Delete a single source post from item.sources
  const deleteSourcePost = useCallback(
    async (itemId: string, sourceId: string) => {
      const target = items.find((i) => i.id === itemId);
      if (!target || !target.sources) return;
      const remainingSources = target.sources.filter((s) => s.id !== sourceId);
      const updated = { ...target, sources: remainingSources };
      await storageService.saveItem(updated);
      if (selectedDetailItem?.id === itemId) {
        setSelectedDetailItem(updated);
      }
      addToast({
        type: 'info',
        message: '已從本電影中移除該篇影評來源',
      });
    },
    [items, selectedDetailItem, addToast]
  );

  // Clear all
  const clearAll = useCallback(async () => {
    await storageService.clearAll();
    setSelectedDetailItem(null);
    setCartSelectedIdsState([]);
    saveCartSelectedIds([]);
    setSelectedCookingRecipeIdsState([]);
    addToast({
      type: 'info',
      message: '已清空所有靈感與採買資料',
    });
  }, [addToast]);

  // Parse URL
  const parseUrl = useCallback(
    async (
      url: string,
      note?: string
    ): Promise<{ success: boolean; data?: ParsedItem; error?: string }> => {
      setIsParsing(true);
      try {
        const res = await fetch('/memo/api/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-space-id': spaceId,
          },
          body: JSON.stringify({ url, extraContent: note, spaceId }),
        });
        const data = await res.json();
        if (!data.success || !data.data) {
          throw new Error(data.error || '解析失敗，請確認網址格式');
        }
        const mainItem: ParsedItem = data.item || data.data;
        const allCreatedItems: ParsedItem[] =
          Array.isArray(data.splitItems) && data.splitItems.length > 0
            ? data.splitItems
            : Array.isArray(data.additionalItems) && data.additionalItems.length > 0
              ? [mainItem, ...data.additionalItems]
              : [mainItem];

        if (allCreatedItems.length > 1) {
          await storageService.syncNow();
          addToast({
            type: 'success',
            message: `🎉 已自動將合集影片拆分為 ${allCreatedItems.length} 間獨立店家卡片並入庫！`,
          });
        } else {
          await storageService.saveItem(mainItem);
          if (data.isMerged) {
            addToast({
              type: 'success',
              message: `🧠 已自動與既有【${mainItem.title}】合併收錄（新增至相關影評/貼文）`,
            });
          } else {
            addToast({
              type: 'success',
              message: `✨ 已成功結構化收藏並同步至伺服器：${mainItem.title}`,
            });
          }
        }
        return { success: true, data: mainItem };
      } catch (err: unknown) {
        const friendlyMsg = getFriendlyErrorMessage(err);
        addToast({
          type: 'error',
          message: friendlyMsg,
        });
        return { success: false, error: friendlyMsg };
      } finally {
        setIsParsing(false);
      }
    },
    [spaceId, addToast]
  );

  // Parse Screenshot (Vision)
  const parseScreenshot = useCallback(
    async (
      imageBase64: string,
      note?: string
    ): Promise<{ success: boolean; data?: ParsedItem; error?: string }> => {
      setIsParsing(true);
      try {
        const res = await fetch('/memo/api/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-space-id': spaceId,
          },
          body: JSON.stringify({ imageBase64, extraContent: note, spaceId }),
        });
        const data = await res.json();
        if (!data.success || !data.data) {
          throw new Error(data.error || '截圖辨識失敗，請再試一次');
        }
        const item: ParsedItem = data.data;
        await storageService.saveItem(item);
        if (item.subPlaces && item.subPlaces.length > 1) {
          await storageService.syncNow();
        }
        if (data.isMerged) {
          addToast({
            type: 'success',
            message: `📸 截圖辨識完成，已自動合併入【${item.title}】`,
          });
        } else {
          addToast({
            type: 'success',
            message: `📸 截圖辨識成功，已建檔：${item.title}`,
          });
        }
        return { success: true, data: item };
      } catch (err: unknown) {
        const friendlyMsg = getFriendlyErrorMessage(err);
        addToast({
          type: 'error',
          message: friendlyMsg,
        });
        return { success: false, error: friendlyMsg };
      } finally {
        setIsParsing(false);
      }
    },
    [spaceId, addToast]
  );

  // Parse Movie Candidate
  const parseMovieCandidate = useCallback(
    async (
      candidate: MovieCandidateItem,
      note?: string
    ): Promise<{ success: boolean; data?: ParsedItem; error?: string }> => {
      setIsParsing(true);
      try {
        const res = await fetch('/memo/api/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-space-id': spaceId,
          },
          body: JSON.stringify({ candidate, extraContent: note, spaceId }),
        });
        const data = await res.json();
        if (!data.success || !data.data) {
          throw new Error(data.error || '建立電影卡片失敗');
        }
        const item: ParsedItem = data.data;
        await storageService.saveItem(item);
        if (data.isMerged) {
          addToast({
            type: 'success',
            message: `🧠 已自動與既有【${item.title}】合併收錄`,
          });
        } else {
          addToast({
            type: 'success',
            message: `🎬 已成功建檔電影：${item.title}`,
          });
        }
        return { success: true, data: item };
      } catch (err: unknown) {
        const friendlyMsg = getFriendlyErrorMessage(err);
        addToast({
          type: 'error',
          message: friendlyMsg,
        });
        return { success: false, error: friendlyMsg };
      } finally {
        setIsParsing(false);
      }
    },
    [spaceId, addToast]
  );

  // AI Ask
  const submitAskAI = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || items.length === 0) return;

      setIsAskingAI(true);
      try {
        const res = await fetch('/memo/api/ask', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-space-id': spaceId,
          },
          body: JSON.stringify({
            query: trimmed,
            spaceId,
            items: items.map((i) => ({
              id: i.id,
              title: i.title,
              category: i.category,
              summary: i.summary,
              tags: i.tags,
              placeInfo: i.placeInfo,
              recipeInfo: i.recipeInfo,
              shoppingPlan: i.shoppingPlan,
            })),
          }),
        });

        const data: AskQueryResponse = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'AI 回答生成失敗');
        }
        setAskResult(data);
      } catch (err: unknown) {
        const friendlyMsg = getFriendlyErrorMessage(err);
        addToast({
          type: 'error',
          message: friendlyMsg,
        });
      } finally {
        setIsAskingAI(false);
      }
    },
    [items, spaceId, addToast]
  );

  const clearAskAI = useCallback(() => {
    setAskQuery('');
    setAskResult(null);
  }, []);

  // Note: Queue status and shortcut sync is handled by QueueStatusPill

  return (
    <AppStateContext.Provider
      value={{
        items,
        isLoading,
        isCloudSync,
        // 👥 多人共享空間管理
        spaceId,
        setSpaceId,
        isDefaultSpace,
        isHostAdmin,
        formatSpaceHref,
        deleteOrClearFriendSpace,

        // 🔐 管理員權限與多空間巡視
        isAdmin,
        unlockAdmin,
        lockAdmin,
        allSpaces,
        refreshAllSpaces,
        loadingSpaces,
        needsSpaceInput,
        setNeedsSpaceInput,

        selectedDetailItem,
        isRandomDecision,
        openDetail,
        openDetailById,
        openRandomDecision,
        rerollRandomDecision,
        closeDetail,
        saveItem,
        deleteItem,
        deleteSourcePost,
        clearAll,
        isParsing,
        parseUrl,
        parseMovieCandidate,
        parseScreenshot,
        cartSelectedIds,
        toggleCartItem,
        setCartSelectedIds,
        targetServings,
        setTargetServings,
        selectedCookingRecipeIds,
        toggleCookingRecipe,
        setSelectedCookingRecipeIds,
        selectedPlaceIds,
        toggleSelectedPlace,
        setSelectedPlaceIds,
        syncFromServer,
        toggleFavorite,
        toggleCompleted,
        updateUserNote,
        updateItemTags,
        updateItemPlaceLocation,
        globalCustomTags,
        addGlobalCustomTag,
        toasts,
        addToast,
        dismissToast,
        askQuery,
        setAskQuery,
        askResult,
        setAskResult,
        isAskingAI,
        submitAskAI,
        clearAskAI,
        isAINotebookOpen,
        setIsAINotebookOpen,
        openAINotebook,
        aiNotes,
        refreshAINotes,
        thinkingTasksCount,
      }}
    >
      {children}
      <SpaceGateModal />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
