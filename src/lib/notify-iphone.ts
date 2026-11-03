/**
 * 📲 iPhone 推播通知模組 (ntfy.sh & 原生推播)
 * 解決 Node.js fetch 在 headers 放置中文字串會拋出 TypeError: Invalid character in header content 的問題
 * 全面採用 UTF-8 JSON POST Payload 發送
 */

export interface NtfyNotificationOptions {
  topic: string;
  title: string;
  message: string;
  clickUrl?: string;
  tags?: string[];
  priority?: number;
}

export async function sendNtfyNotification(
  topic: string,
  title: string,
  message: string,
  clickUrl?: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!topic || !topic.trim()) {
    return { ok: false, error: '未設定 ntfy 頻道代號 (Topic)' };
  }

  const cleanTopic = topic.trim().replace(/^https?:\/\/ntfy\.sh\//, '').replace(/\/+$/, '');
  if (!cleanTopic) {
    return { ok: false, error: '無效的 ntfy 頻道代號' };
  }

  try {
    const res = await fetch('https://ntfy.sh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        topic: cleanTopic,
        title: title || 'Memo AI 想好了！🪄',
        message: message || '您的專屬筆記已生成完成，點此回來看囉！',
        click: clickUrl || undefined,
        tags: ['sparkles', 'memo'],
        priority: 4,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: `ntfy HTTP ${res.status}: ${errText}` };
    }

    return { ok: true, status: res.status };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
