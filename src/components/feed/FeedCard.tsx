'use client';

import React from 'react';
import { ItemCard, ItemCardProps } from '@/components/common/ItemCard';

export type FeedCardProps = ItemCardProps;

export function FeedCard(props: FeedCardProps) {
  return <ItemCard {...props} />;
}
