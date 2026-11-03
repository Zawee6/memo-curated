import { NextRequest, NextResponse } from 'next/server';
import {
  getNotificationConfig,
  saveNotificationConfig,
  sendIPhoneNotification,
  NotificationConfig,
} from '@/lib/notificationService';
import { getSpaceIdFromRequest } from '@/lib/serverDb';

export async function GET(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const config = await getNotificationConfig(spaceId);
    return NextResponse.json({
      success: true,
      spaceId,
      config,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // 若為測試推播請求
    if (body?.action === 'test' || body?.test === true) {
      // 允許即時傳入暫存 key 進行測試
      if (body?.barkKey || body?.ntfyTopic || body?.customWebhook) {
        await saveNotificationConfig(
          {
            barkKey: body.barkKey,
            ntfyTopic: body.ntfyTopic,
            customWebhook: body.customWebhook,
            enabled: body.enabled !== false,
          },
          spaceId
        );
      }

      const result = await sendIPhoneNotification(
        {
          title: '🔔 Memo 推播連線測試成功！',
          body: `您的 iPhone 已成功與【${spaceId}】空間連線！AI 背景思考完畢後會第一時間提醒您。`,
          url: body?.url || '',
        },
        spaceId
      );

      return NextResponse.json({
        success: result.success,
        spaceId,
        message: result.message,
        dispatchedChannels: result.dispatchedChannels,
        errors: result.errors,
      });
    }

    // 儲存設定
    const payload =
      body && typeof body === 'object' && body.config && typeof body.config === 'object'
        ? body.config
        : body;
    const updated = await saveNotificationConfig(
      {
        barkKey: typeof payload?.barkKey === 'string' ? payload.barkKey.trim() : undefined,
        ntfyTopic: typeof payload?.ntfyTopic === 'string' ? payload.ntfyTopic.trim() : undefined,
        customWebhook:
          typeof payload?.customWebhook === 'string' ? payload.customWebhook.trim() : undefined,
        enabled: typeof payload?.enabled === 'boolean' ? payload.enabled : undefined,
      },
      spaceId
    );

    return NextResponse.json({
      success: true,
      spaceId,
      config: updated,
      message: `已成功儲存【${spaceId}】空間的推播設定！`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
