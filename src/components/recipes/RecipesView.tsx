'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppState } from '@/providers/AppStateProvider';
import { RecipeSuggestion, ParsedItem, SavedItem } from '@/types/item';
import {
  ensureLocalStorageSchemaVersion,
  normalizeRecipeSuggestion,
} from '@/lib/storage';
import { CommandBar } from '@/components/feed/CommandBar';
import { RecipeCard } from './RecipeCard';
import { PureShoppingSheet } from './PureShoppingSheet';
import { SelectedRecipesDrawer } from './SelectedRecipesDrawer';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import { CoverImage } from '@/components/feed/CoverImage';
import { SmartTagFilterBar } from '@/components/common/SmartTagFilterBar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { getRecipeSmartTags } from '@/lib/recipeUtils';
import {
  distributeToColumns,
} from '@/lib/dualColumnMasonry';
import {
  UtensilsCrossed,
  Users,
  Sparkles,
  Flame,
  ShoppingCart,
  Check,
  Minus,
  Plus,
  Clock,
  X,
  Heart,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const SERVING_PRESETS = [1, 2, 4, 6];

const STYLE_PRESETS = [
  '🌐 智慧搭配',
  '⭐ 常用菜譜',
  '🇯🇵 日式',
  '🍝 義式/西式',
  '🥢 台式家常',
  '🥗 清淡減脂',
];

export function RecipesView() {
  const {
    items,
    targetServings,
    setTargetServings,
    selectedCookingRecipeIds,
    toggleCookingRecipe,
    setSelectedCookingRecipeIds,
    globalCustomTags,
    openRandomDecision,
    addToast,
    openDetail,
    openAINotebook,
    aiNotes,
    refreshAINotes,
    thinkingTasksCount,
    spaceId,
  } = useAppState();

  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTag, setActiveFilterTag] = useState<string>('ALL');

  // AI 私廚推薦狀態
  const [selectedStyle, setSelectedStyle] = useState<string>(STYLE_PRESETS[0]);
  const [customPreference, setCustomPreference] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<RecipeSuggestion | null>(
    null
  );

  // 純粹採買清單 Drawer
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  // 已選項目抽屜 Drawer
  const [isSelectedDrawerOpen, setIsSelectedDrawerOpen] = useState(false);

  // 伺服器端與客戶端 Hydration 一致性保護 + 自動檢查清除舊版壞快取
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    ensureLocalStorageSchemaVersion();
    setMounted(true);
  }, []);

  // 食譜清單（嚴格依 createdAt 降序排列，最新優先）
  const allRecipes = useMemo(() => {
    const list = (items ?? []).filter((i) => i && i.category === 'recipe');
    return [...list].sort((a, b) => {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [items]);

  // 萃取所有食譜的多維智慧標籤（料理風格、主要肉品/食材、餐點類型）
  const recipeDimensions = useMemo(() => {
    const cuisines = new Map<string, number>();
    const ingredients = new Map<string, number>();
    const mealTypes = new Map<string, number>();

    allRecipes.forEach((r) => {
      const tags = getRecipeSmartTags(r);
      if (tags.cuisine) {
        cuisines.set(tags.cuisine, (cuisines.get(tags.cuisine) || 0) + 1);
      }
      if (tags.ingredientsType) {
        ingredients.set(
          tags.ingredientsType,
          (ingredients.get(tags.ingredientsType) || 0) + 1
        );
      }
      if (tags.mealType) {
        mealTypes.set(tags.mealType, (mealTypes.get(tags.mealType) || 0) + 1);
      }
    });

    return {
      cuisines: Array.from(cuisines.entries()).map(([name, count]) => ({ name, count })),
      ingredients: Array.from(ingredients.entries()).map(([name, count]) => ({ name, count })),
      mealTypes: Array.from(mealTypes.entries()).map(([name, count]) => ({ name, count })),
    };
  }, [allRecipes]);

  // 根據多維智慧標籤過濾與搜尋，維持最新在最前
  const displayRecipes = useMemo(() => {
    return allRecipes.filter((r) => {
      if (activeFilterTag === 'SELECTED') {
        if (!(selectedCookingRecipeIds ?? []).includes(r.id)) return false;
      } else if (activeFilterTag === 'FAVORITE') {
        if (!r.isFavorite) return false;
      } else if (activeFilterTag === 'COMPLETED') {
        if (!r.isCompleted) return false;
      } else if (activeFilterTag !== 'ALL') {
        const smartTags = getRecipeSmartTags(r);
        const matchesSmart =
          smartTags.cuisine === activeFilterTag ||
          smartTags.ingredientsType === activeFilterTag ||
          smartTags.mealType === activeFilterTag;
        const matchesCustom =
          (r.customTags ?? []).includes(activeFilterTag) ||
          (r.tags ?? []).some((t) => typeof t === 'string' && t.includes(activeFilterTag));
        if (!matchesSmart && !matchesCustom) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const inTitle = (r.title || '').toLowerCase().includes(q);
      const inSummary = r.summary?.toLowerCase().includes(q);
      const inTags = (r.tags ?? []).some((t) => typeof t === 'string' && t.toLowerCase().includes(q));
      const inCustom = (r.customTags ?? []).some((t) => typeof t === 'string' && t.toLowerCase().includes(q));
      const inIngs = (r.recipeInfo?.ingredients ?? []).some((ing) =>
        (ing?.name || '').toLowerCase().includes(q)
      );
      return inTitle || inSummary || inTags || inCustom || inIngs;
    });
  }, [allRecipes, activeFilterTag, searchQuery, selectedCookingRecipeIds]);

  // 真・瀑布流獨立直欄（手機 2 欄、平板 3 欄、電腦 4 欄，下方卡片 0 空隙往上貼齊）
  const recipeColsMobile = useMemo(
    () =>
      distributeToColumns(displayRecipes || [], 2, (recipe) => ({
        id: recipe.id,
        url: recipe.url,
        aspectRatio: recipe.aspectRatio,
      })),
    [displayRecipes]
  );

  const recipeColsTablet = useMemo(
    () =>
      distributeToColumns(displayRecipes || [], 3, (recipe) => ({
        id: recipe.id,
        url: recipe.url,
        aspectRatio: recipe.aspectRatio,
      })),
    [displayRecipes]
  );

  const recipeColsDesktop = useMemo(
    () =>
      distributeToColumns(displayRecipes || [], 4, (recipe) => ({
        id: recipe.id,
        url: recipe.url,
        aspectRatio: recipe.aspectRatio,
      })),
    [displayRecipes]
  );

  // 今日已勾選之食譜
  const selectedRecipes = useMemo(() => {
    return allRecipes.filter((r) => (selectedCookingRecipeIds ?? []).includes(r.id));
  }, [allRecipes, selectedCookingRecipeIds]);

  // 角色標註 Map (AI 推薦的主菜/配菜角色)
  const suggestionRoleMap = useMemo(() => {
    const map = new Map<string, string>();
    const pairings = aiSuggestion?.pairings ?? [];
    if (Array.isArray(pairings)) {
      pairings.forEach((p) => {
        if (p?.recipeId && p?.role) {
          map.set(p.recipeId, p.role);
        }
      });
    }
    return map;
  }, [aiSuggestion]);

  const favoriteCount = useMemo(() => {
    return allRecipes.filter((r) => Boolean(r.isFavorite)).length;
  }, [allRecipes]);

  const completedCount = useMemo(() => {
    return allRecipes.filter((r) => Boolean(r.isCompleted)).length;
  }, [allRecipes]);

  function renderRecipeCard(recipe: ParsedItem) {
    return (
      <RecipeCard
        key={recipe.id}
        item={recipe}
        highlightRole={suggestionRoleMap.get(recipe.id)}
        onSelect={(item) => setSelectedItem(item)}
      />
    );
  }

  async function handleAskChefSuggestion() {
    if (allRecipes.length === 0) {
      addToast({
        type: 'info',
        message: '請先在上方輸入框貼上食譜網址加入收藏！',
      });
      return;
    }

    setIsSuggesting(true);
    try {
      const pref = customPreference.trim() || '清冰箱共用食材、均衡好上手';
      const res = await fetch('/memo/api/ai-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-space-id': spaceId,
        },
        body: JSON.stringify({
          type: 'shopping',
          spaceId,
          title: '🛒 今日私廚推薦・採買清單',
          requestParams: {
            preference: pref,
            targetServings,
            recipes: allRecipes,
            styleFilter: selectedStyle === '🌐 智慧搭配' ? '' : selectedStyle,
            onlyFavorites: selectedStyle === '⭐ 常用菜譜',
          },
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '私廚推薦啟動失敗');
      }
      await refreshAINotes();
      addToast({
        type: 'success',
        message: '🧠 AI 已在背景開始思考菜單與採買清單！完成後會自動發送推播至您的 iPhone，您可以自由切換頁面。',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '推薦失敗';
      addToast({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsSuggesting(false);
    }
  }

  // 當背景思考完成時，自動同步最新菜單到畫面上（僅限具備有效 pairings 的 AI 配菜筆記）
  useEffect(() => {
    const latestMenuNote = (aiNotes ?? []).find(
      (n) =>
        (n?.type === 'shopping' || n?.type === 'menu') &&
        n?.status === 'ready' &&
        n?.resultData &&
        Array.isArray(n.resultData.pairings) &&
        n.resultData.pairings.length > 0
    );
    if (latestMenuNote?.resultData) {
      setAiSuggestion(normalizeRecipeSuggestion(latestMenuNote.resultData));
    }
  }, [aiNotes]);

  function handleApplySuggestedMenu() {
    const pairings = aiSuggestion?.pairings ?? [];
    if (pairings.length === 0) return;
    const ids = pairings.map((p) => p.recipeId).filter(Boolean);
    setSelectedCookingRecipeIds(ids);
    addToast({
      type: 'success',
      message: `🔥 已勾選 ${ids.length} 道今日菜單！`,
    });
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 space-y-4">
      {/* 頂部極簡標題 + 搜尋輸入列 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight text-ink">
            🍳 食譜私廚
          </h1>
          <span
            suppressHydrationWarning
            className="text-xs font-mono text-ink-3 px-2 py-0.5 rounded-full bg-surface border border-line"
          >
            {mounted ? allRecipes.length : 0} 道
          </span>
        </div>

        <div className="w-full md:w-96">
          <CommandBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </div>

      {/* 雙列結構控制框 */}
      <div className="p-3.5 rounded-card bg-surface border border-line space-y-2.5">
        {/* 第一列：左側 [👥 － 2人 ＋] 步進器，右側 [🛒 採買清單 (X)] 主按鈕 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 bg-surface-2 border border-line rounded-control px-2 py-1 shrink-0">
            <Users className="w-3.5 h-3.5 text-cat-recipe shrink-0" />
            <button
              type="button"
              onClick={() => setTargetServings(Math.max(1, targetServings - 1))}
              className="w-6 h-6 rounded flex items-center justify-center text-ink hover:bg-surface cursor-pointer shrink-0"
              aria-label="減少人數"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="min-w-10 text-center font-mono text-xs font-bold text-ink shrink-0 whitespace-nowrap">
              {targetServings}人
            </span>
            <button
              type="button"
              onClick={() => setTargetServings(Math.min(30, targetServings + 1))}
              className="w-6 h-6 rounded flex items-center justify-center text-ink hover:bg-surface cursor-pointer shrink-0"
              aria-label="增加人數"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {mounted && selectedRecipes.length > 0 && (
              <button
                type="button"
                onClick={() => setIsSelectedDrawerOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-bold bg-[#3F7D58]/15 text-[#3F7D58] hover:bg-[#3F7D58]/25 border border-[#3F7D58]/30 transition-all cursor-pointer"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span suppressHydrationWarning>已選 ({selectedRecipes.length})</span>
              </button>
            )}

            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={!mounted || selectedRecipes.length === 0}
              onClick={() => setIsSheetOpen(true)}
              leftIcon={<ShoppingCart className="w-3.5 h-3.5" />}
              className="font-bold shadow-xs cursor-pointer"
            >
              <span suppressHydrationWarning>🛒 採買清單 ({mounted ? selectedRecipes.length : 0})</span>
            </Button>

            {mounted && selectedRecipes.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCookingRecipeIds([])}
                className="p-1.5 text-ink-3 hover:text-ink cursor-pointer"
                title="清空已選菜色"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 手機版第 2 行：[🌐 智慧搭配 ⌄] ＋ 寬敞輸入框 (min-w-[160px]) */}
        <div className="flex md:hidden items-center gap-2 w-full">
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value)}
            className="px-2.5 py-2 text-xs font-medium bg-surface-2 border border-line rounded-control text-ink focus:outline-none shrink-0"
          >
            {STYLE_PRESETS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <input
            suppressHydrationWarning
            type="text"
            value={customPreference}
            onChange={(e) => setCustomPreference(e.target.value)}
            placeholder="輸入想吃的食材、風格或冰箱剩菜..."
            className="flex-1 min-w-[160px] px-3 py-2 text-xs text-ink bg-surface-2/60 border border-line rounded-control focus:outline-none focus:border-accent"
          />
        </div>

        {/* 手機版第 3 行：[✨ AI 配菜] ＋ [📓 記事本] 並排按鈕 */}
        <div className="grid md:hidden grid-cols-2 gap-2 w-full">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={isSuggesting}
            onClick={handleAskChefSuggestion}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-accent" />}
            className="w-full justify-center text-xs font-bold py-2"
          >
            ✨ AI 配菜
          </Button>

          <button
            type="button"
            onClick={openAINotebook}
            className="w-full py-2 px-2.5 rounded-control text-xs font-bold border border-line bg-surface hover:bg-surface-2 text-ink-2 hover:text-ink transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            title="開啟 AI 背景思考記事本"
          >
            <span>📓 記事本</span>
            {thinkingTasksCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>
        </div>

        {/* 電腦版寬敞排列 (md:flex) */}
        <div className="hidden md:flex items-center gap-2 w-full">
          <select
            value={selectedStyle}
            onChange={(e) => setSelectedStyle(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium bg-surface-2 border border-line rounded-control text-ink focus:outline-none shrink-0"
          >
            {STYLE_PRESETS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <input
            suppressHydrationWarning
            type="text"
            value={customPreference}
            onChange={(e) => setCustomPreference(e.target.value)}
            placeholder="輸入想吃的食材、風格或冰箱剩菜（如：清冰箱、快手菜、高蛋白質）"
            className="flex-1 min-w-0 px-3 py-1.5 text-xs text-ink bg-surface-2/60 border border-line rounded-control focus:outline-none focus:border-accent"
          />

          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={isSuggesting}
            onClick={handleAskChefSuggestion}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-accent" />}
            className="shrink-0"
          >
            ✨ AI 配菜
          </Button>

          <button
            type="button"
            onClick={openAINotebook}
            className="px-2.5 py-1.5 rounded-control text-xs font-bold border border-line bg-surface hover:bg-surface-2 text-ink-2 hover:text-ink transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs"
            title="開啟 AI 背景思考記事本"
          >
            <span>📓 記事本</span>
            {thinkingTasksCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* AI 私廚推薦結果精簡橫條 */}
      {aiSuggestion && (aiSuggestion.pairings ?? []).length > 0 && (
        <div className="p-3 rounded-card bg-accent/5 border border-accent/25 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-accent text-white">
                AI 菜單
              </span>
              <span className="font-display text-sm font-bold text-ink">
                {aiSuggestion.menuTitle}
              </span>
              <span className="text-xs font-mono text-ink-3 inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {aiSuggestion.estimatedPrepTime}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleApplySuggestedMenu}
                leftIcon={<Flame className="w-3.5 h-3.5 text-accent" />}
              >
                一鍵勾選
              </Button>
              <button
                type="button"
                onClick={() => setAiSuggestion(null)}
                className="p-1 text-ink-3 hover:text-ink cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(aiSuggestion.pairings ?? []).map((pair, idx) => {
              const matchedItem =
                allRecipes.find((r) => r.id === pair.recipeId) ||
                items.find((i) => i.id === pair.recipeId);
              const isSelected = (selectedCookingRecipeIds ?? []).includes(pair.recipeId);
              const thumb = matchedItem?.thumbnailUrl;
              const originalUrl = matchedItem?.url;

              return (
                <div
                  key={pair.recipeId || `pair_${idx}`}
                  onClick={() => {
                    toggleCookingRecipe(pair.recipeId);
                  }}
                  className={cn(
                    'group p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 bg-surface hover:bg-surface-2/40 hover:shadow-xs hover:border-black/20 select-none',
                    isSelected
                      ? 'border-[#3F7D58] ring-1 ring-[#3F7D58]/40 bg-[#3F7D58]/5'
                      : 'border-line'
                  )}
                  title="點擊切換是否加入菜單，點擊縮圖開啟食譜詳情"
                >
                  {/* 左側：縮圖（點擊縮圖開啟詳細資訊卡） */}
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (matchedItem) {
                        setSelectedItem(matchedItem);
                        openDetail(matchedItem);
                      }
                    }}
                    className="relative w-12 h-14 rounded-lg overflow-hidden shrink-0 bg-stone-900 border border-black/10 cursor-pointer group/thumb hover:ring-2 hover:ring-cat-recipe/50 transition-all active:scale-95"
                    title="點擊縮圖開啟食譜詳細資訊卡"
                  >
                    <CoverImage
                      thumbnailUrl={thumb}
                      title={pair.recipeTitle}
                      category="recipe"
                      url={matchedItem?.url || ''}
                      id={matchedItem?.id}
                      className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                    />
                  </div>

                  {/* 中間：角色、菜名 */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded font-mono">
                        {pair.role}
                      </span>
                    </div>
                    <h5 className="font-display text-xs font-bold text-ink truncate group-hover:text-accent transition-colors">
                      {pair.recipeTitle}
                    </h5>
                    {pair.reason && (
                      <p className="text-[10px] text-ink-3 truncate">
                        {pair.reason}
                      </p>
                    )}
                  </div>

                  {/* 右側：獨立圓形勾選鈕 */}
                  <button
                    type="button"
                    aria-label={isSelected ? '已加入菜單，點擊取消' : '加入今日菜單'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCookingRecipe(pair.recipeId);
                    }}
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 border shadow-2xs',
                      isSelected
                        ? 'bg-[#3F7D58] text-white border-[#3F7D58] shadow-xs scale-105'
                        : 'bg-surface-2 text-ink-3 hover:text-[#3F7D58] border-line hover:border-[#3F7D58]/50'
                    )}
                    title={isSelected ? '已加入今日菜單，點擊取消' : '點擊加入今日菜單'}
                  >
                    <Check className={cn('w-4 h-4', isSelected ? 'stroke-[3]' : 'opacity-30 stroke-[2]')} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 多維智慧標籤過濾列 */}
      <div className="w-full max-w-full overflow-hidden space-y-2 pb-1 border-b border-line box-border">
        {/* 第一排：最左邊固定 [❤️ 最愛] + [✅ 已選擇] + [全部] + 自訂標籤，右側 [🎲 幫我決定] */}
        <div className="flex items-center justify-between gap-2 w-full max-w-full">
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-2 items-center py-1 w-full max-w-full text-xs min-w-0 flex-1">
            {/* 1. 最前方固定：[❤️ 最愛] */}
            <button
              type="button"
              onClick={() =>
                setActiveFilterTag(activeFilterTag === 'FAVORITE' ? 'ALL' : 'FAVORITE')
              }
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border',
                activeFilterTag === 'FAVORITE'
                  ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                  : 'bg-surface text-ink-2 border-black/10 hover:border-rose-300'
              )}
            >
              <Heart
                className={cn(
                  'w-3.5 h-3.5',
                  activeFilterTag === 'FAVORITE' ? 'fill-current' : 'text-rose-500'
                )}
              />
              <span suppressHydrationWarning>最愛 ({mounted ? favoriteCount : 0})</span>
            </button>

            {/* 2. 緊接在最愛旁：[✅ 已選擇] */}
            <div className="inline-flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setActiveFilterTag(
                    activeFilterTag === 'SELECTED' ? 'ALL' : 'SELECTED'
                  )
                }
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border',
                  activeFilterTag === 'SELECTED'
                    ? 'bg-[#3F7D58] text-white border-[#3F7D58] shadow-xs'
                    : 'bg-surface text-[#3F7D58] border-[#3F7D58]/40 hover:bg-[#3F7D58]/10'
                )}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span suppressHydrationWarning>已選擇 ({mounted ? selectedRecipes.length : 0})</span>
              </button>

              {mounted && selectedRecipes.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCookingRecipeIds([]);
                    if (activeFilterTag === 'SELECTED') setActiveFilterTag('ALL');
                  }}
                  className="px-2 py-1 rounded-full text-xs font-semibold text-ink-3 hover:text-rose-600 border border-black/15 hover:border-rose-400 bg-surface transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  title="一鍵清空已選菜單"
                >
                  清空
                </button>
              )}
            </div>

            {/* 3. 全部 */}
            <button
              type="button"
              onClick={() => setActiveFilterTag('ALL')}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border',
                activeFilterTag === 'ALL'
                  ? 'bg-ink text-surface border-ink shadow-2xs'
                  : 'bg-surface text-ink-2 border-black/10 hover:border-black/30'
              )}
            >
              <span suppressHydrationWarning>全部 ({mounted ? allRecipes.length : 0})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeFilterTag !== 'ALL' && (
              <button
                type="button"
                onClick={() => setActiveFilterTag('ALL')}
                className="text-xs text-ink-3 hover:text-ink shrink-0 whitespace-nowrap underline cursor-pointer"
              >
                清除篩選
              </button>
            )}

            {/* 🎲 幫我決定 (Decide for Me) */}
            <button
              type="button"
              onClick={() => openRandomDecision(displayRecipes)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent/15 text-accent hover:bg-accent hover:text-white border border-accent/30 transition-all cursor-pointer shadow-2xs shrink-0 whitespace-nowrap"
              title="從目前篩選的食譜中隨機抽選一道料理！"
            >
              <span>🎲 幫我決定</span>
            </button>
          </div>
        </div>

        {/* 第二排：食材智慧標籤（支援橫向捲動、‹ › 箭頭、滑鼠滾輪橫向滑動與 🏷️ 全部標籤總覽） */}
        {(recipeDimensions.ingredients ?? []).length > 0 && (
          <div className="w-full pt-1">
            <SmartTagFilterBar
              tags={(recipeDimensions.ingredients ?? []).map((i) => ({
                tag: i.name,
                count: i.count,
              }))}
              selectedTag={activeFilterTag === 'ALL' ? undefined : activeFilterTag}
              onSelectTag={(tag) => setActiveFilterTag(tag || 'ALL')}
              totalCount={allRecipes.length}
              title="食材智慧標籤"
              themeColor="recipe"
              allLabel="全部食材"
            />
          </div>
        )}
      </div>

      {/* 真・瀑布流獨立直欄：手機版 2 欄、平板 3 欄、電腦版 4 欄，下方卡片 0 空隙往上貼齊 */}
      {mounted && displayRecipes.length > 0 ? (
        <>
          {/* 📱 手機版 (< md)：2 欄獨立垂直 Flex 瀑布流 */}
          <div className="flex md:hidden flex-row gap-2.5 sm:gap-3 items-start w-full">
            {recipeColsMobile.map((col, colIdx) => (
              <div key={colIdx} className="flex-1 flex flex-col gap-2.5 sm:gap-3 min-w-0">
                {col.map((recipe) => renderRecipeCard(recipe))}
              </div>
            ))}
          </div>

          {/* 💻 平板 (md: 至 lg:)：3 欄獨立垂直 Flex 瀑布流 */}
          <div className="hidden md:flex lg:hidden flex-row gap-3.5 items-start w-full">
            {recipeColsTablet.map((col, colIdx) => (
              <div key={colIdx} className="flex-1 flex flex-col gap-3.5 min-w-0">
                {col.map((recipe) => renderRecipeCard(recipe))}
              </div>
            ))}
          </div>

          {/* 🖥️ 電腦大螢幕 (lg:)：4 欄獨立垂直 Flex 瀑布流 */}
          <div className="hidden lg:flex flex-row gap-3.5 md:gap-4 items-start w-full">
            {recipeColsDesktop.map((col, colIdx) => (
              <div key={colIdx} className="flex-1 flex flex-col gap-3.5 md:gap-4 min-w-0">
                {col.map((recipe) => renderRecipeCard(recipe))}
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={<UtensilsCrossed className="w-6 h-6 text-cat-recipe" />}
          title={
            activeFilterTag === 'SELECTED'
              ? '尚未選擇任何食譜'
              : activeFilterTag === 'FAVORITE'
              ? '尚無最愛食譜收藏'
              : '尚無相符的食譜收藏'
          }
          description={
            activeFilterTag === 'SELECTED'
              ? '點擊任何食譜卡片右下角的「＋」按鈕，即可將想煮的菜色加入今日開伙與採買清單！'
              : activeFilterTag === 'FAVORITE'
              ? '點擊食譜卡片右上角的愛心圖示，即可將常煮的料理加入最愛收藏！'
              : '在上方輸入框貼上 YouTube、IG 或食譜網站連結，AI 即刻深度拆解食材與步驟。'
          }
        />
      )}

      {/* 浮動「📋 已選清單 (X)」按鈕 (Selected Recipes Floating Pill) */}
      {mounted && selectedRecipes.length > 0 && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-8 z-40">
          <button
            type="button"
            onClick={() => setIsSelectedDrawerOpen(true)}
            className="group relative inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-stone-900 text-stone-100 dark:bg-stone-100 dark:text-stone-900 text-sm font-bold shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-black/20"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-cat-recipe animate-pulse" />
            <span suppressHydrationWarning>📋 已選清單 ({selectedRecipes.length})</span>
          </button>
        </div>
      )}

      {/* 已選菜單抽屜 (Selected Recipes Drawer) */}
      <SelectedRecipesDrawer
        isOpen={isSelectedDrawerOpen}
        onClose={() => setIsSelectedDrawerOpen(false)}
        selectedRecipes={selectedRecipes}
        onRemoveRecipe={(id) => toggleCookingRecipe(id)}
        onClearAll={() => setSelectedCookingRecipeIds([])}
        onOpenShopping={() => setIsSheetOpen(true)}
        targetServings={targetServings}
        setTargetServings={setTargetServings}
      />

      {/* 0 延遲純粹採買清單 Drawer */}
      <PureShoppingSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        targetServings={targetServings}
        selectedRecipes={selectedRecipes}
      />

      <DetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
    </div>
  );
}
