'use client';

import React, { useState } from 'react';
import { ParsedItem } from '@/types/item';
import { useAppState } from '@/providers/AppStateProvider';
import {
  MapPin,
  ExternalLink,
  Navigation,
  Compass,
  Sparkles,
  Info,
  Plus,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function GoogleMapEmbed({
  place,
  className,
}: {
  place: ParsedItem | null;
  className?: string;
}) {
  const { openDetail, selectedPlaceIds, toggleSelectedPlace } = useAppState();
  const [isLoading, setIsLoading] = useState(true);

  if (!place) {
    return (
      <div
        className={cn(
          'w-full h-full flex flex-col items-center justify-center p-6 bg-surface-2 text-ink-3 border border-line rounded-card text-center',
          className
        )}
      >
        <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mb-3 shadow-xs border border-line">
          <Compass className="w-6 h-6 text-cat-place" />
        </div>
        <h3 className="font-semibold text-base text-ink mb-1">
          請從清單點選景點或餐廳
        </h3>
        <p className="text-xs text-ink-3 max-w-sm">
          點選左側或下方景點卡片，立即載入正宗 Google Maps 實景互動地圖。
        </p>
      </div>
    );
  }

  const query = (
    place.placeInfo?.googleMapsQuery ||
    `${place.placeInfo?.locationName || place.title} ${
      place.placeInfo?.address || place.placeInfo?.city || ''
    }`
  ).trim();

  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
    query
  )}&hl=zh-TW&z=16&output=embed`;

  const externalMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;

  return (
    <div
      className={cn(
        'relative w-full h-full overflow-hidden flex flex-col bg-surface border border-line rounded-card shadow-xs',
        className
      )}
    >
      {/* 頂部資訊列 (Floating Location Bar) */}
      <div className="shrink-0 p-3.5 sm:p-4 bg-surface/95 backdrop-blur-md border-b border-line flex flex-wrap items-center justify-between gap-3 z-10">
        <div className="min-w-0 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-control bg-cat-place/15 text-cat-place flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm sm:text-base text-ink truncate flex items-center gap-2">
              <span>{place.placeInfo?.locationName || place.title}</span>
              {place.placeInfo?.city && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-2 border border-line text-ink-3 font-normal shrink-0">
                  {place.placeInfo.city}
                </span>
              )}
            </h3>
            <p className="text-xs text-ink-3 truncate max-w-md">
              {place.placeInfo?.address || '正宗 Google Maps 實景連線中'}
            </p>
          </div>
        </div>

        {/* 快捷操作按鈕 */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 一鍵加入待排行程 / 收藏按鈕 */}
          <button
            type="button"
            onClick={() => toggleSelectedPlace(place.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-bold transition-all shadow-2xs cursor-pointer',
              selectedPlaceIds.includes(place.id)
                ? 'bg-[#3F7D58] text-white hover:bg-[#346a4a]'
                : 'bg-[#3F7D58]/10 text-[#3F7D58] border border-[#3F7D58]/40 hover:bg-[#3F7D58]/20'
            )}
          >
            {selectedPlaceIds.includes(place.id) ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>✓ 已加入行程</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>＋ 加入待排行程</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => openDetail(place)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-medium bg-surface-2 text-ink border border-line hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 text-ink-3" />
            <span className="hidden sm:inline">查看詳情</span>
          </button>

          <a
            href={externalMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-semibold bg-cat-place text-white hover:bg-cat-place/90 transition-all shadow-2xs cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Google 地圖 App</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
        </div>
      </div>

      {/* Google Maps 原生 iframe 互動容器 */}
      <div className="relative flex-1 w-full h-full min-h-[360px] bg-stone-100 dark:bg-stone-900">
        <iframe
          key={place.id}
          title={place.title}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={embedUrl}
          className="w-full h-full"
        />
      </div>
    </div>
  );
}
