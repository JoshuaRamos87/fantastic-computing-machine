const { test, expect, gotoApp } = require('./helpers/test-utils');

/**
 * Optional live smoke test against real upstream FxTwitter / VxTwitter APIs.
 * Excluded from default `npm test`; run explicitly via `npm run test:live`.
 */
test.describe('@live Upstream API smoke tests', () => {
  test('extracts the built-in sample post against live endpoints @live', async ({ appPage }) => {
    await gotoApp(appPage);
    await appPage.getByRole('button', { name: /Sample Post/i }).click();

    await expect(appPage.locator('#resultSection')).toBeVisible({ timeout: 20_000 });
    await expect(appPage.locator('#downloadButtonsList > div').first()).toBeVisible();
  });
});
