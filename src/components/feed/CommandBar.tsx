'use client';

import React, { useState, useRef } from 'react';
import { useAppState } from '@/providers/AppStateProvider';
import { useHotkey } from '@/hooks/useHotkey';
import {
  Search,
  Sparkles,
  Plus,
  Loader2,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MovieCandidateModal } from '@/components/common/MovieCandidateModal';
import { MovieCandidateItem } from '@/app/api/movies/candidates/route';

async function compressImageFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('讀取圖片失敗'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        const MAX_DIM = 1280;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function extractUrlAndNote(input: string): { url: string; note: string; hasUrl: boolean } {
  const trimmed = input.trim();
  if (!trimmed) return { url: '', note: '', hasUrl: false };

  // 1. 偵測 http:// 或 https://
  const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    const url = urlMatch[1];
    const note = trimmed.replace(url, '').replace(/\s+/g, ' ').trim();
    return { url, note, hasUrl: true };
  }

  // 2. 偵測純網域名稱 (如 instagram.com/reel/...)
  const domainMatch = trimmed.match(/((?:[a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}(?:\/[^\s]*)?)/i);
  if (domainMatch && !trimmed.includes('？') && !trimmed.includes('?')) {
    const raw = domainMatch[1];
    const url = `https://${raw}`;
    const note = trimmed.replace(raw, '').replace(/\s+/g, ' ').trim();
    return { url, note, hasUrl: true };
  }

  return { url: '', note: trimmed, hasUrl: false };
}

export function CommandBar({
  searchQuery,
  onSearchChange,
}: {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const { parseUrl, parseMovieCandidate, parseScreenshot, isParsing, submitAskAI, isAskingAI } =
    useAppState();
  const [input, setInput] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [candidates, setCandidates] = useState<MovieCandidateItem[]>([]);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleStartMovieCreation(rawQuery?: string) {
    const query = (rawQuery || input).trim();
    if (!query) return;

    setCandidateQuery(query);
    setIsSearchingCandidates(true);
    setIsCandidateModalOpen(true);

    try {
      const res = await fetch(`/memo/api/movies/candidates?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        const list = (data.candidates || []) as MovieCandidateItem[];
        setCandidates(list);
      } else {
        setCandidates([]);
      }
    } catch {
      setCandidates([]);
    } finally {
      setIsSearchingCandidates(false);
    }
  }

  async function handleSelectCandidate(cand: MovieCandidateItem) {
    setIsCandidateModalOpen(false);
    const res = await parseMovieCandidate(cand, manualNote);
    if (res.success) {
      setInput('');
      setManualNote('');
      setShowNoteInput(false);
      onSearchChange('');
    }
  }

  // Focus with Cmd+K or /
  useHotkey('cmd+k', () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  useHotkey('/', () => {
    inputRef.current?.focus();
  });

  const { url: extractedUrl, note: inlineNote, hasUrl: isLink } = extractUrlAndNote(input);
  const isQuestion =
    !isLink &&
    (input.includes('?') ||
      input.includes('？') ||
      input.includes('哪') ||
      input.includes('推薦') ||
      input.includes('怎麼') ||
      input.length > 5);

  async function processScreenshotFile(file: File) {
    try {
      const base64 = await compressImageFileToBase64(file);
      const combinedNote = [input.trim(), manualNote.trim()]
        .filter(Boolean)
        .join('\n\n')
        .trim();
      const res = await parseScreenshot(base64, combinedNote || undefined);
      if (res.success) {
        setInput('');
        setManualNote('');
        setShowNoteInput(false);
        onSearchChange('');
      }
    } catch {
      // Handled in parseScreenshot
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processScreenshotFile(file);
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          await processScreenshotFile(file);
          return;
        }
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;

    if (isLink && extractedUrl) {
      const combinedNote = [inlineNote, manualNote].filter(Boolean).join('\n\n').trim();
      const res = await parseUrl(extractedUrl, combinedNote);
      if (res.success) {
        setInput('');
        setManualNote('');
        setShowNoteInput(false);
        onSearchChange('');
      }
    } else if (isQuestion) {
      await submitAskAI(val);
      onSearchChange(val);
    } else {
      // Just filter search
      onSearchChange(val);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInput(val);
    const check = extractUrlAndNote(val);
    // Instant client filter search when not a link
    if (!check.hasUrl) {
      onSearchChange(val);
    }
  }

  function handleClear() {
    setInput('');
    setManualNote('');
    setShowNoteInput(false);
    onSearchChange('');
    inputRef.current?.focus();
  }

  return (
    <div className="relative w-full max-w-3xl mx-auto select-none">
      {/* 隱藏的手機截圖上傳 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <form
        suppressHydrationWarning
        onSubmit={handleSubmit}
        className="relative w-full"
      >
        <div className="relative flex items-center bg-surface border border-line hover:border-line-strong focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 rounded-control shadow-xs transition-all duration-200">
          {/* Left icon */}
          <div className="pl-4 pr-2 text-ink-3">
            {isParsing || isAskingAI ? (
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
            ) : isLink ? (
              <Plus className="w-5 h-5 text-accent" />
            ) : isQuestion ? (
              <Sparkles className="w-5 h-5 text-cat-media" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </div>

          {/* Text Input */}
          <input
            suppressHydrationWarning
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onPaste={handlePaste}
            placeholder="貼上網址、直接 Ctrl+V 貼上或上傳手機截圖、輸入片名如《陽光普照》..."
            className="w-full py-3.5 pr-44 text-base text-ink bg-transparent focus:outline-none placeholder:text-ink-3 placeholder:text-xs md:placeholder:text-sm font-sans"
          />

          {/* Clear, Screenshot Upload & Action buttons on right */}
          <div className="absolute right-2 flex items-center gap-1.5">
            {input && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded text-ink-3 hover:text-ink cursor-pointer"
                aria-label="清除輸入"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* 📸 傳截圖按鈕 (Screenshot Vision) */}
            <button
              type="button"
              disabled={isParsing}
              onClick={() => fileInputRef.current?.click()}
              title="上傳手機截圖（IG 限動、小紅書、菜單、Netflix 畫面），由 Gemini Vision 自動辨識建檔"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-surface-2 hover:bg-accent/10 text-ink-2 hover:text-accent border border-line hover:border-accent/40 transition-all cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5 text-accent" />
              <span>傳截圖</span>
            </button>

            {isLink ? (
              <Button
                type="submit"
                variant="accent"
                size="sm"
                isLoading={isParsing}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                解析收藏
              </Button>
            ) : isQuestion ? (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isAskingAI}
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-accent" />}
              >
                AI 解答
              </Button>
            ) : input.trim().length >= 2 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isLoading={isParsing || isSearchingCandidates}
                onClick={() => handleStartMovieCreation(input.trim())}
                className="font-sans text-xs font-bold text-[#E07A5F] border-[#E07A5F]/30 hover:bg-[#E07A5F]/10"
              >
                🎬 建電影
              </Button>
            ) : (
              <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-ink-3 bg-surface-2 border border-line">
                <kbd>⌘</kbd>
                <kbd>K</kbd>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* 補充貼文內文或筆記（選填，方便無字貼文或防爬蟲補強） */}
      {isLink && (
        <div className="mt-1.5 px-2">
          <button
            type="button"
            onClick={() => setShowNoteInput(!showNoteInput)}
            className="text-[11px] font-mono text-ink-3 hover:text-accent transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <FileText className="w-3 h-3" />
            <span>
              {showNoteInput
                ? '收起補充文案'
                : '+ 補充貼文內文或個人備註（若 IG 需登入可在此貼上文字）'}
            </span>
            {showNoteInput ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {showNoteInput && (
            <div className="mt-1.5">
              <textarea
                suppressHydrationWarning
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="貼上 IG 貼文的文字內容、店家資訊或私房備註..."
                rows={2}
                className="w-full p-2.5 text-base md:text-xs text-ink bg-surface border border-line rounded-control focus:outline-none focus:border-accent font-sans placeholder:text-ink-3 resize-none shadow-xs transition-all"
              />
            </div>
          )}
        </div>
      )}

      {/* 電影候選版本選擇面板 */}
      <MovieCandidateModal
        isOpen={isCandidateModalOpen}
        query={candidateQuery}
        candidates={candidates}
        isLoading={isSearchingCandidates}
        onSelect={handleSelectCandidate}
        onClose={() => setIsCandidateModalOpen(false)}
      />
    </div>
  );
}
