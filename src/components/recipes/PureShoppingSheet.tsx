'use client';

import React, { useState, useMemo } from 'react';
import { ParsedItem } from '@/types/item';
import {
  aggregateRecipeIngredients,
  generateFullCookingGuideText,
} from '@/lib/recipeUtils';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  Share2,
  Check,
  CheckSquare,
  Square,
  Users,
  UtensilsCrossed,
  Bookmark,
  Sparkles,
} from 'lucide-react';
import { useAppState } from '@/providers/AppStateProvider';

interface PureShoppingSheetProps {
  isOpen: boolean;
  onClose: () => void;
  targetServings: number;
  selectedRecipes: ParsedItem[];
}

const CATEGORY_GROUPS = [
  { key: '生鮮肉品', icon: '🥩', label: '生鮮肉品（含海鮮）' },
  { key: '蔬菜水果', icon: '🥬', label: '蔬菜水果' },
  { key: '蛋奶豆製品', icon: '🥚', label: '蛋奶豆製品' },
  { key: '調味料與乾貨', icon: '🧂', label: '調味料與乾貨' },
  { key: '其他', icon: '📦', label: '其他' },
];

export function PureShoppingSheet({
  isOpen,
  onClose,
  targetServings,
  selectedRecipes,
}: PureShoppingSheetProps) {
  const { spaceId, refreshAINotes, addToast } = useAppState();
  const [excludedNames, setExcludedNames] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  // 前端 0 延遲自動合併食材
  const aggregated = useMemo(() => {
    return aggregateRecipeIngredients(selectedRecipes, targetServings);
  }, [selectedRecipes, targetServings]);

  // 切換「家中已有 / 免買」狀態
  function handleToggleExclude(name: string) {
    setExcludedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  // 📲 存入 Apple 備忘錄（呼叫 Memo清單 捷徑，並同步寫入剪貼簿）
  async function handleNativeAppleShare() {
    const fullText = generateFullCookingGuideText({
      targetServings,
      selectedRecipes,
      items: aggregated,
      excludedNames,
    });

    if (!fullText.trim()) return;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(fullText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);

      if (typeof window !== 'undefined') {
        window.location.href = `shortcuts://run-shortcut?name=Memo%E6%B8%85%E5%96%AE&input=text&text=${encodeURIComponent(
          fullText
        )}`;
      }
    } catch {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: `Memo 今日私廚採買與料理指南（${targetServings}人份）`,
            text: fullText,
          });
        } catch {}
      }
    }
  }

  // 💾 存入 AI 記事本 (購物清單)
  async function handleSaveToAINotebook() {
    if (selectedRecipes.length === 0 || aggregated.length === 0) return;
    setIsSavingNote(true);
    try {
      const fullText = generateFullCookingGuideText({
        targetServings,
        selectedRecipes,
        items: aggregated,
        excludedNames,
      });

      const res = await fetch(`/memo/api/ai-tasks?space=${encodeURIComponent(spaceId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-space-id': spaceId,
        },
        body: JSON.stringify({
          type: 'shopping',
          status: 'ready',
          spaceId,
          title: `🛒 ${selectedRecipes.map((r) => r.title).join(' ✕ ') || '今日開伙'}・採買清單`,
          requestParams: { targetServings },
          resultData: {
            menuTitle: selectedRecipes.map((r) => r.title).join(' ✕ '),
            targetServings,
            recipeTitles: selectedRecipes.map((r) => r.title),
            shoppingItems: aggregated,
            excludedNames: Array.from(excludedNames),
          },
          markdownNote: fullText,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '存入 AI 記事本失敗');
      }

      await refreshAINotes();
      setSavedNote(true);
      addToast({
        type: 'success',
        message: '✓ 已成功存入 AI 記事本「購物清單」！',
      });
      setTimeout(() => setSavedNote(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '存入失敗';
      addToast({ type: 'error', message: msg });
    } finally {
      setIsSavingNote(false);
    }
  }

  const toBuyCount = aggregated.filter((it) => !excludedNames.has(it.name)).length;
  const inStockCount = excludedNames.size;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="🛒 今日純粹採買清單"
      description={`依 ${targetServings} 人份精準換算・已選 ${selectedRecipes.length} 道菜色`}
    >
      <div className="space-y-5 pb-8">
        {/* 今日開伙菜單預覽 */}
        <div className="p-4 rounded-card bg-surface-2 border border-line space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-accent" />
              今日開伙菜單（{selectedRecipes.length} 道）
            </span>
            <span className="font-mono text-ink-3 flex items-center gap-1 bg-surface px-2 py-0.5 rounded border border-line">
              <Users className="w-3 h-3 text-cat-recipe" />
              {targetServings} 人份
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedRecipes.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-control bg-surface border border-line text-ink font-medium"
              >
                • {r.title}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 text-[11px] text-ink-3">
            <span>
              共需採買 <strong className="text-accent">{toBuyCount}</strong> 項食材
              {inStockCount > 0 && `（已剔除 ${inStockCount} 項家中已有）`}
            </span>
            <span className="text-ink-4">點擊下方食材可標記「家中已有」</span>
          </div>
        </div>

        {/* 核心操作列：📲 系統原生分享備忘錄 + 💾 存入 AI 記事本 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleNativeAppleShare}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#3F7D58] hover:bg-[#346a4a] text-white font-bold text-xs sm:text-sm shadow-sm active:scale-[0.99] transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>已複製全文！可貼上備忘錄</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-white" />
                <span>📲 系統原生分享備忘錄</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSaveToAINotebook}
            disabled={isSavingNote}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs sm:text-sm shadow-sm active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
          >
            {savedNote ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>✓ 已存入 AI 記事本！</span>
              </>
            ) : isSavingNote ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                <span>正在存入記事本...</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4 text-amber-400" />
                <span>💾 存入 AI 記事本 (購物清單)</span>
              </>
            )}
          </button>
        </div>

        {/* 食材分組清單 */}
        <div className="space-y-5">
          {CATEGORY_GROUPS.map(({ key, icon, label }) => {
            const groupItems = aggregated.filter((it) => it.category === key);
            if (groupItems.length === 0) return null;

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-ink-2 pb-1 border-b border-line">
                  <span className="flex items-center gap-1.5">
                    <span>{icon}</span>
                    <span>{label}</span>
                  </span>
                  <span className="font-mono text-ink-4 text-[11px]">
                    {groupItems.length} 項
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {groupItems.map((item) => {
                    const isExcluded = excludedNames.has(item.name);

                    return (
                      <div
                        key={item.name}
                        onClick={() => handleToggleExclude(item.name)}
                        className={cn(
                          'flex flex-col justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none min-h-[76px] shadow-2xs',
                          isExcluded
                            ? 'bg-surface-2/60 border-line text-ink-4'
                            : 'bg-surface border-line hover:border-line-strong text-ink hover:shadow-xs'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            className="mt-0.5 shrink-0 text-ink-3 hover:text-accent cursor-pointer"
                          >
                            {isExcluded ? (
                              <CheckSquare className="w-4 h-4 text-success" />
                            ) : (
                              <Square className="w-4 h-4 text-line-2" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div
                              className={cn(
                                'font-medium text-xs sm:text-[13px] break-words leading-snug',
                                isExcluded && 'line-through text-ink-4'
                              )}
                            >
                              {item.name}
                            </div>
                            {isExcluded && (
                              <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded bg-surface border border-line text-ink-4 shrink-0 whitespace-nowrap">
                                家中已有
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 pt-1 border-t border-line/40 flex items-center justify-between text-right">
                          <span className="text-[10px] text-ink-3 truncate max-w-[80px]">
                            {item.sourceRecipes.join('、')}
                          </span>
                          <span
                            className={cn(
                              'font-mono text-xs sm:text-sm font-bold shrink-0 ml-1',
                              isExcluded ? 'line-through text-ink-4' : 'text-accent'
                            )}
                          >
                            {item.requiredAmountText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部重置免買狀態按鈕 */}
        {excludedNames.size > 0 && (
          <div className="pt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExcludedNames(new Set())}
            >
              重置「免買」標記 ({excludedNames.size})
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
