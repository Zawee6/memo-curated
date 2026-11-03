import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// 精品級 Editorial 雜誌風 × 深曜石黑與赤陶暖金向量圖示
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- 深曜石黑奢華漸層基底 -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1C1B19" />
      <stop offset="50%" stop-color="#141413" />
      <stop offset="100%" stop-color="#0C0B0A" />
    </linearGradient>

    <!-- 頂部環境赤陶暖金微光暈 -->
    <radialGradient id="ambientGlow" cx="50%" cy="28%" r="65%">
      <stop offset="0%" stop-color="#D97757" stop-opacity="0.22" />
      <stop offset="60%" stop-color="#D97757" stop-opacity="0.04" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- 頂級精品高光內邊框 (Hairline Inset Stroke) -->
    <linearGradient id="borderGrad" x1="15%" y1="0%" x2="85%" y2="100%">
      <stop offset="0%" stop-color="#F5F2EB" stop-opacity="0.32" />
      <stop offset="45%" stop-color="#D97757" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#F5F2EB" stop-opacity="0.08" />
    </linearGradient>

    <!-- 書籤溫潤暖象牙白漸層 -->
    <linearGradient id="bookmarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCFAF7" />
      <stop offset="60%" stop-color="#F5F2EB" />
      <stop offset="100%" stop-color="#ECE7DD" />
    </linearGradient>

    <!-- 星芒羅盤赤陶暖金漸層 -->
    <linearGradient id="terracottaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E88B6E" />
      <stop offset="50%" stop-color="#D97757" />
      <stop offset="100%" stop-color="#B85D3E" />
    </linearGradient>

    <!-- 星芒亮眼暖金漸層 -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCE1A8" />
      <stop offset="50%" stop-color="#E5AA52" />
      <stop offset="100%" stop-color="#C98832" />
    </linearGradient>

    <!-- 柔和高級浮雕陰影 -->
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.55" />
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.35" />
    </filter>

    <filter id="compassGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#D97757" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- 1. 背景圓角方塊 (iOS 標準 Squircle 比例 rx=116) -->
  <rect width="512" height="512" rx="116" fill="url(#bgGrad)" />
  <rect width="512" height="512" rx="116" fill="url(#ambientGlow)" />

  <!-- 2. 精品高光內邊框 (Inset 4px) -->
  <rect x="4" y="4" width="504" height="504" rx="112" fill="none" stroke="url(#borderGrad)" stroke-width="2.5" />

  <!-- 3. 中央微光底環 (羅盤緯度幾何細線) -->
  <circle cx="256" cy="248" r="148" fill="none" stroke="#D97757" stroke-opacity="0.16" stroke-width="1.5" stroke-dasharray="4 6" />
  <circle cx="256" cy="248" r="172" fill="none" stroke="#F5F2EB" stroke-opacity="0.08" stroke-width="1" />

  <!-- 4. 主體圖騰群組 (含立體陰影) -->
  <g filter="url(#softShadow)">
    <!-- 靈感書籤 Ribbon (精緻現代幾何版型，頂部平滑圓角，底部經典燕尾切角) -->
    <path
      d="M168 116 
         C168 106 176 98 186 98 
         L326 98 
         C336 98 344 106 344 116 
         L344 388 
         L256 328 
         L168 388 
         Z"
      fill="url(#bookmarkGrad)"
    />

    <!-- 書籤頂部細緻縫線/裝飾金線 -->
    <line x1="184" y1="112" x2="328" y2="112" stroke="#D97757" stroke-opacity="0.4" stroke-width="2" stroke-linecap="round" />

    <!-- 5. 羅盤星芒核心 (幾何 8 芒羅盤星 × AI 靈感閃芒) -->
    <g transform="translate(256, 224)" filter="url(#compassGlow)">
      <!-- 羅盤外圍精密刻度圓環 -->
      <circle cx="0" cy="0" r="54" fill="none" stroke="#D97757" stroke-opacity="0.35" stroke-width="1.5" />
      <circle cx="0" cy="0" r="50" fill="none" stroke="#141413" stroke-opacity="0.1" stroke-width="1" />

      <!-- 四向微刻度點 (N, S, E, W) -->
      <circle cx="0" cy="-54" r="2.5" fill="#D97757" />
      <circle cx="0" cy="54" r="2.5" fill="#D97757" />
      <circle cx="-54" cy="0" r="2.5" fill="#D97757" />
      <circle cx="54" cy="0" r="2.5" fill="#D97757" />

      <!-- 8 芒星芒 (4 主芒 + 4 次芒立體交錯) -->
      <!-- 次向菱形芒 (NE, NW, SE, SW，深曜石灰) -->
      <g transform="rotate(45)">
        <polygon points="0,-42 7,-8 34,0 7,8 0,42 -7,8 -34,0 -7,-8" fill="#2E2C29" />
      </g>

      <!-- 主向立體羅盤芒 (N, S, E, W，赤陶暖金 × 亮金色立體分色切面) -->
      <!-- 正北鋒芒 -->
      <polygon points="0,-58 10,-9 0,0" fill="url(#goldGrad)" />
      <polygon points="0,-58 -10,-9 0,0" fill="url(#terracottaGrad)" />

      <!-- 正南鋒芒 -->
      <polygon points="0,58 -10,9 0,0" fill="url(#goldGrad)" />
      <polygon points="0,58 10,9 0,0" fill="url(#terracottaGrad)" />

      <!-- 正東鋒芒 -->
      <polygon points="58,0 9,10 0,0" fill="url(#goldGrad)" />
      <polygon points="58,0 9,-10 0,0" fill="url(#terracottaGrad)" />

      <!-- 正西鋒芒 -->
      <polygon points="-58,0 -9,-10 0,0" fill="url(#goldGrad)" />
      <polygon points="-58,0 -9,10 0,0" fill="url(#terracottaGrad)" />

      <!-- 核心星芒閃爍鑽心 (Pure Diamond Sparkle) -->
      <circle cx="0" cy="0" r="8.5" fill="#FAF8F5" />
      <circle cx="0" cy="0" r="4.5" fill="#D97757" />
      <circle cx="0" cy="0" r="2" fill="#FFFFFF" />
    </g>

    <!-- 書籤底部精美微小幾何記號 (Editorial 點綴) -->
    <g transform="translate(256, 316)">
      <circle cx="0" cy="0" r="2" fill="#D97757" fill-opacity="0.6" />
      <line x1="-12" y1="0" x2="-4" y2="0" stroke="#D97757" stroke-opacity="0.4" stroke-width="1" />
      <line x1="4" y1="0" x2="12" y2="0" stroke="#D97757" stroke-opacity="0.4" stroke-width="1" />
    </g>
  </g>
</svg>`;

async function generate() {
  console.log('🎨 [Memo Icon] 正在生成精品級 Web App 圖示...');

  // 1. 寫入 public/icon.svg
  const svgPath = path.join(publicDir, 'icon.svg');
  fs.writeFileSync(svgPath, svgContent, 'utf-8');
  console.log('✅ 已生成向量檔: public/icon.svg');

  const svgBuffer = Buffer.from(svgContent);

  // 2. 生成 iOS 專用 180x180 apple-touch-icon.png
  await sharp(svgBuffer)
    .resize(180, 180)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✅ 已生成 iOS 圖示: public/apple-touch-icon.png (180x180)');

  // 3. 生成 PWA 專用 192x192 icon-192.png
  await sharp(svgBuffer)
    .resize(192, 192)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✅ 已生成 PWA 圖示: public/icon-192.png (192x192)');

  // 4. 生成 PWA 高清 512x512 icon-512.png
  await sharp(svgBuffer)
    .resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✅ 已生成 PWA 高清圖示: public/icon-512.png (512x512)');

  console.log('🎉 所有精品級圖示已順利產出！');
}

generate().catch((err) => {
  console.error('❌ 圖示生成失敗:', err);
  process.exit(1);
});
