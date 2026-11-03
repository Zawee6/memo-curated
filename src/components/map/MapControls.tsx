'use client';

import React from 'react';
import { Compass, Sparkles } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';

export function MapControls({
  placesCount,
  availableCities,
  selectedCity,
  onSelectCity,
  onGenerateItinerary,
  isGeneratingItinerary,
}: {
  placesCount: number;
  availableCities: string[];
  selectedCity?: string;
  onSelectCity: (city?: string) => void;
  onGenerateItinerary: () => void;
  isGeneratingItinerary: boolean;
}) {
  return (
    <div className="absolute top-4 inset-x-4 z-[400] flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 pointer-events-none">
      {/* City Chips & Count */}
      <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 no-scrollbar pointer-events-auto bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-line shadow-float">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ink shrink-0 pr-2 border-r border-line font-mono">
          <Compass className="w-4 h-4 text-cat-place" />
          <span>{placesCount} 處私藏</span>
        </div>

        <Chip
          size="sm"
          active={!selectedCity}
          onClick={() => onSelectCity(undefined)}
        >
          全部
        </Chip>
        {availableCities.map((city) => (
          <Chip
            key={city}
            size="sm"
            active={selectedCity === city}
            onClick={() => onSelectCity(selectedCity === city ? undefined : city)}
          >
            {city}
          </Chip>
        ))}
      </div>

      {/* Itinerary Button */}
      {placesCount >= 2 && (
        <div className="pointer-events-auto shrink-0 self-end md:self-auto">
          <Button
            variant="accent"
            size="sm"
            onClick={onGenerateItinerary}
            isLoading={isGeneratingItinerary}
            leftIcon={<Sparkles className="w-3.5 h-3.5" />}
          >
            AI 一鍵排行程
          </Button>
        </div>
      )}
    </div>
  );
}
