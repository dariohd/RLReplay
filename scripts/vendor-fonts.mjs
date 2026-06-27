/**
 * Usage: node scripts/vendor-fonts.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const fontsDir = join(root, 'fonts');

const SPEC = {
  cssUrl:
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@800;900&display=swap',
  files: [
    { file: 'inter-400.woff2', family: 'Inter', weight: 400, style: 'normal' },
    { file: 'inter-600.woff2', family: 'Inter', weight: 600, style: 'normal' },
    { file: 'inter-700.woff2', family: 'Inter', weight: 700, style: 'normal' },
    { file: 'outfit-800.woff2', family: 'Outfit', weight: 800, style: 'normal' },
    { file: 'outfit-900.woff2', family: 'Outfit', weight: 900, style: 'normal' },
  ],
};

async function fetchCss(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`CSS fetch failed: ${res.status}`);
  return res.text();
}

function extractWoff2Urls(css) {
  return [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g)].map((m) => m[1]);
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font download failed ${url}: ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  await mkdir(fontsDir, { recursive: true });
  const css = await fetchCss(SPEC.cssUrl);
  const urls = extractWoff2Urls(css);
  if (urls.length < SPEC.files.length) {
    throw new Error(`Expected ${SPEC.files.length} woff2 URLs, got ${urls.length}`);
  }
  for (let i = 0; i < SPEC.files.length; i++) {
    await download(urls[i], join(fontsDir, SPEC.files[i].file));
    console.log('OK', SPEC.files[i].file);
  }
  const faceRules = SPEC.files
    .map(
      (f) => `@font-face {
  font-family: '${f.family}';
  font-style: ${f.style};
  font-weight: ${f.weight};
  font-display: swap;
  src: url('/fonts/${f.file}') format('woff2');
}`
    )
    .join('\n\n');
  await writeFile(join(fontsDir, 'fonts.css'), `${faceRules}\n`);
  console.log('Wrote fonts/fonts.css');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
