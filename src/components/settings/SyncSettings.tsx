'use client';

import React from 'react';
import { useAppState } from '@/providers/AppStateProvider';
import { SettingsGroup } from './SettingsGroup';
import { CloudCheck, HardDrive, CheckCircle2 } from 'lucide-react';

export function SyncSettings() {
  const { isCloudSync, items } = useAppState();

  return (
    <SettingsGroup
      title="雲端資料庫與離線快取"
      description="Memo 自動在背景即時同步至 Firebase Firestore 與瀏覽器 LocalStorage 快取。"
    >
      <div className="space-y-3">
        <div className="p-3 rounded-control bg-surface-2 border border-line flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <span
              className={`p-2 rounded-control border ${
                isCloudSync
                  ? 'bg-success/10 text-success border-success/20'
                  : 'bg-surface text-ink-3 border-line'
              }`}
            >
              {isCloudSync ? (
                <CloudCheck className="w-4 h-4" />
              ) : (
                <HardDrive className="w-4 h-4" />
              )}
            </span>
            <div>
              <span className="font-semibold text-ink block">
                {isCloudSync
                  ? 'Firebase Firestore 雲端即時同步中'
                  : '本機瀏覽器 LocalStorage 快取模式'}
              </span>
              <span className="text-ink-3">
                {isCloudSync
                  ? '手機與電腦跨裝置無縫同步，即使重新整理也不會遺失。'
                  : '未填寫 Firebase 設定檔，目前以本機安全快取運行。'}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0 pl-2">
            <span className="font-mono text-sm font-bold text-ink">
              {items.length} 筆
            </span>
            <span className="text-[10px] text-ink-3 block">已收藏項目</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-ink-3 pt-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          <span>背景信箱佇列運作中，iPhone 捷徑寫入後將在 8 秒內自動呈現在畫面上。</span>
        </div>

        {/* iOS Web App 專用手動強制重整按鈕 */}
        <div className="p-3 rounded-control bg-surface border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div>
            <span className="font-semibold text-ink block">📱 手機/平板 Web App 強制重新整理</span>
            <span className="text-[11px] text-ink-3">
              在 iOS 主畫面 Web App 無法按 F5 時，點擊此處可清除過期 JS 模組快取並立即重新載入。
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (typeof window !== 'undefined') {
                if ('caches' in window) {
                  try {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k)));
                  } catch {}
                }
                if ('serviceWorker' in navigator) {
                  try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map((r) => r.unregister()));
                  } catch {}
                }
                const url = new URL(window.location.href);
                url.searchParams.set('_bust', Date.now().toString());
                window.location.href = url.toString();
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 border border-line font-bold text-ink shrink-0 cursor-pointer active:scale-95 transition-all text-xs"
          >
            🧹 清除快取並重整
          </button>
        </div>
      </div>
    </SettingsGroup>
  );
}
