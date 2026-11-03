import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/memo',
  async redirects() {
    return [
      {
        source: '/',
        destination: '/memo',
        basePath: false,
        permanent: false,
      },
    ];
  },
  /* 允許跨網域 Tunnel 與手機區網訪問 Next.js dev 資源與 HMR */
  allowedDevOrigins: [
    '*.trycloudflare.com',
    'localhost:3000',
    'localhost:3001',
    '127.0.0.1:3000',
    '192.168.*.*',
    '172.*.*.*',
    '10.*.*.*',
  ],
  async headers() {
    return [
      {
        // 僅針對 HTML 頁面與 API 路由設定防快取，排除 /_next/static 與圖片等靜態資產
        source: '/((?!_next/static|_next/image|favicon.ico).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // 靜態資產 (CSS/JS/字型) 允許快取並啟用不可變快取，確保高速載入與樣式不閃爍
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  turbopack: {},
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules', '**/.git', '**/.data/**'],
    };
    return config;
  },
};

export default nextConfig;
