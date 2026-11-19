const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('@playwright/test');
const { APP_URL_PATH } = require('./app-path');

const TINY_MP4 = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'tiny.mp4'));
const TINY_PNG = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'tiny.png'));

/**
 * Lightweight Tailwind-compatible stub loaded when intercepting external CDNs
 * so tests run deterministically offline with accurate visibility & responsive layout.
 */
const TAILWIND_STUB_JS = `
window.tailwind = window.tailwind || {};
(function () {
  var style = document.createElement('style');
  style.id = 'pw-tailwind-stub';
  style.textContent = [
    '*, *::before, *::after { box-sizing: border-box; }',
    'html, body { margin: 0; padding: 0; max-width: 100%; }',
    '.hidden { display: none !important; }',
    '.invisible { visibility: hidden !important; }',
    '.opacity-0 { opacity: 0; }',
    '.opacity-100 { opacity: 1; }',
    '.flex { display: flex; }',
    '.inline-flex { display: inline-flex; }',
    '.grid { display: grid; }',
    '.block { display: block; }',
    '.fixed { position: fixed; }',
    '.absolute { position: absolute; }',
    '.relative { position: relative; }',
    '.sticky { position: sticky; }',
    '.inset-0 { top: 0; right: 0; bottom: 0; left: 0; }',
    '.w-full { width: 100%; }',
    '.min-w-0 { min-width: 0; }',
    '.max-w-3xl { max-width: 48rem; }',
    '.max-w-md { max-width: 28rem; }',
    '.max-w-\\\\[260px\\\\] { max-width: 260px; }',
    '.max-w-\\\\[92vw\\\\] { max-width: 92vw; }',
    '.overflow-hidden { overflow: hidden; }',
    '.overflow-x-auto { overflow-x: auto; }',
    '.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.flex-wrap { flex-wrap: wrap; }',
    '.flex-col { flex-direction: column; }',
    '.items-center { align-items: center; }',
    '.justify-between { justify-content: space-between; }',
    '.justify-center { justify-content: center; }',
    '.pointer-events-none { pointer-events: none; }',
    'img, video { max-width: 100%; }',
    '@media (min-width: 640px) {',
    '  .sm\\\\:hidden { display: none !important; }',
    '  .sm\\\\:inline { display: inline !important; }',
    '  .sm\\\\:inline-flex { display: inline-flex !important; }',
    '  .sm\\\\:flex-row { flex-direction: row; }',
    '}',
    '@media (min-width: 768px) {',
    '  .md\\\\:flex-row { flex-direction: row; }',
    '}'
  ].join('\\n');
  document.head.appendChild(style);
})();
`;

/**
 * Intercepts third-party CDN assets (Tailwind, Google Fonts, Font Awesome)
 * so tests run fast and offline without flaking on external servers.
 */
async function stubExternalCdns(page) {
  await page.route('https://cdn.tailwindcss.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: TAILWIND_STUB_JS,
    })
  );
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );
  await page.route('https://fonts.gstatic.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'font/woff2', body: '' })
  );
  await page.route('https://cdnjs.cloudflare.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );
}

/**
 * Installs default mock routes for Twitter media CDN assets (MP4 + PNG)
 * and customizable FxTwitter / VxTwitter API handlers.
 */
async function setupMockNetwork(page, options = {}) {
  const {
    fxHandler,
    vxHandler,
    mp4Handler,
    imageHandler,
    includeCdnStubs = true,
  } = options;

  if (includeCdnStubs) {
    await stubExternalCdns(page);
  }

  // Mock FxTwitter API
  await page.route('https://api.fxtwitter.com/**', async (route) => {
    if (fxHandler) {
      await fxHandler(route);
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 404 }) });
  });

  // Mock VxTwitter API
  await page.route('https://api.vxtwitter.com/**', async (route) => {
    if (vxHandler) {
      await vxHandler(route);
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
  });

  // Mock Twitter video CDN (supports HEAD, Range, and GET)
  await page.route('https://video.twimg.com/**', async (route) => {
    if (mp4Handler) {
      await mp4Handler(route);
      return;
    }
    const req = route.request();
    const method = req.method();
    const rangeHeader = req.headers()['range'];

    if (req.url().includes('.m3u8')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/vnd.apple.mpegurl',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '#EXTM3U\n#EXT-X-VERSION:3\n',
      });
      return;
    }

    if (method === 'HEAD') {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(TINY_MP4.length),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
        },
      });
      return;
    }

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      const start = match ? parseInt(match[1], 10) : 0;
      const end = match && match[2] ? Math.min(parseInt(match[2], 10), TINY_MP4.length - 1) : TINY_MP4.length - 1;
      const slice = TINY_MP4.subarray(start, end + 1);
      await route.fulfill({
        status: 206,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(slice.length),
          'Content-Range': `bytes ${start}-${end}/${TINY_MP4.length}`,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
        },
        body: slice,
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(TINY_MP4.length),
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
      },
      body: TINY_MP4,
    });
  });

  // Mock Twitter image CDN (avatars, thumbnails, photos)
  await page.route('https://pbs.twimg.com/**', async (route) => {
    if (imageHandler) {
      await imageHandler(route);
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(TINY_PNG.length),
        'Access-Control-Allow-Origin': '*',
      },
      body: TINY_PNG,
    });
  });
}

/**
 * Extended Playwright test fixture that automatically asserts zero uncaught page errors.
 */
const test = base.extend({
  pageErrors: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err));
    await use(errors);
    expect(errors, `Uncaught page errors: ${errors.map((e) => e.message).join('; ')}`).toEqual([]);
  },
  appPage: async ({ page, pageErrors }, use) => {
    void pageErrors;
    await use(page);
  },
});

async function gotoApp(page, query = '') {
  const url = query ? `${APP_URL_PATH}${query.startsWith('?') ? query : `?${query}`}` : APP_URL_PATH;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

module.exports = {
  test,
  expect,
  APP_URL_PATH,
  TINY_MP4,
  TINY_PNG,
  stubExternalCdns,
  setupMockNetwork,
  gotoApp,
};
