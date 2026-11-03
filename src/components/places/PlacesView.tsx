'use client';

import React, { useState } from 'react';
import { SavedItem } from '@/types/item';
import { MapView } from '@/components/map/MapView';
import { DetailDrawer } from '@/components/shared/DetailDrawer';

export function PlacesView() {
  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);

  return (
    <>
      <MapView
        onSelectItem={(item) => setSelectedItem(item)}
        renderDetailDrawer={false}
      />
      <DetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
    </>
  );
}
