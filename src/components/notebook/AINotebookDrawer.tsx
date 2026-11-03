'use client';

import React, { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { useAppState } from '@/providers/AppStateProvider';
import { AINoteItem } from '@/types/item';
import { Button } from '@/components/ui/Button';
import {
  Sparkles,
  Compass,
  Clock,
  UtensilsCrossed,
  MapPin,
  Check,
  Copy,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Navigation,
  Flame,
  AlertCircle,
  Bell,
  RefreshCw,
  ShoppingCart,
  BookOpen,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildGoogleMapsMultiStopUrl,
  generateItineraryExportHtml,
  writeRichTextToClipboard,
} from '@/lib/itineraryFormatter';
import { renderTextWithLinks } from '@/lib/renderLinks';
import { getFriendlyErrorMessage } from '@/lib/errorMessage';

const SHOPPING_CATEGORY_ORDER = [
  { key: '生鮮肉品', icon: '🥩', label: '生鮮肉品 / 海鮮' },
  { key: '蔬菜水果', icon: '🥬', label: '蔬菜水果' },
  { key: '蛋奶豆製品', icon: '🥚', label: '蛋奶豆製品' },
  { key: '調味料與乾貨', icon: '🧂', label: '調味料與乾貨' },
  { key: '其他', icon: '📦', label: '其他' },
];

export function AINotebookDrawer() {
  const {
    isAINotebookOpen,
    setIsAINotebookOpen,
    aiNotes,
    refreshAINotes,
    thinkingTasksCount,
    setSelectedCookingRecipeIds,
    addToast,
    spaceId,
  } = useAppState();

  const [activeTab, setActiveTab] = useState<'all' | 'itinerary' | 'shopping'>('all');
  const [expandedNoteIds, setExpandedNoteIds] = useState<string[]>([]);
  const [expandedTextNoteIds, setExpandedTextNoteIds] = useState<string[]>([]);
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isTestingPush, setIsTestingPush] = useState(false);

  async function handleTestPushNotification() {
    setIsTestingPush(true);
    try {
      const res = await fetch(`/memo/api/notification?space=${encodeURIComponent(spaceId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-space-id': spaceId,
        },
        body: JSON.stringify({
          action: 'test',
          spaceId,
          url: typeof window !== 'undefined' ? `${window.location.origin}/memo/places` : '',
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '推播發送失敗');
      }
      addToast({
        type: 'success',
        message: `📲 ${data.message}！請檢查 iPhone 是否收到響鈴與通知。`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '測試失敗';
      addToast({ type: 'error', message: msg });
    } finally {
      setIsTestingPush(false);
    }
  }

  const itineraryCount = aiNotes.filter((n) => n.type === 'itinerary').length;
  const shoppingCount = aiNotes.filter((n) => n.type === 'shopping' || n.type === 'menu').length;

  const filteredNotes = aiNotes.filter((note) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'itinerary') return note.type === 'itinerary';
    if (activeTab === 'shopping') return note.type === 'shopping' || note.type === 'menu';
    return true;
  });

  function toggleExpand(id: string) {
    setExpandedNoteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleTextExpand(id: string) {
    setExpandedTextNoteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleCopyNote(note: AINoteItem) {
    if (!note.markdownNote) return;
    try {
      let html = '';
      if (note.type === 'itinerary' && note.resultData?.stops) {
        html = generateItineraryExportHtml(note.resultData);
      } else {
        html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; white-space: pre-wrap;">${note.markdownNote.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
      }
      await writeRichTextToClipboard(html, note.markdownNote);
      setCopiedNoteId(note.id);
      addToast({
        type: 'success',
        message: '✓ 已複製富文本筆記！貼至備忘錄或 LINE 可保留超連結。',
      });
      setTimeout(() => setCopiedNoteId(null), 2500);
    } catch {
      addToast({ type: 'error', message: '複製失敗，請手動選取文字。' });
    }
  }

  async function handleSaveToAppleNotes(note: AINoteItem) {
    if (!note.markdownNote) return;
    try {
      let html = '';
      if (note.type === 'itinerary' && note.resultData?.stops) {
        html = generateItineraryExportHtml(note.resultData);
      } else {
        html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; white-space: pre-wrap;">${note.markdownNote.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
      }
      await writeRichTextToClipboard(html, note.markdownNote);
      addToast({
        type: 'success',
        message: '📋 已複製富文本筆記！正在開啟 Apple 捷徑存入備忘錄...',
      });
      if (typeof window !== 'undefined') {
        window.location.href = `shortcuts://run-shortcut?name=Memo%E6%B8%85%E5%96%AE&input=text&text=${encodeURIComponent(
          note.markdownNote
        )}`;
      }
    } catch {
      addToast({ type: 'error', message: '存入備忘錄失敗，請手動複製' });
    }
  }

  async function handleDeleteNote(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/memo/api/ai-tasks?id=${encodeURIComponent(id)}&space=${encodeURIComponent(spaceId)}`, {
        method: 'DELETE',
        headers: { 'x-space-id': spaceId },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '刪除失敗');
      await refreshAINotes();
      addToast({ type: 'info', message: '已刪除該則 AI 筆記。' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '刪除失敗';
      addToast({ type: 'error', message: msg });
    } finally {
      setDeletingId(null);
    }
  }

  function handleApplyMenu(note: AINoteItem) {
    const pairings = note.resultData?.pairings;
    if (Array.isArray(pairings) && pairings.length > 0) {
      const ids = pairings.map((p: any) => p.recipeId).filter(Boolean);
      setSelectedCookingRecipeIds(ids);
      addToast({
        type: 'success',
        message: `🔥 已套用「${note.title}」共 ${ids.length} 道開伙菜單！`,
      });
    }
  }

  return (
    <Sheet
      isOpen={isAINotebookOpen}
      onClose={() => setIsAINotebookOpen(false)}
      title="📓 AI 背景思考記事本"
      description="在背景非同步思考完成的「順路行程」與「私廚菜單」皆持久化保存於此，隨時查閱與匯出。"
    >
      <div className="space-y-4 pb-8">
        {/* 思考中任務提示橫條 */}
        {thinkingTasksCount > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span>有 {thinkingTasksCount} 個 AI 任務正在背景深入思考中...</span>
            </div>
            <span className="text-[11px] text-amber-800/80 hidden sm:inline">
              完成後會自動更新並推播至 iPhone
            </span>
          </div>
        )}

        {/* 篩選標籤膠囊列 */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-2 border border-line text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              'flex-1 py-1.5 rounded-lg font-bold transition-all text-center cursor-pointer',
              activeTab === 'all'
                ? 'bg-surface text-ink shadow-2xs'
                : 'text-ink-3 hover:text-ink'
            )}
          >
            全部 ({aiNotes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('itinerary')}
            className={cn(
              'flex-1 py-1.5 rounded-lg font-bold transition-all text-center cursor-pointer',
              activeTab === 'itinerary'
                ? 'bg-surface text-[#3F7D58] shadow-2xs'
                : 'text-ink-3 hover:text-ink'
            )}
          >
            🗺️ 行程 ({itineraryCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shopping')}
            className={cn(
              'flex-1 py-1.5 rounded-lg font-bold transition-all text-center cursor-pointer',
              activeTab === 'shopping'
                ? 'bg-surface text-accent shadow-2xs'
                : 'text-ink-3 hover:text-ink'
            )}
          >
            🛒 購物清單 ({shoppingCount})
          </button>
        </div>

        {/* 快捷 iPhone 推播狀態與測試按鈕 */}
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-surface border border-line text-[11px] text-ink-3">
          <span className="flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">AI 思考完成自動發送推播通知至 iPhone</span>
          </span>
          <button
            type="button"
            onClick={handleTestPushNotification}
            disabled={isTestingPush}
            className="inline-flex items-center gap-1 font-bold text-accent hover:underline cursor-pointer shrink-0 disabled:opacity-50 ml-2"
            title="發送一則測試通知到您的 iPhone"
          >
            <Bell className="w-3 h-3" />
            <span>{isTestingPush ? '發送中...' : '🔔 測試推播'}</span>
          </button>
        </div>

        {/* 筆記列表 */}
        {filteredNotes.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-surface-2/40 rounded-2xl border border-line p-6">
            <div className="w-12 h-12 rounded-full bg-surface-2 border border-line flex items-center justify-center mx-auto text-ink-3">
              <Compass className="w-6 h-6 text-ink-3" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display text-sm font-bold text-ink">尚無此分類筆記</h4>
              <p className="text-xs text-ink-3 max-w-xs mx-auto leading-relaxed">
                在景點地圖點擊「AI 順路行程」或在食譜頁點擊「✨ AI 配菜」，AI 就會在後端背景思考並自動永久存檔在此！
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map((note) => {
              const isExpanded =
                expandedNoteIds.includes(note.id) || note.status === 'thinking';
              const isItinerary = note.type === 'itinerary';
              const createdDate = new Date(note.createdAt);
              const timeString = `${createdDate.getMonth() + 1}/${createdDate.getDate()} ${String(
                createdDate.getHours()
              ).padStart(2, '0')}:${String(createdDate.getMinutes()).padStart(2, '0')}`;

              const navUrl =
                isItinerary && note.resultData?.stops
                  ? buildGoogleMapsMultiStopUrl(
                      note.resultData.stops,
                      note.resultData.city,
                      note.resultData.transportMode
                    )
                  : '';

              return (
                <div
                  key={note.id}
                  className={cn(
                    'rounded-2xl border transition-all overflow-hidden bg-surface',
                    note.status === 'thinking'
                      ? 'border-amber-500/40 shadow-xs'
                      : 'border-line hover:border-black/25'
                  )}
                >
                  {/* Card Header */}
                  <div
                    onClick={() => toggleExpand(note.id)}
                    className="p-3.5 flex items-start justify-between gap-3 cursor-pointer select-none bg-surface hover:bg-surface-2/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Top Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {note.status === 'thinking' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 border border-amber-500/30 font-mono animate-pulse">
                            <Sparkles className="w-3 h-3 animate-spin" />
                            <span>AI 深入思考中...</span>
                          </span>
                        ) : note.status === 'ready' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3F7D58]/15 text-[#3F7D58] border border-[#3F7D58]/30 font-mono">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>已備妥</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 border border-rose-500/30 font-mono">
                            <AlertCircle className="w-3 h-3" />
                            <span>規劃未完成</span>
                          </span>
                        )}

                        <span className="text-[11px] font-mono text-ink-3">
                          {timeString}
                        </span>

                        {isItinerary ? (
                          note.requestParams?.transportMode && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-line text-ink-2 font-mono">
                              {note.requestParams.transportMode === 'two-wheeler'
                                ? '🛵 機車'
                                : note.requestParams.transportMode === 'driving'
                                ? '🚗 開車'
                                : note.requestParams.transportMode === 'transit'
                                ? '🚌 大眾運輸'
                                : '🚶 步行'}
                            </span>
                          )
                        ) : (
                          <>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 font-medium">
                              🛒 購物清單
                            </span>
                            {(note.resultData?.targetServings || note.requestParams?.targetServings) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-line text-ink-2 font-mono">
                                👥 {note.resultData?.targetServings || note.requestParams?.targetServings} 人份
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="font-display text-sm font-bold text-ink leading-snug">
                        {note.title}
                      </h4>
                    </div>

                    {/* Right Action Icons */}
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        disabled={deletingId === note.id}
                        className="p-1.5 rounded-lg text-ink-3 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="刪除此則筆記"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(note.id);
                        }}
                        className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                        title={isExpanded ? '收合' : '展開詳情'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Card Body (Expanded) */}
                  {isExpanded && (
                    <div className="p-3.5 border-t border-line/70 bg-surface-2/30 space-y-3">
                      {note.status === 'thinking' ? (
                        <div className="py-6 text-center space-y-2">
                          <div className="inline-flex p-3 rounded-full bg-amber-500/15 text-amber-700 animate-pulse">
                            <Sparkles className="w-5 h-5 animate-spin" />
                          </div>
                          <p className="text-xs font-bold text-ink">
                            AI 正在伺服器背景進行深度思考與動線精算...
                          </p>
                          <p className="text-[11px] text-ink-3 max-w-xs mx-auto leading-relaxed">
                            您可以放心切換至其他分頁或關閉 App，完成後將自動發送推播通知至您的 iPhone！
                          </p>
                        </div>
                      ) : note.status === 'ready' ? (
                        <>
                          {/* 快捷操作列 */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => handleSaveToAppleNotes(note)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                            >
                              <span className="text-xs">📲</span>
                              <span>存入 Apple 備忘錄</span>
                            </button>

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleCopyNote(note)}
                              leftIcon={
                                copiedNoteId === note.id ? (
                                  <Check className="w-3.5 h-3.5 text-success" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-ink-3" />
                                )
                              }
                            >
                              {copiedNoteId === note.id
                                ? '已複製！'
                                : isItinerary
                                ? '📋 複製完整行程'
                                : '📋 複製採買清單'}
                            </Button>

                            {isItinerary && navUrl && (
                              <a
                                href={navUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2D60FF] hover:bg-[#1E4FE6] text-white text-xs font-bold shadow-2xs transition-colors"
                              >
                                <Navigation className="w-3 h-3" />
                                <span>🗺️ Google 地圖導航</span>
                              </a>
                            )}

                            {!isItinerary && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleApplyMenu(note)}
                                leftIcon={<Flame className="w-3.5 h-3.5 text-accent" />}
                              >
                                🔥 勾選開伙菜單
                              </Button>
                            )}
                          </div>

                          {/* 結構化詳情或純文字排版 */}
                          {isItinerary && Array.isArray(note.resultData?.stops) && note.resultData.stops.length > 0 ? (
                            <div className="space-y-2.5 pt-1 text-xs">
                              {note.resultData.dayOverview && (
                                <p className="p-2.5 rounded-xl bg-surface border border-line text-ink-2 leading-relaxed">
                                  {note.resultData.dayOverview}
                                </p>
                              )}

                              <div className="space-y-2">
                                {(note.resultData.stops ?? []).map((stop: any, sIdx: number) => {
                                  const placeQuery = `${note.resultData.city || ''} ${stop?.placeName || ''} ${stop?.address || ''}`.trim();
                                  const placeUrl = stop?.placeMapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`;
                                  const parkUrl = stop?.parkingMapUrl || (stop?.parkingName ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${note.resultData.city || ''} ${stop.parkingName}`)}` : '');

                                  return (
                                    <div
                                      key={sIdx}
                                      className="p-2.5 rounded-xl bg-surface border border-line/80 space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="w-4 h-4 rounded-full bg-[#3F7D58] text-white flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
                                            {sIdx + 1}
                                          </span>
                                          <a
                                            href={placeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-bold text-ink hover:text-[#3F7D58] hover:underline text-xs truncate inline-flex items-center gap-1"
                                            title="在 Google Maps 開啟地點"
                                          >
                                            <span className="truncate">{stop.placeName}</span>
                                            <ExternalLink className="w-2.5 h-2.5 opacity-60 text-ink-3 shrink-0" />
                                          </a>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          {stop.stayDuration && (
                                            <span className="font-mono text-[10px] text-ink-3 bg-surface-2 px-1.5 py-0.5 rounded">
                                              ⏱️ {stop.stayDuration}
                                            </span>
                                          )}
                                          <span className="font-mono text-[10px] text-ink-3 bg-surface-2 px-1.5 py-0.5 rounded">
                                            {stop.timeSlot}
                                          </span>
                                        </div>
                                      </div>
                                      {stop.address && (
                                        <div className="pl-6 text-[10px] text-ink-3">
                                          <a
                                            href={placeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline hover:text-ink truncate block"
                                          >
                                            📍 {stop.address}
                                          </a>
                                        </div>
                                      )}
                                      {stop.whatToDo && (
                                        <div className="text-[11px] text-ink-2 pl-6 leading-relaxed">
                                          🍽️ {renderTextWithLinks(stop.whatToDo)}
                                        </div>
                                      )}
                                      {(stop.parkingName || stop.parkingInfo) && (
                                        <div className="text-[10px] text-blue-700 pl-6 font-medium leading-relaxed">
                                          🅿️ {stop.parkingName ? (
                                            <>
                                              <a
                                                href={parkUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="underline font-bold text-blue-600 hover:text-blue-800"
                                              >
                                                {stop.parkingName}
                                              </a>
                                              {stop.parkingNote && (
                                                <span className="text-ink-3 ml-1">({stop.parkingNote})</span>
                                              )}
                                              {stop.parkingInfo && stop.parkingInfo !== stop.parkingName && (
                                                <span className="text-ink-2 ml-1">- {renderTextWithLinks(stop.parkingInfo)}</span>
                                              )}
                                            </>
                                          ) : (
                                            renderTextWithLinks(stop.parkingInfo)
                                          )}
                                        </div>
                                      )}
                                      {stop.transitDetail && (
                                        <div className="text-[10px] text-purple-700 pl-6 font-medium leading-relaxed">
                                          🚆 {renderTextWithLinks(stop.transitDetail)}
                                        </div>
                                      )}
                                      {stop.tips && (
                                        <div className="text-[10px] text-amber-700 dark:text-amber-300 pl-6 font-medium leading-relaxed">
                                          💡 {renderTextWithLinks(stop.tips)}
                                        </div>
                                      )}
                                      {stop.transitToNext && (
                                        <div className="text-[10px] text-[#3F7D58] pl-6 font-medium leading-relaxed">
                                          ⬇️ {renderTextWithLinks(stop.transitToNext)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* 查看完整行程文字切換 */}
                              {note.markdownNote && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleTextExpand(note.id)}
                                    className="w-full flex items-center justify-between p-2 rounded-xl bg-surface border border-line text-xs font-semibold text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <BookOpen className="w-3.5 h-3.5 text-[#3F7D58]" />
                                      <span>查看完整行程筆記全文</span>
                                    </span>
                                    {expandedTextNoteIds.includes(note.id) ? (
                                      <ChevronUp className="w-3.5 h-3.5 text-ink-3" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 text-ink-3" />
                                    )}
                                  </button>

                                  {expandedTextNoteIds.includes(note.id) && (
                                    <div className="mt-2 p-3 rounded-xl bg-surface border border-line text-xs text-ink-2 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-sans shadow-inner">
                                      {renderTextWithLinks(note.markdownNote)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : !isItinerary ? (
                            <div className="space-y-3 pt-1 text-xs">
                              {/* 份量、備料時間與品項數概覽標籤 */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(note.resultData?.targetServings || note.requestParams?.targetServings) && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-line text-ink font-medium text-[11px]">
                                    <Users className="w-3 h-3 text-cat-recipe" />
                                    <span>用餐份量：{note.resultData?.targetServings || note.requestParams?.targetServings} 人份</span>
                                  </span>
                                )}
                                {note.resultData?.estimatedPrepTime && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-line text-ink font-medium text-[11px]">
                                    <Clock className="w-3 h-3 text-accent" />
                                    <span>預估備料：{note.resultData.estimatedPrepTime}</span>
                                  </span>
                                )}
                                {Array.isArray(note.resultData?.shoppingItems) && note.resultData.shoppingItems.length > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-line text-ink font-medium text-[11px]">
                                    <ShoppingCart className="w-3 h-3 text-[#3F7D58]" />
                                    <span>食材項目：{note.resultData.shoppingItems.length} 項</span>
                                  </span>
                                )}
                              </div>

                              {/* 私廚搭配理念 */}
                              {note.resultData?.chefReasoning && (
                                <div className="p-2.5 rounded-xl bg-surface border border-line text-ink-2 leading-relaxed">
                                  👨‍🍳 <strong className="text-ink">私廚搭配理念：</strong>
                                  {renderTextWithLinks(note.resultData.chefReasoning)}
                                </div>
                              )}

                              {/* 精選開伙菜色組合 */}
                              {Array.isArray(note.resultData?.pairings) && note.resultData.pairings.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="font-semibold text-ink text-[11px] flex items-center gap-1">
                                    <UtensilsCrossed className="w-3.5 h-3.5 text-accent" />
                                    <span>精選開伙菜單（{note.resultData.pairings.length} 道）：</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {(note.resultData.pairings ?? []).map((pair: any, pIdx: number) => (
                                      <div
                                        key={pIdx}
                                        className="p-2.5 rounded-xl bg-surface border border-line/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-bold font-mono shrink-0">
                                            {pair?.role}
                                          </span>
                                          <span className="font-bold text-ink">
                                            {pair?.recipeTitle}
                                          </span>
                                        </div>
                                        {pair?.reason && (
                                          <span className="text-[11px] text-ink-3">
                                            {pair.reason}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 若為純粹採買表單存入之菜色名稱 */}
                              {(!Array.isArray(note.resultData?.pairings) || note.resultData.pairings.length === 0) && Array.isArray(note.resultData?.recipeTitles) && note.resultData.recipeTitles.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="font-semibold text-ink text-[11px] flex items-center gap-1">
                                    <UtensilsCrossed className="w-3.5 h-3.5 text-accent" />
                                    <span>包含食譜料理：</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(note.resultData.recipeTitles ?? []).map((t: string, tIdx: number) => (
                                      <span
                                        key={tIdx}
                                        className="px-2 py-0.5 rounded-lg bg-surface border border-line text-ink font-medium text-[11px]"
                                      >
                                        • {t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 完整分類食材採買清單 */}
                              {Array.isArray(note.resultData?.shoppingItems) && note.resultData.shoppingItems.length > 0 ? (
                                <div className="space-y-2.5 pt-1">
                                  <div className="font-semibold text-ink text-[11px] flex items-center gap-1.5">
                                    <ShoppingCart className="w-3.5 h-3.5 text-[#3F7D58]" />
                                    <span>🛒 完整分類食材採買清單：</span>
                                  </div>

                                  <div className="space-y-2.5">
                                    {SHOPPING_CATEGORY_ORDER.map(({ key, icon, label }) => {
                                      const group = (note.resultData?.shoppingItems ?? []).filter((it: any) => it?.category === key);
                                      if (group.length === 0) return null;

                                      const excludedSet = new Set(
                                        Array.isArray(note.resultData?.excludedNames) ? note.resultData.excludedNames : []
                                      );

                                      return (
                                        <div key={key} className="space-y-1.5">
                                          <div className="flex items-center justify-between text-[11px] font-semibold text-ink-2 pb-0.5 border-b border-line">
                                            <span className="flex items-center gap-1">
                                              <span>{icon}</span>
                                              <span>{label}</span>
                                            </span>
                                            <span className="font-mono text-[10px] text-ink-4">
                                              {group.length} 項
                                            </span>
                                          </div>

                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {group.map((item: any, itIdx: number) => {
                                              const isExcluded = excludedSet.has(item?.name);
                                              return (
                                                <div
                                                  key={itIdx}
                                                  className={cn(
                                                    'flex items-center justify-between p-2 rounded-xl border text-xs transition-colors',
                                                    isExcluded
                                                      ? 'bg-surface-2/60 border-line text-ink-4'
                                                      : 'bg-surface border-line/80 text-ink'
                                                  )}
                                                >
                                                  <div className="min-w-0 flex-1 pr-2">
                                                    <span
                                                      className={cn(
                                                        'font-medium text-xs truncate block',
                                                        isExcluded && 'line-through text-ink-4'
                                                      )}
                                                    >
                                                      {item?.name}
                                                    </span>
                                                    {Array.isArray(item?.sourceRecipes) && item.sourceRecipes.length > 0 && (
                                                      <span className="text-[10px] text-ink-3 truncate block">
                                                        {item.sourceRecipes.join('、')}
                                                      </span>
                                                    )}
                                                  </div>

                                                  <div className="shrink-0 text-right">
                                                    <span
                                                      className={cn(
                                                        'font-mono font-bold text-xs',
                                                        isExcluded ? 'line-through text-ink-4' : 'text-accent'
                                                      )}
                                                    >
                                                      {item?.requiredAmountText}
                                                    </span>
                                                    {isExcluded && (
                                                      <span className="block text-[9px] text-ink-4">
                                                        家中已有
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}

                              {/* 共用食材與備料小撇步 */}
                              {Array.isArray(note.resultData?.sharedIngredientsHighlight) &&
                                note.resultData.sharedIngredientsHighlight.length > 0 && (
                                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1 text-xs">
                                    <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1 text-[11px]">
                                      💡 共用食材與備料小撇步：
                                    </span>
                                    <ul className="list-disc list-inside space-y-0.5 text-amber-950 dark:text-amber-200 text-[11px]">
                                      {note.resultData.sharedIngredientsHighlight.map((tip: string, tIdx: number) => (
                                        <li key={tIdx}>{tip}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                              {/* 查看完整備忘錄全文 / 烹飪作法預覽切換 */}
                              {note.markdownNote && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleTextExpand(note.id)}
                                    className="w-full flex items-center justify-between p-2 rounded-xl bg-surface border border-line text-xs font-semibold text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      <BookOpen className="w-3.5 h-3.5 text-accent" />
                                      <span>查看完整文字指南與料理作法</span>
                                    </span>
                                    {expandedTextNoteIds.includes(note.id) ? (
                                      <ChevronUp className="w-3.5 h-3.5 text-ink-3" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 text-ink-3" />
                                    )}
                                  </button>

                                  {expandedTextNoteIds.includes(note.id) && (
                                    <div className="mt-2 p-3 rounded-xl bg-surface border border-line text-xs text-ink-2 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-sans shadow-inner">
                                      {renderTextWithLinks(note.markdownNote)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-xl bg-surface border border-line text-xs text-ink-2 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto font-sans">
                              {renderTextWithLinks(note.markdownNote) || '無筆記文字'}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{getFriendlyErrorMessage(note.error || '規劃過程發生錯誤，請稍後重試。')}</span>
                          </div>
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                refreshAINotes();
                                addToast({ type: 'info', message: '🔄 正在重新同步 AI 記事本...' });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-control bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>立即重試</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
