import { Category, ParsedItem } from './item';

export type NavTab = 'feed' | 'map' | 'cart' | 'settings';

export type CategoryFilter = 'all' | Category;

export type ViewMode = 'grid' | 'compact' | 'editorial';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface DetailSheetState {
  isOpen: boolean;
  item: ParsedItem | null;
}

export interface FilterState {
  category: CategoryFilter;
  search: string;
  city?: string;
  tag?: string;
}
