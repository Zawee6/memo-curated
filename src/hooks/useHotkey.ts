'use client';

import { useEffect } from 'react';

export function useHotkey(
  keyCombo: string,
  callback: (e: KeyboardEvent) => void,
  options: { enabled?: boolean } = { enabled: true }
) {
  useEffect(() => {
    if (!options.enabled || typeof window === 'undefined') return;

    function handleKeyDown(e: KeyboardEvent) {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const lowerCombo = keyCombo.toLowerCase();

      if (lowerCombo === 'cmd+k' || lowerCombo === 'ctrl+k') {
        if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          callback(e);
        }
      } else if (lowerCombo === 'escape') {
        if (e.key === 'Escape') {
          callback(e);
        }
      } else if (lowerCombo === '/') {
        // Trigger slash shortcut only if not focused on input or textarea
        const target = e.target as HTMLElement;
        if (
          e.key === '/' &&
          !['input', 'textarea', 'select'].includes(target.tagName.toLowerCase()) &&
          !target.isContentEditable
        ) {
          e.preventDefault();
          callback(e);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyCombo, callback, options.enabled]);
}
