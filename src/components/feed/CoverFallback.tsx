import React from 'react';
import { Category } from '@/types/item';
import { getCategoryMeta } from '@/lib/categories';
import { getDomain } from '@/lib/format';

const CATEGORY_GRADIENTS: Record<Category, string> = {
  recipe: 'from-amber-900/90 via-orange-950 to-stone-900',
  place: 'from-emerald-900/90 via-teal-950 to-stone-900',
  media: 'from-indigo-900/90 via-purple-950 to-stone-900',
  product: 'from-orange-900/90 via-amber-950 to-stone-900',
  account: 'from-sky-900/90 via-slate-950 to-stone-900',
  general: 'from-stone-800 via-stone-900 to-neutral-950',
};

export function CoverFallback({
  category,
  url,
  title,
}: {
  category: Category;
  url: string;
  title: string;
}) {
  const meta = getCategoryMeta(category);
  const Icon = meta.icon;
  const domain = getDomain(url);
  const gradientClass = CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.general;

  return (
    <div
      className={`w-full h-full flex flex-col justify-between p-4 select-none relative overflow-hidden bg-gradient-to-br ${gradientClass} text-white`}
    >
      {/* 置中分類大圖示 */}
      <div className="my-auto flex flex-col items-center justify-center gap-2 z-10 opacity-85">
        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shadow-inner">
          <Icon className="w-7 h-7 text-white" strokeWidth={1.75} />
        </div>
        <span className="text-[11px] font-bold tracking-wider text-white/80">
          {meta.label}
        </span>
      </div>

      {/* 頂部小標記 */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
        <span className="text-[10px] font-mono text-white/60 tracking-wider uppercase truncate max-w-[120px]">
          {domain}
        </span>
      </div>
    </div>
  );
}

