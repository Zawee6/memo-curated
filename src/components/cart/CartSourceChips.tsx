'use client';

import React from 'react';
import { ParsedItem } from '@/types/item';
import { Chip } from '@/components/ui/Chip';
import { getCategoryMeta } from '@/lib/categories';

export function CartSourceChips({
  availableCards,
  selectedCardIds,
  onToggleCardId,
  onSelectAll,
  onClearAll,
}: {
  availableCards: ParsedItem[];
  selectedCardIds: string[];
  onToggleCardId: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  if (availableCards.length <= 1) return null;

  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between text-xs text-ink-3">
        <span className="font-medium">採買來源靈感項目：</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-accent hover:underline cursor-pointer"
          >
            全選
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={onClearAll}
            className="hover:text-ink cursor-pointer"
          >
            清空選擇
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {availableCards.map((card) => {
          const isSelected =
            selectedCardIds.length === 0 || selectedCardIds.includes(card.id);
          const meta = getCategoryMeta(card.category);
          const Icon = meta.icon;

          return (
            <Chip
              key={card.id}
              size="sm"
              active={isSelected}
              icon={<Icon className="w-3 h-3" />}
              onClick={() => onToggleCardId(card.id)}
            >
              {card.title}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
