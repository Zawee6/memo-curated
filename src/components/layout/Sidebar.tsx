'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NAV_ITEMS } from './NavItems';
import { useAppState } from '@/providers/AppStateProvider';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const {
    items,
    isCloudSync,
    selectedCookingRecipeIds,
    openAINotebook,
    aiNotes,
    thinkingTasksCount,
    spaceId,
    isDefaultSpace,
    isAdmin,
    formatSpaceHref,
  } = useAppState();

  useEffect(() => {
    NAV_ITEMS.forEach((it) => {
      try {
        router.prefetch(formatSpaceHref(it.href));
      } catch {}
    });
  }, [router, formatSpaceHref]);

  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  const currentPath = optimisticPath || pathname;

  const recipesCount = items.filter((i) => i.category === 'recipe').length;
  const placesCount = items.filter((i) => i.category === 'place').length;
  const moviesCount = items.filter((i) => i.category === 'media').length;
  const picksCount = items.filter(
    (i) => i.category === 'account' || i.category === 'product' || i.category === 'general'
  ).length;

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 h-full bg-surface border-r border-line z-30 select-none">
      {/* Brand Header */}
      <div className="px-6 py-7 border-b border-line flex items-center justify-between">
        <Link href={formatSpaceHref('/')} className="group flex items-baseline gap-1.5">
          <span className="font-sans text-2xl font-black tracking-tight text-ink group-hover:text-accent transition-colors">
            memo.
          </span>
          <span className="text-[10px] font-sans font-semibold text-ink-3 tracking-widest uppercase">
            Curated
          </span>
        </Link>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-surface-2 text-ink-2 border border-line">
          v3.0
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-ink-3 uppercase font-mono">
          專屬分館導覽
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/'
              ? currentPath === '/'
              : currentPath.startsWith(item.href);

          let badgeCount: number | null = null;
          if (isMounted) {
            if (item.badgeKey === 'items' && items.length > 0) {
              badgeCount = items.length;
            } else if (item.badgeKey === 'recipes' && recipesCount > 0) {
              badgeCount = recipesCount;
            } else if (item.badgeKey === 'places' && placesCount > 0) {
              badgeCount = placesCount;
            } else if (item.badgeKey === 'collections' && moviesCount > 0) {
              badgeCount = moviesCount;
            } else if (item.badgeKey === 'picks' && picksCount > 0) {
              badgeCount = picksCount;
            }
          }

          const Icon = item.icon;
          const hasActiveCooking =
            isMounted && item.badgeKey === 'recipes' && selectedCookingRecipeIds.length > 0;

          return (
            <Link
              key={item.href}
              href={formatSpaceHref(item.href)}
              prefetch={true}
              onClick={() => setOptimisticPath(item.href)}
              className={cn(
                'group flex items-center justify-between px-3.5 py-2.5 rounded-control text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-ink text-surface shadow-xs font-semibold'
                  : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    isActive
                      ? 'text-surface'
                      : 'text-ink-3 group-hover:text-ink'
                  )}
                />
                <span>{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {hasActiveCooking && (
                  <span
                    title={`今日已勾選 ${selectedCookingRecipeIds.length} 道開伙菜單`}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-accent text-white"
                  >
                    🔥{selectedCookingRecipeIds.length}
                  </span>
                )}
                {badgeCount !== null && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-mono font-semibold',
                      isActive
                        ? 'bg-surface/20 text-surface'
                        : 'bg-surface-2 text-ink-3 group-hover:text-ink group-hover:bg-line'
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* 📓 AI 背景思考記事本專區 */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={openAINotebook}
          className="w-full group flex items-center justify-between p-2.5 rounded-xl border border-line bg-surface-2/60 hover:bg-surface-2 hover:border-black/25 transition-all text-xs cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">📓</span>
            <div className="text-left">
              <span className="font-bold text-ink block leading-tight">AI 記事本</span>
              <span className="text-[10px] text-ink-3">背景行程與菜單</span>
            </div>
          </div>

          {isMounted && (thinkingTasksCount > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 border border-amber-500/30 animate-pulse font-mono">
              <Sparkles className="w-2.5 h-2.5 animate-spin" />
              <span>思考中 ({thinkingTasksCount})</span>
            </span>
          ) : aiNotes.length > 0 ? (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-mono font-bold bg-[#3F7D58]/15 text-[#3F7D58] border border-[#3F7D58]/30">
              {aiNotes.length}
            </span>
          ) : null)}
        </button>
      </div>

      {/* Status Footer */}
      <div className="p-3 border-t border-line bg-surface-2/40 space-y-2">
        <div className="flex items-center justify-between px-2 py-1 rounded-control text-xs">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'w-2 h-2 rounded-full shrink-0',
                isCloudSync ? 'bg-[#3F7D58] animate-pulse' : 'bg-ink-3'
              )}
            />
            <span className="text-ink-2 font-medium text-[11px]">
              跨裝置伺服器即時同步
            </span>
          </div>
          <Link
            href={formatSpaceHref('/settings')}
            className="text-[11px] text-accent hover:underline font-medium"
          >
            捷徑設定
          </Link>
        </div>

        {/* 空間狀態膠囊 */}
        <div className="space-y-1">
          <Link
            href={formatSpaceHref('/settings')}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface border border-line text-[11px] hover:border-black/25 transition-colors group"
          >
            <div className="flex items-center gap-1.5 truncate">
              <span>{isMounted && isAdmin && isDefaultSpace ? '👑' : '👤'}</span>
              <span className="font-mono font-medium text-ink truncate">
                {!isMounted
                  ? '主空間 (default)'
                  : isDefaultSpace
                  ? '主空間 (default)'
                  : `空間：${spaceId}`}
              </span>
              {isMounted && isAdmin && !isDefaultSpace && (
                <span className="text-[9px] px-1 rounded bg-amber-500/15 text-amber-600 font-bold shrink-0">
                  巡視
                </span>
              )}
            </div>
            <span className="text-[10px] text-accent font-semibold shrink-0 group-hover:underline">
              {isAdmin ? '切換' : '資訊'}
            </span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
