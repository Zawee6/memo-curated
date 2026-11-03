import { NextRequest, NextResponse } from 'next/server';
import { Type } from '@google/genai';
import { generateWithFallback, getFriendlyErrorMessage } from '@/lib/gemini-client';
import { getEffectiveGeminiKey } from '@/lib/config';
import { getServerItems, saveAINote, getSpaceIdFromRequest } from '@/lib/serverDb';
import { ParsedItem, RecipeSuggestion, RecipeSuggestionResponse } from '@/types/item';
import { sendIPhoneNotification } from '@/lib/notificationService';
import { aggregateRecipeIngredients } from '@/lib/recipeUtils';

export async function POST(req: NextRequest) {
  try {
    const spaceId = getSpaceIdFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const preference = (body?.preference || '均衡營養且能共用食材省錢').trim();
    const targetServings = Number(body?.targetServings) || 2;
    const styleFilter = typeof body?.styleFilter === 'string' ? body.styleFilter.trim() : '';
    const onlyFavorites = Boolean(body?.onlyFavorites);
    const clientRecipes: ParsedItem[] = Array.isArray(body?.recipes) ? body.recipes : [];

    // 讀取該空間中的所有食譜，並與前端傳入的食譜合併去重
    const serverItems = await getServerItems(spaceId);
    const serverRecipes = serverItems.filter((i) => i.category === 'recipe');

    const recipeMap = new Map<string, ParsedItem>();
    for (const r of [...serverRecipes, ...clientRecipes]) {
      if (r && r.id && r.category === 'recipe') {
        recipeMap.set(r.id, r);
      }
    }
    let allRecipes = Array.from(recipeMap.values());

    if (allRecipes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '目前收藏庫尚無任何食譜卡片，請先貼上食譜網址新增收藏！',
        } as RecipeSuggestionResponse,
        { status: 400 }
      );
    }

    // 若使用者要求「只從常用菜譜挑選」，且常用菜譜至少有 2 道，則鎖定候選清單
    if (onlyFavorites) {
      const favs = allRecipes.filter((r) => r.isFavorite);
      if (favs.length >= 2) {
        allRecipes = favs;
      }
    }

    const apiKey = (await getEffectiveGeminiKey()) || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: '伺服器尚未設定 GEMINI_API_KEY，請於網頁設定中填入金鑰。' } as RecipeSuggestionResponse,
        { status: 500 }
      );
    }

    // 整理收藏庫內的食譜清單給 AI 私廚挑選
    const recipeCatalogText = allRecipes
      .map((r, idx) => {
        const ings =
          r.recipeInfo?.ingredients
            ?.map((ing) => `${ing.name}(${ing.amount}${ing.unit || ''})`)
            .join('、') || '無明細';
        const favLabel = r.isFavorite ? '【⭐ 常用菜譜】' : '';
        const customTagsLabel = (r.customTags || []).length > 0 ? `風格標籤: [${r.customTags?.join(', ')}]` : '';
        return `[食譜 ${idx + 1}] ID: "${r.id}" | 菜名: "${r.title}" ${favLabel} | ${customTagsLabel} | 耗時: ${r.recipeInfo?.prepTime || '20分鐘'} | 標籤: ${(r.tags || []).join(',')} | 食材: ${ings} | 簡介: ${r.summary}`;
      })
      .join('\n');

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        menuTitle: {
          type: Type.STRING,
          description: '這套今日私廚菜單的質感主題名稱（例如：「東京家庭旬味・一鍋雙菜省錢晚宴」）',
        },
        chefReasoning: {
          type: Type.STRING,
          description:
            '私廚推薦這組搭配的完整理由（100字內，強調風味互補、動線順暢以及如何透過共用食材幫使用者在大賣場採買時省錢不浪費）',
        },
        sharedIngredientsHighlight: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '這幾道菜之間共用的關鍵食材清單（例如：["無鹽奶油", "洋蔥", "雞蛋", "日式醬油"]）',
        },
        estimatedPrepTime: {
          type: Type.STRING,
          description: '多爐同步備料開伙預計總耗時（例如：「約 35 分鐘可同步上桌」）',
        },
        pairings: {
          type: Type.ARRAY,
          description: '從收藏庫挑選出的 2~3 道食譜組合（必須使用收藏庫真實存在的 recipeId）',
          items: {
            type: Type.OBJECT,
            properties: {
              recipeId: {
                type: Type.STRING,
                description: '必須完全對應收藏庫中的 ID 字串',
              },
              recipeTitle: {
                type: Type.STRING,
                description: '食譜菜名',
              },
              role: {
                type: Type.STRING,
                description: '在餐桌上的角色（如：「🔥 靈魂主菜」、「🥬 時蔬配菜」、「🍲 暖胃湯品」、「🍝 經典主食」）',
              },
              reason: {
                type: Type.STRING,
                description: '為何挑選這道菜以及它與其他菜色的食材或風味呼應點（40字內）',
              },
            },
            required: ['recipeId', 'recipeTitle', 'role', 'reason'],
          },
        },
      },
      required: [
        'menuTitle',
        'chefReasoning',
        'sharedIngredientsHighlight',
        'estimatedPrepTime',
        'pairings',
      ],
    };

    const systemInstruction = `你是一位精通家庭開伙與食材搭配的「私廚顧問」。
請從使用者「目前已收藏的食譜清單」中，為 ${targetServings} 人份餐桌挑選出最速配的 2 到 3 道菜組合（例如：1主菜 + 1配菜 + 1湯品/主食；若收藏總數少於3道則全選並說明搭配建議）。
挑選原則：
1. 優先挑選能夠「共用生鮮或調味食材」（例如共用洋蔥、雞蛋、無鹽奶油、蒜頭、醬油等）的食譜，減少採買負擔不浪費！
2. 符合使用者今日的飲食心情與偏好：「${preference}」${
      styleFilter ? `，並強烈優先匹配【${styleFilter}】風格` : ''
    }${onlyFavorites ? '，且限定從【⭐ 常用菜譜】中挑選' : ''}。
3. 嚴格使用收藏庫提供的真實 recipeId，不可憑空捏造不存在的 ID。`;

    const userPrompt = `今日用餐人數：${targetServings} 人份
使用者今日偏好/心情：${preference}${styleFilter ? `\n指定風格偏好：${styleFilter}` : ''}${
      onlyFavorites ? '\n使用者指定：優先從 ⭐ 常用菜譜 挑選' : ''
    }

=== 使用者收藏庫現有食譜 (${allRecipes.length} 道) ===
${recipeCatalogText}`;

    const fallbackRes = await generateWithFallback({
      contents: userPrompt,
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.3,
    });

    const responseText = fallbackRes.text;
    if (!responseText) {
      throw new Error('AI 私廚未能產生配菜建議。');
    }

    const parsed: RecipeSuggestion = JSON.parse(responseText);

    // 校驗回傳的 recipeId 是否存在於 allRecipes，若名稱對得上則自動修正 ID
    const validIds = new Set(allRecipes.map((r) => r.id));
    parsed.pairings = (parsed.pairings || [])
      .map((p) => {
        if (validIds.has(p.recipeId)) return p;
        const matchedByTitle = allRecipes.find(
          (r) => r.title.includes(p.recipeTitle) || p.recipeTitle.includes(r.title)
        );
        if (matchedByTitle) {
          return {
            ...p,
            recipeId: matchedByTitle.id,
            recipeTitle: matchedByTitle.title,
          };
        }
        return p;
      })
      .filter((p) => validIds.has(p.recipeId));

    // 保底：若過濾後為空，直接選前 2~3 道食譜
    if (parsed.pairings.length === 0) {
      parsed.pairings = allRecipes.slice(0, Math.min(3, allRecipes.length)).map((r, i) => ({
        recipeId: r.id,
        recipeTitle: r.title,
        role: i === 0 ? '🔥 靈魂主菜' : i === 1 ? '🥬 百搭配菜' : '🍲 暖胃湯品',
        reason: '與今日菜單食材互補，一鍋到底省時省錢。',
      }));
    }

    // 比對選中的食譜並計算精準採買食材清單
    const pairingIds = new Set(parsed.pairings.map((p) => p.recipeId));
    let selectedRecipes = allRecipes.filter((r) => pairingIds.has(r.id));
    if (selectedRecipes.length === 0) {
      selectedRecipes = allRecipes.slice(0, parsed.pairings.length || 2);
    }
    const shoppingItems = aggregateRecipeIngredients(selectedRecipes, targetServings);

    // 自動保存一份至 AI 記事本（型態為 shopping 採買清單）並發送 iPhone 推播
    const markdownLines: string[] = [
      `🛒 今日私廚推薦・採買清單｜${parsed.menuTitle}`,
      `👥 用餐人數：${targetServings} 人份 ｜ ⏱️ 預估總備料時間：${parsed.estimatedPrepTime}`,
      `👨‍🍳 私廚搭配理念：${parsed.chefReasoning}`,
      '',
      '──────────────────',
      '【今日精選開伙菜單】',
    ];
    parsed.pairings.forEach((p, idx) => {
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

    if (parsed.sharedIngredientsHighlight && parsed.sharedIngredientsHighlight.length > 0) {
      markdownLines.push('──────────────────');
      markdownLines.push('【💡 共用食材與備料小撇步】');
      parsed.sharedIngredientsHighlight.forEach((item) => markdownLines.push(`• ${item}`));
      markdownLines.push('');
    }
    markdownLines.push('由 Memo 私廚 AI 智慧管家精心搭配 🪄');
    const markdownNote = markdownLines.join('\n').trim();

    const enrichedSuggestion: RecipeSuggestion = {
      ...parsed,
      targetServings,
      recipeTitles: selectedRecipes.map((r) => r.title),
      shoppingItems,
    };

    void (async () => {
      try {
        await saveAINote(
          {
            id: `menu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'shopping',
            status: 'ready',
            title: `🛒 ${parsed.menuTitle}・採買清單`,
            requestParams: { targetServings, preference, styleFilter },
            resultData: enrichedSuggestion,
            markdownNote,
            createdAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          },
          spaceId
        );
        await sendIPhoneNotification(
          {
            title: 'Memo AI 採買清單已備妥！🛒',
            body: `「${parsed.menuTitle}」食材採買清單已搭配完成，點此回來看囉！`,
            group: 'MemoRecipe',
          },
          spaceId
        );
      } catch (e) {
        console.warn('Failed to save to aiNotebook or send notification:', e);
      }
    })();

    return NextResponse.json({
      success: true,
      data: enrichedSuggestion,
    } as RecipeSuggestionResponse);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('API /api/recipes/suggest error:', msg);
    return NextResponse.json(
      {
        success: false,
        error: getFriendlyErrorMessage(err),
      } as RecipeSuggestionResponse,
      { status: 500 }
    );
  }
}
