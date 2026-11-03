'use client';

import React from 'react';
import { Film, Calendar, User, X, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MovieCandidateItem } from '@/app/api/movies/candidates/route';

interface MovieCandidateModalProps {
  isOpen: boolean;
  query: string;
  candidates: MovieCandidateItem[];
  isLoading?: boolean;
  onSelect: (candidate: MovieCandidateItem) => void;
  onClose: () => void;
}

export function MovieCandidateModal({
  isOpen,
  query,
  candidates,
  isLoading,
  onSelect,
  onClose,
}: MovieCandidateModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 cursor-pointer"
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] bg-surface rounded-2xl border border-line shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between bg-surface-2/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-sans text-base font-bold text-ink">
                🎬 選擇你要加入的電影版本
              </h3>
              <p className="text-xs text-ink-3">
                搜尋「<span className="font-semibold text-ink">{query}</span>」找到多部作品，請點選欲建檔的版本：
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-ink-3 hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Candidates List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 text-center space-y-2">
              <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-ink-3">正在檢索各版本電影海報與資料...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-semibold text-ink">未找到明確的電影候選</p>
              <p className="text-xs text-ink-3">將直接為您以「{query}」進行智慧解析建檔。</p>
              <button
                type="button"
                onClick={() => onSelect({ title: query, source: 'direct-input' })}
                className="mt-3 px-4 py-2 rounded-xl bg-accent text-white font-semibold text-xs shadow-2xs hover:bg-accent/90 transition-all cursor-pointer"
              >
                直接建檔「{query}」
              </button>
            </div>
          ) : (
            candidates.map((cand, idx) => (
              <div
                key={cand.imdbId || `cand_${idx}`}
                onClick={() => onSelect(cand)}
                className="group relative flex gap-3.5 p-3 rounded-xl border border-line bg-surface hover:border-accent hover:shadow-md transition-all cursor-pointer items-start"
              >
                {/* 海報縮圖 */}
                <div className="relative w-20 sm:w-24 aspect-[27/40] rounded-lg overflow-hidden shrink-0 bg-stone-900 border border-black/10">
                  {cand.posterUrl ? (
                    <img
                      src={cand.posterUrl}
                      alt={cand.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-500 p-2 text-center">
                      <Film className="w-6 h-6 mb-1 opacity-50" />
                      <span className="text-[10px]">無海報</span>
                    </div>
                  )}
                  {cand.releaseYear && (
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-sm bg-black/75 backdrop-blur-xs text-[10px] font-mono font-bold text-amber-300">
                      {cand.releaseYear}
                    </div>
                  )}
                </div>

                {/* 片名與詳細內容 */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="font-bold text-sm sm:text-base text-ink group-hover:text-accent transition-colors">
                      {cand.title}
                    </h4>
                    {cand.originalTitle && cand.originalTitle !== cand.title && (
                      <span className="text-xs text-ink-3 font-mono">
                        ({cand.originalTitle})
                      </span>
                    )}
                  </div>

                  {/* 導演與卡司 */}
                  {(cand.director || cand.cast) && (
                    <div className="text-xs text-ink-2 flex items-center gap-1.5 flex-wrap">
                      {cand.director && (
                        <span className="inline-flex items-center gap-1 font-medium">
                          <User className="w-3 h-3 text-ink-3" />
                          <span>{cand.director}</span>
                        </span>
                      )}
                      {cand.director && cand.cast && <span className="text-ink-4">•</span>}
                      {cand.cast && (
                        <span className="text-ink-3 truncate max-w-[200px]">
                          {cand.cast}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 簡介 */}
                  {cand.overview && (
                    <p className="text-xs text-ink-3 line-clamp-2 leading-relaxed">
                      {cand.overview}
                    </p>
                  )}

                  {/* 選取指示器 */}
                  <div className="pt-1 flex items-center justify-between">
                    {cand.imdbId && (
                      <span className="text-[10px] font-mono text-ink-3">
                        IMDb: {cand.imdbId}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-accent group-hover:translate-x-0.5 transition-transform ml-auto">
                      <span>選擇此部入庫</span>
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-line bg-surface-2/30 flex items-center justify-between text-xs text-ink-3">
          <span>找不到你要的？可嘗試輸入英文片名或加上年份</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink font-semibold transition-colors cursor-pointer"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
