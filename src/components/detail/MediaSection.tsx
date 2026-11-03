import React from 'react';
import { MediaInfo } from '@/types/item';
import { Film, User, Calendar, Tag } from 'lucide-react';

export function MediaSection({ mediaInfo }: { mediaInfo: MediaInfo }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-cat-media uppercase tracking-wider font-mono">
        <Film className="w-3.5 h-3.5" />
        <span>影音與出版資訊</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {mediaInfo.creator && (
          <div className="flex items-center gap-2 p-2 rounded-control bg-surface-2/60 border border-line text-xs">
            <User className="w-3.5 h-3.5 text-ink-3 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-ink-3 block">作者 / 創作者</span>
              <span className="font-medium text-ink">{mediaInfo.creator}</span>
            </div>
          </div>
        )}
        {mediaInfo.releaseYear && (
          <div className="flex items-center gap-2 p-2 rounded-control bg-surface-2/60 border border-line text-xs">
            <Calendar className="w-3.5 h-3.5 text-ink-3 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-ink-3 block">發行年份</span>
              <span className="font-medium text-ink font-mono">{mediaInfo.releaseYear}</span>
            </div>
          </div>
        )}
        {mediaInfo.genre && (
          <div className="flex items-center gap-2 p-2 rounded-control bg-surface-2/60 border border-line text-xs">
            <Tag className="w-3.5 h-3.5 text-ink-3 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] text-ink-3 block">類型風格</span>
              <span className="font-medium text-ink">{mediaInfo.genre}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
