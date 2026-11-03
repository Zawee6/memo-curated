import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { ParsedItem, SourcePost } from '@/types/item';
import {
  getServerItems,
  saveServerItem,
  updateServerItem,
  deleteServerItem,
  getSpaceIdFromRequest,
} from '@/lib/serverDb';
import { cleanLocationName, findMatchingMasterItem, mergeIntoMasterItem } from '@/lib/entityDeduplication';
import { normalizeCityName, fixPlaceMetadata } from '@/lib/location-normalizer';
import { formatDate } from '@/lib/format';
import { sanitizeUrl, scrapeUrlContent, getFallbackCoordinates } from '@/lib/parserService';
import { normalizeSocialUrl } from '@/lib/video';
import { generateWithFallback, getFriendlyErrorMessage, extractJsonFromText } from '@/lib/gemini-client';

export async function POST(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const body = await req.json();
    const { itemId } = body;

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: '缺少 itemId 參數' },
        { status: 400 }
      );
    }

    const allItems = await getServerItems(spaceId);
    const item = allItems.find((i) => i.id === itemId);

    if (!item) {
      return NextResponse.json(
        { success: false, error: '找不到指定的合集卡片項目' },
        { status: 404 }
      );
    }

    // 1. 抓取原始貼文全文、留言與資訊
    let scrapedText = '';
    let scrapedThumbnailUrl = item.thumbnailUrl;

    if (item.url && !item.url.startsWith('https://example.com')) {
      try {
        const { cleanUrl, shortcode } = sanitizeUrl(item.url);
        const scraped = await scrapeUrlContent(cleanUrl, shortcode);
        scrapedText = scraped.text || '';
        if (scraped.thumbnailUrl) {
          scrapedThumbnailUrl = scraped.thumbnailUrl;
        }
      } catch (scrapeErr) {
        console.warn('[Split API] Scrape warning:', scrapeErr);
      }
    }

    // 2. 彙整母卡既有內容
    const sourceTexts = Array.isArray(item.sources)
      ? item.sources.map((s) => `來源標題: ${s.title}\n來源筆記: ${s.summary}`).join('\n\n')
      : '';

    const subPlacesText = Array.isArray(item.subPlaces)
      ? item.subPlaces
          .map((sp) => `子地點: ${sp.name || sp.shopName} (${sp.city || ''}) ${sp.highlight || sp.summary || ''}`)
          .join('\n')
      : '';

    const combinedText = [
      `【卡片標題】：${item.title}`,
      `【卡片摘要】：${item.summary}`,
      `【原始網址】：${item.url || '無'}`,
      item.placeInfo ? `【現有地點】：${item.placeInfo.locationName || ''} / ${item.placeInfo.address || ''}` : '',
      subPlacesText ? `【提及店家】：\n${subPlacesText}` : '',
      sourceTexts ? `【相關來源】：\n${sourceTexts}` : '',
      scrapedText ? `【貼文內文與留言】：\n${scrapedText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    // 3. ⚡ 單次批次聯網查詢所有店家 (Single-Batch Query，開啟 googleSearch Grounding)
    const prompt = `你是一個專業的美食與旅遊專家。這是一篇社群推薦貼文/短影音（可能是多店懶人包、美食合集或私藏名單）。
請根據以下內容與聯網搜尋（Google Search Grounding），找出這篇貼文/影片中推薦或介紹的「所有獨立店家、餐廳、咖啡廳、甜點店或景點」。
在同一次回傳中，一次性為每間店家查出真實的詳細完整資訊，並以繁體中文回傳 JSON 物件。

${combinedText.slice(0, 25000)}

請嚴格回傳包含 places 陣列的 JSON 物件：
- isMultiPlace: 是否包含多間店家或景點 (boolean)
- places: 店家陣列，每間店必須包含：
  - shopName: 正式且純淨的店家名稱（嚴禁包含「推薦」、「懶人包」等字眼，這將直接作為獨立卡片標題）
  - city: 所在縣市（統一正規化為例如「嘉義」、「台北」、「台中」、「台南」、「高雄」，不帶縣/市尾綴）
  - address: 聯網查出的真實完整地址（例如「嘉義市東區光華路108號」）
  - rating: Google Maps 參考星級評分（例如「4.5 ★」或「4.8」）
  - summary: 專門針對這間店的詳細介紹（結合原影片推薦原因 ＋ 必吃必點特色 ＋ 營業特色，約 60~100 字）
  - mustTryDishes: 推薦必點招牌菜色（字串陣列）
  - googleMapsQuery: 店名與完整地址組合，例如「阿宏師火雞肉飯 嘉義市東區光華路108號」
`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        isMultiPlace: { type: Type.BOOLEAN },
        places: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              shopName: { type: Type.STRING },
              city: { type: Type.STRING },
              address: { type: Type.STRING },
              rating: { type: Type.STRING },
              summary: { type: Type.STRING },
              mustTryDishes: { type: Type.ARRAY, items: { type: Type.STRING } },
              googleMapsQuery: { type: Type.STRING },
            },
            required: ['shopName', 'city', 'address', 'summary'],
          },
        },
      },
      required: ['isMultiPlace', 'places'],
    };

    console.log(`[Split API] 🚀 Invoking generateWithFallback for item: ${item.title}`);
    const aiResult = await generateWithFallback({
      contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n請務必以繁體中文且直接輸出合法 JSON 格式（使用 \`\`\`json ... \`\`\` 程式碼區塊包裹），不要包含任何多餘前綴或說明文字。` }] }],
      systemInstruction:
        '你是一個繁體中文美食與旅遊資料結構化抽取專家，善用 Google Search 聯網查詢真實店家地址與評分。請以繁體中文回傳合法 JSON 格式。',
      tools: [{ googleSearch: {} }],
      temperature: 0.2,
    });

    let parsedResult: { isMultiPlace?: boolean; places?: any[] } = {};
    try {
      const jsonStr = extractJsonFromText(aiResult.text || '');
      parsedResult = JSON.parse(jsonStr || '{}');
    } catch (parseErr) {
      console.error('[Split API] Failed to parse JSON:', aiResult.text);
      throw new Error('AI 回傳格式非合法 JSON，請重新再試一次。');
    }

    const places = Array.isArray(parsedResult.places) ? parsedResult.places : [];

    if (places.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未能從此貼文中辨識出任何明確店家，請確認貼文內容是否有提及具體店名。',
      });
    }

    // 4. 寫入獨立卡片並替換原合集母卡
    let currentDb = await getServerItems();
    const createdCards: ParsedItem[] = [];

    // 若找到 2 間以上店家，拆分後移除原合集母卡
    const shouldRemoveMotherCard = places.length >= 2;

    for (let idx = 0; idx < places.length; idx++) {
      const p = places[idx];
      const rawShopName = (p.shopName || '').trim();
      if (!rawShopName) continue;

      const city = normalizeCityName(p.city || item.placeInfo?.city || '嘉義');
      const address = (p.address || `${city} ${rawShopName}`).trim();
      const googleMapsQuery = (p.googleMapsQuery || `${rawShopName} ${address}`).trim();
      const coords = getFallbackCoordinates(city);

      const ratingText = p.rating
        ? (p.rating.includes('★') ? p.rating : `${p.rating} ★`)
        : '4.6 ★';

      const candidateCard: ParsedItem = {
        id: `item_${Date.now()}_place_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        url: item.url,
        category: 'place',
        title: rawShopName,
        originalVideoTitle: item.originalVideoTitle || item.title,
        summary: p.summary || `來自「${item.title}」推薦店家`,
        tags: Array.from(new Set([city, '美食', ...(item.tags || [])])).filter(Boolean).slice(0, 6),
        thumbnailUrl: item.thumbnailUrl || scrapedThumbnailUrl,
        aspectRatio: item.aspectRatio || '9:16',
        createdAt: Date.now() - (places.length - idx) * 30,
        placeInfo: {
          locationName: rawShopName,
          city,
          address,
          googleMapsQuery,
          mustTryDishes: Array.isArray(p.mustTryDishes) && p.mustTryDishes.length > 0 ? p.mustTryDishes : undefined,
          rating: ratingText,
          lat: coords.lat,
          lng: coords.lng,
        },
        sources: [
          {
            id: `src_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            url: item.url,
            title: item.title,
            summary: p.summary || item.summary,
            thumbnailUrl: item.thumbnailUrl || scrapedThumbnailUrl || undefined,
            addedAt: formatDate(Date.now()),
            aspectRatio: item.aspectRatio || '9:16',
          },
        ],
      };

      const calibratedCard = fixPlaceMetadata(candidateCard);

      // 檢查目前資料庫（排除當前待拆分的母卡）是否有同名實體
      const remainingItems = currentDb.filter((dbItem) => dbItem.id !== item.id);
      const matched = findMatchingMasterItem(calibratedCard, remainingItems);

      if (matched) {
        const merged = mergeIntoMasterItem(matched, calibratedCard);
        currentDb = await updateServerItem(matched.id, merged, spaceId);
        createdCards.push(merged);
      } else {
        currentDb = await saveServerItem(calibratedCard, spaceId);
        createdCards.push(calibratedCard);
      }
    }

    // 5. 拆分完成後，若拆出多家店，安全將原本籠統的「合集母卡」從 items 中移除
    if (shouldRemoveMotherCard && createdCards.length > 0) {
      console.log(`[Split API] 🗑️ Removing mother collection card: ${item.id} (${item.title})`);
      await deleteServerItem(item.id, spaceId);
    } else if (places.length === 1 && createdCards.length > 0) {
      // 若只解析出 1 間店，更新母卡自身為精確店家資訊
      await deleteServerItem(item.id, spaceId);
    }

    const latestItems = await getServerItems(spaceId);

    return NextResponse.json({
      success: true,
      spaceId,
      splitCount: createdCards.length,
      createdCards,
      items: latestItems,
      message: `🎉 成功查出並拆分為 ${createdCards.length} 間獨立店家卡片！`,
    });
  } catch (err: unknown) {
    console.error('[Split API] Error:', err);
    const friendlyError = getFriendlyErrorMessage(err);
    return NextResponse.json({ success: false, error: friendlyError }, { status: 500 });
  }
}
