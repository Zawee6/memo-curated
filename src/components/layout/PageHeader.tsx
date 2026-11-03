import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-line',
        className
      )}
    >
      <div className="space-y-1">
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs md:text-sm text-ink-3">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
