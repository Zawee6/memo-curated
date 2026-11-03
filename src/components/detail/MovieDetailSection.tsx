'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ParsedItem, MovieShowtimeResponse } from '@/types/item';
import { useAppState } from '@/providers/AppStateProvider';
import {
  Film,
  Ticket,
  Clock,
  Sparkles,
  ExternalLink,
  Tv,
  Star,
  Image as ImageIcon,
  Check,
  Search,
  Calendar,
  User,
  RefreshCw,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { cleanMediaTitle } from '@/lib/streamingLinks';

function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

export function MovieDetailSection({ item }: { item: ParsedItem }) {
  const { saveItem, addToast, syncFromServer, spaceId } = useAppState();
  const mediaInfo = item.mediaInfo;

  const [showtimesData, setShowtimesData] =
    useState<MovieShowtimeResponse | null>(null);
  const [isLoadingShowtimes, setIsLoadingShowtimes] = useState(false);
  const [currentPoster, setCurrentPoster] = useState<string | undefined>(
    mediaInfo?.posterUrl
  );
  const [isUpdatingCover, setIsUpdatingCover] = useState(false);
  const [isSyncingImdb, setIsSyncingImdb] = useState(false);
  const [isReEnriching, setIsReEnriching] = useState(false);

  const movieTitle = mediaInfo?.movieTitle || item.title;
  const originalTitle = mediaInfo?.originalTitle;
  const officialPoster = currentPoster || mediaInfo?.posterUrl;
  const reelCover = item.thumbnailUrl;

  // 手動重新更新電影官方完整資料（官方大綱、IMDb 評分、海報、串流）
  async function handleReEnrichMovie() {
    setIsReEnriching(true);
    try {
      const res = await fetch('/memo/api/movies/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (data.success && data.item) {
        if (data.item.mediaInfo?.posterUrl) {
          setCurrentPoster(data.item.mediaInfo.posterUrl);
        }
        await syncFromServer();
        addToast({
          type: 'success',
          message: `✨ 已成功更新《${data.item.title}》的官方簡介、IMDb 評分與串流資料！`,
        });
      } else {
        throw new Error(data.error || '更新失敗');
      }
    } catch (e) {
      addToast({
        type: 'error',
        message: e instanceof Error ? e.message : '更新電影資料失敗',
      });
    } finally {
      setIsReEnriching(false);
    }
  }

  // 手動從 IMDb 重新同步最新官方海報與真實評分
  async function handleSyncImdb() {
    if (!movieTitle) return;
    setIsSyncingImdb(true);
    try {
      const res = await fetch('/memo/api/movies/imdb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: movieTitle,
          originalTitle: originalTitle,
          releaseYear: mediaInfo?.releaseYear,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const newMediaInfo = {
          ...item.mediaInfo,
          movieTitle: data.movieTitle || item.mediaInfo?.movieTitle || movieTitle,
          originalTitle: data.originalTitle || item.mediaInfo?.originalTitle,
          posterUrl: data.posterUrl || item.mediaInfo?.posterUrl,
          imdbId: data.imdbId || item.mediaInfo?.imdbId,
          imdbRating: data.imdbRating || item.mediaInfo?.imdbRating,
          imdbRatingCount: data.imdbRatingCount || item.mediaInfo?.imdbRatingCount,
          director: data.director || item.mediaInfo?.director,
          releaseYear: data.releaseYear || item.mediaInfo?.releaseYear,
        };

        if (data.posterUrl) {
          setCurrentPoster(data.posterUrl);
        }

        const updatedItem = {
          ...item,
          title: data.movieTitle || item.title,
          thumbnailUrl: data.posterUrl || item.thumbnailUrl,
          mediaInfo: newMediaInfo,
        };

        await saveItem(updatedItem);

        // 同步寫入後端
        await fetch('/memo/api/items', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-space-id': spaceId,
          },
          body: JSON.stringify({
            id: item.id,
            spaceId,
            title: updatedItem.title,
            thumbnailUrl: updatedItem.thumbnailUrl,
            mediaInfo: newMediaInfo,
          }),
        });

        addToast({
          type: 'success',
          message: `✅ 已成功從 IMDb 同步「${data.movieTitle || movieTitle}」海報與評分 (★ ${data.imdbRating || '無評分'})！`,
        });
      } else {
        addToast({
          type: 'warning',
          message: data.error || 'IMDb 未找到相關電影資料。',
        });
      }
    } catch (e) {
      addToast({
        type: 'error',
        message: '同步 IMDb 資料失敗，請稍後再試。',
      });
    } finally {
      setIsSyncingImdb(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    async function fetchShowtimes() {
      if (!movieTitle) return;
      setIsLoadingShowtimes(true);
      try {
        const res = await fetch('/memo/api/movies/showtimes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            movieTitle,
            originalTitle,
          }),
        });
        const data: MovieShowtimeResponse = await res.json();
        if (isMounted && data.success) {
          setShowtimesData(data);
        }
      } catch (e) {
        console.warn('Failed to load movie showtimes:', e);
      } finally {
        if (isMounted) setIsLoadingShowtimes(false);
      }
    }

    fetchShowtimes();
    return () => {
      isMounted = false;
    };
  }, [movieTitle, originalTitle]);

  // 將官方高清海報設為卡片封面
  async function handleSetCover(targetUrl: string) {
    if (item.thumbnailUrl === targetUrl) return;
    setIsUpdatingCover(true);
    try {
      await saveItem({
        ...item,
        thumbnailUrl: targetUrl,
      });
      addToast({
        type: 'success',
        message: '✅ 已將官方電影海報設為本卡片封面！',
      });
    } catch (e) {
      addToast({ type: 'error', message: '更新封面失敗。' });
    } finally {
      setIsUpdatingCover(false);
    }
  }

  const isCurrentCoverOfficialPoster =
    officialPoster && item.thumbnailUrl === officialPoster;

  const themeColor = mediaInfo?.themeColor;

  return (
    <div
      className="space-y-5 rounded-xl border border-black/10 bg-surface-2/40 p-4 sm:p-5 shadow-2xs relative overflow-hidden"
      style={{
        boxShadow: themeColor ? `0 0 40px -10px ${themeColor}1a` : undefined,
      }}
    >
      {/* 官方主題色大氣背光 (Atmospheric Theme Backglow) */}
      {themeColor && (
        <div
          className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-25 pointer-events-none transition-all"
          style={{ backgroundColor: themeColor }}
        />
      )}

      {/* 頂部電影與影評標題 */}
      <div className="flex items-center justify-between border-b border-black/10 pb-3 relative z-10">
        <div className="flex items-center gap-2 font-sans text-base font-bold text-cat-media uppercase tracking-wide">
          <Film className="w-4 h-4" />
          <span>手帳電影筆記 · 影城放映</span>
          {themeColor && (
            <span
              className="w-2.5 h-2.5 rounded-full inline-block border border-black/20"
              style={{ backgroundColor: themeColor }}
              title={`電影代表色：${themeColor}`}
            />
          )}
        </div>

        {/* IMDb 評分或常規評分 (復古印章) */}
        {mediaInfo?.imdbRating ? (
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-amber-400/20 text-amber-800 border border-dashed border-amber-600 text-xs font-sans font-bold shadow-2xs stamp-pop"
            title="IMDb 官方評分"
          >
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>★ IMDb {mediaInfo.imdbRating}</span>
          </div>
        ) : mediaInfo?.rating ? (
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm bg-amber-400/15 text-amber-800 border border-dashed border-amber-500 text-xs font-sans font-bold">
            <Star className="w-3 h-3 fill-current" />
            <span>{mediaInfo.rating}</span>
          </div>
        ) : null}
      </div>

      {/* 電影主要資訊 */}
      <div className="space-y-1.5 relative z-10">
        <h4 className="font-display text-lg sm:text-xl font-bold text-ink leading-snug">
          {movieTitle}
        </h4>
        {originalTitle && (
          <p className="text-xs text-ink-3 font-mono">{originalTitle}</p>
        )}
      </div>

      {/* 導演、年份、類型膠囊 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs relative z-10">
        {mediaInfo?.director && (
          <div className="p-2 rounded-control bg-surface-2 border border-line flex items-center gap-2 min-w-0">
            <User className="w-3.5 h-3.5 text-ink-3 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-ink-3 block">導演</span>
              <span className="font-medium text-ink truncate block">
                {mediaInfo.director}
              </span>
            </div>
          </div>
        )}

        {mediaInfo?.releaseYear && (
          <div className="p-2 rounded-control bg-surface-2 border border-line flex items-center gap-2 min-w-0">
            <Calendar className="w-3.5 h-3.5 text-ink-3 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-ink-3 block">上映年份</span>
              <span className="font-medium text-ink font-mono block">
                {mediaInfo.releaseYear}
              </span>
            </div>
          </div>
        )}

        {/* 類型展示：優先使用精準 genres 陣列，無則降級為 genre 字串 */}
        {mediaInfo?.genres && mediaInfo.genres.length > 0 ? (
          <div className="p-2 rounded-control bg-surface-2 border border-line flex items-center gap-2 min-w-0 col-span-2 sm:col-span-1">
            <Film className="w-3.5 h-3.5 text-ink-3 shrink-0" />
            <div className="truncate flex-1">
              <span className="text-[10px] text-ink-3 block">電影類型</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {mediaInfo.genres.map((g, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.2 rounded-xs bg-black/5 dark:bg-white/10 text-[11px] font-medium text-ink shrink-0 whitespace-nowrap"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : mediaInfo?.genre ? (
          <div className="p-2 rounded-control bg-surface-2 border border-line flex items-center gap-2 min-w-0 col-span-2 sm:col-span-1">
            <Film className="w-3.5 h-3.5 text-ink-3 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-ink-3 block">電影類型</span>
              <span className="font-medium text-ink truncate block">
                {mediaInfo.genre}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* 官方電影海報與 IMDb 同步控制區 */}
      <div className="p-3 rounded-control bg-surface-2/70 border border-line flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-accent shrink-0" />
          <div>
            <span className="font-semibold text-ink block">
              {officialPoster ? 'IMDb 官方 One-Sheet (27:40) 海報已就緒' : '未同步 IMDb 官方海報'}
            </span>
            <span className="text-[11px] text-ink-3 block">
              {mediaInfo?.imdbId ? (
                <>
                  IMDb ID: <span className="font-mono text-accent">{mediaInfo.imdbId}</span> • 評分: ★ {mediaInfo.imdbRating || '暫無'}
                </>
              ) : (
                '尚未連結 IMDb 資料'
              )}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {officialPoster && !isCurrentCoverOfficialPoster && (
            <button
              type="button"
              disabled={isUpdatingCover}
              onClick={() => handleSetCover(officialPoster)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-accent/10 hover:bg-accent/20 text-accent font-semibold text-xs transition-colors cursor-pointer"
            >
              <Check className="w-3 h-3" />
              <span>設為外層封面</span>
            </button>
          )}

          <button
            type="button"
            disabled={isReEnriching}
            onClick={handleReEnrichMovie}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-control bg-[#C84B31] hover:bg-[#b03d25] text-white font-semibold text-xs transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="手動呼叫更新：透過維基百科、IMDb 與 Gemini 重新取得官方劇情大綱、上映年份、串流平台與評分"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isReEnriching && 'animate-spin')} />
            <span>{isReEnriching ? '更新中...' : '🔄 重新更新電影資料'}</span>
          </button>

          <button
            type="button"
            disabled={isSyncingImdb}
            onClick={handleSyncImdb}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-control bg-surface hover:bg-surface-2 border border-line text-ink hover:text-accent font-semibold text-xs transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
            title="從 IMDb Suggestion API 重新抓取 1000px 高清 One-Sheet 海報與真實評分"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isSyncingImdb && 'animate-spin text-accent')} />
            <span>{isSyncingImdb ? '同步中...' : 'IMDb 海報'}</span>
          </button>
        </div>
      </div>

      {/* 🎟️ 嘉義影城即時檔期專區（若已下檔或兩院均無場次，則完全自動隱藏） */}
      {(() => {
        const activeTheaters = (showtimesData?.theaters || []).filter(
          (t) => t.hasShowtimes && t.times && t.times.length > 0
        );
        const hasAnyChiayiShowtimes = activeTheaters.length > 0;

        return (
          <div className="space-y-4 pt-1">
            {isLoadingShowtimes && (
              <div className="p-4 rounded-xl border border-line bg-surface-2 flex items-center justify-center gap-2.5 text-ink-3 text-xs">
                <Clock className="w-4 h-4 animate-spin text-accent" />
                <span>即時連線查詢嘉義「嘉年華影城」與「in89 豪華影城」時刻表中...</span>
              </div>
            )}

            {/* 嘉義影城時刻表與直達捷徑區塊（常駐顯示） */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-[#E07A5F]" />
                  <span className="font-display text-sm font-bold text-ink">
                    🎟️ 嘉義戲院放映時刻表
                  </span>
                  {!isLoadingShowtimes && hasAnyChiayiShowtimes && (
                    <span className="px-2.5 py-0.5 rounded-sm text-xs font-sans font-bold border border-dashed border-emerald-600 bg-emerald-500/10 text-emerald-700">
                      院線熱映中
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(movieTitle);
                      addToast({ type: 'success', message: '📋 已複製片名' });
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-surface hover:bg-surface-2 text-ink border border-line shadow-2xs transition-all cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>📋 複製片名：{movieTitle}</span>
                  </button>
                </div>
              </div>

              {/* 若嘉義兩大影城有實際上映場次，呈現時刻表卡片 */}
              {!isLoadingShowtimes && hasAnyChiayiShowtimes && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeTheaters.map((theater, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg border border-dashed border-black/20 bg-surface hover:border-black/40 transition-all space-y-2.5 flex flex-col justify-between shadow-2xs relative"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-xs sm:text-sm text-ink flex items-center gap-1.5">
                            <span>{theater.name}</span>
                          </h5>
                          {theater.hallInfo && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-surface-2 text-ink-3 border border-black/10 font-mono">
                              {theater.hallInfo}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {theater.times.map((t, tIdx) => (
                            <span
                              key={tIdx}
                              className="px-2 py-0.5 rounded-xs bg-accent/10 border border-accent/25 text-accent font-mono text-xs font-bold"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 📺 串流平台資訊專區 */}
            <div className="space-y-3 pt-2 border-t border-line">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-display text-sm font-bold text-ink">
                    📺 串流平台資訊
                  </span>
                </div>

                {showtimesData?.status && (
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-chip text-xs font-bold border',
                      showtimesData.status === '上映中'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                        : showtimesData.status === '即將上映'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'
                        : 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25'
                    )}
                  >
                    {showtimesData.status}
                  </span>
                )}
              </div>

              {(() => {
                const combinedList = [...(mediaInfo?.streamingPlatforms || [])];
                if (showtimesData?.streamingPlatforms && Array.isArray(showtimesData.streamingPlatforms)) {
                  for (const name of showtimesData.streamingPlatforms) {
                    if (!combinedList.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
                      combinedList.push({ name, url: '', isAvailable: true });
                    }
                  }
                }
                const availableList = combinedList.filter((p) => p.isAvailable);
                const cleanTitle = cleanMediaTitle(movieTitle);

                return (
                  <div className="space-y-2.5">
                    {availableList.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {availableList.map((p, idx) => {
                          const directUrl =
                            p.url &&
                            p.url.startsWith('http') &&
                            !p.url.includes('google.com/search')
                              ? p.url
                              : undefined;

                          const goUrl = `/memo/api/streaming-go?platform=${encodeURIComponent(
                            p.name
                          )}&title=${encodeURIComponent(cleanTitle)}${
                            directUrl ? `&url=${encodeURIComponent(directUrl)}` : ''
                          }`;

                          return (
                            <a
                              key={idx}
                              href={goUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={`在 ${p.name} 上開啟《${cleanTitle}》`}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white font-bold text-xs shadow-xs',
                                'transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer group hover:shadow-md select-none',
                                p.name === 'Netflix' && 'bg-[#E50914] hover:bg-[#b80710]',
                                p.name === 'Disney+' && 'bg-[#0063e5] hover:bg-[#004ec2]',
                                p.name === 'Apple TV' && 'bg-neutral-800 hover:bg-neutral-700',
                                p.name === 'Catchplay+' && 'bg-orange-600 hover:bg-orange-500',
                                p.name === 'Prime Video' && 'bg-sky-600 hover:bg-sky-500',
                                (p.name === 'Max / HBO' || p.name === 'Max' || p.name === 'HBO') &&
                                  'bg-[#4d148c] hover:bg-[#3d1070]',
                                p.name === 'Hami Video' && 'bg-[#E3001B] hover:bg-[#b80016]',
                                p.name === 'YouTube 電影' && 'bg-[#FF0000] hover:bg-[#cc0000]',
                                !['Netflix', 'Disney+', 'Apple TV', 'Catchplay+', 'Prime Video', 'Max / HBO', 'Max', 'HBO', 'Hami Video', 'YouTube 電影'].includes(p.name) &&
                                  'bg-purple-600 hover:bg-purple-500'
                              )}
                            >
                              <span>✓ 已上架 {p.name}</span>
                              <ExternalLink className="w-3.5 h-3.5 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl border border-black/10 bg-surface-2/60 text-xs text-ink-3 flex items-center justify-between">
                        <span>目前台灣各大主流串流尚未正式上架本片</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* 🎬 相關影評與我收藏的筆記 */}
            {(() => {
              const userSources = item.sources || [];
              const ytReviews = mediaInfo?.youtubeReviews || [];
              const totalReviewsCount = userSources.length + ytReviews.length;

              return (
                <div className="space-y-3 pt-3 border-t border-line">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-cat-media" />
                      <span className="font-display text-sm font-bold text-ink">
                        🎬 相關影評與我收藏的筆記 ({totalReviewsCount})
                      </span>
                    </div>
                  </div>

                  {totalReviewsCount > 0 ? (
                    <div className="flex flex-col gap-3 w-full">
                      {/* 1. 使用者收藏的原始筆記與影評來源 */}
                      {userSources.map((src, idx) => {
                        const thumb = src.thumbnailUrl || reelCover;
                        return (
                          <div
                            key={src.id || `src_${idx}`}
                            className="group flex gap-3 p-2.5 sm:p-3 rounded-xl border border-black/10 bg-surface transition-all shadow-2xs items-start min-w-0 w-full"
                          >
                            <div className="relative w-24 sm:w-28 aspect-video rounded-lg overflow-hidden shrink-0 bg-stone-900 border border-black/10">
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt={src.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-stone-800 text-stone-400">
                                  <Sparkles className="w-4 h-4 text-accent" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5 space-y-1">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                  <span className="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                                    收藏筆記
                                  </span>
                                  {src.author && (
                                    <span className="text-[11px] text-ink-3 font-mono truncate max-w-[120px]">
                                      @{src.author}
                                    </span>
                                  )}
                                </div>
                                <h5 className="font-bold text-xs sm:text-sm text-ink line-clamp-2 leading-snug">
                                  {src.title}
                                </h5>
                                {src.summary && (
                                  <p className="text-[11px] sm:text-xs text-ink-2 line-clamp-2 leading-relaxed mt-0.5">
                                    {src.summary}
                                  </p>
                                )}
                              </div>
                              {src.url && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(src.url);
                                    addToast({ type: 'success', message: '📋 已複製網址' });
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-accent hover:underline pt-0.5 cursor-pointer self-start"
                                >
                                  <span>📋 複製此篇網址</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* 2. YouTube 熱門影評與深度解析 */}
                      {ytReviews.map((rev, idx) => (
                        <div
                          key={`yt_${idx}`}
                          className="group flex gap-3 p-2.5 sm:p-3 rounded-xl border border-black/10 bg-surface transition-all shadow-2xs items-start min-w-0 w-full"
                        >
                          <div className="relative w-24 sm:w-28 aspect-video rounded-lg overflow-hidden shrink-0 bg-stone-900 border border-black/10">
                            {rev.thumbnail ? (
                              <img
                                src={rev.thumbnail}
                                alt={rev.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-stone-800 text-stone-400">
                                <Film className="w-4 h-4" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5 space-y-1">
                            <div>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <YoutubeIcon className="w-3 h-3" />
                                  <span>YouTube 影評</span>
                                </span>
                                {rev.channelName && (
                                  <span className="text-[11px] text-ink-3 truncate font-mono max-w-[120px]">
                                    {rev.channelName}
                                  </span>
                                )}
                              </div>
                              <h5 className="font-bold text-xs sm:text-sm text-ink line-clamp-2 leading-snug">
                                {rev.title}
                              </h5>
                            </div>
                            {rev.url && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(rev.url);
                                  addToast({ type: 'success', message: '📋 已複製網址' });
                                }}
                                className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-red-600 hover:underline pt-0.5 cursor-pointer self-start"
                              >
                                <span>📋 複製影評網址</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        );
      })()}
    </div>
  );
}
