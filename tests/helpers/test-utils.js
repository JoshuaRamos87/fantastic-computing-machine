const fs = require('fs');
const path = require('path');
const { test: base, expect } = require('@playwright/test');
const { APP_URL_PATH } = require('./app-path');

const TINY_MP4 = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'tiny.mp4'));
const TINY_PNG = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'tiny.png'));

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
  } = options;

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
  setupMockNetwork,
  gotoApp,
};
