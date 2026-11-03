import { NextRequest, NextResponse } from 'next/server';
import { ParseRequestBody } from '@/types/item';
import { getSpaceIdFromRequest } from '@/lib/serverDb';
import { processAndSaveUrlDetailed } from '@/lib/parseEngine';
import { enqueueUrl, updateQueueItem } from '@/lib/serverQueue';
import { getFriendlyErrorMessage } from '@/lib/errorMessage';

export async function POST(req: NextRequest) {
  let queueId: string | undefined;
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const body: ParseRequestBody = await req.json();
    const rawUrl = body?.url?.trim();
    const imageBase64 = body?.imageBase64?.trim();
    const extraContent = body?.extraContent?.trim();
    const candidate = body?.candidate;

    if (!rawUrl && !imageBase64 && !candidate) {
      return NextResponse.json(
        { success: false, error: '請提供有效的網址 (url)、電影名稱、候選項目或上傳截圖。' },
        { status: 400 }
      );
    }

    // 1. 即時進入伺服器佇列
    const queueLabel = candidate
      ? `🎬 ${candidate.title}`
      : imageBase64
        ? '📸 截圖辨識'
        : rawUrl || '未知項目';
    const queueItem = await enqueueUrl(queueLabel, extraContent, spaceId);
    queueId = queueItem.id;

    // 2. 呼叫共用伺服器解析引擎
    const result = await processAndSaveUrlDetailed(rawUrl || '', extraContent, {
      spaceId,
      queueId,
      candidate,
      imageBase64,
      notify: false, // 網頁手動觸發無需推播 iOS 通知
    });

    return NextResponse.json({
      success: true,
      spaceId,
      data: result.finalItem,
      item: result.finalItem,
      additionalItems:
        result.splitItems && result.splitItems.length > 1
          ? result.splitItems.slice(1)
          : [],
      splitItems: result.splitItems,
      splitCount: result.splitCount || 1,
      items: result.allItems,
      sources: result.sources,
      isMerged: result.isMerged,
    });
  } catch (error: unknown) {
    const friendlyError = getFriendlyErrorMessage(error);
    console.error('API /api/parse error:', friendlyError);
    if (queueId) {
      await updateQueueItem(queueId, {
        status: 'failed',
        stepNote: `❌ 解析失敗：${friendlyError}`,
        error: friendlyError,
      }).catch(() => {});
    }
    return NextResponse.json(
      {
        success: false,
        error: friendlyError,
      },
      { status: 500 }
    );
  }
}
