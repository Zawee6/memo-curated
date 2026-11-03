'use client';

import React, { useState } from 'react';
import { ParsedItem } from '@/types/item';
import { useAppState } from '@/providers/AppStateProvider';
import { Info, Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

function PlaceListItem({
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
        'relative p-3 rounded-control border transition-all duration-150 cursor-pointer select-none space-y-1.5 overflow-hidden',
        isActive
          ? 'bg-accent-soft/30 border-accent ring-1 ring-accent/30 shadow-xs'
          : 'bg-surface hover:bg-surface-2 border-line hover:border-line-strong',
        isSelected && 'border-[#3F7D58]/40 bg-[#3F7D58]/5'
      )}
      title="單擊在地圖定位此景點"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm shrink-0">{place.emoji}</span>
          <h4 className="font-display text-xs font-bold text-ink truncate">
            {locationName}
          </h4>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isSelected && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-xs text-[10px] font-bold bg-[#3F7D58] text-white border border-dashed border-emerald-400 font-sans tracking-wider shadow-2xs">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
              <span>已排</span>
            </span>
          )}
          {place.placeInfo?.city && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-surface-2 text-ink-2 border border-line">
              {place.placeInfo.city}
            </span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-ink-2 line-clamp-2 leading-relaxed">
        {place.summary}
      </p>

      <div className="flex items-center justify-between pt-1.5 border-t border-line text-[10px] text-ink-3">
        <span className="truncate max-w-[140px]">
          {place.placeInfo?.address || '在地私房景點'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
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
              <>
                <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                <span>排入</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail(place);
            }}
            className="hover:text-accent hover:underline cursor-pointer"
          >
            詳情
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlaceListPanel({
  places,
  activePlaceId,
  onSelectPlace,
}: {
  places: Array<ParsedItem & { lat: number; lng: number; emoji: string }>;
  activePlaceId: string | null;
  onSelectPlace: (place: ParsedItem & { lat: number; lng: number }) => void;
}) {
  const { openDetail, selectedPlaceIds, toggleSelectedPlace } = useAppState();

  return (
    <div className="hidden lg:flex flex-col w-80 h-full border-r border-line bg-surface/95 backdrop-blur-md shrink-0 z-10 overflow-hidden">
      <div className="p-4 border-b border-line flex items-center justify-between">
        <span className="text-xs font-semibold text-ink uppercase tracking-wider font-mono">
          探索清單 ({places.length})
        </span>
        <span className="text-[11px] text-ink-3 font-sans">
          💡 連點兩下排入行程
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {places.map((place) => (
          <PlaceListItem
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
