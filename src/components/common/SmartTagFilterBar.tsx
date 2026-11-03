'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SmartTagItem {
  tag: string;
  count: number;
}

export interface SmartTagFilterBarProps {
  tags: SmartTagItem[];
  selectedTag?: string;
  onSelectTag: (tag?: string) => void;
  totalCount: number;
  title?: string;
  icon?: React.ReactNode;
  themeColor?: 'place' | 'recipe' | 'media' | 'general' | 'brand';
  activeTagClass?: string;
  allLabel?: string;
  onClearOtherFilters?: () => void;
  className?: string;
}

export function SmartTagFilterBar({
  tags,
  selectedTag,
  onSelectTag,
  totalCount,
  title = '動態智慧標籤',
  icon,
  themeColor = 'general',
  activeTagClass,
  allLabel = '全部',
  onClearOtherFilters,
  className,
}: SmartTagFilterBarProps) {
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 左右箭頭平滑滑動
  const handleScroll = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // 電腦版滑鼠滾輪轉換為橫向滑動
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (
      Math.abs(e.deltaY) > Math.abs(e.deltaX) &&
      e.currentTarget.scrollWidth > e.currentTarget.clientWidth
    ) {
      e.currentTarget.scrollLeft += e.deltaY;
    }
  };

  // 顏色與樣式定義
  const themeTextClass =
    themeColor === 'place'
      ? 'text-cat-place'
      : themeColor === 'recipe'
      ? 'text-cat-recipe'
      : themeColor === 'media'
      ? 'text-cat-media'
      : 'text-ink';

  const defaultActiveBadgeClass =
    themeColor === 'place'
      ? 'bg-cat-place text-white border-cat-place shadow-2xs font-bold'
      : themeColor === 'recipe'
      ? 'bg-cat-recipe text-white border-cat-recipe shadow-2xs font-bold'
      : themeColor === 'media'
      ? 'bg-cat-media text-white border-cat-media shadow-2xs font-bold'
      : 'bg-ink text-surface border-ink shadow-2xs font-bold';

  const effectiveActiveClass = activeTagClass || defaultActiveBadgeClass;

  // 搜尋過濾標籤總覽
  const filteredTags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.tag.toLowerCase().includes(q));
  }, [tags, searchQuery]);

  return (
    <div className={cn('space-y-2 w-full text-xs', className)}>
      {/* 標籤列頂部控制列 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-ink-3">
          {icon || <Sparkles className={cn('w-3.5 h-3.5', themeTextClass)} />}
          <span className="font-semibold text-ink-2">{title}</span>
          {tags.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-surface-2 text-ink-3 border border-line">
              {tags.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 🏷️ 全部標籤清單總覽展開按鈕 */}
          <button
            type="button"
            onClick={() => setIsOverviewOpen(!isOverviewOpen)}
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs active:scale-95',
              isOverviewOpen
                ? 'bg-surface text-ink border-black/30 shadow-xs'
                : 'bg-surface text-ink-2 border-line hover:border-black/30 hover:text-ink'
            )}
            title={isOverviewOpen ? '收合標籤總覽清單' : '展開完整標籤總覽網格清單'}
          >
            <Tag className="w-3 h-3 text-ink-3" />
            <span>標籤清單 (共 {tags.length} 個)</span>
            {isOverviewOpen ? (
              <ChevronUp className="w-3 h-3 text-ink-3" />
            ) : (
              <ChevronDown className="w-3 h-3 text-ink-3" />
            )}
          </button>

          {/* ‹ 往左平滑滑動按鈕 */}
          <button
            type="button"
            onClick={() => handleScroll(-280)}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-surface border border-line text-ink-3 hover:text-ink hover:border-black/30 transition-all cursor-pointer shadow-2xs active:scale-90"
            title="往左捲動標籤 (‹)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* › 往右平滑滑動按鈕 */}
          <button
            type="button"
            onClick={() => handleScroll(280)}
            className="w-6 h-6 rounded-full flex items-center justify-center bg-surface border border-line text-ink-3 hover:text-ink hover:border-black/30 transition-all cursor-pointer shadow-2xs active:scale-90"
            title="往右捲動標籤 (›)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 橫向捲動標籤列 (支援滑鼠滾輪 onWheel 橫向捲動 + 手勢滑動) */}
      <div className="relative w-full max-w-full">
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="w-full max-w-full py-1 flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth"
        >
          {/* 最前方「全部」膠囊 */}
          <button
            type="button"
            onClick={() => {
              onSelectTag(undefined);
              onClearOtherFilters?.();
            }}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border shrink-0 whitespace-nowrap active:scale-95',
              !selectedTag
                ? effectiveActiveClass
                : 'bg-surface text-ink-2 border-line hover:border-black/30 hover:text-ink'
            )}
          >
            <span>{allLabel}</span>
            <span className="ml-1 opacity-70 text-[10px]">({totalCount})</span>
          </button>

          {/* 標籤清單膠囊 */}
          {tags.map(({ tag, count }) => {
            const active = selectedTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  if (active) {
                    onSelectTag(undefined);
                  } else {
                    onSelectTag(tag);
                    onClearOtherFilters?.();
                  }
                }}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border shrink-0 whitespace-nowrap active:scale-95',
                  active
                    ? effectiveActiveClass
                    : 'bg-surface text-ink-2 border-line hover:border-black/30 hover:text-ink'
                )}
              >
                <span>{tag}</span>
                <span className="ml-1 opacity-70 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 🏷️ 全部標籤總覽面板 (平滑展開於下方文檔流，提供即時搜尋與網格檢索) */}
      {isOverviewOpen && (
        <div className="w-full rounded-2xl bg-surface border border-line shadow-sm p-3.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-line">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="🔍 快速搜尋標籤..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface-2 border border-line text-xs focus:outline-none focus:border-black/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-ink-3">
                顯示 {filteredTags.length} / 共 {tags.length} 個標籤
              </span>
              <button
                type="button"
                onClick={() => setIsOverviewOpen(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
              >
                <span>收合</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {filteredTags.length === 0 ? (
            <div className="py-6 text-center text-ink-4 text-xs">
              找不到包含「{searchQuery}」的標籤
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-[280px] overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => {
                  onSelectTag(undefined);
                  onClearOtherFilters?.();
                  setIsOverviewOpen(false);
                }}
                className={cn(
                  'inline-flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border shadow-2xs active:scale-95',
                  !selectedTag
                    ? effectiveActiveClass
                    : 'bg-surface-2 hover:bg-surface text-ink border-line hover:border-black/30'
                )}
              >
                <span>{allLabel}</span>
                <span className="text-[10px] font-bold opacity-75">
                  ({totalCount})
                </span>
              </button>

              {filteredTags.map(({ tag, count }) => {
                const active = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      onSelectTag(active ? undefined : tag);
                      if (!active) onClearOtherFilters?.();
                      setIsOverviewOpen(false);
                    }}
                    className={cn(
                      'inline-flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border shadow-2xs active:scale-95',
                      active
                        ? effectiveActiveClass
                        : 'bg-surface-2 hover:bg-surface text-ink border-line hover:border-black/30 hover:text-ink'
                    )}
                  >
                    <span className="truncate">{tag}</span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 ml-1',
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-black/5 text-ink-3'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
