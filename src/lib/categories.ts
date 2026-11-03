import { Category } from '@/types/item';
import { MapPin, UtensilsCrossed, Film, Sparkles, LucideIcon } from 'lucide-react';

export interface CategoryMeta {
  key: Category;
  label: string;
  enLabel: string;
  description: string;
  icon: LucideIcon;
  badgeClass: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  place: {
    key: 'place',
    label: '探店私藏',
    enLabel: 'Places',
    description: '私房景點、咖啡館與在地美食',
    icon: MapPin,
    badgeClass: 'bg-[#5B7C5A]/10 text-[#3d573d] border-[#5B7C5A]/25',
    textClass: 'text-[#5B7C5A]',
    bgClass: 'bg-[#5B7C5A]/10',
    borderClass: 'border-[#5B7C5A]/25',
    dotClass: 'bg-[#5B7C5A]',
  },
  recipe: {
    key: 'recipe',
    label: '家常旬味',
    enLabel: 'Recipes',
    description: '私房食譜、料理工法與採買清單',
    icon: UtensilsCrossed,
    badgeClass: 'bg-[#B7791F]/10 text-[#855513] border-[#B7791F]/25',
    textClass: 'text-[#B7791F]',
    bgClass: 'bg-[#B7791F]/10',
    borderClass: 'border-[#B7791F]/25',
    dotClass: 'bg-[#B7791F]',
  },
  media: {
    key: 'media',
    label: '藝文影音',
    enLabel: 'Media',
    description: '電影、書籍、展覽與黑膠隨筆',
    icon: Film,
    badgeClass: 'bg-[#6B5B95]/10 text-[#4c3f6c] border-[#6B5B95]/25',
    textClass: 'text-[#6B5B95]',
    bgClass: 'bg-[#6B5B95]/10',
    borderClass: 'border-[#6B5B95]/25',
    dotClass: 'bg-[#6B5B95]',
  },
  general: {
    key: 'general',
    label: '隨想靈感',
    enLabel: 'Notes',
    description: '生活風格、好物與靈感筆記',
    icon: Sparkles,
    badgeClass: 'bg-[#78716C]/10 text-[#44403C] border-[#78716C]/25',
    textClass: 'text-[#78716C]',
    bgClass: 'bg-[#78716C]/10',
    borderClass: 'border-[#78716C]/25',
    dotClass: 'bg-[#78716C]',
  },
  account: {
    key: 'account',
    label: '推薦帳號',
    enLabel: 'Creators',
    description: '質感創作者與主題推薦帳號',
    icon: Sparkles,
    badgeClass: 'bg-[#0284C7]/10 text-[#0369A1] border-[#0284C7]/25',
    textClass: 'text-[#0284C7]',
    bgClass: 'bg-[#0284C7]/10',
    borderClass: 'border-[#0284C7]/25',
    dotClass: 'bg-[#0284C7]',
  },
  product: {
    key: 'product',
    label: '精選好物',
    enLabel: 'Picks',
    description: '3C科技、裝備與生活美物',
    icon: Sparkles,
    badgeClass: 'bg-[#EA580C]/10 text-[#C2410C] border-[#EA580C]/25',
    textClass: 'text-[#EA580C]',
    bgClass: 'bg-[#EA580C]/10',
    borderClass: 'border-[#EA580C]/25',
    dotClass: 'bg-[#EA580C]',
  },
};

export function getCategoryMeta(category?: Category | string): CategoryMeta {
  if (category && category in CATEGORIES) {
    return CATEGORIES[category as Category];
  }
  return CATEGORIES.general;
}
