'use client';

import React, { useState, useEffect } from 'react';
import { useAppState } from '@/providers/AppStateProvider';
import { SpaceShareCard } from './SpaceShareCard';
import { GeminiKeySettings } from './GeminiKeySettings';
import { ShortcutInstallCard } from './ShortcutInstallCard';
import { NotificationSettings } from './NotificationSettings';
import { ConnectionSettings } from './ConnectionSettings';
import { SyncSettings } from './SyncSettings';
import { InventoryManager } from './InventoryManager';
import { SettingsGroup } from './SettingsGroup';
import { QueueStatusPill } from '@/components/layout/QueueStatusPill';
import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';

export function SettingsView() {
  const { clearAll, items, isHostAdmin } = useAppState();
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  async function handleClearAll() {
    await clearAll();
    setIsConfirmingClear(false);
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-[11px] font-mono text-ink-3 uppercase tracking-wider">
          <span>System & Workflow Configuration</span>
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-ink">
          系統與捷徑設定
        </h1>
        <p className="text-xs md:text-sm text-ink-3">
          管理多人獨立空間與好友分享、iPhone 捷徑安裝、區網與外網穿透狀態、雲端同步資料庫與常備倉儲庫存。
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        <GeminiKeySettings />
        {isHostAdmin && <SpaceShareCard />}
        <ShortcutInstallCard />
        <NotificationSettings />
        <ConnectionSettings />
        <SyncSettings />
        <InventoryManager />

        {/* Background Queue */}
        <SettingsGroup
          title="⚡ 背景處理佇列 (Background Queue)"
          description="管理 iPhone 捷徑分享與剪貼簿網址非同步解析進度，支援即時狀態監控、手動觸發與錯誤重試。"
        >
          <QueueStatusPill variant="embedded" />
        </SettingsGroup>

        {/* Danger Zone */}
        <SettingsGroup
          title="資料重置與危險區域"
          description="清空本地快取與雲端 Firestore 中的所有靈感卡片、地圖座標與採買推車紀錄。"
          className="border-danger/20"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-control bg-danger/5 border border-danger/15 text-xs">
            <div>
              <span className="font-semibold text-danger block">
                清空所有收藏資料庫
              </span>
              <span className="text-ink-3">
                目前共有 {items.length} 筆收藏。此動作無法復原。
              </span>
            </div>

            {isConfirmingClear ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  onClick={handleClearAll}
                >
                  確認全部清空
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsConfirmingClear(false)}
                >
                  取消
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setIsConfirmingClear(true)}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                清空所有卡片
              </Button>
            )}
          </div>
        </SettingsGroup>
      </div>
    </div>
  );
}
