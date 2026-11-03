// 台灣主要行政區/城市座標快取與 Fallback
export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  台北: { lat: 25.033, lng: 121.5654 },
  台北市: { lat: 25.033, lng: 121.5654 },
  新北: { lat: 25.0169, lng: 121.4627 },
  新北市: { lat: 25.0169, lng: 121.4627 },
  基隆: { lat: 25.1276, lng: 121.7392 },
  桃園: { lat: 24.9936, lng: 121.301 },
  新竹: { lat: 24.8138, lng: 120.9675 },
  苗栗: { lat: 24.5602, lng: 120.8214 },
  台中: { lat: 24.1477, lng: 120.6736 },
  台中市: { lat: 24.1477, lng: 120.6736 },
  彰化: { lat: 24.0518, lng: 120.5161 },
  南投: { lat: 23.9609, lng: 120.9718 },
  雲林: { lat: 23.7092, lng: 120.4313 },
  嘉義: { lat: 23.4801, lng: 120.4491 },
  台南: { lat: 22.9997, lng: 120.227 },
  台南市: { lat: 22.9997, lng: 120.227 },
  高雄: { lat: 22.6273, lng: 120.3014 },
  高雄市: { lat: 22.6273, lng: 120.3014 },
  屏東: { lat: 22.5519, lng: 120.5487 },
  宜蘭: { lat: 24.757, lng: 121.753 },
  花蓮: { lat: 23.9871, lng: 121.6015 },
  台東: { lat: 22.7583, lng: 121.1444 },
  澎湖: { lat: 23.5711, lng: 119.5793 },
  金門: { lat: 24.4492, lng: 118.3766 },
  東京: { lat: 35.6762, lng: 139.6503 },
  大阪: { lat: 34.6937, lng: 135.5023 },
  京都: { lat: 35.0116, lng: 135.7681 },
};

export function getFallbackCoordinates(
  cityOrAddress?: string,
  seed: string = ''
): { lat: number; lng: number } {
  let base = { lat: 25.033, lng: 121.5654 }; // 預設台北/台灣中心點
  if (cityOrAddress) {
    const trimmed = cityOrAddress.trim();
    for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
      if (trimmed.includes(key) || key.includes(trimmed)) {
        base = coords;
        break;
      }
    }
  }

  // 微小隨機偏移量 (約 ±200~600公尺)，確保多個地點不會在同一像素完全重疊
  const hash =
    seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) ||
    Math.floor(Math.random() * 100);
  const jitterLat = ((hash % 17) - 8) * 0.0022;
  const jitterLng = (((hash * 7) % 19) - 9) * 0.0022;

  return {
    lat: Number((base.lat + jitterLat).toFixed(6)),
    lng: Number((base.lng + jitterLng).toFixed(6)),
  };
}
