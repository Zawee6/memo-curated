import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { generateWithFallback, getFriendlyErrorMessage } from '@/lib/gemini-client';
import { getEffectiveGeminiKey } from '@/lib/config';
import { ParsedItem, ItineraryPlan, TransportMode } from '@/types/item';
import { saveAINote, getSpaceIdFromRequest } from '@/lib/serverDb';
import { sendIPhoneNotification } from '@/lib/notificationService';
import { generateItineraryExportText } from '@/lib/itineraryFormatter';
import { normalizeCityName } from '@/lib/location-normalizer';

export async function POST(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const body = await req.json();
    const places: ParsedItem[] = body?.places || [];
    const transportMode: TransportMode = body?.transportMode || 'two-wheeler';
    const departureTime: string = body?.departureTime || '10:00';

    if (!Array.isArray(places) || places.length === 0) {
      return NextResponse.json(
        { success: false, error: '請提供至少一個地點以規劃行程。' },
        { status: 400 }
      );
    }

    const apiKey = (await getEffectiveGeminiKey()) || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: '尚未設定 GEMINI_API_KEY，請於網頁設定中填入金鑰。',
        },
        { status: 500 }
      );
    }

    // 整理輸入的地點資料，包含使用者筆記與收藏重點
    const placesContext = places
      .map((p, idx) => {
        const info = p.placeInfo;
        const notes = [
          p.userNote ? `我的評價筆記: ${p.userNote}` : '',
          p.sources && p.sources.length > 0
            ? `收藏來源摘要: ${p.sources.map((s) => s.summary || s.title).join('; ')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');

        return `【地點 ${idx + 1}】
ID: ${p.id}
名稱: ${info?.locationName || p.title}
城市: ${info?.city || '未標註'}
地址: ${info?.address || '未標註'}
座標: ${info?.lat && info?.lng ? `${info.lat}, ${info.lng}` : '未標註'}
特色摘要: ${p.summary}
${notes ? `${notes}\n` : ''}標籤: ${p.tags?.join(', ') || '無'}`;
      })
      .join('\n\n');

    let transportLabel = '🛵 騎機車';
    let transportGuidance = '';
    switch (transportMode) {
      case 'driving':
        transportLabel = '🚗 開車';
        transportGuidance = `
【重要交通方式：🚗 開車 (driving)】
- 請規劃最適合汽車行駛之主幹道路線，考量尖峰塞車風險與折返問題。
- 在每一站的 transitToNext 中，必須清楚說明：
  1. 沿哪條主要幹道開車往哪個方向，預估行車時間與行駛公里數（例如：「沿民族路往東行駛約 10 分鐘（3.2 公里）」）。
  2. 到達該站時的停車建議（例如：「可停放於文化公園地下收費停車場或周圍路邊收費車格」）。
`;
        break;
      case 'two-wheeler':
        transportLabel = '🛵 騎機車';
        transportGuidance = `
【重要交通方式：🛵 騎機車 (two-wheeler) - 台灣在地實用】
- 針對台灣城市機車穿梭巷弄與機動性高的優勢，規劃最省時、順路、避開禁行機車與大迴轉的路線。
- 在每一站的 transitToNext 中，必須清楚說明：
  1. 機車騎乘路線、預估騎行分鐘數與距離（例如：「沿民族路往東騎乘約 6 分鐘（1.8 公里）」）。
  2. 該店門口或周邊路邊機車停車格之便利度。
`;
        break;
      case 'transit':
        transportLabel = '🚌 大眾運輸';
        transportGuidance = `
【重要交通方式：🚌 大眾運輸 (transit)】
- 優先考慮搭乘公車、市區巴士、捷運/地鐵、台鐵，並計算合理班距與步行接駁。
- 在每一站的 transitToNext 中，必須清楚說明：
  1. 從該站門口步行幾分鐘至哪個站牌/捷運站出口（例如：「從店門口步行約 3 分鐘至『中央噴水池站』」）。
  2. 具體建議搭乘哪路公車代號或捷運線、在哪一站下車，全段預估大眾運輸時間（例如：「搭乘市區 66 路公車至嘉義火車站，約 12 分鐘」）。
`;
        break;
      case 'walking':
        transportLabel = '🚶 步行漫遊';
        transportGuidance = `
【重要交通方式：🚶 步行漫遊 (walking)】
- 以悠閒散步探索為核心，規劃適合步行的街廓、林蔭步道或徒步商圈。
- 在每一站的 transitToNext 中，說明步行路線特色與步行分鐘數（例如：「沿文化路步行商圈散步約 8 分鐘（550 公尺）」）。
`;
        break;
    }

    const systemInstruction = `你是一個精通旅遊動線規劃、在地美食與台灣交通探索的頂尖 AI 導遊專家。
使用者會提供一系列收藏的景點與美食清單。
請根據地點的地理位置鄰近度、性質與最佳參訪時段（例如：早午餐 -> 景點散步 -> 下午茶咖啡廳 -> 晚餐美食 -> 夜市/酒吧），規劃出最流暢、減少折返跑的「保母級詳細一日遊時間軸指南」。
一律使用繁體中文（台灣慣用字）輸出，並嚴格遵循指定的 JSON Schema。`;

    const userPrompt = `使用者預計在【${departureTime}】出發，以【${transportLabel}】方式探訪以下地點：

${placesContext}

${transportGuidance}

請以【${departureTime}】為行程起點，嚴謹推算並規劃每一站的時間軸（timeSlot）。
每站必須具體寫出在此站做什麼、必吃必點招牌菜（whatToDo）、建議停留時間（stayDuration）、以及前往下一站的詳細交通指南（transitToNext）。
若交通方式為開車或騎機車，請於 parkingInfo 中提供「🅿️ 附近停車場建議」（停車場名稱、路邊車格或步行距離）；若為大眾運輸，請於 transitDetail 中提供「🚆 大眾運輸搭乘方式」（捷運/公車號碼、站牌名稱、上下車站點、步行時間）。
若為最後一站，transitToNext 請寫「行程圓滿結束」。`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: '行程主題標題，例如「嘉義文青咖啡與昭和甜點慢活一日遊」',
        },
        city: {
          type: Type.STRING,
          description: '行程主要城市，例如「台北」、「嘉義」、「台南」',
        },
        dayOverview: {
          type: Type.STRING,
          description: '100~150字左右的行程特色、交通安排動線與整體氛圍導覽',
        },
        transportMode: {
          type: Type.STRING,
          description: '交通方式：driving / two-wheeler / transit / walking',
        },
        departureTime: {
          type: Type.STRING,
          description: '出發時間，例如「10:00」',
        },
        stops: {
          type: Type.ARRAY,
          description: '排序後的時間軸各站點清單',
          items: {
            type: Type.OBJECT,
            properties: {
              timeSlot: {
                type: Type.STRING,
                description: '建議時段，例如「10:00 - 11:30」',
              },
              placeId: {
                type: Type.STRING,
                description: '對應原輸入地點的 ID',
              },
              placeName: {
                type: Type.STRING,
                description: '地點名稱',
              },
              whatToDo: {
                type: Type.STRING,
                description: '在此站具體做什麼、必吃必點招牌菜或拍照亮點（約 30~60 字）',
              },
              stayDuration: {
                type: Type.STRING,
                description: '建議停留時間，例如「90 分鐘」或「60 分鐘」',
              },
              transitToNext: {
                type: Type.STRING,
                description: '前往下一站的詳細交通方式說明（包含路線、車程/步程與停車建議）',
              },
              parkingInfo: {
                type: Type.STRING,
                description: '🅿️ 附近停車場建議（停車場名稱、路邊車格或步行分鐘數）',
              },
              parkingName: {
                type: Type.STRING,
                description: '若為自駕/開車/騎車，請推薦此地點最近的具體收費停車場或路邊停車場名稱（例如「嘟嘟房嘉義文化站」、「文化公園地下停車場」）',
              },
              parkingNote: {
                type: Type.STRING,
                description: '停車注意事項（例如「車位較少建議提早進場」、「假日收費每小時 40 元」）',
              },
              transitDetail: {
                type: Type.STRING,
                description: '🚆 大眾運輸搭乘方式（捷運/公車路線、站牌名稱、上下車站、步行時間）',
              },
              tips: {
                type: Type.STRING,
                description: '排隊秘訣、抽號碼牌、避開人潮或拍照打卡小撇步',
              },
              address: {
                type: Type.STRING,
                description: '地點地址',
              },
            },
            required: ['timeSlot', 'placeName', 'whatToDo', 'stayDuration', 'transitToNext'],
          },
        },
      },
      required: ['title', 'dayOverview', 'stops'],
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
      throw new Error('Gemini API 未回傳行程內容。');
    }

    const plan: ItineraryPlan = JSON.parse(responseText);
    plan.transportMode = transportMode;
    plan.departureTime = departureTime;

    if (plan.city) {
      plan.city = normalizeCityName(plan.city);
    }

    // 依據 placeId 或 placeName 比對原始 places，補齊精確的 lat, lng, address, thumbnailUrl 與 Google Maps 超連結
    if (Array.isArray(plan.stops)) {
      plan.stops = plan.stops.map((stop) => {
        const stopName = (stop.placeName || '').toLowerCase();
        const match =
          places.find((p) => p.id === stop.placeId) ||
          places.find((p) => {
            const loc = (p.placeInfo?.locationName || '').toLowerCase();
            const title = (p.title || '').toLowerCase();
            return (
              (loc && (stopName.includes(loc) || loc.includes(stopName))) ||
              (title && (stopName.includes(title) || title.includes(stopName)))
            );
          });

        const address = stop.address || match?.placeInfo?.address || '';
        const lat = match?.placeInfo?.lat;
        const lng = match?.placeInfo?.lng;
        const thumbnailUrl = match?.thumbnailUrl || undefined;
        const placeId = match?.id || stop.placeId;

        const effectiveCity = plan.city || match?.placeInfo?.city || '';
        const placeQuery = `${effectiveCity} ${stop.placeName} ${address}`.trim();
        const placeMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`;

        let parkingMapUrl = stop.parkingMapUrl;
        if (stop.parkingName) {
          const parkQuery = `${effectiveCity} ${stop.parkingName}`.trim();
          parkingMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parkQuery)}`;
        }

        return {
          ...stop,
          placeId,
          lat,
          lng,
          address,
          thumbnailUrl,
          placeMapUrl,
          parkingMapUrl,
          // 相容舊版欄位
          activity: stop.whatToDo || stop.activity || '',
          transitSuggestion: stop.transitToNext || stop.transitSuggestion || '',
          parkingInfo: stop.parkingInfo || '',
          parkingName: stop.parkingName,
          parkingNote: stop.parkingNote,
          transitDetail: stop.transitDetail || '',
        };
      });
    }

    // 自動保存至 AI 記事本並發送 iPhone 推播
    const markdownNote = generateItineraryExportText(plan);
    void (async () => {
      try {
        await saveAINote(
          {
            id: `itin_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'itinerary',
            status: 'ready',
            title: plan.title,
            requestParams: { transportMode, departureTime, count: places.length },
            resultData: plan,
            markdownNote,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
          spaceId
        );
        await sendIPhoneNotification(
          {
            title: 'Memo AI 想好了！🪄',
            body: `「${plan.title}」已為您規劃完畢，點此回來看囉！`,
            group: 'MemoItinerary',
          },
          spaceId
        );
      } catch (e) {
        console.warn('Failed to save to aiNotebook or send notification:', e);
      }
    })();

    return NextResponse.json({
      success: true,
      data: plan,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error('API /api/itinerary error:', errMessage);
    return NextResponse.json(
      {
        success: false,
        error: getFriendlyErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
