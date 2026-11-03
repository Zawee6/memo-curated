import { NextRequest, NextResponse } from 'next/server';
import { cleanMediaTitle, getStreamingPlatformUrl } from '@/lib/streamingLinks';

interface JustWatchOffer {
  standardWebURL?: string;
  package?: {
    clearName?: string;
    technicalName?: string;
  };
}

interface JustWatchEdge {
  node?: {
    offers?: JustWatchOffer[];
  };
}

/**
 * 判斷 JustWatch 返回的 offer 是否符合目標平台
 */
function isPlatformMatch(
  targetPlatform: string,
  pkg?: { clearName?: string; technicalName?: string }
): boolean {
  if (!pkg) return false;
  const p = targetPlatform.toLowerCase().replace(/[\s\+\-_]/g, '');
  const clear = (pkg.clearName || '').toLowerCase().replace(/[\s\+\-_]/g, '');
  const tech = (pkg.technicalName || '').toLowerCase().replace(/[\s\+\-_]/g, '');

  if (p.includes('netflix') && (clear.includes('netflix') || tech.includes('netflix'))) {
    return true;
  }
  if (
    (p.includes('disney') || p.includes('disneyplus')) &&
    (clear.includes('disney') || tech.includes('disney'))
  ) {
    return true;
  }
  if (
    (p.includes('apple') || p.includes('itunes')) &&
    (clear.includes('apple') || tech.includes('apple') || tech.includes('itunes'))
  ) {
    return true;
  }
  if (
    (p.includes('prime') || p.includes('amazon')) &&
    (clear.includes('amazon') ||
      clear.includes('prime') ||
      tech.includes('amazon') ||
      tech.includes('prime'))
  ) {
    return true;
  }
  if (
    (p.includes('max') || p.includes('hbo')) &&
    (clear.includes('max') || clear.includes('hbo') || tech.includes('max') || tech.includes('hbo'))
  ) {
    return true;
  }
  if (p.includes('catchplay') && (clear.includes('catchplay') || tech.includes('catchplay'))) {
    return true;
  }
  if (p.includes('hami') && (clear.includes('hami') || tech.includes('hami'))) {
    return true;
  }
  if (p.includes('myvideo') && (clear.includes('myvideo') || tech.includes('myvideo'))) {
    return true;
  }
  if (p.includes('friday') && (clear.includes('friday') || tech.includes('friday'))) {
    return true;
  }
  if (
    (p.includes('linetv') || p.includes('line')) &&
    (clear.includes('linetv') || tech.includes('linetv'))
  ) {
    return true;
  }
  if (
    (p.includes('巴哈') || p.includes('動畫瘋') || p.includes('gamer') || p.includes('bahamut')) &&
    (clear.includes('bahamut') ||
      clear.includes('gamer') ||
      tech.includes('bahamut') ||
      tech.includes('gamer'))
  ) {
    return true;
  }
  if (
    (p.includes('iqiyi') || p.includes('愛奇藝') || p.includes('iq')) &&
    (clear.includes('iqiyi') || clear.includes('iq') || tech.includes('iqiyi') || tech.includes('iq'))
  ) {
    return true;
  }
  if (
    (p.includes('youtube') || p.includes('yt')) &&
    (clear.includes('youtube') ||
      tech.includes('youtube') ||
      clear.includes('googleplay') ||
      tech.includes('googleplay'))
  ) {
    return true;
  }

  return (
    clear.includes(p) ||
    tech.includes(p) ||
    p.includes(clear) ||
    p.includes(tech)
  );
}

/**
 * 極速向 JustWatch GraphQL 查詢作品直達頁面（設定 1.2 秒超時）
 */
async function queryJustWatchDirectUrl(
  platform: string,
  title: string
): Promise<string | null> {
  const query = `
    query GetSuggestedTitles($country: Country!, $filter: TitleFilter) {
      popularTitles(country: $country, filter: $filter) {
        edges {
          node {
            offers(country: $country, platform: WEB) {
              package {
                clearName
                technicalName
              }
              standardWebURL
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://apis.justwatch.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        query,
        variables: { country: 'TW', filter: { searchQuery: title } },
      }),
      signal: AbortSignal.timeout(1200),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const edges: JustWatchEdge[] = data.data?.popularTitles?.edges || [];

    // 檢查前 3 部最相關作品之 offers
    for (const edge of edges.slice(0, 3)) {
      const offers = edge.node?.offers || [];
      for (const offer of offers) {
        if (!offer.standardWebURL || !offer.package) continue;
        if (isPlatformMatch(platform, offer.package)) {
          if (offer.standardWebURL.startsWith('http')) {
            return offer.standardWebURL;
          }
        }
      }
    }
  } catch {
    // 逾時或連線失敗，直接忽略由外層進行 100% 備援
  }

  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const platform = (searchParams.get('platform') || '').trim();
  const rawTitle = (searchParams.get('title') || '').trim();
  const existingUrl = (searchParams.get('url') || searchParams.get('existingUrl') || '').trim();

  const cleanTitle = cleanMediaTitle(rawTitle) || rawTitle;

  // 1. 若已經附帶有效直達網址（且非 Google 搜尋），直接秒速跳轉
  if (
    existingUrl &&
    existingUrl.startsWith('http') &&
    !existingUrl.includes('google.com/search')
  ) {
    return NextResponse.redirect(existingUrl, 302);
  }

  // 2. 若有提供片名，嘗試在 1.2 秒內向 JustWatch 解析串流專屬作品頁
  if (cleanTitle && platform) {
    try {
      const directUrl = await queryJustWatchDirectUrl(platform, cleanTitle);
      if (directUrl) {
        return NextResponse.redirect(directUrl, 302);
      }
    } catch {
      // 異常時安全通過，進入備援
    }
  }

  // 3. 100% 安全備援：回退跳轉至該平台的官方搜尋頁或通用搜尋，確保零死連結、零白畫面
  const fallbackUrl = getStreamingPlatformUrl(platform, cleanTitle || rawTitle);
  return NextResponse.redirect(fallbackUrl, 302);
}
