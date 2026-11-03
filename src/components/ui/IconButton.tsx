import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'secondary' | 'subtle' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  'aria-label': string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center shrink-0 transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

    const sizeClasses = {
      sm: 'h-8 w-8 rounded-control text-xs',
      md: 'h-9 w-9 rounded-control text-sm',
      lg: 'h-10 w-10 rounded-control text-base',
    }[size];

    const variantClasses = {
      ghost:
        'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink active:scale-95',
      secondary:
        'bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong active:scale-95 shadow-sm',
      subtle:
        'bg-surface-2 text-ink-2 hover:text-ink hover:bg-ink/5 active:scale-95',
      accent:
        'bg-accent text-white hover:bg-accent/90 active:scale-95 shadow-sm',
      danger:
        'bg-danger/10 text-danger hover:bg-danger/20 active:scale-95 border border-danger/20',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseClasses, sizeClasses, variantClasses, className)}
        {...props}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
