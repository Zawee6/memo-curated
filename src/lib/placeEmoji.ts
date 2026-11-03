import { ParsedItem } from '@/types/item';

export function getPlaceEmoji(place: ParsedItem): string {
  const text = `${place.title} ${place.summary} ${place.tags?.join(' ') || ''}`.toLowerCase();
  if (text.includes('咖啡') || text.includes('cafe') || text.includes('甜點') || text.includes('下午茶')) return '☕';
  if (text.includes('拉麵') || text.includes('麵') || text.includes('飯') || text.includes('火鍋') || text.includes('燒肉') || text.includes('牛排') || text.includes('料理') || text.includes('餐廳') || text.includes('美食')) return '🍜';
  if (text.includes('酒') || text.includes('bar') || text.includes('調酒') || text.includes('居酒屋')) return '🍸';
  if (text.includes('飯店') || text.includes('民宿') || text.includes('住宿') || text.includes('hotel')) return '🏨';
  if (text.includes('公園') || text.includes('露營') || text.includes('山') || text.includes('海') || text.includes('步道') || text.includes('景點')) return '🏞️';
  if (text.includes('書') || text.includes('館') || text.includes('展覽') || text.includes('藝術')) return '🎨';
  return '📍';
}
