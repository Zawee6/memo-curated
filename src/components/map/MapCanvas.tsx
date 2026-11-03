'use client';

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ParsedItem } from '@/types/item';
import { createEditorialPinIcon } from './MapPin';
import { useAppState } from '@/providers/AppStateProvider';

function createPopupElement({
  place,
  isSelected,
  onToggleSelected,
  onOpenDetail,
  onSwitchToEmbed,
}: {
  place: ParsedItem & { lat: number; lng: number; emoji: string };
  isSelected: boolean;
  onToggleSelected: (id: string) => void;
  onOpenDetail: (place: ParsedItem) => void;
  onSwitchToEmbed?: (place: ParsedItem) => void;
}): HTMLElement {
  const container = document.createElement('div');
  container.className = 'p-1 space-y-2.5 max-w-[240px] select-none text-ink';

  // 1. 封面縮圖
  if (place.thumbnailUrl) {
    const thumbDiv = document.createElement('div');
    thumbDiv.className =
      'w-full h-24 rounded-lg overflow-hidden border border-line relative cursor-pointer group bg-stone-900';
    const proxySrc =
      place.thumbnailUrl.startsWith('/') || place.thumbnailUrl.includes('ytimg.com')
        ? (place.thumbnailUrl.startsWith('/memo/') ? place.thumbnailUrl : `/memo${place.thumbnailUrl}`)
        : `/memo/api/image-proxy?url=${encodeURIComponent(place.thumbnailUrl)}&postUrl=${encodeURIComponent(place.url || '')}&id=${encodeURIComponent(place.id)}`;

    thumbDiv.innerHTML = `
      <img src="${proxySrc}" alt="${place.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      ${
        isSelected
          ? '<div class="absolute top-1.5 right-1.5 z-10"><span class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#3F7D58] text-white shadow-sm">✓ 已在行程</span></div>'
          : ''
      }
    `;
    thumbDiv.onclick = (e) => {
      e.stopPropagation();
      onOpenDetail(place);
    };
    container.appendChild(thumbDiv);
  }

  // 2. 資訊標題與評分
  const infoDiv = document.createElement('div');
  infoDiv.className = 'space-y-1 cursor-pointer';
  const locName = place.placeInfo?.locationName || place.title;
  const ratingHtml = place.placeInfo?.rating
    ? `<div class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-300/40"><span>★ ${place.placeInfo.rating}</span></div>`
    : '';
  const mustTryHtml =
    place.placeInfo?.mustTryDishes && place.placeInfo.mustTryDishes.length > 0
      ? `<div class="text-[10px] text-ink-2 bg-stone-100 dark:bg-stone-800 p-1.5 rounded"><span class="font-bold text-[#E07A5F] block">🍽️ 必吃推薦：</span><span>${place.placeInfo.mustTryDishes.slice(0, 3).join('、')}</span></div>`
      : '';

  infoDiv.innerHTML = `
    <div class="flex items-center justify-between gap-1">
      <h4 class="text-xs font-bold text-ink truncate">${locName}</h4>
    </div>
    ${ratingHtml}
    <p class="text-[11px] text-ink-2 line-clamp-2 leading-relaxed">${place.summary || ''}</p>
    ${mustTryHtml}
  `;
  infoDiv.onclick = (e) => {
    e.stopPropagation();
    onOpenDetail(place);
  };
  container.appendChild(infoDiv);

  // 3. 操作功能列
  const actionDiv = document.createElement('div');
  actionDiv.className = 'pt-2 border-t border-line flex flex-col gap-1.5';

  // 待排行程加入/移除按鈕
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = `w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer shadow-xs ${
    isSelected
      ? 'bg-[#3F7D58] text-white border border-emerald-300'
      : 'bg-surface text-ink hover:bg-surface-2 border border-line'
  }`;
  toggleBtn.innerHTML = isSelected
    ? '<span>✓ 已在待排行程（點擊取消）</span>'
    : '<span>＋ 加入待排行程</span>';
  toggleBtn.onclick = (e) => {
    e.stopPropagation();
    onToggleSelected(place.id);
  };
  actionDiv.appendChild(toggleBtn);

  // 切換至 Google Maps 實景嵌入按鈕
  if (onSwitchToEmbed) {
    const embedBtn = document.createElement('button');
    embedBtn.type = 'button';
    embedBtn.className =
      'w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-surface-2 text-ink hover:bg-surface border border-line transition-all cursor-pointer';
    embedBtn.innerHTML = '<span>🏛️ 切換至 Google Maps 實景</span>';
    embedBtn.onclick = (e) => {
      e.stopPropagation();
      onSwitchToEmbed(place);
    };
    actionDiv.appendChild(embedBtn);
  }

  // 詳情卡片與外開連結
  const footerDiv = document.createElement('div');
  footerDiv.className = 'flex items-center justify-between text-[11px] text-ink-3 pt-0.5';

  const detailLink = document.createElement('button');
  detailLink.type = 'button';
  detailLink.className = 'hover:text-accent hover:underline cursor-pointer text-xs';
  detailLink.innerText = '查看詳情卡片';
  detailLink.onclick = (e) => {
    e.stopPropagation();
    onOpenDetail(place);
  };
  footerDiv.appendChild(detailLink);

  if (place.placeInfo?.googleMapsQuery || place.placeInfo?.address) {
    const gmapsQuery =
      place.placeInfo?.googleMapsQuery ||
      `${place.placeInfo?.locationName || place.title} ${place.placeInfo?.city || ''}`;
    const appLink = document.createElement('a');
    appLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      gmapsQuery
    )}`;
    appLink.target = '_blank';
    appLink.rel = 'noopener noreferrer';
    appLink.className = 'hover:text-ink flex items-center gap-0.5 text-xs text-accent font-medium';
    appLink.innerText = '地圖 App ↗';
    appLink.onclick = (e) => e.stopPropagation();
    footerDiv.appendChild(appLink);
  }

  actionDiv.appendChild(footerDiv);
  container.appendChild(actionDiv);
  return container;
}

export function MapCanvas({
  places,
  activePlaceId,
  flyTarget,
  onSelectPlace,
  onSwitchToEmbed,
}: {
  places: Array<ParsedItem & { lat: number; lng: number; emoji: string }>;
  activePlaceId: string | null;
  flyTarget: { lat: number; lng: number } | null;
  onSelectPlace: (place: ParsedItem & { lat: number; lng: number }) => void;
  onSwitchToEmbed?: (place: ParsedItem) => void;
}) {
  const { openDetail, selectedPlaceIds, toggleSelectedPlace } = useAppState();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // 1. 初始化 Leaflet 原生地圖實例（嚴格檢查並清理舊實例，杜絕 React 19 與 Fast Refresh 重複附加錯誤）
  useEffect(() => {
    if (!containerRef.current) return;

    // 清理殘留的 Leaflet DOM 標記
    if ((containerRef.current as any)._leaflet_id) {
      delete (containerRef.current as any)._leaflet_id;
    }

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const defaultCenter: [number, number] =
      places.length > 0 ? [places[0].lat, places[0].lng] : [24.1477, 120.6736];

    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom: 13,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    // 正宗 Google Maps 繁體中文街道圖磚，無灰暗濾鏡
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&hl=zh-TW&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '&copy; Google Maps',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    mapRef.current = map;
    layerGroupRef.current = layerGroup;

    // 延遲更新以適應父容器 layout
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      if (containerRef.current) {
        delete (containerRef.current as any)._leaflet_id;
      }
    };
  }, []);

  // 2. 當景點列表或選取狀態改變時，僅更新 layerGroup 中的標記（絕對不銷毀重整地圖實例）
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    if (places.length === 0) return;

    places.forEach((place) => {
      const isActive = activePlaceId === place.id;
      const isSelected = selectedPlaceIds.includes(place.id);
      const icon = createEditorialPinIcon(
        place.placeInfo?.locationName || place.title,
        place.emoji,
        isActive
      );

      const marker = L.marker([place.lat, place.lng], { icon });

      marker.on('click', () => {
        onSelectPlace(place);
      });

      const popupEl = createPopupElement({
        place,
        isSelected,
        onToggleSelected: toggleSelectedPlace,
        onOpenDetail: openDetail,
        onSwitchToEmbed,
      });

      marker.bindPopup(popupEl, {
        className: 'custom-editorial-popup',
        maxWidth: 260,
      });

      layerGroup.addLayer(marker);
    });

    // 自動縮放邊界
    if (!flyTarget) {
      if (places.length === 1) {
        map.setView([places[0].lat, places[0].lng], 15);
      } else if (places.length > 1) {
        const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      }
    }
  }, [
    places,
    activePlaceId,
    selectedPlaceIds,
    onSelectPlace,
    openDetail,
    onSwitchToEmbed,
    toggleSelectedPlace,
    flyTarget,
  ]);

  // 3. 處理平滑聚焦飛行
  useEffect(() => {
    if (!flyTarget || !mapRef.current) return;
    mapRef.current.flyTo([flyTarget.lat, flyTarget.lng], 16, { duration: 1.2 });
  }, [flyTarget]);

  return (
    <div className="relative w-full h-full min-h-0">
      <div
        ref={containerRef}
        className="w-full h-full relative z-0"
        style={{ minHeight: '100%' }}
      />
    </div>
  );
}
