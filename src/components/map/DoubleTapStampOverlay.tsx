'use client';

import React from 'react';
import { Check, X } from 'lucide-react';

export function DoubleTapStampOverlay({
  status,
}: {
  status: 'added' | 'removed' | null;
}) {
  if (!status) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-[1px] rounded-control pointer-events-none transition-all duration-200">
      {status === 'added' ? (
        <div className="px-3 py-1.5 rounded-sm bg-[#3F7D58] text-white border-2 border-dashed border-emerald-300 font-sans text-xs font-bold tracking-wider stamp-pop shadow-lg flex items-center gap-1.5 animate-in fade-in zoom-in-75">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>✓ 已加入待排行程</span>
        </div>
      ) : (
        <div className="px-3 py-1.5 rounded-sm bg-stone-800 text-stone-100 border-2 border-dashed border-stone-400 font-sans text-xs font-bold tracking-wider stamp-pop shadow-lg flex items-center gap-1.5 animate-in fade-in zoom-in-75">
          <X className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>✕ 已從行程移出</span>
        </div>
      )}
    </div>
  );
}
