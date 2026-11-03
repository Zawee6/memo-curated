import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function FeedCardSkeleton() {
  return (
    <div className="aspect-[9/16] w-full bg-stone-900 border border-line rounded-2xl overflow-hidden relative flex flex-col justify-between p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="w-16 h-6 rounded-full bg-stone-800" />
        <Skeleton className="w-8 h-8 rounded-full bg-stone-800" />
      </div>

      <div className="space-y-2">
        <Skeleton className="w-full h-4 rounded bg-stone-800" />
        <Skeleton className="w-3/4 h-4 rounded bg-stone-800" />
        <Skeleton className="w-1/2 h-3 rounded bg-stone-800/80" />
      </div>
    </div>
  );
}
