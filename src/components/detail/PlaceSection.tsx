'use client';

import React, { useState } from 'react';
import { PlaceInfo, SavedItem } from '@/types/item';
import { useAppState } from '@/providers/AppStateProvider';
import { MapPin, Copy, Check, Edit2 } from 'lucide-react';
import { resolvePlaceHierarchy } from '@/lib/taiwanLocations';
import { PlaceLocationEditModal } from '@/components/places/PlaceLocationEditModal';

export function PlaceSection({
  placeInfo,
  item,
}: {
  placeInfo: PlaceInfo;
  item?: SavedItem;
}) {
  const { addToast } = useAppState();
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 智慧解析目前階層 (支援舊卡片無痛推導)
  const hierarchy = resolvePlaceHierarchy({
    placeInfo,
    title: item?.title,
    tags: item?.tags,
    summary: item?.summary,
  });

  const displayCity = hierarchy.city || placeInfo.city || '';
  const displayDistrict = hierarchy.district || placeInfo.district || '';

  // 檢查地址是否有效，避免重複印出店名或印出無效字串
  const isAddressValid = Boolean(
    placeInfo.address &&
      placeInfo.address.trim() !== '' &&
      placeInfo.address.trim() !== (placeInfo.locationName || '').trim() &&
      placeInfo.address.trim() !== 'undefined' &&
      placeInfo.address.trim() !== 'null'
  );

  const copyText = [
    placeInfo.locationName,
    placeInfo.city,
    isAddressValid ? placeInfo.address : '',
  ]
    .filter(Boolean)
    .join(' ');

  function handleCopyPlaceInfo() {
    if (!copyText) return;
    navigator.clipboard.writeText(copyText);
    setCopiedAddress(true);
    addToast({
      type: 'success',
      message: '📋 已複製店名與地址資訊',
    });
    setTimeout(() => setCopiedAddress(false), 2000);
  }

  // 解析 mustTryDishes：區分 15 字以內的簡短菜名膠囊，與超過 15 字的探店重點描述
  const capsuleDishes: string[] = [];
  const longNotes: string[] = [];

  if (Array.isArray(placeInfo.mustTryDishes)) {
    for (const rawDish of placeInfo.mustTryDishes) {
      if (!rawDish || typeof rawDish !== 'string') continue;

      const stripped = rawDish
        .replace(/(?:地址|店址|位址|住址)[：:\s]*[^\n。；！？]+[。；！？]?/g, '')
        .replace(/\s*Boundary:[^。]+[。]?/gi, '')
        .replace(/\s*freetext:[^。]+[。]?/gi, '')
        .trim();

      if (!stripped) continue;

      if (stripped.length > 15) {
        longNotes.push(stripped);

        const mustPickMatch = stripped.match(
          /(?:必點|推薦|招牌|必吃)\s*([^\s，。；！？\(\)]+(?:\s*\(\$\d+\))?)/
        );
        const priceMatch = stripped.match(/([^\s，。；！？\(\)]+?\s*\(\$\d+\))/);
        const firstSegment = stripped.split(/[，,。]/)[0].trim();

        let extractedDish = '';
        if (mustPickMatch && mustPickMatch[1]) {
          extractedDish = mustPickMatch[1].trim();
        } else if (priceMatch && priceMatch[1]) {
          extractedDish = priceMatch[1].trim();
        } else if (firstSegment && firstSegment.length >= 2 && firstSegment.length <= 15) {
          extractedDish = firstSegment;
        }

        if (extractedDish && extractedDish.length >= 2 && !capsuleDishes.includes(extractedDish)) {
          capsuleDishes.push(extractedDish);
        }
      } else {
        if (!capsuleDishes.includes(stripped)) {
          capsuleDishes.push(stripped);
        }
      }
    }
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-cat-place uppercase tracking-wider font-mono">
          <MapPin className="w-3.5 h-3.5" />
          <span>探店地點資訊</span>
        </div>

        {copyText && (
          <button
            type="button"
            onClick={handleCopyPlaceInfo}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control text-xs font-medium bg-surface-2 hover:bg-line/30 text-ink-2 hover:text-ink border border-line transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            {copiedAddress ? (
              <>
                <Check className="w-3 h-3 text-success shrink-0" />
                <span>已複製地址</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-ink-3 shrink-0" />
                <span>📋 複製店名與地址</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {placeInfo.locationName && (
            <h4 className="text-base font-bold text-ink min-w-0 break-words flex-1">
              {placeInfo.locationName}
            </h4>
          )}
          {placeInfo.rating && (
            <div className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-300/40">
              <span>★ {placeInfo.rating}</span>
            </div>
          )}
        </div>

        {(displayCity || displayDistrict) && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium bg-surface-2 text-ink-2 border border-line shrink-0 whitespace-nowrap">
              <span>🏙️ 地區：</span>
              <span className="font-bold text-ink">{displayCity}</span>
              {displayDistrict && (
                <>
                  <span className="text-ink-4">▸</span>
                  <span className="font-semibold text-cat-place">{displayDistrict}</span>
                </>
              )}
            </span>

            {item && (
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-ink-3 hover:text-ink hover:bg-surface-2 border border-line transition-colors cursor-pointer"
                title="手動微調這間店的所屬縣市與鄉鎮市區"
              >
                <Edit2 className="w-3 h-3 text-cat-place" />
                <span>修改地區</span>
              </button>
            )}
          </div>
        )}

        {/* 門牌地址：僅在地址有效且非重複店名時顯示 */}
        {isAddressValid && (
          <p className="text-xs text-ink-2 leading-relaxed break-words">
            📍 地址：{placeInfo.address}
          </p>
        )}

        {/* 🍽️ 網友推薦必吃必點 */}
        {capsuleDishes.length > 0 && (
          <div className="pt-2 border-t border-line/60 space-y-1.5 w-full overflow-hidden">
            <span className="text-[11px] font-bold text-accent block">
              🍽️ 網友推薦必吃必點：
            </span>
            <div className="flex flex-wrap gap-2 w-full overflow-hidden">
              {capsuleDishes.map((dish, idx) => (
                <span
                  key={idx}
                  className="max-w-full break-words whitespace-normal text-xs px-3 py-1.5 rounded-xl font-semibold bg-accent/10 text-accent border border-accent/20"
                >
                  {dish}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 💬 探店重點 */}
        {longNotes.length > 0 && (
          <div className="pt-2 border-t border-line/60 space-y-1.5">
            <span className="text-[11px] font-bold text-ink-2 block">
              💬 探店重點：
            </span>
            <div className="space-y-1 text-xs text-ink-2">
              {longNotes.map((note, idx) => (
                <p key={idx} className="leading-relaxed break-words">
                  • {note}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Google 評論與食客重點摘要 */}
        {placeInfo.reviewsSummary && placeInfo.reviewsSummary.length > 0 && (
          <div className="pt-2 border-t border-line/60 space-y-1.5">
            <span className="text-[11px] font-bold text-ink block">
              💬 Google 熱門評論重點：
            </span>
            <ul className="space-y-1 text-xs text-ink-2">
              {placeInfo.reviewsSummary.map((rev, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-relaxed">
                  <span className="text-cat-place mt-0.5 shrink-0">•</span>
                  <span className="break-words">{rev}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {item && (
        <PlaceLocationEditModal
          item={item}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
    </div>
  );
}

