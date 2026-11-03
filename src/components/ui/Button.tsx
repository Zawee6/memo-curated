import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'subtle' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium transition-all duration-150 select-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

    const sizeClasses = {
      sm: 'h-8 px-3 text-xs rounded-control gap-1.5',
      md: 'h-10 px-4 text-sm rounded-control gap-2',
      lg: 'h-12 px-5 text-base rounded-control gap-2.5',
    }[size];

    const variantClasses = {
      primary:
        'bg-ink text-surface hover:bg-ink/90 active:scale-[0.98] shadow-sm',
      accent:
        'bg-accent text-white hover:bg-accent/90 active:scale-[0.98] shadow-sm',
      secondary:
        'bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong active:scale-[0.98]',
      ghost:
        'bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink active:scale-[0.98]',
      subtle:
        'bg-surface-2 text-ink-2 hover:text-ink hover:bg-ink/5 active:scale-[0.98]',
      danger:
        'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20 active:scale-[0.98]',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseClasses, sizeClasses, variantClasses, className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
