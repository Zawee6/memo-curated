import {
  Home,
  UtensilsCrossed,
  MapPin,
  Film,
  ShoppingBag,
  Sliders,
  LucideIcon,
} from 'lucide-react';

export interface NavItemConfig {
  href: string;
  label: string;
  shortLabel: string;
  enLabel: string;
  icon: LucideIcon;
  badgeKey?: 'items' | 'recipes' | 'places' | 'collections' | 'picks';
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    href: '/',
    label: '總覽與快貼',
    shortLabel: '總覽',
    enLabel: 'Overview',
    icon: Home,
    badgeKey: 'items',
  },
  {
    href: '/recipes',
    label: '食譜私廚',
    shortLabel: '食譜',
    enLabel: 'Recipes',
    icon: UtensilsCrossed,
    badgeKey: 'recipes',
  },
  {
    href: '/places',
    label: '景點與地圖',
    shortLabel: '景點',
    enLabel: 'Places',
    icon: MapPin,
    badgeKey: 'places',
  },
  {
    href: '/collections',
    label: '電影與影集',
    shortLabel: '電影',
    enLabel: 'Movies',
    icon: Film,
    badgeKey: 'collections',
  },
  {
    href: '/picks',
    label: '好物與帳號',
    shortLabel: '好物',
    enLabel: 'Picks',
    icon: ShoppingBag,
    badgeKey: 'picks',
  },
  {
    href: '/settings',
    label: '捷徑與設定',
    shortLabel: '設定',
    enLabel: 'Settings',
    icon: Sliders,
  },
];
