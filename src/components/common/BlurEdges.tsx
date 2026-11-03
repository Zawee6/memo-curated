'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const TOP_MASK_BASE_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(to bottom, rgba(250, 248, 245, 0.94) 0%, rgba(250, 248, 245, 0.6) 50%, rgba(250, 248, 245, 0) 100%)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
  maskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
};

const BOTTOM_MASK_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(to top, rgba(250, 248, 245, 0.96) 0%, rgba(250, 248, 245, 0.68) 55%, rgba(250, 248, 245, 0) 100%)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  WebkitMaskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
  maskImage: 'linear-gradient(to top, black 55%, transparent 100%)',
};

/**
 * 畫面上下邊界漸層高斯模糊遮罩 (Progressive Gaussian Blur Edge Masks)
 * - 頂部遮罩：捲動驅動 (Scroll-Driven Top Blur)，在頁面最頂端 (scrollY <= 8px) 時 opacity 為 0 完全隱藏不遮擋標題；
 *   往下滑動 (8px < scrollY < 48px) 時平滑浮現 (opacity 0 -> 1)。
 * - 底部遮罩：常駐柔和過渡，與米白背景 (#FAF8F5) 同色系無縫霧化。
 * - 帶有 pointer-events-none，絕不阻擋任何觸控或點擊互動。
 */
export function BlurEdges() {
  const pathname = usePathname();
  const [topBlurOpacity, setTopBlurOpacity] = useState(0);

  const computeScrollOpacity = useCallback((eventTarget?: EventTarget | null) => {
    if (typeof window === 'undefined') return;
    const mainEl = document.querySelector('main');
    const targetScrollTop =
      eventTarget && eventTarget instanceof HTMLElement ? eventTarget.scrollTop : 0;
    const scrollY = Math.max(
      window.scrollY || 0,
      mainEl ? mainEl.scrollTop : 0,
      targetScrollTop
    );
    const nextOpacity = Math.min(1, Math.max(0, (scrollY - 8) / 40));
    setTopBlurOpacity(nextOpacity);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = (e: Event) => {
      computeScrollOpacity(e.target);
    };

    computeScrollOpacity();

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [computeScrollOpacity]);

  // 切換分頁路由時重新計算頂部捲動位置
  useEffect(() => {
    computeScrollOpacity();
  }, [pathname, computeScrollOpacity]);

  const topMaskStyle: React.CSSProperties = {
    ...TOP_MASK_BASE_STYLE,
    opacity: topBlurOpacity,
  };

  return (
    <>
      {/* 📱 手機版頂部遮罩 (h-10，隨往下滑動漸漸浮現) */}
      <div
        className="fixed inset-x-0 top-0 h-10 pointer-events-none z-30 transition-opacity duration-200 md:hidden"
        style={topMaskStyle}
        aria-hidden="true"
      />

      {/* 📱 手機版底部遮罩 (h-28，常駐柔和霧化) */}
      <div
        className="fixed inset-x-0 bottom-0 h-28 pointer-events-none z-30 md:hidden"
        style={BOTTOM_MASK_STYLE}
        aria-hidden="true"
      />

      {/* 💻 電腦版頂部遮罩 (h-12，避開左側側邊欄，隨往下滑動漸漸浮現) */}
      <div
        className="hidden md:block fixed top-0 left-60 md:left-64 right-0 h-12 pointer-events-none z-30 transition-opacity duration-200"
        style={topMaskStyle}
        aria-hidden="true"
      />

      {/* 💻 電腦版底部遮罩 (h-14，避開左側側邊欄，常駐柔和霧化) */}
      <div
        className="hidden md:block fixed bottom-0 left-60 md:left-64 right-0 h-14 pointer-events-none z-30"
        style={BOTTOM_MASK_STYLE}
        aria-hidden="true"
      />
    </>
  );
}
