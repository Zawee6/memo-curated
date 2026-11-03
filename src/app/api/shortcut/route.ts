import { NextRequest, NextResponse } from 'next/server';
import { dispatchBackgroundProcess } from '@/lib/parseEngine';
import { getSpaceIdFromRequest } from '@/lib/serverDb';
import {
  enqueueUrl,
  getQueueItems,
  clearDoneQueueItems,
} from '@/lib/serverQueue';
import { getFriendlyErrorMessage } from '@/lib/errorMessage';

const CATEGORY_NAMES: Record<string, string> = {
  place: '📍 景點美食',
  recipe: '🍳 料理食譜',
  media: '🎬 影音媒體',
  product: '🛍️ 好物推薦',
  account: '👤 推薦帳號',
  general: '🔖 靈感筆記',
};

// 處理捷徑接收網址的核心分派函式
async function handleShortcutSubmission(
  rawUrl: string,
  note: string,
  spaceId: string,
  shouldWait: boolean
) {
  const cleanUrl = rawUrl.trim();
  if (!cleanUrl) {
    return NextResponse.json(
      {
        success: false,
        error: '缺少目標網址 (url)。請在 iPhone 捷徑中傳遞包含網址的內容。',
      },
      { status: 400 }
    );
  }

  // 1. 即時排入伺服器佇列 (< 50ms)
  const queueItem = await enqueueUrl(cleanUrl, note, spaceId);
  const queueId = queueItem.id;

  // 2. 伺服器背景立即啟動非同步解析 (Fire-and-Forget)
  const backgroundPromise = dispatchBackgroundProcess(cleanUrl, note, spaceId, queueId);

  // 3. 若要求等待 (?wait=true)，在伺服器端最多等待 7.8 秒
  if (shouldWait) {
    const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) =>
      setTimeout(() => resolve({ isTimeout: true }), 7800)
    );

    try {
      const outcome = await Promise.race([
        backgroundPromise.then((item) => ({ isTimeout: false as const, item })),
        timeoutPromise,
      ]);

      if (outcome.isTimeout) {
        // 8 秒超時：優雅切換為背景深入處理通知，背景任務繼續執行絕不斷線
        return NextResponse.json({
          success: true,
          status: 'processing',
          message: '⚡ 內容豐富，AI 正在背景深入整理中！稍後打開即完成',
          queueId,
          spaceId,
        });
      } else {
        const finalItem = outcome.item;
        const catLabel = CATEGORY_NAMES[finalItem.category] || '靈感收藏';
        return NextResponse.json({
          success: true,
          status: 'done',
          message: `✅ 已同步至靈感庫：[${catLabel}] ${finalItem.title}`,
          item: finalItem,
          queueId,
          spaceId,
        });
      }
    } catch (err: unknown) {
      const friendlyError = getFriendlyErrorMessage(err);
      return NextResponse.json(
        {
          success: false,
          error: `捷徑解析失敗：${friendlyError}`,
          queueId,
          spaceId,
        },
        { status: 500 }
      );
    }
  }

  // 4. 預設模式：極速秒回 (< 100ms)，完全避免 iOS 捷徑超時斷線
  return NextResponse.json({
    success: true,
    status: 'processing',
    message: '⚡ 已交由 AI 背景解析！稍後打開即完成整理',
    queueId,
    spaceId,
  });
}

// 1. POST /api/shortcut - 供 iPhone 捷徑在背景呼叫
export async function POST(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    let rawUrl = '';
    let note = '';
    let wait = false;

    const rawText = await req.text();
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const body = JSON.parse(rawText);
        rawUrl = body?.url || '';
        note = body?.note || body?.extraContent || '';
        wait = Boolean(body?.wait);
      } catch {}
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      try {
        const params = new URLSearchParams(rawText);
        rawUrl = params.get('url') || '';
        note = params.get('note') || params.get('extraContent') || '';
        wait = params.get('wait') === 'true';
      } catch {}
    }

    // 若未從 body 取得，嘗試從原始字串 Regex 擷取網址
    if (!rawUrl && rawText) {
      const match = rawText.match(/https?:\/\/[^\s"'<>]+/i);
      if (match) {
        rawUrl = match[0];
        note = rawText.replace(match[0], '').trim();
      }
    }

    // 容錯機制：嘗試從 query string 讀取
    const { searchParams } = new URL(req.url);
    if (!rawUrl) {
      rawUrl = searchParams.get('url') || searchParams.get('add') || '';
      if (!note) note = searchParams.get('note') || '';
    }
    if (!wait) {
      wait = searchParams.get('wait') === 'true';
    }

    return await handleShortcutSubmission(rawUrl, note, spaceId, wait);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('API /api/shortcut POST error:', errMessage);
    return NextResponse.json(
      {
        success: false,
        error: `捷徑處理失敗：${errMessage}`,
      },
      { status: 500 }
    );
  }
}

// 2. GET /api/shortcut - 支援兩種用途：
// A. 供 iPhone 捷徑帶入 ?url=... 在背景靜默直接觸發解析與秒回（無需 Body）
// B. 前端拉取最新排程清單
export async function GET(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const targetUrl = (searchParams.get('url') || searchParams.get('add') || '').trim();
    const note = (searchParams.get('note') || '').trim();
    const wait = searchParams.get('wait') === 'true';

    // 情境 A：iPhone 捷徑透過 GET 請求背景秒存網址
    if (targetUrl) {
      return await handleShortcutSubmission(targetUrl, note, spaceId, wait);
    }

    // 情境 B：前端定期拉取排程清單
    const items = await getQueueItems(spaceId);
    return NextResponse.json({
      success: true,
      count: items.length,
      items,
      spaceId,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('API /api/shortcut GET error:', errMessage);
    return NextResponse.json(
      {
        success: false,
        error: `處理失敗：${errMessage}`,
      },
      { status: 500 }
    );
  }
}

// 3. DELETE /api/shortcut - 清空已完成之排程項目
export async function DELETE(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    await clearDoneQueueItems(spaceId);
    return NextResponse.json({
      success: true,
      message: '已清空已完成之佇列項目',
      spaceId,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('API /api/shortcut DELETE error:', errMessage);
    return NextResponse.json(
      {
        success: false,
        error: `清空暫存信箱失敗：${errMessage}`,
      },
      { status: 500 }
    );
  }
}
