'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppState } from '@/providers/AppStateProvider';
import { SavedItem } from '@/types/item';
import { ViewMode } from '@/types/ui';
import { CommandBar } from '@/components/feed/CommandBar';
import { FeedGrid } from '@/components/feed/FeedGrid';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { Film, LayoutGrid, List, Heart, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { getMediaSmartTags } from '@/lib/smartTags';
import { SmartTagFilterBar } from '@/components/common/SmartTagFilterBar';

export function CollectionsView() {
  const { items, isLoading, openRandomDecision } =
    useAppState();
  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);
  const [subFilter, setSubFilter] = useState<
    'all' | 'movies' | 'media' | 'general'
  >('all');
  const [selectedSmartTag, setSelectedSmartTag] = useState<string | undefined>();
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const movieItems = useMemo(() => {
    return items
      .filter((i) => i.category === 'media')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [items]);

  const counts = useMemo(() => {
    const streaming = movieItems.filter((i) =>
      i.mediaInfo?.streamingPlatforms?.some((p) => p.isAvailable)
    );
    return {
      all: movieItems.length,
      streaming: streaming.length,
      favorite: movieItems.filter((i) => i.isFavorite).length,
      completed: movieItems.filter((i) => Boolean(i.isCompleted)).length,
    };
  }, [movieItems]);

  // 統計電影與影視中出現的所有智慧標籤
  const availableSmartTags = useMemo(() => {
    const counts = new Map<string, number>();
    movieItems.forEach((p) => {
      const tags = getMediaSmartTags(p);
      tags.forEach((t) => {
        counts.set(t, (counts.get(t) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [movieItems]);

  const filtered = useMemo(() => {
    return movieItems.filter((item) => {
      if (showFavoritesOnly && !item.isFavorite) {
        return false;
      }
      if (showCompletedOnly && !item.isCompleted) {
        return false;
      }

      if (subFilter === 'media') {
        const hasStreaming = item.mediaInfo?.streamingPlatforms?.some((p) => p.isAvailable);
        if (!hasStreaming) return false;
      }

      if (selectedSmartTag) {
        if (!getMediaSmartTags(item).includes(selectedSmartTag)) return false;
      }

      return true;
    });
  }, [movieItems, showFavoritesOnly, showCompletedOnly, subFilter, selectedSmartTag]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 space-y-4">
      {/* Compact Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-ink">
            🎬 電影與影集資料庫
          </h1>
          <span
            suppressHydrationWarning
            className="text-xs font-mono text-ink-3 px-2 py-0.5 rounded-full bg-surface border border-line"
          >
            {mounted ? counts.all : 0} 部
          </span>
        </div>

        <div className="w-full md:w-96">
          <CommandBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </div>

      {/* Sub-category Filter Bar (支援橫向滑動與多行展開) */}
      <div className="space-y-2 pb-2 border-b border-black/10 w-full max-w-full box-border">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            <Sparkles className="w-3.5 h-3.5 text-cat-media" />
            <span className="font-semibold text-ink-2">分類與智慧標籤</span>
          </div>

          <div className="flex items-center gap-2">
            {/* 🎲 幫我決定 (Decide for Me) */}
            <button
              type="button"
              onClick={() => openRandomDecision(filtered)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent/15 text-accent hover:bg-accent hover:text-white border border-accent/30 transition-all cursor-pointer shadow-2xs"
              title="從目前篩選的電影中隨機抽選一部今晚看！"
            >
              <span>🎲 幫我決定</span>
            </button>

            <div className="inline-flex items-center p-0.5 rounded-control bg-surface border border-line">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1 rounded transition-colors cursor-pointer',
                  viewMode === 'grid'
                    ? 'bg-ink text-surface'
                    : 'text-ink-3 hover:text-ink'
                )}
                title="雜誌卡片檢視"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className={cn(
                  'p-1 rounded transition-colors cursor-pointer',
                  viewMode === 'compact'
                    ? 'bg-ink text-surface'
                    : 'text-ink-3 hover:text-ink'
                )}
                title="精簡列表檢視"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="w-full max-w-full">
          <div className="w-full max-w-full py-1 text-xs flex flex-wrap items-center gap-2">
            {/* 1. 最前方固定：[❤️ 最愛] */}
            <button
              type="button"
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                setShowCompletedOnly(false);
                setSelectedSmartTag(undefined);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border',
                showFavoritesOnly
                  ? 'bg-rose-500 text-white border-rose-500 shadow-2xs'
                  : 'bg-surface text-ink-2 border-black/15 hover:border-rose-300'
              )}
            >
              <Heart className={cn('w-3.5 h-3.5', showFavoritesOnly ? 'fill-current' : 'text-rose-500')} />
              <span suppressHydrationWarning>最愛 ({mounted ? counts.favorite : 0})</span>
            </button>

            {/* 1.5 已完成 (已看過) */}
            <button
              type="button"
              onClick={() => {
                setShowCompletedOnly(!showCompletedOnly);
                setShowFavoritesOnly(false);
                setSelectedSmartTag(undefined);
              }}
              className={cn(
                'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border',
                showCompletedOnly
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-surface text-ink-2 border-black/15 hover:border-emerald-400'
              )}
            >
              <span suppressHydrationWarning>✓ 已完成 ({mounted ? counts.completed : 0})</span>
            </button>

            {/* 2. 全部電影 */}
            <button
              type="button"
              onClick={() => {
                setSubFilter('all');
                setShowFavoritesOnly(false);
                setShowCompletedOnly(false);
                setSelectedSmartTag(undefined);
              }}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border',
                subFilter === 'all' && !showFavoritesOnly && !showCompletedOnly && !selectedSmartTag
                  ? 'bg-ink text-surface border-ink shadow-2xs'
                  : 'bg-surface text-ink-2 border-black/10 hover:border-black/30'
              )}
            >
              <span suppressHydrationWarning>🎬 全部電影 ({mounted ? counts.all : 0})</span>
            </button>

            {/* 3. 串流已上架 */}
            <button
              type="button"
              onClick={() => {
                setSubFilter(subFilter === 'media' ? 'all' : 'media');
                setShowFavoritesOnly(false);
                setShowCompletedOnly(false);
                setSelectedSmartTag(undefined);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border',
                subFilter === 'media'
                  ? 'bg-[#67578D] text-white border-[#67578D] shadow-2xs'
                  : 'bg-surface text-ink-2 border-black/15 hover:border-[#67578D]'
              )}
            >
              <Film className="w-3.5 h-3.5" />
              <span suppressHydrationWarning>📺 串流平台已上架 ({mounted ? counts.streaming : 0})</span>
            </button>
          </div>
        </div>

        {/* 影視智慧標籤快速篩選（支援橫向捲動、‹ › 箭頭、滑鼠滾輪橫向滑動與 🏷️ 全部標籤總覽） */}
        {availableSmartTags.length > 0 && (
          <div className="w-full pt-2 border-t border-line/60">
            <SmartTagFilterBar
              tags={availableSmartTags}
              selectedTag={selectedSmartTag}
              onSelectTag={(tag) => setSelectedSmartTag(tag)}
              totalCount={movieItems.length}
              title="影音智慧分類"
              themeColor="media"
              allLabel="全部影視"
              onClearOtherFilters={() => {
                setShowFavoritesOnly(false);
                setShowCompletedOnly(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Chiayi Theaters Quick Links */}
      <div className="flex flex-wrap items-center gap-2 py-1 px-1">
        <span className="text-xs font-semibold text-ink-3">嘉義院線時刻：</span>
        <a
          href="https://www.3d-movies.tw/time.aspx"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface hover:bg-surface-2 text-ink border border-line shadow-2xs transition-all cursor-pointer"
        >
          <span>🎟️ 嘉義嘉年華時刻表</span>
          <ExternalLink className="w-3 h-3 text-ink-3" />
        </a>
        <a
          href="https://www.in89cinemax.com/film_list.aspx?TheaterId=17"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface hover:bg-surface-2 text-ink border border-line shadow-2xs transition-all cursor-pointer"
        >
          <span>🍿 嘉義 in89 豪華影城</span>
          <ExternalLink className="w-3 h-3 text-ink-3" />
        </a>
      </div>

      {/* Grid */}
      {filtered.length > 0 || isLoading ? (
        <FeedGrid
          items={filtered}
          isLoading={isLoading}
          viewMode={viewMode}
          mode="collections"
          onSelect={(item) => setSelectedItem(item)}
        />
      ) : (
        <EmptyState
          icon={<Film className="w-6 h-6 text-cat-media" />}
          title="尚無影音或一般好物收藏"
          description="貼上影評、YouTube、Threads 好物推薦或知識文章網址，AI 將自動歸檔至此分館！"
        />
      )}

      <DetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}
