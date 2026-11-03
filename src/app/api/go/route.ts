import { NextRequest, NextResponse } from 'next/server';


/**
 * 移除地址尾部的樓層資訊（如 2樓、1F、B1 等），避免 Google Maps 誤判搜尋數字
 */
function cleanFloorFromQuery(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s*(?:[0-9一二三四五六七八九十]+[樓Ff]|B[0-9]+).*/gi, '')
    .trim();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const isDir = searchParams.get('dir') === '1';

  // 1. 多點全程導航模式
  if (isDir) {
    const rawOrigin = searchParams.get('origin') || '';
    const rawDest = searchParams.get('dest') || searchParams.get('destination') || '';
    const rawWaypoints = searchParams.get('waypoints') || '';
    const travelmode = searchParams.get('travelmode') || 'driving';

    const origin = cleanFloorFromQuery(rawOrigin);
    const dest = cleanFloorFromQuery(rawDest);

    const waypoints = rawWaypoints
      .split('|')
      .map((w) => cleanFloorFromQuery(w))
      .filter(Boolean)
      .join('|');

    if (origin && dest) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
        origin
      )}&destination=${encodeURIComponent(dest)}${
        waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''
      }&travelmode=${travelmode}`;
      return NextResponse.redirect(url, 302);
    }
  }

  // 2. 單點地標搜尋模式
  const rawQ = searchParams.get('q') || '';
  if (rawQ.trim()) {
    const cleanQ = cleanFloorFromQuery(rawQ.trim());
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanQ)}`;
    return NextResponse.redirect(url, 302);
  }

  // 預設跳轉 Google Maps 首頁
  return NextResponse.redirect('https://www.google.com/maps', 302);
}
