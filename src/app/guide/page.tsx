'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Printer,
  Copy,
  Check,
  ArrowLeft,
  Share2,
  Sparkles,
  Smartphone,
  Bell,
  Zap,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';

function GuideContent() {
  const searchParams = useSearchParams();
  const rawSpace = searchParams.get('space') || searchParams.get('spaceId') || 'default';
  const targetSpace = rawSpace.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'default';

  const [hostOrigin, setHostOrigin] = useState(
    process.env.NEXT_PUBLIC_SITE_URL || ''
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedInbox, setCopiedInbox] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const base = process.env.NEXT_PUBLIC_SITE_URL || `${origin}/memo`;
      setHostOrigin(base.replace(/\/+$/, ''));
    }
  }, []);

  const cleanHost = (hostOrigin || (typeof window !== 'undefined' ? `${window.location.origin}/memo` : '')).replace(/\/+$/, '');
  const spaceHomeUrl = `${cleanHost}?space=${encodeURIComponent(targetSpace)}`;
  const spaceInboxUrl = `${cleanHost}/api/inbox?space=${encodeURIComponent(targetSpace)}&url=`;

  function handlePrint() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  function handleCopy(text: string, type: 'link' | 'inbox') {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedInbox(true);
      setTimeout(() => setCopiedInbox(false), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 font-sans print:bg-white print:text-black">
      {/* 頂部控制列（列印與匯出 PDF 時自動隱藏） */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-4 py-3 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link
            href={`/?space=${encodeURIComponent(targetSpace)}`}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回主頁</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(spaceHomeUrl, 'link')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 transition-colors cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>已複製專屬連結</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>複製連結</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 dark:bg-white text-white dark:text-stone-900 hover:opacity-90 shadow-sm transition-opacity cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>列印 / 另存為 PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* 說明文件主體（A4 美化排版） */}
      <main className="max-w-3xl mx-auto px-6 py-8 sm:py-12 space-y-10 print:py-4 print:px-2 print:max-w-none">
        {/* 文件抬頭 */}
        <div className="border-b border-stone-200 dark:border-stone-800 pb-6 print:pb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-stone-500 font-bold">
              memo. User Guide & Shortcuts Manual
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
              空間代號：{targetSpace}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
            【{targetSpace}】空間專屬使用手冊與 iPhone 捷徑設定
          </h1>

          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            這份文件包含您在 memo. 主機上的個人專屬獨立空間設定說明。您將直接共用主機的 Google Gemini AI 算力，而您的所有食譜、私房景點與生活筆記將 100% 獨立隔離在您的個人空間中。
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs text-stone-600 dark:text-stone-400">
            <div>
              <span className="text-stone-400">您的專屬主頁：</span>
              <span className="font-mono text-stone-800 dark:text-stone-200 font-medium break-all block">
                {spaceHomeUrl}
              </span>
            </div>
            <div>
              <span className="text-stone-400">快捷收集接收端：</span>
              <span className="font-mono text-stone-800 dark:text-stone-200 font-medium break-all block">
                {spaceInboxUrl}[URL]
              </span>
            </div>
          </div>
        </div>

        {/* 核心保障提示 */}
        <div className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 space-y-2 text-xs">
          <div className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>私人空間三大安心保障</span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-stone-600 dark:text-stone-400 pt-1 leading-relaxed">
            <li className="space-y-0.5">
              <strong className="text-stone-800 dark:text-stone-200 block">1. 免自備 API Key</strong>
              由主機代勞所有影片解析、食材清單結構化與地址搜尋。
            </li>
            <li className="space-y-0.5">
              <strong className="text-stone-800 dark:text-stone-200 block">2. 資料獨立隔離</strong>
              您的收藏資料庫完全獨立，其他使用者無法看見您的私人清單。
            </li>
            <li className="space-y-0.5">
              <strong className="text-stone-800 dark:text-stone-200 block">3. 獨立推播與捷徑</strong>
              捷徑解析完成通知與提醒只會推送給您個人的裝置。
            </li>
          </ul>
        </div>

        {/* 步驟一：加入 iPhone 主畫面 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-stone-900 text-white dark:bg-white dark:text-stone-900 flex items-center justify-center font-bold text-sm">
              1
            </div>
            <h2 className="text-lg font-bold">加入 iPhone 主畫面（如同原生 App）</h2>
          </div>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            memo. 支援 PWA 全螢幕 Web App 模式，加入主畫面後無瀏覽器網址列，且點開永遠直接進入您的【{targetSpace}】空間：
          </p>

          <ol className="space-y-3 text-xs sm:text-sm text-stone-700 dark:text-stone-300 pl-2">
            <li className="flex items-start gap-2.5">
              <span className="font-mono font-bold text-stone-400 shrink-0">1.1</span>
              <div>
                在 iPhone 上使用 <strong>Safari 瀏覽器</strong> 開啟您的專屬網址：
                <div className="mt-1.5 p-2 rounded-lg bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 font-mono text-xs break-all text-stone-900 dark:text-stone-100 select-all">
                  {spaceHomeUrl}
                </div>
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="font-mono font-bold text-stone-400 shrink-0">1.2</span>
              <div>
                點擊 Safari 底部工具列正中間的 <strong>「分享」按鈕</strong>（帶有往上箭頭的方框 <Share2 className="w-3.5 h-3.5 inline mx-0.5" />）。
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="font-mono font-bold text-stone-400 shrink-0">1.3</span>
              <div>
                在分享選單中向下滑動，找到並點選 <strong>「加入主畫面 (Add to Home Screen)」</strong>。
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="font-mono font-bold text-stone-400 shrink-0">1.4</span>
              <div>
                名稱可輸入「<strong>memo</strong>」或「<strong>我的靈感誌</strong>」，點擊右上角「<strong>新增</strong>」。
                桌面即會出現獨立圖示，享受原生效能！
              </div>
            </li>
          </ol>
        </section>

        {/* 步驟二：推播設定 */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-stone-900 text-white dark:bg-white dark:text-stone-900 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <h2 className="text-lg font-bold">設定專屬推播通知 (ntfy 免費推播)</h2>
          </div>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            當您在 IG 或 Threads 分享網址給捷徑後，主機會在背景以 AI 深度解析並自動推播通知您解析完成：
          </p>

          <ol className="space-y-3 text-xs sm:text-sm text-stone-700 dark:text-stone-300 pl-2">
            <li className="flex items-start gap-2.5">
              <span className="font-mono font-bold text-stone-400 shrink-0">2.1</span>
              <div>
                在 iPhone App Store 搜尋並免費下載 <strong>「ntfy」</strong> App。
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="font-mono font-bold text-stone-400 shrink-0">2.2</span>
              <div>
                打開 ntfy App，點擊右上角 <strong>「+」</strong> 訂閱主題 (Topic)。
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="font-mono font-bold text-stone-400 shrink-0">2.3</span>
              <div>
                主題名稱建議填寫：
                <code className="mx-1 px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 font-mono font-bold text-stone-900 dark:text-white">
                  albo-notify-{targetSpace}
                </code>
                （或在 memo 設定頁中自訂的主題），並點擊「訂閱 (Subscribe)」。
              </div>
            </li>
          </ol>
        </section>

        {/* 步驟三：Apple 捷徑 (iOS Shortcuts) */}
        <section className="space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-stone-900 text-white dark:bg-white dark:text-stone-900 flex items-center justify-center font-bold text-sm">
              3
            </div>
            <h2 className="text-lg font-bold">設定 Apple 捷徑 (iOS Shortcuts)</h2>
          </div>

          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            只需建立一個簡單的 5 步驟捷徑，在 IG Reel、小紅書或 YouTube 點擊「分享至...」時即可一鍵秒存！主機會自動處理所有下載、逐字稿與結構化：
          </p>

          {/* 捷徑 A：Memo-Save */}
          <div className="p-4 sm:p-5 rounded-2xl bg-stone-100/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>捷徑 A：【Memo-Save】（分享表單一鍵秒存）</span>
              </h3>
              <span className="text-[11px] font-mono text-stone-500">共 5 個動作</span>
            </div>

            <ol className="space-y-3 text-xs sm:text-sm text-stone-700 dark:text-stone-300">
              <li className="p-2.5 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 space-y-1">
                <div className="font-semibold text-stone-900 dark:text-stone-100">
                  動作 1：建立捷徑並啟用分享表單
                </div>
                <div className="text-stone-500 text-xs">
                  打開「捷徑」App，點右上角「+」，命名為「<strong>Memo-Save</strong>」。點擊下方「i」圖示，開啟「<strong>在分享表單中顯示</strong>」，接收類型勾選「URL」與「文字」。
                </div>
              </li>

              <li className="p-2.5 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 space-y-1">
                <div className="font-semibold text-stone-900 dark:text-stone-100">
                  動作 2：從輸入中取得 URL (Get URLs from Input)
                </div>
                <div className="text-stone-500 text-xs">
                  搜尋並新增動作「<strong>從輸入中取得 URL</strong>」，輸入來源選擇「捷徑輸入 (Shortcut Input)」。
                </div>
              </li>

              <li className="p-2.5 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 space-y-2">
                <div className="font-semibold text-stone-900 dark:text-stone-100">
                  動作 3：取得 URL 的內容 (Get Contents of URL)
                </div>
                <div className="text-stone-500 text-xs">
                  搜尋並新增動作「<strong>取得 URL 的內容</strong>」。請將 URL 設為以下專屬網址，並在最後方帶入「從輸入中取得的 URL」變數：
                </div>
                <div className="p-2 rounded bg-stone-50 dark:bg-stone-900 font-mono text-xs text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 break-all select-all flex items-center justify-between gap-2">
                  <span>{spaceInboxUrl}[URL]</span>
                  <button
                    onClick={() => handleCopy(spaceInboxUrl, 'inbox')}
                    className="shrink-0 p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500"
                    title="複製 URL 前綴"
                  >
                    {copiedInbox ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="text-stone-500 text-[11px]">
                  * HTTP 方法請維持預設的 <strong>GET</strong> 即可。
                </div>
              </li>

              <li className="p-2.5 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 space-y-1">
                <div className="font-semibold text-stone-900 dark:text-stone-100">
                  動作 4：顯示通知 (Show Notification)
                </div>
                <div className="text-stone-500 text-xs">
                  新增動作「<strong>顯示通知</strong>」，內容填寫「<strong>✨ 已傳送至 memo. AI 背景處理中！</strong>」。
                </div>
              </li>

              <li className="p-2.5 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 space-y-1">
                <div className="font-semibold text-stone-900 dark:text-stone-100">
                  動作 5：完成儲存
                </div>
                <div className="text-stone-500 text-xs">
                  點擊右上角「完成」。日後在 Instagram、Threads、小紅書或 YouTube 點擊「分享」→ 選擇「Memo-Save」，手機彈出通知即可立刻離開，主機在 3~5 秒內自動解析完成！
                </div>
              </li>
            </ol>
          </div>

          {/* 捷徑 B：Memo清單 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-stone-100/80 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-500" />
                <span>捷徑 B：【Memo清單】（桌面一鍵直達清單）</span>
              </h3>
              <span className="text-[11px] font-mono text-stone-500">共 2 個動作</span>
            </div>

            <ol className="space-y-2 text-xs sm:text-sm text-stone-700 dark:text-stone-300">
              <li className="p-2.5 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700">
                1. 新增捷徑命名為「<strong>Memo清單</strong>」。
              </li>
              <li className="p-2.5 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 space-y-1.5">
                <div>2. 新增動作「<strong>打開 URL (Open URL)</strong>」，URL 填入：</div>
                <div className="p-2 rounded bg-stone-50 dark:bg-stone-900 font-mono text-xs text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 break-all select-all">
                  {spaceHomeUrl}
                </div>
              </li>
              <li className="p-2.5 rounded-xl bg-white dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700">
                3. 點擊分享將此捷徑加入主畫面，一按秒看所有收藏！
              </li>
            </ol>
          </div>
        </section>

        {/* 頁尾 */}
        <footer className="pt-6 border-t border-stone-200 dark:border-stone-800 text-center text-xs text-stone-500 space-y-1">
          <div>memo. 現代生活靈感誌與採買庫・專屬空間教學手冊</div>
          <div className="text-[11px]">有任何問題或建議歡迎隨時與主機管理員聯繫。祝您生活探索與烹飪愉快！</div>
        </footer>
      </main>
    </div>
  );
}

export default function GuidePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 text-sm text-stone-500">
          正在準備專屬教學手冊...
        </div>
      }
    >
      <GuideContent />
    </Suspense>
  );
}
