import { NextResponse } from 'next/server';
import {
  getQueueItems,
  getQueueSummary,
  getNextUnprocessedItem,
  updateQueueItem,
} from '@/lib/serverQueue';
import { processAndSaveUrlDetailed } from '@/lib/parseEngine';
import { getFriendlyErrorMessage } from '@/lib/errorMessage';

export async function POST() {
  try {
    const allItems = await getQueueItems();

    // 檢查是否有正在 processing 的任務 (若超過 45 秒則視為超時，允許被下一個接管)
    const now = Date.now();
    const currentlyProcessing = allItems.find(
      (i) => i.status === 'processing' && now - (i.updatedAt || 0) < 45000
    );

    if (currentlyProcessing) {
      const summary = await getQueueSummary(currentlyProcessing.spaceId);
      return NextResponse.json({
        success: true,
        busy: true,
        message: `目前已有任務正在處理中：${currentlyProcessing.stepNote}`,
        activeItem: currentlyProcessing,
        summary,
      });
    }

    // 取出最早入庫的 unread 項目
    const itemToProcess = await getNextUnprocessedItem();
    if (!itemToProcess) {
      const summary = await getQueueSummary();
      return NextResponse.json({
        success: true,
        busy: false,
        message: '佇列中無待處理項目',
        summary,
      });
    }

    const targetSpace = itemToProcess.spaceId || 'default';

    try {
      const result = await processAndSaveUrlDetailed(
        itemToProcess.url,
        itemToProcess.note,
        {
          spaceId: targetSpace,
          queueId: itemToProcess.id,
          notify: true,
        }
      );

      const summary = await getQueueSummary(targetSpace);
      return NextResponse.json({
        success: true,
        processed: result.finalItem,
        isMerged: result.isMerged,
        summary,
      });
    } catch (parseErr) {
      const friendlyError = getFriendlyErrorMessage(parseErr);
      console.error(`[Inbox Process Error for ${itemToProcess.url}]:`, friendlyError);

      const failedItem = await updateQueueItem(itemToProcess.id, {
        status: 'failed',
        stepNote: `❌ 解析失敗：${friendlyError}`,
        error: friendlyError,
      });

      const summary = await getQueueSummary();
      return NextResponse.json(
        {
          success: false,
          processed: failedItem,
          error: friendlyError,
          summary,
        },
        { status: 200 } // 回傳 200 讓前端輪詢正常取得 failed 狀態
      );
    }
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('API /api/inbox/process fatal error:', errMessage);
    return NextResponse.json(
      {
        success: false,
        error: `背景消化器異常：${errMessage}`,
      },
      { status: 500 }
    );
  }
}
