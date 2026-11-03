import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const baseUrl = body?.baseUrl?.trim();

    if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
      return NextResponse.json(
        { success: false, error: '請提供有效的網址 (需包含 http:// 或 https://)' },
        { status: 400 }
      );
    }

    // 呼叫 build-shortcut 腳本
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'build-shortcut.mjs');
    execSync(`node "${scriptPath}" "${baseUrl}"`, {
      cwd: process.cwd(),
      stdio: 'pipe',
      timeout: 15000,
    });

    const finalShortcutPath = path.resolve(process.cwd(), 'public', 'Memo-Save.shortcut');
    const stats = fs.statSync(finalShortcutPath);

    return NextResponse.json({
      success: true,
      baseUrl: baseUrl,
      shortcutDownloadUrl: `/memo/Memo-Save.shortcut?t=${Date.now()}`,
      fileSize: stats.size,
      message: `✅ 捷徑已成功以 ${baseUrl} 重新打包並完成官方簽署！`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('API /api/build-shortcut error:', msg);
    return NextResponse.json(
      { success: false, error: `重新簽署失敗：${msg}` },
      { status: 500 }
    );
  }
}
