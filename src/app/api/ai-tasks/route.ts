import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { generateWithFallback, getFriendlyErrorMessage, extractJsonFromText } from '@/lib/gemini-client';
import { getEffectiveGeminiKey } from '@/lib/config';
import {
  getAINotebook,
  saveAINote,
  updateAINote,
  deleteAINote,
  getServerItems,
  getSpaceIdFromRequest,
  canAccessDefaultSpace,
} from '@/lib/serverDb';
import {
  AINoteItem,
  AINoteType,
  ParsedItem,
  ItineraryPlan,
  RecipeSuggestion,
  TransportMode,
} from '@/types/item';
import { sendIPhoneNotification } from '@/lib/notificationService';
import { generateItineraryExportText } from '@/lib/itineraryFormatter';
import { normalizeCityName } from '@/lib/location-normalizer';
import { aggregateRecipeIngredients } from '@/lib/recipeUtils';

export async function GET(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);

    // 🔒 空間隱私隔離：未授權訪客嚴禁讀取 default 主資料庫
    if (spaceId === 'default' && !canAccessDefaultSpace(req)) {
      return NextResponse.json(
        {
          success: false,
          isProtected: true,
          spaceId: 'default',
          notes: [],
          error: '🔒 私人空間保護：此為主機主要資料庫，請透過專屬邀請連結進入，或輸入管理員通行碼解鎖。',
        },
        { status: 403 }
      );
    }

    const notes = await getAINotebook(spaceId);
    return NextResponse.json({
      success: true,
      spaceId,
      notes,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少 note id' },
        { status: 400 }
      );
    }
    const notes = await deleteAINote(id, spaceId);
    return NextResponse.json({
      success: true,
      spaceId,
      notes,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const rawType = body?.type;
    const type: AINoteType = (rawType === 'shopping' || rawType === 'menu') ? 'shopping' : 'itinerary';
    const requestParams = body?.requestParams || {};
    const defaultTitle =
      body?.title?.trim() ||
      (type === 'itinerary'
        ? `📍 ${requestParams?.city ? normalizeCityName(requestParams.city) : '城市'}順路行程規劃`
        : '🛒 今日食材採買清單');

    // 取得 Client Origin 以供 iPhone 推播點擊直達
    const originHeader = req.headers.get('origin') || req.headers.get('host');
    const clientOrigin = originHeader
      ? originHeader.startsWith('http')
        ? originHeader
        : `http://${originHeader}`
      : '';

    // 若呼叫端傳入 status === 'ready'（例如直接從純粹採買表單存入 AI 記事本），直接儲存完成狀態
    if (body?.status === 'ready') {
      const directNote: AINoteItem = {
        id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type,
        status: 'ready',
        title: defaultTitle,
        requestParams,
        resultData: body?.resultData,
        markdownNote: body?.markdownNote,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };

      await saveAINote(directNote, spaceId);

      return NextResponse.json({
        success: true,
        spaceId,
        note: directNote,
        message: '✓ 已成功存入 AI 記事本購物清單！',
      });
    }

    // 1. 立即建立 'thinking' 狀態筆記寫入資料庫
    const newNote: AINoteItem = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      status: 'thinking',
      title: defaultTitle,
      requestParams,
      createdAt: new Date().toISOString(),
    };

    await saveAINote(newNote, spaceId);

    // 2. 啟動伺服器端非同步背景處理（不阻塞當前 HTTP 回應，前端 100ms 內完成）
    void processTaskInBackground(newNote, clientOrigin, spaceId);

    return NextResponse.json({
      success: true,
      spaceId,
      note: newNote,
      message: '🧠 AI 已在背景開始思考！完成後會自動存入記事本並推播通知 iPhone。',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * 伺服器背景非同步思考工作器
 */
async function processTaskInBackground(
  note: AINoteItem,
  clientOrigin?: string,
  spaceId?: string
) {
  try {
    const apiKey = (await getEffectiveGeminiKey()) || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('伺服器尚未設定 GEMINI_API_KEY');
    }

    if (note.type === 'itinerary') {
      await executeItineraryTask(note, clientOrigin, spaceId);
    } else {
      await executeMenuTask(note, clientOrigin, spaceId);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AI Notebook] Background task ${note.id} failed:`, msg);
    await updateAINote(
      note.id,
      {
        status: 'failed',
        error: msg,
        completedAt: new Date().toISOString(),
      },
      spaceId
    );
  }
}

/**
 * 景點順路行程背景思考
 */
async function executeItineraryTask(
  note: AINoteItem,
  clientOrigin?: string,
  spaceId?: string
) {
  const params = note.requestParams || {};
  let places: ParsedItem[] = Array.isArray(params.places) ? params.places : [];

  // 若未傳入地點，自動從伺服器景點庫取用
  if (places.length === 0) {
    const serverItems = await getServerItems(spaceId);
    places = serverItems.filter((i) => i.category === 'place').slice(0, 6);
  }

  if (places.length === 0) {
    throw new Error('目前無任何景點可供規劃行程，請先新增景點收藏。');
  }

  const transportMode: TransportMode = params.transportMode || 'two-wheeler';
  const departureTime: string = params.departureTime || '10:00';

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
城市: ${info?.city ? normalizeCityName(info.city) : '未標註'}
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
- 這是台灣在地最靈活便捷的交通模式！可穿梭市區巷弄捷徑，避開大路紅綠燈與圓環擁堵。
- 在每一站的 transitToNext 中，必須清楚說明：
  1. 騎車捷徑或推薦巷弄路線、預估騎行分鐘數與公里數（例如：「🛵 騎車約 7 分鐘 (2.1 km)，建議走延平街小巷接忠孝路避開圓環紅燈」）。
  2. 停車說明：店門口機車停放格、騎樓停放規範或附近路邊白線機車位。
`;
      break;
    case 'transit':
      transportLabel = '🚌 大眾運輸';
      transportGuidance = `
【重要交通方式：🚌 大眾運輸 (transit)】
- 優先推薦最省時的公車路線或捷運/輕軌/台鐵區間車。
- 在每一站的 transitToNext 中，必須清楚說明：
  1. 搭乘哪一號公車或捷運哪一條線、在什麼站牌/出口上車與下車。
  2. 下車後的步行路線與步行時間（例如：「步行約 3 分鐘 (250 公尺) 抵達」）。
`;
      break;
    case 'walking':
      transportLabel = '🚶 步行漫遊';
      transportGuidance = `
【重要交通方式：🚶 步行漫遊 (walking)】
- 適合商圈街區散步動線，避免繞遠路。
- 在每一站的 transitToNext 中，必須清楚說明沿途街景亮點與步行分鐘數（例如：「🚶 沿文化路商圈徒步漫遊約 6 分鐘即可到達」）。
`;
      break;
  }

  const prompt = `你是一位精通台灣旅遊與在地私房美食的專業旅行行程規劃師。
請根據使用者提供的私房景點收藏清單，為使用者量身打造一份極致流暢、不繞路、深度體驗的「城市一日時間軸順路行程」。

【出發設定】
- 預計出發時間：${departureTime}
- 交通方式：${transportLabel}
${transportGuidance}

【使用者收藏地點候選清單】
${placesContext}

【規劃指導原則】
1. **順路動線排序**：
   - 務必按地理空間位置合理安排順序（由起點出發，相鄰地點連續串連），嚴禁東奔西跑或重複折返！
2. **保母級時間軸規劃 (timeSlot & stayDuration)**：
   - 以出發時間「${departureTime}」開始，計算每一站的抵達與離開時段（例如「${departureTime} - 11:30」）。
   - 根據地點性質設定合理停留時間（例如：正餐/咖啡廳 60~90 分鐘，拍照景點 30~45 分鐘）。
3. **必吃必訪具體重點 (whatToDo)**：
   - 深入結合收藏中提到的特色料理、招牌點心、拍照秘境、必拍角度或點餐攻略（例如：「必點招牌火雞肉飯（肉片）加一顆半熟荷包蛋，淋上雞油香氣四溢；吃完可到後方日式老宅長廊拍照」）。
4. **精確交通指南 (transitToNext)**：
   - 到達下一站的具體交通建議，符合選定的【${transportLabel}】，包含行駛路段、預估時間、距離與停車/搭乘說明。
5. **停車與大眾運輸專屬欄位**：
   - 若為開車或騎機車：請於 parkingInfo 中提供「🅿️ 附近停車場建議」（停車場名稱、路邊車格或步行距離）。
   - 若為大眾運輸：請於 transitDetail 中提供「🚆 大眾運輸搭乘方式」（捷運/公車號碼、站牌名稱、上下車站點、步行時間）。
6. **地名統一繁體中文**：所有縣市統稱（例如：「嘉義」嚴禁寫成「嘉義市」或「嘉義縣」）。`;

  const response = await generateWithFallback({
    contents: prompt,
    temperature: 0.2,
    modelList: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'],
    responseMimeType: 'application/json',
    responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          city: { type: Type.STRING },
          dayOverview: { type: Type.STRING },
          stops: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timeSlot: { type: Type.STRING },
                placeId: { type: Type.STRING },
                placeName: { type: Type.STRING },
                whatToDo: { type: Type.STRING },
                stayDuration: { type: Type.STRING },
                transitToNext: { type: Type.STRING },
                parkingInfo: { type: Type.STRING },
                parkingName: { type: Type.STRING },
                parkingNote: { type: Type.STRING },
                transitDetail: { type: Type.STRING },
                tips: { type: Type.STRING },
              },
              required: ['timeSlot', 'placeName', 'whatToDo', 'stayDuration'],
            },
          },
        },
        required: ['title', 'city', 'dayOverview', 'stops'],
      },
  });

  const parsedPlan: ItineraryPlan = JSON.parse(extractJsonFromText(response.text) || '{}');
  const city = normalizeCityName(parsedPlan.city || params.city || places[0]?.placeInfo?.city || '城市');

  // 比對並補齊座標、縮圖與 Google Maps 連結
  const enrichedStops = (parsedPlan.stops || []).map((stop) => {
    let matched = stop.placeId ? places.find((p) => p.id === stop.placeId) : undefined;
    if (!matched) {
      const stopClean = stop.placeName.replace(/\s+/g, '').toLowerCase();
      matched = places.find((p) => {
        const titleClean = p.title.replace(/\s+/g, '').toLowerCase();
        const locClean = (p.placeInfo?.locationName || '').replace(/\s+/g, '').toLowerCase();
        return titleClean.includes(stopClean) || stopClean.includes(titleClean) ||
               (locClean && (locClean.includes(stopClean) || stopClean.includes(locClean)));
      });
    }

    const address = matched?.placeInfo?.address || stop.address || '';
    const placeQuery = `${city} ${stop.placeName} ${address}`.trim();
    const placeMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`;

    let parkingMapUrl = stop.parkingMapUrl;
    if (stop.parkingName) {
      const parkQuery = `${city} ${stop.parkingName}`.trim();
      parkingMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parkQuery)}`;
    }

    return {
      ...stop,
      placeId: matched?.id || stop.placeId,
      lat: matched?.placeInfo?.lat,
      lng: matched?.placeInfo?.lng,
      address,
      thumbnailUrl: matched?.thumbnailUrl ? matched.thumbnailUrl : undefined,
      placeMapUrl,
      parkingMapUrl,
      activity: stop.whatToDo,
      transitSuggestion: stop.transitToNext,
      parkingInfo: stop.parkingInfo || '',
      parkingName: stop.parkingName,
      parkingNote: stop.parkingNote,
      transitDetail: stop.transitDetail || '',
    };
  });

  const completePlan: ItineraryPlan = {
    ...parsedPlan,
    city,
    transportMode,
    departureTime,
    stops: enrichedStops,
  };

  const markdownNote = generateItineraryExportText(completePlan);

  // 寫回資料庫
  await updateAINote(
    note.id,
    {
      status: 'ready',
      title: completePlan.title || note.title,
      resultData: completePlan,
      markdownNote,
      completedAt: new Date().toISOString(),
    },
    spaceId
  );

  // 發送 iPhone 推播
  const pushUrl = clientOrigin
    ? `${clientOrigin}/memo/places?note=${note.id}${spaceId && spaceId !== 'default' ? `&space=${spaceId}` : ''}`
    : '';
  await sendIPhoneNotification(
    {
      title: 'Memo AI 想好了！🪄',
      body: `「${completePlan.title}」已為您規劃完畢，點擊回來看囉！`,
      url: pushUrl,
      group: 'MemoItinerary',
    },
    spaceId
  );
}

/**
 * 私廚菜單背景思考
 */
async function executeMenuTask(
  note: AINoteItem,
  clientOrigin?: string,
  spaceId?: string
) {
  const params = note.requestParams || {};
  const preference = (params.preference || '均衡營養且能共用食材省錢').trim();
  const targetServings = Number(params.targetServings) || 2;
  const styleFilter = typeof params.styleFilter === 'string' ? params.styleFilter.trim() : '';
  const onlyFavorites = Boolean(params.onlyFavorites);

  const serverItems = await getServerItems(spaceId);
  let recipes = serverItems.filter((i) => i.category === 'recipe');

  if (recipes.length === 0) {
    throw new Error('目前收藏庫尚無任何食譜，請先貼上食譜網址新增收藏！');
  }

  if (onlyFavorites) {
    const favs = recipes.filter((r) => r.isFavorite);
    if (favs.length >= 2) recipes = favs;
  }

  if (styleFilter && styleFilter !== '全部風格') {
    const filtered = recipes.filter((r) => {
      const cuisine = r.recipeTags?.cuisine || '';
      const tags = r.tags || [];
      const custom = r.customTags || [];
      return (
        cuisine.includes(styleFilter) ||
        tags.some((t) => t.includes(styleFilter)) ||
        custom.some((c) => c.includes(styleFilter))
      );
    });
    if (filtered.length >= 2) recipes = filtered;
  }

  const recipesContext = recipes
    .map((r, idx) => {
      const ingList = r.recipeInfo?.ingredients
        ?.map((ing) => `${ing.name} ${ing.amount}${ing.unit || ''}`)
        .join(', ');
      return `【食譜 ${idx + 1}】
ID: ${r.id}
菜名: ${r.title}
風格/類型: ${r.recipeTags?.cuisine || '綜合'} / ${r.recipeTags?.mealType || '主食/配菜'}
食材清單: ${ingList || '無詳細資料'}
烹調時間: ${r.recipeInfo?.prepTime || '約20分鐘'}`;
    })
    .join('\n\n');

  const prompt = `你是一位五星級私廚管家。使用者今晚打算在家開伙（共 ${targetServings} 人份）。
請從使用者既有的食譜收藏庫中，為其挑選搭配出一套完美的「今日推薦菜單組合（2~4 道菜）」。

【使用者當前開伙需求】
- 用餐人數：${targetServings} 人份
- 特殊口味偏好：${preference}
${styleFilter ? `- 偏好料理風格：${styleFilter}` : ''}

【使用者食譜庫候選菜單】
${recipesContext}

【私廚搭配四大黃金原則】
1. **嚴禁虛構菜色**：所推薦的每一道料理，必須從候選菜單中挑選，recipeId 必須與候選 ID 100% 一致！
2. **營養與口感均衡**：通常包含 1 道靈魂主菜 + 1~2 道爽口配菜/蔬食 + 1 道湯品或主食。
3. **共用食材省錢法則 (sharedIngredientsHighlight)**：找出菜色之間重疊的生鮮食材或辛香料。
4. **繁體中文回傳**：片名、步驟與菜名一律採用台灣繁體中文。`;

  const response = await generateWithFallback({
    contents: prompt,
    temperature: 0.3,
    modelList: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'],
    responseMimeType: 'application/json',
    responseSchema: {
        type: Type.OBJECT,
        properties: {
          menuTitle: { type: Type.STRING },
          chefReasoning: { type: Type.STRING },
          estimatedPrepTime: { type: Type.STRING },
          sharedIngredientsHighlight: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          pairings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                recipeId: { type: Type.STRING },
                recipeTitle: { type: Type.STRING },
                role: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ['recipeId', 'recipeTitle', 'role', 'reason'],
            },
          },
        },
        required: [
          'menuTitle',
          'chefReasoning',
          'estimatedPrepTime',
          'sharedIngredientsHighlight',
          'pairings',
        ],
      },
  });

  const suggestion: RecipeSuggestion = JSON.parse(extractJsonFromText(response.text) || '{}');

  // 比對收藏庫中的實際食譜物件，計算精準食材清單
  const pairingIds = new Set(suggestion.pairings.map((p) => p.recipeId));
  let selectedRecipes = recipes.filter((r) => pairingIds.has(r.id));
  if (selectedRecipes.length === 0) {
    selectedRecipes = recipes.filter((r) =>
      suggestion.pairings.some(
        (p) => p.recipeTitle && (r.title.includes(p.recipeTitle) || p.recipeTitle.includes(r.title))
      )
    );
  }
  if (selectedRecipes.length === 0) {
    selectedRecipes = recipes.slice(0, suggestion.pairings.length || 2);
  }

  // 自動依 targetServings / baseServings 換算並聚合分類食材採買清單
  const shoppingItems = aggregateRecipeIngredients(selectedRecipes, targetServings);

  const markdownLines: string[] = [
    `🛒 今日私廚推薦・採買清單｜${suggestion.menuTitle}`,
    `👥 用餐人數：${targetServings} 人份 ｜ ⏱️ 預估總備料時間：${suggestion.estimatedPrepTime}`,
    `👨‍🍳 私廚搭配理念：${suggestion.chefReasoning}`,
    '',
    '──────────────────',
    '【今日精選開伙菜單】',
  ];

  suggestion.pairings.forEach((p, idx) => {
    markdownLines.push(`📍 第 ${idx + 1} 道 ｜ [${p.role}] ${p.recipeTitle}`);
    markdownLines.push(`💡 搭配理由：${p.reason}`);
    markdownLines.push('');
  });

  if (shoppingItems.length > 0) {
    markdownLines.push('──────────────────');
    markdownLines.push(`【🛒 今日採買總清單】（共 ${targetServings} 人份）`);
    markdownLines.push('');

    const categoryOrder = [
      { key: '生鮮肉品', label: '🥩 生鮮肉品 / 海鮮' },
      { key: '蔬菜水果', label: '🥬 蔬菜水果' },
      { key: '蛋奶豆製品', label: '🥚 蛋奶豆製品' },
      { key: '調味料與乾貨', label: '🧂 調味料與乾貨' },
      { key: '其他', label: '📦 其他' },
    ];

    categoryOrder.forEach(({ key, label }) => {
      const groupItems = shoppingItems.filter((it) => it.category === key);
      if (groupItems.length > 0) {
        markdownLines.push(label);
        groupItems.forEach((it) => {
          markdownLines.push(`${it.name} ${it.requiredAmountText}`);
        });
        markdownLines.push('');
      }
    });
  }

  if (suggestion.sharedIngredientsHighlight && suggestion.sharedIngredientsHighlight.length > 0) {
    markdownLines.push('──────────────────');
    markdownLines.push('【💡 共用食材與備料小撇步】');
    suggestion.sharedIngredientsHighlight.forEach((item) => {
      markdownLines.push(`• ${item}`);
    });
    markdownLines.push('');
  }

  markdownLines.push('由 Memo 私廚 AI 智慧管家精心搭配 🪄');

  const markdownNote = markdownLines.join('\n').trim();

  const enrichedResult: RecipeSuggestion = {
    ...suggestion,
    targetServings,
    recipeTitles: selectedRecipes.map((r) => r.title),
    shoppingItems,
  };

  // 寫回資料庫（類型為 shopping，代表購物清單）
  await updateAINote(
    note.id,
    {
      type: 'shopping',
      status: 'ready',
      title: `🛒 ${suggestion.menuTitle || note.title}・採買清單`,
      resultData: enrichedResult,
      markdownNote,
      completedAt: new Date().toISOString(),
    },
    spaceId
  );

  // 發送 iPhone 推播
  const pushUrl = clientOrigin
    ? `${clientOrigin}/memo/recipes?note=${note.id}${spaceId && spaceId !== 'default' ? `&space=${spaceId}` : ''}`
    : '';
  await sendIPhoneNotification(
    {
      title: 'Memo AI 採買清單已備妥！🛒',
      body: `「${suggestion.menuTitle}」食材採買清單與菜單已為您搭配完成，點擊回來看囉！`,
      url: pushUrl,
      group: 'MemoRecipe',
    },
    spaceId
  );
}
