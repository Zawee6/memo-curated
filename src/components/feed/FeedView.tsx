'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/providers/AppStateProvider';
import { ParsedItem, SavedItem } from '@/types/item';
import { ViewMode } from '@/types/ui';
import { CommandBar } from './CommandBar';
import { AskAnswerPanel } from './AskAnswerPanel';
import { FeedGrid } from './FeedGrid';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  UtensilsCrossed,
  MapPin,
  Film,
  BookOpen,
  Search,
  RefreshCw,
  Heart,
} from 'lucide-react';

import { collapseItemsForCompilation } from '@/lib/video';

/**
 * 嚴格判斷是否允許出現在首頁：
 * 直接排除所有 category === 'media'（電影海報）以及任何影評項目，
 * 讓主頁只專注顯示食譜、景點與好物。
 */
function isHomeFeedEligible(item: ParsedItem): boolean {
  if (item.category === 'media') return false;
  if (
    item.mediaInfo?.movieTitle ||
    item.mediaInfo?.isMovie ||
    item.mediaInfo?.imdbId
  ) {
    return false;
  }
  const hasReviewKeyword =
    item.tags?.some((t) =>
      /影評|劇評|電影解說|電影介紹/.test(t)
    ) || /影評|劇評|電影解說/.test(item.title || '');
  if (hasReviewKeyword && item.category !== 'recipe' && item.category !== 'place') {
    return false;
  }
  return true;
}

function collapseItemsForHomeFeed(items: ParsedItem[]): ParsedItem[] {
  return collapseItemsForCompilation(items);
}

export function FeedView() {
  const {
    items,
    isLoading,
    syncFromServer,
    formatSpaceHref,
  } = useAppState();

  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute category counts
  const counts = useMemo(() => {
    const rawHomeItems = items.filter(isHomeFeedEligible);
    const collapsedHomeItems = collapseItemsForHomeFeed(rawHomeItems);
    return {
      all: collapsedHomeItems.length,
      place: items.filter((i) => i.category === 'place').length,
      recipe: items.filter((i) => i.category === 'recipe').length,
      collections: items.filter(
        (i) => i.category === 'media' || i.category === 'general'
      ).length,
      favorite: collapsedHomeItems.filter((i) => Boolean(i.isFavorite)).length,
    };
  }, [items]);

  // Filter items by search query and favorite for the Recent Activity stream (Strict Newest First, excluding media movies & reviews)
  const filteredItems = useMemo(() => {
    let list = items
      .filter(isHomeFeedEligible)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // 首頁折疊歸併
    list = collapseItemsForHomeFeed(list);

    if (showFavoritesOnly) {
      list = list.filter((i) => Boolean(i.isFavorite));
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((item) => {
      const inTitle = item.title?.toLowerCase().includes(q);
      const inOrigTitle = item.originalVideoTitle?.toLowerCase().includes(q);
      const inSummary = item.summary?.toLowerCase().includes(q);
      const inTags = item.tags?.some((t) => t.toLowerCase().includes(q));
      const inCustom = item.customTags?.some((t) => t.toLowerCase().includes(q));
      const inPlace =
        item.placeInfo?.locationName?.toLowerCase().includes(q) ||
        item.placeInfo?.address?.toLowerCase().includes(q) ||
        item.placeInfo?.city?.toLowerCase().includes(q);
      const inRecipe = item.recipeInfo?.ingredients?.some((ing) =>
        ing.name.toLowerCase().includes(q)
      );

      return inTitle || inOrigTitle || inSummary || inTags || inCustom || inPlace || inRecipe;
    });
  }, [items, showFavoritesOnly, searchQuery]);

  async function handleManualSync() {
    setIsSyncing(true);
    try {
      await syncFromServer();
    } finally {
      setTimeout(() => setIsSyncing(false), 400);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight text-ink">
            📖 靈感手帳動態
          </h1>
          <span
            suppressHydrationWarning
            className="text-xs font-sans font-bold text-ink-3 px-2 py-0.5 rounded-sm bg-surface border border-black/10"
          >
            {mounted ? counts.all : 0} 篇手帳
          </span>
        </div>

        <button
          type="button"
          onClick={handleManualSync}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-sans font-bold text-ink-2 bg-surface border border-black/15 hover:border-black/30 cursor-pointer transition-all shadow-2xs"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#3F7D58] ${
              isSyncing ? 'animate-spin' : ''
            }`}
          />
          <span>同步</span>
        </button>
      </div>

      {/* Omni Command Bar */}
      <CommandBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* AI Q&A Panel */}
      <AskAnswerPanel />

      {/* Compact Toolbar + Interleaved Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-black/10 pb-2.5 max-w-full">
          {/* 左側最前方固定：[❤️ 最愛] + [全部] + 分館快速導覽 (單行橫向滑動容器，防換行) */}
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 items-center py-1 max-w-full min-w-0 flex-1 text-xs">
            <button
              type="button"
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full cursor-pointer border transition-colors font-semibold whitespace-nowrap shrink-0 ${
                showFavoritesOnly
                  ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                  : 'bg-surface text-ink-2 border-black/10 hover:border-rose-300'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? 'fill-current' : 'text-rose-500'}`} />
              <span suppressHydrationWarning>最愛 ({mounted ? counts.favorite : 0})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFavoritesOnly(false)}
              className={`px-2.5 py-1 rounded-full cursor-pointer border transition-colors font-semibold whitespace-nowrap shrink-0 ${
                !showFavoritesOnly
                  ? 'bg-ink text-surface border-ink shadow-2xs'
                  : 'bg-surface text-ink-2 border-black/10 hover:border-black/30'
              }`}
            >
              <span suppressHydrationWarning>全部 ({mounted ? counts.all : 0})</span>
            </button>

            <span className="text-line-strong px-0.5 shrink-0">|</span>

            <Link
              href={formatSpaceHref('/recipes')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold bg-cat-recipe/10 text-cat-recipe border border-cat-recipe/25 hover:bg-cat-recipe/15 transition-colors whitespace-nowrap shrink-0"
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span suppressHydrationWarning>食譜 ({mounted ? counts.recipe : 0})</span>
            </Link>
            <Link
              href={formatSpaceHref('/places')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold bg-cat-place/10 text-cat-place border border-cat-place/25 hover:bg-cat-place/15 transition-colors whitespace-nowrap shrink-0"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span suppressHydrationWarning>景點 ({mounted ? counts.place : 0})</span>
            </Link>
            <Link
              href={formatSpaceHref('/collections')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold bg-cat-media/10 text-cat-media border border-cat-media/25 hover:bg-cat-media/15 transition-colors whitespace-nowrap shrink-0"
            >
              <Film className="w-3.5 h-3.5" />
              <span suppressHydrationWarning>電影收藏 ({mounted ? counts.collections : 0})</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-ink-3 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-ink text-surface font-semibold'
                  : 'bg-surface border border-line'
              }`}
            >
              卡片
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              className={`px-2.5 py-1 rounded cursor-pointer ${
                viewMode === 'compact'
                  ? 'bg-ink text-surface font-semibold'
                  : 'bg-surface border border-line'
              }`}
            >
              列表
            </button>
          </div>
        </div>

        {filteredItems.length > 0 || isLoading ? (
          <FeedGrid
            items={filteredItems}
            isLoading={isLoading}
            viewMode={viewMode}
            mode="home"
            onSelect={(item) => setSelectedItem(item)}
          />
        ) : (
          <EmptyState
            icon={
              searchQuery ? (
                <Search className="w-6 h-6" />
              ) : (
                <BookOpen className="w-6 h-6" />
              )
            }
            title={
              showFavoritesOnly
                ? '目前尚無最愛收藏'
                : searchQuery
                ? '找不到相符的靈感項目'
                : '目前尚無收藏'
            }
            description={
              showFavoritesOnly
                ? '點擊任何卡片右上角的愛心圖示，即可將項目加入最愛收藏。'
                : '在上方輸入框貼上連結即可自動整理。'
            }
          />
        )}
      </div>

      <DetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}
