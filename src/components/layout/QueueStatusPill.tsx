'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { QueueItem, QueueSummary } from '@/types/queue';
import { useAppState } from '@/providers/AppStateProvider';
import {
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Trash2,
  X,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatShortUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace('www.', '');

    if (host.includes('instagram.com')) {
      const match = url.pathname.match(/\/(?:reel|p)\/([^/?#]+)/i);
      const code = match ? match[1].slice(0, 6) : '';
      return `IG Reel ${code ? `(${code}...)` : ''}`;
    }

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      if (url.pathname.includes('/shorts/')) {
        const id = url.pathname.split('/shorts/')[1]?.slice(0, 5) || '';
        return `YT Shorts ${id ? `(${id}...)` : ''}`;
      }
      return 'YouTube 影音';
    }

    if (host.includes('threads.net')) {
      return 'Threads 貼文';
    }

    if (host.includes('tiktok.com')) {
      return 'TikTok 影片';
    }

    const path = url.pathname.length > 10 ? url.pathname.slice(0, 10) + '...' : url.pathname;
    return `${host}${path === '/' ? '' : path}`;
  } catch {
    return rawUrl.length > 20 ? rawUrl.slice(0, 20) + '...' : rawUrl;
  }
}

let lastSyncDoneTs = 0;

export function QueueStatusPill({
  variant = 'floating',
}: {
  variant?: 'floating' | 'sidebar' | 'embedded';
}) {
  const { openDetailById, syncFromServer, addToast, selectedDetailItem, spaceId } =
    useAppState();

  const syncFromServerRef = useRef(syncFromServer);
  syncFromServerRef.current = syncFromServer;
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<QueueSummary>({
    total: 0,
    unread: 0,
    processing: 0,
    done: 0,
    failed: 0,
  });
  const [isProcessingLocal, setIsProcessingLocal] = useState(false);
  // 記錄先前正處於 unread 或 processing 中的任務 ID
  const activeProcessingTaskIdsRef = useRef<Set<string>>(new Set());
  const isPollingRef = useRef(false);

  // 1. 抓取最新佇列
  const fetchQueue = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const res = await fetch(`/memo/api/inbox?space=${encodeURIComponent(spaceId)}`, {
        cache: 'no-store',
        headers: { 'x-space-id': spaceId },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems((prev) => {
          const prevIds = prev.map((i) => `${i.id}:${i.status}`).join(',');
          const nextIds = data.items.map((i: QueueItem) => `${i.id}:${i.status}`).join(',');
          return prevIds === nextIds ? prev : data.items;
        });

        // 檢查是否有「剛好由 processing / unread 轉為 done」的新完成項目
        const newlyDoneItems: QueueItem[] = [];
        const currentActiveIds = new Set<string>();

        for (const it of data.items) {
          if (it.status === 'unread' || it.status === 'processing') {
            currentActiveIds.add(it.id);
          } else if (it.status === 'done' && activeProcessingTaskIdsRef.current.has(it.id)) {
            newlyDoneItems.push(it);
          }
        }

        // 更新進行中追蹤集合
        activeProcessingTaskIdsRef.current = currentActiveIds;

        // 僅當有剛剛從 processing 轉為 done 的那一瞬間，才靜默更新卡片 state，絕不整頁刷新
        if (newlyDoneItems.length > 0) {
          const now = Date.now();
          if (now - lastSyncDoneTs > 1500) {
            lastSyncDoneTs = now;
            syncFromServerRef.current?.();
            for (const doneItem of newlyDoneItems) {
              if (doneItem.resultItemTitle) {
                addToastRef.current?.({
                  type: 'success',
                  message: `✨ ${doneItem.isMerged ? '【已合併】' : '【已入庫】'}${doneItem.resultItemTitle}`,
                });
              }
            }
          }
        }

        if (data.summary) {
          const newSummary: QueueSummary = data.summary;
          setSummary((prev) => {
            if (
              prev.total === newSummary.total &&
              prev.unread === newSummary.unread &&
              prev.processing === newSummary.processing &&
              prev.done === newSummary.done &&
              prev.failed === newSummary.failed
            ) {
              return prev;
            }
            return newSummary;
          });
        }
      }
    } catch {
      // 靜默容錯
    } finally {
      isPollingRef.current = false;
    }
  }, [spaceId]);

  // 2. 觸發背景消化處理器
  const triggerProcess = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (isProcessingLocal) return;
    try {
      setIsProcessingLocal(true);
      const res = await fetch('/memo/api/inbox/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-space-id': spaceId,
        },
      });
      const data = await res.json();
      if (data.success && data.processed) {
        fetchQueue();
      }
    } catch {
      // 靜默
    } finally {
      setIsProcessingLocal(false);
    }
  }, [isProcessingLocal, spaceId, fetchQueue]);

  // 3. 自動輪詢 (有任務時 2.5 秒 / 閒置時 10 秒，切換分頁時暫停)
  useEffect(() => {
    fetchQueue();

    const hasActiveTasks = summary.unread > 0 || summary.processing > 0;
    const intervalTime = hasActiveTasks ? 2500 : 10000;

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchQueue().then(() => {
        // 若有 unread 且無 processing 正在跑，主動觸發消化
        if (summary.unread > 0 && summary.processing === 0 && !isProcessingLocal) {
          triggerProcess();
        }
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [summary.unread, summary.processing, isProcessingLocal, spaceId, fetchQueue, triggerProcess]);

  // 4. 重試單一項目
  const handleRetry = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch('/memo/api/inbox/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-space-id': spaceId,
        },
        body: JSON.stringify({ id, spaceId }),
      });
      fetchQueue();
      triggerProcess();
    } catch {}
  };

  // 5. 移除單一項目
  const handleRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/memo/api/inbox?id=${encodeURIComponent(id)}&space=${encodeURIComponent(spaceId)}`, {
        method: 'DELETE',
        headers: { 'x-space-id': spaceId },
      });
      fetchQueue();
    } catch {}
  };

  // 6. 清空所有已完成項目
  const handleClearDone = async () => {
    try {
      await fetch(`/memo/api/inbox?space=${encodeURIComponent(spaceId)}`, {
        method: 'DELETE',
        headers: { 'x-space-id': spaceId },
      });
      fetchQueue();
    } catch {}
  };

  const activeProcessing = items.find((i) => i.status === 'processing');
  const activeUnread = items.find((i) => i.status === 'unread');
  const isBusy = summary.unread > 0 || summary.processing > 0;

  if (variant !== 'embedded') {
    return null;
  }

  if (variant === 'embedded') {
    return (
      <div className="space-y-4">
        {/* 即時狀態列與操作列 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-control bg-surface-2/80 border border-line">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              {isBusy ? (
                <>
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-accent opacity-75" />
                  <Loader2 className="w-4 h-4 text-accent animate-spin" />
                </>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-ink flex items-center gap-2">
                <span>{isBusy ? '背景佇列解析中' : '背景佇列就緒待命'}</span>
                {isBusy && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-semibold border border-accent/30">
                    {summary.processing > 0 ? `解析中 (${summary.processing})` : `排隊中 (${summary.unread})`}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-3">
                總計 {summary.total} 筆 · 待排隊 {summary.unread} · 成功 {summary.done} · 失敗 {summary.failed}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                fetchQueue();
                triggerProcess();
              }}
              disabled={isProcessingLocal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface border border-line hover:border-line-strong text-xs font-medium text-ink hover:text-ink-primary transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isProcessingLocal && 'animate-spin')} />
              <span>手動觸發解析</span>
            </button>
            {summary.done > 0 && (
              <button
                type="button"
                onClick={handleClearDone}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs text-ink-3 hover:text-danger hover:bg-danger/10 border border-transparent hover:border-danger/20 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清除已完成 ({summary.done})</span>
              </button>
            )}
          </div>
        </div>

        {/* 佇列項目列表 */}
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-3 border border-dashed border-line rounded-control space-y-1">
              <p className="font-medium text-ink-2">佇列目前為空，所有背景任務已處理完畢 ⚡</p>
              <p className="text-[11px]">可透過頂部輸入框貼上網址，或使用 iPhone 捷徑分享連結進來。</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.status === 'done' && item.resultItemId) {
                      openDetailById(item.resultItemId);
                    }
                  }}
                  className={cn(
                    'p-3 rounded-control border text-xs transition-all',
                    item.status === 'done' && 'cursor-pointer hover:border-accent/40 bg-surface-2/60 border-line hover:bg-surface-2',
                    item.status === 'processing' && 'bg-amber-500/5 border-amber-500/30',
                    item.status === 'failed' && 'bg-danger/5 border-danger/20',
                    item.status === 'unread' && 'bg-surface-2/40 border-line'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.status === 'unread' && <Clock className="w-3.5 h-3.5 text-ink-3 shrink-0" />}
                      {item.status === 'processing' && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" />}
                      {item.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      {item.status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" />}

                      <span className="font-medium text-ink truncate text-xs">
                        {formatShortUrl(item.url)}
                      </span>

                      {item.isMerged && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-400/30 shrink-0 font-medium">
                          已合併
                        </span>
                      )}
                    </div>

                    {item.status === 'failed' && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleRetry(e, item.id)}
                          className="px-2 py-0.5 rounded bg-surface border border-line hover:border-line-strong text-[11px] text-ink flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>重試</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleRemove(e, item.id)}
                          className="p-1 rounded text-ink-3 hover:text-danger hover:bg-danger/10 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[11px] text-ink-3">
                    <p className="truncate">
                      {item.status === 'done' && item.resultItemTitle
                        ? item.resultItemTitle
                        : item.stepNote}
                    </p>
                    {item.status === 'done' && (
                      <span className="text-[11px] text-accent flex items-center gap-1 shrink-0 ml-2 font-medium">
                        點擊查看卡片 <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
