const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8085';

test.describe('Landing Page', () => {

  test('page loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
  });

  test('has title and both game cards', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    const title = await page.textContent('h1');
    expect(title).toBe('KNOTS');

    const cards = await page.locator('.game-card').count();
    expect(cards).toBe(2);
  });

  test('untangle card links to untangle.html', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    const href = await page.getAttribute('.card-untangle', 'href');
    expect(href).toBe('untangle.html');
  });

  test('ropes card links to ropes.html', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    const href = await page.getAttribute('.card-ropes', 'href');
    expect(href).toBe('ropes.html');
  });

  test('canvas previews render', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    await page.waitForTimeout(500);

    const previews = await page.evaluate(() => {
      const c1 = document.getElementById('preview-untangle');
      const c2 = document.getElementById('preview-ropes');
      return {
        untangle: c1 && c1.width > 0,
        ropes: c2 && c2.width > 0
      };
    });
    expect(previews.untangle).toBe(true);
    expect(previews.ropes).toBe(true);
  });
});
