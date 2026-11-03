'use client';

import React, { useState } from 'react';
import { ParsedItem } from '@/types/item';
import { useAppState } from '@/providers/AppStateProvider';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Tag, Plus, X, Sparkles, Check } from 'lucide-react';

interface TagEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ParsedItem;
}

export function TagEditorModal({
  isOpen,
  onClose,
  item,
}: TagEditorModalProps) {
  const { updateItemTags, globalCustomTags, addGlobalCustomTag } = useAppState();
  const [newTagInput, setNewTagInput] = useState('');

  const currentTags = item.customTags || [];

  async function handleToggleTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;

    let nextTags: string[];
    if (currentTags.includes(trimmed)) {
      nextTags = currentTags.filter((t) => t !== trimmed);
    } else {
      nextTags = [...currentTags, trimmed];
      await addGlobalCustomTag(trimmed);
    }
    await updateItemTags(item.id, nextTags);
  }

  async function handleAddNewTag() {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;

    if (!currentTags.includes(trimmed)) {
      const nextTags = [...currentTags, trimmed];
      await addGlobalCustomTag(trimmed);
      await updateItemTags(item.id, nextTags);
    }
    setNewTagInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewTag();
    }
  }

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      zIndex="z-[120]"
      title="🏷️ 編輯風格標籤"
      description={`為「${item.title}」貼上專屬風格標籤，方便日後秒速過濾與 AI 配菜。`}
    >
      <div className="space-y-5 pb-6">
        {/* 目前已貼上的標籤 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide block">
            目前標籤（點擊 × 可移除）
          </label>
          {currentTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {currentTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-control bg-accent/10 text-accent font-medium text-xs border border-accent/20 group"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleTag(tag)}
                    className="hover:text-ink hover:bg-accent/20 rounded p-0.5 transition-colors cursor-pointer"
                    aria-label={`移除 ${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-4 italic">
              尚未加上任何個人標籤，可直接從下方預設風格快速點選！
            </p>
          )}
        </div>

        {/* 快速點選預設風格 */}
        <div className="space-y-2 pt-2 border-t border-line">
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>常用與熱門風格（點一下即貼標）</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {globalCustomTags.map((preset) => {
              const isSelected = currentTags.includes(preset);
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleToggleTag(preset)}
                  className={cn(
                    'px-2.5 py-1 rounded-control text-xs font-medium border transition-all cursor-pointer flex items-center gap-1',
                    isSelected
                      ? 'bg-accent text-white border-accent shadow-xs'
                      : 'bg-surface text-ink-2 border-line hover:border-line-2 hover:bg-surface-2'
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 shrink-0" />}
                  <span>{preset}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 自訂輸入新標籤 */}
        <div className="space-y-2 pt-2 border-t border-line">
          <label className="text-xs font-semibold text-ink-2 uppercase tracking-wide block">
            新增自訂標籤
          </label>
          <div className="flex gap-2">
            <input
              suppressHydrationWarning
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="輸入自訂標籤 (如：便當菜、宵夜、15分鐘快手)..."
              className="flex-1 h-9 px-3 rounded-control border border-line bg-surface text-base md:text-xs text-ink placeholder:text-ink-4 focus:outline-none focus:border-accent"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddNewTag}
              disabled={!newTagInput.trim()}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              新增
            </Button>
          </div>
        </div>

        {/* 完成按鈕 */}
        <div className="pt-4 border-t border-line flex justify-end">
          <Button size="md" variant="primary" onClick={onClose}>
            完成
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
