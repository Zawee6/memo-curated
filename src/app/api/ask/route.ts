import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { generateWithFallback, getFriendlyErrorMessage } from '@/lib/gemini-client';
import { getEffectiveGeminiKey } from '@/lib/config';
import { AskQueryRequest, AskQueryResponse } from '@/types/item';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body?.query || body?.question || '').trim();
    const items: AskQueryRequest['items'] = body?.items || [];

    if (!query) {
      return NextResponse.json(
        { success: false, error: '請提供想詢問的問題。' },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        answer: '您目前尚未收藏任何靈感項目。請在上方輸入框貼上店家、食譜或文章網址，存入後我就能為您智慧檢索與推薦囉！',
        reasoning: '收藏庫為空',
        matchedItemIds: [],
        suggestedFollowUps: ['如何使用 iPhone 捷徑一鍵存入？', '可以收藏哪些類型的網址？'],
      } as AskQueryResponse);
    }

    const apiKey = (await getEffectiveGeminiKey()) || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: '伺服器尚未設定 GEMINI_API_KEY，請於網頁設定中輸入金鑰。' },
        { status: 500 }
      );
    }

    // 濃縮收藏清單摘要供 Gemini 進行精準檢索比對
    const catalogSummary = items.map((it, idx) => {
      let extra = '';
      if (it.category === 'place' && it.placeInfo) {
        extra = `地點:${it.placeInfo.locationName || it.title}, 城市:${it.placeInfo.city || ''}, 地址:${it.placeInfo.address || ''}`;
      } else if (it.category === 'recipe' && it.recipeInfo) {
        const ingredients = it.recipeInfo.ingredients?.map((i) => i.name).join('、') || '';
        extra = `食材:${ingredients}, 份量:${it.recipeInfo.servings || ''}`;
      }

      let shopping = '';
      if (it.shoppingPlan) {
        const stores = it.shoppingPlan.recommendedStores?.join('/') || '';
        const itemsList = it.shoppingPlan.items?.map((p) => `${p.name}($${p.estimatedPrice})`).join('、') || '';
        shopping = `建議賣場:${stores}, 預估總額:$${it.shoppingPlan.totalEstimatedCost}, 採買清單:[${itemsList}]`;
      }

      return `[ID: ${it.id}] 【${it.category}】《${it.title}》 摘要:${it.summary} 標籤:${(it.tags || []).join(',')} ${extra} ${shopping}`;
    }).join('\n\n');

    const systemInstruction = `你是一個專業、親切且見多識廣的「AI 靈感收藏庫顧問」。
使用者會用繁體中文向你提問他自己存入的收藏清單（例如：詢問特定預算內的餐廳、去好市多採買時可以搭配哪些食譜、適合週末去的咖啡廳、居家收納好物等）。
請根據提供的使用者真實收藏資料庫進行嚴謹分析與推薦。

【回覆準則】
1. 一律使用自然生動、溫暖且專業的「繁體中文 (台灣)」回答。
2. 清楚回答使用者的問題 (answer)，並點名具體推薦哪幾張收藏（提及收藏標題）。
3. 提供具體的推薦原因 (reasoning)，例如：「這兩家都在台北市且人均預算約在 $400 內」、「好市多的冷藏牛五花可以同時做這道蒜香牛排與壽喜燒」。
4. 必須在 matchedItemIds 陣列中回傳最符合條件的收藏卡片 ID（如果都不符合則為空陣列 []）。
5. 提供 2~3 個有趣的後續提問建議 (suggestedFollowUps)。`;

    const userPrompt = `使用者提問：${query}

=== 使用者的收藏庫清單開始 ===
${catalogSummary}
=== 使用者的收藏庫清單結束 ===

請依據上述使用者的真實收藏資料，回答使用者的問題並挑選出對應的 matchedItemIds。`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        answer: {
          type: Type.STRING,
          description: '回答使用者的推薦內容與具體建議',
        },
        reasoning: {
          type: Type.STRING,
          description: '推薦原因分析、賣場順路度或食材共通性說明',
        },
        matchedItemIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '符合條件的卡片 ID 陣列（若無符合則回傳空陣列）',
        },
        suggestedFollowUps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '2~3 個後續相關延伸提問建議',
        },
      },
      required: ['answer', 'reasoning', 'matchedItemIds'],
    };

    const fallbackRes = await generateWithFallback({
      contents: userPrompt,
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.3,
    });

    const responseText = fallbackRes.text;
    if (!responseText) {
      throw new Error('Gemini API 未回傳回答。');
    }

    const parsed = JSON.parse(responseText);

    return NextResponse.json({
      success: true,
      answer: parsed.answer || '',
      reasoning: parsed.reasoning || '',
      matchedItemIds: Array.isArray(parsed.matchedItemIds) ? parsed.matchedItemIds : [],
      suggestedFollowUps: Array.isArray(parsed.suggestedFollowUps) ? parsed.suggestedFollowUps : [],
    } as AskQueryResponse);
  } catch (err: unknown) {
    console.error('API /api/ask error:', err);
    return NextResponse.json(
      { success: false, error: getFriendlyErrorMessage(err) },
      { status: 500 }
    );
  }
}
