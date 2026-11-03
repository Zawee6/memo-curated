'use client';

import React from 'react';
import { ParsedItem, SourcePost } from '@/types/item';
import { useAppState } from '@/providers/AppStateProvider';
import { CoverImage } from '@/components/feed/CoverImage';
import { formatDate, getDomain } from '@/lib/format';
import { ExternalLink, Film, MapPin, Play, Trash2, Sparkles, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isYouTubeStandardVideo, deduplicateSources, extractYouTubeVideoId } from '@/lib/video';

function getPlatformMeta(url: string) {
  try {
    const lower = url.toLowerCase();
    if (lower.includes('instagram.com')) {
      return {
        name: 'Instagram Reel',
        badgeClass: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white',
      };
    }
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      return {
        name: lower.includes('/shorts/') ? 'YouTube Shorts' : 'YouTube 影片',
        badgeClass: 'bg-red-600 text-white',
      };
    }
    if (lower.includes('threads.net')) {
      return {
        name: 'Threads 貼文',
        badgeClass: 'bg-stone-800 text-white',
      };
    }
    if (lower.includes('tiktok.com')) {
      return {
        name: 'TikTok 影片',
        badgeClass: 'bg-black text-white',
      };
    }
    const domain = getDomain(url);
    return {
      name: domain || '外部專題',
      badgeClass: 'bg-accent text-white',
    };
  } catch {
    return { name: '網頁連結', badgeClass: 'bg-accent text-white' };
  }
}

export interface RelatedSourcesSectionProps {
  item: ParsedItem;
  onSelectSource?: (source: { url: string; thumbnailUrl?: string | null; title?: string }) => void;
  activeSourceUrl?: string;
}

export function RelatedSourcesSection({
  item,
  onSelectSource,
  activeSourceUrl,
}: RelatedSourcesSectionProps) {
  const { deleteSourcePost, addToast } = useAppState();

  const isMovie = item.category === 'media';

  // 電影分類已完全由 MovieDetailSection 專區整合呈現，此處一律不重複渲染
  if (isMovie) {
    return null;
  }

  // 嚴格對 sources 進行正規化與重複影片過濾
  const displaySources: SourcePost[] = deduplicateSources(item.sources);

  // 若去重後只有 1 筆或為空，表示僅有原本那支影片，不需在下方顯示重複列表
  if (displaySources.length <= 1) {
    return null;
  }

  const sectionTitle =
    item.category === 'place'
      ? `我收藏的相關貼文與探店筆記（共 ${displaySources.length} 篇）`
      : item.category === 'recipe'
        ? `我收藏的相關貼文與食譜筆記（共 ${displaySources.length} 篇）`
        : `我收藏的相關貼文與觀點筆記（共 ${displaySources.length} 篇）`;

  const noteHeading =
    item.category === 'place'
      ? '📍 探店與必吃重點'
      : item.category === 'recipe'
        ? '🍳 料理重點筆記'
        : '🎬 影評觀點筆記';

  const Icon = isMovie ? Film : MapPin;

  return (
    <section className="space-y-4 pt-4 border-t border-black/10">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <h4 className="font-display text-sm sm:text-base font-bold text-ink flex items-center gap-2">
          <Icon className="w-4 h-4 text-accent" />
          <span>{sectionTitle}</span>
        </h4>
        <span className="text-xs font-sans text-ink-3 hidden sm:inline">
          手帳時間排序 · 支援直式 9:16 預覽
        </span>
      </div>

      {/* 直式影音卡片畫廊 (Media Source Cards) */}
      <div className="space-y-3.5">
        {displaySources.map((src, idx) => {
          const isYtVideo = isYouTubeStandardVideo(src.url);
          const isYt = Boolean(extractYouTubeVideoId(src.url));
          const cleanUrl = src.url;
          const is169 = src.aspectRatio === '16:9' || isYtVideo;
          const platform = getPlatformMeta(src.url);
          const thumbToDisplay = src.thumbnailUrl || (is169 ? undefined : (isMovie ? undefined : item.thumbnailUrl));
          const isActive = Boolean(activeSourceUrl && activeSourceUrl === src.url);

          return (
            <article
              key={src.id || idx}
              className={cn(
                'p-3.5 sm:p-4 rounded-xl border transition-all shadow-2xs flex flex-col sm:flex-row gap-4 items-start group relative',
                isActive
                  ? 'border-[#3F7D58] bg-[#3F7D58]/5 ring-1 ring-[#3F7D58]/30 shadow-xs'
                  : 'border-black/10 bg-surface/95 hover:bg-surface'
              )}
            >
              {/* 左側 / 上方：影片縮圖 (點擊於上方直接內嵌播放或檢視) */}
              <div
                onClick={(e) => {
                  if (onSelectSource) {
                    e.preventDefault();
                    onSelectSource({
                      url: cleanUrl,
                      thumbnailUrl: thumbToDisplay,
                      title: src.title,
                    });
                  }
                }}
                className={cn(
                  'rounded-lg overflow-hidden shrink-0 border border-black/10 bg-stone-900 relative group/thumb shadow-sm block cursor-pointer',
                  is169 ? 'w-36 sm:w-48 aspect-[16/9]' : 'w-24 sm:w-32 aspect-[9/16]'
                )}
                title={isYt ? '點擊於上方直接內嵌播放' : '點擊於上方檢視貼文筆記'}
              >
                <CoverImage
                  thumbnailUrl={thumbToDisplay}
                  title={src.title}
                  category={isMovie ? 'general' : item.category}
                  url={cleanUrl}
                  id={src.id || item.id}
                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500"
                />

                {/* 平台識別小膠囊 */}
                <div className="absolute top-2 left-2 z-10">
                  <span
                    className={cn(
                      'text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-xs tracking-wider uppercase',
                      platform.badgeClass
                    )}
                  >
                    {platform.name}
                  </span>
                </div>

                {/* 播放/檢視按鈕疊加 */}
                <div className="absolute inset-0 bg-black/35 group-hover/thumb:bg-black/20 flex items-center justify-center transition-colors">
                  <div className="w-8 h-8 rounded-full bg-black/75 group-hover/thumb:bg-black/90 flex items-center justify-center text-white shadow-lg group-hover/thumb:scale-110 transition-transform">
                    {isYt ? (
                      <Play className="w-4 h-4 fill-white text-white ml-0.5" />
                    ) : (
                      <ExternalLink className="w-4 h-4 text-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* 右側 / 下方：貼文標題、作者、核心觀點摘要與操作按鈕 */}
              <div className="flex-1 min-w-0 space-y-2.5 w-full">
                {/* 頂部標註與刪除按鈕 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-xs font-sans font-bold px-2 py-0.5 rounded-sm bg-accent/10 text-accent border border-dashed border-accent/30 shrink-0">
                      觀點筆記 #{idx + 1}
                    </span>
                    {src.author && (
                      <span className="text-xs font-bold text-ink truncate font-sans">
                        @{src.author}
                      </span>
                    )}
                    <span className="text-xs font-sans text-ink-3">
                      {src.addedAt}
                    </span>
                  </div>

                  {/* 若有多篇來源，提供單獨刪除某一筆影評的按鈕 */}
                  {displaySources.length > 1 && src.id && !src.id.startsWith('src_orig_') && (
                    <button
                      type="button"
                      onClick={() => deleteSourcePost(item.id, src.id)}
                      className="text-ink-3 hover:text-rose-500 p-1 rounded-control hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="從本電影移除此篇影評"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* 影片原始標題 */}
                <h5 className="text-xs sm:text-sm font-bold text-ink leading-snug line-clamp-2">
                  {src.title}
                </h5>

                {/* AI 整理的核心觀點摘要 */}
                {src.summary && (
                  <div className="bg-surface-2/70 p-3 rounded-xl border border-line/60 text-xs sm:text-sm text-ink-2 leading-relaxed space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-ink-3 mb-1">
                      <Sparkles className="w-3 h-3 text-accent" />
                      <span>{noteHeading}</span>
                    </div>
                    <p className="whitespace-pre-line text-xs sm:text-sm">
                      {src.summary}
                    </p>
                  </div>
                )}

                {/* 操作按鈕組：於上方播放/檢視 ＋ 前往原平台 */}
                <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {onSelectSource && (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectSource({
                            url: cleanUrl,
                            thumbnailUrl: thumbToDisplay,
                            title: src.title,
                          })
                        }
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control font-bold text-xs transition-all shadow-2xs cursor-pointer active:scale-95',
                          isActive
                            ? 'bg-[#3F7D58] text-white'
                            : 'bg-[#3F7D58]/15 hover:bg-[#3F7D58] text-[#3F7D58] hover:text-white'
                        )}
                      >
                        {isYt ? (
                          <Play className="w-3 h-3 fill-current" />
                        ) : (
                          <Film className="w-3 h-3" />
                        )}
                        <span>
                          {isActive
                            ? isYt
                              ? '✓ 現正播放中'
                              : '✓ 現正檢視中'
                            : isYt
                            ? '於上方播放此影片'
                            : '檢視此貼文筆記'}
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface-2 hover:bg-surface text-ink-2 hover:text-ink border border-line font-medium text-xs transition-all shadow-2xs cursor-pointer group/btn"
                    >
                      🔗 前往原始貼文
                    </a>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(src.url);
                          addToast({ type: 'success', message: '📋 已複製連結' });
                        } catch {
                          const textarea = document.createElement('textarea');
                          textarea.value = src.url;
                          textarea.style.position = 'fixed';
                          textarea.style.opacity = '0';
                          document.body.appendChild(textarea);
                          textarea.select();
                          document.execCommand('copy');
                          document.body.removeChild(textarea);
                          addToast({ type: 'success', message: '📋 已複製連結' });
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-control bg-surface-2 hover:bg-surface text-ink-3 hover:text-ink border border-line text-xs font-medium transition-all cursor-pointer shadow-2xs"
                      title="複製連結"
                    >
                      <span>📋 複製連結</span>
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
