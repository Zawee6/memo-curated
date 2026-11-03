export type QueueStatus = 'unread' | 'processing' | 'done' | 'failed';

export interface QueueItem {
  id: string;               // 唯一佇列識別碼 (例如 queue_1713...)
  url: string;              // 原始網址
  note?: string;            // 使用者附加筆記或分享標題
  status: QueueStatus;      // 狀態：unread | processing | done | failed
  stepNote: string;         // 即時步驟提示
  createdAt: number;        // 入庫時間戳記
  updatedAt: number;        // 更新時間戳記
  error?: string;           // 錯誤原因（若失敗）
  resultItemId?: string;    // 完成後的收藏品 ID (供前端點擊直達)
  resultItemTitle?: string; // 完成後的收藏品標題
  isMerged?: boolean;       // 是否為實體合併入既有主卡
  spaceId?: string;         // 所屬空間代號 (例如 'default' 或 'amy')
}

export interface QueueSummary {
  total: number;
  unread: number;
  processing: number;
  done: number;
  failed: number;
}

export interface QueueApiResponse {
  success: boolean;
  items: QueueItem[];
  summary: QueueSummary;
  error?: string;
}
