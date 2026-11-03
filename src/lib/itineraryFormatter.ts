import { ItineraryPlan, TransportMode } from '@/types/item';

export function cleanFloor(text: string): string {
  if (!text) return '';
  return text.replace(/\s*(?:[0-9一二三四五六七八九十]+[樓Ff]|B[0-9]+).*/gi, '').trim();
}

export function mapToGoogleTravelMode(mode?: TransportMode): string {
  switch (mode) {
    case 'driving':
      return 'driving';
    case 'two-wheeler':
      return 'bicycling';
    case 'transit':
      return 'transit';
    case 'walking':
      return 'walking';
    default:
      return 'driving';
  }
}

export function buildGoogleMapsMultiStopUrl(
  stops: ItineraryPlan['stops'],
  city: string = '',
  transportMode?: TransportMode
): string {
  if (!stops || stops.length === 0) return '';
  const segs = stops.map((s) => {
    if (s.lat != null && s.lng != null && !isNaN(s.lat) && !isNaN(s.lng)) {
      return `${s.lat},${s.lng}`;
    }
    return encodeURIComponent(cleanFloor(`${s.placeName} ${city}`.trim()));
  });
  const mode = mapToGoogleTravelMode(transportMode);
  return `https://www.google.com/maps/dir//${segs.join('/')}?travelmode=${mode}`;
}

export function buildGoogleMapsSingleStopUrl(
  stop: ItineraryPlan['stops'][0],
  city: string = ''
): string {
  if (stop.lat != null && stop.lng != null && !isNaN(stop.lat) && !isNaN(stop.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`;
  }
  const cleanName = cleanFloor(stop.placeName);
  const cleanCity = cleanFloor(city);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cleanName} ${cleanCity}`.trim())}`;
}

export function buildSegmentDirectionUrl(
  fromStop: ItineraryPlan['stops'][0],
  toStop: ItineraryPlan['stops'][0],
  transportMode?: TransportMode,
  city: string = ''
): string {
  const origin =
    fromStop.lat != null && fromStop.lng != null && !isNaN(fromStop.lat) && !isNaN(fromStop.lng)
      ? `${fromStop.lat},${fromStop.lng}`
      : cleanFloor(`${fromStop.placeName} ${city}`.trim());
  const destination =
    toStop.lat != null && toStop.lng != null && !isNaN(toStop.lat) && !isNaN(toStop.lng)
      ? `${toStop.lat},${toStop.lng}`
      : cleanFloor(`${toStop.placeName} ${city}`.trim());
  const mode = mapToGoogleTravelMode(transportMode);
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    origin
  )}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
}

export function generateItineraryExportText(plan: ItineraryPlan): string {
  const city = plan.city || '城市探索';
  const stops = plan.stops || [];
  const count = stops.length;
  const modeLabels: Record<TransportMode, string> = {
    driving: '🚗 開車',
    'two-wheeler': '🛵 騎機車',
    transit: '🚌 大眾運輸',
    walking: '🚶 步行漫遊',
  };
  const modeText = plan.transportMode ? modeLabels[plan.transportMode] || plan.transportMode : '🛵 騎機車';
  const departureText = plan.departureTime ? `⏰ 出發時間：${plan.departureTime}` : '';

  const fullNavUrl = buildGoogleMapsMultiStopUrl(stops, city, plan.transportMode);

  const lines: string[] = [
    `🗺️ Memo 順路行程｜${plan.title || `${city}一日遊`}`,
    `📍 探訪城市：${city}（共 ${count} 處地點）`,
    `🚀 交通方式：${modeText}${departureText ? ` ｜ ${departureText}` : ''}`,
    fullNavUrl ? `🗺️ 全程多點導航：${fullNavUrl}` : '',
    '',
    '【一日動線概述】',
    plan.dayOverview || '',
    '',
    '──────────────────',
    '【時間軸詳細行程】',
    '',
  ];

  stops.forEach((stop, idx) => {
    const singleNavUrl = stop.placeMapUrl || buildGoogleMapsSingleStopUrl(stop, city);
    const stopNumber = idx + 1;
    const durationText = stop.stayDuration ? `（停留 ${stop.stayDuration}）` : '';
    lines.push(`📍 第 ${stopNumber} 站 ｜ ${stop.timeSlot} ${durationText}`);
    lines.push(`🏠 地點：${stop.placeName}`);
    if (stop.address) lines.push(`📮 地址：${stop.address}`);
    if (stop.whatToDo) lines.push(`🍽️ 必吃必訪：${stop.whatToDo}`);
    else if (stop.activity) lines.push(`✨ 活動行程：${stop.activity}`);

    if (stop.parkingName) {
      const parkUrl =
        stop.parkingMapUrl ||
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city} ${stop.parkingName}`)}`;
      const note = stop.parkingNote ? ` (${stop.parkingNote})` : '';
      lines.push(`🅿️ 推薦停車：${stop.parkingName}${note}`);
      lines.push(`🔗 停車場導航：${parkUrl}`);
    } else if (stop.parkingInfo) {
      lines.push(`🅿️ 附近停車建議：${stop.parkingInfo}`);
    }

    if (stop.transitDetail) lines.push(`🚆 大眾運輸搭乘：${stop.transitDetail}`);
    if (stop.tips) lines.push(`💡 貼心提醒：${stop.tips}`);
    lines.push(`🔗 單站導航：${singleNavUrl}`);

    if (idx < stops.length - 1 && (stop.transitToNext || stop.transitSuggestion)) {
      const nextStop = stops[idx + 1];
      const segmentNavUrl = buildSegmentDirectionUrl(stop, nextStop, plan.transportMode, city);
      lines.push('');
      lines.push(`⬇️ ${modeText}前往下一站：${stop.transitToNext || stop.transitSuggestion}`);
      if (segmentNavUrl) lines.push(`🧭 單段導航：${segmentNavUrl}`);
    }
    lines.push('');
  });

  lines.push('──────────────────');
  lines.push('由 Memo AI 智慧助理精心規劃 🪄');

  return lines.filter((l) => l !== undefined).join('\n').trim();
}

/**
 * 產生匯出至 Apple 備忘錄的高相容性 HTML 富文本 (含可點擊藍色超連結)
 */
export function generateItineraryExportHtml(plan: ItineraryPlan): string {
  const city = plan.city || '城市探索';
  const stops = plan.stops || [];
  const count = stops.length;
  const modeLabels: Record<TransportMode, string> = {
    driving: '🚗 開車',
    'two-wheeler': '🛵 騎機車',
    transit: '🚌 大眾運輸',
    walking: '🚶 步行漫遊',
  };
  const modeText = plan.transportMode ? modeLabels[plan.transportMode] || plan.transportMode : '🛵 騎機車';
  const departureText = plan.departureTime ? ` ｜ ⏰ 出發時間：${plan.departureTime}` : '';
  const fullNavUrl = buildGoogleMapsMultiStopUrl(stops, city, plan.transportMode);

  const stopsHtml = stops
    .map((stop, idx) => {
      const singleNavUrl = stop.placeMapUrl || buildGoogleMapsSingleStopUrl(stop, city);
      const stopNumber = idx + 1;
      const durationText = stop.stayDuration ? ` <span style="color: #b45309;">(停留 ${stop.stayDuration})</span>` : '';

      let parkingHtml = '';
      if (stop.parkingName) {
        const parkUrl =
          stop.parkingMapUrl ||
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city} ${stop.parkingName}`)}`;
        const note = stop.parkingNote ? ` <span style="color: #78716c;">(${stop.parkingNote})</span>` : '';
        parkingHtml = `<p style="margin: 3px 0;">🅿️ <strong>推薦停車：</strong><a href="${parkUrl}" style="color: #2563eb; text-decoration: underline; font-weight: bold;">${stop.parkingName}</a>${note}</p>`;
      } else if (stop.parkingInfo) {
        parkingHtml = `<p style="margin: 3px 0;">🅿️ <strong>停車建議：</strong>${stop.parkingInfo}</p>`;
      }

      let nextTransitHtml = '';
      if (idx < stops.length - 1 && (stop.transitToNext || stop.transitSuggestion)) {
        const nextStop = stops[idx + 1];
        const segmentNavUrl = buildSegmentDirectionUrl(stop, nextStop, plan.transportMode, city);
        nextTransitHtml = `
          <div style="margin-top: 10px; padding: 8px 12px; background: #ecfdf5; border-radius: 6px; font-size: 13px;">
            <p style="margin: 0; color: #047857;">⬇️ <strong>${modeText}前往下一站：</strong>${stop.transitToNext || stop.transitSuggestion}</p>
            ${segmentNavUrl ? `<p style="margin: 4px 0 0;"><a href="${segmentNavUrl}" style="color: #2563eb; text-decoration: underline;">🧭 開啟 Google Maps 單段導航 ↗</a></p>` : ''}
          </div>
        `;
      }

      return `
        <div style="margin-bottom: 20px; padding: 12px 14px; background: #fdfdfc; border: 1px solid #e7e5e4; border-radius: 10px;">
          <h3 style="margin: 0 0 6px 0; font-size: 15px; color: #0f172a;">
            📍 第 ${stopNumber} 站 ｜ ${stop.timeSlot}${durationText}
          </h3>
          <p style="margin: 3px 0; font-size: 14px;">
            🏠 <strong>地點：</strong><a href="${singleNavUrl}" style="color: #2563eb; text-decoration: underline; font-weight: bold;">${stop.placeName}</a>
          </p>
          ${stop.address ? `<p style="margin: 3px 0; font-size: 13px; color: #57534e;">📮 地址：<a href="${singleNavUrl}" style="color: #2563eb; text-decoration: none;">${stop.address}</a></p>` : ''}
          ${stop.whatToDo ? `<p style="margin: 3px 0; font-size: 13px;">🍽️ <strong>必吃必訪：</strong>${stop.whatToDo}</p>` : ''}
          ${parkingHtml}
          ${stop.transitDetail ? `<p style="margin: 3px 0; font-size: 13px;">🚆 <strong>大眾運輸：</strong>${stop.transitDetail}</p>` : ''}
          ${stop.tips ? `<p style="margin: 3px 0; font-size: 13px; color: #b45309;">💡 <strong>貼心提醒：</strong>${stop.tips}</p>` : ''}
          <p style="margin: 6px 0 0; font-size: 12px;">
            <a href="${singleNavUrl}" style="color: #2563eb; text-decoration: underline;">🔗 Google Maps 定位導航 ↗</a>
          </p>
          ${nextTransitHtml}
        </div>
      `;
    })
    .join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1c1917; max-width: 600px;">
      <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #1c1917;">
        🗺️ Memo 順路行程 ｜ ${plan.title || `${city}順路一日遊`}
      </h2>
      <p style="margin: 3px 0; font-size: 13px; color: #57534e;">
        📍 探訪城市：<strong>${city}</strong>（共 ${count} 處地點）
      </p>
      <p style="margin: 3px 0; font-size: 13px; color: #57534e;">
        🚀 交通方式：${modeText}${departureText}
      </p>
      ${fullNavUrl ? `<p style="margin: 8px 0;"><a href="${fullNavUrl}" style="display: inline-block; padding: 6px 12px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px;">🗺️ 開啟 Google Maps 全程多點路線導航 ↗</a></p>` : ''}

      <div style="margin: 14px 0; padding: 12px; background: #f5f5f4; border-radius: 8px;">
        <strong style="font-size: 13px; color: #292524;">【一日動線概述】</strong>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #44403c;">${plan.dayOverview || ''}</p>
      </div>

      <div style="margin-top: 16px;">
        ${stopsHtml}
      </div>

      <p style="margin-top: 16px; font-size: 12px; color: #a8a29e; text-align: center;">
        由 Memo AI 智慧助理精心規劃 🪄
      </p>
    </div>
  `.trim();
}

/**
 * 將 HTML 富文本與純文字同步寫入剪貼簿，
 * 貼至 Apple 備忘錄或支援 Rich Text 的編輯器時保留藍色可點擊超連結
 */
export async function writeRichTextToClipboard(html: string, plainText: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return false;
  }

  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText,
      });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch (err) {
    console.warn('ClipboardItem rich text write failed, fallback to plain text:', err);
  }

  try {
    await navigator.clipboard.writeText(plainText);
    return true;
  } catch (err) {
    console.error('Clipboard writeText fallback failed:', err);
    return false;
  }
}
