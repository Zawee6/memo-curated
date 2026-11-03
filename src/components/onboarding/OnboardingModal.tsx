'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  KeyRound,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAppState } from '@/providers/AppStateProvider';

interface OnboardingModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function OnboardingModal({ forceOpen, onClose }: OnboardingModalProps) {
  const { addToast } = useAppState();
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasDismissed, setHasDismissed] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    // 檢查是否已設定金鑰
    async function checkKey() {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.success && !data.hasGeminiKey && !hasDismissed) {
          setIsOpen(true);
        }
      } catch (err) {
        console.warn('檢查金鑰設定失敗：', err);
      }
    }

    checkKey();
  }, [forceOpen, hasDismissed]);

  const handleClose = () => {
    setIsOpen(false);
    setHasDismissed(true);
    if (onClose) onClose();
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      setErrorMessage('請先輸入或貼上 Gemini API Key');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: cleanKey, testKey: true }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || '連線驗證失敗');
      }

      addToast({
        type: 'success',
        message: '✓ Gemini API Key 驗證成功！已儲存至 .data/config.json，開箱即用！',
      });
      setIsOpen(false);
      if (onClose) onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '儲存失敗';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-surface border border-border p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 p-2 text-ink-3 hover:text-ink rounded-lg hover:bg-canvas transition-colors"
          title="暫時略過"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 text-accent mb-1 ring-8 ring-accent/5">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink">
            歡迎使用 Memo 智慧生活記錄庫
          </h2>
          <p className="text-xs sm:text-sm text-ink-3 leading-relaxed">
            100% 開源、免費、零伺服器開銷！所有資料儲存在您本機的 <code className="text-accent font-mono">.data/db.json</code>。只需設定免費的 Google Gemini API Key，即可啟用智慧卡片解析、食譜換算與 AI 問答。
          </p>
        </div>

        {/* Free API Key CTA */}
        <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-accent flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> 免費申請教學（30 秒完成）
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
              完全不用信用卡
            </span>
          </div>
          <ol className="text-xs text-ink-2 space-y-1.5 list-decimal list-inside pl-1">
            <li>點擊下方按鈕前往 Google AI Studio</li>
            <li>登入 Google 帳號後點擊「Create API key」</li>
            <li>複製開頭為 <code className="font-mono bg-canvas px-1 rounded">AIzaSy...</code> 的金鑰並貼入下方</li>
          </ol>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-white font-medium text-xs hover:bg-accent/90 active:scale-[0.99] transition-all shadow-sm cursor-pointer"
          >
            <span>👉 點此免費領取 Google Gemini API Key</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-ink">
              貼上 Gemini API Key
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-9 pr-12 py-2.5 text-xs rounded-xl border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-accent/40 font-mono transition-all"
                autoFocus
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
              <p className="text-xs text-rose-500 flex items-center gap-1 pt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorMessage}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full justify-center"
              isLoading={isLoading}
              disabled={!apiKey.trim()}
            >
              測試連線並儲存
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleClose}
            >
              稍後再說
            </Button>
          </div>
        </form>

        {/* Footer Note */}
        <div className="flex items-center justify-between text-[11px] text-ink-3 pt-2 border-t border-border/50">
          <span className="flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            金鑰存於本地，絕不上傳第三方
          </span>
          <span>隨時可在「設定」中變更</span>
        </div>
      </div>
    </div>
  );
}
