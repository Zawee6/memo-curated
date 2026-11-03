import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * 生成並簽署 Apple 採買清單捷徑 (ALBO-Checklist.shortcut)
 * 接收由 ALBO 分享或複製的逐行純淨食材清單，自動將每一行建立為 iPhone 提醒事項的可打勾項目
 */
export function buildChecklistShortcut(options = {}) {
  const publicDir = path.join(projectRoot, 'public');
  const finalShortcutPath = path.join(publicDir, 'Memo-Checklist.shortcut');
  const finalNamedShortcutPath = path.join(publicDir, 'Memo清單.shortcut');
  const legacyShortcutPath = path.join(publicDir, 'ALBO-Checklist.shortcut');
  const legacyNamedShortcutPath = path.join(publicDir, 'ALBO清單.shortcut');

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. 建立 Apple Shortcuts XML Plist 結構（簡化為官方最穩定之 Apple 備忘錄原生建立動作）
  const plistXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>WFWorkflowActions</key>
	<array>
		<!-- 動作 1：若無捷徑輸入則自動讀取剪貼簿文字 -->
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.detect.text</string>
			<key>WFWorkflowActionParameters</key>
			<dict/>
		</dict>

		<!-- 動作 2：在 Apple 備忘錄建立新備忘錄（直接帶入食材清單與料理步驟，並立即在螢幕開啟） -->
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.createnote</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFShowWhenRun</key>
				<true/>
			</dict>
		</dict>
	</array>
	<key>WFWorkflowClientRelease</key>
	<string>2.2.2</string>
	<key>WFWorkflowClientVersion</key>
	<string>1080.5</string>
	<key>WFWorkflowIcon</key>
	<dict>
		<key>WFWorkflowIconGlyphNumber</key>
		<integer>59474</integer>
		<key>WFWorkflowIconStartColor</key>
		<integer>4282601983</integer>
	</dict>
	<key>WFWorkflowImportQuestions</key>
	<array/>
	<key>WFWorkflowInputContentItemClasses</key>
	<array>
		<string>WFStringContentItem</string>
		<string>WFURLContentItem</string>
	</array>
	<key>WFWorkflowMinimumClientVersion</key>
	<integer>900</integer>
	<key>WFWorkflowMinimumClientVersionString</key>
	<string>900</string>
	<key>WFWorkflowTypes</key>
	<array>
		<string>ActionExtension</string>
	</array>
</dict>
</plist>
`;

  const tmpXmlPath = path.join(os.tmpdir(), `ALBO清單-${Date.now()}.plist`);
  const tmpUnsignedPath = path.join(os.tmpdir(), `ALBO清單.shortcut`);

  fs.writeFileSync(tmpXmlPath, plistXml, 'utf8');

  // 2. 將 XML Plist 轉為 Apple 二進位 Plist
  try {
    execSync(`plutil -convert binary1 "${tmpXmlPath}" -o "${tmpUnsignedPath}"`);
  } catch (err) {
    console.error('[Checklist Shortcut Builder] plutil 轉換二進位失敗:', err.message);
    throw err;
  }

  // 3. 嘗試使用 macOS 內建 shortcuts sign 進行 Apple 官方公證簽章
  let signed = false;
  let signingMode = 'none';

  if (process.platform === 'darwin') {
    try {
      console.log('[Checklist Shortcut Builder] 正在向 Apple 伺服器申請 anyone 模式公證簽章...');
      execSync(`shortcuts sign --mode anyone --input "${tmpUnsignedPath}" --output "${finalShortcutPath}"`, {
        stdio: 'pipe',
        timeout: 10000,
      });
      signed = true;
      signingMode = 'anyone';
      console.log('[Checklist Shortcut Builder] ✅ 成功使用 anyone 模式完成 Apple 官方簽署！');
    } catch (anyoneErr) {
      console.warn('[Checklist Shortcut Builder] anyone 模式簽署失敗，嘗試切換為 people-who-know-me 模式...');
      try {
        execSync(`shortcuts sign --mode people-who-know-me --input "${tmpUnsignedPath}" --output "${finalShortcutPath}"`, {
          stdio: 'pipe',
          timeout: 5000,
        });
        signed = true;
        signingMode = 'people-who-know-me';
        console.log('[Checklist Shortcut Builder] ✅ 成功使用 people-who-know-me 模式完成簽署！');
      } catch (localErr) {
        console.warn('[Checklist Shortcut Builder] 回退至未簽署二進位 .shortcut 檔案...');
      }
    }
  }

  // 4. 若未在 macOS 或簽署失敗，輸出標準二進位檔案
  if (!signed) {
    fs.copyFileSync(tmpUnsignedPath, finalShortcutPath);
    signingMode = 'unsigned';
  }

  // 同步複本為 Memo清單.shortcut 與相容舊版
  try {
    fs.copyFileSync(finalShortcutPath, finalNamedShortcutPath);
    fs.copyFileSync(finalShortcutPath, legacyShortcutPath);
    fs.copyFileSync(finalShortcutPath, legacyNamedShortcutPath);
  } catch {}

  // 清理暫存檔
  try {
    if (fs.existsSync(tmpXmlPath)) fs.unlinkSync(tmpXmlPath);
    if (fs.existsSync(tmpUnsignedPath)) fs.unlinkSync(tmpUnsignedPath);
  } catch {}

  const stats = fs.statSync(finalShortcutPath);

  return {
    success: true,
    shortcutPath: finalShortcutPath,
    shortcutSize: stats.size,
    signingMode,
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  try {
    const result = buildChecklistShortcut();
    console.log('\n🎉 採買清單捷徑建置成功！', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('❌ 建置捷徑時發生錯誤：', e);
    process.exit(1);
  }
}
