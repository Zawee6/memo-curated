'use client';

import React, { useState } from 'react';
import { useAppState } from '@/providers/AppStateProvider';
import { Sparkles, X, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function AskAnswerPanel() {
  const { askResult, clearAskAI, submitAskAI, isAskingAI } = useAppState();
  const [showReasoning, setShowReasoning] = useState(false);

  if (!askResult || !askResult.answer) return null;

  return (
    <div className="w-full max-w-3xl mx-auto rounded-card border border-accent/25 bg-gradient-to-br from-surface via-surface to-accent-soft/20 p-5 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-full bg-accent/15 text-accent">
            <Sparkles className="w-4 h-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-accent font-mono">
            Memo AI 收藏助理建議
          </span>
        </div>
        <button
          type="button"
          onClick={clearAskAI}
          className="p-1 rounded text-ink-3 hover:text-ink cursor-pointer"
          aria-label="關閉 AI 解答"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Answer Body */}
      <div className="text-xs md:text-sm text-ink leading-relaxed whitespace-pre-line font-normal">
        {askResult.answer}
      </div>

      {/* Reasoning Dropdown (optional) */}
      {askResult.reasoning && (
        <div className="pt-2 border-t border-line">
          <button
            type="button"
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink cursor-pointer font-medium"
          >
            <span>AI 推理脈絡</span>
            {showReasoning ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
          {showReasoning && (
            <p className="mt-2 text-xs text-ink-3 bg-surface-2/60 p-3 rounded-control border border-line leading-relaxed">
              {askResult.reasoning}
            </p>
          )}
        </div>
      )}

      {/* Suggested follow-up questions */}
      {askResult.suggestedFollowUps &&
        askResult.suggestedFollowUps.length > 0 && (
          <div className="pt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-ink-3 font-medium">延伸探索：</span>
            {askResult.suggestedFollowUps.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isAskingAI}
                onClick={() => submitAskAI(prompt)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-chip text-xs bg-surface border border-line hover:border-accent hover:text-accent transition-colors cursor-pointer text-ink-2"
              >
                <span>{prompt}</span>
                <ArrowRight className="w-3 h-3 text-ink-3" />
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
