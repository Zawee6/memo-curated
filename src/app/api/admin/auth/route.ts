import { NextRequest, NextResponse } from 'next/server';
import {
  checkIsAdminRequest,
  verifyAdminPin,
  getAdminToken,
} from '@/lib/serverDb';

export async function GET(req: NextRequest) {
  const isAdmin = checkIsAdminRequest(req);
  return NextResponse.json({
    success: true,
    isAdmin,
  });
}

export async function POST(req: NextRequest) {
  try {
    const isLocal = checkIsAdminRequest(req);
    const body = await req.json().catch(() => ({}));
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

    if (isLocal || verifyAdminPin(pin)) {
      return NextResponse.json({
        success: true,
        isAdmin: true,
        token: getAdminToken(),
        message: '👑 管理員模式已成功解鎖！',
      });
    }

    return NextResponse.json(
      {
        success: false,
        isAdmin: false,
        error: '通行碼錯誤，無法解鎖主機管理員權限。',
      },
      { status: 401 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
