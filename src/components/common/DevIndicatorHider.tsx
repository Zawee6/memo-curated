'use client';

import { useEffect } from 'react';

/**
 * DevIndicatorHider
 * 
 * 安全隱藏 Next.js 15/16 開發模式右下角黑色圓形 "N" 字開發指示器徽章。
 * 採純前端 Shadow DOM 樣式注入，嚴禁修改 next.config 或觸碰檔案系統，
 * 避免破壞 Next.js File Watcher 或造成 HMR 重整循環。
 */
export function DevIndicatorHider() {
  useEffect(() => {
    function injectHideStyle(root: Document | ShadowRoot) {
      if (root.querySelector('#__memo_hide_dev_tool')) return;
      try {
        const style = document.createElement('style');
        style.id = '__memo_hide_dev_tool';
        style.textContent = `
          /* 僅隱藏開發工具徽章按鈕與快訊，不隱藏錯誤彈窗 */
          [data-nextjs-dev-tools-button],
          button[aria-label*="Next.js"],
          [data-nextjs-toast] {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
            visibility: hidden !important;
          }
        `;
        root.appendChild(style);
      } catch {
        // Safe ignore
      }
    }

    function checkAndHide() {
      // 1. 注入主文件 head
      injectHideStyle(document);

      // 2. 注入所有 nextjs-portal 內部的 ShadowRoot
      const portals = document.querySelectorAll('nextjs-portal');
      portals.forEach((portal) => {
        if (portal.shadowRoot) {
          injectHideStyle(portal.shadowRoot);
          const devButtons = portal.shadowRoot.querySelectorAll(
            'button, [data-nextjs-dev-tools-button], [data-nextjs-toast]'
          );
          devButtons.forEach((btn) => {
            const label = btn.getAttribute('aria-label') || '';
            if (
              label.toLowerCase().includes('next.js') ||
              btn.hasAttribute('data-nextjs-dev-tools-button') ||
              btn.hasAttribute('data-nextjs-toast')
            ) {
              (btn as HTMLElement).style.display = 'none';
              (btn as HTMLElement).style.opacity = '0';
              (btn as HTMLElement).style.pointerEvents = 'none';
            }
          });
        }
      });
    }

    checkAndHide();

    // 監聽 DOM 變動，確保 Next.js 動態掛載 portal 時能立即隱藏
    const observer = new MutationObserver(() => {
      checkAndHide();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const interval = setInterval(checkAndHide, 1500);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return null;
}
