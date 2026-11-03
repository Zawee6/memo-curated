'use client';

import React, { useMemo } from 'react';
import { ParsedItem } from '@/types/item';
import { ViewMode } from '@/types/ui';
import { FeedCard } from './FeedCard';
import { FeedCardSkeleton } from './FeedCardSkeleton';
import { distributeToColumns } from '@/lib/dualColumnMasonry';

export interface FeedStreamEntry {
  key: string;
  item: ParsedItem;
  sourceTitle?: string;
  sourceThumbnailUrl?: string;
  sourceUrl?: string;
  sourceAuthor?: string;
  archivedMovieTitle?: string;
  sourceId?: string;
  timestamp?: number;
}

export interface FeedGridProps {
  items?: ParsedItem[];
  streamEntries?: FeedStreamEntry[];
  isLoading: boolean;
  viewMode?: ViewMode;
  mode?: 'home' | 'collections' | 'picks';
  onSelect?: (item: ParsedItem) => void;
  onFocusPlace?: (place: ParsedItem) => void;
}

export function FeedGrid({
  items = [],
  streamEntries,
  isLoading,
  viewMode = 'grid',
  mode = 'home',
  onSelect,
  onFocusPlace,
}: FeedGridProps) {
  // 1. 真・瀑布流分欄：首頁 streamEntries 模式（手機 2 欄、平板 3 欄、電腦 4 欄）
  const streamColsMobile = useMemo(
    () =>
      distributeToColumns(streamEntries || [], 2, (entry) => ({
        id: entry.key,
        url: entry.sourceUrl || entry.item.url,
        aspectRatio: entry.item.aspectRatio,
      })),
    [streamEntries]
  );

  const streamColsTablet = useMemo(
    () =>
      distributeToColumns(streamEntries || [], 3, (entry) => ({
        id: entry.key,
        url: entry.sourceUrl || entry.item.url,
        aspectRatio: entry.item.aspectRatio,
      })),
    [streamEntries]
  );

  const streamColsDesktop = useMemo(
    () =>
      distributeToColumns(streamEntries || [], 4, (entry) => ({
        id: entry.key,
        url: entry.sourceUrl || entry.item.url,
        aspectRatio: entry.item.aspectRatio,
      })),
    [streamEntries]
  );

  // 2. 真・瀑布流分欄：一般 items 模式（手機 2 欄、平板 3 欄、電腦 4 欄）
  const itemColsMobile = useMemo(
    () =>
      distributeToColumns(items || [], 2, (item) => ({
        id: item.id,
        url: item.url,
        aspectRatio: item.aspectRatio,
      })),
    [items]
  );

  const itemColsTablet = useMemo(
    () =>
      distributeToColumns(items || [], 3, (item) => ({
        id: item.id,
        url: item.url,
        aspectRatio: item.aspectRatio,
      })),
    [items]
  );

  const itemColsDesktop = useMemo(
    () =>
      distributeToColumns(items || [], 4, (item) => ({
        id: item.id,
        url: item.url,
        aspectRatio: item.aspectRatio,
      })),
    [items]
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3.5 items-start">
        {Array.from({ length: 4 }).map((_, idx) => (
          <FeedCardSkeleton key={idx} />
        ))}
      </div>
    );
  }

  function renderStreamEntry(entry: FeedStreamEntry, idx: number) {
    return (
      <FeedCard
        key={entry.key}
        item={entry.item}
        index={idx}
        viewMode="grid"
        mode={mode}
        sourceTitle={entry.sourceTitle}
        sourceThumbnailUrl={entry.sourceThumbnailUrl}
        sourceUrl={entry.sourceUrl}
        sourceAuthor={entry.sourceAuthor}
        archivedMovieTitle={entry.archivedMovieTitle}
        sourceId={entry.sourceId}
        onSelect={onSelect}
        onFocusPlace={onFocusPlace}
      />
    );
  }

  function renderItemCard(item: ParsedItem, idx: number) {
    return (
      <FeedCard
        key={item.id}
        item={item}
        index={idx}
        viewMode="grid"
        mode={mode}
        onSelect={onSelect}
        onFocusPlace={onFocusPlace}
      />
    );
  }

  function renderColumns<T>(
    cols: T[][],
    renderFn: (item: T, idx: number) => React.ReactNode,
    gapClass: string
  ) {
    return (
      <div className={`flex flex-row ${gapClass} items-start w-full`}>
        {cols.map((col, colIdx) => (
          <div key={colIdx} className={`flex-1 flex flex-col ${gapClass} min-w-0`}>
            {col.map((item, idx) => renderFn(item, idx))}
          </div>
        ))}
      </div>
    );
  }

  // 1. 若有傳入 streamEntries（首頁展開原始影音來源模式）
  if (streamEntries && streamEntries.length > 0) {
    if (viewMode === 'compact') {
      return (
        <div className="flex flex-col gap-2 max-w-4xl mx-auto w-full">
          {streamEntries.map((entry, idx) => (
            <FeedCard
              key={entry.key}
              item={entry.item}
              index={idx}
              viewMode="compact"
              mode={mode}
              sourceTitle={entry.sourceTitle}
              sourceThumbnailUrl={entry.sourceThumbnailUrl}
              sourceUrl={entry.sourceUrl}
              sourceAuthor={entry.sourceAuthor}
              archivedMovieTitle={entry.archivedMovieTitle}
              sourceId={entry.sourceId}
              onSelect={onSelect}
              onFocusPlace={onFocusPlace}
            />
          ))}
        </div>
      );
    }

    return (
      <>
        {/* 📱 手機版 (< md)：2 欄獨立垂直 Flex 瀑布流，下一張卡片無縫往上貼齊 */}
        <div className="w-full md:hidden">
          {renderColumns(streamColsMobile, renderStreamEntry, 'gap-2.5 sm:gap-3')}
        </div>
        {/* 💻 平板 (md: 至 lg:)：3 欄獨立垂直 Flex 瀑布流 */}
        <div className="hidden md:block lg:hidden w-full">
          {renderColumns(streamColsTablet, renderStreamEntry, 'gap-3.5')}
        </div>
        {/* 🖥️ 電腦大螢幕 (lg:)：4 欄獨立垂直 Flex 瀑布流 */}
        <div className="hidden lg:block w-full">
          {renderColumns(streamColsDesktop, renderStreamEntry, 'gap-3.5 md:gap-4')}
        </div>
      </>
    );
  }

  // 2. 一般項目清單 (compact 模式)
  if (viewMode === 'compact') {
    return (
      <div className="flex flex-col gap-2 max-w-4xl mx-auto w-full">
        {items.map((item, idx) => (
          <FeedCard
            key={item.id}
            item={item}
            index={idx}
            viewMode="compact"
            mode={mode}
            onSelect={onSelect}
            onFocusPlace={onFocusPlace}
          />
        ))}
      </div>
    );
  }

  // 3. 一般卡片列表（包含首頁、景點、電影、好物等各分頁）：真・瀑布流佈局
  const gapMobile = mode === 'collections' ? 'gap-3' : 'gap-2.5 sm:gap-3';
  const gapTablet = mode === 'collections' ? 'gap-4' : 'gap-3.5';
  const gapDesktop = mode === 'collections' ? 'gap-5' : 'gap-3.5 md:gap-4';

  return (
    <>
      {/* 📱 手機版 (< md)：2 欄獨立垂直 Flex 瀑布流 */}
      <div className="w-full md:hidden">
        {renderColumns(itemColsMobile, renderItemCard, gapMobile)}
      </div>
      {/* 💻 平板 (md: 至 lg:)：3 欄獨立垂直 Flex 瀑布流 */}
      <div className="hidden md:block lg:hidden w-full">
        {renderColumns(itemColsTablet, renderItemCard, gapTablet)}
      </div>
      {/* 🖥️ 電腦大螢幕 (lg:)：4 欄獨立垂直 Flex 瀑布流 */}
      <div className="hidden lg:block w-full">
        {renderColumns(itemColsDesktop, renderItemCard, gapDesktop)}
      </div>
    </>
  );
}

