const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8085';

test.describe('Tangle Ropes', () => {

  test('page loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
  });

  test('level starts with tangles > 0', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);
    const tangles = await page.evaluate('parseInt(document.getElementById("tangles").textContent)');
    expect(tangles).toBeGreaterThan(0);
  });

  test('game state is exposed and valid', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);
    const info = await page.evaluate(() => {
      const s = window.__gameState;
      return {
        hasPegs: s.pegs.length > 0,
        hasRopes: s.ropes.length > 0,
        hasEmptyPeg: s.emptyPeg >= 0,
        emptyPegIsEmpty: s.ropeAtPeg[s.emptyPeg] === null,
        moves: s.moves,
        solved: s.solved
      };
    });
    expect(info.hasPegs).toBe(true);
    expect(info.hasRopes).toBe(true);
    expect(info.hasEmptyPeg).toBe(true);
    expect(info.emptyPegIsEmpty).toBe(true);
    expect(info.moves).toBe(0);
    expect(info.solved).toBe(false);
  });

  test('clicking an occupied peg moves rope to empty peg', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);

    const result = await page.evaluate(() => {
      const s = window.__gameState;
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();

      // Find an occupied peg
      let occupiedPeg = -1;
      for (let i = 0; i < s.pegs.length; i++) {
        if (s.ropeAtPeg[i] !== null) { occupiedPeg = i; break; }
      }
      if (occupiedPeg < 0) return { error: 'no occupied peg found' };

      const emptyBefore = s.emptyPeg;
      const pegPos = s.pegs[occupiedPeg];

      // Click directly on the occupied peg
      canvas.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + pegPos.x,
        clientY: rect.top + pegPos.y,
        bubbles: true
      }));

      return {
        movesBefore: 0,
        movesAfter: s.moves,
        emptyBefore,
        emptyAfter: s.emptyPeg,
        pegMoved: occupiedPeg
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.movesAfter).toBe(1);
    expect(result.emptyAfter).toBe(result.pegMoved);
  });

  test('clicking empty peg does nothing', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);

    const moved = await page.evaluate(() => {
      const s = window.__gameState;
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();
      const emptyPos = s.pegs[s.emptyPeg];

      canvas.dispatchEvent(new MouseEvent('click', {
        clientX: rect.left + emptyPos.x,
        clientY: rect.top + emptyPos.y,
        bubbles: true
      }));

      return s.moves;
    });

    expect(moved).toBe(0);
  });

  test('difficulty bands change level', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);

    await page.click('button[data-band="medium"]');
    await page.waitForTimeout(400);
    const level = await page.textContent('#level-label');
    expect(level).toBe('Level 5');
  });

  test('restart resets moves to 0', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);

    // Make a move first
    await page.evaluate(() => {
      const s = window.__gameState;
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < s.pegs.length; i++) {
        if (s.ropeAtPeg[i] !== null) {
          const p = s.pegs[i];
          canvas.dispatchEvent(new MouseEvent('click', {
            clientX: rect.left + p.x, clientY: rect.top + p.y, bubbles: true
          }));
          break;
        }
      }
    });

    const movesAfterClick = await page.evaluate('window.__gameState.moves');
    expect(movesAfterClick).toBe(1);

    await page.click('#restart');
    await page.waitForTimeout(400);
    const movesAfterRestart = await page.evaluate('window.__gameState.moves');
    expect(movesAfterRestart).toBe(0);
  });

  test('each peg has at most one rope end', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);

    const valid = await page.evaluate(() => {
      const s = window.__gameState;
      // Check each rope end points to a valid peg, and that peg points back
      for (let i = 0; i < s.ropes.length; i++) {
        for (let e = 0; e < 2; e++) {
          const pegIdx = s.ropes[i].pegs[e];
          const re = s.ropeAtPeg[pegIdx];
          if (!re || re.rope !== i || re.end !== e) return false;
        }
      }
      // Check exactly one empty peg
      let emptyCount = 0;
      for (let i = 0; i < s.pegs.length; i++) {
        if (s.ropeAtPeg[i] === null) emptyCount++;
      }
      return emptyCount === 1;
    });

    expect(valid).toBe(true);
  });

  test('consistency after multiple moves', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);

    const valid = await page.evaluate(() => {
      const s = window.__gameState;
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();

      // Make 5 moves
      for (let m = 0; m < 5; m++) {
        for (let i = 0; i < s.pegs.length; i++) {
          if (s.ropeAtPeg[i] !== null) {
            const p = s.pegs[i];
            canvas.dispatchEvent(new MouseEvent('click', {
              clientX: rect.left + p.x, clientY: rect.top + p.y, bubbles: true
            }));
            break;
          }
        }
      }

      // Verify consistency
      let emptyCount = 0;
      for (let i = 0; i < s.pegs.length; i++) {
        if (s.ropeAtPeg[i] === null) emptyCount++;
      }
      if (emptyCount !== 1) return { error: `${emptyCount} empty pegs` };

      for (let i = 0; i < s.ropes.length; i++) {
        for (let e = 0; e < 2; e++) {
          const pegIdx = s.ropes[i].pegs[e];
          const re = s.ropeAtPeg[pegIdx];
          if (!re || re.rope !== i || re.end !== e) {
            return { error: `rope ${i} end ${e} mismatch at peg ${pegIdx}` };
          }
        }
      }

      return { ok: true, moves: s.moves };
    });

    expect(valid.error).toBeUndefined();
    expect(valid.ok).toBe(true);
    expect(valid.moves).toBe(5);
  });

  test('back link exists and points to index', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    const href = await page.getAttribute('#home-link', 'href');
    expect(href).toBe('index.html');
  });

  test('all levels generate tangles across 10 loads', async ({ page }) => {
    for (let i = 0; i < 10; i++) {
      await page.goto(`${BASE}/ropes.html`);
      await page.waitForTimeout(400);
      const tangles = await page.evaluate('parseInt(document.getElementById("tangles").textContent)');
      expect(tangles).toBeGreaterThan(0);
    }
  });
});
