/**
 * 全站統一錯誤訊息清洗模組 (Client & Server Safe)
 * 嚴禁將 {"error":{"code":503...}} 原始 JSON 渲染給使用者
 */

export function getFriendlyErrorMessage(err: unknown): string {
  if (!err) return '⚠️ 系統暫時無法處理此請求，請稍後重試。';
  const raw = err instanceof Error ? err.message : String(err);

  // 嘗試從 JSON 結構中抓取
  try {
    const jsonMatch = raw.match(/\{[\s\S]*"error"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const code = parsed?.error?.code || parsed?.error?.status;
      const message = parsed?.error?.message || '';
      if (code === 503 || /UNAVAILABLE|high demand|overloaded/i.test(message)) {
        return '⚠️ AI 伺服器目前較忙碌（正在排隊中），請再點一下重試！';
      }
      if (code === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) {
        return '⚠️ 目前 AI 查詢次數稍多或配額已滿，請稍候再試。';
      }
      if (code === 400 || /INVALID_ARGUMENT|not supported/i.test(message)) {
        return '⚠️ AI 請求參數或格式設定有誤，請重新整理再試。';
      }
      if (code === 404 || /NOT_FOUND/i.test(message)) {
        return '⚠️ 指定的 AI 模型暫不可用，請稍後再試。';
      }
      if (code === 500 || /INTERNAL/i.test(message)) {
        return '⚠️ AI 服務暫時不穩定，請重新點擊嘗試。';
      }
    }
  } catch {}

  // 檢查常見的錯誤代碼與英文提示
  if (/503|UNAVAILABLE|high demand|overloaded|This model is currently experiencing/i.test(raw)) {
    return '⚠️ AI 伺服器目前較忙碌（正在排隊中），請再點一下重試！';
  }
  if (/429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(raw)) {
    return '⚠️ 目前 AI 查詢次數稍多或配額已滿，請稍候再試。';
  }
  if (/INVALID_ARGUMENT/i.test(raw)) {
    return '⚠️ AI 請求參數格式有誤，請重新整理再試。';
  }
  if (/NOT_FOUND|not found/i.test(raw)) {
    return '⚠️ 指定的模型暫不可用，請稍後再試。';
  }
  if (/500|INTERNAL|server error/i.test(raw)) {
    return '⚠️ AI 服務暫時不穩定，請重新點擊嘗試。';
  }

  // 若文字太長或包含物件符號，過濾掉技術細節
  if (raw.includes('{') || raw.includes('}') || raw.length > 80) {
    return '⚠️ 處理時發生暫時性錯誤，請再點一下重試。';
  }

  if (raw.startsWith('⚠️') || raw.startsWith('❌')) {
    return raw;
  }

  return `⚠️ ${raw}`;
}
