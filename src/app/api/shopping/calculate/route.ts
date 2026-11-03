import { NextResponse } from 'next/server';

/**
 * 賣場價格爬蟲與比價試算 API 已依「極速化與個人化」架構重構停用。
 * 改由前端 0 延遲自動合併食材，並支援一鍵匯出至 Apple 備忘錄與 LINE Keep。
 */
export async function POST() {
  return NextResponse.json({
    success: false,
    error: '大賣場爬蟲試算已停用，請使用前端 0 延遲純粹採買清單。',
  }, { status: 410 });
}
