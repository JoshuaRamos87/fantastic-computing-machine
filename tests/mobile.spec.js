const { test, expect, setupMockNetwork, gotoApp } = require('./helpers/test-utils');
const { fxMultiVideo, fxPhotoGallery } = require('./fixtures/api-fixtures');

test.describe('Mobile viewport resilience', () => {
  test('toggles mobile navigation drawer, opens modals, and closes on Escape', async ({ appPage }) => {
    await setupMockNetwork(appPage);
    await gotoApp(appPage);

    const menuBtn = appPage.locator('#menuBtn');
    const drawer = appPage.locator('#drawerMenu');

    await expect(menuBtn).toBeVisible();
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(drawer).toBeHidden();

    // Open mobile drawer
    await menuBtn.click();
    await expect(drawer).toBeVisible();
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');

    // Escape closes mobile drawer
    await appPage.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');

    // Open Settings via mobile drawer
    await menuBtn.click();
    await drawer.getByRole('button', { name: /Settings/i }).click();
    await expect(appPage.locator('#settingsModal')).toBeVisible();
    await expect(drawer).toBeHidden();

    await appPage.keyboard.press('Escape');
    await expect(appPage.locator('#settingsModal')).toBeHidden();
  });

  test('renders multi-video and photo results with zero horizontal overflow on mobile', async ({ appPage }) => {
    const videoId = '1890000000000000003';
    const photoId = '1890000000000000007';

    await setupMockNetwork(appPage, {
      fxHandler: (route) => {
        const url = route.request().url();
        const payload = url.includes(photoId) ? fxPhotoGallery(photoId) : fxMultiVideo(videoId);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(payload),
        });
      },
    });
    await gotoApp(appPage);

    const assertNoHorizontalOverflow = async () => {
      const metrics = await appPage.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
    };

    // Input view
    await assertNoHorizontalOverflow();

    // Multi-video results view
    await appPage.fill('#urlInput', videoId);
    await appPage.click('#fetchBtn');
    await expect(appPage.locator('#resultSection')).toBeVisible();
    await expect(appPage.locator('#multiVideoBar')).toBeVisible();
    await assertNoHorizontalOverflow();

    // Return to input and load photo gallery view
    await appPage.keyboard.press('Escape');
    await expect(appPage.locator('#inputSection')).toBeVisible();
    await appPage.fill('#urlInput', photoId);
    await appPage.click('#fetchBtn');
    await expect(appPage.locator('#photoGalleryContainer')).toBeVisible();
    await assertNoHorizontalOverflow();
  });
});
