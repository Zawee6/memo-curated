/**
 * 📱 iPhone 主動推播通知模組 (Bark / ntfy / Webhook)
 * 當 AI 思考完成後，主動發送推播通知至使用者的 iPhone：「想好了，可以回來看囉！」
 */

import fs from 'fs/promises';
import path from 'path';
import { sendNtfyNotification } from './notify-iphone';

export { sendNtfyNotification };

const DATA_DIR = path.join(process.cwd(), '.data');
const NOTIFICATION_CONFIG_FILE = path.join(DATA_DIR, 'notification-config.json');

export interface NotificationConfig {
  barkKey?: string; // Bark Device Key 或完整 URL (如 "https://api.day.app/abc123xyz/" 或 "abc123xyz")
  ntfyTopic?: string; // ntfy.sh Topic 名稱 (如 "my-memo-notifications")
  customWebhook?: string; // 自訂 Webhook URL
  enabled?: boolean; // 是否啟用推播
}

const DEFAULT_CONFIG: NotificationConfig = {
  barkKey: '',
  ntfyTopic: '',
  customWebhook: '',
  enabled: true,
};

const USERS_DIR = path.join(DATA_DIR, 'users');

function getNotificationConfigFile(spaceId?: string): string {
  const clean = spaceId ? spaceId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') : '';
  if (!clean || clean === 'default') {
    return NOTIFICATION_CONFIG_FILE;
  }
  return path.join(USERS_DIR, `${clean}-notification.json`);
}

async function ensureConfigDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(USERS_DIR, { recursive: true });
  } catch {}
}

export async function getNotificationConfig(spaceId?: string): Promise<NotificationConfig> {
  await ensureConfigDir();
  const filePath = getNotificationConfigFile(spaceId);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    if (!raw.trim()) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveNotificationConfig(
  newConfig: Partial<NotificationConfig>,
  spaceId?: string
): Promise<NotificationConfig> {
  await ensureConfigDir();
  const current = await getNotificationConfig(spaceId);
  const updated: NotificationConfig = {
    ...current,
    ...newConfig,
  };
  const filePath = getNotificationConfigFile(spaceId);
  await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}

export interface SendNotificationPayload {
  title: string;
  body: string;
  url?: string;
  group?: string;
}

export interface SendNotificationResult {
  success: boolean;
  message: string;
  dispatchedChannels: string[];
  errors?: string[];
}

/**
 * 清洗 Bark Device Key（允許使用者輸入純 key 或是整個 https://api.day.app/KEY 網址）
 */
function cleanBarkKey(rawKey?: string): string {
  if (!rawKey) return '';
  const trimmed = rawKey.trim();
  // 若帶有完整的 day.app 網址，萃取最後的 key
  const match = trimmed.match(/api\.day\.app\/([^/?#]+)/i);
  if (match && match[1]) {
    return match[1].replace(/\/+$/, '');
  }
  return trimmed.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

/**
 * 主動發送通知到 iPhone（支援多空間各自的推播設定）
 */
export async function sendIPhoneNotification(
  payload: SendNotificationPayload,
  spaceId?: string
): Promise<SendNotificationResult> {
  const config = await getNotificationConfig(spaceId);
  if (config.enabled === false) {
    return {
      success: false,
      message: '推播通知目前已手動停用',
      dispatchedChannels: [],
    };
  }

  const dispatchedChannels: string[] = [];
  const errors: string[] = [];

  const title = payload.title.trim() || 'Memo AI 想好了！🪄';
  const body = payload.body.trim() || '您的專屬筆記已生成完成，點此回來看囉！';
  const group = payload.group || 'MemoAI';
  const clickUrl = payload.url || '';

  // 1. 發送至 Bark App (台灣/繁中 iOS 最受歡迎的零門檻原生推播)
  const barkKey = cleanBarkKey(config.barkKey);
  if (barkKey) {
    try {
      const encodedTitle = encodeURIComponent(title);
      const encodedBody = encodeURIComponent(body);
      const encodedGroup = encodeURIComponent(group);
      const params = new URLSearchParams({
        group: group,
        sound: 'minuet',
      });
      if (clickUrl) {
        params.set('url', clickUrl);
      }

      const barkEndpoint = `https://api.day.app/${barkKey}/${encodedTitle}/${encodedBody}?${params.toString()}`;
      const res = await fetch(barkEndpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        dispatchedChannels.push('Bark (iOS)');
      } else {
        const errText = await res.text().catch(() => '');
        errors.push(`Bark 推播失敗: HTTP ${res.status} ${errText}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Bark 請求連線失敗: ${msg}`);
    }
  }

  // 2. 發送至 ntfy.sh (開源免註冊 iOS App，全面改用 UTF-8 JSON POST 避免中文字串放在 Header 導致崩潰)
  const ntfyTopic = config.ntfyTopic?.trim();
  if (ntfyTopic) {
    const ntfyRes = await sendNtfyNotification(ntfyTopic, title, body, clickUrl);
    if (ntfyRes.ok) {
      dispatchedChannels.push('ntfy.sh');
    } else {
      errors.push(`ntfy 推播失敗: ${ntfyRes.error || `HTTP ${ntfyRes.status}`}`);
    }
  }

  // 3. 發送至自訂 Webhook
  const customWebhook = config.customWebhook?.trim();
  if (customWebhook) {
    try {
      const res = await fetch(customWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          url: clickUrl,
          group,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        dispatchedChannels.push('Custom Webhook');
      } else {
        errors.push(`Webhook 呼叫失敗: HTTP ${res.status}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Webhook 呼叫失敗: ${msg}`);
    }
  }

  if (dispatchedChannels.length === 0 && !barkKey && !ntfyTopic && !customWebhook) {
    return {
      success: false,
      message: '尚未設定 Bark Device Key 或 ntfy Topic，請至「系統設定」綁定 iPhone 推播。',
      dispatchedChannels: [],
      errors,
    };
  }

  const isSuccess = dispatchedChannels.length > 0;
  return {
    success: isSuccess,
    message: isSuccess
      ? `已成功推播至：${dispatchedChannels.join('、')}`
      : `推播發送失敗：${errors.join('；')}`,
    dispatchedChannels,
    errors: errors.length > 0 ? errors : undefined,
  };
}
