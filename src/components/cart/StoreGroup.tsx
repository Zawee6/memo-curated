'use client';

import React from 'react';
import { MergedStoreGroup } from '@/lib/cart';
import { CartItemRow } from './CartItemRow';
import { formatCurrency } from '@/lib/format';
import { Store } from 'lucide-react';

export function StoreGroup({
  group,
  checkedKeys,
  onToggleKey,
}: {
  group: MergedStoreGroup;
  checkedKeys: Record<string, boolean>;
  onToggleKey: (key: string) => void;
}) {
  const completedCount = group.items.filter(
    (i) => checkedKeys[i.itemKey]
  ).length;

  return (
    <div className="rounded-card border border-line bg-surface overflow-hidden shadow-xs space-y-2">
      {/* Group Header */}
      <div className="p-4 bg-surface-2/40 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-control bg-surface border border-line text-ink">
            <Store className="w-4 h-4 text-accent" />
          </span>
          <div>
            <h3 className="font-display text-sm md:text-base font-bold text-ink">
              {group.store}
            </h3>
            <span className="text-[11px] text-ink-3">
              已採買 {completedCount} / {group.items.length} 件
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-ink-3 block">小計</span>
          <span className="font-mono text-sm md:text-base font-bold text-ink">
            {formatCurrency(group.subtotal)}
          </span>
        </div>
      </div>

      {/* Item Rows */}
      <div className="p-3 space-y-2">
        {group.items.map((item) => (
          <CartItemRow
            key={item.itemKey}
            item={item}
            isChecked={!!checkedKeys[item.itemKey]}
            onToggleCheck={() => onToggleKey(item.itemKey)}
          />
        ))}
      </div>
    </div>
  );
}
