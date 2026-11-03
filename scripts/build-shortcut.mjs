#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const templatePath = path.join(projectRoot, 'src', 'lib', 'shortcut-template.xml');
const publicDir = path.join(projectRoot, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

let rawBaseUrl = process.argv[2] || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000/memo';
let targetUrl = rawBaseUrl.trim();

// 確保連線至 /api/shortcut?url=
if (targetUrl.includes('/api/inbox')) {
  targetUrl = targetUrl.replace('/api/inbox', '/api/shortcut');
}
if (!targetUrl.includes('/api/shortcut')) {
  targetUrl = `${targetUrl.replace(/\/+$/, '')}/api/shortcut`;
}
if (!targetUrl.includes('url=')) {
  targetUrl += targetUrl.includes('?') ? '&url=' : '?url=';
}

console.log(`[build-shortcut] 🎯 正在建立捷徑，目標端點：${targetUrl}`);

if (!fs.existsSync(templatePath)) {
  console.error(`[build-shortcut] ❌ 找不到範本檔案：${templatePath}`);
  process.exit(1);
}

const templateContent = fs.readFileSync(templatePath, 'utf8');

const safeTargetValue = targetUrl
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');
const targetLength = safeTargetValue.length;

const modifiedXml = templateContent
  .replace(/<key>\{\d+,\s*1\}<\/key>/g, `<key>{${targetLength}, 1}</key>`)
  .replace(/\{\{DYNAMIC_TARGET_LINE\}\}/g, safeTargetValue);

const tmpXmlPath = `/tmp/unsigned-build-${Date.now()}.xml`;
const tmpBinPath = `/tmp/unsigned-build-${Date.now()}.shortcut`;
const tmpSignedPath = `/tmp/signed-build-${Date.now()}.shortcut`;

fs.writeFileSync(tmpXmlPath, modifiedXml, 'utf8');

try {
  execSync(`plutil -convert binary1 "${tmpXmlPath}" -o "${tmpBinPath}"`, {
    stdio: 'pipe',
    timeout: 5000,
  });

  execSync(`shortcuts sign --mode anyone --input "${tmpBinPath}" --output "${tmpSignedPath}"`, {
    stdio: 'pipe',
    timeout: 10000,
  });

  if (!fs.existsSync(tmpSignedPath)) {
    throw new Error('shortcuts sign 指令未產生簽署檔案');
  }

  const targets = [
    path.join(publicDir, 'Memo-Save.shortcut'),
    path.join(publicDir, 'ALBO-Save.shortcut'),
    path.join(publicDir, 'Memo存連結.shortcut'),
  ];

  for (const t of targets) {
    fs.copyFileSync(tmpSignedPath, t);
    console.log(`[build-shortcut] ✅ 成功產出捷徑檔案：${t}`);
  }

  console.log('🎉 捷徑官方公證簽章與打包作業全部完成！');
} catch (err) {
  console.error('[build-shortcut] 簽署過程發生錯誤:', err.message);
  process.exit(1);
} finally {
  try {
    if (fs.existsSync(tmpXmlPath)) fs.unlinkSync(tmpXmlPath);
    if (fs.existsSync(tmpBinPath)) fs.unlinkSync(tmpBinPath);
    if (fs.existsSync(tmpSignedPath)) fs.unlinkSync(tmpSignedPath);
  } catch {}
}
