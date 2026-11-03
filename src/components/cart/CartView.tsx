'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '@/providers/AppStateProvider';
import {
  buildMergedCart,
  loadCartCheckedKeys,
  saveCartCheckedKeys,
} from '@/lib/cart';
import { BudgetSummary } from './BudgetSummary';
import { CartSourceChips } from './CartSourceChips';
import { StoreTabs } from './StoreTabs';
import { StoreGroup } from './StoreGroup';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShoppingBag } from 'lucide-react';

export function CartView() {
  const {
    items,
    cartSelectedIds,
    setCartSelectedIds,
    toggleCartItem,
  } = useAppState();

  const [checkedKeys, setCheckedKeys] = useState<Record<string, boolean>>({});
  const [selectedStore, setSelectedStore] = useState<string>('all');

  // Load checked items on mount
  useEffect(() => {
    setCheckedKeys(loadCartCheckedKeys());
  }, []);

  function handleToggleKey(key: string) {
    setCheckedKeys((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveCartCheckedKeys(next);
      return next;
    });
  }

  function handleResetChecks() {
    setCheckedKeys({});
    saveCartCheckedKeys({});
  }

  // Cards that have shopping plans
  const availableCards = useMemo(() => {
    return items.filter(
      (item) => item.shoppingPlan && (item.shoppingPlan.items?.length ?? 0) > 0
    );
  }, [items]);

  // Build merged groups
  const { groups, totalCost, totalItemsCount } = useMemo(() => {
    return buildMergedCart(items, cartSelectedIds);
  }, [items, cartSelectedIds]);

  // Filter groups by selected store
  const filteredGroups = useMemo(() => {
    if (selectedStore === 'all') return groups;
    return groups.filter((g) => g.store === selectedStore);
  }, [groups, selectedStore]);

  const allStores = useMemo(() => groups.map((g) => g.store), [groups]);

  // Count checked items
  const checkedCount = useMemo(() => {
    let count = 0;
    for (const group of groups) {
      for (const item of group.items) {
        if (checkedKeys[item.itemKey]) {
          count++;
        }
      }
    }
    return count;
  }, [groups, checkedKeys]);

  if (availableCards.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto py-16 px-4">
        <EmptyState
          icon={<ShoppingBag className="w-6 h-6 text-accent" />}
          title="尚無採買清單項目"
          description="當您收藏食譜、露營裝備或餐廳菜單時，Memo 會自動為您估算賣場（如 Costco、全聯）的規格與價格，並在此合併計算！"
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[11px] font-mono text-ink-3 uppercase tracking-wider">
          <span>Smart Grocery & Warehouse Planner</span>
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-ink">
          大賣場智慧採買中心
        </h1>
        <p className="text-xs md:text-sm text-ink-3">
          自動比對家常食譜與食材工法，自動消除重複品項，分門別類整理各大賣場動線清單。
        </p>
      </div>

      {/* Recipe / Place Source Filter Chips */}
      <CartSourceChips
        availableCards={availableCards}
        selectedCardIds={cartSelectedIds}
        onToggleCardId={toggleCartItem}
        onSelectAll={() => setCartSelectedIds(availableCards.map((c) => c.id))}
        onClearAll={() => setCartSelectedIds([])}
      />

      {/* Budget Summary Card */}
      <BudgetSummary
        groups={groups}
        totalCost={totalCost}
        totalItemsCount={totalItemsCount}
        checkedCount={checkedCount}
        onResetChecks={handleResetChecks}
      />

      {/* Store Filter Tabs */}
      <StoreTabs
        stores={allStores}
        selectedStore={selectedStore}
        onSelectStore={setSelectedStore}
      />

      {/* Store Groups */}
      {filteredGroups.length > 0 ? (
        <div className="space-y-4">
          {filteredGroups.map((group) => (
            <StoreGroup
              key={group.store}
              group={group}
              checkedKeys={checkedKeys}
              onToggleKey={handleToggleKey}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="該賣場無採買品項"
          description="請選擇其他賣場分類或重新選擇採買來源靈感卡片。"
          actionLabel="切換至全部賣場"
          onAction={() => setSelectedStore('all')}
        />
      )}
    </div>
  );
}
