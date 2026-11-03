'use client';

import dynamic from 'next/dynamic';
import { Compass } from 'lucide-react';

const MapView = dynamic(
  () => import('@/components/map/MapView').then((m) => m.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[calc(100dvh-5rem)] md:h-dvh flex items-center justify-center bg-surface-2 text-ink-3">
        <div className="flex flex-col items-center gap-2">
          <Compass className="w-6 h-6 animate-spin text-cat-place" />
          <span className="text-xs font-mono">載入探索地圖...</span>
        </div>
      </div>
    ),
  }
);

export default function MapPage() {
  return <MapView />;
}
