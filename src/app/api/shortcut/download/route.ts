import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';

const projectRoot = process.cwd();
const templatePath = path.join(projectRoot, 'src', 'lib', 'shortcut-template.xml');
const cacheDir = path.join(projectRoot, '.data', 'shortcut-cache');

/**
 * 取得當前伺服器對外公開網址
 */
function getDefaultTargetUrl(): string {
  const tunnelJsonPath = path.join(projectRoot, '.data', 'tunnel.json');
  if (fs.existsSync(tunnelJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(tunnelJsonPath, 'utf8'));
      if (data.publicUrl) {
        return `${String(data.publicUrl).replace(/\/+$/, '')}/api/shortcut?url=`;
      }
    } catch {}
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000/memo';
  return `${siteUrl.replace(/\/+$/, '')}/api/shortcut?url=`;
}

/**
 * 正規化捷徑目標端點，全面升級為 /api/shortcut?url= (並保留空間代號如 ?space=amy&url=)
 */
function normalizeShortcutTarget(target: string): string {
  let clean = target.trim();
  if (clean.includes('/api/inbox')) {
    clean = clean.replace('/api/inbox', '/api/shortcut');
  }
  if (!clean.includes('/api/shortcut')) {
    clean = `${clean.replace(/\/+$/, '')}/api/shortcut`;
  }
  if (!clean.includes('url=')) {
    clean += clean.includes('?') ? '&url=' : '?url=';
  }
  return clean;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customTarget = searchParams.get('target')?.trim();
    const rawTargetValue = customTarget || getDefaultTargetUrl();
    const targetValue = normalizeShortcutTarget(rawTargetValue);

    // 檢查是否有範本檔案
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        {
          success: false,
          error: '捷徑範本尚未就緒。請先確認捷徑範本 (src/lib/shortcut-template.xml) 存在。',
        },
        { status: 500 }
      );
    }

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // 計算目標內容與範本之雜湊值
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const hash = crypto
      .createHash('sha256')
      .update(templateContent + '::' + targetValue)
      .digest('hex')
      .slice(0, 16);

    const cachedSignedPath = path.join(cacheDir, `ALBO-Save-${hash}.shortcut`);

    // 1. 若已有簽署完成的快取檔案，直接 0.05 秒極速回傳
    if (fs.existsSync(cachedSignedPath)) {
      const fileBuffer = fs.readFileSync(cachedSignedPath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/x-apple-shortcut',
          'Content-Disposition': 'attachment; filename="Memo-Save.shortcut"',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // 2. 動態字串替換與 ActionOutput 變數位置 ({length, 1}) 校正
    const safeTargetValue = targetValue
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const targetLength = safeTargetValue.length;

    const modifiedXml = templateContent
      .replace(/<key>\{\d+,\s*1\}<\/key>/g, `<key>{${targetLength}, 1}</key>`)
      .replace(/\{\{DYNAMIC_TARGET_LINE\}\}/g, safeTargetValue);

    // 3. 寫入暫存並透過 macOS 原生指令簽章
    const tmpXmlPath = `/tmp/unsigned-${hash}.xml`;
    const tmpBinPath = `/tmp/unsigned-${hash}.shortcut`;
    const tmpSignedPath = `/tmp/signed-${hash}.shortcut`;

    fs.writeFileSync(tmpXmlPath, modifiedXml, 'utf8');

    try {
      // 轉換為二進位 Plist
      execSync(`plutil -convert binary1 "${tmpXmlPath}" -o "${tmpBinPath}"`, {
        stdio: 'pipe',
        timeout: 5000,
      });

      // 呼叫 macOS 官方原生簽署指令
      execSync(`shortcuts sign --mode anyone --input "${tmpBinPath}" --output "${tmpSignedPath}"`, {
        stdio: 'pipe',
        timeout: 10000,
      });

      if (!fs.existsSync(tmpSignedPath)) {
        throw new Error('shortcuts sign 指令未產生簽署檔案');
      }

      // 移至快取目錄供後續重複使用
      fs.copyFileSync(tmpSignedPath, cachedSignedPath);

      // 同步拷貝一份至 public 靜態目錄以支援直連
      const publicSave = path.join(projectRoot, 'public', 'Memo-Save.shortcut');
      const publicAlbo = path.join(projectRoot, 'public', 'ALBO-Save.shortcut');
      const publicNamed = path.join(projectRoot, 'public', 'Memo存連結.shortcut');
      fs.copyFileSync(tmpSignedPath, publicSave);
      fs.copyFileSync(tmpSignedPath, publicAlbo);
      fs.copyFileSync(tmpSignedPath, publicNamed);
    } finally {
      // 清理臨時檔案
      try {
        if (fs.existsSync(tmpXmlPath)) fs.unlinkSync(tmpXmlPath);
        if (fs.existsSync(tmpBinPath)) fs.unlinkSync(tmpBinPath);
        if (fs.existsSync(tmpSignedPath)) fs.unlinkSync(tmpSignedPath);
      } catch {}
    }

    const signedBuffer = fs.readFileSync(cachedSignedPath);
    return new NextResponse(signedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-apple-shortcut',
        'Content-Disposition': 'attachment; filename="Memo-Save.shortcut"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('API /api/shortcut/download error:', msg);
    return NextResponse.json(
      {
        success: false,
        error: `捷徑動態簽署失敗：${msg}`,
      },
      { status: 500 }
    );
  }
}
