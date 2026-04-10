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
        moves: s.moves,
        solved: s.solved,
        numEmpty: s.ropeAtPeg.filter(r => r === null).length
      };
    });
    expect(info.hasPegs).toBe(true);
    expect(info.hasRopes).toBe(true);
    expect(info.moves).toBe(0);
    expect(info.solved).toBe(false);
    expect(info.numEmpty).toBeGreaterThanOrEqual(2);
  });

  test('dragging a rope end to empty peg makes a move', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);

    const result = await page.evaluate(() => {
      const s = window.__gameState;
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();

      // Find an occupied peg and an empty peg
      let occupiedPeg = -1;
      for (let i = 0; i < s.pegs.length; i++) {
        if (s.ropeAtPeg[i] !== null) { occupiedPeg = i; break; }
      }
      let emptyPeg = -1;
      for (let i = 0; i < s.pegs.length; i++) {
        if (s.ropeAtPeg[i] === null) { emptyPeg = i; break; }
      }
      if (occupiedPeg < 0 || emptyPeg < 0) return { error: 'no valid pegs' };

      const from = s.pegs[occupiedPeg];
      const to = s.pegs[emptyPeg];

      // Simulate drag: mousedown on occupied, mousemove to empty, mouseup on empty
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        clientX: rect.left + from.x, clientY: rect.top + from.y, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.left + to.x, clientY: rect.top + to.y, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent('mouseup', {
        clientX: rect.left + to.x, clientY: rect.top + to.y, bubbles: true
      }));

      return { movesAfter: s.moves };
    });

    expect(result.error).toBeUndefined();
    expect(result.movesAfter).toBe(1);
  });

  test('cancelling drag restores state', async ({ page }) => {
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
      const from = s.pegs[occupiedPeg];
      const twistsBefore = JSON.stringify(s.twists);

      // Drag to empty space (not a peg) then release
      canvas.dispatchEvent(new MouseEvent('mousedown', {
        clientX: rect.left + from.x, clientY: rect.top + from.y, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.left + 5, clientY: rect.top + 5, bubbles: true
      }));
      canvas.dispatchEvent(new MouseEvent('mouseup', {
        clientX: rect.left + 5, clientY: rect.top + 5, bubbles: true
      }));

      return {
        moves: s.moves,
        twistsRestored: JSON.stringify(s.twists) === twistsBefore
      };
    });

    expect(result.moves).toBe(0);
    expect(result.twistsRestored).toBe(true);
  });

  test('difficulty bands change level', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);
    await page.click('button[data-band="medium"]');
    await page.waitForTimeout(400);
    expect(await page.textContent('#level-label')).toBe('Level 5');
  });

  test('restart resets moves to 0', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);

    // Make a move via drag
    await page.evaluate(() => {
      const s = window.__gameState;
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();
      let occ = -1, emp = -1;
      for (let i = 0; i < s.pegs.length; i++) {
        if (s.ropeAtPeg[i] !== null && occ < 0) occ = i;
        if (s.ropeAtPeg[i] === null && emp < 0) emp = i;
      }
      const f = s.pegs[occ], t = s.pegs[emp];
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.left+f.x, clientY: rect.top+f.y, bubbles: true }));
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left+t.x, clientY: rect.top+t.y, bubbles: true }));
      canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: rect.left+t.x, clientY: rect.top+t.y, bubbles: true }));
    });
    expect(await page.evaluate('window.__gameState.moves')).toBe(1);

    await page.click('#restart');
    await page.waitForTimeout(400);
    expect(await page.evaluate('window.__gameState.moves')).toBe(0);
  });

  test('multiple empty pegs exist', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);
    const emptyCount = await page.evaluate(() => {
      return window.__gameState.ropeAtPeg.filter(r => r === null).length;
    });
    expect(emptyCount).toBeGreaterThanOrEqual(2);
  });

  test('rope endpoints match peg assignments', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);
    const valid = await page.evaluate(() => {
      const s = window.__gameState;
      for (let i = 0; i < s.ropes.length; i++) {
        for (let e = 0; e < 2; e++) {
          const peg = s.ropes[i].pegs[e];
          const re = s.ropeAtPeg[peg];
          if (!re || re.rope !== i || re.end !== e) return false;
        }
      }
      return true;
    });
    expect(valid).toBe(true);
  });

  test('consistency after multiple drag moves', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(800);

    const result = await page.evaluate(() => {
      const s = window.__gameState;
      const canvas = document.getElementById('canvas');
      const rect = canvas.getBoundingClientRect();

      for (let m = 0; m < 5; m++) {
        let occ = -1, emp = -1;
        for (let i = 0; i < s.pegs.length; i++) {
          if (s.ropeAtPeg[i] !== null && occ < 0) occ = i;
          if (s.ropeAtPeg[i] === null && emp < 0) emp = i;
        }
        if (occ < 0 || emp < 0) break;
        const f = s.pegs[occ], t = s.pegs[emp];
        canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: rect.left+f.x, clientY: rect.top+f.y, bubbles: true }));
        canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left+t.x, clientY: rect.top+t.y, bubbles: true }));
        canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: rect.left+t.x, clientY: rect.top+t.y, bubbles: true }));
      }

      // Verify rope-peg consistency
      for (let i = 0; i < s.ropes.length; i++) {
        for (let e = 0; e < 2; e++) {
          const peg = s.ropes[i].pegs[e];
          const re = s.ropeAtPeg[peg];
          if (!re || re.rope !== i || re.end !== e) return { error: `rope ${i} end ${e} mismatch` };
        }
      }
      return { ok: true, moves: s.moves };
    });

    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.moves).toBeGreaterThan(0);
  });

  test('back link exists and points to index', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    expect(await page.getAttribute('#home-link', 'href')).toBe('index.html');
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
