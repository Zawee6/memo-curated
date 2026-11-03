'use client';

import React, { useState, useEffect } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { ItineraryPlan, TransportMode, ParsedItem } from '@/types/item';
import { useAppState } from '@/providers/AppStateProvider';
import { CoverImage } from '@/components/feed/CoverImage';
import { Button } from '@/components/ui/Button';
import {
  Sparkles,
  Compass,
  Clock,
  Navigation,
  Lightbulb,
  Share2,
  Check,
  RotateCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import {
  cleanFloor,
  mapToGoogleTravelMode,
  buildGoogleMapsMultiStopUrl,
  buildGoogleMapsSingleStopUrl,
  buildSegmentDirectionUrl,
  generateItineraryExportText,
  generateItineraryExportHtml,
  writeRichTextToClipboard,
} from '@/lib/itineraryFormatter';
import { renderTextWithLinks } from '@/lib/renderLinks';

export {
  cleanFloor,
  mapToGoogleTravelMode,
  buildGoogleMapsMultiStopUrl,
  buildGoogleMapsSingleStopUrl,
  buildSegmentDirectionUrl,
  generateItineraryExportText,
  generateItineraryExportHtml,
  writeRichTextToClipboard,
};

const TRANSPORT_MODES: { key: TransportMode; label: string; icon: string; desc: string }[] = [
  { key: 'two-wheeler', label: '🛵 機車', icon: '🛵', desc: '巷弄穿梭' },
  { key: 'driving', label: '🚗 開車', icon: '🚗', desc: '含停車建議' },
  { key: 'transit', label: '🚌 大眾運輸', icon: '🚌', desc: '公車與捷運' },
  { key: 'walking', label: '🚶 步行', icon: '🚶', desc: '街區漫步' },
];

const DEPARTURE_PRESETS = [
  { time: '10:00', label: '10:00 早午餐' },
  { time: '14:00', label: '14:00 下午茶' },
  { time: '09:00', label: '09:00 早鳥' },
];

interface ItinerarySheetProps {
  isOpen: boolean;
  onClose: () => void;
  plan: ItineraryPlan | null;
  isLoading: boolean;
  onRegenerate?: (mode: TransportMode, departureTime: string) => void;
}

export function ItinerarySheet({
  isOpen,
  onClose,
  plan,
  isLoading,
  onRegenerate,
}: ItinerarySheetProps) {
  const { items, openDetail, addToast } = useAppState();
  const [copied, setCopied] = useState(false);

  // Quick settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<TransportMode>(
    plan?.transportMode || 'two-wheeler'
  );
  const [selectedTime, setSelectedTime] = useState<string>(
    plan?.departureTime || '10:00'
  );

  useEffect(() => {
    if (plan?.transportMode) setSelectedMode(plan.transportMode);
    if (plan?.departureTime) setSelectedTime(plan.departureTime);
  }, [plan?.transportMode, plan?.departureTime]);

  const fullNavUrl = plan
    ? buildGoogleMapsMultiStopUrl(plan.stops ?? [], plan.city, plan.transportMode)
    : '';

  // 存入 Apple 備忘錄（呼叫 Memo清單 捷徑，富文本保留藍色超連結）
  async function handleSaveToAppleNotes() {
    if (!plan) return;
    const exportText = generateItineraryExportText(plan);
    const exportHtml = generateItineraryExportHtml(plan);
    try {
      await writeRichTextToClipboard(exportHtml, exportText);
      addToast({
        type: 'success',
        message: '📋 已複製富文本行程！正在開啟 Apple 捷徑存入備忘錄...',
      });
      if (typeof window !== 'undefined') {
        window.location.href = `shortcuts://run-shortcut?name=Memo%E6%B8%85%E5%96%AE&input=text&text=${encodeURIComponent(
          exportText
        )}`;
      }
    } catch (e) {
      console.warn('Failed to copy or trigger shortcut:', e);
      addToast({
        type: 'info',
        message: '已準備行程內容，請手動貼至備忘錄',
      });
    }
  }

  // 複製完整行程文字（富文本保留藍色超連結）
  async function handleCopyItineraryText() {
    if (!plan) return;
    const exportText = generateItineraryExportText(plan);
    const exportHtml = generateItineraryExportHtml(plan);
    try {
      await writeRichTextToClipboard(exportHtml, exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      addToast({
        type: 'success',
        message: '✓ 已複製富文本行程至剪貼簿！貼至備忘錄可保留藍色導航連結。',
      });
    } catch {
      addToast({
        type: 'error',
        message: '複製失敗，請手動選取文字',
      });
    }
  }

  // Find corresponding SavedItem from database
  function findMatchedPlace(stop: ItineraryPlan['stops'][0]): ParsedItem | undefined {
    if (stop.placeId) {
      const byId = items.find((i) => i.id === stop.placeId);
      if (byId) return byId;
    }
    const cleanName = cleanFloor(stop.placeName).toLowerCase();
    return items.find((i) => {
      if (i.category !== 'place') return false;
      const titleClean = cleanFloor(i.title).toLowerCase();
      const locClean = cleanFloor(i.placeInfo?.locationName || '').toLowerCase();
      return (
        titleClean.includes(cleanName) ||
        cleanName.includes(titleClean) ||
        (locClean && (locClean.includes(cleanName) || cleanName.includes(locClean)))
      );
    });
  }

  const modeObj = TRANSPORT_MODES.find((m) => m.key === (plan?.transportMode || selectedMode));

  // 快捷操作按鈕組（最上方與最下方共用）
  const renderActionButtons = () => (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* 📲 存入 Apple 備忘錄（呼叫 Memo清單 捷徑） */}
        <button
          type="button"
          onClick={handleSaveToAppleNotes}
          className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow-xs active:scale-[0.99] transition-all cursor-pointer"
        >
          <span className="text-sm">📲</span>
          <span>存入 Apple 備忘錄 (呼叫捷徑)</span>
        </button>

        {/* 📋 複製完整行程文字 */}
        <button
          type="button"
          onClick={handleCopyItineraryText}
          className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#3F7D58] hover:bg-[#346a4a] text-white font-bold text-xs shadow-xs active:scale-[0.99] transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-white" />
              <span>✓ 已複製完整行程文字！</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-white" />
              <span>📋 複製完整行程文字</span>
            </>
          )}
        </button>
      </div>

      {/* 🗺️ Google Maps 多點導航 */}
      {fullNavUrl && (
        <a
          href={fullNavUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#2D60FF] hover:bg-[#1E4FE6] text-white font-bold text-xs shadow-xs active:scale-[0.99] transition-all cursor-pointer text-center"
        >
          <Navigation className="w-3.5 h-3.5 text-white" />
          <span>🗺️ 在 Google Maps 開啟多點連貫導航</span>
        </a>
      )}
    </div>
  );

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={plan?.title || 'AI 一日漫遊行程規劃'}
      description={plan?.city ? `探訪城市：${plan.city}` : '順路排程與交通串連'}
    >
      <div className="space-y-5 pb-8">
        {isLoading && !plan ? (
          <div className="py-20 text-center space-y-4">
            <div className="inline-flex p-3.5 rounded-full bg-[#3F7D58]/15 text-[#3F7D58] animate-pulse">
              <Sparkles className="w-7 h-7 animate-spin" />
            </div>
            <p className="font-display text-base font-bold text-ink">
              正在為您串連最順暢的城市深度路線...
            </p>
            <p className="text-xs text-ink-3 max-w-sm mx-auto leading-relaxed">
              考量交通方式、店家營業時段、特色必點招牌與最佳停留時間
            </p>
          </div>
        ) : plan ? (
          <>
            {/* 若背景正在重新排程，以頂部輕量狀態條提示，不遮擋既有內容 */}
            {isLoading && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-800 animate-pulse font-medium">
                <Sparkles className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
                <span>AI 正在背景為您重新規劃最新路線...</span>
              </div>
            )}

            {/* 頂部交通方式與出發時間狀態列 (支援快速展開修改並重新規劃) */}
            <div className="p-3.5 rounded-xl bg-surface-2 border border-line space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-ink flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-[#3F7D58]/15 text-[#3F7D58] font-mono">
                    {modeObj?.label || '🛵 機車'}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-surface border border-line text-ink-2 font-mono">
                    ⏰ {plan.departureTime || '10:00'} 出發
                  </span>
                  <span className="text-[11px] text-ink-3 font-normal">
                    · 共 {(plan.stops ?? []).length} 站
                  </span>
                </div>

                {onRegenerate && (
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3F7D58] hover:underline cursor-pointer"
                  >
                    <span>{isSettingsOpen ? '收合設定' : '變更交通/時間'}</span>
                    {isSettingsOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {/* 展開之交通與時間快速重新排程區塊 */}
              {isSettingsOpen && onRegenerate && (
                <div className="pt-2 border-t border-line/60 space-y-3">
                  {/* 交通方式 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-ink-3">交通方式</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {TRANSPORT_MODES.map((mode) => {
                        const active = selectedMode === mode.key;
                        return (
                          <button
                            key={mode.key}
                            type="button"
                            onClick={() => setSelectedMode(mode.key)}
                            className={cn(
                              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border text-left cursor-pointer',
                              active
                                ? 'bg-[#3F7D58] text-white border-[#3F7D58] shadow-2xs'
                                : 'bg-surface text-ink-2 border-line hover:border-black/30'
                            )}
                          >
                            <span>{mode.icon}</span>
                            <span className="truncate">{mode.label.replace(/^[^\s]+\s*/, '')}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 出發時間 */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-ink-3">出發時間</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {DEPARTURE_PRESETS.map((preset) => (
                        <button
                          key={preset.time}
                          type="button"
                          onClick={() => setSelectedTime(preset.time)}
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer',
                            selectedTime === preset.time
                              ? 'bg-ink text-surface border-ink'
                              : 'bg-surface text-ink-2 border-line hover:border-black/30'
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                      <input
                        type="time"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="px-2 py-1 text-xs rounded-full border border-line bg-surface text-ink font-mono focus:outline-none focus:ring-1 focus:ring-[#3F7D58]"
                      />
                    </div>
                  </div>

                  {/* 重新規劃按鈕 */}
                  <div className="pt-1 flex justify-end">
                    <Button
                      size="sm"
                      variant="accent"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onRegenerate(selectedMode, selectedTime);
                      }}
                      leftIcon={<RotateCw className="w-3.5 h-3.5" />}
                      className="bg-[#3F7D58] hover:bg-[#346a4a] text-white font-bold text-xs"
                    >
                      依新設定重新規劃行程
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 頂部快捷操作按鈕組 */}
            {renderActionButtons()}

            {/* 一日動線概述卡片 */}
            <div className="p-4 rounded-xl bg-surface-2 border border-line space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#3F7D58] tracking-wider font-mono">
                <Compass className="w-3.5 h-3.5" />
                <span>一日動線概述</span>
              </div>
              <p className="text-xs md:text-sm text-ink-2 leading-relaxed">
                {plan.dayOverview}
              </p>
            </div>

            {/* 垂直行程時間軸 (Vertical Timeline) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-ink-3 uppercase tracking-wider font-mono">
                  行程時間軸（共 {(plan.stops ?? []).length} 站）
                </h4>
                <span className="text-[11px] text-ink-3">
                  💡 點擊店家卡片可查看詳細資訊
                </span>
              </div>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#3F7D58]/20">
                {(plan.stops ?? []).map((stop, idx) => {
                  const matchedItem = findMatchedPlace(stop);
                  const stopsList = plan.stops ?? [];
                  const isLast = idx === stopsList.length - 1;
                  const nextStop = !isLast ? stopsList[idx + 1] : null;
                  const singleNavUrl = stop.placeMapUrl || buildGoogleMapsSingleStopUrl(stop, plan.city);
                  const segmentNavUrl = nextStop
                    ? buildSegmentDirectionUrl(stop, nextStop, plan.transportMode, plan.city)
                    : '';

                  return (
                    <div key={idx} className="relative space-y-3">
                      {/* Timeline Node Badge */}
                      <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-surface border-2 border-[#3F7D58] flex items-center justify-center text-[10px] font-mono font-bold text-[#3F7D58] shadow-xs">
                        {idx + 1}
                      </div>

                      {/* Stop Header: Time Slot + Stay Duration + Address */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#3F7D58] bg-[#3F7D58]/10 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3" />
                            <span>{stop.timeSlot}</span>
                          </span>
                          {stop.stayDuration && (
                            <span className="text-[11px] font-mono font-semibold text-amber-800 bg-amber-500/15 px-2 py-0.5 rounded-md">
                              ⏳ 建議停留 {stop.stayDuration}
                            </span>
                          )}
                          {stop.address && (
                            <a
                              href={stop.placeMapUrl || singleNavUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-ink-3 hover:text-ink hover:underline truncate max-w-[220px]"
                              title="在 Google Maps 查看地址"
                            >
                              📍 {stop.address}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Place Info Card */}
                      <div
                        onClick={(e) => {
                          if (matchedItem) {
                            e.preventDefault();
                            e.stopPropagation();
                            openDetail(matchedItem);
                          }
                        }}
                        className={cn(
                          'group flex items-start gap-3 p-3 rounded-xl border border-line bg-surface transition-all select-none',
                          matchedItem ? 'cursor-pointer hover:border-cat-place/40 hover:bg-surface-2/60' : ''
                        )}
                      >
                        {/* 縮圖（點擊縮圖開啟詳細資訊卡） */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            if (matchedItem) {
                              openDetail(matchedItem);
                            }
                          }}
                          className={cn(
                            'w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-black/10 bg-stone-900',
                            matchedItem ? 'cursor-pointer group/thumb hover:ring-2 hover:ring-[#3F7D58]/50 transition-all active:scale-95' : ''
                          )}
                          title={matchedItem ? '點擊縮圖開啟景點詳細資訊卡' : undefined}
                        >
                          <CoverImage
                            thumbnailUrl={stop.thumbnailUrl || matchedItem?.thumbnailUrl}
                            title={stop.placeName}
                            category="place"
                            url={matchedItem?.url || ''}
                            id={matchedItem?.id}
                            className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                          />
                        </div>

                        {/* 名稱與連結 */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="font-display text-sm font-bold text-ink truncate group-hover:text-[#3F7D58] transition-colors">
                              <a
                                href={stop.placeMapUrl || singleNavUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="hover:underline flex items-center gap-1"
                                title="在 Google Maps 開啟此店家"
                              >
                                <span className="truncate">{stop.placeName}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-60 text-ink-3" />
                              </a>
                            </h5>
                            {matchedItem && (
                              <span className="text-[10px] text-[#3F7D58] font-bold shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                <span>看詳情</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </div>

                          {matchedItem?.placeInfo?.rating && (
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-bold text-amber-600">
                                ★ {matchedItem.placeInfo.rating}
                              </span>
                              {matchedItem.placeInfo.city && (
                                <span className="text-ink-3">· {matchedItem.placeInfo.city}</span>
                              )}
                            </div>
                          )}

                          <div className="pt-0.5">
                            <a
                              href={singleNavUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2D60FF] hover:underline"
                            >
                              <Navigation className="w-3 h-3" />
                              <span>Google 地圖定位 ↗</span>
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* 🍽️ 必吃必訪重點 (whatToDo / activity) */}
                      {(stop.whatToDo || stop.activity) && (
                        <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 space-y-1">
                          <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                            <span>🍽️ 必吃必訪重點</span>
                          </div>
                          <div className="text-xs text-ink-2 leading-relaxed">
                            {renderTextWithLinks(stop.whatToDo || stop.activity)}
                          </div>
                        </div>
                      )}

                      {/* 🅿️ 附近停車場建議 (若為開車或騎車模式) */}
                      {(stop.parkingName || stop.parkingInfo) && (
                        <div className="p-2.5 rounded-xl bg-blue-500/8 border border-blue-500/20 space-y-1">
                          <div className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5 flex-wrap">
                            <span>🅿️ 推薦停車：</span>
                            {stop.parkingName ? (
                              <a
                                href={
                                  stop.parkingMapUrl ||
                                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                    `${plan.city || ''} ${stop.parkingName}`
                                  )}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 font-bold underline hover:opacity-80 inline-flex items-center gap-0.5"
                                title="在 Google Maps 搜尋此停車場"
                              >
                                <span>{stop.parkingName}</span>
                                <span className="text-[10px]">↗</span>
                              </a>
                            ) : null}
                            {stop.parkingNote && (
                              <span className="text-blue-700/80 font-normal">
                                ({stop.parkingNote})
                              </span>
                            )}
                          </div>
                          {stop.parkingInfo && stop.parkingInfo !== stop.parkingName && (
                            <div className="text-xs text-ink-2 leading-relaxed">
                              {renderTextWithLinks(stop.parkingInfo)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 🚆 大眾運輸搭乘方式 (若為大眾運輸模式) */}
                      {stop.transitDetail && (
                        <div className="p-2.5 rounded-xl bg-purple-500/8 border border-purple-500/20 space-y-1">
                          <div className="text-[11px] font-bold text-purple-900 flex items-center gap-1.5">
                            <span>🚆 大眾運輸搭乘方式</span>
                          </div>
                          <div className="text-xs text-ink-2 leading-relaxed">
                            {renderTextWithLinks(stop.transitDetail)}
                          </div>
                        </div>
                      )}

                      {/* 💡 貼心提醒 (tips) */}
                      {stop.tips && (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-2 border border-line text-xs text-ink-2 leading-relaxed">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div>{renderTextWithLinks(stop.tips)}</div>
                        </div>
                      )}

                      {/* 站與站之間的「交通串連卡 (Transit Connection)」 */}
                      {!isLast && (stop.transitToNext || stop.transitSuggestion) && (
                        <div className="pt-1 pb-2">
                          <div className="p-2.5 rounded-xl bg-emerald-500/8 border border-[#3F7D58]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-start sm:items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">
                                {modeObj?.icon || '🛵'}
                              </span>
                              <div className="text-xs text-ink leading-relaxed">
                                <span className="font-bold text-[#3F7D58]">
                                  前往下一站：
                                </span>
                                <span>{renderTextWithLinks(stop.transitToNext || stop.transitSuggestion)}</span>
                              </div>
                            </div>

                            {segmentNavUrl && (
                              <a
                                href={segmentNavUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-[#3F7D58]/30 hover:border-[#3F7D58] text-[#3F7D58] hover:text-[#2d5c41] text-[11px] font-bold shrink-0 transition-colors shadow-2xs"
                              >
                                <Navigation className="w-3 h-3" />
                                <span>導航此段 ↗</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
