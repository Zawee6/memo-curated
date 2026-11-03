'use client';

import React, { useState } from 'react';
import { ParsedItem, TransportMode } from '@/types/item';
import { Sheet } from '@/components/ui/Sheet';
import { CoverImage } from '@/components/feed/CoverImage';
import { Button } from '@/components/ui/Button';
import { useAppState } from '@/providers/AppStateProvider';
import {
  MapPin,
  Trash2,
  X,
  Sparkles,
  Compass,
  Clock,
  Car,
  Bike,
  Bus,
  Footprints,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectedPlacesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlaces: ParsedItem[];
  onRemovePlace: (id: string) => void;
  onClearAll: () => void;
  onGenerateItinerary: (transportMode: TransportMode, departureTime: string) => void;
  isGeneratingItinerary?: boolean;
  initialTransportMode?: TransportMode;
  initialDepartureTime?: string;
}

const TRANSPORT_MODES: { key: TransportMode; label: string; icon: string; desc: string }[] = [
  { key: 'two-wheeler', label: '🛵 機車', icon: '🛵', desc: '巷弄穿梭最省時' },
  { key: 'driving', label: '🚗 開車', icon: '🚗', desc: '含停車建議' },
  { key: 'transit', label: '🚌 大眾運輸', icon: '🚌', desc: '公車與捷運接駁' },
  { key: 'walking', label: '🚶 步行', icon: '🚶', desc: '街區漫步散策' },
];

const DEPARTURE_PRESETS = [
  { time: '10:00', label: '10:00 早午餐出發' },
  { time: '14:00', label: '14:00 下午茶半日遊' },
  { time: '09:00', label: '09:00 早鳥一日遊' },
];

export function SelectedPlacesDrawer({
  isOpen,
  onClose,
  selectedPlaces,
  onRemovePlace,
  onClearAll,
  onGenerateItinerary,
  isGeneratingItinerary,
  initialTransportMode = 'two-wheeler',
  initialDepartureTime = '10:00',
}: SelectedPlacesDrawerProps) {
  const { openDetail } = useAppState();
  const [transportMode, setTransportMode] = useState<TransportMode>(initialTransportMode);
  const [departureTime, setDepartureTime] = useState<string>(initialDepartureTime);

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={`📋 已選清單（共 ${selectedPlaces.length} 處景點）`}
      description="已勾選之私房景點與餐廳明細，可隨時移除單項、清空全部，或一鍵安排順路行程並匯出。"
      className="md:w-[580px] md:max-w-xl"
      headerActions={
        selectedPlaces.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-300 transition-colors cursor-pointer"
            title="清空所有已選景點"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>清空全部</span>
          </button>
        )
      }
      footer={
        <div className="w-full flex flex-col gap-3">
          {/* 行程出發設定與交通方式選擇器 */}
          {selectedPlaces.length > 0 && (
            <div className="p-3 rounded-xl bg-surface border border-line space-y-2.5 text-xs">
              {/* 1. 交通方式選擇器 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-ink-2 font-bold">
                  <span>🚦 主要交通方式：</span>
                  <span className="text-[11px] font-normal text-ink-3">
                    {TRANSPORT_MODES.find((m) => m.key === transportMode)?.desc}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 w-full bg-surface-2 p-1 rounded-xl">
                  {TRANSPORT_MODES.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setTransportMode(m.key)}
                      className={cn(
                        'py-1.5 px-1 text-center font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap text-xs',
                        transportMode === m.key
                          ? 'bg-[#3F7D58] text-white font-bold shadow-2xs'
                          : 'text-ink-2 hover:text-ink hover:bg-surface/50'
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. 出發時間選擇器 */}
              <div className="space-y-1.5 pt-1 border-t border-line">
                <div className="flex items-center justify-between text-ink-2 font-bold">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-accent" />
                    <span>⏰ 預計出發時間：</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="time"
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      className="px-2 py-0.5 rounded-lg border border-line bg-surface text-xs font-mono font-bold text-ink focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1.5 py-0.5">
                  {DEPARTURE_PRESETS.map((p) => (
                    <button
                      key={p.time}
                      type="button"
                      onClick={() => setDepartureTime(p.time)}
                      className={cn(
                        'px-2 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer border whitespace-nowrap shrink-0',
                        departureTime === p.time
                          ? 'bg-ink text-surface border-ink font-bold shadow-2xs'
                          : 'bg-surface-2 text-ink-3 hover:text-ink border-line'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="accent"
            size="lg"
            isLoading={isGeneratingItinerary}
            disabled={selectedPlaces.length === 0}
            onClick={() => {
              onClose();
              onGenerateItinerary(transportMode, departureTime);
            }}
            leftIcon={<Sparkles className="w-4 h-4" />}
            className="w-full py-3 text-sm font-bold bg-[#3F7D58] hover:bg-[#346a4a] text-white border-0 shadow-md cursor-pointer disabled:opacity-50"
          >
            ✨ 安排時間軸行程並匯出（{selectedPlaces.length} 處景點）
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {selectedPlaces.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Compass className="w-8 h-8 text-ink-3 mx-auto opacity-50" />
            <p className="font-sans text-sm text-ink-3">
              尚未勾選任何景點，請在景點卡片右下角點擊「＋」號快速加入！
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedPlaces.map((place, index) => {
              const locationName = place.placeInfo?.locationName || place.title;
              const city = place.placeInfo?.city;
              const address = place.placeInfo?.address;

              return (
                <div
                  key={place.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openDetail(place);
                  }}
                  className="p-3 rounded-xl border border-black/10 bg-surface hover:bg-surface-2/40 transition-all shadow-2xs flex items-center gap-3 group relative select-none cursor-pointer"
                >
                  {/* 縮圖（點擊縮圖開啟詳細資訊卡） */}
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openDetail(place);
                    }}
                    className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-black/10 bg-stone-900 relative cursor-pointer group/thumb hover:ring-2 hover:ring-[#3F7D58]/50 transition-all active:scale-95"
                    title="點擊縮圖查看景點詳細資訊卡"
                  >
                    <CoverImage
                      thumbnailUrl={place.thumbnailUrl}
                      title={place.title}
                      category="place"
                      url={place.url}
                      id={place.id}
                      className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute top-1 left-1">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#3F7D58] text-white shadow-xs">
                        #{index + 1}
                      </span>
                    </div>
                  </div>

                  {/* 資訊 */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h4 className="font-display text-xs sm:text-sm font-bold text-ink truncate leading-tight group-hover:text-cat-place transition-colors">
                        {locationName}
                      </h4>
                      {city && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-surface-2 text-ink-2 border border-line shrink-0">
                          {city}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-ink-3 line-clamp-1 leading-snug">
                      {address || place.summary || '私房推薦景點'}
                    </p>
                  </div>

                  {/* 移除按鈕 */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePlace(place.id);
                    }}
                    className="p-2 rounded-lg text-ink-3 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 z-10"
                    title="從待排行程移出"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
