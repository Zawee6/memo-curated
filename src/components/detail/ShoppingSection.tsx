import React from 'react';
import { ShoppingPlan } from '@/types/item';
import { ShoppingCart, Store, Check, Lightbulb } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

export function ShoppingSection({
  shoppingPlan,
  isCartSelected,
  onToggleCart,
}: {
  shoppingPlan: ShoppingPlan;
  isCartSelected: boolean;
  onToggleCart: () => void;
}) {
  const hasItems = shoppingPlan.items && shoppingPlan.items.length > 0;

  return (
    <div className="rounded-card border border-line bg-surface p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider font-mono">
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>大賣場採買估價</span>
        </div>
        <button
          type="button"
          onClick={onToggleCart}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control text-xs font-medium cursor-pointer transition-colors ${
            isCartSelected
              ? 'bg-accent text-white shadow-xs'
              : 'bg-surface-2 text-ink-2 hover:bg-line/40 hover:text-ink border border-line'
          }`}
        >
          {isCartSelected ? (
            <>
              <Check className="w-3 h-3" />
              <span>已納入採買推車</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-3 h-3" />
              <span>加入採買推車</span>
            </>
          )}
        </button>
      </div>

      {/* Summary stats */}
      <div className="flex items-baseline justify-between p-3 rounded-control bg-surface-2/60 border border-line">
        <div className="space-y-0.5">
          <span className="text-[11px] text-ink-3">預估總採買花費</span>
          <div className="text-xl font-bold font-mono text-ink">
            {formatCurrency(shoppingPlan.totalEstimatedCost)}
          </div>
        </div>
        {shoppingPlan.recommendedStores?.length > 0 && (
          <div className="text-right">
            <span className="text-[10px] text-ink-3 block">建議賣場</span>
            <div className="flex items-center gap-1 justify-end mt-0.5">
              {shoppingPlan.recommendedStores.map((store, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface text-ink-2 border border-line"
                >
                  {store}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Saving Tips */}
      {shoppingPlan.savingTips && (
        <div className="flex items-start gap-2 p-2.5 rounded-control bg-accent-soft/40 border border-accent/20 text-xs text-ink-2 leading-relaxed">
          <Lightbulb className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
          <span>{shoppingPlan.savingTips}</span>
        </div>
      )}

      {/* Item rows */}
      {hasItems && (
        <div className="space-y-1.5">
          {shoppingPlan.items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-control bg-surface-2/40 border border-line text-xs"
            >
              <div className="space-y-0.5 truncate pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-ink truncate">
                    {item.name}
                  </span>
                  {item.inStock && (
                    <span className="px-1 py-0.2 rounded text-[9px] font-medium bg-cat-place/15 text-cat-place shrink-0">
                      家中現貨
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-ink-3">
                  <span>{item.store}</span>
                  {item.spec && <span>• {item.spec}</span>}
                </div>
              </div>
              <div className="font-mono font-semibold text-ink shrink-0">
                {formatCurrency(item.estimatedPrice)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
