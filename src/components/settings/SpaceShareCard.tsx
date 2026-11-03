'use client';

import React, { useState, useEffect } from 'react';
import { useAppState } from '@/providers/AppStateProvider';
import { storageService } from '@/lib/storage';
import { SettingsGroup } from './SettingsGroup';
import { Button } from '@/components/ui/Button';
import {
  Users,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  FileDown,
  Eye,
  Trash2,
  Clock,
  NotebookPen,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

function formatLastActive(timestamp?: number): string {
  if (!timestamp || timestamp <= 0) return '尚無活動紀錄';
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '剛剛活躍';
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小時前`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  try {
    return new Date(timestamp).toLocaleDateString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '近期活躍';
  }
}

export function SpaceShareCard() {
  const {
    spaceId,
    setSpaceId,
    isDefaultSpace,
    isHostAdmin,
    allSpaces,
    loadingSpaces,
    refreshAllSpaces,
    deleteOrClearFriendSpace,
    addToast,
  } = useAppState();

  const [inputSpace, setInputSpace] = useState('');
  const [copiedSpace, setCopiedSpace] = useState<string | null>(null);
  const [clientOrigin, setClientOrigin] = useState(
    process.env.NEXT_PUBLIC_SITE_URL || ''
  );
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingSpaceId, setDeletingSpaceId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const base = process.env.NEXT_PUBLIC_SITE_URL || `${origin}/memo`;
      setClientOrigin(base.replace(/\/+$/, ''));
    }
  }, []);

  // 嚴格防線：僅限主機管理員 (isHostAdmin === true) 可檢視此後台區塊，朋友端 100% 隱藏
  if (!isHostAdmin) {
    return null;
  }

  const activeSpace = spaceId || 'default';
  const inviteSpace =
    inputSpace.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || activeSpace;

  function handleSwitchSpace(targetSpaceName?: string) {
    const clean = (targetSpaceName || inputSpace)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    if (!clean) {
      addToast({
        type: 'info',
        message: '請輸入有效的空間代號（僅限英數、連字號與底線）',
      });
      return;
    }
    setSpaceId(clean);
    if (!targetSpaceName) setInputSpace('');
    addToast({
      type: 'success',
      message:
        clean === 'default'
          ? '👑 已返回主機主空間 (default)'
          : `👁️ 已切換檢視【${clean}】的空間！頂部可隨時一鍵返回主空間。`,
    });
  }

  function handleBackToDefault() {
    setSpaceId('default');
    addToast({
      type: 'info',
      message: '👑 已返回主要空間 (default)',
    });
  }

  function handleCopyLink(targetId: string) {
    const origin = clientOrigin || (typeof window !== 'undefined' ? `${window.location.origin}/memo` : '');
    const url = `${origin}?space=${encodeURIComponent(targetId)}`;
    navigator.clipboard.writeText(url);
    setCopiedSpace(targetId);
    addToast({
      type: 'success',
      message: `🔗 已複製【${targetId}】空間的專屬連結！`,
    });
    setTimeout(() => setCopiedSpace(null), 2000);
  }

  async function handleCreateFriendSpace() {
    const clean = inputSpace.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!clean) {
      addToast({
        type: 'info',
        message: '請輸入有效的空間代號（僅限英數、連字號與底線）',
      });
      return;
    }
    setCreatingSpace(true);
    try {
      const res = await fetch('/memo/api/admin/spaces', {
        method: 'POST',
        headers: storageService.getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ spaceId: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || '建立空間失敗');
      }
      const origin = clientOrigin || (typeof window !== 'undefined' ? `${window.location.origin}/memo` : '');
      const url = `${origin}?space=${encodeURIComponent(clean)}`;
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setCopiedSpace(clean);
      setTimeout(() => setCopiedSpace(null), 2000);
      await refreshAllSpaces();
      addToast({
        type: 'success',
        message: `🎉 已為【${clean}】建立專屬空間並複製專屬網址！`,
      });
      setInputSpace('');
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : '建立空間失敗',
      });
    } finally {
      setCreatingSpace(false);
    }
  }

  async function handleDeleteSpace(targetId: string, action: 'delete' | 'clear' = 'delete') {
    setDeletingSpaceId(targetId);
    try {
      const res = await deleteOrClearFriendSpace(targetId, action);
      if (!res.success) {
        throw new Error(res.error || '刪除失敗');
      }
      setConfirmDeleteId(null);
      addToast({
        type: 'success',
        message:
          action === 'clear'
            ? `🧹 已清空【${targetId}】空間內的所有收藏與紀錄！`
            : `🗑️ 已從主機硬碟徹底刪除【${targetId}】空間與資料庫檔案！`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : '刪除空間失敗',
      });
    } finally {
      setDeletingSpaceId(null);
    }
  }

  return (
    <SettingsGroup
      title="👑 主機專屬管理後台：目前有哪些人正在使用程式（朋友端 100% 隱藏）"
      description="僅主機管理員可見。即時監控所有朋友空間的使用狀況、分類卡片數量、AI 記事本生成數與最後活躍時間，並支援巡視畫面或直接刪除空間資料庫。"
    >
      <div className="space-y-5">
        {/* 👑 主機專屬免密鑰直達網址與 PIN 碼安全憑證卡 */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔐</span>
              <h4 className="font-bold text-xs text-ink">
                主機專屬私密存取憑證（新裝置免輸密碼一鍵登入）
              </h4>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-800 border border-amber-500/30">
              主機私密資料庫防護中
            </span>
          </div>

          <p className="text-[11px] text-ink-2 leading-relaxed">
            為防止任何朋友或外網訪客誤闖主機主要資料庫（88 筆私密收藏），本系統已全面啟用端點防護。當您在全新 iPhone、iPad 或新瀏覽器上開啟時，可直接使用您的專屬免密鑰直達網址，或輸入管理員 PIN 碼解鎖：
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-surface border border-line space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-ink-3">🚀 主機專屬免密直達網址</span>
                <button
                  type="button"
                  onClick={() => {
                    const bossUrl = `${clientOrigin}?space=boss`;
                    navigator.clipboard.writeText(bossUrl);
                    addToast({ type: 'success', message: '👑 已複製主機專屬直達網址！' });
                  }}
                  className="text-[11px] font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>複製網址</span>
                </button>
              </div>
              <div className="font-mono text-xs text-ink font-bold bg-surface-2 px-2.5 py-1.5 rounded border border-line truncate select-all">
                {clientOrigin}?space=boss
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-line space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-ink-3">🔑 管理員通行 PIN 碼</span>
                <span className="text-[10px] text-ink-3">彈出驗證視窗時輸入</span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs text-ink font-bold bg-surface-2 px-2.5 py-1.5 rounded border border-line">
                <span>PIN: <strong className="text-amber-700 tracking-widest text-sm">8888</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('8888');
                    addToast({ type: 'success', message: '已複製 PIN 碼 8888！' });
                  }}
                  className="text-[11px] font-bold text-accent hover:underline cursor-pointer"
                >
                  複製 PIN
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 當前空間狀態橫幅 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-surface-2 border border-line text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
              {isDefaultSpace ? (
                <span className="text-base">👑</span>
              ) : (
                <Users className="w-4 h-4 text-accent" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">
                  {isDefaultSpace
                    ? '👑 主機主空間 (default)'
                    : `👁️ 正在巡視朋友空間：${spaceId}`}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-surface text-ink-2 border border-line">
                  {isDefaultSpace ? '主資料庫 (.data/db.json)' : `獨立沙盒 (.data/users/${spaceId}.json)`}
                </span>
              </div>
              <p className="text-[11px] text-ink-3 mt-0.5">
                {isDefaultSpace
                  ? '這是您的主機主要資料庫空間。外網手機連線時可使用 /?space=boss 或 /?space=master 進入。'
                  : `目前正以主機管理員身分檢視「${spaceId}」的獨立空間，可隨時點擊右側或頂部膠囊返回主空間。`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/guide?space=${encodeURIComponent(activeSpace)}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>下載教學手冊 PDF</span>
            </Link>

            {!isDefaultSpace && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleBackToDefault}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                🔙 返回主機空間
              </Button>
            )}
          </div>
        </div>

        {/* 所有使用者空間清單與統計數據 */}
        <div className="p-4 rounded-xl bg-surface border border-line space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              <h4 className="font-bold text-xs text-ink">
                所有使用者空間與即時使用狀況（共 {allSpaces.length} 個空間）
              </h4>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refreshAllSpaces()}
              className="text-[11px] text-ink-3 hover:text-ink h-7 px-2"
            >
              重新整理
            </Button>
          </div>

          <p className="text-[11px] text-ink-3">
            朋友自己的頁面上完全不會顯示此清單。您可在此查看各空間的收藏數、最後活躍時間與最新收藏，或直接刪除不再使用的空間檔案：
          </p>

          <div className="divide-y divide-line/60 rounded-xl border border-line overflow-hidden bg-surface-2/40">
            {loadingSpaces ? (
              <div className="p-4 text-center text-xs text-ink-3">
                正在掃描主機資料庫與所有使用者空間...
              </div>
            ) : allSpaces.length === 0 ? (
              <div className="p-4 text-center text-xs text-ink-3">
                尚無空間記錄，您可在下方輸入朋友代號立即建立。
              </div>
            ) : (
              allSpaces.map((s) => {
                const isCurrent =
                  (s.isDefault && isDefaultSpace) || s.spaceId === spaceId;
                const isCopied = copiedSpace === s.spaceId;
                const isConfirmingDelete = confirmDeleteId === s.spaceId;
                const isDeletingThis = deletingSpaceId === s.spaceId;

                const total = s.totalItems ?? s.itemCount ?? 0;
                const recipeCount = s.countsByCategory?.recipe ?? s.recipeCount ?? 0;
                const placeCount = s.countsByCategory?.place ?? s.placeCount ?? 0;
                const mediaCount = s.countsByCategory?.media ?? s.mediaCount ?? 0;
                const productCount = s.countsByCategory?.product ?? s.pickCount ?? 0;
                const aiCount = s.aiTasksCount ?? 0;
                const lastActive = s.lastActiveAt ?? s.updatedAt ?? 0;

                return (
                  <div
                    key={s.spaceId}
                    className={`p-3.5 flex flex-col gap-3 transition-colors ${
                      isCurrent ? 'bg-accent/5' : 'hover:bg-surface'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* 左側：空間名稱與詳細統計 */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-ink font-mono">
                            {s.isDefault ? 'default (主機)' : s.spaceId}
                          </span>
                          {s.isDefault ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                              👑 主機主空間
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-surface text-ink-2 border border-line">
                              👤 朋友獨立空間
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-accent text-white">
                              目前檢視中
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[10px] text-ink-3 font-mono">
                            <Clock className="w-3 h-3" />
                            <span>{formatLastActive(lastActive)}</span>
                          </span>
                        </div>

                        {/* 分類統計數據列 */}
                        <div className="text-[11px] text-ink-2 flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-ink">
                            總計 <strong>{total}</strong> 筆收藏
                          </span>
                          <span className="text-ink-3">•</span>
                          <span>🍳 {recipeCount} 食譜</span>
                          <span className="text-ink-3">•</span>
                          <span>📍 {placeCount} 景點</span>
                          <span className="text-ink-3">•</span>
                          <span>🎬 {mediaCount} 影視</span>
                          <span className="text-ink-3">•</span>
                          <span>🛍️ {productCount} 好物</span>
                          <span className="text-ink-3">•</span>
                          <span className="inline-flex items-center gap-1 text-accent font-medium">
                            <NotebookPen className="w-3 h-3" />
                            <span>AI 記事本 {aiCount} 篇</span>
                          </span>
                        </div>

                        {/* 最新收藏標題 */}
                        {s.latestItemTitle && (
                          <p className="text-[11px] text-ink-3 truncate">
                            最新收藏：<span className="text-ink-2 font-medium">{s.latestItemTitle}</span>
                          </p>
                        )}
                      </div>

                      {/* 右側：管理按鈕組 */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {!isCurrent && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleSwitchSpace(s.spaceId)}
                            className="h-7 px-2.5 text-xs"
                            leftIcon={<Eye className="w-3 h-3" />}
                          >
                            👁️ 切換檢視
                          </Button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopyLink(s.spaceId)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink flex items-center gap-1 transition-colors cursor-pointer"
                          title="複製此空間的專屬連結"
                        >
                          {isCopied ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-ink-3" />
                          )}
                          <span>{isCopied ? '已複製' : '🔗 複製專屬網址'}</span>
                        </button>

                        <Link
                          href={`/guide?space=${encodeURIComponent(s.spaceId)}`}
                          target="_blank"
                          className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink flex items-center gap-1 transition-colors"
                          title="開啟專屬教學手冊並另存 PDF"
                        >
                          <FileDown className="w-3 h-3 text-accent" />
                          <span>📄 下載教學 PDF</span>
                        </Link>

                        {/* 非 default 主空間才顯示刪除按鈕 */}
                        {!s.isDefault && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeleteId(isConfirmingDelete ? null : s.spaceId)
                            }
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-danger/30 bg-danger/5 hover:bg-danger/15 text-danger flex items-center gap-1 transition-colors cursor-pointer"
                            title="刪除此朋友空間與資料庫檔案"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>🗑️ 刪除此空間資料</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 二次確認刪除面板 */}
                    {!s.isDefault && isConfirmingDelete && (
                      <div className="p-3 rounded-xl bg-danger/5 border border-danger/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
                        <div className="flex items-start gap-2 text-xs">
                          <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-danger">
                              確定要從主機資料庫徹底刪除『{s.spaceId}』的所有收藏與紀錄嗎？此動作無法復原。
                            </p>
                            <p className="text-[11px] text-ink-3 mt-0.5">
                              將會直接刪除硬碟中的 <code className="font-mono">.data/users/{s.spaceId}.json</code>（共 {total} 筆收藏、{aiCount} 篇 AI 筆記）。
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={isDeletingThis}
                            onClick={() => handleDeleteSpace(s.spaceId, 'delete')}
                          >
                            {isDeletingThis ? '刪除中...' : '確認徹底刪除空間'}
                          </Button>
                          {total > 0 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isDeletingThis}
                              onClick={() => handleDeleteSpace(s.spaceId, 'clear')}
                            >
                              僅清空卡片但保留代號
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isDeletingThis}
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 建立新空間 / 傳送好友邀請連結 */}
        <div className="p-3.5 rounded-xl bg-surface border border-line space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-ink flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>建立新空間 / 邀請新朋友</span>
            </h4>
            <span className="text-[10px] text-ink-3 font-mono">
              共用主機 API Key・資料完全隔離
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={inputSpace}
                onChange={(e) => setInputSpace(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputSpace.trim() && !creatingSpace) {
                    handleCreateFriendSpace();
                  }
                }}
                placeholder="輸入朋友代號（例如 amy、azhi、family）"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-line bg-surface-2 text-ink focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <Button
                size="sm"
                variant="primary"
                disabled={!inputSpace.trim() || creatingSpace}
                onClick={handleCreateFriendSpace}
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              >
                {creatingSpace ? '建立中...' : '➕ 新增朋友空間並複製專屬網址'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!inputSpace.trim() || creatingSpace}
                onClick={() => handleSwitchSpace()}
                leftIcon={<ArrowRight className="w-3.5 h-3.5" />}
                title="直接切換檢視此空間"
              >
                切換檢視
              </Button>
            </div>
          </div>

          {/* 專屬連結一鍵複製 */}
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-surface-2 border border-line text-xs">
            <div className="flex-1 min-w-0 pr-2">
              <span className="text-[10px] text-ink-3 block font-medium">
                專屬邀請連結（朋友點開即可自動進入【{inviteSpace}】空間）：
              </span>
              <span className="text-[11px] font-mono text-accent truncate block">
                {clientOrigin || (typeof window !== 'undefined' ? `${window.location.origin}/memo` : '')}?space=${encodeURIComponent(inviteSpace)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/guide?space=${encodeURIComponent(inviteSpace)}`}
                target="_blank"
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink flex items-center gap-1 transition-colors"
              >
                <FileDown className="w-3 h-3 text-accent" />
                <span>教學手冊</span>
              </Link>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleCopyLink(inviteSpace)}
                leftIcon={
                  copiedSpace === inviteSpace ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-ink-3" />
                  )
                }
              >
                {copiedSpace === inviteSpace ? '已複製' : '複製連結'}
              </Button>
            </div>
          </div>

          {/* 友善說明 */}
          <div className="p-3 rounded-lg bg-surface-2/60 border border-line text-[11px] text-ink-2 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-ink">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3F7D58]" />
              <span>多人共享與主機隱私保障：</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-ink-3 pl-1 leading-relaxed">
              <li>
                <strong>朋友端 100% 隱藏此清單</strong>：朋友進入她的專屬網址後，設定頁只看得到她自己的推播與捷徑，完全看不到其他人的空間。
              </li>
              <li>
                <strong>主機外網暗號</strong>：您在手機外網連線時，只要開啟 <code className="text-ink font-mono">/?space=boss</code> 或 <code className="text-ink font-mono">/?space=master</code> 即可存取主機資料庫並解鎖此管理後台。
              </li>
            </ul>
          </div>
        </div>
      </div>
    </SettingsGroup>
  );
}
