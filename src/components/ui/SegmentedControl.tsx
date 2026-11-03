import React from 'react';
import { cn } from '@/lib/utils';

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: SegmentedControlProps<T>) {
  const sizeClasses = {
    sm: 'p-0.5 text-xs h-8',
    md: 'p-1 text-xs md:text-sm h-9',
  }[size];

  const itemSizeClasses = {
    sm: 'px-2.5 py-1 gap-1',
    md: 'px-3 py-1 gap-1.5',
  }[size];

  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center rounded-control bg-surface-2 border border-line select-none',
        sizeClasses,
        className
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center font-medium rounded-[8px] transition-all duration-150 cursor-pointer whitespace-nowrap',
              itemSizeClasses,
              isActive
                ? 'bg-surface text-ink shadow-xs font-semibold'
                : 'text-ink-2 hover:text-ink hover:bg-surface/40'
            )}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
