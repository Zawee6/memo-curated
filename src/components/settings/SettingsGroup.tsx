import React from 'react';
import { cn } from '@/lib/utils';

export function SettingsGroup({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface p-5 md:p-6 shadow-xs space-y-4',
        className
      )}
    >
      <div className="space-y-1">
        <h3 className="font-display text-base md:text-lg font-bold text-ink">
          {title}
        </h3>
        {description && (
          <p className="text-xs md:text-sm text-ink-3">
            {description}
          </p>
        )}
      </div>

      <div className="pt-2 border-t border-line space-y-3">{children}</div>
    </div>
  );
}
