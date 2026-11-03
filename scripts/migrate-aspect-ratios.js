const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '.data', 'db.json');

function extractYouTubeVideoId(url) {
  if (!url) return null;
  const match = url.match(
    /(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : null;
}

function getSourceAspectRatio(url) {
  if (!url) return '9:16';
  const lower = url.toLowerCase();
  if (
    lower.includes('/shorts/') ||
    lower.includes('instagram.com/reel') ||
    lower.includes('instagram.com/p/') ||
    lower.includes('tiktok.com')
  ) {
    return '9:16';
  }
  if (
    (lower.includes('youtube.com/watch') ||
      lower.includes('youtube.com/embed') ||
      lower.includes('youtu.be/')) &&
    !lower.includes('/shorts/')
  ) {
    return '16:9';
  }
  return '9:16';
}

function migrate() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('db.json not found at', DB_PATH);
    return;
  }

  const raw = fs.readFileSync(DB_PATH, 'utf8');
  let data = JSON.parse(raw);
  const items = Array.isArray(data) ? data : data.items || [];

  console.log(`Starting migration for ${items.length} items...`);

  for (const item of items) {
    // 1. 修正 item 本身的 aspectRatio
    if (item.category === 'media') {
      item.aspectRatio = '27:40';
    } else {
      item.aspectRatio = getSourceAspectRatio(item.url);
    }

    // 2. 修正 sources 中的每一筆來源
    if (Array.isArray(item.sources)) {
      for (const src of item.sources) {
        src.aspectRatio = getSourceAspectRatio(src.url);

        // 確保 YouTube 來源的縮圖是原始 YouTube 縮圖，絕不被電影海報覆蓋
        const ytId = extractYouTubeVideoId(src.url);
        if (ytId) {
          if (!src.thumbnailUrl || src.thumbnailUrl.startsWith('/posters/')) {
            const isShorts = (src.url || '').toLowerCase().includes('/shorts/');
            src.thumbnailUrl = isShorts
              ? `https://i.ytimg.com/vi/${ytId}/oar2.jpg`
              : `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`;
            console.log(`[Fixed source thumbnail] ${src.title} -> ${src.thumbnailUrl}`);
          }
        }
      }
    } else if (item.category === 'media') {
      // 若為電影但尚未有 sources 陣列，自動建立原始來源
      const ytId = extractYouTubeVideoId(item.url);
      item.sources = [
        {
          id: `src_migrated_${item.id}`,
          url: item.url,
          title: item.title,
          summary: item.summary,
          thumbnailUrl: ytId
            ? `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`
            : item.thumbnailUrl,
          aspectRatio: getSourceAspectRatio(item.url),
          addedAt: '2026-10-18',
        },
      ];
    }
  }

  const output = Array.isArray(data) ? items : { ...data, items };
  fs.writeFileSync(DB_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log('✅ Migration completed successfully!');

  // Print summary
  console.log(
    items.map((i) => ({
      id: i.id,
      title: i.title,
      category: i.category,
      itemAspect: i.aspectRatio,
      sources: i.sources?.map((s) => ({
        url: s.url,
        title: s.title,
        aspectRatio: s.aspectRatio,
        thumbnailUrl: s.thumbnailUrl,
      })),
    }))
  );
}

migrate();
