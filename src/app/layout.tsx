import type { Metadata, Viewport } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  themeColor: '#F5F4F0',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Memo - 現代生活靈感誌與採買庫',
  description: '以極致排版與 AI 深度結構化，珍藏你的城市私房景點、米其林家常食譜與生活靈感。',
  manifest: '/memo/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Memo',
  },
  icons: {
    apple: '/memo/apple-touch-icon.png?v=3',
    icon: '/memo/icon.svg?v=3',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-TW"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="apple-touch-icon" href="/memo/apple-touch-icon.png?v=3" />
        <link rel="icon" type="image/svg+xml" href="/memo/icon.svg?v=3" />
        {/* iOS Web App 模組快取崩潰與過期 Chunk 自動防護自我修復腳本 (嚴禁自動強制 reload 避免陷入無限重刷黑屏) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function isStaleChunkError(msg) {
                  return /module factory is not available|Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(msg);
                }
                window.addEventListener('error', function(e) {
                  var msg = (e && e.message) || '';
                  if (isStaleChunkError(msg)) {
                    console.warn('[Memo Auto-Rescue] Detected stale chunk error, clearing caches silently:', msg);
                    if ('caches' in window) {
                      caches.keys().then(function(keys) {
                        keys.forEach(function(k) { caches.delete(k); });
                      });
                    }
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.getRegistrations().then(function(regs) {
                        regs.forEach(function(r) { r.unregister(); });
                      });
                    }
                  }
                });
                window.addEventListener('unhandledrejection', function(e) {
                  var reason = (e && e.reason && (e.reason.message || String(e.reason))) || '';
                  if (isStaleChunkError(reason)) {
                    console.warn('[Memo Auto-Rescue] Detected stale rejection, clearing caches silently:', reason);
                    if ('caches' in window) {
                      caches.keys().then(function(keys) {
                        keys.forEach(function(k) { caches.delete(k); });
                      });
                    }
                  }
                });
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-canvas text-ink antialiased selection:bg-accent/15 selection:text-accent font-sans overflow-x-hidden max-w-[100vw]">
        {children}
      </body>
    </html>
  );
}
