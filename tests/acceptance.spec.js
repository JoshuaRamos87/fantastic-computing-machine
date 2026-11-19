const fs = require('fs');
const {
  test,
  expect,
  TINY_MP4,
  setupMockNetwork,
  gotoApp,
} = require('./helpers/test-utils');
const {
  fxSingleVideo,
  fxLandscapeVideo,
  fxMultiVideo,
  fxGifPost,
  fxQuotedVideo,
  fxHlsOnly,
  fxPhotoGallery,
  fxTextOnly,
  vxVideoFallback,
} = require('./fixtures/api-fixtures');

test.describe('Input & URL validation', () => {
  test('validates input live, clears input, warns on t.co and invalid URLs', async ({ appPage }) => {
    await setupMockNetwork(appPage);
    await gotoApp(appPage);

    const urlInput = appPage.locator('#urlInput');
    const clearBtn = appPage.locator('#clearInputBtn');
    const feedback = appPage.locator('#validationFeedback');

    // Invalid URL submit stays on inputSection and shows validation warning
    await urlInput.fill('https://example.com/not-a-tweet');
    await expect(clearBtn).toBeVisible();
    await appPage.click('#fetchBtn');
    await expect(appPage.locator('#inputSection')).toBeVisible();
    await expect(feedback).toContainText('valid X / Twitter');

    // Clear button resets input
    await clearBtn.click();
    await expect(urlInput).toHaveValue('');
    await expect(clearBtn).toBeHidden();

    // t.co short link shows dedicated error notice
    await urlInput.fill('https://t.co/xyz123');
    await appPage.click('#fetchBtn');
    await expect(appPage.locator('#errorSection')).toBeVisible();
    await expect(appPage.locator('#errorTitle')).toHaveText('Shortened t.co Link Detected');
  });

  test('auto-extracts when launched with ?url= query parameter', async ({ appPage }) => {
    const id = '1890000000000000001';
    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxSingleVideo(id)),
        }),
    });

    await gotoApp(appPage, `?url=${encodeURIComponent(`https://x.com/testcreator/status/${id}`)}`);

    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#tweetAuthorName')).toHaveText('Test Creator');
    await expect(appPage.locator('#tweetAuthorHandle')).toHaveText('@testcreator');
  });
});

test.describe('Media extraction, failover & rendering', () => {
  test('extracts primary FxTwitter video, probes exact sizes, and switches preview quality', async ({ appPage }) => {
    const id = '1890000000000000001';
    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxSingleVideo(id)),
        }),
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', `https://x.com/testcreator/status/${id}`);
    await appPage.click('#fetchBtn');

    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#tweetAuthorName')).toHaveText('Test Creator');
    await expect(appPage.locator('#foundCountBadge')).toContainText('1 Video Ready');
    await expect(appPage.locator('#durationBadge')).toHaveText('0:24');
    await expect(appPage.locator('#gifExportContainer')).toBeHidden(); // 24s > 15s threshold

    // 3 resolutions sorted highest -> lowest
    const dlButtons = appPage.locator('#downloadButtonsList > div');
    await expect(dlButtons).toHaveCount(3);
    await expect(dlButtons.nth(0)).toContainText('720 × 1280');
    await expect(dlButtons.nth(0)).toContainText('Best');
    await expect(dlButtons.nth(1)).toContainText('540 × 960');
    await expect(dlButtons.nth(2)).toContainText('360 × 640');

    // Exact size probe from mocked HEAD response replaces estimated size
    await expect(dlButtons.nth(0)).toContainText('KB');

    // Direct stream input defaults to highest resolution
    await expect(appPage.locator('#directUrlInput')).toHaveValue(/720x1280\/high\.mp4/);

    // Clicking preview button for 360x640 updates player & direct URL box
    await appPage.getByRole('button', { name: 'Preview 360 by 640 stream' }).click();
    await expect(appPage.locator('#previewQualityHint')).toHaveText('Preview (360×640)');
    await expect(appPage.locator('#directUrlInput')).toHaveValue(/360x640\/low\.mp4/);
  });

  test('fails over cleanly from FxTwitter to VxTwitter backup API', async ({ appPage }) => {
    const id = '1890000000000000009';
    await setupMockNetwork(appPage, {
      fxHandler: (route) => route.abort('failed'),
      vxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(vxVideoFallback(id)),
        }),
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', id);
    await appPage.click('#fetchBtn');

    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#tweetAuthorName')).toHaveText('Backup User');
    await expect(appPage.locator('#tweetAuthorHandle')).toHaveText('@backupuser');
    await expect(appPage.locator('#directUrlInput')).toHaveValue(/vx_backup\.mp4/);
  });

  test('extracts quoted tweet video and shows From Quoted Post badge', async ({ appPage }) => {
    const id = '1890000000000000005';
    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxQuotedVideo(id)),
        }),
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', `https://x.com/quoter/status/${id}`);
    await appPage.click('#fetchBtn');

    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#quotedBadge')).toBeVisible();
    await expect(appPage.locator('#tweetAuthorHandle')).toHaveText('@origauthor');
  });

  test('switches tabs in multi-video posts and updates active media UI', async ({ appPage }) => {
    const id = '1890000000000000003';
    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxMultiVideo(id)),
        }),
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', `https://x.com/multiposter/status/${id}`);
    await appPage.click('#fetchBtn');

    await expect(appPage.locator('#multiVideoBar')).toBeVisible();
    const tabs = appPage.locator('#multiVideoTabs [role="tab"]');
    await expect(tabs).toHaveCount(2);

    // Tab 1 is standard video
    await expect(appPage.locator('#gifBadge')).toBeHidden();
    await expect(appPage.locator('#directUrlInput')).toHaveValue(/clip1\.mp4/);

    // Switch to Tab 2 (GIF)
    await tabs.nth(1).click();
    await expect(appPage.locator('#gifBadge')).toBeVisible();
    await expect(appPage.locator('#gifExportContainer')).toBeVisible();
    await expect(appPage.locator('#directUrlInput')).toHaveValue(/clip2\.mp4/);
  });

  test('renders HLS-only (.m3u8) fallback UI when no MP4 variants exist', async ({ appPage }) => {
    const id = '1890000000000000006';
    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxHlsOnly(id)),
        }),
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', `https://x.com/broadcaster/status/${id}`);
    await appPage.click('#fetchBtn');

    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#hlsStreamContainer')).toBeVisible();
    await expect(appPage.locator('#mp4FormatsContainer')).toBeHidden();
    await expect(appPage.locator('#directStreamBox')).toBeHidden();
    await expect(appPage.locator('#gifExportContainer')).toBeHidden();
    await expect(appPage.locator('#hlsOpenLink')).toHaveAttribute('href', /live\.m3u8/);
  });

  test('renders photo gallery and downloads individual photo', async ({ appPage }) => {
    const id = '1890000000000000007';
    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxPhotoGallery(id)),
        }),
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', `https://x.com/photog/status/${id}`);
    await appPage.click('#fetchBtn');

    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#photoGalleryContainer')).toBeVisible();
    await expect(appPage.locator('#resultsLayoutGrid')).toBeHidden();
    await expect(appPage.locator('#photoGalleryGrid > div')).toHaveCount(2);
    await expect(appPage.locator('#photoGalleryGrid')).toContainText('1200×800');
    await expect(appPage.locator('#photoGalleryGrid img').first()).toHaveAttribute('alt', 'Mountain sunrise view');

    const downloadPromise = appPage.waitForEvent('download');
    await appPage.locator('#photoGalleryGrid button').first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/photog.*1890000000000000007.*\.(jpg|png)$/);
  });

  test('classifies API error states accurately and recovers on Retry', async ({ appPage }) => {
    const id = '1890000000000000008';
    let attempt = 0;

    await setupMockNetwork(appPage, {
      fxHandler: (route) => {
        attempt++;
        if (attempt === 1) {
          return route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxSingleVideo(id)),
        });
      },
      vxHandler: (route) => route.fulfill({ status: 429, contentType: 'application/json', body: '{}' }),
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', id);
    await appPage.click('#fetchBtn');

    await expect(appPage.locator('#errorSection')).toBeVisible();
    await expect(appPage.locator('#errorTitle')).toHaveText('API Rate Limited');

    // Retry recovers when endpoint succeeds
    await appPage.click('#errorRetryBtn');
    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#errorSection')).toBeHidden();
  });

  test('shows accurate error notice for text-only, 404, 403, and uses built-in sample fallback', async ({ appPage }) => {
    const cases = [
      { id: '1890000000000000101', status: 404, body: { code: 404 }, title: 'Post Not Found or Deleted' },
      { id: '1890000000000000102', status: 403, body: { code: 403 }, title: 'Private or Age-Restricted Post' },
      { id: '1890000000000000103', status: 200, body: fxTextOnly('1890000000000000103'), title: 'No Media Found' },
    ];

    for (const c of cases) {
      await appPage.unrouteAll({ behavior: 'ignoreErrors' });
      await setupMockNetwork(appPage, {
        fxHandler: (route) =>
          route.fulfill({ status: c.status, contentType: 'application/json', body: JSON.stringify(c.body) }),
        vxHandler: (route) =>
          route.fulfill({ status: c.status, contentType: 'application/json', body: JSON.stringify(c.body) }),
      });
      await gotoApp(appPage);
      await appPage.fill('#urlInput', c.id);
      await appPage.click('#fetchBtn');
      await expect(appPage.locator('#errorTitle')).toHaveText(c.title);
    }

    // Built-in sample fallback works even when both APIs are offline
    await appPage.unrouteAll({ behavior: 'ignoreErrors' });
    await setupMockNetwork(appPage, {
      fxHandler: (route) => route.abort('failed'),
      vxHandler: (route) => route.abort('failed'),
    });
    await gotoApp(appPage);
    await appPage.getByRole('button', { name: /Sample Post/i }).click();
    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#tweetAuthorHandle')).toHaveText('@MinendTL');
  });

  test('inline video player fails over across candidate variants and shows overlay if all fail', async ({ appPage }) => {
    const id = '1890000000000000001';
    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxSingleVideo(id)),
        }),
      mp4Handler: (route) => route.fulfill({ status: 404, body: 'Not Found' }),
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', id);
    await appPage.click('#fetchBtn');

    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#playerErrorOverlay')).toBeVisible();
    await expect(appPage.locator('#playerErrorText')).toContainText('Preview stream failed to load');
  });

  test('inline video player omits Referer and falls back to Blob preview if direct <video> streaming is blocked', async ({ appPage }) => {
    const id = '1890000000000000005';
    const mediaRequestReferers = [];
    const blobFallbackFetches = [];

    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxSingleVideo(id)),
        }),
      mp4Handler: async (route) => {
        const req = route.request();
        const headers = req.headers();
        if (req.resourceType() === 'media') {
          mediaRequestReferers.push(headers['referer'] || '');
          // Simulate CDN/browser blocking direct <video> stream while CORS fetch succeeds
          await route.fulfill({ status: 403, body: 'Forbidden' });
          return;
        }
        if (req.method() === 'GET') {
          blobFallbackFetches.push({
            url: req.url(),
            referer: headers['referer'] || '',
            origin: headers['origin'] || '',
          });
        }
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(TINY_MP4.length),
            'Access-Control-Allow-Origin': headers['origin'] || '*',
          },
          body: req.method() === 'HEAD' ? undefined : TINY_MP4,
        });
      },
    });
    await gotoApp(appPage);

    // Document-level no-referrer meta must be present so <video> and <img> never leak GitHub Pages Referer
    await expect(appPage.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');

    await appPage.fill('#urlInput', id);
    await appPage.click('#fetchBtn');

    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#inlineVideoPlayer')).toHaveAttribute('src', /^blob:/);
    await expect(appPage.locator('#playerErrorOverlay')).toBeHidden();

    expect(mediaRequestReferers.length).toBeGreaterThan(0);
    for (const ref of mediaRequestReferers) {
      expect(ref).toBe('');
    }
    expect(blobFallbackFetches.length).toBeGreaterThan(0);
    expect(blobFallbackFetches[0].referer).toBe('');
  });
});

test.describe('Streamed downloads, cancellation & GIF export', () => {
  test('streams MP4 download with custom Settings filename template and marks Saved', async ({ appPage }) => {
    const id = '1890000000000000002';
    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxLandscapeVideo(id)),
        }),
    });
    await gotoApp(appPage);

    // Customize filename template in Settings modal
    await appPage.getByRole('button', { name: 'Downloader Settings' }).click();
    await expect(appPage.locator('#settingsModal')).toBeVisible();
    await appPage.fill('#filenameTemplateInput', 'custom_{handle}_{id}_{res}');
    await expect(appPage.locator('#filenamePreviewText')).toHaveText('custom_elonmusk_2073996017884627428_1080x1920.mp4');
    await appPage.keyboard.press('Escape');
    await expect(appPage.locator('#settingsModal')).toBeHidden();

    // Extract and download highest resolution
    await appPage.fill('#urlInput', id);
    await appPage.click('#fetchBtn');
    await expect(appPage.locator('#resultSection')).toBeVisible();

    const downloadPromise = appPage.waitForEvent('download');
    await appPage.locator('#downloadButtonsList > div').first().locator('button').first().click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`custom_widecreator_${id}_1920x1080.mp4`);
    const downloadedPath = await download.path();
    expect(fs.statSync(downloadedPath).size).toBe(TINY_MP4.length);
    await expect(appPage.locator('#downloadButtonsList > div').first()).toContainText('Complete! File saved.');
    await expect(appPage.locator('#downloadButtonsList > div').first().locator('i.fa-circle-check')).toBeAttached();
  });

  test('bypasses no-cors <video> HTTP cache and omits Referer so hosted HTTPS downloads never fall back to a new tab', async ({ appPage }) => {
    const id = '1890000000000000004';
    const fetchChecks = [];

    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxGifPost(id)),
        }),
      mp4Handler: async (route) => {
        const req = route.request();
        const headers = req.headers();
        const hasOrigin = Boolean(headers['origin']);

        if (req.method() === 'GET' && hasOrigin) {
          fetchChecks.push({
            referer: headers['referer'] || '',
            origin: headers['origin'] || '',
          });
        }

        // Simulate real CDN behavior: 7-day Cache-Control without Vary: Origin,
        // and ACAO only returned when Origin header is present (so no-cors <video> cache entry lacks ACAO)
        const respHeaders = {
          'Content-Type': 'video/mp4',
          'Content-Length': String(TINY_MP4.length),
          'Cache-Control': 'public, max-age=604800',
        };
        if (hasOrigin) {
          respHeaders['Access-Control-Allow-Origin'] = headers['origin'];
        }

        await route.fulfill({
          status: 200,
          headers: respHeaders,
          body: req.method() === 'HEAD' ? undefined : TINY_MP4,
        });
      },
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', id);
    await appPage.click('#fetchBtn');
    await expect(appPage.locator('#resultSection')).toBeVisible();

    // Wait briefly so inline <video> fetches the same single-variant URL in no-cors mode
    await appPage.waitForTimeout(200);

    const downloadPromise = appPage.waitForEvent('download');
    await appPage.locator('#downloadButtonsList > div').first().locator('button').first().click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.mp4$/);
    expect(fetchChecks.length).toBeGreaterThan(0);
    expect(fetchChecks[0].referer).toBe('');
  });

  test('protects active downloads against accidental single Escape and allows Cancel', async ({ appPage }) => {
    const id = '1890000000000000001';
    let releaseDownload;
    const downloadStarted = new Promise((resolve) => {
      releaseDownload = resolve;
    });

    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxSingleVideo(id)),
        }),
      mp4Handler: async (route) => {
        const req = route.request();
        if (req.method() === 'HEAD') {
          return route.fulfill({
            status: 200,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Length': String(TINY_MP4.length),
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
        if (req.url().includes('high.mp4')) {
          // Hold GET open so active download banner & cancellation can be verified
          releaseDownload();
          await new Promise((r) => setTimeout(r, 4000));
          try {
            await route.abort('aborted');
          } catch {
            // Route may already be aborted by client
          }
          return;
        }
        return route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(TINY_MP4.length),
            'Access-Control-Allow-Origin': '*',
          },
          body: TINY_MP4,
        });
      },
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', id);
    await appPage.click('#fetchBtn');
    await expect(appPage.locator('#resultSection')).toBeVisible();

    // Start download on highest resolution
    await appPage.locator('#downloadButtonsList > div').first().locator('button').first().click();
    await downloadStarted;

    // Active downloads banner is visible
    await expect(appPage.locator('#activeDownloadsBanner')).toBeVisible();
    await expect(appPage.locator('#activeDownloadsText')).toContainText('1 download active');

    // Single Escape warns instead of resetting the view
    await appPage.keyboard.press('Escape');
    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#toastMsg')).toContainText('Download in progress');

    // Clicking Cancel All aborts cleanly and hides the banner
    await appPage.locator('#activeDownloadsBanner button', { hasText: 'Cancel All' }).click();
    await expect(appPage.locator('#activeDownloadsBanner')).toBeHidden();
  });

  test('exports a real animated GIF89a file client-side from a GIF post', async ({ appPage }) => {
    const id = '1890000000000000004';
    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxGifPost(id)),
        }),
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', id);
    await appPage.click('#fetchBtn');

    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#gifBadge')).toBeVisible();
    await expect(appPage.locator('#gifExportContainer')).toBeVisible();

    const downloadPromise = appPage.waitForEvent('download');
    await appPage.click('#exportGifBtn');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^X_gifmaker_1890000000000000004_.*\.gif$/);
    const gifBytes = fs.readFileSync(await download.path());
    expect(gifBytes.subarray(0, 6).toString('ascii')).toBe('GIF89a');
    expect(gifBytes[gifBytes.length - 1]).toBe(0x3b);
  });

  test('trims a video range to export a trimmed clip and trimmed animated GIF', async ({ appPage }) => {
    const id = '1890000000000000006';
    await setupMockNetwork(appPage, {
      fxHandler: (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(fxLandscapeVideo(id)),
        }),
    });
    await gotoApp(appPage);

    await appPage.fill('#urlInput', id);
    await appPage.click('#fetchBtn');
    await expect(appPage.locator('#resultSection')).toBeVisible();

    // Open Quick Trim panel
    await expect(appPage.locator('#toggleTrimBtn')).toBeVisible();
    await expect(appPage.locator('#trimControlsPanel')).toBeHidden();
    await appPage.click('#toggleTrimBtn');
    await expect(appPage.locator('#trimControlsPanel')).toBeVisible();

    // Set a short 0.5s trim window via sliders
    await appPage.evaluate(() => {
      syncTrimDuration(2.0);
      setTrimBounds(0.2, 0.7, 'end');
    });

    await expect(appPage.locator('#trimStartReadout')).toHaveText('0:00.2');
    await expect(appPage.locator('#trimEndReadout')).toHaveText('0:00.7');
    await expect(appPage.locator('#trimDurationBadge')).toHaveText('0.5s');
    await expect(appPage.locator('#gifExportContainer')).toBeVisible();
    await expect(appPage.locator('#exportGifBtnLabel')).toContainText('Export Trimmed .GIF (0.5s)');

    // Export trimmed GIF
    const gifDownloadPromise = appPage.waitForEvent('download');
    await appPage.click('#exportGifBtn');
    const gifDownload = await gifDownloadPromise;
    expect(gifDownload.suggestedFilename()).toMatch(/_trim_0_2s-0_7s\.gif$/);
    const gifBytes = fs.readFileSync(await gifDownload.path());
    expect(gifBytes.subarray(0, 6).toString('ascii')).toBe('GIF89a');

    // Export lossless trimmed MP4 clip (strictly smaller than original, valid ftyp MP4 container)
    const clipDownloadPromise = appPage.waitForEvent('download');
    await appPage.click('#exportTrimBtn');
    const clipDownload = await clipDownloadPromise;
    expect(clipDownload.suggestedFilename()).toMatch(/_trim_0s-0_7s\.mp4$/);
    const clipBytes = fs.readFileSync(await clipDownload.path());
    expect(clipBytes.subarray(4, 8).toString('ascii')).toBe('ftyp');
    expect(clipBytes.length).toBeGreaterThan(0);
    expect(clipBytes.length).toBeLessThan(TINY_MP4.length);

    // Reset restores full range
    await appPage.click('#trimResetBtn');
    await expect(appPage.locator('#trimStartReadout')).toHaveText('0:00.0');
  });
});

test.describe('Theme, modals & history persistence', () => {
  test('persists dark mode across reload and opens/closes modals', async ({ appPage }) => {
    await setupMockNetwork(appPage);
    await gotoApp(appPage);

    const initialDark = await appPage.evaluate(() => document.documentElement.classList.contains('dark'));
    await appPage.click('#themeToggleBtn');
    const toggledDark = await appPage.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(toggledDark).toBe(!initialDark);

    // Reload and ensure zero-FOUC init script preserves theme
    await appPage.reload({ waitUntil: 'domcontentloaded' });
    const afterReloadDark = await appPage.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(afterReloadDark).toBe(toggledDark);

    // Shortcuts modal opens and populates ?url= template + bookmarklet
    await appPage.getByRole('button', { name: 'Mobile Shortcuts and Bookmarklet' }).click();
    await expect(appPage.locator('#shortcutsModal')).toBeVisible();
    await expect(appPage.locator('#shortcutUrlTemplate')).toHaveValue(/\?url=\{TWEET_URL\}$/);
    await expect(appPage.locator('#bookmarkletCodeInput')).toHaveValue(/^javascript:/);
    await appPage.keyboard.press('Escape');
    await expect(appPage.locator('#shortcutsModal')).toBeHidden();
  });

  test('migrates legacy v2 history, filters search, re-opens items, and clears history', async ({ appPage }) => {
    await setupMockNetwork(appPage);

    // Seed legacy v2 history with 5 items before page load so search box activates (> 4 items)
    await appPage.addInitScript(() => {
      if (window.__seededLegacyHistory) return;
      window.__seededLegacyHistory = true;
      const legacyItems = [
        { id: '1000000000000000001', authorHandle: 'alpha_dev', authorName: 'Alpha', text: 'First clip', videos: [{ type: 'video', width: 720, height: 1280, resolutions: [{ width: 720, height: 1280, url: 'https://video.twimg.com/a.mp4' }] }], timestamp: Date.now() - 1000 },
        { id: '1000000000000000002', authorHandle: 'beta_artist', authorName: 'Beta', text: 'Second animation', videos: [{ type: 'gif', width: 480, height: 480, resolutions: [{ width: 480, height: 480, url: 'https://video.twimg.com/b.mp4' }] }], timestamp: Date.now() - 2000 },
        { id: '1000000000000000003', authorHandle: 'gamma_news', authorName: 'Gamma', text: 'Breaking broadcast', videos: [{ type: 'video', isHlsOnly: true, hlsUrl: 'https://video.twimg.com/c.m3u8', resolutions: [] }], timestamp: Date.now() - 3000 },
        { id: '1000000000000000004', authorHandle: 'delta_photo', authorName: 'Delta', text: 'Scenic mountain', videos: [], photos: [{ previewUrl: 'https://pbs.twimg.com/d.jpg', fullUrl: 'https://pbs.twimg.com/d.jpg' }], timestamp: Date.now() - 4000 },
        { id: '1000000000000000005', authorHandle: 'omega_clip', authorName: 'Omega', text: 'Rocket launch', videos: [{ type: 'video', width: 1920, height: 1080, resolutions: [{ width: 1920, height: 1080, url: 'https://video.twimg.com/e.mp4' }] }], timestamp: Date.now() - 5000 },
      ];
      localStorage.setItem('x_downloader_history_v2', JSON.stringify(legacyItems));
    });

    await gotoApp(appPage);

    // Migrated to v3 and rendered
    await expect(appPage.locator('#historySection')).toBeVisible();
    await expect(appPage.locator('#historyCountBadge')).toHaveText('5');
    await expect(appPage.locator('#historySearchWrap')).toBeVisible();

    const v3Stored = await appPage.evaluate(() => Boolean(localStorage.getItem('x_downloader_history_v3')));
    expect(v3Stored).toBe(true);

    // Search filters history items live
    await appPage.fill('#historySearchInput', 'Rocket');
    await expect(appPage.locator('#historyList > div')).toHaveCount(1);
    await expect(appPage.locator('#historyList')).toContainText('@omega_clip');

    // Clicking a history item re-opens its results without re-fetching
    await appPage.locator('#historyList > div').first().locator('button').first().click();
    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#tweetAuthorHandle')).toHaveText('@omega_clip');

    // Clear filter and delete one item
    await appPage.fill('#historySearchInput', '');
    await expect(appPage.locator('#historyList > div')).toHaveCount(5);
    await appPage.getByRole('button', { name: 'Remove @alpha_dev from history' }).click();
    await expect(appPage.locator('#historyCountBadge')).toHaveText('4');
    await expect(appPage.locator('#historySearchWrap')).toBeHidden();

    // Clear All removes history section
    await appPage.locator('#historySection button', { hasText: 'Clear All' }).click();
    await expect(appPage.locator('#historySection')).toBeHidden();
  });
});
