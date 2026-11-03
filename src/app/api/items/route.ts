import { NextRequest, NextResponse } from 'next/server';
import {
  getServerItems,
  saveServerItem,
  saveServerItemsBatch,
  updateServerItem,
  deleteServerItem,
  clearServerItems,
  getGlobalCustomTags,
  addGlobalCustomTag,
  getSpaceIdFromRequest,
  checkIsAdminRequest,
  canAccessDefaultSpace,
} from '@/lib/serverDb';
import { ParsedItem } from '@/types/item';

export async function GET(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);

    // 🔒 空間隱私隔離：未授權訪客嚴禁讀取 default 主資料庫
    if (spaceId === 'default' && !canAccessDefaultSpace(req)) {
      return NextResponse.json(
        {
          success: false,
          isProtected: true,
          spaceId: 'default',
          items: [],
          error: '🔒 私人空間保護：此為主機主要資料庫，請透過專屬邀請連結進入，或輸入管理員通行碼解鎖。',
        },
        { status: 403 }
      );
    }

    const [items, customTags] = await Promise.all([
      getServerItems(spaceId),
      getGlobalCustomTags(),
    ]);
    return NextResponse.json(
      {
        success: true,
        spaceId,
        items,
        customTags,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `讀取伺服器收藏失敗：${msg}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const body = await req.json();

    // 支援新增自訂全域標籤
    if (typeof body?.addTag === 'string') {
      const customTags = await addGlobalCustomTag(body.addTag);
      return NextResponse.json({
        success: true,
        customTags,
      });
    }

    // 支援批次合併上傳 (例如從舊版 localStorage 自動遷移)
    if (Array.isArray(body?.items)) {
      const items = await saveServerItemsBatch(body.items as ParsedItem[], spaceId);
      const customTags = await getGlobalCustomTags();
      return NextResponse.json({
        success: true,
        spaceId,
        items,
        customTags,
      });
    }

    // 單筆新增
    const item: ParsedItem | undefined = body?.item || (body?.id ? body : undefined);
    if (!item || !item.id) {
      return NextResponse.json(
        { success: false, error: '請提供有效的收藏項目 (item)' },
        { status: 400 }
      );
    }

    const items = await saveServerItem(item, spaceId);
    return NextResponse.json({
      success: true,
      spaceId,
      items,
      item,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `儲存收藏項目失敗：${msg}` },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const body = await req.json();

    if (Array.isArray(body?.items)) {
      const items = await saveServerItemsBatch(body.items as ParsedItem[], spaceId);
      return NextResponse.json({
        success: true,
        spaceId,
        items,
      });
    }

    const id: string | undefined = body?.id || body?.item?.id;
    const updates: Partial<ParsedItem> = body?.item || body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少項目 id' },
        { status: 400 }
      );
    }

    if (Array.isArray(updates.customTags)) {
      for (const tag of updates.customTags) {
        if (tag && typeof tag === 'string') {
          await addGlobalCustomTag(tag);
        }
      }
    }

    const items = await updateServerItem(id, updates, spaceId);
    const customTags = await getGlobalCustomTags();
    return NextResponse.json({
      success: true,
      spaceId,
      items,
      customTags,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `更新項目失敗：${msg}` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);

    const { searchParams } = new URL(req.url);
    const clearAll = searchParams.get('clearAll') === 'true';
    let id = searchParams.get('id') || '';

    if (!id && !clearAll) {
      try {
        const body = await req.json();
        id = body?.id || '';
      } catch {
        // ignore if no body
      }
    }

    if (clearAll) {
      const items = await clearServerItems(spaceId);
      return NextResponse.json({
        success: true,
        spaceId,
        items,
      });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: '請提供要刪除的項目 id' },
        { status: 400 }
      );
    }

    const items = await deleteServerItem(id, spaceId);
    return NextResponse.json({
      success: true,
      spaceId,
      items,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `刪除項目失敗：${msg}` },
      { status: 500 }
    );
  }
}
