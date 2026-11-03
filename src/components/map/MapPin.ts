import L from 'leaflet';

export function createEditorialPinIcon(
  title: string,
  emoji: string,
  isActive: boolean = false
) {
  const shortTitle = title.length > 9 ? title.slice(0, 8) + '…' : title;

  return L.divIcon({
    className: 'custom-editorial-pin',
    html: `
      <div class="relative flex flex-col items-center cursor-pointer select-none transition-all duration-200 ${
        isActive ? 'scale-110 z-50' : 'hover:scale-105'
      }">
        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-float border backdrop-blur-md whitespace-nowrap ${
          isActive
            ? 'bg-[#C8553D] text-white border-white ring-2 ring-[#C8553D]/40 font-bold shadow-lg'
            : 'bg-[#FAF9F6] text-[#111111] border-[rgba(17,17,17,0.12)] font-semibold hover:border-[#C8553D]'
        }">
          <span class="text-xs leading-none">${emoji}</span>
          <span class="text-xs leading-none tracking-tight">${shortTitle}</span>
        </div>
        <div class="w-2 h-2 -mt-0.5 rotate-45 ${
          isActive
            ? 'bg-[#C8553D] border-r border-b border-white'
            : 'bg-[#FAF9F6] border-r border-b border-[rgba(17,17,17,0.12)]'
        }"></div>
      </div>
    `,
    iconSize: [110, 32],
    iconAnchor: [55, 32],
    popupAnchor: [0, -34],
  });
}
