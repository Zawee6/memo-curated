'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  zIndex?: string;
}

export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  footer,
  headerActions,
  zIndex = 'z-50',
}: SheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollableRef = useRef<HTMLDivElement>(null);

  // Expansion & Responsive state
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Gesture tracking refs for mobile pull handle
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const currentDeltaYRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // Content touch gesture tracking refs for overscroll dismiss
  const isScrollTouchingRef = useRef(false);
  const touchStartYRef = useRef(0);
  const touchStartScrollTopRef = useRef(0);
  const isPullingDownAtTopRef = useRef(false);
  const isPullingUpAtBottomRef = useRef(false);
  const [bottomOverscrollPx, setBottomOverscrollPx] = useState(0);

  // Spring snap-back to original position
  const snapBack = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.style.transition = 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)';
      contentRef.current.style.transform = 'translate3d(0, 0, 0)';
    }
  }, []);

  // Smooth animated exit closure (250ms duration)
  const triggerAnimatedClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    if (contentRef.current) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      contentRef.current.style.transition = 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1), opacity 250ms ease';
      contentRef.current.style.transform = isMobile
        ? 'translate3d(0, 100%, 0)'
        : 'translate3d(100%, 0, 0)';
      contentRef.current.style.opacity = '0.85';
    }
    setTimeout(() => {
      onClose();
    }, 240);
  }, [isClosing, onClose]);

  // Immediate, unconditional close handler (for ✕ button, backdrop click, ESC key)
  const handleImmediateClose = useCallback(() => {
    isDraggingRef.current = false;
    isScrollTouchingRef.current = false;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setIsClosing(false);
    onClose();
  }, [onClose]);

  // Reset states when opened
  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setIsExpanded(false);
      if (contentRef.current) {
        contentRef.current.style.transform = '';
        contentRef.current.style.transition = '';
        contentRef.current.style.opacity = '';
      }
    }
  }, [isOpen]);

  // Escape key & body overflow lock
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleImmediateClose();
      }
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [isOpen, handleImmediateClose]);

  // Gesture handlers for top mobile drag handle
  const handleDragStart = useCallback((clientY: number) => {
    startYRef.current = clientY;
    currentDeltaYRef.current = 0;
    isDraggingRef.current = true;
    if (contentRef.current) {
      contentRef.current.style.transition = 'none';
    }
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDraggingRef.current) return;
    const diff = clientY - startYRef.current;
    currentDeltaYRef.current = diff;

    let translateY = 0;
    if (diff > 0) {
      // 向下滑動（跟隨手指位移）
      translateY = diff;
    } else {
      // 向上拉動
      if (!isExpanded) {
        translateY = diff;
      } else {
        translateY = -Math.pow(Math.abs(diff), 0.72) * 1.5;
      }
    }

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (contentRef.current) {
          contentRef.current.style.transform = `translate3d(0, ${translateY}px, 0)`;
        }
      });
    }
  }, [isExpanded]);

  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const delta = currentDeltaYRef.current;

    // 向下滑動超過 80px -> 觸發流暢收起動畫
    if (delta > 80) {
      triggerAnimatedClose();
      return;
    }

    // 向上拉動超過 45px -> 展開
    if (delta < -45) {
      setIsExpanded(true);
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), height 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
        contentRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
      return;
    }

    // 已展開時向下拉超過 50px -> 收合至標準高度
    if (isExpanded && delta > 50) {
      setIsExpanded(false);
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), height 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
        contentRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
      return;
    }

    // 未達門檻，彈回原位
    snapBack();
  }, [triggerAnimatedClose, isExpanded, snapBack]);

  // Click on drag handle toggles expand / collapse
  const handleHandleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (Math.abs(currentDeltaYRef.current) < 5) {
      setIsExpanded((prev) => !prev);
      if (contentRef.current) {
        contentRef.current.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), height 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
        contentRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
    }
  };

  // Content touch gestures (Top pull down & Bottom overscroll dismiss)
  const handleContentTouchStart = useCallback((e: React.TouchEvent) => {
    const el = scrollableRef.current;
    if (!el) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartScrollTopRef.current = el.scrollTop;
    isScrollTouchingRef.current = true;
    isPullingDownAtTopRef.current = false;
    isPullingUpAtBottomRef.current = false;
    setBottomOverscrollPx(0);
  }, []);

  const handleContentTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isScrollTouchingRef.current) return;
    const el = scrollableRef.current;
    if (!el) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartYRef.current;
    const isAtTop = el.scrollTop <= 1;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 3;

    // 情境 B：在最頂端（scrollTop <= 0）往下拉動
    if ((isAtTop || isPullingDownAtTopRef.current) && deltaY > 0 && touchStartScrollTopRef.current <= 1) {
      isPullingDownAtTopRef.current = true;
      currentDeltaYRef.current = deltaY;
      if (contentRef.current) {
        contentRef.current.style.transition = 'none';
        contentRef.current.style.transform = `translate3d(0, ${deltaY}px, 0)`;
      }
      return;
    }

    // 情境 A：在最底部（scrollTop + clientHeight >= scrollHeight - 3）繼續往上拉動超過底部邊界
    if ((isAtBottom || isPullingUpAtBottomRef.current) && deltaY < 0) {
      const overscroll = Math.abs(deltaY);
      isPullingUpAtBottomRef.current = true;
      currentDeltaYRef.current = deltaY;
      setBottomOverscrollPx(overscroll);

      const translateY = -Math.min(overscroll * 0.35, 36);
      if (contentRef.current) {
        contentRef.current.style.transition = 'none';
        contentRef.current.style.transform = `translate3d(0, ${translateY}px, 0)`;
      }
      return;
    }

    // 正常捲動
    isPullingDownAtTopRef.current = false;
    isPullingUpAtBottomRef.current = false;
    setBottomOverscrollPx(0);
  }, []);

  const handleContentTouchEnd = useCallback(() => {
    isScrollTouchingRef.current = false;

    // 情境 B：頂端下拉超過 80px -> 觸發收起動畫
    if (isPullingDownAtTopRef.current) {
      isPullingDownAtTopRef.current = false;
      if (currentDeltaYRef.current > 80) {
        triggerAnimatedClose();
        return;
      } else {
        snapBack();
        return;
      }
    }

    // 情境 A：底部上拉超過 70px -> 觸發收起動畫
    if (isPullingUpAtBottomRef.current) {
      isPullingUpAtBottomRef.current = false;
      const overscroll = Math.abs(currentDeltaYRef.current);
      setBottomOverscrollPx(0);
      if (overscroll > 70) {
        triggerAnimatedClose();
        return;
      } else {
        snapBack();
        return;
      }
    }

    setBottomOverscrollPx(0);
  }, [triggerAnimatedClose, snapBack]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn('fixed inset-0 flex items-end md:items-stretch md:justify-end overflow-hidden', zIndex)}
    >
      {/* Backdrop (半透明黑幕，點擊無條件立即關閉) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          handleImmediateClose();
        }}
        className={cn(
          'fixed inset-0 bg-ink/40 backdrop-blur-xs cursor-pointer z-0 transition-opacity duration-200',
          isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100 animate-in fade-in'
        )}
        aria-hidden="true"
      />

      {/* Sheet / Drawer Container */}
      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'relative z-10 w-full bg-surface shadow-sheet flex flex-col',
          // Mobile: Bottom sheet with dynamic snap points & bottom buffer
          isExpanded
            ? 'h-[95dvh] max-h-[96dvh]'
            : 'h-[80dvh] max-h-[82dvh]',
          'rounded-t-[28px] border-t border-line will-change-transform',
          // Bottom buffer to prevent blank gap during drag up
          'after:content-[\'\'] after:absolute after:top-full after:left-0 after:right-0 after:h-[60vh] after:bg-surface after:pointer-events-none',
          // Animation
          'animate-in slide-in-from-bottom duration-300 ease-out',
          // Desktop: Right side drawer
          'md:max-h-full md:h-full md:w-[560px] md:max-w-2xl md:rounded-t-none md:rounded-l-[24px] md:border-t-0 md:border-l md:border-line md:after:hidden md:slide-in-from-right',
          className
        )}
      >
        {/* Mobile Drag Indicator Bar (把手觸控拖曳，點擊可切換展開/收合) */}
        <div
          onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
          onTouchEnd={handleDragEnd}
          onClick={handleHandleClick}
          className="w-full flex flex-col items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none md:hidden group shrink-0"
          title="點擊切換全螢幕，向下拖拉關閉"
        >
          <div className="w-12 h-1.5 rounded-full bg-ink-3/40 group-hover:bg-ink-3/70 group-active:scale-95 transition-all" />
        </div>

        {/* Header (標題與右上角固定 100% 一點即關之關閉按鈕) */}
        <div className="flex items-start justify-between px-4 sm:px-6 pt-1 pb-3 border-b border-line shrink-0">
          <div className="pr-4 space-y-0.5 min-w-0 flex-1">
            {title && (
              <h2 className="text-lg md:text-xl font-display font-bold text-ink tracking-tight line-clamp-1">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-ink-3 line-clamp-1">
                {description}
              </p>
            )}
          </div>

          {/* 右上角按鈕區：強制固定在最上層，絕對不被拖曳手勢攔截 */}
          <div className="flex items-center gap-2 shrink-0 z-50 relative pointer-events-auto">
            {headerActions}
            <button
              type="button"
              aria-label="關閉"
              onClick={(e) => {
                e.stopPropagation();
                handleImmediateClose();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-2 hover:bg-line/20 text-ink-2 hover:text-ink transition-colors cursor-pointer z-50 pointer-events-auto active:scale-95"
              title="關閉 (ESC)"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div
          ref={scrollableRef}
          onTouchStart={handleContentTouchStart}
          onTouchMove={handleContentTouchMove}
          onTouchEnd={handleContentTouchEnd}
          className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full px-4 sm:px-6 py-5 overscroll-contain box-border"
        >
          {children}

          {/* 雙向手勢底部提示（滑到底部繼續向上拉動收起） */}
          <div className="pt-6 pb-2 text-center text-xs text-ink-3 transition-opacity duration-200 select-none md:hidden">
            {bottomOverscrollPx > 65 ? (
              <span className="text-accent font-bold animate-pulse">
                ↑ 放開以關閉資訊欄
              </span>
            ) : (
              <span className="opacity-50">
                滑到底部繼續向上拉動即可收起資訊欄
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 sm:px-6 py-4 border-t border-line bg-surface-2/60 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
