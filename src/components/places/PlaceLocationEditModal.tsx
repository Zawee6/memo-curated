'use client';

import React, { useState, useEffect } from 'react';
import { X, MapPin, Check } from 'lucide-react';
import { SavedItem } from '@/types/item';
import { useAppState } from '@/providers/AppStateProvider';
import {
  TAIWAN_LOCATION_HIERARCHY,
  standardizeCityName,
  getDistrictsForCity,
  cleanDistrictName,
  resolvePlaceHierarchy,
} from '@/lib/taiwanLocations';

interface PlaceLocationEditModalProps {
  item: SavedItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PlaceLocationEditModal({
  item,
  isOpen,
  onClose,
}: PlaceLocationEditModalProps) {
  const { updateItemPlaceLocation } = useAppState();

  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [customDistrict, setCustomDistrict] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (item && isOpen) {
      const hierarchy = resolvePlaceHierarchy({
        placeInfo: item.placeInfo,
        title: item.title,
        tags: item.tags,
        summary: item.summary,
      });

      const city = hierarchy.city || '嘉義';
      const district = hierarchy.district || '';
      setSelectedCity(city);

      const available = getDistrictsForCity(city).map(cleanDistrictName);
      if (district && available.includes(district)) {
        setSelectedDistrict(district);
        setCustomDistrict('');
      } else if (district) {
        setSelectedDistrict('custom');
        setCustomDistrict(district);
      } else {
        setSelectedDistrict('');
        setCustomDistrict('');
      }
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const availableDistricts = getDistrictsForCity(selectedCity).map(cleanDistrictName);

  async function handleSave() {
    if (!item) return;
    setIsSaving(true);
    try {
      const finalDistrict =
        selectedDistrict === 'custom' ? customDistrict.trim() : selectedDistrict.trim();
      await updateItemPlaceLocation(item.id, selectedCity, finalDistrict);
      onClose();
    } catch (e) {
      console.error('Failed to update place location:', e);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-surface rounded-2xl border border-line shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cat-place/10 text-cat-place">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">修改店家所在地區</h3>
              <p className="text-xs text-ink-3 truncate max-w-[240px]">
                {item.placeInfo?.locationName || item.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-sm">
          {/* 縣市選擇 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-2">
              第一層：所在縣市
            </label>
            <select
              value={selectedCity}
              onChange={(e) => {
                const nextCity = e.target.value;
                setSelectedCity(nextCity);
                setSelectedDistrict('');
                setCustomDistrict('');
              }}
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-line text-ink font-medium focus:outline-none focus:ring-2 focus:ring-cat-place/30 focus:border-cat-place transition-all"
            >
              {TAIWAN_LOCATION_HIERARCHY.map((group) => (
                <option key={group.city} value={group.city}>
                  {group.city} ({group.region})
                </option>
              ))}
            </select>
          </div>

          {/* 鄉鎮市區選擇 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-ink-2">
              第二層：鄉鎮市區 / 商圈
            </label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-line text-ink font-medium focus:outline-none focus:ring-2 focus:ring-cat-place/30 focus:border-cat-place transition-all"
            >
              <option value="">-- 未指定具體鄉鎮市區 --</option>
              {availableDistricts.map((dist) => (
                <option key={dist} value={dist}>
                  {dist}
                </option>
              ))}
              <option value="custom">✏️ 自訂其他鄉鎮/商圈名稱...</option>
            </select>
          </div>

          {/* 自訂鄉鎮市區輸入框 */}
          {selectedDistrict === 'custom' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="block text-xs font-medium text-ink-3">
                自訂鄉鎮市區或商圈名稱
              </label>
              <input
                type="text"
                placeholder="例如：文化路夜市、內湖科學園區..."
                value={customDistrict}
                onChange={(e) => setCustomDistrict(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-line text-ink font-medium placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-cat-place/30 focus:border-cat-place transition-all"
                autoFocus
              />
            </div>
          )}

          {/* 目前地址預覽 */}
          {item.placeInfo?.address && (
            <div className="p-2.5 rounded-xl bg-surface-2/60 border border-line text-xs text-ink-3">
              <span className="font-semibold text-ink-2">目前登記地址：</span>
              <span className="break-all ml-1">{item.placeInfo.address}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line bg-surface-2/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-ink-2 hover:bg-surface-2 border border-line transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cat-place text-white hover:opacity-90 transition-opacity cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? '儲存中...' : '確認更新'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
