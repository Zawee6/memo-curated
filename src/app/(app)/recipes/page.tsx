import React from 'react';
import { RecipesView } from '@/components/recipes/RecipesView';

export const metadata = {
  title: '食譜私廚與採買 — Memo',
  description: '動態換算用餐人數、AI 從收藏庫推薦省錢配菜組合，並連線大潤發、家樂福、全聯、好市多即時查價結算。',
};

export default function RecipesPage() {
  return <RecipesView />;
}
