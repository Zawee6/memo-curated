'use client';

import React from 'react';
import { ParsedItem } from '@/types/item';
import { Sheet } from '@/components/ui/Sheet';
import { CoverImage } from '@/components/feed/CoverImage';
import { Button } from '@/components/ui/Button';
import { getRecipeSmartTags } from '@/lib/recipeUtils';
import { useAppState } from '@/providers/AppStateProvider';
import {
  UtensilsCrossed,
  Trash2,
  X,
  ShoppingCart,
  Clock,
  Sparkles,
  Users,
  Minus,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectedRecipesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecipes: ParsedItem[];
  onRemoveRecipe: (id: string) => void;
  onClearAll: () => void;
  onOpenShopping: () => void;
  targetServings: number;
  setTargetServings: (servings: number) => void;
}

export function SelectedRecipesDrawer({
  isOpen,
  onClose,
  selectedRecipes,
  onRemoveRecipe,
  onClearAll,
  onOpenShopping,
  targetServings,
  setTargetServings,
}: SelectedRecipesDrawerProps) {
  const { openDetail } = useAppState();
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`📋 已選清單（共 ${selectedRecipes.length} 道食譜）`}
      description="已勾選之開伙菜色明細，可隨時移除單項、清空全部，或一鍵產生採買與料理清單。"
      className="md:w-[580px] md:max-w-xl"
      headerActions={
        selectedRecipes.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-300 transition-colors cursor-pointer"
            title="清空今日已選菜單"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空全部</span>
          </button>
        )
      }
      footer={
        <div className="w-full flex flex-col gap-2.5">
          <Button
            type="button"
            variant="accent"
            size="lg"
            disabled={selectedRecipes.length === 0}
            onClick={() => {
              onClose();
              onOpenShopping();
            }}
            leftIcon={<ShoppingCart className="w-4 h-4" />}
            className="w-full py-3 text-sm font-bold shadow-md cursor-pointer"
          >
            🛒 產生採買與料理清單（{selectedRecipes.length} 道菜 · {targetServings} 人份）
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 用餐人數調整快捷條 */}
        <div className="p-3 rounded-xl bg-surface-2/60 border border-line flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-sans font-bold text-ink">
            <Users className="w-4 h-4 text-cat-recipe" />
            <span>今日預計用餐人數：</span>
          </div>

          <div className="inline-flex items-center gap-1 bg-surface border border-line rounded-control px-1 py-0.5">
            <button
              type="button"
              onClick={() => setTargetServings(Math.max(1, targetServings - 1))}
              className="w-6 h-6 rounded flex items-center justify-center text-ink hover:bg-surface-2 cursor-pointer"
              aria-label="減少人數"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-8 text-center font-mono text-xs font-bold text-ink">
              {targetServings} 人
            </span>
            <button
              type="button"
              onClick={() => setTargetServings(Math.min(30, targetServings + 1))}
              className="w-6 h-6 rounded flex items-center justify-center text-ink hover:bg-surface-2 cursor-pointer"
              aria-label="增加人數"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 食譜清單 */}
        {selectedRecipes.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <UtensilsCrossed className="w-8 h-8 text-ink-3 mx-auto opacity-50" />
            <p className="font-sans text-sm text-ink-3">
              尚未選擇任何菜色，請在食譜卡片上點擊「＋」號加入！
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedRecipes.map((recipe, index) => {
              const smartTags = getRecipeSmartTags(recipe);
              const prepTime = recipe.recipeInfo?.prepTime;
              const ingredientsCount = recipe.recipeInfo?.ingredients?.length || 0;

              return (
                <div
                  key={recipe.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openDetail(recipe);
                  }}
                  className="p-3 rounded-xl border border-black/10 bg-surface hover:bg-surface-2/40 transition-all shadow-2xs flex items-center gap-3 group relative select-none cursor-pointer"
                >
                  {/* 縮圖（點擊縮圖開啟詳細資訊卡） */}
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openDetail(recipe);
                    }}
                    className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-black/10 bg-stone-900 relative cursor-pointer group/thumb hover:ring-2 hover:ring-accent/50 transition-all active:scale-95"
                    title="點擊縮圖查看食譜詳細資訊卡"
                  >
                    <CoverImage
                      thumbnailUrl={recipe.thumbnailUrl}
                      title={recipe.title}
                      category="recipe"
                      url={recipe.url}
                      id={recipe.id}
                      className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute top-1 left-1">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-black/60 text-white backdrop-blur-xs">
                        #{index + 1}
                      </span>
                    </div>
                  </div>

                  {/* 資訊 */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="font-display text-xs sm:text-sm font-bold text-ink truncate leading-tight group-hover:text-accent transition-colors">
                      {recipe.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
                      {smartTags.cuisine && (
                        <span className="px-1.5 py-0.2 rounded-xs bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold font-sans">
                          {smartTags.cuisine}
                        </span>
                      )}
                      {smartTags.ingredientsType && (
                        <span className="px-1.5 py-0.2 rounded-xs bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold font-sans">
                          {smartTags.ingredientsType}
                        </span>
                      )}
                      {prepTime ? (
                        <span className="inline-flex items-center gap-0.5 font-mono text-[10px]">
                          <Clock className="w-2.5 h-2.5" />
                          {prepTime}
                        </span>
                      ) : null}
                      {ingredientsCount > 0 && (
                        <span className="font-mono text-[10px]">
                          • {ingredientsCount}項食材
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 移除按鈕 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRecipe(recipe.id);
                    }}
                    className="p-2 rounded-lg text-ink-3 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 z-10"
                    title="從今日菜單移除"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
