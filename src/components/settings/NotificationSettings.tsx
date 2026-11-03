'use client';

import React, { useState, useEffect } from 'react';
import { SettingsGroup } from './SettingsGroup';
import { Button } from '@/components/ui/Button';
import { useAppState } from '@/providers/AppStateProvider';
import {
  Bell,
  Smartphone,
  Check,
  Send,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export function NotificationSettings() {
  const { addToast, spaceId, isDefaultSpace } = useAppState();
  const [barkKey, setBarkKey] = useState('');
  const [ntfyTopic, setNtfyTopic] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch(`/memo/api/notification?space=${encodeURIComponent(spaceId)}`, {
          headers: { 'x-space-id': spaceId },
        });
        const data = await res.json();
        if (data.success && data.config) {
          setBarkKey(data.config.barkKey || '');
          setNtfyTopic(data.config.ntfyTopic || '');
          setEnabled(data.config.enabled !== false);
        }
      } catch (e) {
        console.warn('Failed to load notification config:', e);
      }
    }
    fetchConfig();
  }, [spaceId]);

  async function handleSave() {
    setIsLoading(true);
    try {
      const res = await fetch(`/memo/api/notification?space=${encodeURIComponent(spaceId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-space-id': spaceId,
        },
        body: JSON.stringify({
          barkKey,
          ntfyTopic,
          enabled,
          spaceId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '儲存失敗');

      setSavedSuccess(true);
      addToast({
        type: 'success',
        message: `✓ 已成功儲存【${spaceId}】空間的 iPhone 推播設定！`,
      });
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '儲存失敗';
      addToast({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTestNotification() {
    if (!barkKey.trim() && !ntfyTopic.trim()) {
      addToast({
        type: 'info',
        message: '請先填入 Bark Device Key 或 ntfy Topic 才能測試推播！',
      });
      return;
    }

    setIsTesting(true);
    try {
      const res = await fetch(`/memo/api/notification?space=${encodeURIComponent(spaceId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-space-id': spaceId,
        },
        body: JSON.stringify({
          action: 'test',
          barkKey,
          ntfyTopic,
          enabled: true,
          spaceId,
          url: typeof window !== 'undefined' ? `${window.location.origin}/memo` : '',
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || '推播發送失敗');
      }

      addToast({
        type: 'success',
        message: `📲 ${data.message}！請檢查您的 iPhone 是否收到響鈴與通知。`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '測試失敗';
      addToast({ type: 'error', message: msg });
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <SettingsGroup
      title={`📱 iPhone 主動推播通知 (${isDefaultSpace ? '👑 主空間' : `👤 ${spaceId} 空間`})`}
      description="當 AI 在背景思考完「順路行程」或「今日私廚菜單」時，主動發送推播到您的 iPhone：「想好了，可以回來看囉！」"
    >
      <div className="space-y-4">
        {/* 指南卡片 */}
        <div className="p-3.5 rounded-xl bg-surface-2 border border-line text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-ink">
            <Zap className="w-4 h-4 text-accent" />
            <span>如何設定 iPhone 即時推播？（只需 1 分鐘）</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-ink-2 leading-relaxed pl-1">
            <li>
              在 iPhone 的 App Store 免費安裝{' '}
              <a
                href="https://apps.apple.com/app/bark-customed-notifications/id1403753865"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-accent hover:underline inline-flex items-center gap-0.5"
              >
                <span>Bark App</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>{' '}
              （台灣 iOS 首選推薦，免註冊即開即用）或{' '}
              <a
                href="https://apps.apple.com/app/ntfy/id1625396347"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-accent hover:underline inline-flex items-center gap-0.5"
              >
                <span>ntfy App</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              。
            </li>
            <li>開啟 App 複製您的專屬 Device Key，貼入下方並點擊儲存。</li>
            <li>點擊「🔔 測試推播」，確認 iPhone 響鈴跳出 Memo 通知即大功告成！</li>
          </ol>
        </div>

        {/* 表單欄位 */}
        <div className="space-y-3">
          {/* Bark Key */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink flex items-center justify-between">
              <span>Bark Device Key 或專屬網址</span>
              <span className="text-[10px] text-ink-3 font-normal font-mono">
                例如：https://api.day.app/YOUR_KEY/ 或純 key
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={barkKey}
                onChange={(e) => setBarkKey(e.target.value)}
                placeholder="貼上您的 Bark Device Key 或連結"
                className="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          {/* ntfy Topic (選填備援) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-ink flex items-center justify-between">
              <span>ntfy.sh Topic 名稱 (選填備用)</span>
              <span className="text-[10px] text-ink-3 font-normal font-mono">
                例如：my-memo-notifications
              </span>
            </label>
            <input
              type="text"
              value={ntfyTopic}
              onChange={(e) => setNtfyTopic(e.target.value)}
              placeholder="輸入自訂 ntfy Topic"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          {/* 啟用開關 */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-line text-accent focus:ring-accent cursor-pointer"
              />
              <span>啟用 AI 思考完成後主動推播至 iPhone</span>
            </label>
          </div>
        </div>

        {/* 底部操作按鈕列 */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-line">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleTestNotification}
            isLoading={isTesting}
            leftIcon={<Bell className="w-3.5 h-3.5 text-accent" />}
          >
            🔔 測試發送通知到 iPhone
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={isLoading}
            leftIcon={
              savedSuccess ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : (
                <Smartphone className="w-3.5 h-3.5" />
              )
            }
          >
            {savedSuccess ? '已儲存！' : '儲存推播設定'}
          </Button>
        </div>
      </div>
    </SettingsGroup>
  );
}
