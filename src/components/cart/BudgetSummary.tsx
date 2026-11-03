'use client';

import React, { useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { MergedStoreGroup, exportShoppingListToMarkdown } from '@/lib/cart';
import { Button } from '@/components/ui/Button';
import { ShoppingBag, Copy, Check, Download, RotateCcw } from 'lucide-react';
import { useAppState } from '@/providers/AppStateProvider';

export function BudgetSummary({
  groups,
  totalCost,
  totalItemsCount,
  checkedCount,
  onResetChecks,
}: {
  groups: MergedStoreGroup[];
  totalCost: number;
  totalItemsCount: number;
  checkedCount: number;
  onResetChecks: () => void;
}) {
  const { addToast } = useAppState();
  const [copied, setCopied] = useState(false);

  const percent =
    totalItemsCount > 0 ? Math.round((checkedCount / totalItemsCount) * 100) : 0;

  function handleCopyMarkdown() {
    const md = exportShoppingListToMarkdown(groups, totalCost);
    navigator.clipboard.writeText(md);
    setCopied(true);
    addToast({
      type: 'success',
      message: '已將採買清單複製為 Markdown 格式！可直接貼至 LINE 或 Notion。',
    });
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadMarkdown() {
    const md = exportShoppingListToMarkdown(groups, totalCost);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Memo-採買清單-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({
      type: 'success',
      message: '採買清單 .md 檔案已開始下載！',
    });
  }

  return (
    <div className="rounded-card border border-line bg-surface p-5 md:p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
        {/* Total Cost */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent font-mono">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>合併預估總花費</span>
          </div>
          <div className="font-mono text-2xl md:text-4xl font-extrabold text-ink">
            {formatCurrency(totalCost)}
          </div>
          <p className="text-xs text-ink-3">
            涵蓋 {groups.length} 大賣場 • 共 {totalItemsCount} 項採買物資
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCopyMarkdown}
            leftIcon={
              copied ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-ink-3" />
              )
            }
          >
            {copied ? '已複製清單' : '複製 Markdown'}
          </Button>

          <Button
            size="sm"
            variant="subtle"
            onClick={handleDownloadMarkdown}
            leftIcon={<Download className="w-3.5 h-3.5 text-ink-3" />}
          >
            下載 .md
          </Button>

          {checkedCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onResetChecks}
              leftIcon={<RotateCcw className="w-3.5 h-3.5 text-ink-3" />}
            >
              重置勾選
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 pt-2 border-t border-line">
        <div className="flex items-center justify-between text-xs text-ink-2">
          <span>採買進度</span>
          <span className="font-mono font-medium">
            {checkedCount} / {totalItemsCount} 件 ({percent}%)
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-2 overflow-hidden border border-line">
          <div
            className="h-full bg-accent transition-all duration-300 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
