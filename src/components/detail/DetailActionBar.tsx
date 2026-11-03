'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useAppState } from '@/providers/AppStateProvider';
import { Copy, Check, Trash2 } from 'lucide-react';

export function DetailActionBar({
  url,
  onDelete,
}: {
  url: string;
  onDelete: () => void;
}) {
  const { addToast } = useAppState();
  const [copied, setCopied] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      addToast({
        type: 'success',
        message: '📋 已複製連結',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      addToast({
        type: 'success',
        message: '📋 已複製連結',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control text-xs font-semibold bg-surface text-ink border border-line hover:bg-surface-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-2xs active:scale-95"
          >
            🔗 前往原始貼文
          </a>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-control text-xs font-semibold bg-surface text-ink-3 hover:text-ink border border-line hover:bg-surface-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
          title="複製連結"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-success shrink-0" />
              <span>已複製</span>
            </>
          ) : (
            <span>📋 複製連結</span>
          )}
        </button>
      </div>

      {isConfirmingDelete ? (
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          <Button
            size="sm"
            variant="danger"
            onClick={onDelete}
            className="shrink-0 whitespace-nowrap"
          >
            確定刪除
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsConfirmingDelete(false)}
            className="shrink-0 whitespace-nowrap"
          >
            取消
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsConfirmingDelete(true)}
          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-control text-xs font-medium text-ink-3 hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          title="刪除此收藏"
        >
          <Trash2 className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">刪除</span>
        </button>
      )}
    </div>
  );
}

