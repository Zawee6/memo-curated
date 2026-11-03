import { NextRequest, NextResponse } from 'next/server';
import { getServerItems, saveServerItems, getSpaceIdFromRequest } from '@/lib/serverDb';
import { generateWithFallback, extractJsonFromText } from '@/lib/gemini-client';
import { standardizeCityName } from '@/lib/taiwanLocations';
import { inferDynamicPlaceTags } from '@/lib/smartTags';

export async function POST(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const forceAll = Boolean(body?.forceAll);

    const items = await getServerItems(spaceId);
    const places = items.filter((i) => i && i.category === 'place');

    if (places.length === 0) {
      return NextResponse.json({
        success: true,
        totalPlaces: 0,
        updatedCount: 0,
        message: '目前沒有任何已收藏之地點',
      });
    }

    // 簡化為輕量清單供 AI 單次批次極速處理
    const batchInput = places.map((p) => ({
      id: p.id,
      title: p.title,
      locationName: p.placeInfo?.locationName || p.title,
      address: p.placeInfo?.address || '',
      city: p.placeInfo?.city || '',
      district: p.placeInfo?.district || '',
      summary: (p.summary || '').slice(0, 150),
      currentTags: p.placeInfo?.smartTags || [],
    }));

    const prompt = `你是一個極度精準的台灣與全球景點/餐廳/店家型態分類專家。
請檢視以下 ${places.length} 個店家資料，為每一個店家產生：
1. smartTags：1~2 個最精準貼切的專屬店鋪型態標籤（必須包含對應 Emoji，例如：☕ 咖啡廳、🥖 潛艇堡/三明治、🥩 燒肉/火鍋、🧸 玩具/選物、🥐 甜點/烘焙、🍜 拉麵/日料、🍲 台式小吃、🥟 中式早點、🍻 酒吧/餐酒、⛺ 露營/戶外、📚 書店/藝文 等）。嚴禁亂歸類（例如脆皮燒肉潛艇堡店應為 🥖 潛艇堡/三明治，不可誤判為燒肉店）！
2. city：標準化台灣縣市正體名稱（一律統一使用「臺」，如：臺北、新北、基隆、桃園、新竹、苗栗、臺中、彰化、南投、雲林、嘉義、臺南、高雄、屏東、宜蘭、花蓮、臺東、澎湖、金門、連江，若是國外請標註國家或城市如日本、韓國、美國）。

店家資料清單：
${JSON.stringify(batchInput, null, 2)}

請嚴格回傳符合以下 JSON 格式（不要包含任何 markdown 解釋文字）：
{
  "results": [
    {
      "id": "店家ID",
      "smartTags": ["Emoji 標籤1"],
      "city": "縣市名稱"
    }
  ]
}`;

    const aiResultsMap = new Map<string, { smartTags?: string[]; city?: string }>();

    try {
      const aiResponse = await generateWithFallback({
        contents: prompt,
        temperature: 0.1,
        modelList: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'],
        responseMimeType: 'application/json',
      });

      if (aiResponse.text) {
        const jsonStr = extractJsonFromText(aiResponse.text);
        const parsed = JSON.parse(jsonStr);
        const results = Array.isArray(parsed.results)
          ? parsed.results
          : Array.isArray(parsed)
            ? parsed
            : [];
        results.forEach((r: any) => {
          if (r && r.id) {
            aiResultsMap.set(r.id, {
              smartTags: Array.isArray(r.smartTags) && r.smartTags.length > 0 ? r.smartTags : undefined,
              city: r.city ? standardizeCityName(r.city) : undefined,
            });
          }
        });
      }
    } catch (aiErr) {
      console.warn('[Reclassify] Gemini batch call failed, using rule-based fallback:', aiErr);
    }

    // 批次套用更新
    let updatedCount = 0;
    const updatedPlacesMap = new Map<string, any>();

    for (const place of places) {
      const aiRes = aiResultsMap.get(place.id);
      const fallbackTags = inferDynamicPlaceTags(place);
      const newSmartTags =
        aiRes?.smartTags ||
        (place.placeInfo?.smartTags?.length ? place.placeInfo.smartTags : fallbackTags);
      const newCity = aiRes?.city || standardizeCityName(place.placeInfo?.city || '');

      const updatedPlace = {
        ...place,
        placeInfo: {
          ...place.placeInfo,
          smartTags: newSmartTags,
          city: newCity || place.placeInfo?.city,
        },
      };
      updatedPlacesMap.set(place.id, updatedPlace);
      updatedCount++;
    }

    // 批次單次原子寫入資料庫
    const newItems = items.map((it) =>
      updatedPlacesMap.has(it.id) ? updatedPlacesMap.get(it.id) : it
    );
    await saveServerItems(newItems, spaceId);

    return NextResponse.json({
      success: true,
      totalPlaces: places.length,
      updatedCount,
      message: `✨ 已透過 AI 完成全部 ${updatedCount} 間店家的動態智慧標籤與縣市重新歸類！`,
    });
  } catch (err: any) {
    console.error('Failed to reclassify places:', err);
    return NextResponse.json(
      { success: false, error: err?.message || '重新歸類店家失敗' },
      { status: 500 }
    );
  }
}
