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
import { ShoppingBag, User, Package, Heart, LayoutGrid, List, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { getProductSmartTags } from '@/lib/smartTags';
import { SmartTagFilterBar } from '@/components/common/SmartTagFilterBar';

export function PicksView() {
  const { items, isLoading, openRandomDecision } = useAppState();
  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);
  const [subFilter, setSubFilter] = useState<'all' | 'accounts' | 'products'>('all');
  const [selectedSmartTag, setSelectedSmartTag] = useState<string | undefined>();
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 過濾出好物與帳號 (account, product, 或 general)
  const pickItems = useMemo(() => {
    return items
      .filter((i) => {
        // 排除電影與影評
        if (
          i.category === 'media' ||
          i.mediaInfo?.movieTitle ||
          i.mediaInfo?.isMovie ||
          i.mediaInfo?.imdbId
        ) {
          return false;
        }
        return (
          i.category === 'account' ||
          i.category === 'product' ||
          i.category === 'general' ||
          Boolean(i.productInfo?.brand) ||
          Boolean(i.accountInfo?.handle) ||
          i.aspectRatio === '1:1'
        );
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [items]);

  const counts = useMemo(() => {
    const accounts = pickItems.filter(
      (i) => i.category === 'account' || Boolean(i.accountInfo?.handle)
    );
    const products = pickItems.filter(
      (i) => i.category === 'product' || Boolean(i.productInfo?.brand)
    );
    return {
      all: pickItems.length,
      accounts: accounts.length,
      products: products.length,
      favorites: pickItems.filter((i) => i.isFavorite).length,
      completed: pickItems.filter((i) => Boolean(i.isCompleted)).length,
    };
  }, [pickItems]);

  // 統計目前分類下出現的智慧標籤（依據當前選取的 subFilter 動態計算）
  const availableSmartTags = useMemo(() => {
    let itemsToScan = pickItems;
    if (subFilter === 'accounts') {
      itemsToScan = pickItems.filter(
        (i) => i.category === 'account' || Boolean(i.accountInfo?.handle)
      );
    } else if (subFilter === 'products') {
      itemsToScan = pickItems.filter(
        (i) => i.category === 'product' || Boolean(i.productInfo?.brand)
      );
    }
    const counts = new Map<string, number>();
    itemsToScan.forEach((p) => {
      const tags = getProductSmartTags(p);
      tags.forEach((t) => {
        counts.set(t, (counts.get(t) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [pickItems, subFilter]);

  const filtered = useMemo(() => {
    return pickItems.filter((item) => {
      if (showFavoritesOnly && !item.isFavorite) {
        return false;
      }
      if (showCompletedOnly && !item.isCompleted) {
        return false;
      }

      if (subFilter === 'accounts') {
        const isAccount = item.category === 'account' || Boolean(item.accountInfo?.handle);
        if (!isAccount) return false;
      } else if (subFilter === 'products') {
        const isProduct = item.category === 'product' || Boolean(item.productInfo?.brand);
        if (!isProduct) return false;
      }

      if (selectedSmartTag) {
        const targetTag = selectedSmartTag.trim().toLowerCase();
        if (!getProductSmartTags(item).some((t) => t.trim().toLowerCase() === targetTag)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = item.title.toLowerCase().includes(q);
        const inSummary = item.summary?.toLowerCase().includes(q);
        const inTags = item.tags?.some((t) => t.toLowerCase().includes(q));
        const inBrand = item.productInfo?.brand?.toLowerCase().includes(q);
        const inHandle = item.accountInfo?.handle?.toLowerCase().includes(q);

        if (!inTitle && !inSummary && !inTags && !inBrand && !inHandle) {
          return false;
        }
      }
      return true;
    });
  }, [pickItems, subFilter, selectedSmartTag, showFavoritesOnly, showCompletedOnly, searchQuery]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 space-y-4 select-none">
      {/* 頂部標題 + 快貼輸入列 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="font-sans text-xl md:text-2xl font-bold tracking-tight text-ink">
            🛍️ 好物與推薦帳號
          </h1>
          <span
            suppressHydrationWarning
            className="text-xs font-mono text-ink-3 px-2 py-0.5 rounded-full bg-surface border border-line"
          >
            {mounted ? pickItems.length : 0} 項目
          </span>
        </div>

        <div className="w-full md:w-96">
          <CommandBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </div>

      {/* 專屬篩選膠囊列 (支援橫向滑動與多行展開) */}
      <div className="p-3 rounded-2xl bg-surface border border-line shadow-2xs max-w-full space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-ink-3">
            <Sparkles className="w-3.5 h-3.5 text-cat-general" />
            <span className="font-semibold text-ink-2">好物與帳號分類</span>
          </div>

          <div className="flex items-center gap-2">
            {/* 🎲 幫我決定 (Decide for Me) */}
            <button
              type="button"
              onClick={() => openRandomDecision(filtered)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent/15 text-accent hover:bg-accent hover:text-white border border-accent/30 transition-all cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
              title="從目前篩選的好物與帳號中隨機抽選一項！"
            >
              <span>🎲 幫我決定</span>
            </button>
          </div>
        </div>

        <div className="w-full max-w-full">
          <div className="w-full max-w-full py-1 text-xs flex flex-wrap items-center gap-2">
            {/* 最愛篩選 */}
            <button
              type="button"
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                setShowCompletedOnly(false);
                setSelectedSmartTag(undefined);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border',
                showFavoritesOnly
                  ? 'bg-rose-500 text-white border-rose-500 shadow-2xs'
                  : 'bg-surface text-ink-2 border-black/15 hover:border-rose-300'
              )}
            >
              <Heart className={cn('w-3.5 h-3.5', showFavoritesOnly ? 'fill-current' : 'text-rose-500')} />
              <span suppressHydrationWarning>最愛 ({mounted ? counts.favorites : 0})</span>
            </button>

            {/* 已完成 */}
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

            {/* 全部 */}
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
              <span suppressHydrationWarning>全部 ({mounted ? counts.all : 0})</span>
            </button>

            {/* 推薦帳號 */}
            <button
              type="button"
              onClick={() => {
                setSubFilter('accounts');
                setShowFavoritesOnly(false);
                setShowCompletedOnly(false);
                setSelectedSmartTag(undefined);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border',
                subFilter === 'accounts' && !showFavoritesOnly && !showCompletedOnly
                  ? 'bg-[#0284C7] text-white border-[#0284C7] shadow-2xs'
                  : 'bg-surface text-ink-2 border-black/10 hover:border-sky-300'
              )}
            >
              <User className="w-3.5 h-3.5" />
              <span suppressHydrationWarning>👤 推薦帳號 ({mounted ? counts.accounts : 0})</span>
            </button>

            {/* 精選好物 */}
            <button
              type="button"
              onClick={() => {
                setSubFilter('products');
                setShowFavoritesOnly(false);
                setShowCompletedOnly(false);
                setSelectedSmartTag(undefined);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border',
                subFilter === 'products' && !showFavoritesOnly && !showCompletedOnly
                  ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-2xs'
                  : 'bg-surface text-ink-2 border-black/10 hover:border-orange-300'
              )}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span suppressHydrationWarning>📦 精選商品 ({mounted ? counts.products : 0})</span>
            </button>
          </div>
        </div>

        {/* 好物智慧標籤篩選（支援橫向捲動、‹ › 箭頭、滑鼠滾輪橫向滑動與 🏷️ 全部標籤總覽） */}
        {availableSmartTags.length > 0 && (
          <div className="w-full pt-2 border-t border-line/60">
            <SmartTagFilterBar
              tags={availableSmartTags}
              selectedTag={selectedSmartTag}
              onSelectTag={(tag) => setSelectedSmartTag(tag)}
              totalCount={pickItems.length}
              title="精選好物標籤"
              themeColor="general"
              allLabel="全部好物"
              onClearOtherFilters={() => {
                setShowFavoritesOnly(false);
                setShowCompletedOnly(false);
              }}
            />
          </div>
        )}
      </div>

      {/* 卡片牆 */}
      {pickItems.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-6 h-6 text-cat-general" />}
          title="尚無精選好物或推薦帳號"
          description="在上方輸入框貼上喜愛的 3C 生活好物網址、IG 創作者個人主頁或 YouTube 頻道，Memo 會自動為您以 1:1 正方形卡片收藏建檔！"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="w-6 h-6 text-ink-3" />}
          title="沒有符合條件的好物或帳號"
          description="請嘗試調整關鍵字搜尋，或切換上方篩選膠囊。"
          actionLabel="瀏覽全部好物與帳號"
          onAction={() => {
            setSubFilter('all');
            setShowFavoritesOnly(false);
            setSearchQuery('');
          }}
        />
      ) : (
        <div className="w-full space-y-8">
          {/* 第一區：📦 精選好物與產品評測 */}
          {(subFilter === 'all' || subFilter === 'products') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-black/10">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-orange-500/10 text-orange-600">
                    <ShoppingBag className="w-4 h-4" />
                  </span>
                  <h2 className="font-sans text-sm sm:text-base font-bold text-ink">
                    📦 精選好物與產品評測
                  </h2>
                  <span className="text-xs font-mono text-ink-3 px-2 py-0.5 rounded-full bg-surface border border-line">
                    {filtered.filter((i) => i.category === 'product' || Boolean(i.productInfo?.brand)).length} 項
                  </span>
                </div>
                <span className="text-xs text-ink-3 hidden sm:inline">
                  3C 電子 · 廚房用品 · 生活裝備 · 規格比價
                </span>
              </div>

              {filtered.filter((i) => i.category === 'product' || Boolean(i.productInfo?.brand)).length === 0 ? (
                <div className="p-6 text-center text-xs text-ink-3 bg-surface rounded-xl border border-line">
                  目前篩選條件下無好物產品
                </div>
              ) : (
                <FeedGrid
                  items={filtered.filter((i) => i.category === 'product' || Boolean(i.productInfo?.brand))}
                  isLoading={isLoading}
                  viewMode={viewMode}
                  mode="picks"
                  onSelect={(item) => setSelectedItem(item)}
                />
              )}
            </div>
          )}

          {/* 第二區：👤 推薦帳號與創作者 */}
          {(subFilter === 'all' || subFilter === 'accounts') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-black/10">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-sky-500/10 text-sky-600">
                    <User className="w-4 h-4" />
                  </span>
                  <h2 className="font-sans text-sm sm:text-base font-bold text-ink">
                    👤 推薦帳號與創作者
                  </h2>
                  <span className="text-xs font-mono text-ink-3 px-2 py-0.5 rounded-full bg-surface border border-line">
                    {filtered.filter((i) => i.category === 'account' || Boolean(i.accountInfo?.handle) || (!i.productInfo?.brand && i.category !== 'product')).length} 個
                  </span>
                </div>
                <span className="text-xs text-ink-3 hidden sm:inline">
                  IG 攝影 · 美食探店博主 · 料理主廚頻道
                </span>
              </div>

              {filtered.filter((i) => i.category === 'account' || Boolean(i.accountInfo?.handle) || (!i.productInfo?.brand && i.category !== 'product')).length === 0 ? (
                <div className="p-6 text-center text-xs text-ink-3 bg-surface rounded-xl border border-line">
                  目前篩選條件下無創作者帳號
                </div>
              ) : (
                <FeedGrid
                  items={filtered.filter((i) => i.category === 'account' || Boolean(i.accountInfo?.handle) || (!i.productInfo?.brand && i.category !== 'product'))}
                  isLoading={isLoading}
                  viewMode={viewMode}
                  mode="picks"
                  onSelect={(item) => setSelectedItem(item)}
                />
              )}
            </div>
          )}
        </div>
      )}

      <DetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}
