'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { BottomDock } from './BottomDock';
import { QueueStatusPill } from './QueueStatusPill';
import { DetailSheet } from '@/components/detail/DetailSheet';
import { AINotebookDrawer } from '@/components/notebook/AINotebookDrawer';
import { DevIndicatorHider } from '@/components/common/DevIndicatorHider';
import { BlurEdges } from '@/components/common/BlurEdges';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { useAppState } from '@/providers/AppStateProvider';

function AutoAddHandler() {
  const searchParams = useSearchParams();
  const { parseUrl } = useAppState();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (hasTriggeredRef.current) return;
    const addUrl = searchParams.get('add') || searchParams.get('url');
    if (addUrl && addUrl.trim()) {
      hasTriggeredRef.current = true;
      const target = addUrl.trim();
      parseUrl(target).then(() => {
        // Remove ?add= from URL without reloading
        if (typeof window !== 'undefined') {
          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.delete('add');
          currentUrl.searchParams.delete('url');
          window.history.replaceState({}, '', currentUrl.pathname);
        }
      });
    }
  }, [searchParams, parseUrl]);

  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { openAINotebook, thinkingTasksCount, isHostAdmin, isDefaultSpace, spaceId, setSpaceId } = useAppState();

  const handleReturnToHostSpace = () => {
    setSpaceId('default');
    if (typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.has('space')) {
        currentUrl.searchParams.delete('space');
        window.history.replaceState({}, '', currentUrl.pathname + (currentUrl.search ? currentUrl.search : ''));
      }
    }
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-canvas text-ink">
      <Suspense fallback={null}>
        <AutoAddHandler />
      </Suspense>

      {/* Host-only Floating Pill when Inspecting a Friend's Space */}
      {isHostAdmin && !isDefaultSpace && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-amber-900/95 text-amber-50 shadow-float border border-amber-400/40 backdrop-blur-md">
          <span className="text-xs font-medium tracking-wide">
            👁️ 正在檢視 <strong className="font-bold text-amber-200">{spaceId}</strong> 的空間
          </span>
          <button
            type="button"
            onClick={handleReturnToHostSpace}
            className="px-2.5 py-1 rounded-full bg-amber-400 text-amber-950 text-[11px] font-bold hover:bg-amber-300 active:scale-95 transition-all cursor-pointer"
          >
            🔙 返回主機空間
          </button>
        </div>
      )}

      {/* Desktop Left Sidebar (Fixed in place) */}
      <Sidebar />

      {/* Main Content Area (Independent scrollable viewport) */}
      <main className="flex-1 flex flex-col min-w-0 max-w-full h-full overflow-y-auto overflow-x-hidden pb-28 md:pb-12">
        {children}
      </main>

      {/* Progressive Gaussian Blur Edge Masks */}
      <BlurEdges />

      {/* Mobile Floating Thinking Indicator */}
      {thinkingTasksCount > 0 && (
        <button
          type="button"
          onClick={openAINotebook}
          className="md:hidden fixed bottom-20 right-4 z-40 flex items-center gap-2 px-3.5 py-2 rounded-full bg-ink text-surface shadow-float border border-white/20 active:scale-95 transition-all animate-bounce"
        >
          <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
          <span className="text-xs font-bold font-sans">AI 思考中 ({thinkingTasksCount})</span>
        </button>
      )}

      {/* Mobile Floating Bottom Dock */}
      <BottomDock />

      {/* Global Slide-over AI Notebook Drawer */}
      <AINotebookDrawer />

      {/* First-Run Onboarding Modal */}
      <OnboardingModal />

      {/* Dev Indicator Hider */}
      <DevIndicatorHider />
    </div>
  );
}
