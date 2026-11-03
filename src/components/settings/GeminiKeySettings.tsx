'use client';

import React, { useState, useEffect } from 'react';
import { SettingsGroup } from './SettingsGroup';
import { Button } from '@/components/ui/Button';
import { useAppState } from '@/providers/AppStateProvider';
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';

interface SetupStatus {
  hasGeminiKey: boolean;
  geminiKeyMasked: string;
  model: string;
  source: 'config.json' | 'env' | 'none';
  databaseType: string;
  databasePath: string;
}

export function GeminiKeySettings() {
  const { addToast } = useAppState();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function fetchStatus() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      }
    } catch (e) {
      console.warn('Failed to fetch config status:', e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
  }, []);

  async function handleSaveKey() {
    const cleanKey = newKey.trim();
    if (!cleanKey) return;
    setIsSaving(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: cleanKey,
          testKey: true,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || '儲存失敗');
      }

      addToast({
        type: 'success',
        message: '✓ Gemini API Key 已成功儲存至 .data/config.json 並通過連線驗證！',
      });
      setNewKey('');
      setIsEditing(false);
      await fetchStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '儲存失敗';
      setErrorMessage(msg);
      addToast({ type: 'error', message: msg });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SettingsGroup
      title="🔑 Google Gemini AI 模型金鑰 (BYOK)"
      description="管理您的個人專屬 Gemini 3.8 / 3.5 Flash API Key。金鑰儲存於本機 .data/config.json，所有解析與問答皆在您的私有免費配額內運行。"
    >
      <div className="space-y-4">
        {/* Current Key Status Card */}
        <div className="p-4 rounded-xl border border-border bg-canvas/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink">目前啟用金鑰狀態：</span>
              {isLoading ? (
                <span className="text-xs text-ink-3">載入中...</span>
              ) : status?.hasGeminiKey ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  已就緒 ({status.source === 'config.json' ? '本機設定檔' : '環境變數'})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-xs font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  尚未設定金鑰
                </span>
              )}
            </div>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium"
            >
              Google AI Studio 免費領取 ↗
            </a>
          </div>

          {status?.hasGeminiKey && (
            <div className="flex items-center gap-2 text-xs font-mono bg-surface p-2.5 rounded-lg border border-border/80">
              <KeyRound className="w-3.5 h-3.5 text-ink-3" />
              <span className="text-ink-2 font-medium">金鑰遮罩：</span>
              <span className="text-ink font-bold tracking-wider">
                {status.geminiKeyMasked || '••••••••••••••••'}
              </span>
            </div>
          )}

          {/* Edit / Change Key Controls */}
          {!isEditing ? (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setIsEditing(true);
                  setErrorMessage('');
                }}
              >
                {status?.hasGeminiKey ? '更換金鑰' : '填入金鑰'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t border-border/60">
              <label className="block text-xs font-bold text-ink">
                輸入新的 Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="貼上 AIzaSy 開頭的 Gemini API Key..."
                  className="w-full px-3 py-2 pr-12 text-xs rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-3 hover:text-ink transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {errorMessage && (
                <p className="text-xs text-rose-500 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errorMessage}
                </p>
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSaveKey}
                  isLoading={isSaving}
                  disabled={!newKey.trim()}
                >
                  測試連線並儲存
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setNewKey('');
                    setErrorMessage('');
                  }}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </SettingsGroup>
  );
}
