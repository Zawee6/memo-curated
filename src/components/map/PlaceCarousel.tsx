'use client';

import React, { useState } from 'react';
import { ParsedItem } from '@/types/item';
import { useAppState } from '@/providers/AppStateProvider';
import { Navigation, Info, Check, Plus } from 'lucide-react';
import { CoverImage } from '@/components/feed/CoverImage';
import { cn } from '@/lib/utils';

function PlaceCarouselCard({
  place,
  isActive,
  isSelected,
  onSelectPlace,
  onToggleSelected,
  onOpenDetail,
}: {
  place: ParsedItem & { lat: number; lng: number; emoji: string };
  isActive: boolean;
  isSelected: boolean;
  onSelectPlace: (place: ParsedItem & { lat: number; lng: number }) => void;
  onToggleSelected: (id: string) => void;
  onOpenDetail: (place: ParsedItem) => void;
}) {
  const locationName = place.placeInfo?.locationName || place.title;

  return (
    <div
      onClick={() => onSelectPlace(place)}
      className={cn(
        'relative w-64 shrink-0 p-2.5 rounded-control shadow-float border backdrop-blur-md transition-all duration-150 cursor-pointer select-none space-y-1.5 overflow-hidden',
        isActive
          ? 'bg-surface border-accent ring-2 ring-accent/30 shadow-md'
          : 'bg-surface/95 border-line',
        isSelected && 'border-[#3F7D58]/50 ring-1 ring-[#3F7D58]/30'
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-12 h-12 rounded-control overflow-hidden shrink-0 border border-line">
          <CoverImage
            thumbnailUrl={place.thumbnailUrl}
            title={place.title}
            category={place.category}
            url={place.url}
            id={place.id}
            className="w-full h-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-xs">{place.emoji}</span>
            <h4 className="font-display text-xs font-bold text-ink truncate">
              {locationName}
            </h4>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isSelected && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-xs text-[9px] font-bold bg-[#3F7D58] text-white border border-dashed border-emerald-400 font-sans">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
                <span>已排</span>
              </span>
            )}
            {place.placeInfo?.city && (
              <span className="text-[10px] text-ink-3">
                {place.placeInfo.city}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-line text-[11px]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelected(place.id);
          }}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all active:scale-95 border',
            isSelected
              ? 'bg-[#3F7D58] text-white border-emerald-300'
              : 'bg-surface-2 text-ink-2 hover:bg-surface hover:text-ink border-line'
          )}
        >
          {isSelected ? (
            <>
              <Check className="w-2.5 h-2.5 stroke-[3]" />
              <span>已排</span>
            </>
          ) : (
            <span>＋ 排入</span>
          )}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-accent font-medium inline-flex items-center gap-1 text-[10px]">
            <Navigation className="w-2.5 h-2.5" />
            <span>定位</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(place);
            }}
            className="text-ink-2 hover:text-ink font-medium inline-flex items-center gap-0.5 p-0.5 text-[10px]"
          >
            <Info className="w-2.5 h-2.5" />
            <span>詳情</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlaceCarousel({
  places,
  activePlaceId,
  onSelectPlace,
}: {
  places: Array<ParsedItem & { lat: number; lng: number; emoji: string }>;
  activePlaceId: string | null;
  onSelectPlace: (place: ParsedItem & { lat: number; lng: number }) => void;
}) {
  const { openDetail, selectedPlaceIds, toggleSelectedPlace } = useAppState();

  if (places.length === 0) return null;

  return (
    <div className="md:hidden fixed bottom-20 inset-x-2 z-[400] overflow-x-auto pb-2 no-scrollbar pointer-events-auto">
      <div className="flex items-center gap-2.5 px-2">
        {places.map((place) => (
          <PlaceCarouselCard
            key={place.id}
            place={place}
            isActive={activePlaceId === place.id}
            isSelected={selectedPlaceIds.includes(place.id)}
            onSelectPlace={onSelectPlace}
            onToggleSelected={toggleSelectedPlace}
            onOpenDetail={openDetail}
          />
        ))}
      </div>
    </div>
  );
}
