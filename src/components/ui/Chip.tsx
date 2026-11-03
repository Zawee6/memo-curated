import React from 'react';
import { cn } from '@/lib/utils';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'default' | 'outline' | 'subtle' | 'accent';
  size?: 'sm' | 'md';
  count?: number;
  icon?: React.ReactNode;
}

export function Chip({
  className,
  active = false,
  variant = 'default',
  size = 'md',
  count,
  icon,
  children,
  ...props
}: ChipProps) {
  const sizeClasses = {
    sm: 'h-7 px-2.5 text-xs gap-1.5',
    md: 'h-8 px-3.5 text-xs md:text-sm gap-2',
  }[size];

  let variantClasses = 'bg-surface-2 text-ink-2 border border-transparent hover:border-line hover:text-ink';

  if (active) {
    variantClasses = 'bg-ink text-surface border-ink shadow-xs';
  } else if (variant === 'accent') {
    variantClasses = 'bg-accent-soft text-accent border border-accent/20 hover:bg-accent/15';
  } else if (variant === 'outline') {
    variantClasses = 'bg-surface text-ink-2 border border-line hover:border-line-strong hover:text-ink shadow-xs';
  }

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-chip transition-all duration-150 select-none cursor-pointer whitespace-nowrap active:scale-95 disabled:pointer-events-none disabled:opacity-50',
        sizeClasses,
        variantClasses,
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {typeof count === 'number' && (
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-mono font-semibold',
            active
              ? 'bg-surface/20 text-surface'
              : 'bg-line text-ink-2'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
