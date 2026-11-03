'use client';

import React from 'react';
import { ParsedItem } from '@/types/item';
import { ViewMode } from '@/types/ui';
import { useAppState } from '@/providers/AppStateProvider';
import { getCategoryMeta } from '@/lib/categories';
import { getDomain } from '@/lib/format';
import { CoverImage } from '@/components/feed/CoverImage';
import { Trash2, Plus, Check, MapPin, Heart, User, UtensilsCrossed, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaAspectType, getEffectiveThumbnail } from '@/lib/video';
import { getRecipeSmartTags } from '@/lib/recipeUtils';
import { getItemSmartTags } from '@/lib/smartTags';

export interface ItemCardProps {
  item: ParsedItem;
  viewMode?: ViewMode;
  mode?: 'home' | 'collections' | 'picks';
  sourceTitle?: string;
  sourceThumbnailUrl?: string;
  sourceUrl?: string;
  sourceAuthor?: string;
  archivedMovieTitle?: string;
  sourceId?: string;
  highlightRole?: string;
  index?: number;
  onSelect?: (item: ParsedItem) => void;
  onFocusPlace?: (place: ParsedItem) => void;
}

export function ItemCard({
  item,
  viewMode = 'grid',
  mode = 'home',
  sourceTitle,
  sourceThumbnailUrl,
  sourceUrl,
  sourceId,
  highlightRole,
  index = 0,
  onSelect,
}: ItemCardProps) {
  const {
    openDetail,
    toggleFavorite,
    deleteItem,
    deleteSourcePost,
    selectedCookingRecipeIds,
    toggleCookingRecipe,
    selectedPlaceIds,
    toggleSelectedPlace,
  } = useAppState();

  const isRecipe = item.category === 'recipe';
  const isPlace = item.category === 'place';
  const isSelectedForCooking = isRecipe && selectedCookingRecipeIds.includes(item.id);
  const isSelectedForPlace = isPlace && selectedPlaceIds.includes(item.id);
  const isSelected = isSelectedForCooking || isSelectedForPlace;
  const smartTags = isRecipe ? getRecipeSmartTags(item) : null;
  const autoSmartTags = getItemSmartTags(item);
  const ingredientCount = item.recipeInfo?.ingredients?.length || 0;
  const catMeta = getCategoryMeta(item.category);
  const CatIcon = catMeta.icon;

  // 1. 決定目標網址 (Url) - 僅供縮圖與網域文字顯示，絕不跳轉
  const displayUrl = sourceUrl || item.url;
  const domain = getDomain(displayUrl);

  // 2. 決定展示標題 (Title)
  const displayTitle =
    sourceTitle ||
    (item.category === 'media'
      ? item.mediaInfo?.movieTitle || item.title
      : item.title);

  // 3. 決定展示封面圖 (Cover) - 嚴格過濾無效/錢包圖示，強化 YouTube Fallback
  const displayCover =
    item.category === 'media' && item.mediaInfo?.posterUrl
      ? item.mediaInfo.posterUrl
      : getEffectiveThumbnail(item, displayUrl) || sourceThumbnailUrl || item.thumbnailUrl;

  // 4. 決定比例 (Aspect Ratio)
  const aspectType: MediaAspectType =
    mode === 'picks' || item.category === 'account' || item.category === 'product'
      ? 'square-1-1'
      : item.category === 'media'
      ? 'poster-27-40'
      : 'vertical-9-16';

  const handleCardSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSelect) {
      onSelect(item);
    }
    openDetail(item);
  };

  // 列表模式 (Compact List Mode)
  if (viewMode === 'compact') {
    return (
      <div
        onClick={handleCardSelect}
        className="group flex items-center justify-between gap-4 p-3 bg-surface hover:bg-surface-2/60 border border-line hover:border-line-strong rounded-card shadow-xs transition-all duration-150 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-control overflow-hidden shrink-0 border border-line bg-stone-900">
            <CoverImage
              thumbnailUrl={displayCover}
              title={displayTitle}
              category={item.category}
              url={displayUrl}
              id={item.id}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-2">
                <CatIcon className="w-3 h-3" />
                <span>{catMeta.label}</span>
              </span>
              {isPlace && item.placeInfo?.city && (
                <span className="text-[11px] font-bold text-[#E07A5F] flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />
                  <span>{item.placeInfo.city}</span>
                </span>
              )}
              {isRecipe && ingredientCount > 0 && (
                <span className="text-[11px] font-semibold text-cat-recipe">
                  {ingredientCount} 項食材
                </span>
              )}
              {item.isFavorite && <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />}
              <span className="text-[11px] text-ink-3 font-mono">{domain}</span>
            </div>
            <h3 className="font-display text-sm font-semibold text-ink group-hover:text-accent transition-colors truncate">
              {displayTitle}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(isRecipe || isPlace) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (isRecipe) {
                  toggleCookingRecipe(item.id);
                }
                if (isPlace) {
                  toggleSelectedPlace(item.id);
                }
              }}
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer',
                isSelected
                  ? 'bg-[#3F7D58] text-white shadow-xs'
                  : 'bg-surface-2 text-ink-2 hover:bg-surface hover:text-ink border border-line'
              )}
              title={
                isSelected
                  ? isRecipe
                    ? '✓ 已在今日料理清單'
                    : '✓ 已在待排行程清單'
                  : isRecipe
                  ? '＋ 加入今日料理清單'
                  : '＋ 加入待排行程清單'
              }
            >
              {isSelected ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleFavorite(item.id);
            }}
            className="p-1 text-ink-3 hover:text-rose-500 cursor-pointer"
            title={item.isFavorite ? '❤️ 取消最愛' : '🤍 設為最愛'}
          >
            <Heart className={cn('w-4 h-4', item.isFavorite && 'fill-rose-500 text-rose-500')} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (sourceId && item.sources && item.sources.length > 1) {
                if (window.confirm(`確定要從電影中移除這支影片來源嗎？`)) {
                  deleteSourcePost(item.id, sourceId);
                }
              } else {
                if (window.confirm(`確定要刪除「${item.title}」嗎？`)) {
                  deleteItem(item.id);
                }
              }
            }}
            className="p-1 text-ink-3 hover:text-rose-500 cursor-pointer"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 創作者名片卡 (Creator Profile Card): category === 'account'
  if (item.category === 'account') {
    const accountInfo = item.accountInfo;
    const handle =
      accountInfo?.handle ||
      (displayTitle.includes('@') ? displayTitle : undefined);
    const domainTags =
      item.tags && item.tags.length > 0 ? item.tags.slice(0, 2) : [];
    const avatarUrl = accountInfo?.avatarUrl || displayCover;

    return (
      <div
        onClick={handleCardSelect}
        style={{
          animationDelay: `${Math.min(index ?? 0, 15) * 30}ms`,
        }}
        className={cn(
          'animate-memo-entrance relative overflow-hidden rounded-2xl group cursor-pointer shadow-xs hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-300 border border-black/10 select-none aspect-square w-full col-span-1 bg-gradient-to-b from-[#FBF9F5] via-[#F4F1EA] to-[#EAE6DD] dark:from-[#24211E] dark:via-[#1F1C1A] dark:to-[#171514] p-3.5 sm:p-4 flex flex-col justify-between items-center text-center ring-1 ring-black/5',
          item.isFavorite && 'border-rose-400/40 ring-1 ring-rose-400/30'
        )}
      >
        {/* 左上角：社群平台/創作者標籤 */}
        <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 dark:bg-black/75 text-ink-2 border border-black/10 dark:border-white/10 shadow-2xs">
            <User className="w-3 h-3 text-[#D97706]" />
            <span className="capitalize">{accountInfo?.platform || '創作者'}</span>
          </div>
        </div>

        {/* 右上角：極簡最愛愛心 + 刪除按鈕 */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleFavorite(item.id);
            }}
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-90',
              item.isFavorite
                ? 'bg-rose-500 text-white scale-105 shadow-md border border-rose-400'
                : 'bg-white/90 dark:bg-black/75 text-ink-2 hover:text-rose-500 border border-black/10 dark:border-white/10'
            )}
            title={item.isFavorite ? '❤️ 取消最愛' : '🤍 設為最愛'}
          >
            <Heart className={cn('w-3.5 h-3.5', item.isFavorite && 'fill-white')} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (window.confirm(`確定要刪除「${item.title}」嗎？`)) {
                deleteItem(item.id);
              }
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/90 dark:bg-black/75 text-ink-3 hover:text-rose-500 border border-black/10 dark:border-white/10 transition-all shadow-xs cursor-pointer active:scale-90"
            title="刪除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 中央主視覺：精緻圓形頭像 + 名稱 + @帳號 */}
        <div className="my-auto pt-3 flex flex-col items-center w-full min-w-0 pointer-events-none">
          <div className="relative">
            <div className="w-18 h-18 sm:w-20 sm:h-20 md:w-22 md:h-22 rounded-full overflow-hidden object-cover ring-4 ring-white dark:ring-stone-800 shadow-md mx-auto bg-stone-200 dark:bg-stone-700">
              <CoverImage
                thumbnailUrl={avatarUrl}
                title={displayTitle}
                category="account"
                url={displayUrl}
                id={item.id}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>

          <h3 className="font-sans text-ink font-bold text-xs sm:text-sm mt-2.5 truncate max-w-full px-1 leading-snug">
            {displayTitle}
          </h3>

          {handle && (
            <p className="text-[11px] font-mono text-ink-3 truncate max-w-full">
              {handle}
            </p>
          )}

          {/* 領域標籤 */}
          {domainTags.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5">
              {domainTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/5 dark:bg-white/10 text-ink-2 border border-black/5 dark:border-white/5"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 底部站內詳情提示 */}
        <div className="w-full pt-1.5 border-t border-black/5 dark:border-white/5 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] text-ink-3 font-mono group-hover:text-ink transition-colors">
            查看創作者筆記
          </span>
        </div>
      </div>
    );
  }

  // 純淨資訊卡：100% 純 <div>，點擊唯一打開站內詳情視窗
  const personalTags = (item.customTags || []).slice(0, 2);

  return (
    <div
      onClick={handleCardSelect}
      style={{
        animationDelay: `${Math.min(index ?? 0, 15) * 30}ms`,
      }}
      className={cn(
        'animate-memo-entrance relative overflow-hidden rounded-2xl group cursor-pointer shadow-xs hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-300 border border-black/10 select-none bg-stone-900 [content-visibility:auto] [contain-intrinsic-size:300px_500px]',
        aspectType === 'poster-27-40' && 'w-full aspect-[27/40] ring-1 ring-black/15',
        aspectType === 'square-1-1' && 'col-span-1 aspect-square w-full ring-1 ring-black/10',
        aspectType === 'vertical-9-16' && 'col-span-1 aspect-[9/16] w-full',
        isSelected && 'ring-2 ring-[#3F7D58] border-[#3F7D58]'
      )}
    >
      {/* 滿版靜態背景縮圖 */}
      <CoverImage
        thumbnailUrl={displayCover}
        title={displayTitle}
        category={item.category}
        url={displayUrl}
        id={item.id}
        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out pointer-events-none"
      />

      {/* 左上角：分類標籤 / 景點城市膠囊 / AI 配菜角色 (純靜態展示，不觸發跳頁) */}
      <div className="absolute top-2 left-2 z-20 flex flex-wrap items-center gap-1 pointer-events-none">
        {highlightRole && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-white shadow-xs">
            {highlightRole}
          </span>
        )}
        {isPlace && (item.placeInfo?.city || item.placeInfo?.locationName) ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/75 text-white border border-white/20 shadow-xs tracking-tight">
            <MapPin className="w-3 h-3 text-[#E07A5F]" />
            <span className="truncate max-w-[110px]">
              {item.placeInfo?.city || item.placeInfo?.locationName}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/70 text-white/90 border border-white/15 shadow-xs">
            <CatIcon className="w-2.5 h-2.5" />
            <span>{catMeta.label}</span>
          </span>
        )}
      </div>

      {/* 右上角：極簡最愛星號/愛心 ＋ 刪除按鈕 (皆加上 e.stopPropagation()) */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            toggleFavorite(item.id);
          }}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-xs cursor-pointer active:scale-90',
            item.isFavorite
              ? 'bg-rose-500 text-white scale-105 shadow-md border border-rose-400'
              : 'bg-black/75 text-white/85 hover:text-rose-400 hover:bg-black/90 border border-white/20'
          )}
          title={item.isFavorite ? '❤️ 取消最愛' : '🤍 設為最愛'}
          aria-label="最愛切換"
        >
          <Heart className={cn('w-3.5 h-3.5', item.isFavorite && 'fill-white')} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (sourceId && item.sources && item.sources.length > 1) {
              if (window.confirm(`確定要從電影中移除這支影片來源嗎？`)) {
                deleteSourcePost(item.id, sourceId);
              }
            } else {
              if (window.confirm(`確定要刪除「${item.title}」嗎？`)) {
                deleteItem(item.id);
              }
            }
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center bg-black/75 text-white/85 hover:text-rose-400 hover:bg-black/90 border border-white/20 transition-all shadow-xs cursor-pointer active:scale-90"
          title="刪除"
          aria-label="刪除此卡片"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 食譜與景點專屬：右下角「＋」今日開伙打勾框 / 順路行程按鈕 (加上 e.stopPropagation()) */}
      {(isRecipe || isPlace) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (isRecipe) {
              toggleCookingRecipe(item.id);
            }
            if (isPlace) {
              toggleSelectedPlace(item.id);
            }
          }}
          className={cn(
            'absolute bottom-2 right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all cursor-pointer active:scale-90',
            isSelected
              ? 'bg-[#3F7D58] text-white border border-emerald-300 ring-2 ring-emerald-500/30 animate-spring-bounce shadow-md'
              : 'bg-black/75 text-white hover:bg-black/90 border border-white/25 hover:scale-105'
          )}
          title={
            isSelected
              ? isRecipe
                ? '✓ 已在今日料理選單（點擊取消）'
                : '✓ 已加入今日行程規劃（點擊取消）'
              : isRecipe
              ? '＋ 加入今日料理選單'
              : '＋ 加入今日行程規劃'
          }
          aria-label={
            isSelected
              ? isRecipe
                ? '已在今日料理選單'
                : '已加入今日行程規劃'
              : isRecipe
              ? '加入今日料理選單'
              : '加入今日行程規劃'
          }
        >
          {isSelected ? (
            <Check className="w-4 h-4 stroke-[3]" />
          ) : (
            <Plus className="w-4 h-4 stroke-[2.5]" />
          )}
        </button>
      )}

      {/* 電影分類專屬：右下角精緻 IMDb 評分徽章 */}
      {item.category === 'media' && item.mediaInfo?.imdbRating && (
        <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-bold rounded-md bg-amber-400/95 text-black shadow-sm shrink-0 whitespace-nowrap">
            <span>★</span>
            <span>{item.mediaInfo.imdbRating}</span>
          </span>
        </div>
      )}

      {/* 底部黑夜漸層壓字標題、個人化標籤與食材數量 */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/65 to-transparent pt-12 pb-3 px-3 pointer-events-none space-y-1',
          (isRecipe || isPlace)
            ? 'pr-12'
            : (item.category === 'media' && item.mediaInfo?.imdbRating)
            ? 'pr-16'
            : 'pr-3'
        )}
      >
        <h3 className="font-sans text-white font-bold text-xs sm:text-[13px] md:text-sm leading-snug tracking-tight line-clamp-2 drop-shadow-sm">
          {displayTitle}
        </h3>

        {/* 電影分類專屬：顯示上映年份與前 2 個電影類型標籤 */}
        {item.category === 'media' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
            {item.mediaInfo?.releaseYear && (
              <span className="px-1.5 py-0.5 rounded-sm font-mono font-semibold bg-white/20 text-white backdrop-blur-md shrink-0 whitespace-nowrap">
                {item.mediaInfo.releaseYear}
              </span>
            )}
            {(() => {
              const genres =
                item.mediaInfo?.genres && item.mediaInfo.genres.length > 0
                  ? item.mediaInfo.genres.slice(0, 2)
                  : item.mediaInfo?.genre
                  ? item.mediaInfo.genre
                      .split(/[/,，、\s]+/)
                      .filter(Boolean)
                      .slice(0, 2)
                  : [];
              return genres.map((g, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded-sm font-medium bg-black/40 text-stone-200 border border-white/15 backdrop-blur-md shrink-0 whitespace-nowrap"
                >
                  {g}
                </span>
              ));
            })()}
          </div>
        )}

        {/* 智慧標籤 (Smart Tags) 與食材數量 */}
        {(isRecipe || autoSmartTags.length > 0 || personalTags.length > 0) && (
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            {personalTags.map((pt, idx) => (
              <span
                key={`pt-${idx}`}
                className="px-1.5 py-0.5 rounded-sm text-[10px] font-sans font-bold bg-amber-400/25 text-amber-200 backdrop-blur-md border border-amber-300/30 tracking-wide shrink-0 whitespace-nowrap"
              >
                {pt}
              </span>
            ))}
            {isRecipe ? (
              <>
                {smartTags?.cuisine && !personalTags.some((t) => t.includes(smartTags.cuisine!)) && (
                  <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-sans font-bold bg-white/20 text-white backdrop-blur-md border border-white/10 tracking-wide shrink-0 whitespace-nowrap">
                    {smartTags.cuisine}
                  </span>
                )}
                {smartTags?.ingredientsType && (
                  <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-sans font-bold bg-white/20 text-white backdrop-blur-md border border-white/10 tracking-wide shrink-0 whitespace-nowrap">
                    {smartTags.ingredientsType}
                  </span>
                )}
                {ingredientCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-black/50 text-emerald-300 border border-emerald-400/30 shrink-0 whitespace-nowrap">
                    <UtensilsCrossed className="w-2.5 h-2.5" />
                    <span>{ingredientCount}食材</span>
                  </span>
                )}
              </>
            ) : (
              autoSmartTags.slice(0, 2).map((st, idx) => (
                <span
                  key={`st-${idx}`}
                  className="px-1.5 py-0.5 rounded-sm text-[10px] font-sans font-bold bg-white/20 text-white backdrop-blur-md border border-white/10 tracking-wide shrink-0 whitespace-nowrap pointer-events-none select-none"
                >
                  {st}
                </span>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

