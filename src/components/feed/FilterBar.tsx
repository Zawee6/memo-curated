'use client';

import React from 'react';
import { Category } from '@/types/item';
import { CategoryFilter, ViewMode } from '@/types/ui';
import { CATEGORIES } from '@/lib/categories';
import { Chip } from '@/components/ui/Chip';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { LayoutGrid, List } from 'lucide-react';

export function FilterBar({
  selectedCategory,
  onSelectCategory,
  selectedCity,
  onSelectCity,
  availableCities,
  viewMode,
  onViewModeChange,
  counts,
}: {
  selectedCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
  selectedCity?: string;
  onSelectCity: (city?: string) => void;
  availableCities: string[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  counts: Record<string, number>;
}) {
  const categoriesList: Array<{ key: CategoryFilter; label: string }> = [
    { key: 'all', label: '全部靈感' },
    { key: 'place', label: CATEGORIES.place.label },
    { key: 'recipe', label: CATEGORIES.recipe.label },
    { key: 'media', label: CATEGORIES.media.label },
    { key: 'account', label: CATEGORIES.account.label },
    { key: 'product', label: CATEGORIES.product.label },
    { key: 'general', label: CATEGORIES.general.label },
  ];

  return (
    <div className="space-y-3 select-none">
      {/* Top Filter Row: Category Chips & View Mode */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-x-auto pb-1 no-scrollbar">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 shrink-0">
          {categoriesList.map((cat) => {
            const count = counts[cat.key];
            const isActive = selectedCategory === cat.key;

            return (
              <Chip
                key={cat.key}
                active={isActive}
                count={count}
                size="md"
                onClick={() => onSelectCategory(cat.key)}
              >
                {cat.label}
              </Chip>
            );
          })}
        </div>

        {/* View Mode Toggle */}
        <div className="shrink-0 self-end sm:self-auto">
          <SegmentedControl
            size="sm"
            value={viewMode === 'compact' ? 'compact' : 'grid'}
            onChange={(val) => onViewModeChange(val as ViewMode)}
            options={[
              {
                value: 'grid',
                label: '網格',
                icon: <LayoutGrid className="w-3.5 h-3.5" />,
              },
              {
                value: 'compact',
                label: '列表',
                icon: <List className="w-3.5 h-3.5" />,
              },
            ]}
          />
        </div>
      </div>

      {/* City Chips (shown only when places or all is selected, and cities exist) */}
      {(selectedCategory === 'all' || selectedCategory === 'place') &&
        availableCities.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-xs text-ink-3 shrink-0 font-medium mr-1">
              城市篩選：
            </span>
            <Chip
              size="sm"
              active={!selectedCity}
              onClick={() => onSelectCity(undefined)}
            >
              不限城市
            </Chip>
            {availableCities.map((city) => (
              <Chip
                key={city}
                size="sm"
                active={selectedCity === city}
                onClick={() =>
                  onSelectCity(selectedCity === city ? undefined : city)
                }
              >
                {city}
              </Chip>
            ))}
          </div>
        )}
    </div>
  );
}
