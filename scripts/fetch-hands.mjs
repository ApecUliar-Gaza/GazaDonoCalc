// Runs on Netlify at build time. Downloads the free hands photo into public/img/hands.jpg
// so the site serves it itself (no third-party request from visitors).
// Photo: "Close up cupped hands" by Samantha Hurley, Burst by Shopify.
// Licence: free for commercial use, no attribution required:
// https://www.shopify.com/stock-photos/licenses/shopify-some-rights-reserved
// To use a different photo, put it at public/img/hands.jpg and this script leaves it alone.
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../public/img/hands.jpg', import.meta.url);
const SRC = process.env.HANDS_PHOTO_URL ||
  'https://burst.shopifycdn.com/photos/close-up-cupped-hands.jpg?width=1200&format=pjpg&exif=0&iptc=0';

if (existsSync(OUT)) {
  console.log('hands photo already present, skipping download');
} else {
  try {
    const res = await fetch(SRC);
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) throw new Error(`HTTP ${res.status} ${type}`);
    mkdirSync(new URL('../public/img/', import.meta.url), { recursive: true });
    writeFileSync(OUT, Buffer.from(await res.arrayBuffer()));
    console.log('hands photo downloaded');
  } catch (err) {
    // The site falls back to the drawn hands if the photo is missing.
    console.warn('could not download hands photo:', err.message);
  }
}
