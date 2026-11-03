'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppState } from '@/providers/AppStateProvider';
import { ParsedItem, SavedItem, ItineraryPlan, TransportMode } from '@/types/item';
import {
  ensureLocalStorageSchemaVersion,
  normalizeItineraryPlan,
} from '@/lib/storage';
import { normalizeCityName } from '@/lib/location-normalizer';
import { getFallbackCoordinates } from '@/lib/geoUtils';
import { getPlaceEmoji } from '@/lib/placeEmoji';
import { PlaceListPanel } from './PlaceListPanel';
import { GoogleMapEmbed } from './GoogleMapEmbed';
import { ItinerarySheet } from './ItinerarySheet';
import { SelectedPlacesDrawer } from './SelectedPlacesDrawer';
import { LocationHierarchyTrigger, LocationHierarchyPanel } from '@/components/places/LocationHierarchyPicker';
import { SmartTagFilterBar } from '@/components/common/SmartTagFilterBar';
import { resolvePlaceHierarchy, cleanDistrictName } from '@/lib/taiwanLocations';
import { getPlaceSmartTags, getItemAllTags } from '@/lib/smartTags';
import { FeedGrid } from '@/components/feed/FeedGrid';
import { CommandBar } from '@/components/feed/CommandBar';
import { CoverImage } from '@/components/feed/CoverImage';
import { DetailDrawer } from '@/components/shared/DetailDrawer';
import { collapseItemsForCompilation } from '@/lib/video';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import {
  Compass,
  MapPin,
  Sparkles,
  LayoutGrid,
  Map as MapIcon,
  Check,
  Heart,
  Plus,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function MapView({
  onSelectItem,
  renderDetailDrawer = true,
}: {
  onSelectItem?: (item: SavedItem) => void;
  renderDetailDrawer?: boolean;
} = {}) {
  const {
    items,
    isLoading,
    addToast,
    openDetail,
    selectedPlaceIds,
    setSelectedPlaceIds,
    toggleSelectedPlace,
    openRandomDecision,
    openAINotebook,
    aiNotes,
    refreshAINotes,
    thinkingTasksCount,
    spaceId,
    syncFromServer,
  } = useAppState();

  const [isReclassifying, setIsReclassifying] = useState(false);

  const [selectedItem, setSelectedItem] = useState<SavedItem | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | undefined>();
  const [selectedDistrict, setSelectedDistrict] = useState<string | undefined>();
  const [selectedSmartTag, setSelectedSmartTag] = useState<string | undefined>();
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showCompletedOnly, setShowCompletedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'both' | 'map' | 'cards'>('both');
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);

  // Itinerary state
  const [isItineraryOpen, setIsItineraryOpen] = useState(false);
  const [isSelectedDrawerOpen, setIsSelectedDrawerOpen] = useState(false);
  const [itineraryPlan, setItineraryPlan] = useState<ItineraryPlan | null>(
    null
  );
  const [isGeneratingItinerary, setIsGeneratingItinerary] = useState(false);
  const [transportMode, setTransportMode] = useState<TransportMode>('two-wheeler');
  const [departureTime, setDepartureTime] = useState<string>('10:00');

  // 一鍵由 AI 重新智慧歸類現有店家
  const handleReclassifyPlaces = async () => {
    try {
      setIsReclassifying(true);
      const res = await fetch('/memo/api/places/reclassify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-space-id': spaceId,
        },
        body: JSON.stringify({ forceAll: true }),
      });
      const data = await res.json();
      if (data.success) {
        await syncFromServer();
        addToast({
          type: 'success',
          message: data.message || '已成功重新歸類店家智慧標籤！',
        });
      } else {
        addToast({
          type: 'error',
          message: data.error || '重新歸類失敗',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err?.message || '網路連線異常，請稍後再試',
      });
    } finally {
      setIsReclassifying(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    ensureLocalStorageSchemaVersion();
    setMounted(true);
  }, []);

  // Filter places (strict newest first)
  const rawPlaces = useMemo(() => {
    return (items ?? [])
      .filter((item) => item && item.category === 'place')
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [items]);

  // Count favorite & completed places
  const favoritePlacesCount = useMemo(() => {
    return rawPlaces.filter((p) => p.isFavorite).length;
  }, [rawPlaces]);

  const completedPlacesCount = useMemo(() => {
    return rawPlaces.filter((p) => Boolean(p.isCompleted)).length;
  }, [rawPlaces]);

  // Selected places for itinerary drawer
  const selectedPlaces = useMemo(() => {
    return rawPlaces.filter((p) => (selectedPlaceIds ?? []).includes(p.id));
  }, [rawPlaces, selectedPlaceIds]);

  // 統計目前景點中出現的所有智慧標籤
  const availableSmartTags = useMemo(() => {
    const counts = new Map<string, number>();
    rawPlaces.forEach((p) => {
      const tags = getItemAllTags(p);
      tags.forEach((t) => {
        counts.set(t, (counts.get(t) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [rawPlaces]);

  // Resolve coordinates & search filter
  const resolvedPlaces = useMemo(() => {
    let filtered = showSelectedOnly
      ? rawPlaces.filter((p) => (selectedPlaceIds ?? []).includes(p.id))
      : showFavoritesOnly
      ? rawPlaces.filter((p) => p.isFavorite)
      : showCompletedOnly
      ? rawPlaces.filter((p) => Boolean(p.isCompleted))
      : selectedCity
      ? rawPlaces.filter((p) => {
          const { city, district } = resolvePlaceHierarchy(p);
          if (city !== selectedCity) return false;
          if (selectedDistrict) {
            return cleanDistrictName(district) === cleanDistrictName(selectedDistrict);
          }
          return true;
        })
      : rawPlaces;

    if (selectedSmartTag) {
      const targetTag = selectedSmartTag.trim().toLowerCase();
      filtered = filtered.filter((p) =>
        getItemAllTags(p).some((t) => t.trim().toLowerCase() === targetTag)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((p) => {
        const { city, district } = resolvePlaceHierarchy(p);
        return (
          (p.title || '').toLowerCase().includes(q) ||
          p.summary?.toLowerCase().includes(q) ||
          p.placeInfo?.locationName?.toLowerCase().includes(q) ||
          p.placeInfo?.address?.toLowerCase().includes(q) ||
          (city || '').toLowerCase().includes(q) ||
          (district || '').toLowerCase().includes(q) ||
          (p.tags ?? []).some((t) => typeof t === 'string' && t.toLowerCase().includes(q))
        );
      });
    }

    return filtered.map((place, idx) => {
      let lat = place.placeInfo?.lat;
      let lng = place.placeInfo?.lng;

      if (
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        isNaN(lat) ||
        isNaN(lng)
      ) {
        const fallback = getFallbackCoordinates(
          place.placeInfo?.city || place.placeInfo?.address || place.title,
          `${place.id}-${idx}`
        );
        lat = fallback.lat;
        lng = fallback.lng;
      }

      return {
        ...place,
        lat,
        lng,
        emoji: getPlaceEmoji(place),
      };
    });
  }, [
    rawPlaces,
    selectedCity,
    selectedDistrict,
    selectedSmartTag,
    showSelectedOnly,
    showFavoritesOnly,
    showCompletedOnly,
    selectedPlaceIds,
    searchQuery,
  ]);

  // 下方「私房地點探索牆」瀑布流：直接呈現已過濾的獨立店家卡片，保證數量與上方膠囊 (X) 100% 一致！
  const gridPlaces = resolvedPlaces;

  // Active place object (defaults to first resolved place if none selected)
  const activePlace = useMemo(() => {
    if (resolvedPlaces.length === 0) return null;
    return (
      resolvedPlaces.find((p) => p.id === activePlaceId) || resolvedPlaces[0]
    );
  }, [resolvedPlaces, activePlaceId]);

  // Auto-select first place on mount/filter change
  useEffect(() => {
    if (resolvedPlaces.length > 0) {
      if (!activePlaceId || !resolvedPlaces.some((p) => p.id === activePlaceId)) {
        setActivePlaceId(resolvedPlaces[0].id);
      }
    }
  }, [resolvedPlaces, activePlaceId]);

  function handleSelectPlace(place: ParsedItem) {
    setActivePlaceId(place.id);
  }

  function handleFocusPlace(place: ParsedItem) {
    setActivePlaceId(place.id);
    setIsMapCollapsed(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Google Maps Embed Query string (完整店名 + 完整地址，或聚焦所選地區)
  const activePlaceQuery = useMemo(() => {
    if (activePlace) {
      return (
        activePlace.placeInfo?.googleMapsQuery ||
        `${activePlace.placeInfo?.locationName || activePlace.title} ${
          activePlace.placeInfo?.address || activePlace.placeInfo?.city || ''
        }`
      ).trim();
    }
    if (selectedCity) {
      return `${selectedCity} ${selectedDistrict || ''}`.trim();
    }
    return '';
  }, [activePlace, selectedCity, selectedDistrict]);

  const embedUrl = useMemo(() => {
    if (!activePlaceQuery) return '';
    return `https://www.google.com/maps?q=${encodeURIComponent(
      activePlaceQuery
    )}&hl=zh-TW&z=17&output=embed`;
  }, [activePlaceQuery]);

  const externalMapsUrl = useMemo(() => {
    if (!activePlaceQuery) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      activePlaceQuery
    )}`;
  }, [activePlaceQuery]);

  // 找出最新一筆已完成或正在思考的行程 Note
  const latestItineraryNote = useMemo(() => {
    return (aiNotes ?? []).find((n) => n?.type === 'itinerary');
  }, [aiNotes]);

  // 當背景思考完成時，立即同步到 itineraryPlan 並關閉載入狀態
  useEffect(() => {
    if (!latestItineraryNote) return;

    if (latestItineraryNote.status === 'ready') {
      const plan = normalizeItineraryPlan(latestItineraryNote.resultData);
      if (plan) {
        setItineraryPlan(plan);
      }
      setIsGeneratingItinerary(false);
    } else if (latestItineraryNote.status === 'failed') {
      setIsGeneratingItinerary(false);
      addToast({
        type: 'error',
        message: latestItineraryNote.error || 'AI 行程規劃未完成，請稍後再試',
      });
    }
  }, [latestItineraryNote, addToast]);

  // 當正在規劃行程時，每 2 秒輪詢更新狀態，並設定 45 秒保護逾時避免無限轉圈
  useEffect(() => {
    if (!isGeneratingItinerary) return;
    const interval = setInterval(() => {
      refreshAINotes();
    }, 2000);
    const timer = setTimeout(() => {
      setIsGeneratingItinerary(false);
    }, 45000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [isGeneratingItinerary, refreshAINotes]);

  // 初始化載入既有的最新行程
  useEffect(() => {
    if (!itineraryPlan && latestItineraryNote?.status === 'ready') {
      const plan = normalizeItineraryPlan(latestItineraryNote.resultData);
      if (plan) {
        setItineraryPlan(plan);
      }
    }
  }, [latestItineraryNote, itineraryPlan]);

  async function handleGenerateItinerary(mode: TransportMode = transportMode, time: string = departureTime) {
    setTransportMode(mode);
    setDepartureTime(time);

    // 優先以已跨城市勾選的景點為主；若無選取則以當前篩選清單為主
    const targetPlaces =
      selectedPlaceIds.length >= 1
        ? rawPlaces.filter((p) => selectedPlaceIds.includes(p.id))
        : resolvedPlaces;

    if (targetPlaces.length < 1) {
      addToast({
        type: 'info',
        message: '請至少選擇或收藏 1 個景點以規劃順路行程！',
      });
      return;
    }

    const targetCity = selectedCity || targetPlaces[0]?.placeInfo?.city || '城市';

    setIsGeneratingItinerary(true);
    setIsItineraryOpen(true);

    try {
      // 1. 發起非同步背景思考任務（後端 ~100ms 即回傳，背景非同步運算並於完成後推播通知 iPhone）
      const res = await fetch('/memo/api/ai-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-space-id': spaceId,
        },
        body: JSON.stringify({
          type: 'itinerary',
          spaceId,
          title: `🛵 ${targetCity} 深度順路行程規劃 (${targetPlaces.length} 處地點)`,
          requestParams: {
            places: targetPlaces,
            transportMode: mode,
            departureTime: time,
            city: targetCity,
          },
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '發起背景規劃失敗');
      }

      await refreshAINotes();

      addToast({
        type: 'success',
        message: `🧠 AI 已在背景規劃「${targetCity}順路行程」！完成後會自動存入 AI 記事本並發送 iPhone 推播。`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '生成行程失敗';
      addToast({
        type: 'error',
        message: msg,
      });
      setIsGeneratingItinerary(false);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 space-y-4">
      {/* 頂部極簡標題 + 搜尋輸入列 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-xl md:text-2xl font-bold tracking-tight text-ink">
            📍 景點地圖
          </h1>
          <span
            suppressHydrationWarning
            className="text-xs font-mono text-ink-3 px-2 py-0.5 rounded-full bg-surface border border-line"
          >
            {mounted ? rawPlaces.length : 0} 處
          </span>
        </div>

        <div className="w-full md:w-96">
          <CommandBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
      </div>

      {/* 頂部全寬互動地圖視窗 (精準建築物實景地圖 + 底部橫向小卡片快速點選) */}
      {rawPlaces.length > 0 && (
        <div className="w-full rounded-2xl border border-black/10 bg-surface shadow-xs overflow-hidden transition-all duration-300 space-y-0">
          {/* 地圖頂部整合控制列 */}
          <div className="p-3 sm:px-4 py-2.5 bg-surface border-b border-black/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-sans font-bold text-ink">
              <Compass className="w-4 h-4 text-cat-place shrink-0" />
              <span>私房定位地圖</span>
              {activePlace && (
                <span className="text-[11px] font-normal text-ink-3 truncate max-w-[180px] sm:max-w-md">
                  · {activePlace.placeInfo?.locationName || activePlace.title}
                  {activePlace.placeInfo?.city && ` (${activePlace.placeInfo.city})`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {/* 外部 Google Maps 連結 */}
              {externalMapsUrl && (
                <a
                  href={externalMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-sans text-accent hover:underline inline-flex items-center gap-1"
                >
                  <span>Google 地圖 App ↗</span>
                </a>
              )}

              {/* 展開 / 還原高度按鈕 */}
              {!isMapCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsMapExpanded(!isMapExpanded)}
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-surface-2 hover:bg-surface-3 border border-line text-[11px] font-semibold text-ink-2 hover:text-ink transition-colors cursor-pointer"
                  title={isMapExpanded ? '縮小地圖高度' : '放大大地圖'}
                >
                  <span>{isMapExpanded ? '⤡ 還原高度' : '⤢ 展開地圖'}</span>
                </button>
              )}

              {/* 收合 / 展開開關 */}
              <button
                type="button"
                onClick={() => setIsMapCollapsed(!isMapCollapsed)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-surface-2 hover:bg-surface-3 border border-line text-[11px] font-semibold text-accent hover:underline transition-colors cursor-pointer"
              >
                <span>{isMapCollapsed ? '顯示地圖 ∨' : '收合地圖 ∧'}</span>
              </button>
            </div>
          </div>

          {/* 地圖與景點列表自適應響應式佈局 (電腦版左右並排，手機版地圖在上清單在下) */}
          {!isMapCollapsed && (
            <div className="flex flex-col md:flex-row gap-3 p-2.5 sm:p-3 md:h-[440px]">
              {/* 店家清單列表：手機版為垂直捲動清單 (order-2 max-h-[210px])，電腦版在左側獨立滾動列表 (md:order-1 md:w-80 md:h-full) */}
              {resolvedPlaces.length > 0 && (
                <div className="order-2 md:order-1 flex flex-col gap-2 w-full max-h-[210px] md:max-h-none md:h-full md:w-80 shrink-0 overflow-y-auto overscroll-y-contain pr-1 py-1 md:py-0 md:pr-1.5">
                  {resolvedPlaces.map((place) => {
                    const isActive = activePlace?.id === place.id;
                    const isSelected = selectedPlaceIds.includes(place.id);
                    const locName = place.placeInfo?.locationName || place.title;
                    const city = place.placeInfo?.city;

                    return (
                      <div
                        key={place.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActivePlaceId(place.id);
                          setSelectedItem(place);
                          onSelectItem?.(place);
                          openDetail(place);
                        }}
                        className={cn(
                          'group flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer select-none w-full shrink-0',
                          isActive
                            ? 'bg-surface border-cat-place ring-2 ring-cat-place/30 shadow-xs'
                            : 'bg-surface hover:bg-surface-2 border-black/10 hover:border-black/25'
                        )}
                        title="點擊開啟景點詳細資訊卡並切換地圖焦點"
                      >
                        {/* 縮圖（點擊縮圖開啟詳細資訊卡） */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePlaceId(place.id);
                            setSelectedItem(place);
                            onSelectItem?.(place);
                            openDetail(place);
                          }}
                          className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-black/10 bg-stone-900 cursor-pointer relative group/thumb hover:ring-2 hover:ring-cat-place/50 transition-all active:scale-95"
                          title="點擊縮圖開啟景點詳細資訊卡"
                        >
                          <CoverImage
                            thumbnailUrl={place.thumbnailUrl}
                            title={place.title}
                            category="place"
                            url={place.url}
                            id={place.id}
                            className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                          />
                        </div>

                        {/* 店名與行政區與評分 */}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-sans text-xs font-bold text-ink truncate leading-tight group-hover:text-cat-place transition-colors">
                            {locName}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            {city && (
                              <span className="text-[10px] text-ink-3 truncate">
                                📍 {city}
                              </span>
                            )}
                            {place.placeInfo?.rating && (
                              <span className="text-[10px] font-bold text-amber-600">
                                ★ {place.placeInfo.rating}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 加入行程「＋」/「✓」按鈕 */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectedPlace(place.id);
                          }}
                          className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all cursor-pointer active:scale-90',
                            isSelected
                              ? 'bg-[#3F7D58] text-white shadow-2xs'
                              : 'bg-surface-2 text-ink-2 hover:bg-[#3F7D58]/10 hover:text-[#3F7D58] border border-black/15'
                          )}
                          title={isSelected ? '✓ 已在行程中' : '＋ 加入行程'}
                        >
                          {isSelected ? (
                            <Check className="w-3 h-3 stroke-[3]" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 地圖主體 (Google Maps Embed，手機版 1:1 正方形 aspect-square，電腦版佔據右欄 md:order-2 md:h-full) */}
              <div className="order-1 md:order-2 w-full aspect-square md:aspect-auto md:flex-1 md:h-full rounded-2xl md:rounded-xl overflow-hidden relative bg-surface-2 border border-black/10 shadow-xs">
                {embedUrl ? (
                  <iframe
                    key={activePlace?.id || 'map'}
                    title={activePlace?.title || 'Google Maps'}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={embedUrl}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-surface-2 text-ink-3 text-center">
                    <Compass className="w-6 h-6 text-cat-place mb-2" />
                    <span className="text-xs">請點選景點以載入地圖實景</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 頂部整合控制列（上下兩排緊湊佈局，防溢出白框邊緣） */}
      <div className="w-full max-w-full relative rounded-2xl bg-surface border border-line p-3.5 box-border space-y-2.5">
        {/* 第一排（頂部主控制列）：左側核心篩選，右側快捷操作 */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* 左側：[❤️ 最愛]、[✓ 已選擇]、[📍 選擇地區下拉選單] */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 1. 最前方固定：[❤️ 最愛] */}
            <button
              type="button"
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                setShowSelectedOnly(false);
                setShowCompletedOnly(false);
                setSelectedCity(undefined);
                setSelectedDistrict(undefined);
                setSelectedSmartTag(undefined);
              }}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                showFavoritesOnly
                  ? 'bg-rose-500 text-white border-rose-500 shadow-2xs'
                  : 'bg-surface text-ink-2 border-black/15 hover:border-rose-300'
              )}
            >
              <Heart
                className={cn(
                  'w-3.5 h-3.5',
                  showFavoritesOnly ? 'fill-current' : 'text-rose-500'
                )}
              />
              <span suppressHydrationWarning>最愛 ({mounted ? favoritePlacesCount : 0})</span>
            </button>

            {/* 2. 緊接在最愛旁：[✅ 已選擇] */}
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowSelectedOnly(!showSelectedOnly);
                  setShowFavoritesOnly(false);
                  setShowCompletedOnly(false);
                  setSelectedCity(undefined);
                  setSelectedDistrict(undefined);
                  setSelectedSmartTag(undefined);
                }}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 border',
                  showSelectedOnly
                    ? 'bg-[#3F7D58] text-white border-[#3F7D58] shadow-xs'
                    : selectedPlaces.length > 0
                    ? 'bg-surface text-[#3F7D58] border-[#3F7D58]/40 hover:bg-[#3F7D58]/10'
                    : 'bg-surface text-ink-2 border-black/15 hover:border-[#3F7D58]/40'
                )}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span suppressHydrationWarning>已選擇 ({mounted ? selectedPlaces.length : 0})</span>
              </button>

              {mounted && selectedPlaces.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPlaceIds([]);
                    setShowSelectedOnly(false);
                  }}
                  className="px-2 py-1 rounded-full text-xs font-semibold text-ink-3 hover:text-rose-600 border border-black/15 hover:border-rose-400 bg-surface transition-colors cursor-pointer"
                  title="一鍵清空已選景點"
                >
                  清空
                </button>
              )}
            </div>

            {/* 3. 縣市 ➔ 鄉鎮市區 兩層式階層地區選擇器（觸發膠囊按鈕） */}
            <LocationHierarchyTrigger
              rawPlaces={rawPlaces}
              selectedCity={!showSelectedOnly && !showFavoritesOnly && !showCompletedOnly ? selectedCity : undefined}
              selectedDistrict={!showSelectedOnly && !showFavoritesOnly && !showCompletedOnly ? selectedDistrict : undefined}
              isOpen={isLocationPickerOpen}
              onToggle={() => setIsLocationPickerOpen(!isLocationPickerOpen)}
              onClear={() => {
                setSelectedCity(undefined);
                setSelectedDistrict(undefined);
              }}
            />
          </div>

          {/* 右側：[🎲 幫我決定]、[📋 已選清單]、[✨ AI 順路行程]、[📓 記事本] */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 🎲 幫我決定 (Decide for Me) */}
            <button
              type="button"
              onClick={() => openRandomDecision(resolvedPlaces)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent/15 text-accent hover:bg-accent hover:text-white border border-accent/30 transition-all cursor-pointer shadow-2xs"
              title="從目前篩選的景點中隨機抽選一處！"
            >
              <span>🎲 幫我決定</span>
            </button>

            {selectedPlaces.length > 0 && (
              <button
                type="button"
                onClick={() => setIsSelectedDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#3F7D58] text-white hover:bg-[#346a4a] transition-all cursor-pointer shadow-xs"
              >
                <span>📋 已選清單 ({selectedPlaces.length})</span>
              </button>
            )}

            {(resolvedPlaces.length >= 2 || selectedPlaces.length >= 1) && (
              <Button
                size="sm"
                variant="accent"
                isLoading={isGeneratingItinerary}
                onClick={() => handleGenerateItinerary()}
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                className="bg-[#3F7D58] hover:bg-[#346a4a] text-white border-0 shadow-2xs font-bold text-xs"
              >
                {selectedPlaces.length >= 1
                  ? `AI 順路行程 (${selectedPlaces.length})`
                  : 'AI 順路行程'}
              </Button>
            )}

            {/* 📓 AI 記事本 */}
            <button
              type="button"
              onClick={openAINotebook}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-surface border border-line hover:border-black/30 text-ink transition-all cursor-pointer shadow-2xs relative"
              title="查看所有 AI 背景規劃紀錄與記事本"
            >
              <span>📓 記事本</span>
              {thinkingTasksCount > 0 ? (
                <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
              ) : (
                aiNotes.length > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-surface-2 text-ink-3 border border-line">
                    {aiNotes.length}
                  </span>
                )
              )}
            </button>

            {/* ✨ 重新智慧歸類 */}
            <button
              type="button"
              disabled={isReclassifying}
              onClick={handleReclassifyPlaces}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-surface border border-line hover:border-cat-place/40 text-ink hover:text-cat-place transition-all cursor-pointer shadow-2xs disabled:opacity-50"
              title="由 AI 重新掃描現有地點並產生專屬動態店鋪型態標籤"
            >
              <Sparkles className={cn('w-3.5 h-3.5 text-cat-place', isReclassifying && 'animate-spin')} />
              <span>{isReclassifying ? '歸類中...' : '重新歸類'}</span>
            </button>
          </div>
        </div>

        {/* 4. 📍 地區選擇展開面板（位於第一排正下方，以正常文檔流自然展開，寬度 100%，零裁切） */}
        {isLocationPickerOpen && (
          <LocationHierarchyPanel
            rawPlaces={rawPlaces}
            selectedCity={!showSelectedOnly && !showFavoritesOnly && !showCompletedOnly ? selectedCity : undefined}
            selectedDistrict={!showSelectedOnly && !showFavoritesOnly && !showCompletedOnly ? selectedDistrict : undefined}
            onSelectLocation={(city, district) => {
              setShowSelectedOnly(false);
              setShowFavoritesOnly(false);
              setShowCompletedOnly(false);
              setSelectedCity(city);
              setSelectedDistrict(district);
              setIsLocationPickerOpen(false);
            }}
            onClose={() => setIsLocationPickerOpen(false)}
          />
        )}

        {/* 第二排：動態智慧標籤列（支援橫向滑動、‹ › 箭頭、滑鼠滾輪橫向捲動與 🏷️ 全部標籤總覽） */}
        <div className="w-full pt-2 border-t border-line/60">
          <SmartTagFilterBar
            tags={availableSmartTags}
            selectedTag={selectedSmartTag}
            onSelectTag={(tag) => setSelectedSmartTag(tag)}
            totalCount={rawPlaces.length}
            title="動態智慧標籤"
            themeColor="place"
            allLabel="全部景點"
            onClearOtherFilters={() => {
              setShowFavoritesOnly(false);
              setShowSelectedOnly(false);
              setShowCompletedOnly(false);
              setSelectedCity(undefined);
              setSelectedDistrict(undefined);
            }}
          />
        </div>
      </div>

      {rawPlaces.length === 0 ? (
        <EmptyState
          icon={<Compass className="w-6 h-6 text-cat-place" />}
          title="尚無景點或探店收藏"
          description="在上方輸入框貼上 Instagram 景點 Reels、咖啡廳、酒吧或米其林餐廳網址，Memo 會自動為您定位並標記在地圖上！"
        />
      ) : showSelectedOnly && resolvedPlaces.length === 0 ? (
        <EmptyState
          icon={<Check className="w-6 h-6 text-[#3F7D58]" />}
          title="尚未勾選任何景點"
          description="在景點卡片點擊右下角「＋」即可加入行程，在此集中查看已選清單並一鍵規劃 AI 順路行程！"
          actionLabel="瀏覽全部景點"
          onAction={() => setShowSelectedOnly(false)}
        />
      ) : showFavoritesOnly && resolvedPlaces.length === 0 ? (
        <EmptyState
          icon={<Heart className="w-6 h-6 text-rose-500" />}
          title="尚無最愛景點收藏"
          description="點擊景點卡片右上角的愛心圖示，即可將喜愛的私房景點加入最愛收藏！"
          actionLabel="瀏覽全部景點"
          onAction={() => setShowFavoritesOnly(false)}
        />
      ) : (
        /* 全寬私房地點探索牆（雙大欄獨立瀑布流，無側邊擠壓） */
        <div className="w-full space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-black/10">
            <h2 className="font-display text-sm sm:text-base font-bold text-ink flex items-center gap-2">
              <span>📍 私房地點探索牆</span>
              <span className="text-xs font-mono text-ink-3 font-normal">
                ({gridPlaces.length} 處地點)
              </span>
            </h2>
            <span className="text-xs text-ink-3 font-sans hidden sm:inline">
              💡 點擊右下角「＋」加入行程，點擊「📍 地名」於頂部地圖定位
            </span>
          </div>

          <FeedGrid
            items={gridPlaces}
            isLoading={isLoading}
            viewMode="grid"
            onFocusPlace={handleFocusPlace}
            onSelect={(item) => {
              setSelectedItem(item);
              onSelectItem?.(item);
            }}
          />
        </div>
      )}

      {/* 浮動「📋 已選清單 (X)」按鈕 (Selected Places Floating Pill) */}
      {selectedPlaces.length > 0 && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-8 z-40">
          <button
            type="button"
            onClick={() => setIsSelectedDrawerOpen(true)}
            className="group relative inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#3F7D58] text-white text-sm font-bold shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border border-emerald-400/50"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <span>📋 已選清單 ({selectedPlaces.length})</span>
          </button>
        </div>
      )}

      {/* 已選景點抽屜 (Selected Places Drawer) */}
      <SelectedPlacesDrawer
        isOpen={isSelectedDrawerOpen}
        onClose={() => setIsSelectedDrawerOpen(false)}
        selectedPlaces={selectedPlaces}
        onRemovePlace={(id) => {
          setSelectedPlaceIds(selectedPlaceIds.filter((pId) => pId !== id));
        }}
        onClearAll={() => setSelectedPlaceIds([])}
        initialTransportMode={transportMode}
        initialDepartureTime={departureTime}
        onGenerateItinerary={(mode, time) => {
          setIsSelectedDrawerOpen(false);
          handleGenerateItinerary(mode, time);
        }}
        isGeneratingItinerary={isGeneratingItinerary}
      />

      {/* AI Itinerary Slide-over Sheet */}
      <ItinerarySheet
        isOpen={isItineraryOpen}
        onClose={() => setIsItineraryOpen(false)}
        plan={itineraryPlan}
        isLoading={isGeneratingItinerary}
        onRegenerate={(mode, time) => handleGenerateItinerary(mode, time)}
      />

      {renderDetailDrawer && (
        <DetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
