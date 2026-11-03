'use client';

import React from 'react';
import { ParsedItem } from '@/types/item';
import { ItemCard } from '@/components/common/ItemCard';

export function RecipeCard({
  item,
  highlightRole,
  index,
  onSelect,
}: {
  item: ParsedItem;
  highlightRole?: string;
  index?: number;
  onSelect?: (item: ParsedItem) => void;
}) {
  return (
    <ItemCard
      item={item}
      highlightRole={highlightRole}
      index={index}
      onSelect={onSelect}
    />
  );
}

