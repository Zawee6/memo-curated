'use client';

import React, { useState, useMemo } from 'react';
import { Category } from '@/types/item';
import { CoverFallback } from './CoverFallback';
import { extractYouTubeVideoId, isInvalidThumbnail } from '@/lib/video';

export interface CoverImageProps {
  thumbnailUrl?: string | null;
  title: string;
  category: Category;
  url: string;
  id?: string;
  className?: string;
}

export function CoverImage({
  thumbnailUrl,
  title,
  category,
  url,
  id,
  className,
}: CoverImageProps) {
  const [hasError, setHasError] = useState(false);

  const ytVideoId = useMemo(() => extractYouTubeVideoId(url), [url]);

  const activeSrc = useMemo(() => {
    const validThumbnail =
      thumbnailUrl && !isInvalidThumbnail(thumbnailUrl)
        ? thumbnailUrl.replace(/&amp;/g, '&').trim()
        : null;

    // 1. 本地靜態海報 (例如 /posters/xxx.jpg 或 /memo/posters/xxx.jpg)
    if (validThumbnail && validThumbnail.startsWith('/')) {
      return validThumbnail.startsWith('/memo/') ? validThumbnail : `/memo${validThumbnail}`;
    }

    // 2. YouTube 官方 CDN 縮圖 (不需經過 proxy)
    if (
      validThumbnail &&
      (validThumbnail.includes('ytimg.com') || validThumbnail.includes('youtube.com'))
    ) {
      return validThumbnail;
    }

    // 3. 自癒型代理：只要有縮圖網址或原始貼文網址 (postUrl)，統一進入自癒 Proxy
    if (validThumbnail || (url && /^https?:\/\//i.test(url))) {
      const params = new URLSearchParams();
      if (validThumbnail) params.set('url', validThumbnail);
      if (url) params.set('postUrl', url);
      if (id) params.set('id', id);

      return `/memo/api/image-proxy?${params.toString()}`;
    }

    // 4. 若未存縮圖或縮圖無效，但為 YouTube 網址，使用標準官方高畫質縮圖 hqdefault.jpg
    if (ytVideoId) {
      return `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`;
    }

    return null;
  }, [ytVideoId, thumbnailUrl, url, id]);

  if (!activeSrc || hasError) {
    return (
      <div className={`relative overflow-hidden ${className || 'w-full h-full'}`}>
        <CoverFallback category={category} url={url} title={title} />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-stone-900 ${className || 'w-full h-full'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeSrc}
        alt={title}
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
      />
    </div>
  );
}
