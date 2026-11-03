import { NextRequest, NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/config';
import { GoogleGenAI } from '@google/genai';

export async function GET() {
  try {
    const config = await getConfig();
    const rawKey = config.geminiApiKey || '';
    const hasGeminiKey = Boolean(rawKey && rawKey.length > 5);

    let geminiKeyMasked = '';
    let source: 'config.json' | 'env' | 'none' = 'none';

    if (rawKey) {
      geminiKeyMasked = rawKey.length > 8
        ? `${rawKey.slice(0, 6)}...${rawKey.slice(-4)}`
        : '******';
      source = (config.geminiApiKey && config.geminiApiKey === process.env.GEMINI_API_KEY && !config.updatedAt)
        ? 'env'
        : 'config.json';
    }

    return NextResponse.json({
      success: true,
      hasGeminiKey,
      geminiKeyMasked,
      model: config.geminiModel || 'gemini-3.5-flash-lite',
      source,
      databaseType: 'local',
      databasePath: '.data/db.json',
      updatedAt: config.updatedAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: msg, hasGeminiKey: false },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = (body.geminiApiKey || '').trim();
    const model = (body.geminiModel || '').trim() || 'gemini-3.5-flash-lite';
    const testKey = body.testKey !== false;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: '請提供有效的 Gemini API Key。' },
        { status: 400 }
      );
    }

    // 若要求測試金鑰，進行簡單的 Gemini API 呼叫驗證
    if (testKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: 'Ping test',
        });
      } catch (testErr: unknown) {
        // 若 gemini-2.5-flash 失敗，嘗試 gemini-1.5-flash
        try {
          const ai = new GoogleGenAI({ apiKey });
          await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: 'Ping test',
          });
        } catch (fallbackErr: unknown) {
          const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          return NextResponse.json(
            { success: false, error: `Google Gemini API Key 驗證失敗：${msg}` },
            { status: 400 }
          );
        }
      }
    }

    // 儲存設定至 .data/config.json
    const saved = await saveConfig({
      geminiApiKey: apiKey,
      geminiModel: model,
    });

    return NextResponse.json({
      success: true,
      message: 'Gemini API Key 驗證成功並已儲存至 .data/config.json！',
      hasGeminiKey: true,
      geminiKeyMasked: `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`,
      model: saved.geminiModel,
      source: 'config.json',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `設定失敗：${msg}` },
      { status: 500 }
    );
  }
}
