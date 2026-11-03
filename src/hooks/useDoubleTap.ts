'use client';

import { useRef, useCallback, useState } from 'react';

/**
 * useDoubleTap provides handlers for mouse double-click and touch double-tap (< 320ms),
 * along with a 1-second visual feedback state ('added' | 'removed' | null).
 */
export function useDoubleTap(onDoubleTap: () => void, delay = 320) {
  const lastTapRef = useRef<number>(0);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const now = Date.now();
      if (now - lastTapRef.current < delay && now - lastTapRef.current > 0) {
        onDoubleTap();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    },
    [onDoubleTap, delay]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDoubleTap();
    },
    [onDoubleTap]
  );

  return {
    onTouchEnd: handleTouchEnd,
    onDoubleClick: handleDoubleClick,
  };
}
