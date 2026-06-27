/**
 * Usage: node scripts/vendor-fonts.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const fontsDir = join(root, 'fonts');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const faces = [
  { file: 'inter-400.woff2', family: 'Inter', weight: 400, style: 'normal' },
  { file: 'inter-600.woff2', family: 'Inter', weight: 600, style: 'normal' },
  { file: 'inter-700.woff2', family: 'Inter', weight: 700, style: 'normal' },
  { file: 'outfit-800.woff2', family: 'Outfit', weight: 800, style: 'normal' },
  { file: 'outfit-900.woff2', family: 'Outfit', weight: 900, style: 'normal' },
];

function parseFontFaces(css) {
  const blocks = [];
  for (const part of css.split('@font-face').slice(1)) {
    const family = part.match(/font-family:\s*'([^']+)'/)?.[1];
    const weight = part.match(/font-weight:\s*(\d+)/)?.[1];
    const style = part.match(/font-style:\s*(\w+)/)?.[1] || 'normal';
    const url = part.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)?.[1];
    const range = part.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim() || '';
    if (family && weight && url) blocks.push({ family, weight: Number(weight), style, url, range });
  }
  return blocks;
}

function pickUrl(blocks, face) {
  const matches = blocks.filter(
    (b) => b.family === face.family && b.weight === face.weight && b.style === face.style
  );
  return (matches.find((b) => b.range.includes('U+0100-02BA')) || matches.find((b) => b.range.includes('U+0000-00FF')))?.url;
}

async function main() {
  await mkdir(fontsDir, { recursive: true });
  const cssUrl =
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Outfit:wght@800;900&display=swap';
  const css = await (await fetch(cssUrl, { headers: { 'User-Agent': UA } })).text();
  const blocks = parseFontFaces(css);
  for (const face of faces) {
    const url = pickUrl(blocks, face);
    if (!url) throw new Error(`No URL for ${face.family} ${face.weight}`);
    const res = await fetch(url);
    await writeFile(join(fontsDir, face.file), Buffer.from(await res.arrayBuffer()));
    console.log('OK', face.file);
  }
  const cssOut = faces
    .map(
      (f) => `@font-face {
  font-family: '${f.family}';
  font-style: ${f.style};
  font-weight: ${f.weight};
  font-display: swap;
  src: url('/fonts/${f.file}') format('woff2');
  unicode-range: U+0000-00FF, U+0100-02BA, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}`
    )
    .join('\n\n');
  await writeFile(join(fontsDir, 'fonts.css'), `${cssOut}\n`);
  console.log('Wrote fonts/fonts.css');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
