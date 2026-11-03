'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AggregatedIngredient } from '@/lib/recipeUtils';
import { cn } from '@/lib/utils';
import {
  Check,
  RotateCcw,
  X,
  Sparkles,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface LiveMarketChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetServings: number;
  items: AggregatedIngredient[];
  excludedNames?: Set<string>;
}

const STORAGE_KEY = 'albo_live_market_checked_state_v1';

const CATEGORY_ICONS: Record<string, string> = {
  生鮮肉品: '🥩',
  蔬菜水果: '🥬',
  蛋奶豆製品: '🥚',
  調味料與乾貨: '🧂',
  其他: '📦',
};

export function LiveMarketChecklistModal({
  isOpen,
  onClose,
  targetServings,
  items,
  excludedNames = new Set(),
}: LiveMarketChecklistModalProps) {
  // 待買食材列表（排除家中已有）
  const toBuyList = useMemo(() => {
    return items.filter((it) => !excludedNames.has(it.name));
  }, [items, excludedNames]);

  // 已在賣場勾選買齊的項目名稱集合
  const [checkedNames, setCheckedNames] = useState<Set<string>>(new Set());
  const [showCompletedSection, setShowCompletedSection] = useState(true);

  // 初始化從 localStorage 讀取已勾選狀態與 ESC 監聽
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCheckedNames(new Set(parsed));
        }
      }
    } catch {}

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // 當勾選狀態改變時寫入 localStorage
  function saveCheckedToStorage(names: Set<string>) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(names)));
    } catch {}
  }

  // 點擊切換單一項目勾選狀態
  function handleToggleItem(name: string) {
    setCheckedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      saveCheckedToStorage(next);
      return next;
    });
  }

  // 一鍵重設勾選進度
  function handleResetProgress() {
    if (checkedNames.size === 0) return;
    const confirmed = window.confirm('確定要清除所有已勾選的進度，重新開始採買嗎？');
    if (confirmed) {
      setCheckedNames(new Set());
      saveCheckedToStorage(new Set());
    }
  }

  // 分離待買與已買齊
  const pendingItems = toBuyList.filter((it) => !checkedNames.has(it.name));
  const completedItems = toBuyList.filter((it) => checkedNames.has(it.name));

  const totalCount = toBuyList.length;
  const completedCount = completedItems.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-xl h-[100dvh] sm:h-[88vh] sm:max-h-[820px] bg-surface border border-line sm:rounded-modal flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-200 cursor-default"
        role="dialog"
        aria-modal="true"
      >
        {/* Sticky Header */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-line bg-surface/95 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-control bg-[#E07A5F]/15 flex items-center justify-center text-[#E07A5F]">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-base sm:text-lg text-ink tracking-tight flex items-center gap-2">
                  <span>賣場實戰打勾模式</span>
                  <span className="text-xs font-mono font-normal text-ink-3 px-2 py-0.5 rounded bg-surface-2 border border-line">
                    {targetServings} 人份
                  </span>
                </h2>
                <p className="text-xs text-ink-3">
                  大字體單手好點選・點擊自動歸檔至已買齊區
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-ink-3 hover:text-ink hover:bg-surface-2 active:scale-95 transition-all cursor-pointer"
              aria-label="關閉"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar & Counter */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink flex items-center gap-1.5">
                <span>採買進度：</span>
                <strong className="text-[#E07A5F] font-mono text-sm">
                  {completedCount}
                </strong>
                <span className="text-ink-4">/</span>
                <span className="font-mono text-ink-2">{totalCount} 項</span>
              </span>

              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-ink-2">
                  {percent}%
                </span>
                {completedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetProgress}
                    className="flex items-center gap-1 text-[11px] text-ink-4 hover:text-[#E07A5F] transition-colors cursor-pointer"
                    title="重設所有勾選"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>重設</span>
                  </button>
                )}
              </div>
            </div>

            <div className="w-full h-2 rounded-full bg-surface-2 border border-line overflow-hidden">
              <div
                className="h-full bg-[#E07A5F] transition-all duration-300 ease-out rounded-full"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Checklist Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-6">
          {/* 全部採買完成慶祝橫幅 */}
          {isAllCompleted && (
            <div className="p-4 rounded-card bg-[#5B7C5A]/10 border border-[#5B7C5A]/25 text-[#5B7C5A] flex items-center gap-3 animate-in fade-in duration-300">
              <div className="w-10 h-10 rounded-full bg-[#5B7C5A] text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">今日食材已全數買齊！🎉</h4>
                <p className="text-xs opacity-90">可以開心回家下廚享受美味佳餚囉！</p>
              </div>
            </div>
          )}

          {/* 1. 待買食材區 (Pending Items) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-2 pb-1">
              <span>待買食材（{pendingItems.length} 項）</span>
              {pendingItems.length === 0 && (
                <span className="text-[#5B7C5A] font-normal text-[11px]">
                  ✨ 全部搞定
                </span>
              )}
            </div>

            {pendingItems.length === 0 ? (
              <div className="p-6 text-center rounded-card bg-surface-2/40 border border-line/60 text-ink-3 text-xs">
                目前沒有待買項目
              </div>
            ) : (
              <div className="space-y-2">
                {pendingItems.map((item) => {
                  const icon = CATEGORY_ICONS[item.category] || '📦';

                  return (
                    <div
                      key={item.name}
                      onClick={() => handleToggleItem(item.name)}
                      role="checkbox"
                      aria-checked={false}
                      className="group flex items-center justify-between min-h-[58px] p-3.5 rounded-control bg-surface border border-line hover:border-ink/20 active:scale-[0.99] cursor-pointer transition-all select-none shadow-2xs"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-3">
                        {/* 仿 Apple 備忘錄 28px 圓圈按鈕 */}
                        <div className="w-7 h-7 rounded-full border-2 border-stone-300 dark:border-stone-600 group-hover:border-[#E07A5F]/70 flex items-center justify-center shrink-0 transition-colors bg-transparent" />

                        {/* 食材品名 */}
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-base select-none shrink-0" aria-hidden="true">
                            {icon}
                          </span>
                          <span className="text-base sm:text-lg font-medium text-ink truncate">
                            {item.name}
                          </span>
                        </div>
                      </div>

                      {/* 數量膠囊標籤 */}
                      <div className="shrink-0 px-3 py-1 rounded-full bg-surface-2 border border-line text-ink font-mono font-medium text-sm">
                        {item.requiredAmountText}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. 已買齊區 (Completed Section - Smooth Archive) */}
          {completedItems.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setShowCompletedSection((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs font-semibold text-ink-3 hover:text-ink py-1 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#5B7C5A]" />
                  <span>已買齊區（{completedItems.length} 項）</span>
                </span>
                <span className="flex items-center gap-1 text-[11px] text-ink-4">
                  {showCompletedSection ? '收合' : '展開'}
                  {showCompletedSection ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>

              {showCompletedSection && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  {completedItems.map((item) => {
                    const icon = CATEGORY_ICONS[item.category] || '📦';

                    return (
                      <div
                        key={item.name}
                        onClick={() => handleToggleItem(item.name)}
                        role="checkbox"
                        aria-checked={true}
                        className="group flex items-center justify-between min-h-[50px] p-3 rounded-control bg-surface-2/50 border border-line/60 opacity-60 hover:opacity-90 active:scale-[0.99] cursor-pointer transition-all select-none"
                      >
                        <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-3">
                          {/* 已打勾 28px 橘橘圓圈按鈕 */}
                          <div className="w-7 h-7 rounded-full bg-[#E07A5F] border-2 border-[#E07A5F] text-white flex items-center justify-center shrink-0 shadow-2xs transition-transform active:scale-90">
                            <Check className="w-4 h-4 stroke-[2.5]" />
                          </div>

                          {/* 劃線淡化品名 */}
                          <div className="flex items-center gap-2 truncate line-through text-ink-3">
                            <span className="text-sm select-none shrink-0" aria-hidden="true">
                              {icon}
                            </span>
                            <span className="text-sm sm:text-base font-normal truncate">
                              {item.name}
                            </span>
                          </div>
                        </div>

                        {/* 數量標籤 */}
                        <div className="shrink-0 px-2.5 py-0.5 rounded-full bg-surface border border-line text-ink-3 font-mono text-xs line-through">
                          {item.requiredAmountText}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="shrink-0 p-3.5 sm:p-4 border-t border-line bg-surface/95 backdrop-blur-md flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-4">
            💡 買菜時可隨時關閉螢幕，進度會自動儲存在此手機中。
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-control bg-surface-2 hover:bg-surface-3 text-ink text-xs font-medium border border-line active:scale-95 transition-all cursor-pointer shrink-0"
          >
            完成並返回
          </button>
        </div>
      </div>
    </div>
  );
}
