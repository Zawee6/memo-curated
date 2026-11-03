import { NextRequest, NextResponse } from 'next/server';
import {
  getQueueItems,
  getQueueSummary,
  enqueueUrl,
  removeQueueItem,
  clearDoneQueueItems,
} from '@/lib/serverQueue';
import { getSpaceIdFromRequest } from '@/lib/serverDb';
import { dispatchBackgroundProcess } from '@/lib/parseEngine';

// 1. POST /api/inbox - 供 iPhone 捷徑極速秒存 (< 100ms 即刻回傳排隊成功，並自動於伺服器背景進行解析入庫)
export async function POST(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    let rawUrl = '';
    let note = '';

    const rawText = await req.text();
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        const body = JSON.parse(rawText);
        rawUrl = body?.url || '';
        note = body?.note || body?.extraContent || '';
      } catch {}
    } else if (
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data')
    ) {
      try {
        const params = new URLSearchParams(rawText);
        rawUrl = params.get('url') || '';
        note = params.get('note') || params.get('extraContent') || '';
      } catch {}
    }

    // 若尚未取得網址，直接以 Regex 從整個原始文字中擷取首個 https?:// 網址
    if (!rawUrl && rawText) {
      const match = rawText.match(/https?:\/\/[^\s"'<>]+/i);
      if (match) {
        rawUrl = match[0];
        note = rawText.replace(match[0], '').trim();
      }
    }

    // 容錯機制：嘗試從 query string 讀取
    if (!rawUrl) {
      const { searchParams } = new URL(req.url);
      rawUrl = searchParams.get('url') || searchParams.get('add') || '';
      if (!note) note = searchParams.get('note') || '';
    }

    rawUrl = rawUrl.trim();
    if (!rawUrl) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少目標網址 (url)。請在 iPhone 捷徑中傳遞包含網址的內容。',
        },
        { status: 400 }
      );
    }

    // 1. 秒入排程佇列 (Phase 1: < 100ms)，包含特定空間代號 spaceId
    const queueItem = await enqueueUrl(rawUrl, note, spaceId);
    const summary = await getQueueSummary(spaceId);

    // 2. 核心升級：立刻在伺服器背景啟動 100% 自動解析與入庫，無需等待瀏覽器打開！
    dispatchBackgroundProcess(rawUrl, note, spaceId, queueItem.id);

    return NextResponse.json({
      success: true,
      message: `📥 連結已進入【${spaceId}】排程佇列，背景立即開始解析！`,
      spaceId,
      item: queueItem,
      summary,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('API /api/inbox POST error:', errMessage);
    return NextResponse.json(
      {
        success: false,
        error: `捷徑入庫失敗：${errMessage}`,
      },
      { status: 500 }
    );
  }
}

// 2. GET /api/inbox - 供前端狀態膠囊與輪詢查詢最新佇列狀態，或 iPhone 舊版捷徑 GET 秒存
export async function GET(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const targetUrl = (searchParams.get('url') || searchParams.get('add') || '').trim();
    const note = (searchParams.get('note') || '').trim();

    // 容錯支援：iPhone 舊版捷徑以 GET ?url=... 秒存（支援 ?space=amy）
    if (targetUrl) {
      const queueItem = await enqueueUrl(targetUrl, note, spaceId);
      // 立刻在伺服器背景啟動自動解析與入庫！
      dispatchBackgroundProcess(targetUrl, note, spaceId, queueItem.id);
      const summary = await getQueueSummary(spaceId);
      return NextResponse.json({
        success: true,
        message: `📥 連結已進入【${spaceId}】排程佇列，背景立即開始解析！`,
        spaceId,
        item: queueItem,
        summary,
      });
    }

    const items = await getQueueItems(spaceId);
    const summary = await getQueueSummary(spaceId);

    return NextResponse.json({
      success: true,
      spaceId,
      count: items.length,
      items,
      summary,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('API /api/inbox GET error:', errMessage);
    return NextResponse.json(
      {
        success: false,
        error: `查詢佇列失敗：${errMessage}`,
      },
      { status: 500 }
    );
  }
}

// 3. DELETE /api/inbox - 清除指定項目或已完成項目
export async function DELETE(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('id');

    if (targetId) {
      await removeQueueItem(targetId);
      return NextResponse.json({
        success: true,
        message: `佇列項目 ${targetId} 已移除`,
      });
    }

    await clearDoneQueueItems(spaceId);
    return NextResponse.json({
      success: true,
      message: `已清空【${spaceId}】所有已完成的佇列項目`,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('API /api/inbox DELETE error:', errMessage);
    return NextResponse.json(
      {
        success: false,
        error: `清除佇列失敗：${errMessage}`,
      },
      { status: 500 }
    );
  }
}
