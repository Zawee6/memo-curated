'use client';

import React from 'react';
import { ShoppingItem } from '@/types/item';
import { formatCurrency } from '@/lib/format';
import { Check } from 'lucide-react';

export function CartItemRow({
  item,
  isChecked,
  onToggleCheck,
}: {
  item: ShoppingItem & { sourceTitles: string[]; itemKey: string };
  isChecked: boolean;
  onToggleCheck: () => void;
}) {
  return (
    <div
      onClick={onToggleCheck}
      className={`group flex items-center justify-between p-3 rounded-control border transition-all duration-150 cursor-pointer select-none ${
        isChecked
          ? 'bg-surface-2/40 border-line opacity-60'
          : 'bg-surface hover:bg-surface-2/60 border-line hover:border-line-strong'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 pr-2">
        {/* Custom Checkbox */}
        <div
          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
            isChecked
              ? 'bg-ink border-ink text-surface'
              : 'border-line-strong bg-surface group-hover:border-ink'
          }`}
        >
          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </div>

        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs md:text-sm font-medium truncate ${
                isChecked ? 'line-through text-ink-3' : 'text-ink'
              }`}
            >
              {item.name}
            </span>
            {item.inStock && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-[#5B7C5A]/15 text-[#5B7C5A] shrink-0">
                現貨
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] text-ink-3">
            {item.spec && <span>{item.spec}</span>}
            {item.sourceTitles?.length > 0 && (
              <span className="text-ink-3 truncate max-w-[160px]">
                來自: {item.sourceTitles.join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0">
        <span
          className={`font-mono text-xs md:text-sm font-semibold ${
            isChecked ? 'text-ink-3' : 'text-ink'
          }`}
        >
          {formatCurrency(item.estimatedPrice)}
        </span>
      </div>
    </div>
  );
}
