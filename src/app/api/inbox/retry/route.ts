import { NextRequest, NextResponse } from 'next/server';
import { retryQueueItem, getQueueSummary } from '@/lib/serverQueue';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body?.id;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少目標項目 ID (id)' },
        { status: 400 }
      );
    }

    const retried = await retryQueueItem(id);
    if (!retried) {
      return NextResponse.json(
        { success: false, error: '找不到該佇列項目' },
        { status: 404 }
      );
    }

    const summary = await getQueueSummary();
    return NextResponse.json({
      success: true,
      message: '已將項目重新放入排隊佇列',
      item: retried,
      summary,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `重試失敗：${errMessage}` },
      { status: 500 }
    );
  }
}
