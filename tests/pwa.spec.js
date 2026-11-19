const { test, expect, setupMockNetwork, gotoApp } = require('./helpers/test-utils');
const { fxSingleVideo } = require('./fixtures/api-fixtures');

test.describe('PWA installability, manifest, service worker & share target', () => {
  test('serves valid manifest.webmanifest with standalone display, share_target, and reachable PNG icons', async ({ appPage, request }) => {
    await setupMockNetwork(appPage);
    await gotoApp(appPage);

    const manifestHref = await appPage.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const manifestUrl = new URL(manifestHref, appPage.url()).toString();
    const res = await request.get(manifestUrl);
    expect(res.status()).toBe(200);

    const manifest = await res.json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.share_target?.params?.text).toBe('text');
    expect(manifest.share_target?.params?.url).toBe('url');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === '192x192' && i.type === 'image/png')).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === '512x512' && i.type === 'image/png')).toBe(true);
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);

    // Every declared icon must be reachable as image/png
    for (const icon of manifest.icons) {
      const iconUrl = new URL(icon.src, manifestUrl).toString();
      const iconRes = await request.get(iconUrl);
      expect(iconRes.status(), `Icon ${icon.src} should return 200`).toBe(200);
      expect(iconRes.headers()['content-type']).toContain('image/png');
    }
  });

  test('registers sw.js service worker cleanly', async ({ appPage }) => {
    await setupMockNetwork(appPage);
    await gotoApp(appPage);

    const swState = await appPage.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return {
        hasActive: Boolean(reg.active),
        scriptURL: reg.active?.scriptURL || '',
      };
    });

    expect(swState.hasActive).toBe(true);
    expect(swState.scriptURL).toMatch(/\/sw\.js$/);
  });

  test('auto-extracts tweets shared via Android Share Target ?text= parameter', async ({ appPage }) => {
    const id = '1890000000000000001';
    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxSingleVideo(id)),
        }),
    });

    const sharedText = `Check out this post https://x.com/testcreator/status/${id}?s=20`;
    await gotoApp(appPage, `?title=X+Post&text=${encodeURIComponent(sharedText)}`);

    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#tweetAuthorName')).toHaveText('Test Creator');
    await expect(appPage.locator('#tweetAuthorHandle')).toHaveText('@testcreator');

    // Query params are cleaned up so reloads don't re-trigger old shares
    const searchAfter = await appPage.evaluate(() => window.location.search);
    expect(searchAfter).toBe('');
  });

  test('reveals Install button on beforeinstallprompt and invokes install prompt on click', async ({ appPage }) => {
    await setupMockNetwork(appPage);
    await gotoApp(appPage);

    const installBtn = appPage.locator('#installAppBtn');
    await expect(installBtn).toBeHidden();

    // Simulate Chromium firing beforeinstallprompt
    await appPage.evaluate(() => {
      window.__installPromptCalled = false;
      const evt = new Event('beforeinstallprompt', { cancelable: true });
      evt.prompt = async () => {
        window.__installPromptCalled = true;
      };
      evt.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(evt);
    });

    await expect(installBtn).toBeVisible();
    await installBtn.click();

    const called = await appPage.evaluate(() => window.__installPromptCalled);
    expect(called).toBe(true);
    await expect(installBtn).toBeHidden();
  });

  test('loads self-contained offline CSS, vector icons, and Inter font with zero external CDN requests', async ({ appPage, request }) => {
    const externalRequests = [];
    appPage.on('request', (req) => {
      const url = req.url();
      if (/tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/i.test(url)) {
        externalRequests.push(url);
      }
    });

    await setupMockNetwork(appPage, { includeCdnStubs: false });
    await gotoApp(appPage);

    expect(externalRequests).toEqual([]);

    for (const assetPath of [
      './assets/styles.css',
      './assets/icons.css',
      './assets/fonts/inter-latin-wght-normal.woff2',
    ]) {
      const assetUrl = new URL(assetPath, appPage.url()).toString();
      const res = await request.get(assetUrl);
      expect(res.status(), `Offline asset ${assetPath} should return 200`).toBe(200);
    }

    // Verify compiled Tailwind styles and local vector icons actually apply without any CDN
    const styleCheck = await appPage.evaluate(() => {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      const brandIcon = document.querySelector('i.fa-brands.fa-x-twitter');
      const iconStyle = brandIcon ? getComputedStyle(brandIcon) : null;
      return {
        bodyBg,
        iconDisplay: iconStyle?.display || '',
        iconMask: iconStyle?.maskImage || iconStyle?.webkitMaskImage || '',
      };
    });

    expect(styleCheck.bodyBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(['inline-block', 'block']).toContain(styleCheck.iconDisplay);
    expect(styleCheck.iconMask).toContain('data:image/svg+xml');
  });
});
