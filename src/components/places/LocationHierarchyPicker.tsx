'use client';

import React, { useState, useMemo } from 'react';
import {
  MapPin,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  Compass,
} from 'lucide-react';
import { SavedItem } from '@/types/item';
import { cn } from '@/lib/utils';
import {
  TAIWAN_LOCATION_HIERARCHY,
  resolvePlaceHierarchy,
  cleanDistrictName,
  standardizeCityName,
} from '@/lib/taiwanLocations';

export interface LocationStats {
  cityStatsMap: Map<
    string,
    { totalCount: number; districtCounts: Map<string, number> }
  >;
  citiesWithPlaces: Array<{
    city: string;
    count: number;
    districtCounts: Map<string, number>;
  }>;
  totalPlacesCount: number;
}

/**
 * 統計全站景點各縣市與鄉鎮市區數量
 */
export function useLocationStats(rawPlaces: SavedItem[]): LocationStats {
  return useMemo(() => {
    const stats = new Map<
      string,
      { totalCount: number; districtCounts: Map<string, number> }
    >();

    let validCount = 0;

    rawPlaces.forEach((p) => {
      validCount++;
      const { city, district } = resolvePlaceHierarchy(p);
      const standardCity = standardizeCityName(
        city || p.placeInfo?.city || (p as any).city
      );
      if (!standardCity) return;

      if (!stats.has(standardCity)) {
        stats.set(standardCity, { totalCount: 0, districtCounts: new Map() });
      }

      const cityStat = stats.get(standardCity)!;
      cityStat.totalCount++;

      const dist = district || p.placeInfo?.district;
      if (dist) {
        const cleanDist = cleanDistrictName(dist);
        const cur = cityStat.districtCounts.get(cleanDist) || 0;
        cityStat.districtCounts.set(cleanDist, cur + 1);
      }
    });

    const sortedCities = Array.from(stats.entries())
      .sort((a, b) => b[1].totalCount - a[1].totalCount)
      .map(([cityName, data]) => ({
        city: cityName,
        count: data.totalCount,
        districtCounts: data.districtCounts,
      }));

    return {
      cityStatsMap: stats,
      citiesWithPlaces: sortedCities,
      totalPlacesCount: validCount,
    };
  }, [rawPlaces]);
}

/**
 * 1. 頂部觸發按鈕膠囊 (放置於工具列橫向排列中)
 */
export interface LocationHierarchyTriggerProps {
  rawPlaces: SavedItem[];
  selectedCity?: string;
  selectedDistrict?: string;
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
  className?: string;
}

export function LocationHierarchyTrigger({
  rawPlaces,
  selectedCity,
  selectedDistrict,
  isOpen,
  onToggle,
  onClear,
  className,
}: LocationHierarchyTriggerProps) {
  const { cityStatsMap, totalPlacesCount } = useLocationStats(rawPlaces);

  const triggerLabel = useMemo(() => {
    if (!selectedCity) {
      return `全部地區 (${totalPlacesCount} 間)`;
    }
    if (selectedDistrict) {
      return `${selectedCity}・${cleanDistrictName(selectedDistrict)}`;
    }
    const count = cityStatsMap.get(selectedCity)?.totalCount || 0;
    return `${selectedCity} (${count} 間)`;
  }, [selectedCity, selectedDistrict, totalPlacesCount, cityStatsMap]);

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full bg-surface border border-line shadow-2xs hover:border-cat-place/40 transition-all text-xs',
        className
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 font-semibold transition-all cursor-pointer whitespace-nowrap',
          selectedCity ? 'text-cat-place font-bold' : 'text-ink-2 hover:text-ink',
          isOpen && 'bg-cat-place/10 text-cat-place'
        )}
      >
        <MapPin
          className={cn(
            'w-3.5 h-3.5',
            selectedCity ? 'text-cat-place fill-cat-place/20' : 'text-ink-3'
          )}
        />
        <span>{triggerLabel}</span>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5 text-cat-place shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-ink-3 shrink-0" />
        )}
      </button>

      {selectedCity && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="px-2 py-1 text-ink-3 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border-l border-line cursor-pointer rounded-r-full"
          title="清除地區篩選，查看全部"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * 2. 獨立文檔流地區選擇面板 (放置於工具列下方，100% 寬度自然展開，絕不被任何外框截斷)
 */
export interface LocationHierarchyPanelProps {
  rawPlaces: SavedItem[];
  selectedCity?: string;
  selectedDistrict?: string;
  onSelectLocation: (city?: string, district?: string) => void;
  onClose: () => void;
  className?: string;
}

export function LocationHierarchyPanel({
  rawPlaces,
  selectedCity,
  selectedDistrict,
  onSelectLocation,
  onClose,
  className,
}: LocationHierarchyPanelProps) {
  const [activeTab, setActiveTab] = useState<'saved' | 'all'>('saved');
  const { cityStatsMap, citiesWithPlaces, totalPlacesCount } =
    useLocationStats(rawPlaces);

  const handleSelectAll = () => {
    onSelectLocation(undefined, undefined);
    onClose();
  };

  const handleSelectCity = (city: string) => {
    if (selectedCity === city && !selectedDistrict) {
      onSelectLocation(undefined, undefined);
      onClose();
      return;
    }
    const stat = cityStatsMap.get(city);
    // 若該縣市沒有子鄉鎮市區，直接完成過濾並收合
    if (!stat || stat.districtCounts.size === 0) {
      onSelectLocation(city, undefined);
      onClose();
    } else {
      // 若有子鄉鎮市區，先選中該縣市供使用者進一步點選鄉鎮或全縣市
      onSelectLocation(city, undefined);
    }
  };

  const handleSelectDistrict = (city: string, district?: string) => {
    onSelectLocation(city, district);
    onClose();
  };

  const currentCityDistricts = useMemo(() => {
    if (!selectedCity) return [];
    const stat = cityStatsMap.get(selectedCity);
    if (!stat) return [];
    return Array.from(stat.districtCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [selectedCity, cityStatsMap]);

  return (
    <div
      className={cn(
        'w-full rounded-2xl bg-surface border border-line shadow-sm p-4 space-y-3.5 text-xs animate-in fade-in slide-in-from-top-2 duration-200 box-border',
        className
      )}
    >
      {/* 頂部切換列 */}
      <div className="flex flex-wrap items-center justify-between pb-2.5 border-b border-line gap-2">
        <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-xl border border-line">
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'saved'
                ? 'bg-surface text-ink shadow-2xs font-bold border border-black/10'
                : 'text-ink-3 hover:text-ink'
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-cat-place" />
            <span>✨ 已收藏縣市 ({citiesWithPlaces.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer',
              activeTab === 'all'
                ? 'bg-surface text-ink shadow-2xs font-bold border border-black/10'
                : 'text-ink-3 hover:text-ink'
            )}
          >
            <Compass className="w-3.5 h-3.5 text-accent" />
            <span>🧭 全台所有 22 縣市</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 border',
              !selectedCity
                ? 'bg-cat-place text-white font-bold border-cat-place shadow-2xs'
                : 'bg-surface-2 hover:bg-surface text-ink border-line hover:border-black/30'
            )}
          >
            全部地區 ({totalPlacesCount} 間)
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer border border-transparent hover:border-line"
            title="收合地區選擇面板"
          >
            <span>收合</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 模式 A：✨ 已收藏縣市 (網格大按鈕) */}
      {activeTab === 'saved' && (
        <div className="space-y-3.5">
          {citiesWithPlaces.length === 0 ? (
            <div className="py-8 text-center text-ink-4 text-xs">
              目前尚未收藏任何地點，請先於地圖或上方搜尋框新增景點！
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {citiesWithPlaces.map(({ city, count }) => {
                const isSelected = selectedCity === city;
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => handleSelectCity(city)}
                    className={cn(
                      'inline-flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border shadow-2xs active:scale-95',
                      isSelected
                        ? 'bg-cat-place text-white border-cat-place font-bold shadow-xs ring-2 ring-cat-place/30 scale-[1.02]'
                        : 'bg-surface-2 hover:bg-surface text-ink border-line hover:border-cat-place/40 hover:text-cat-place'
                    )}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin
                        className={cn(
                          'w-3.5 h-3.5 shrink-0',
                          isSelected ? 'text-white' : 'text-cat-place'
                        )}
                      />
                      <span className="truncate">{city}</span>
                    </span>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ml-1',
                        isSelected
                          ? 'bg-white/25 text-white'
                          : 'bg-cat-place/15 text-cat-place'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 若已選取某縣市且該縣市有鄉鎮市區，顯示二級鄉鎮篩選 */}
          {selectedCity && currentCityDistricts.length > 0 && (
            <div className="pt-3 border-t border-dashed border-line space-y-2 bg-surface-2/40 -mx-4 -mb-4 p-4 rounded-b-2xl">
              <div className="flex items-center justify-between text-xs text-ink-2 font-medium">
                <span className="font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-cat-place" />
                  <span>📍 {selectedCity} 的細部鄉鎮市區：</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectDistrict(selectedCity, undefined)}
                  className={cn(
                    'px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs',
                    !selectedDistrict
                      ? 'bg-cat-place text-white font-bold'
                      : 'text-ink-3 hover:text-cat-place hover:underline'
                  )}
                >
                  全{selectedCity} ({cityStatsMap.get(selectedCity)?.totalCount || 0})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {currentCityDistricts.map(({ name, count }) => {
                  const isDistSelected =
                    cleanDistrictName(selectedDistrict || '') === cleanDistrictName(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelectDistrict(selectedCity, name)}
                      className={cn(
                        'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border shadow-2xs active:scale-95',
                        isDistSelected
                          ? 'bg-cat-place text-white border-cat-place font-bold shadow-xs'
                          : 'bg-surface hover:bg-cat-place/10 text-ink border-line hover:border-cat-place/40 hover:text-cat-place'
                      )}
                    >
                      <span>↳ {name}</span>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                          isDistSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-black/5 text-ink-3'
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 模式 B：🧭 全台所有 22 縣市 (分區網格) */}
      {activeTab === 'all' && (
        <div className="space-y-3 pt-1">
          {(['北部', '中部', '南部', '東部', '離島'] as const).map(
            (regionName) => {
              const regionGroups = TAIWAN_LOCATION_HIERARCHY.filter(
                (g) => g.region === regionName
              );
              if (regionGroups.length === 0) return null;

              return (
                <div key={regionName} className="space-y-1.5">
                  <span className="text-[10px] font-bold text-ink-3 tracking-wider uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span>{regionName}地區</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-1.5">
                    {regionGroups.map((g) => {
                      const count = cityStatsMap.get(g.city)?.totalCount || 0;
                      const isSelected = selectedCity === g.city;
                      const hasPlaces = count > 0;

                      return (
                        <button
                          key={g.city}
                          type="button"
                          onClick={() => handleSelectCity(g.city)}
                          className={cn(
                            'inline-flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border shadow-2xs',
                            isSelected
                              ? 'bg-cat-place text-white border-cat-place font-bold shadow-2xs'
                              : hasPlaces
                              ? 'bg-surface hover:bg-cat-place/10 text-ink font-semibold border-cat-place/40 hover:text-cat-place'
                              : 'bg-surface-2/60 text-ink-3 hover:text-ink hover:bg-surface border-line/60'
                          )}
                        >
                          <span className="truncate">{g.city}</span>
                          {count > 0 && (
                            <span
                              className={cn(
                                'text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1',
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-cat-place/15 text-cat-place'
                              )}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 舊版相容包裝元件 (預設渲染 Trigger，點擊時以 Popover 形式彈出)
 */
export interface LocationHierarchyPickerProps {
  rawPlaces: SavedItem[];
  selectedCity?: string;
  selectedDistrict?: string;
  onSelectLocation: (city?: string, district?: string) => void;
  className?: string;
}

export function LocationHierarchyPicker({
  rawPlaces,
  selectedCity,
  selectedDistrict,
  onSelectLocation,
  className,
}: LocationHierarchyPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn('relative inline-block text-xs', className)}>
      <LocationHierarchyTrigger
        rawPlaces={rawPlaces}
        selectedCity={selectedCity}
        selectedDistrict={selectedDistrict}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        onClear={() => onSelectLocation(undefined, undefined)}
      />

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-[480px] max-w-[94vw] z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
          <LocationHierarchyPanel
            rawPlaces={rawPlaces}
            selectedCity={selectedCity}
            selectedDistrict={selectedDistrict}
            onSelectLocation={onSelectLocation}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
