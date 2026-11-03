'use client';

import React, { useState } from 'react';
import { RecipeInfo, RecipeNutrition } from '@/types/item';
import { useAppState } from '@/providers/AppStateProvider';
import {
  getBaseServings,
  formatScaledIngredient,
  inferIngredientCategory,
} from '@/lib/recipeUtils';
import { UtensilsCrossed, Clock, Users, Flame, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const SERVING_PRESETS = [1, 2, 4, 6];

const INGREDIENT_CATEGORY_GROUPS = [
  { key: '生鮮肉品', icon: '🥩', label: '生鮮肉品' },
  { key: '蔬菜水果', icon: '🥬', label: '蔬菜水果' },
  { key: '蛋奶豆製品', icon: '🥚', label: '蛋奶豆製品' },
  { key: '調味料與乾貨', icon: '🧂', label: '調味料與乾貨' },
  { key: '其他', icon: '📦', label: '其他' },
];

function getEffectiveNutrition(recipeInfo: RecipeInfo): RecipeNutrition {
  if (
    recipeInfo.nutrition &&
    (recipeInfo.nutrition.calories ||
      recipeInfo.nutrition.protein ||
      recipeInfo.nutrition.carbs ||
      recipeInfo.nutrition.fat)
  ) {
    return {
      calories: recipeInfo.nutrition.calories || '約 420 kcal',
      protein: recipeInfo.nutrition.protein || '24g',
      carbs: recipeInfo.nutrition.carbs || '38g',
      fat: recipeInfo.nutrition.fat || '16g',
    };
  }

  // 為既有已建檔食譜根據食材自動估算合理的單人份營養素
  const ingText = (recipeInfo.ingredients || [])
    .map((i) => `${i.name} ${i.category || ''}`)
    .join(' ');
  const hasBeefOrPork = /牛|豬|五花|培根|香腸/.test(ingText);
  const hasChickenOrSeafood = /雞|魚|蝦|蛤|海鮮|豆腐|蛋/.test(ingText);
  const hasNoodleOrRice = /麵|飯|米|馬鈴薯|地瓜|吐司|麵包|年糕|粉/.test(ingText);

  const kcal = hasBeefOrPork ? 520 : hasChickenOrSeafood ? 410 : 350;
  const protein = hasBeefOrPork || hasChickenOrSeafood ? 28 : 16;
  const carbs = hasNoodleOrRice ? 46 : 24;
  const fat = hasBeefOrPork ? 22 : 14;

  return {
    calories: `約 ${kcal} kcal`,
    protein: `${protein}g`,
    carbs: `${carbs}g`,
    fat: `${fat}g`,
  };
}

export function RecipeSection({
  recipeInfo,
  itemId,
}: {
  recipeInfo: RecipeInfo;
  itemId?: string;
}) {
  const {
    targetServings,
    setTargetServings,
    selectedCookingRecipeIds,
    toggleCookingRecipe,
  } = useAppState();

  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});

  const toggleIngredientCheck = (key: string) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const baseServings = getBaseServings(recipeInfo);
  const hasIngredients =
    recipeInfo.ingredients && recipeInfo.ingredients.length > 0;
  const hasSteps = recipeInfo.steps && recipeInfo.steps.length > 0;
  const isSelectedForCooking = itemId
    ? selectedCookingRecipeIds.includes(itemId)
    : false;
  const nutrition = getEffectiveNutrition(recipeInfo);

  return (
    <div className="rounded-xl border border-black/10 bg-surface-2/40 p-4 sm:p-5 space-y-4 relative overflow-hidden">
      {/* 頂部手帳小標記 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2.5">
        <div className="flex items-center gap-2 text-cat-recipe font-sans text-base font-bold tracking-wide">
          <UtensilsCrossed className="w-4 h-4 text-cat-recipe" />
          <span>私廚手帳配方 · 動態換算</span>
        </div>

        {itemId && (
          <button
            type="button"
            onClick={() => toggleCookingRecipe(itemId)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-bold transition-all cursor-pointer font-sans tracking-wide border shrink-0 whitespace-nowrap',
              isSelectedForCooking
                ? 'bg-accent text-white border-dashed border-accent-soft stamp-pop shadow-xs'
                : 'bg-surface text-ink-2 border-dashed border-black/15 hover:border-accent hover:text-accent'
            )}
          >
            {isSelectedForCooking ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>✓ 已加入今日菜單</span>
              </>
            ) : (
              <>
                <Flame className="w-3.5 h-3.5 text-accent" />
                <span>🔥 加入今日菜單</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Servings Switcher & PrepTime Meta (緊湊 4 列分段控制器，防擠壓防溢位) */}
      <div className="space-y-2 p-3 rounded-xl bg-surface border border-line text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-ink-2 font-sans text-xs font-semibold whitespace-nowrap">
            <Users className="w-3.5 h-3.5 text-cat-recipe shrink-0" />
            <span>動態換算用餐人數：</span>
          </div>
          {recipeInfo.prepTime && (
            <div className="flex items-center gap-1 text-ink-3 font-sans text-xs shrink-0 whitespace-nowrap">
              <Clock className="w-3 h-3 shrink-0" />
              <span>備料烹調：{recipeInfo.prepTime}</span>
            </div>
          )}
        </div>

        {/* 緊湊 4 列分段控制器樣式 (Segment Controller) */}
        <div className="grid grid-cols-4 gap-1 w-full bg-surface-2 p-1 rounded-xl">
          {SERVING_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTargetServings(s)}
              className={cn(
                'text-xs py-1.5 font-medium rounded-lg transition-all cursor-pointer text-center whitespace-nowrap shrink-0',
                targetServings === s
                  ? 'bg-ink text-surface font-bold shadow-2xs'
                  : 'text-ink-2 hover:text-ink hover:bg-surface/60'
              )}
            >
              {s} 人份
            </button>
          ))}
        </div>
      </div>

      {/* 單人份營養素估算 (4 個垂直置中卡片，數字與單位永不換行) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="flex flex-col items-center justify-center p-3 text-center rounded-xl bg-surface border border-line shadow-2xs">
          <span className="text-xs font-medium text-ink-3 whitespace-nowrap">
            🔥 單人熱量
          </span>
          <span className="text-sm sm:text-base font-bold text-cat-recipe whitespace-nowrap mt-1 font-mono">
            {nutrition.calories}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 text-center rounded-xl bg-surface border border-line shadow-2xs">
          <span className="text-xs font-medium text-ink-3 whitespace-nowrap">
            🥩 蛋白質
          </span>
          <span className="text-sm sm:text-base font-bold text-ink whitespace-nowrap mt-1 font-mono">
            {nutrition.protein}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 text-center rounded-xl bg-surface border border-line shadow-2xs">
          <span className="text-xs font-medium text-ink-3 whitespace-nowrap">
            🍚 碳水化合物
          </span>
          <span className="text-sm sm:text-base font-bold text-ink whitespace-nowrap mt-1 font-mono">
            {nutrition.carbs}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 text-center rounded-xl bg-surface border border-line shadow-2xs">
          <span className="text-xs font-medium text-ink-3 whitespace-nowrap">
            🥑 脂肪
          </span>
          <span className="text-sm sm:text-base font-bold text-ink whitespace-nowrap mt-1 font-mono">
            {nutrition.fat}
          </span>
        </div>
      </div>

      {/* Ingredients List (依食材五大類別分組 ＋ 可打勾確認備料) */}
      {hasIngredients && (
        <div className="space-y-4 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
            <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
              <span>🛒</span>
              <span>食材清單（依 {targetServings} 人份換算 · 點擊可打勾）</span>
            </h4>
            {targetServings !== baseServings && (
              <span className="text-xs text-cat-recipe bg-cat-recipe/10 px-2 py-0.5 rounded-sm border border-dashed border-cat-recipe/30 font-bold shrink-0 whitespace-nowrap">
                基準 {baseServings} 人份 ×{' '}
                {Math.round((targetServings / baseServings) * 10) / 10} 倍
              </span>
            )}
          </div>

          <div className="space-y-4">
            {INGREDIENT_CATEGORY_GROUPS.map(({ key, icon, label }) => {
              const groupIngs = recipeInfo.ingredients!.filter(
                (i) => inferIngredientCategory(i.name, i.category) === key
              );
              if (groupIngs.length === 0) return null;

              return (
                <div key={key} className="space-y-2">
                  {/* 分類標題獨立一行 */}
                  <div className="flex items-center justify-between text-xs font-bold text-ink-2 pb-1 border-b border-line">
                    <span className="flex items-center gap-1.5">
                      <span>{icon}</span>
                      <span>{label}</span>
                    </span>
                    <span className="text-[11px] font-mono text-ink-3 shrink-0 whitespace-nowrap">
                      {groupIngs.length} 項
                    </span>
                  </div>

                  {/* 底下項目維持兩列 (grid grid-cols-2 gap-2.5)，點擊可打勾 */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {groupIngs.map((ing, idx) => {
                      const scaled = formatScaledIngredient(
                        ing,
                        baseServings,
                        targetServings
                      );
                      const checkKey = `${key}-${ing.name}-${idx}`;
                      const isChecked = Boolean(checkedIngredients[checkKey]);

                      return (
                        <button
                          key={checkKey}
                          type="button"
                          onClick={() => toggleIngredientCheck(checkKey)}
                          className={cn(
                            'flex flex-col justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer shadow-2xs min-h-[58px] select-none',
                            isChecked
                              ? 'bg-[#3F7D58]/10 border-[#3F7D58]/40 text-ink-3'
                              : 'bg-surface border-line hover:border-line-strong text-ink'
                          )}
                        >
                          <div className="flex items-start gap-2 w-full">
                            <span
                              className={cn(
                                'w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 border transition-colors',
                                isChecked
                                  ? 'bg-[#3F7D58] border-[#3F7D58] text-white'
                                  : 'border-black/25 bg-surface-2'
                              )}
                            >
                              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <span
                              className={cn(
                                'font-medium text-xs sm:text-[13px] break-words leading-snug flex-1',
                                isChecked && 'line-through opacity-65'
                              )}
                            >
                              {scaled.name}
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-1 text-right w-full pl-6">
                            <span className="text-[10px] text-ink-4 shrink-0 whitespace-nowrap">
                              份量
                            </span>
                            <span
                              className={cn(
                                'font-mono text-xs sm:text-sm font-bold shrink-0 whitespace-nowrap',
                                isChecked
                                  ? 'line-through opacity-60 text-ink-3'
                                  : scaled.isScaled
                                  ? 'text-cat-recipe'
                                  : 'text-ink-2'
                              )}
                            >
                              {scaled.displayAmount}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cooking Steps */}
      {hasSteps && (
        <div className="space-y-2.5 pt-3 border-t border-black/10">
          <h4 className="text-xs font-bold text-ink-2 font-sans text-sm tracking-wide flex items-center gap-1.5">
            <span>🍳</span>
            <span>手作料理步驟</span>
          </h4>
          <ol className="space-y-2.5">
            {recipeInfo.steps!.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs md:text-sm text-ink-2 leading-relaxed bg-surface/70 p-2.5 rounded-lg border border-black/5"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-cat-recipe bg-cat-recipe/10 text-cat-recipe font-sans font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                  {idx + 1}
                </span>
                <span className="flex-1 font-sans break-words leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

