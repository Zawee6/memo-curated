'use client';

import React from 'react';
import { Chip } from '@/components/ui/Chip';

export function StoreTabs({
  stores,
  selectedStore,
  onSelectStore,
}: {
  stores: string[];
  selectedStore: string;
  onSelectStore: (store: string) => void;
}) {
  if (stores.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none">
      <Chip
        size="md"
        active={selectedStore === 'all'}
        onClick={() => onSelectStore('all')}
      >
        全部賣場 ({stores.length})
      </Chip>
      {stores.map((store) => (
        <Chip
          key={store}
          size="md"
          active={selectedStore === store}
          onClick={() => onSelectStore(store)}
        >
          {store}
        </Chip>
      ))}
    </div>
  );
}
