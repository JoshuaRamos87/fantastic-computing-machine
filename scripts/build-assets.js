const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const ASSETS_DIR = path.join(ROOT, 'assets');
const FONTS_DIR = path.join(ASSETS_DIR, 'fonts');
const FA_SVGS_DIR = path.join(ROOT, 'node_modules', '@fortawesome', 'fontawesome-free', 'svgs');
const INTER_WOFF2_SRC = path.join(
  ROOT,
  'node_modules',
  '@fontsource-variable',
  'inter',
  'files',
  'inter-latin-wght-normal.woff2'
);

fs.mkdirSync(FONTS_DIR, { recursive: true });

// 1. Copy self-hosted Inter variable font (latin subset)
const interDest = path.join(FONTS_DIR, 'inter-latin-wght-normal.woff2');
fs.copyFileSync(INTER_WOFF2_SRC, interDest);

// 2. Extract exact Font Awesome SVGs referenced in index.html into a tiny self-contained icons.css
const html = fs.readFileSync(HTML_PATH, 'utf8');
const styleIconRegex = /\bfa-(solid|regular|brands)\s+fa-([a-z0-9-]+)\b/g;
const iconPairs = new Map();

let match;
while ((match = styleIconRegex.exec(html)) !== null) {
  const style = match[1];
  const name = match[2];
  if (name === 'spin') continue;
  iconPairs.set(`${style}:${name}`, { style, name });
}

// Also catch reversed or multi-class patterns like `fa-solid fa-spin fa-spinner`
const genericFaRegex = /fa-(solid|regular|brands)[^"'`<>]*?\bfa-([a-z0-9-]+)\b/g;
while ((match = genericFaRegex.exec(html)) !== null) {
  const style = match[1];
  const name = match[2];
  if (name === 'spin' || name === 'solid' || name === 'regular' || name === 'brands') continue;
  iconPairs.set(`${style}:${name}`, { style, name });
}

function encodeSvgDataUri(svgText) {
  const cleaned = svgText
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
  return `data:image/svg+xml,${encodeURIComponent(cleaned)}`;
}

const cssRules = [
  '/* Auto-generated self-contained Font Awesome icon subset (zero external CDN requests) */',
  '.fa-solid,.fa-regular,.fa-brands{display:inline-block;width:1em;height:1em;vertical-align:-0.125em;background-color:currentColor;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;flex-shrink:0}',
  '@keyframes fa-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}',
  '.fa-spin{animation:fa-spin 1s linear infinite}',
];

const missing = [];
for (const { style, name } of [...iconPairs.values()].sort((a, b) =>
  `${a.style}:${a.name}`.localeCompare(`${b.style}:${b.name}`)
)) {
  const svgPath = path.join(FA_SVGS_DIR, style, `${name}.svg`);
  if (!fs.existsSync(svgPath)) {
    missing.push(`${style}/${name}`);
    continue;
  }
  const svg = fs.readFileSync(svgPath, 'utf8');
  const uri = encodeSvgDataUri(svg);
  cssRules.push(`.fa-${style}.fa-${name}{-webkit-mask-image:url("${uri}");mask-image:url("${uri}")}`);
}

if (missing.length > 0) {
  console.error('Missing Font Awesome SVGs:', missing.join(', '));
  process.exit(1);
}

const iconsCssPath = path.join(ASSETS_DIR, 'icons.css');
fs.writeFileSync(iconsCssPath, cssRules.join('\n') + '\n', 'utf8');

// 3. Compile minified Tailwind CSS into assets/styles.css
const tailwindCli = require.resolve('tailwindcss/lib/cli.js');
execFileSync(
  process.execPath,
  [tailwindCli, '-c', path.join(ROOT, 'tailwind.config.js'), '-i', path.join(ROOT, 'src', 'input.css'), '-o', path.join(ASSETS_DIR, 'styles.css'), '--minify'],
  { cwd: ROOT, stdio: 'inherit' }
);

const stylesSize = fs.statSync(path.join(ASSETS_DIR, 'styles.css')).size;
const iconsSize = fs.statSync(iconsCssPath).size;
const fontSize = fs.statSync(interDest).size;
console.log(
  `Built offline assets: styles.css (${(stylesSize / 1024).toFixed(1)} KB), icons.css (${(iconsSize / 1024).toFixed(1)} KB, ${iconPairs.size} icons), inter.woff2 (${(fontSize / 1024).toFixed(1)} KB)`
);
