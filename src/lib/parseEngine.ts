import { ParsedItem, SavedItem, MovieCandidateItem } from '@/types/item';
import {
  parseUrlItem,
  createMovieItemFromSearch,
  createMovieItemFromCandidate,
  parseScreenshotItem,
} from '@/lib/parserService';
import { normalizeSpaceId } from '@/lib/serverDb';
import { processItemWithSplittingAndDeduplication } from '@/lib/entityDeduplication';
import { enqueueUrl, updateQueueItem } from '@/lib/serverQueue';
import { sendIPhoneNotification } from '@/lib/notificationService';
import { getFriendlyErrorMessage } from '@/lib/errorMessage';
import { after } from 'next/server';

export interface ProcessUrlOptions {
  spaceId?: string;
  queueId?: string;
  notify?: boolean;
  candidate?: MovieCandidateItem;
  imageBase64?: string;
}

export interface ProcessResult {
  finalItem: SavedItem;
  allItems?: SavedItem[];
  splitItems?: SavedItem[];
  splitCount?: number;
  isMerged?: boolean;
  sources?: string[];
}

// 記憶體中非同步互斥佇列，確保背景多工解析時，寫入 .data/db.json 不會產生競爭衝突 (Race Condition)
let backgroundTaskChain: Promise<any> = Promise.resolve();

/**
 * 將非同步任務推入循序執行佇列
 */
export function enqueueBackgroundTask<T>(task: () => Promise<T>): Promise<T> {
  const nextPromise = backgroundTaskChain.then(task, task);
  backgroundTaskChain = nextPromise.catch((err) => {
    console.error('[parseEngine] Background task chain error:', err);
  });
  return nextPromise;
}

/**
 * 伺服器端核心解析與入庫共用函式 (Detailed 版)
 * 完整執行：多層爬蟲、Gemini 結構化解析、動態智慧標籤、Nominatim 經緯度查詢、多店家拆分、去重比對，
 * 並直接寫入伺服器端 .data/db.json (完全不依賴前端瀏覽器)，完成後更新排程佇列並發送 iOS 推播通知。
 */
export async function processAndSaveUrlDetailed(
  url: string,
  note?: string,
  optionsOrSpaceId?: string | ProcessUrlOptions,
  optionalQueueId?: string
): Promise<ProcessResult> {
  const options: ProcessUrlOptions =
    typeof optionsOrSpaceId === 'object' && optionsOrSpaceId !== null
      ? optionsOrSpaceId
      : {
          spaceId: typeof optionsOrSpaceId === 'string' ? optionsOrSpaceId : undefined,
          queueId: optionalQueueId,
        };

  const spaceId = normalizeSpaceId(options.spaceId);
  const rawUrl = (url || '').trim();
  const rawNote = (note || '').trim();
  const candidate = options.candidate;
  const imageBase64 = options.imageBase64;

  if (!rawUrl && !imageBase64 && !candidate) {
    throw new Error('請提供有效的網址 (url)、電影候選項目或截圖資料。');
  }

  // 1. 確保排程佇列 (Queue) 有對應項目，讓前端即時狀態膠囊與歷史紀錄隨時可查詢
  let queueId = options.queueId;
  if (!queueId) {
    const queueLabel = candidate
      ? `🎬 ${candidate.title}`
      : imageBase64
        ? '📸 截圖辨識'
        : rawUrl;
    const queueItem = await enqueueUrl(queueLabel, rawNote, spaceId);
    queueId = queueItem.id;
  }

  const isCandidateMovie = Boolean(candidate);
  const isScreenshot = !isCandidateMovie && Boolean(imageBase64 && !rawUrl);
  const isHttpUrl =
    !isCandidateMovie &&
    !isScreenshot &&
    rawUrl &&
    (/^https?:\/\//i.test(rawUrl) ||
      /(?:instagram\.com|youtube\.com|youtu\.be|tiktok\.com|threads\.net|google\.com\/maps)/i.test(
        rawUrl
      ));
  const isExplicitMovie = !isCandidateMovie && !isScreenshot && rawUrl && /^movie:/i.test(rawUrl);
  const isMovieQuery = !isCandidateMovie && !isScreenshot && (!isHttpUrl || isExplicitMovie);

  // 2. 更新為 processing
  await updateQueueItem(queueId, {
    status: 'processing',
    stepNote: candidate
      ? `🎬 正在建立《${candidate.title}》資訊...`
      : isScreenshot
        ? '📸 Gemini Vision 正在辨識截圖內容...'
        : isMovieQuery
          ? '🎬 正在搜尋電影資料庫與 IMDb 海報...'
          : '🔍 正在抓取貼文與封面...',
  }).catch(() => {});

  try {
    // 3. 呼叫 Gemini 結構化解析與提取
    await updateQueueItem(queueId, {
      stepNote: isCandidateMovie || isMovieQuery
        ? '✨ 正在查詢串流平台與 YouTube 影評...'
        : isScreenshot
          ? '✨ 正在結構化截圖中的地標／食譜／電影／好物...'
          : '✨ Gemini 正在整理資訊...',
    }).catch(() => {});

    let parsedItem: ParsedItem;
    let sources: string[];

    if (isCandidateMovie && candidate) {
      const result = await createMovieItemFromCandidate(candidate, rawNote);
      parsedItem = result.item;
      sources = result.sources;
    } else if (isScreenshot && imageBase64) {
      const result = await parseScreenshotItem(imageBase64, rawNote);
      parsedItem = result.item;
      sources = result.sources;
    } else if (isMovieQuery && rawUrl) {
      const result = await createMovieItemFromSearch(rawUrl, rawNote);
      parsedItem = result.item;
      sources = result.sources;
    } else {
      const result = await parseUrlItem(rawUrl, rawNote);
      parsedItem = result.item;
      sources = result.sources;
    }

    // 4. 執行多地點自動拆分 ＋ 智慧實體去重比對（直接寫入伺服器資料庫）
    await updateQueueItem(queueId, {
      stepNote:
        parsedItem.category === 'place' &&
        parsedItem.subPlaces &&
        parsedItem.subPlaces.length > 1
          ? `📍 正在將 ${parsedItem.subPlaces.length} 間店家拆分為獨立卡片...`
          : '🧠 正在比對收藏庫去重...',
    }).catch(() => {});

    const {
      finalItem,
      allItems,
      isMerged,
      splitCount,
      splitItems,
    } = await processItemWithSplittingAndDeduplication(parsedItem, spaceId);

    // 5. 標記完成狀態
    const completionNote =
      splitCount && splitCount > 1
        ? `✅ 已自動拆分為 ${splitCount} 間獨立店家卡片並入庫`
        : isMerged
          ? '✅ 已合併入既有收藏'
          : '✅ 已加入收藏';

    await updateQueueItem(queueId, {
      status: 'done',
      stepNote: completionNote,
      resultItemId: finalItem.id,
      resultItemTitle: finalItem.title,
      isMerged,
    }).catch(() => {});

    // 6. 主動發送 iOS 推播通知（若使用者有設定 Bark / ntfy / Webhook）
    if (options.notify !== false) {
      try {
        await sendIPhoneNotification(
          {
            title: `📥 ${finalItem.title}`,
            body: completionNote,
            url: finalItem.url,
          },
          spaceId
        );
      } catch (notifyErr) {
        console.warn('[parseEngine] 推播通知發送略過或失敗:', notifyErr);
      }
    }

    return {
      finalItem,
      allItems,
      splitItems,
      splitCount: splitCount || 1,
      isMerged,
      sources,
    };
  } catch (error: any) {
    const friendlyError = getFriendlyErrorMessage(error);
    console.error(`[parseEngine] 解析失敗 (${rawUrl.slice(0, 50)}):`, error);
    if (queueId) {
      await updateQueueItem(queueId, {
        status: 'failed',
        stepNote: `❌ 解析失敗：${friendlyError}`,
        error: friendlyError,
      }).catch(() => {});
    }
    throw error;
  }
}

/**
 * 伺服器端核心解析與入庫共用函式（標準版，回傳 SavedItem）
 * 符合：export async function processAndSaveUrl(url: string, note?: string): Promise<SavedItem>
 */
export async function processAndSaveUrl(
  url: string,
  note?: string,
  optionsOrSpaceId?: string | ProcessUrlOptions,
  optionalQueueId?: string
): Promise<SavedItem> {
  const result = await processAndSaveUrlDetailed(
    url,
    note,
    optionsOrSpaceId,
    optionalQueueId
  );
  return result.finalItem;
}

/**
 * 在伺服器背景非同步啟動解析工作（Fire-and-Forget）
 * 不等待任務完成，在 0.05 秒內立即排程，讓 HTTP 請求能極速回傳
 */
export function dispatchBackgroundProcess(
  url: string,
  note?: string,
  spaceId?: string,
  queueId?: string
): Promise<SavedItem> {
  const task = () =>
    processAndSaveUrl(url, note, {
      spaceId,
      queueId,
      notify: true,
    });

  // 透過 backgroundTaskChain 循序防衝撞執行
  const queuedPromise = enqueueBackgroundTask(task);

  // 嘗試向 Next.js after() 註冊以確保 Node.js 生命週期正常追蹤
  try {
    after(async () => {
      await queuedPromise.catch(() => {});
    });
  } catch {
    // 若不在 Next.js 請求生命週期內（例如背景 worker），queuedPromise 依然由 Node process 自行保持運行
  }

  return queuedPromise;
}
