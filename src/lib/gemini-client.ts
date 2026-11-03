import { GoogleGenAI } from '@google/genai';
import { getFriendlyErrorMessage } from './errorMessage';
import { getEffectiveGeminiKey, getEffectiveGeminiModel } from './config';

export { getFriendlyErrorMessage };

/**
 * 預設 Gemini 模型備援鏈 (Model Fallback Chain)
 * 依序嘗試：使用者設定模型 -> 3.8-flash -> 2.5-flash -> 2.0-flash -> 3.5-flash -> 1.5-flash
 */
export const DEFAULT_FALLBACK_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

/**
 * 穩健擷取與解析模型文字中的 JSON 區塊
 * 自動去除 ```json 標記並擷取 {...} 或 [...]
 */
export function extractJsonFromText(text: string): string {
  if (!text) return '{}';
  const trimmed = text.trim();

  // 1. 匹配 Markdown ```json ... ``` 程式碼區塊
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }

  // 2. 尋找首個 { 與最後一個 }，或首個 [ 與最後一個 ]
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');

  if (firstBrace !== -1 && lastBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }
  if (firstBracket !== -1 && lastBracket !== -1) {
    return trimmed.slice(firstBracket, lastBracket + 1).trim();
  }

  return trimmed;
}

export interface GenerateWithFallbackOptions {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
  temperature?: number;
  tools?: any[];
  modelList?: string[];
  apiKey?: string;
}

export interface GenerateWithFallbackResult {
  text: string;
  modelUsed: string;
  rawResponse: any;
}

/**
 * 簡易非同步延遲
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 判定是否為可備援重試的錯誤 (503, 429, 500, UNAVAILABLE 等)
 */
export function isRetryableGeminiError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as any)?.status || (err as any)?.statusCode || (err as any)?.code;

  if (status === 503 || status === 429 || status === 500 || status === 502 || status === 504) {
    return true;
  }

  if (
    /503|429|500|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|quota|rate limit|internal/i.test(
      msg
    )
  ) {
    return true;
  }

  return false;
}

/**
 * 檢查是否為 Tool (如 googleSearch) 引起的不支援或配額錯誤
 */
function isToolRelatedError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /tool|search|grounding|unsupported|not supported|invalid argument/i.test(msg);
}


/**
 * 全站統一 Gemini 呼叫函式：具備自動重試、多模型無縫切換、工具降級防護
 */
export async function generateWithFallback(
  options: GenerateWithFallbackOptions
): Promise<GenerateWithFallbackResult> {
  const apiKey = options.apiKey || (await getEffectiveGeminiKey()) || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('尚未設定 GEMINI_API_KEY，請於網頁設定中輸入金鑰或於環境變數中設定。');
  }

  const ai = new GoogleGenAI({ apiKey });

  // 建立模型備援清單
  const effectiveModel = await getEffectiveGeminiModel();
  const envModel = process.env.GEMINI_MODEL || effectiveModel;
  const modelsToTry = options.modelList && options.modelList.length > 0
    ? options.modelList
    : Array.from(new Set([effectiveModel, envModel, ...DEFAULT_FALLBACK_MODELS].filter(Boolean) as string[]));

  let lastError: unknown = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    let activeTools = options.tools;

    console.log(`[GeminiFallback] 🤖 Attempting model [${i + 1}/${modelsToTry.length}]: ${currentModel}...`);

    let modelSuccess = false;
    let attemptsOnThisModel = 0;

    while (!modelSuccess && attemptsOnThisModel < 2) {
      attemptsOnThisModel++;
      try {
        const config: any = {
          temperature: options.temperature ?? 0.2,
        };

        if (options.systemInstruction) {
          config.systemInstruction = options.systemInstruction;
        }

        const hasTools = Boolean(activeTools && activeTools.length > 0);
        if (hasTools) {
          // 🚨 當有 tools (如 googleSearch) 時，Gemini API 嚴禁傳入 responseMimeType / responseSchema，否則直接 400 INVALID_ARGUMENT！
          config.tools = activeTools;
        } else {
          if (options.responseMimeType) {
            config.responseMimeType = options.responseMimeType;
          }
          if (options.responseSchema) {
            config.responseSchema = options.responseSchema;
          }
        }

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout: Model ${currentModel} did not respond within 15s`)), 15000)
        );

        const response = await Promise.race([
          ai.models.generateContent({
            model: currentModel,
            contents: options.contents,
            config,
          }),
          timeoutPromise,
        ]);

        if (response && (response.text !== undefined && response.text !== null)) {
          return {
            text: response.text,
            modelUsed: currentModel,
            rawResponse: response,
          };
        }
      } catch (err: unknown) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[GeminiFallback] ⚠️ Error on ${currentModel} (attempt ${attemptsOnThisModel}):`,
          errMsg.slice(0, 150)
        );

        // 若錯誤起因於 tools（如不支援 googleSearch 或配額限制），先降級 tools 再次嘗試當前模型
        if (activeTools && activeTools.length > 0 && isToolRelatedError(err)) {
          console.log(`[GeminiFallback] 🔄 Downgrading tools for ${currentModel} to pure inference...`);
          activeTools = undefined;
          continue;
        }

        // 若為 503 / 429 / 500 等可備援重試錯誤，等待 800ms 後切換到下一個模型
        if (isRetryableGeminiError(err)) {
          console.log(`[GeminiFallback] ⏳ Transient congestion error detected. Waiting 800ms before fallback...`);
          await delay(800);
          break; // 跳出此模型，進入下一個備援模型
        }

        // 其他未知錯誤亦跳出切換下一模型嘗試
        break;
      }
    }
  }

  // 若全部備援模型皆耗盡
  console.error('[GeminiFallback] ❌ All fallback models exhausted. Final error:', lastError);
  const friendlyMsg = getFriendlyErrorMessage(lastError);
  throw new Error(friendlyMsg);
}
