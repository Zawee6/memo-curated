import React from 'react';
import { PicksView } from '@/components/picks/PicksView';

export const metadata = {
  title: '精選好物與推薦帳號 — Memo',
  description: '精選質感推薦帳號與生活 3C 裝備美物。',
};

export default function ProductsPage() {
  return <PicksView />;
}
