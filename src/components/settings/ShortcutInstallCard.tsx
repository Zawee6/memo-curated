'use client';

import React, { useState, useEffect } from 'react';
import { useNetworkInfo } from '@/hooks/useNetworkInfo';
import { useAppState } from '@/providers/AppStateProvider';
import { SettingsGroup } from './SettingsGroup';
import { Button } from '@/components/ui/Button';
import {
  Smartphone,
  Download,
  Copy,
  Check,
  Globe,
  Wifi,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Share2,
  CheckCircle2,
} from 'lucide-react';

export function ShortcutInstallCard() {
  const { data: netInfo, isLoading } = useNetworkInfo();
  const { addToast, spaceId, isDefaultSpace } = useAppState();
  const [copied, setCopied] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [clientOrigin, setClientOrigin] = useState('');
  const [customTargetText, setCustomTargetText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setClientOrigin(`${window.location.origin}/memo`);
    }
  }, []);

  const rawActiveUrl = netInfo?.activeUrl || clientOrigin || (typeof window !== 'undefined' ? `${window.location.origin}/memo` : 'http://localhost:3000/memo');
  const activeUrl = rawActiveUrl.endsWith('/memo')
    ? rawActiveUrl
    : `${rawActiveUrl.replace(/\/+$/, '')}/memo`;
  const shortcutEndpoint = isDefaultSpace
    ? `${activeUrl}/api/shortcut?url=`
    : `${activeUrl}/api/shortcut?space=${encodeURIComponent(spaceId)}&url=`;

  useEffect(() => {
    if (shortcutEndpoint && !customTargetText) {
      setCustomTargetText(shortcutEndpoint);
    }
  }, [shortcutEndpoint]);

  const targetToUse = customTargetText || shortcutEndpoint;
  const downloadUrl = `/memo/api/shortcut/download${
    targetToUse ? `?target=${encodeURIComponent(targetToUse)}` : ''
  }`;

  function handleCopyActiveUrl() {
    if (!activeUrl) return;
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    addToast({
      type: 'success',
      message: '已複製連線網址！請用手機 Safari 開啟。',
    });
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyEndpoint() {
    if (!shortcutEndpoint) return;
    navigator.clipboard.writeText(shortcutEndpoint);
    setCopiedEndpoint(true);
    addToast({
      type: 'success',
      message: `✅ 已複製【${spaceId}】專屬空間的秒存 API 端點！`,
    });
    setTimeout(() => setCopiedEndpoint(false), 2000);
  }

  return (
    <SettingsGroup
      title={`iPhone 捷徑連線 (${isDefaultSpace ? '👑 主空間' : `👤 ${spaceId} 空間`})`}
      description="在 IG、Threads 或瀏覽器按「分享」直接存入 Memo，免切換 App 自動結構化。"
    >
      <div className="space-y-4">
        {/* 雙捷徑安裝與說明區塊 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {/* 捷徑 1: 靈感一鍵秒存 */}
          <div className="p-4 rounded-2xl bg-surface border border-line space-y-3.5 flex flex-col justify-between shadow-xs hover:border-[#3F7D58]/40 transition-colors">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#3F7D58]/15 text-[#3F7D58] font-bold text-xs tracking-tight">
                    必裝捷徑
                  </span>
                  <h4 className="font-bold text-sm text-ink">Memo 存連結</h4>
                </div>
                <span className="text-[11px] font-mono text-ink-3">v2.0 官方簽署</span>
              </div>
              <p className="text-xs text-ink-2 leading-relaxed">
                在 Instagram、Threads 或 Safari 點「分享」➔「Memo 存連結」，自動在背景秒存並透過 AI 整理成食譜與景點！
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              {/* 主行動按鈕：一鍵下載安裝 */}
              <a
                href={downloadUrl}
                download="Memo-Save.shortcut"
                className="w-full inline-flex items-center justify-center font-bold h-10 px-4 text-xs rounded-xl gap-2 bg-[#3F7D58] text-white hover:bg-[#3F7D58]/90 active:scale-[0.98] shadow-sm cursor-pointer text-center transition-all"
              >
                <Download className="w-4 h-4" />
                <span>📲 一鍵下載安裝 iPhone 捷徑</span>
              </a>

              <a
                href={`shortcuts://import-shortcut?url=${encodeURIComponent(
                  `${activeUrl.replace(/\/+$/, '')}/api/shortcut/download?target=${encodeURIComponent(targetToUse)}`
                )}`}
                className="w-full inline-flex items-center justify-center font-medium h-8 px-3 text-xs rounded-xl gap-1.5 bg-surface-2 text-ink border border-line hover:bg-surface-3 active:scale-[0.98] cursor-pointer transition-all"
              >
                <Smartphone className="w-3.5 h-3.5 text-ink-3" />
                <span>iPhone 快速加入 (在 Safari 中點擊)</span>
              </a>

              {/* 極簡 2 步驟使用教學 */}
              <div className="p-3 rounded-xl bg-surface-2/80 border border-line/70 space-y-2 text-[11px] text-ink-2">
                <div className="font-semibold text-ink flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-[#3F7D58]" />
                  <span>超直觀使用方式：</span>
                </div>
                <ol className="space-y-1.5 pl-0.5">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-[#3F7D58] shrink-0">1.</span>
                    <span>點擊上方按鈕，在 iPhone 上確認「加入捷徑」。</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-[#3F7D58] shrink-0">2.</span>
                    <span>在 IG 或 Threads 看到想存的貼文，按「分享至...」選擇<strong>「Memo 存連結」</strong>，出現打勾通知即收藏成功！</span>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* 捷徑 2: 採買清單一鍵打勾 */}
          <div className="p-4 rounded-2xl bg-surface border border-line space-y-3.5 flex flex-col justify-between shadow-xs hover:border-[#E07A5F]/40 transition-colors">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#E07A5F]/15 text-[#E07A5F] font-bold text-xs tracking-tight">
                    料理必備
                  </span>
                  <h4 className="font-bold text-sm text-ink">Memo 清單</h4>
                </div>
                <span className="text-[11px] font-mono text-ink-3">Apple 備忘錄</span>
              </div>
              <p className="text-xs text-ink-2 leading-relaxed">
                在食譜頁點擊「一鍵存入 iPhone 備忘錄」，自動在 Apple 備忘錄中建立原生打勾採買清單與料理步驟！
              </p>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href="/memo/Memo-Checklist.shortcut"
                  download="Memo-Checklist.shortcut"
                  className="flex-1 inline-flex items-center justify-center font-bold h-10 px-3 text-xs rounded-xl gap-2 bg-[#E07A5F] text-white hover:bg-[#d06b51] active:scale-[0.98] shadow-sm cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>下載清單捷徑</span>
                </a>
                <a
                  href={`shortcuts://import-shortcut?url=${encodeURIComponent(
                    `${activeUrl}/Memo-Checklist.shortcut`
                  )}`}
                  className="inline-flex items-center justify-center font-medium h-10 px-3.5 text-xs rounded-xl gap-1.5 bg-surface-2 text-ink border border-line hover:bg-surface-3 active:scale-[0.98] cursor-pointer transition-all"
                >
                  <Smartphone className="w-3.5 h-3.5 text-ink-3" />
                  <span>iPhone 加入</span>
                </a>
              </div>

              <div className="p-3 rounded-xl bg-surface-2/80 border border-line/70 space-y-2 text-[11px] text-ink-2">
                <div className="font-semibold text-ink flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#E07A5F]" />
                  <span>如何使用：</span>
                </div>
                <p className="leading-relaxed">
                  加入後，只要在任何食譜詳細資訊頁，點擊<strong>「一鍵存入 iPhone 備忘錄」</strong>，系統就會自動為您開啟備忘錄並填入打勾食材清單。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 🛠️ 折疊式進階設定（給需要微調或除錯的使用者，預設收起） */}
        <div className="pt-2 border-t border-line/60">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-surface-2/60 hover:bg-surface-2 border border-line/60 text-xs font-semibold text-ink-2 hover:text-ink transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span>🛠️</span>
              <span>進階開發者設定 (連線網址、專屬空間端點與自訂簽章)</span>
            </span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 text-ink-3" />
            ) : (
              <ChevronDown className="w-4 h-4 text-ink-3" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-3 p-3.5 rounded-2xl bg-surface-2 border border-line space-y-3.5 animate-memo-entrance text-xs">
              {/* 目前連線狀態 */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface border border-line text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {netInfo?.publicUrl ? (
                    <Globe className="w-4 h-4 text-accent shrink-0" />
                  ) : (
                    <Wifi className="w-4 h-4 text-[#5B7C5A] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-semibold text-ink block">
                      {netInfo?.publicUrl ? 'Cloudflare 跨網域穿透中' : '區網直連模式'}
                    </span>
                    <span className="text-ink-3 font-mono text-[11px] truncate block">
                      {activeUrl}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyActiveUrl}
                  leftIcon={
                    copied ? (
                      <Check className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-ink-3" />
                    )
                  }
                >
                  {copied ? '已複製' : '複製網址'}
                </Button>
              </div>

              {/* 專屬空間端點 */}
              <div className="p-3 rounded-xl bg-surface border border-line space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink text-[11px]">
                    【{spaceId}】空間專屬 API 秒存端點：
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyEndpoint}
                    leftIcon={
                      copiedEndpoint ? (
                        <Check className="w-3 h-3 text-success" />
                      ) : (
                        <Copy className="w-3 h-3 text-accent" />
                      )
                    }
                  >
                    {copiedEndpoint ? '已複製' : '複製端點'}
                  </Button>
                </div>
                <code className="block p-2 rounded-lg bg-surface-2 border border-line text-[11px] font-mono text-ink break-all select-all">
                  {shortcutEndpoint}
                </code>
              </div>

              {/* 手動覆寫替換目標 */}
              <div className="p-3 rounded-xl bg-surface border border-line space-y-2">
                <label className="text-[11px] font-bold text-ink block">
                  手動指定捷徑替換之目標網址：
                </label>
                <input
                  type="text"
                  value={customTargetText}
                  onChange={(e) => setCustomTargetText(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-2 border border-line text-xs font-mono text-ink focus:outline-none focus:border-accent"
                  placeholder="https://..."
                />
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCustomTargetText(shortcutEndpoint)}
                    className="text-[11px] text-ink-3 hover:text-ink underline cursor-pointer"
                  >
                    重設為預設端點
                  </button>
                  <a
                    href={`/memo/api/shortcut/download?target=${encodeURIComponent(customTargetText)}`}
                    download="Memo-Save.shortcut"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#3F7D58] hover:bg-[#3F7D58]/90 px-3 py-1.5 rounded-lg shadow-xs cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>即時重新簽署並下載</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </SettingsGroup>
  );
}
