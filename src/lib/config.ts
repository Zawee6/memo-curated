import fs from 'fs/promises';
import path from 'path';

export interface AppConfig {
  geminiApiKey?: string;
  geminiModel?: string;
  siteUrl?: string;
  databaseType?: 'local' | 'redis';
  redisUrl?: string;
  redisToken?: string;
  updatedAt?: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

/**
 * 確保 .data 資料夾存在
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // 忽略資料夾已存在錯誤
  }
}

/**
 * 取得系統設定檔
 * 優先順序：.data/config.json > 環境變數 (process.env)
 */
export async function getConfig(): Promise<AppConfig> {
  await ensureDataDir();
  let fileConfig: AppConfig = {};

  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    fileConfig = JSON.parse(raw);
  } catch {
    // 若無 config.json 則維持空物件
    fileConfig = {};
  }

  // 同步載入環境變數作為備援
  const effectiveKey = fileConfig.geminiApiKey || process.env.GEMINI_API_KEY || '';
  const effectiveModel = fileConfig.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  // 自動同步至 process.env，讓全站相容
  if (effectiveKey && !process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = effectiveKey;
  }
  if (effectiveModel && !process.env.GEMINI_MODEL) {
    process.env.GEMINI_MODEL = effectiveModel;
  }

  return {
    databaseType: 'local',
    ...fileConfig,
    geminiApiKey: effectiveKey,
    geminiModel: effectiveModel,
  };
}

/**
 * 儲存系統設定檔至 .data/config.json
 */
export async function saveConfig(newConfig: Partial<AppConfig>): Promise<AppConfig> {
  await ensureDataDir();
  let current: AppConfig = {};

  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    current = JSON.parse(raw);
  } catch {
    current = {};
  }

  const merged: AppConfig = {
    databaseType: 'local',
    ...current,
    ...newConfig,
    updatedAt: new Date().toISOString(),
  };

  // 寫入 .data/config.json
  await fs.writeFile(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');

  // 同步記憶體環境變數
  if (merged.geminiApiKey) {
    process.env.GEMINI_API_KEY = merged.geminiApiKey;
  }
  if (merged.geminiModel) {
    process.env.GEMINI_MODEL = merged.geminiModel;
  }

  return merged;
}

/**
 * 取得目前生效的 Gemini API Key
 */
export async function getEffectiveGeminiKey(): Promise<string> {
  const config = await getConfig();
  return config.geminiApiKey?.trim() || '';
}

/**
 * 取得目前生效的 Gemini 模型名稱
 */
export async function getEffectiveGeminiModel(): Promise<string> {
  const config = await getConfig();
  return config.geminiModel?.trim() || 'gemini-3.5-flash-lite';
}
