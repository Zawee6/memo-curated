import React from 'react';
import { PlacesView } from '@/components/places/PlacesView';

export const metadata = {
  title: '景點與探索地圖 — Memo',
  description: '結合私房景點卡片牆與全螢幕互動式 OpenStreetMap 探索地圖。',
};

export default function PlacesPage() {
  return <PlacesView />;
}
