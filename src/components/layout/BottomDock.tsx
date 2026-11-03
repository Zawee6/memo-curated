'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_ITEMS } from './NavItems';
import { useAppState } from '@/providers/AppStateProvider';
import { cn } from '@/lib/utils';

export function BottomDock() {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedCookingRecipeIds, formatSpaceHref } = useAppState();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isScrubbingRef = useRef(false);
  const lastScrubbedIndexRef = useRef<number>(-1);

  // 1. 預載全部 6 個分頁路由，達成 0 毫秒極速切換
  useEffect(() => {
    NAV_ITEMS.forEach((it) => {
      try {
        router.prefetch(formatSpaceHref(it.href));
      } catch {}
    });
  }, [router, formatSpaceHref]);

  // 2. 當 Next.js 路由真正完成時，清除樂觀狀態
  useEffect(() => {
    setOptimisticIndex(null);
  }, [pathname]);

  const currentRouteIndex = useMemo(() => {
    const idx = NAV_ITEMS.findIndex((item) =>
      item.href === '/'
        ? pathname === '/'
        : pathname.startsWith(item.href)
    );
    return idx !== -1 ? idx : 0;
  }, [pathname]);

  const activeIndex =
    scrubIndex !== null
      ? scrubIndex
      : optimisticIndex !== null
      ? optimisticIndex
      : currentRouteIndex;

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(8);
      } catch {}
    }
  }, []);

  // 3. 根據觸控 clientX 計算對應分頁索引 (0 到 5)
  const getIndexFromTouch = useCallback((clientX: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = x / rect.width;
    const idx = Math.floor(ratio * 6);
    return Math.max(0, Math.min(5, idx));
  }, []);

  // 4. 手指左右滑動 (Touch Scrubbing) 互動手勢
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isScrubbingRef.current = true;
      const idx = getIndexFromTouch(e.touches[0].clientX);
      lastScrubbedIndexRef.current = idx;
      setScrubIndex(idx);
      triggerHaptic();
    },
    [getIndexFromTouch, triggerHaptic]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isScrubbingRef.current) return;
      const idx = getIndexFromTouch(e.touches[0].clientX);
      if (idx !== lastScrubbedIndexRef.current) {
        lastScrubbedIndexRef.current = idx;
        setScrubIndex(idx);
        triggerHaptic();
        // 滑過時立即預載該分頁
        router.prefetch(formatSpaceHref(NAV_ITEMS[idx].href));
      }
    },
    [getIndexFromTouch, triggerHaptic, router, formatSpaceHref]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isScrubbingRef.current) return;
    isScrubbingRef.current = false;
    const targetIdx = lastScrubbedIndexRef.current;
    setScrubIndex(null);
    if (targetIdx >= 0 && targetIdx < NAV_ITEMS.length) {
      setOptimisticIndex(targetIdx);
      router.push(formatSpaceHref(NAV_ITEMS[targetIdx].href));
    }
  }, [router, formatSpaceHref]);

  const handleTouchCancel = useCallback(() => {
    isScrubbingRef.current = false;
    setScrubIndex(null);
  }, []);

  const isScrubbing = scrubIndex !== null;

  return (
    <nav
      aria-label="行動底部導覽列"
      className="md:hidden fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto select-none"
    >
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className="bg-surface/95 backdrop-blur-md border border-line-strong shadow-float rounded-[22px] p-1.5 grid grid-cols-6 relative isolate touch-none select-none cursor-pointer"
      >
        {/* 滑動背景深色膠囊 (Sliding Active Pill Indicator) */}
        <div
          className={cn(
            'absolute top-1.5 bottom-1.5 left-1.5 w-[calc((100%-12px)/6)] bg-stone-900 dark:bg-white rounded-[16px] shadow-xs pointer-events-none -z-10',
            isScrubbing
              ? 'transition-transform duration-100 ease-out'
              : 'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
          )}
          style={{
            transform: `translateX(calc(${activeIndex} * 100%))`,
          }}
          aria-hidden="true"
        />

        {NAV_ITEMS.map((item, index) => {
          const isActive = activeIndex === index;
          const Icon = item.icon;
          const showCookingBadge =
            isMounted && item.badgeKey === 'recipes' && selectedCookingRecipeIds.length > 0;

          return (
            <Link
              key={item.href}
              href={formatSpaceHref(item.href)}
              prefetch={true}
              onClick={() => {
                setOptimisticIndex(index);
                triggerHaptic();
              }}
              className={cn(
                'relative flex flex-col items-center justify-center py-1.5 px-1 rounded-[16px] transition-all duration-200 min-w-0 z-10 active:scale-[0.96]',
                isActive
                  ? 'text-white dark:text-stone-900 font-semibold'
                  : 'text-ink-2 hover:text-ink'
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-transform duration-200',
                    isActive
                      ? 'scale-105 opacity-100 text-white dark:text-stone-900'
                      : 'opacity-75'
                  )}
                />
                {showCookingBadge && (
                  <span
                    key={selectedCookingRecipeIds.length}
                    className="absolute -top-1 -right-2.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-accent text-white text-[9px] font-mono font-bold flex items-center justify-center ring-2 ring-surface animate-pulse-pop shadow-xs"
                  >
                    {selectedCookingRecipeIds.length}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] mt-0.5 tracking-tight truncate max-w-full transition-colors duration-200',
                  isActive
                    ? 'text-white dark:text-stone-900 font-semibold'
                    : 'text-ink-3'
                )}
              >
                {item.shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
