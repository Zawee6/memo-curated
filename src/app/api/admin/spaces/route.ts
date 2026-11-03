import { NextRequest, NextResponse } from 'next/server';
import {
  getAllSpacesSummary,
  createSpace,
  deleteOrClearSpace,
  checkIsAdminRequest,
  isMasterSpaceAlias,
} from '@/lib/serverDb';

export async function GET(req: NextRequest) {
  try {
    if (!checkIsAdminRequest(req)) {
      return NextResponse.json({
        success: true,
        spaces: [],
      });
    }
    const spaces = await getAllSpacesSummary();
    return NextResponse.json({
      success: true,
      spaces,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('API /api/admin/spaces GET error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkIsAdminRequest(req)) {
      return NextResponse.json({ success: false, error: '未授權存取' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const rawSpaceId = body?.spaceId || body?.id || '';
    const cleanSpaceId = String(rawSpaceId).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

    if (!cleanSpaceId) {
      return NextResponse.json(
        { success: false, error: '請提供有效的空間代號（僅限英文字母、數字、連字號與底線）' },
        { status: 400 }
      );
    }

    const spaces = await createSpace(cleanSpaceId);
    return NextResponse.json({
      success: true,
      spaceId: cleanSpaceId,
      spaces,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('API /api/admin/spaces POST error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!checkIsAdminRequest(req)) {
      return NextResponse.json({ success: false, error: '未授權存取' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawSpace = searchParams.get('space') || searchParams.get('spaceId') || '';
    const actionParam = searchParams.get('action');
    const cleanSpaceId = String(rawSpace).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

    if (!cleanSpaceId) {
      return NextResponse.json(
        { success: false, error: '請指定要刪除或清空的空間代號' },
        { status: 400 }
      );
    }

    // 嚴格防呆保護：嚴禁刪除 'default' 主機主空間
    if (cleanSpaceId === 'default' || isMasterSpaceAlias(cleanSpaceId)) {
      return NextResponse.json(
        { success: false, error: '安全防呆保護：嚴禁刪除主機主空間 (default)！' },
        { status: 400 }
      );
    }

    const action = actionParam === 'clear' ? 'clear' : 'delete';
    const spaces = await deleteOrClearSpace(cleanSpaceId, action);

    return NextResponse.json({
      success: true,
      deletedSpaceId: cleanSpaceId,
      action,
      spaces,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('API /api/admin/spaces DELETE error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
