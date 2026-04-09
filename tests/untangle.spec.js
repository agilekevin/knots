const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8085';

test.describe('Untangle', () => {

  test('page loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/untangle.html`);
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
  });

  test('level 1 starts with crossings > 0', async ({ page }) => {
    await page.goto(`${BASE}/untangle.html`);
    await page.waitForTimeout(800);
    const crossings = await page.evaluate('parseInt(document.getElementById("crossings").textContent)');
    expect(crossings).toBeGreaterThan(0);
  });

  test('game state is exposed and valid', async ({ page }) => {
    await page.goto(`${BASE}/untangle.html`);
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const s = window.__gameState;
      return {
        hasNodes: s.nodes.length > 0,
        hasEdges: s.edges.length > 0,
        nodeCount: s.nodes.length,
        level: s.level,
        solved: s.solved
      };
    });
    expect(info.hasNodes).toBe(true);
    expect(info.hasEdges).toBe(true);
    expect(info.nodeCount).toBe(4); // level 1 = 3 + 1
    expect(info.level).toBe(1);
    expect(info.solved).toBe(false);
  });

  test('dragging a node changes its position', async ({ page }) => {
    await page.goto(`${BASE}/untangle.html`);
    await page.waitForTimeout(800);

    const moved = await page.evaluate(() => {
      const s = window.__gameState;
      const origX = s.nodes[0].x;
      const origY = s.nodes[0].y;

      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();

      // Simulate drag
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        clientX: rect.left + origX, clientY: rect.top + origY, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.left + origX + 50, clientY: rect.top + origY + 50, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent('mouseup', {
        clientX: rect.left + origX + 50, clientY: rect.top + origY + 50, bubbles: true
      }));

      return {
        movedX: Math.abs(s.nodes[0].x - origX) > 10,
        movedY: Math.abs(s.nodes[0].y - origY) > 10
      };
    });

    expect(moved.movedX).toBe(true);
    expect(moved.movedY).toBe(true);
  });

  test('difficulty bands change level', async ({ page }) => {
    await page.goto(`${BASE}/untangle.html`);
    await page.waitForTimeout(800);

    await page.click('button[data-band="medium"]');
    await page.waitForTimeout(400);
    const level = await page.textContent('#level-label');
    expect(level).toBe('Level 5');
  });

  test('back link exists and points to index', async ({ page }) => {
    await page.goto(`${BASE}/untangle.html`);
    const href = await page.getAttribute('#home-link', 'href');
    expect(href).toBe('index.html');
  });
});
