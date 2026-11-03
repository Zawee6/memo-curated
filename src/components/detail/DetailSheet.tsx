'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppState } from '@/providers/AppStateProvider';
import type { ParsedItem } from '@/types/item';
import { getCategoryMeta } from '@/lib/categories';
import { formatDate, getDomain } from '@/lib/format';
import { PlaceSection } from './PlaceSection';
import { RecipeSection } from './RecipeSection';
import { MovieDetailSection } from './MovieDetailSection';
import { ShoppingSection } from './ShoppingSection';
import { ProductSection } from './ProductSection';
import { RelatedSourcesSection } from './RelatedSourcesSection';
import { DetailActionBar } from './DetailActionBar';
import { TagEditorModal } from '@/components/common/TagEditorModal';
import { CoverImage } from '@/components/feed/CoverImage';
import {
  Heart,
  Tag,
  Play,
  Trash2,
  Plus,
  Check,
  RefreshCw,
  MapPin,
  ShoppingBag,
  CheckCircle2,
  Circle,
  FileEdit,
  X,
  Sparkles,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getMediaAspectType,
  isYouTubeStandardVideo,
  isYouTubeShorts,
  extractYouTubeVideoId,
  normalizeSocialUrl,
  getVideoEmbedInfo,
  getEffectiveThumbnail,
  type VideoEmbedInfo,
} from '@/lib/video';
import { getItemSmartTags } from '@/lib/smartTags';
import { getFriendlyErrorMessage } from '@/lib/errorMessage';

export interface DetailSheetProps {
  item?: ParsedItem | null;
  onClose?: () => void;
}

export function DetailSheet({ item: propItem, onClose: propOnClose }: DetailSheetProps = {}) {
  const {
    items,
    selectedDetailItem: rawItem,
    isRandomDecision,
    rerollRandomDecision,
    closeDetail,
    deleteItem,
    cartSelectedIds,
    toggleCartItem,
    toggleFavorite,
    toggleCompleted,
    updateUserNote,
    updateItemTags,
    globalCustomTags,
    addGlobalCustomTag,
    selectedCookingRecipeIds,
    toggleCookingRecipe,
    selectedPlaceIds,
    toggleSelectedPlace,
    addToast,
  } = useAppState();

  const resolvedInputItem = rawItem || propItem;
  const activeItem = useMemo(() => {
    if (!resolvedInputItem) return null;
    return items.find((i) => i.id === resolvedInputItem.id) || resolvedInputItem;
  }, [resolvedInputItem, items]);

  const [displayedItem, setDisplayedItem] = useState<ParsedItem | null>(activeItem);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [inlineTagInput, setInlineTagInput] = useState('');

  // Active media cover state (支援點擊下方 sources 於頂部切換海報與複製網址)
  const [activeMedia, setActiveMedia] = useState<{
    url: string;
    cover?: string | null;
    title?: string;
  } | null>(null);

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaveStatus, setNoteSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Mobile gesture tracking refs
  const mobileSheetRef = useRef<HTMLDivElement>(null);
  const isDraggingHandleRef = useRef(false);
  const handleStartYRef = useRef(0);
  const handleDeltaYRef = useRef(0);

  // Content touch overscroll & pull-down tracking refs
  const scrollableContentRef = useRef<HTMLDivElement>(null);
  const isContentDraggingRef = useRef(false);
  const contentTouchStartYRef = useRef(0);
  const contentDeltaYRef = useRef(0);
  const activeGestureRef = useRef<'none' | 'pull-down' | 'overscroll-up'>('none');
  const [bottomOverscrollPx, setBottomOverscrollPx] = useState(0);

  // Synchronize item and animate open / close transitions
  useEffect(() => {
    if (activeItem) {
      setDisplayedItem((prev) => {
        if (prev && prev.id !== activeItem.id) {
          setActiveMedia(null);
        }
        return activeItem;
      });
      setIsClosing(false);
      const timer = requestAnimationFrame(() => {
        setIsOpen(true);
      });
      return () => cancelAnimationFrame(timer);
    } else {
      if (displayedItem && !isClosing) {
        setIsClosing(true);
        setIsOpen(false);
        setActiveMedia(null);
        const timer = setTimeout(() => {
          setDisplayedItem(null);
          setIsClosing(false);
        }, 260);
        return () => clearTimeout(timer);
      }
    }
  }, [activeItem]);

  // Keep displayedItem synced with latest item data if viewing a sibling place
  useEffect(() => {
    if (!displayedItem) return;
    const latest = items.find((i) => i.id === displayedItem.id);
    if (latest && latest !== displayedItem) {
      setDisplayedItem(latest);
    }
  }, [items, displayedItem]);

  // Synchronize note draft when item changes
  useEffect(() => {
    setNoteDraft(displayedItem?.userNote || '');
    setNoteSaveStatus('idle');
  }, [displayedItem?.id]);

  // Unified smooth exit trigger
  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsOpen(false);
    setTimeout(() => {
      propOnClose?.();
      closeDetail();
      setDisplayedItem(null);
      setIsClosing(false);
    }, 260);
  }, [isClosing, closeDetail, propOnClose]);

  // Keyboard ESC key and body overflow lock
  useEffect(() => {
    if (!displayedItem) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [displayedItem, handleClose]);

  // 1. Mobile pull-down handle gesture handlers
  const handleMobileDragStart = useCallback((clientY: number) => {
    handleStartYRef.current = clientY;
    handleDeltaYRef.current = 0;
    isDraggingHandleRef.current = true;
    if (mobileSheetRef.current) {
      mobileSheetRef.current.style.transition = 'none';
    }
  }, []);

  const handleMobileDragMove = useCallback((clientY: number) => {
    if (!isDraggingHandleRef.current) return;
    const diff = clientY - handleStartYRef.current;
    handleDeltaYRef.current = diff;

    if (mobileSheetRef.current && diff > 0) {
      mobileSheetRef.current.style.transform = `translate3d(0, ${diff}px, 0)`;
    }
  }, []);

  const handleMobileDragEnd = useCallback(() => {
    if (!isDraggingHandleRef.current) return;
    isDraggingHandleRef.current = false;

    const diff = handleDeltaYRef.current;
    handleDeltaYRef.current = 0;

    if (diff > 75) {
      // Exceeded threshold: animate down and close
      if (mobileSheetRef.current) {
        mobileSheetRef.current.style.transition = 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1), opacity 260ms ease';
        mobileSheetRef.current.style.transform = 'translate3d(0, 100%, 0)';
        mobileSheetRef.current.style.opacity = '0.85';
      }
      handleClose();
    } else {
      // Snap back smoothly
      if (mobileSheetRef.current) {
        mobileSheetRef.current.style.transition = 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)';
        mobileSheetRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
    }
  }, [handleClose]);

  // 2. Mobile content gestures (置頂下拉收起 + 置底上滑收起)
  const handleContentTouchStart = useCallback((e: React.TouchEvent) => {
    const el = scrollableContentRef.current;
    if (!el) return;
    isContentDraggingRef.current = true;
    contentTouchStartYRef.current = e.touches[0].clientY;
    contentDeltaYRef.current = 0;
    activeGestureRef.current = 'none';
    setBottomOverscrollPx(0);
  }, []);

  const handleContentTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isContentDraggingRef.current) return;
    const el = scrollableContentRef.current;
    const sheet = mobileSheetRef.current;
    if (!el || !sheet) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - contentTouchStartYRef.current;
    contentDeltaYRef.current = diff;

    // 置頂繼續往下滑 (scrollTop <= 0 且 diff > 0)
    if (el.scrollTop <= 0 && diff > 0) {
      activeGestureRef.current = 'pull-down';
      sheet.style.transition = 'none';
      sheet.style.transform = `translate3d(0, ${diff}px, 0)`;
      return;
    }

    // 置底繼續往上滑 (scrollTop + clientHeight >= scrollHeight - 2 且 diff < 0)
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
    if (isAtBottom && diff < 0) {
      activeGestureRef.current = 'overscroll-up';
      const pullPx = Math.abs(diff);
      setBottomOverscrollPx(pullPx);
      const damped = Math.min(pullPx * 0.38, 45);
      sheet.style.transition = 'none';
      sheet.style.transform = `translate3d(0, -${damped}px, 0)`;
      return;
    }

    // 正常滾動時歸位
    if (activeGestureRef.current !== 'none') {
      activeGestureRef.current = 'none';
      sheet.style.transition = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)';
      sheet.style.transform = 'translate3d(0, 0, 0)';
      setBottomOverscrollPx(0);
    }
  }, []);

  const handleContentTouchEnd = useCallback(() => {
    if (!isContentDraggingRef.current) return;
    isContentDraggingRef.current = false;
    const sheet = mobileSheetRef.current;
    const gesture = activeGestureRef.current;
    const diff = contentDeltaYRef.current;
    activeGestureRef.current = 'none';

    if (!sheet) return;

    // 置頂下拉超過 75px 觸發關閉
    if (gesture === 'pull-down' && diff > 75) {
      sheet.style.transition = 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1), opacity 260ms ease';
      sheet.style.transform = 'translate3d(0, 100%, 0)';
      sheet.style.opacity = '0.85';
      handleClose();
      return;
    }

    // 置底上滑超過 75px 觸發關閉
    if (gesture === 'overscroll-up' && Math.abs(diff) > 75) {
      sheet.style.transition = 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1), opacity 260ms ease';
      sheet.style.transform = 'translate3d(0, 100%, 0)';
      sheet.style.opacity = '0.85';
      handleClose();
      setBottomOverscrollPx(0);
      return;
    }

    // 未達門檻，彈性歸位
    sheet.style.transition = 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease';
    sheet.style.transform = 'translate3d(0, 0, 0)';
    sheet.style.opacity = '1';
    setBottomOverscrollPx(0);
  }, [handleClose]);

  // Sibling places memo: find all places originating from the same compilation video
  const siblingPlaces = useMemo(() => {
    if (!displayedItem || displayedItem.category !== 'place') return [];
    const normUrl = normalizeSocialUrl(displayedItem.url);
    const thumbKey = displayedItem.thumbnailUrl ? displayedItem.thumbnailUrl.split('?')[0] : '';
    if (!normUrl && !thumbKey) return [];

    return items.filter((other) => {
      if (other.category !== 'place') return false;
      const otherNormUrl = normalizeSocialUrl(other.url);
      const otherThumbKey = other.thumbnailUrl ? other.thumbnailUrl.split('?')[0] : '';
      if (normUrl && otherNormUrl && normUrl === otherNormUrl) return true;
      if (thumbKey && otherThumbKey && thumbKey === otherThumbKey) return true;
      return false;
    });
  }, [displayedItem, items]);

  // Unified multi-places list: supports sibling place cards or item.subPlaces fallback
  const multiPlacesList = useMemo(() => {
    if (!displayedItem || displayedItem.category !== 'place') return [];

    if (siblingPlaces.length > 1) {
      return siblingPlaces.map((sp, idx) => {
        const queryText =
          sp.placeInfo?.googleMapsQuery ||
          `${sp.placeInfo?.city || ''} ${sp.placeInfo?.locationName || sp.title} ${sp.placeInfo?.address || ''}`.trim();
        const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`;
        return {
          id: sp.id,
          targetItem: sp,
          idx: idx + 1,
          name: sp.placeInfo?.locationName || sp.title,
          rating: sp.placeInfo?.rating,
          city: sp.placeInfo?.city,
          address: sp.placeInfo?.address,
          mustTryDishes: sp.placeInfo?.mustTryDishes || [],
          summary: sp.placeInfo?.reviewsSummary?.[0] || sp.summary,
          mapLink,
          isCurrent: sp.id === displayedItem.id,
          isInItinerary: selectedPlaceIds.includes(sp.id),
        };
      });
    }

    if (displayedItem.subPlaces && displayedItem.subPlaces.length > 0) {
      return displayedItem.subPlaces.map((sp, idx) => {
        const matchingItem = items.find((other) => {
          if (other.category !== 'place') return false;
          const nameA = (sp.shopName || sp.name || '').trim().toLowerCase();
          const nameB = (other.placeInfo?.locationName || other.title || '').trim().toLowerCase();
          return Boolean(nameA && nameB && (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA)));
        });

        const target = matchingItem || null;
        const queryText =
          sp.googleMapsQuery ||
          target?.placeInfo?.googleMapsQuery ||
          `${sp.city || ''} ${sp.name} ${sp.address || ''}`.trim();
        const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryText)}`;

        return {
          id: target ? target.id : `subplace-${idx}`,
          targetItem: target,
          idx: idx + 1,
          name: sp.shopName || sp.name,
          rating: sp.rating || target?.placeInfo?.rating,
          city: sp.city || target?.placeInfo?.city,
          address: sp.address || target?.placeInfo?.address,
          mustTryDishes: sp.mustTryDishes || target?.placeInfo?.mustTryDishes || [],
          summary: sp.highlight || sp.summary || target?.summary || target?.placeInfo?.reviewsSummary?.[0],
          mapLink,
          isCurrent: target ? target.id === displayedItem.id : false,
          isInItinerary: target ? selectedPlaceIds.includes(target.id) : false,
        };
      });
    }

    return [];
  }, [displayedItem, siblingPlaces, items, selectedPlaceIds]);

  if (!displayedItem) return null;

  const item = displayedItem;

  const catMeta = getCategoryMeta(item.category);
  const isCartSelected = cartSelectedIds.includes(item.id);
  const isMoviePoster =
    item.category === 'media' && Boolean(item.mediaInfo?.posterUrl || item.aspectRatio === '27:40');

  const currentUrl = activeMedia?.url || item.url;
  const canonicalUrl = currentUrl;

  const displayCover =
    item.category === 'media' && item.mediaInfo?.posterUrl
      ? item.mediaInfo.posterUrl
      : getEffectiveThumbnail(item, canonicalUrl) || item.thumbnailUrl;

  const currentCover =
    activeMedia?.cover !== undefined
      ? activeMedia.cover
      : displayCover;
  const currentTitle = activeMedia?.title || item.title;

  const embedInfo: VideoEmbedInfo = getVideoEmbedInfo(canonicalUrl);
  const resolvedAspect = isMoviePoster && !activeMedia
    ? '27:40'
    : item.aspectRatio === '1:1' && !activeMedia
      ? '1:1'
      : embedInfo.type === 'youtube' && embedInfo.aspectRatio === '16:9'
        ? '16:9'
        : (!activeMedia && (item.aspectRatio === '16:9' || isYouTubeStandardVideo(item.url)))
          ? '16:9'
          : item.aspectRatio === '4:5' && !activeMedia
            ? '4:5'
            : '9:16';

  const visualContainerWidthClass =
    resolvedAspect === '16:9'
      ? 'w-full max-w-[520px]'
      : resolvedAspect === '1:1'
        ? 'w-full max-w-[320px]'
        : 'w-full max-w-[280px] sm:max-w-[300px]';

  const visualAspectClass =
    resolvedAspect === '16:9'
      ? 'aspect-video'
      : resolvedAspect === '1:1'
        ? 'aspect-square'
        : resolvedAspect === '27:40'
          ? 'aspect-[27/40]'
          : resolvedAspect === '4:5'
            ? 'aspect-[4/5]'
            : 'aspect-[9/16]';

  const currentCustomTags = item.customTags || [];

  const handleInlineToggleTag = async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    let nextTags: string[];
    if (currentCustomTags.includes(trimmed)) {
      nextTags = currentCustomTags.filter((t) => t !== trimmed);
    } else {
      nextTags = [...currentCustomTags, trimmed];
      await addGlobalCustomTag(trimmed);
    }
    await updateItemTags(item.id, nextTags);
  };

  const handleInlineAddTag = async () => {
    const trimmed = inlineTagInput.trim();
    if (!trimmed) return;
    if (!currentCustomTags.includes(trimmed)) {
      const nextTags = [...currentCustomTags, trimmed];
      await addGlobalCustomTag(trimmed);
      await updateItemTags(item.id, nextTags);
    }
    setInlineTagInput('');
  };

  const renderVisualHero = () => {
    const effectiveCover = currentCover || getEffectiveThumbnail(item, canonicalUrl);
    if (!effectiveCover && !canonicalUrl) return null;

    return (
      <div className={cn('mx-auto flex flex-col gap-2.5 select-none shrink-0', visualContainerWidthClass)}>
        {/* 若目前切換至次要來源影片，提供提示與返回按鈕 */}
        {activeMedia && activeMedia.url !== item.url && (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#3F7D58]/10 border border-[#3F7D58]/30 text-xs">
            <span className="text-ink font-semibold truncate max-w-[200px] flex items-center gap-1.5">
              <Play className="w-3 h-3 text-[#3F7D58] fill-current shrink-0" />
              <span className="truncate">{activeMedia.title || getDomain(activeMedia.url)}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveMedia(null);
              }}
              className="text-[11px] text-[#3F7D58] font-bold hover:underline cursor-pointer shrink-0 ml-2"
            >
              返回主卡片
            </button>
          </div>
        )}

        {/* 100% 靜態高畫質海報封面容器（無 <a>、無 iframe，單純顯示圖片） */}
        <div
          className={cn(
            'relative w-full rounded-2xl overflow-hidden shadow-md bg-stone-900 flex items-center justify-center border border-black/10',
            visualAspectClass
          )}
        >
          <CoverImage
            thumbnailUrl={effectiveCover}
            title={currentTitle}
            category={item.category}
            url={canonicalUrl}
            id={item.id}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    );
  };

  const completedActionText =
    item.category === 'recipe'
      ? '已完成（已煮過）'
      : item.category === 'place'
        ? '已完成（已去過）'
        : item.category === 'media'
          ? '已完成（已看過）'
          : '已完成';

  const handleNoteChange = (val: string) => {
    setNoteDraft(val);
    setNoteSaveStatus('saving');
  };

  const handleNoteBlur = async () => {
    if (noteDraft !== (item.userNote || '')) {
      setNoteSaveStatus('saving');
      await updateUserNote(item.id, noteDraft);
      setNoteSaveStatus('saved');
    } else {
      setNoteSaveStatus('idle');
    }
  };

  const handleDeleteCard = () => {
    if (window.confirm(`確定要刪除「${item.title}」嗎？`)) {
      deleteItem(item.id);
      handleClose();
    }
  };


  // Reusable Action Toggles (Completed, Cooking List, Itinerary, Favorite, Tag Editor)
  const renderActionToggles = () => (
    <div className="flex flex-wrap items-center gap-2">
      {/* ✅ 已去過／已煮過／已看過 狀態追蹤按鈕 */}
      <button
        type="button"
        onClick={() => toggleCompleted(item.id)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer shadow-2xs',
          item.isCompleted
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
            : 'bg-surface-2 text-ink-2 border-line hover:border-emerald-600/50 hover:text-emerald-700'
        )}
      >
        {item.isCompleted ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{completedActionText}</span>
          </>
        ) : (
          <>
            <Circle className="w-3.5 h-3.5 text-ink-3" />
            <span>待體驗</span>
          </>
        )}
      </button>

      {/* 食譜專屬：加入今日料理清單 */}
      {item.category === 'recipe' && (
        <button
          type="button"
          onClick={() => toggleCookingRecipe(item.id)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer shadow-2xs',
            selectedCookingRecipeIds.includes(item.id)
              ? 'bg-[#3F7D58] text-white border-[#3F7D58] shadow-xs'
              : 'bg-[#3F7D58]/10 text-[#3F7D58] border-[#3F7D58]/30 hover:bg-[#3F7D58]/20'
          )}
        >
          {selectedCookingRecipeIds.includes(item.id) ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>已在料理清單</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>加入料理清單</span>
            </>
          )}
        </button>
      )}

      {/* 景點專屬：加入待排行程按鈕 */}
      {item.category === 'place' && (
        <button
          type="button"
          onClick={() => toggleSelectedPlace(item.id)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer shadow-2xs',
            selectedPlaceIds.includes(item.id)
              ? 'bg-[#3F7D58] text-white border-[#3F7D58] shadow-xs'
              : 'bg-[#3F7D58]/10 text-[#3F7D58] border-[#3F7D58]/30 hover:bg-[#3F7D58]/20'
          )}
        >
          {selectedPlaceIds.includes(item.id) ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>已在待排行程</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>加入待排行程</span>
            </>
          )}
        </button>
      )}


      {/* Heart Favorite Toggle */}
      <button
        type="button"
        onClick={() => toggleFavorite(item.id)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer',
          item.isFavorite
            ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
            : 'bg-surface-2 text-ink-3 hover:text-rose-500 border-line hover:bg-surface'
        )}
      >
        <Heart className={cn('w-3.5 h-3.5', item.isFavorite && 'fill-white')} />
        <span>{item.isFavorite ? '已加入最愛' : '加入最愛'}</span>
      </button>

      {/* Tag Editor Button */}
      <button
        type="button"
        onClick={() => setIsTagModalOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-2 text-ink-2 hover:text-accent border border-line transition-colors cursor-pointer font-sans"
      >
        <Tag className="w-3.5 h-3.5 text-accent" />
        <span>編輯標籤</span>
      </button>
    </div>
  );

  // Reusable Body Sections (Tags, Specific Categories, Notes, Sources)
  const renderSections = () => {
    const smartTags = getItemSmartTags(item);
    const rawAiTags = (item.tags || []).map((t) => (t.startsWith('#') ? t : `#${t}`));
    const rawCustomTags = item.customTags || [];
    const allTags = Array.from(new Set([...smartTags, ...rawAiTags, ...rawCustomTags]));

    return (
      <div className="space-y-5">
        {/* 🧠 系統自動檢測智慧標籤 (Smart Tags) 與 AI 標籤 */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {allTags.map((tag, idx) => {
              const isSmart = smartTags.includes(tag);
              return (
                <span
                  key={idx}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs shrink-0 whitespace-nowrap transition-colors border',
                    isSmart
                      ? 'bg-accent/15 text-accent border-accent/30 font-bold shadow-2xs'
                      : 'bg-surface-2 text-ink-2 border-line font-medium'
                  )}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}

      {/* Place Info */}
      {item.category === 'place' && item.placeInfo && (
        <PlaceSection placeInfo={item.placeInfo} item={item} />
      )}

      {/* 🗺️ 合集多地點拆解清單 (包含獨立切換、店名、評分、招牌菜、真實地址、評論摘要、待排行程按鈕、複製地址) */}
      {multiPlacesList.length > 0 && (
        <div className="rounded-2xl border border-black/10 bg-surface-2/40 p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between border-b border-black/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#3F7D58]/15 flex items-center justify-center text-[#3F7D58] shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-ink">
                  合集內含所有推薦地點（共 {multiPlacesList.length} 處）
                </h4>
                <p className="text-[11px] text-ink-3">
                  點擊任一店家可原地切換瀏覽、收藏與記錄筆記
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {multiPlacesList.map((place) => {
              const isCurrentActive = place.isCurrent;
              return (
                <div
                  key={place.id}
                  onClick={() => {
                    if (place.targetItem && place.targetItem.id !== item.id) {
                      setDisplayedItem(place.targetItem);
                    }
                  }}
                  className={cn(
                    'group relative rounded-xl border p-3.5 sm:p-4 transition-all duration-200 shadow-2xs',
                    place.targetItem && place.targetItem.id !== item.id
                      ? 'cursor-pointer hover:border-[#3F7D58]/50 hover:bg-surface hover:shadow-xs'
                      : '',
                    isCurrentActive
                      ? 'border-[#3F7D58] bg-[#3F7D58]/5 ring-1 ring-[#3F7D58]/30 shadow-xs'
                      : 'border-black/10 bg-surface'
                  )}
                >
                  {/* 上半部：序號、店名、評分、城市、目前檢視中標籤 */}
                  <div className="flex items-start justify-between gap-2.5 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0',
                          isCurrentActive
                            ? 'bg-[#3F7D58] text-white'
                            : 'bg-[#3F7D58]/15 text-[#3F7D58]'
                        )}
                      >
                        {place.idx}
                      </span>

                      <h5 className="text-sm font-bold text-ink break-words">
                        {place.name}
                      </h5>

                      {place.rating && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-300/40">
                          ★ {place.rating}
                        </span>
                      )}

                      {place.city && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-2 text-ink-2 border border-line shrink-0">
                          {place.city}
                        </span>
                      )}
                    </div>

                    {isCurrentActive && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#3F7D58] text-white shadow-2xs shrink-0 animate-in fade-in duration-200">
                        ✓ 目前檢視中
                      </span>
                    )}
                  </div>

                  {/* 地址 */}
                  {place.address && place.address.trim() !== place.name.trim() && (
                    <p className="text-xs text-ink-3 pl-7 pt-1 leading-relaxed break-words">
                      📍 {place.address}
                    </p>
                  )}

                  {/* 招牌推薦料理 (mustTryDishes) */}
                  {place.mustTryDishes && place.mustTryDishes.length > 0 && (
                    <div className="pl-7 pt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-accent shrink-0">
                        🍽️ 招牌：
                      </span>
                      {place.mustTryDishes.slice(0, 5).map((dish, dIdx) => (
                        <span
                          key={dIdx}
                          className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-accent/10 text-accent border border-accent/20 break-words"
                        >
                          {dish}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 探店 / Google 評論重點摘要 (summary) */}
                  {place.summary && (
                    <div className="pl-7 pt-2">
                      <p className="text-xs text-ink-2 leading-relaxed line-clamp-2 bg-surface-2/60 p-2 rounded-lg border border-line/60">
                        💬 {place.summary}
                      </p>
                    </div>
                  )}

                  {/* 底部按鈕操作列：獨立加入待排行程 ＋ 複製店名與地址 ＋ (若非當前檢視) 點擊切換提示 */}
                  <div className="pl-7 pt-3 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* 獨立加入待排行程按鈕 */}
                      {place.targetItem ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectedPlace(place.targetItem!.id);
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0',
                            place.isInItinerary
                              ? 'bg-[#3F7D58] text-white shadow-xs'
                              : 'bg-[#3F7D58]/10 text-[#3F7D58] border border-[#3F7D58]/30 hover:bg-[#3F7D58]/20'
                          )}
                        >
                          {place.isInItinerary ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>已在行程</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>加入行程</span>
                            </>
                          )}
                        </button>
                      ) : null}

                      {/* 安全複製店名與地址按鈕 */}
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const copyText = [place.city, place.name, place.address].filter(Boolean).join(' ');
                          await navigator.clipboard.writeText(copyText);
                          addToast({ type: 'success', message: '📋 已複製店名與地址' });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-surface-2 hover:bg-line/40 text-ink border border-line transition-colors shrink-0 cursor-pointer"
                      >
                        <span>📋 複製店名與地址</span>
                      </button>
                    </div>

                    {/* 切換檢視按鈕 / 提示 */}
                    {place.targetItem && !isCurrentActive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDisplayedItem(place.targetItem!);
                        }}
                        className="text-xs font-bold text-[#3F7D58] hover:underline inline-flex items-center gap-1 cursor-pointer ml-auto"
                      >
                        <span>切換為此店主視圖</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recipe Info */}
      {item.category === 'recipe' && item.recipeInfo && (
        <RecipeSection recipeInfo={item.recipeInfo} itemId={item.id} />
      )}

      {/* Media & Movie Info */}
      {item.category === 'media' && (
        <div className="space-y-4">
          <MovieDetailSection item={item} />
        </div>
      )}

      {/* Product / Gadget Info (if present) */}
      {item.productInfo && (
        <ProductSection productInfo={item.productInfo} />
      )}

      {/* 🛍️ 合集多商品拆解清單 (subProducts) */}
      {item.subProducts && item.subProducts.length > 0 && (
        <div className="rounded-xl border border-black/10 bg-surface-2/40 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-black/10 pb-2">
            <div className="flex items-center gap-2 text-sm font-bold text-ink">
              <ShoppingBag className="w-4 h-4 text-accent" />
              <span>合集內含所有推薦好物（共 {item.subProducts.length} 項）</span>
            </div>
          </div>
          <div className="space-y-2.5">
            {item.subProducts.map((prod, idx) => {
              const prodText = `${prod.brand || ''} ${prod.name}`.trim();
              return (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-lg bg-surface border border-black/10 shadow-2xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/15 text-accent text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-bold text-ink truncate">
                        {prod.name}
                      </span>
                      {prod.brand && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-2 text-ink-2 border border-line">
                          {prod.brand}
                        </span>
                      )}
                      {prod.price && (
                        <span className="text-xs font-bold text-accent">
                          {prod.price}
                        </span>
                      )}
                    </div>
                    {prod.highlight && (
                      <p className="text-xs text-ink-2 leading-relaxed pl-7">
                        {prod.highlight}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(prodText);
                      addToast({ type: 'success', message: '📋 已複製商品名稱' });
                    }}
                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-2 hover:bg-surface text-ink border border-line transition-colors shrink-0 self-start sm:self-center cursor-pointer"
                  >
                    <span>📋 複製商品名稱</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shopping Plan (if present) */}
      {item.shoppingPlan && (
        <ShoppingSection
          shoppingPlan={item.shoppingPlan}
          isCartSelected={isCartSelected}
          onToggleCart={() => toggleCartItem(item.id)}
        />
      )}

      {/* 📝 我的私人筆記與評分 (userNote) */}
      <div className="rounded-xl border border-black/10 bg-surface-2/40 p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="detail-user-note"
            className="flex items-center gap-1.5 text-sm font-bold text-ink"
          >
            <FileEdit className="w-4 h-4 text-accent" />
            <span>我的私人筆記與評分</span>
          </label>
          <span className="text-[11px] text-ink-3 font-medium">
            {noteSaveStatus === 'saving'
              ? '儲存中...'
              : noteSaveStatus === 'saved'
                ? '✓ 已自動儲存'
                : '離開輸入框即自動儲存'}
          </span>
        </div>
        <textarea
          id="detail-user-note"
          value={noteDraft}
          onChange={(e) => handleNoteChange(e.target.value)}
          onBlur={handleNoteBlur}
          rows={3}
          placeholder="記錄你的真實體驗心得（例如：拉麵太鹹下次點淡味、醬油減半更好吃、必點招牌布丁...）"
          className="w-full p-3 rounded-lg bg-surface border border-line focus:border-accent focus:outline-none text-xs md:text-sm text-ink placeholder:text-ink-3 resize-y transition-colors"
        />
      </div>

      {/* Multi-source Merged Posts (Related reviews, articles - for places, recipes) */}
      {item.category !== 'media' && (
        <RelatedSourcesSection
          item={item}
          activeSourceUrl={activeMedia?.url}
          onSelectSource={(src) => {
            setActiveMedia({
              url: src.url,
              cover: src.thumbnailUrl,
              title: src.title,
            });
            if (scrollableContentRef.current) {
              scrollableContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        />
      )}
    </div>
  );
};

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-end md:items-center md:justify-center overflow-hidden"
    >
      {/* 半透明背景遮罩 (Backdrop) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        className={cn(
          'fixed inset-0 bg-black/50 backdrop-blur-sm cursor-pointer z-0 transition-opacity duration-250 ease-out',
          isOpen && !isClosing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden="true"
      />

      {/* ========================================================================= */}
      {/* 💻 電腦版呈現（md: 以上）—— 螢幕正中央單欄上下垂直滾動彈窗 (Centered Modal)  */}
      {/* ========================================================================= */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'hidden md:flex relative z-10 w-[92vw] max-w-2xl max-h-[88vh] bg-surface rounded-3xl shadow-2xl overflow-y-auto flex-col border border-line transition-all duration-200 ease-out p-6 lg:p-8 space-y-5',
          isOpen && !isClosing
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-95 pointer-events-none'
        )}
      >
        {/* 頂部 Header 列：分類標籤、來源、刪除卡片與關閉 ✕ 按鈕 */}
        <div className="flex items-start justify-between gap-4 border-b border-line pb-3.5 shrink-0">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-bold border font-sans tracking-wide',
                  catMeta.badgeClass
                )}
              >
                <catMeta.icon className="w-3.5 h-3.5" />
                <span>{catMeta.label}</span>
              </span>
              <span className="text-xs text-ink-3 font-sans">
                {getDomain(item.url)} · {formatDate(item.createdAt)}
              </span>
            </div>
          </div>

          {/* 右上角操作按鈕 */}
          <div className="flex items-center gap-2 shrink-0 z-20">
            <button
              type="button"
              onClick={handleDeleteCard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-colors cursor-pointer"
              title="刪除此收藏卡片"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>刪除卡片</span>
            </button>

            <button
              type="button"
              aria-label="關閉"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-2 hover:bg-line/20 text-ink-2 hover:text-ink transition-colors cursor-pointer active:scale-95 shadow-2xs"
              title="關閉 (ESC)"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* 🎲 幫我決定：隨機抽選頂部提示列 */}
        {isRandomDecision && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/30 text-ink shadow-2xs shrink-0">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-accent">
              <span className="text-base">🎲</span>
              <span>已為你隨機選出！不滿意可以馬上重抽：</span>
            </div>
            <button
              type="button"
              onClick={rerollRandomDecision}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-accent text-white hover:bg-accent/90 transition-all cursor-pointer shadow-xs shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>🔄 換一個</span>
            </button>
          </div>
        )}

        {/* 最上方（置頂視覺區）：Click-to-Play 播放器 / 封面容器 */}
        {renderVisualHero()}

        {/* 狀態追蹤按鈕列 (已體驗、料理/行程清單、最愛、標籤) */}
        <div className="shrink-0">{renderActionToggles()}</div>

        {/* 標題與簡介摘要 */}
        <div className="space-y-2 shrink-0">
          <h2 className="font-display text-2xl font-bold text-ink leading-snug break-words">
            {item.title}
          </h2>
          {item.summary && (
            <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line break-words">
              {item.summary}
            </p>
          )}
        </div>

        {/* 專屬內容區塊 (食材/景點/電影/購物/筆記) */}
        <div className="space-y-6">{renderSections()}</div>

        {/* 底部動作列 */}
        <div className="pt-4 border-t border-line shrink-0">
          <DetailActionBar url={item.url} onDelete={handleDeleteCard} />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📱 手機版呈現（md 以下）—— 經典底部滑出抽屜 (Bottom Sheet)                  */}
      {/* ========================================================================= */}
      <div
        ref={mobileSheetRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'md:hidden relative z-10 w-full bg-surface shadow-sheet flex flex-col max-h-[90dvh] h-[85dvh] rounded-t-3xl border-t border-line will-change-transform',
          isOpen && !isClosing
            ? 'translate-y-0 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]'
            : 'translate-y-full transition-transform duration-[260ms] ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-none'
        )}
      >
        {/* 頂部拖曳把手（手勢向下拉動收起） */}
        <div
          onTouchStart={(e) => handleMobileDragStart(e.touches[0].clientY)}
          onTouchMove={(e) => handleMobileDragMove(e.touches[0].clientY)}
          onTouchEnd={handleMobileDragEnd}
          className="w-full flex flex-col items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none shrink-0 group"
          title="向下拖拉以關閉資訊欄"
        >
          <div className="w-12 h-1.5 rounded-full bg-ink-3/40 group-hover:bg-ink-3/70 transition-all" />
        </div>

        {/* 手機版頂部標題列 */}
        <div className="flex items-start justify-between px-4 pt-1 pb-3 border-b border-line shrink-0">
          <div className="pr-3 space-y-0.5 min-w-0 flex-1">
            <h2 className="text-base font-display font-bold text-ink tracking-tight line-clamp-1">
              {item.title}
            </h2>
            <p className="text-xs text-ink-3 line-clamp-1">
              {catMeta.label} • {getDomain(item.url)}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 z-20">
            <button
              type="button"
              onClick={handleDeleteCard}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control text-xs font-semibold text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 transition-colors cursor-pointer"
              title="刪除此收藏卡片"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              aria-label="關閉"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-2 hover:bg-line/20 text-ink-2 hover:text-ink transition-colors cursor-pointer active:scale-95 shadow-2xs"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* 手機版滾動內容容器 (支援滑到底部過捲收起手勢) */}
        <div
          ref={scrollableContentRef}
          onTouchStart={handleContentTouchStart}
          onTouchMove={handleContentTouchMove}
          onTouchEnd={handleContentTouchEnd}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-5 overscroll-contain box-border"
        >
          {/* 🎲 幫我決定：隨機抽選頂部提示列 */}
          {isRandomDecision && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-accent/10 border border-accent/30 text-ink text-xs font-bold">
              <span>🎲 已為你隨機選出！</span>
              <button
                type="button"
                onClick={rerollRandomDecision}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-accent text-white hover:bg-accent/90"
              >
                <RefreshCw className="w-3 h-3" />
                <span>換一個</span>
              </button>
            </div>
          )}

          {/* 手機版封面展示區：Click-to-Play 播放器 / 封面容器 */}
          {renderVisualHero()}

          {/* 狀態追蹤按鈕列 */}
          <div>
            {renderActionToggles()}
          </div>

          {/* 標題與簡介摘要 */}
          <div className="space-y-1.5">
            <h3 className="font-display text-lg font-bold text-ink leading-snug break-words">
              {item.title}
            </h3>
            {item.summary && (
              <p className="text-xs text-ink-2 leading-relaxed whitespace-pre-line break-words">
                {item.summary}
              </p>
            )}
          </div>

          {/* 專屬內容區塊 */}
          {renderSections()}

          {/* 雙向手勢底部提示（滑到底部繼續向上拉動收起） */}
          <div className="pt-6 pb-2 text-center text-xs text-ink-3 transition-opacity duration-200 select-none">
            {bottomOverscrollPx > 65 ? (
              <span className="text-accent font-bold animate-pulse">
                ↑ 放開以關閉資訊卡
              </span>
            ) : (
              <span className="opacity-50">
                滑到底部繼續向上拉動即可收起資訊卡
              </span>
            )}
          </div>
        </div>

        {/* 手機版底部動作列 */}
        <div className="px-4 py-3 border-t border-line bg-surface-2/60 shrink-0">
          <DetailActionBar
            url={item.url}
            onDelete={handleDeleteCard}
          />
        </div>
      </div>

      <TagEditorModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        item={item}
      />
    </div>
  );
}
