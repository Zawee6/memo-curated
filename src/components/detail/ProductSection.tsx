'use client';

import React, { useState } from 'react';
import { ProductInfo } from '@/types/item';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Tag,
  ShieldCheck,
  ExternalLink,
  ShoppingBag,
  Search,
} from 'lucide-react';

export function ProductSection({ productInfo }: { productInfo: ProductInfo }) {
  const [imageError, setImageError] = useState(false);

  const productName = productInfo.brand || '精選好物規格';
  const isSuspiciousIcon =
    !productInfo.officialImageUrl ||
    productInfo.officialImageUrl.toLowerCase().includes('wallet') ||
    productInfo.officialImageUrl.toLowerCase().includes('icon') ||
    productInfo.officialImageUrl.toLowerCase().includes('logo') ||
    productInfo.officialImageUrl.toLowerCase().endsWith('.svg');

  const showOfficialImage = !imageError && !isSuspiciousIcon && Boolean(productInfo.officialImageUrl);

  const [copiedName, setCopiedName] = useState(false);

  const handleCopyProductName = async () => {
    try {
      await navigator.clipboard.writeText(productName);
      setCopiedName(true);
      setTimeout(() => setCopiedName(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <section className="space-y-4 p-4.5 rounded-xl bg-surface-2/40 border border-black/10 relative">
      {/* 標題與參考價格 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-3">
        <div>
          <span className="font-sans text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>好物規格手帳評測</span>
          </span>
          <h4 className="font-display text-base font-bold text-ink mt-0.5">
            {productName}
          </h4>
        </div>

        <div className="flex items-center gap-2">
          {productInfo.priceRange && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-sans font-bold bg-accent/10 text-accent border border-dashed border-accent/30 shadow-2xs">
              <Tag className="w-3.5 h-3.5" />
              <span>{productInfo.priceRange}</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleCopyProductName}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface hover:bg-surface-2 border border-line text-xs font-semibold text-ink shadow-2xs transition-colors cursor-pointer"
          >
            <span>{copiedName ? '✅ 已複製名稱' : '📋 複製好物名稱'}</span>
          </button>
        </div>
      </div>

      {/* 官方產品去背/宣傳首圖預覽（過濾無關之 Icon 或 Logo） */}
      {showOfficialImage && (
        <div className="relative">
          <div className="relative aspect-video max-h-48 w-full rounded-xl overflow-hidden bg-white dark:bg-neutral-800 border border-black/10 flex items-center justify-center p-3 shadow-2xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productInfo.officialImageUrl}
              alt={productName}
              onError={() => setImageError(true)}
              className="w-full h-full object-contain"
            />
            <span className="absolute top-2 right-2 text-[10px] font-sans font-bold px-2 py-0.5 rounded-xs bg-black/60 text-white backdrop-blur-md border border-white/20">
              官方宣傳照
            </span>
          </div>
        </div>
      )}

      {/* 核心規格亮點 */}
      {productInfo.specs && productInfo.specs.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-ink-2 font-sans flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>核心規格重點：</span>
          </span>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-ink-2">
            {productInfo.specs.map((spec, idx) => (
              <li
                key={idx}
                className="p-2 rounded-lg bg-surface border border-black/10 flex items-start gap-1.5 shadow-2xs"
              >
                <span className="text-accent font-bold">•</span>
                <span className="leading-snug font-sans">{spec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 優點與缺點對照 (便利貼手帳卡) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* 優點 */}
        {productInfo.pros && productInfo.pros.length > 0 && (
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-dashed border-emerald-600/30 space-y-1.5 shadow-2xs">
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 font-sans">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>推薦入手亮點：</span>
            </span>
            <ul className="space-y-1 text-xs text-ink-2">
              {productInfo.pros.map((pro, idx) => (
                <li key={idx} className="flex items-start gap-1 leading-snug">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span className="font-sans">{pro}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 缺點 / 注意事項 */}
        {productInfo.cons && productInfo.cons.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-500/5 border border-dashed border-amber-600/30 space-y-1.5 shadow-2xs">
            <span className="text-xs font-bold text-amber-700 flex items-center gap-1 font-sans">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>注意事項與短板：</span>
            </span>
            <ul className="space-y-1 text-xs text-ink-2">
              {productInfo.cons.map((con, idx) => (
                <li key={idx} className="flex items-start gap-1 leading-snug">
                  <span className="text-amber-600 font-bold">!</span>
                  <span className="font-sans">{con}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
