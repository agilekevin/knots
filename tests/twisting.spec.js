const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8085';

const SETUP_AND_HELPERS = `
  function setupCross() {
    const s = window.__gameState;
    const canvas = document.getElementById('canvas');
    const w = canvas.width / devicePixelRatio, h = canvas.height / devicePixelRatio;
    const cx = w/2, cy = h/2, sp = 150;
    s.pegs = [
      {x:cx,y:cy-sp},{x:cx-sp,y:cy},{x:cx+sp,y:cy},{x:cx,y:cy+sp},
      {x:cx-sp,y:cy-sp},{x:cx+sp,y:cy-sp},{x:cx-sp,y:cy+sp},{x:cx+sp,y:cy+sp}
    ];
    s.ropes = [{color:'#ef4444',pegs:[0,3]},{color:'#3b82f6',pegs:[1,2]}];
    s.ropeAtPeg = new Array(8).fill(null);
    s.ropeAtPeg[0]={rope:0,end:0}; s.ropeAtPeg[3]={rope:0,end:1};
    s.ropeAtPeg[1]={rope:1,end:0}; s.ropeAtPeg[2]={rope:1,end:1};
    s.twists=[[0,0],[0,0]]; s.zOrder=[0,1]; s.zCounter=1;
    s.moves=0; s.solved=false; s.drag=null; s.hoverPeg=-1;
    window.__draw();
  }
  function drag(fromPeg, toPeg) {
    const s = window.__gameState;
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const fp = s.pegs[fromPeg], tp = s.pegs[toPeg];
    canvas.dispatchEvent(new MouseEvent('mousedown',{clientX:rect.left+fp.x,clientY:rect.top+fp.y,bubbles:true}));
    canvas.dispatchEvent(new MouseEvent('mousemove',{clientX:rect.left+tp.x,clientY:rect.top+tp.y,bubbles:true}));
    canvas.dispatchEvent(new MouseEvent('mouseup',{clientX:rect.left+tp.x,clientY:rect.top+tp.y,bubbles:true}));
  }
`;

test.describe('Rope Twisting Physics', () => {

  test('two ropes start with 0 twists', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(600);
    const twists = await page.evaluate(`(() => {
      ${SETUP_AND_HELPERS}
      setupCross();
      return window.__gameState.twists[0][1];
    })()`);
    expect(twists).toBe(0);
  });

  test('moving rope end across other rope creates a twist', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(600);
    const result = await page.evaluate(`(() => {
      ${SETUP_AND_HELPERS}
      setupCross();
      // Drag rope A bottom (peg 3) to top-left (peg 4) — crosses rope B
      drag(3, 4);
      return {
        twists: Math.abs(window.__gameState.twists[0][1]),
        moves: window.__gameState.moves
      };
    })()`);
    expect(result.moves).toBe(1);
    expect(result.twists).toBeGreaterThan(0);
  });

  test('twists persist when ropes no longer geometrically cross', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(600);
    const result = await page.evaluate(`(() => {
      ${SETUP_AND_HELPERS}
      setupCross();
      // Drag rope A bottom (peg 3) to top-left (peg 4) — crosses rope B
      drag(3, 4);
      const t1 = Math.abs(window.__gameState.twists[0][1]);
      // Now drag rope A's moved end (peg 4) to top-right (peg 5) — doesn't cross rope B
      drag(4, 5);
      const t2 = Math.abs(window.__gameState.twists[0][1]);
      // Ropes no longer cross but twist must persist
      return { t1, t2 };
    })()`);
    expect(result.t1).toBeGreaterThan(0);
    expect(result.t2).toBe(result.t1);
  });

  test('opposite-direction crossings cancel twists', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(600);
    const result = await page.evaluate(`(() => {
      ${SETUP_AND_HELPERS}
      setupCross();
      // Move 1: rope A bottom (peg 3) to top-left (peg 4) — crosses rope B, twist=+1
      drag(3, 4);
      const t1 = Math.abs(window.__gameState.twists[0][1]);
      // Move rope A end around to the other side and cross back in opposite direction
      drag(4, 5);  // top-left to top-right (no crossing, stays at 1)
      drag(5, 7);  // top-right to bot-right — crosses rope B in opposite direction
      const t2 = Math.abs(window.__gameState.twists[0][1]);
      return { t1, t2 };
    })()`);
    expect(result.t1).toBe(1);
    expect(result.t2).toBe(0);
  });

  test('z-order: last moved rope goes on top', async ({ page }) => {
    await page.goto(`${BASE}/ropes.html`);
    await page.waitForTimeout(600);
    const result = await page.evaluate(`(() => {
      ${SETUP_AND_HELPERS}
      setupCross();
      drag(3, 4);
      const z1 = [...window.__gameState.zOrder];
      drag(2, 6);
      const z2 = [...window.__gameState.zOrder];
      return { z1, z2 };
    })()`);
    // After moving rope 0, it should be on top
    expect(result.z1[0]).toBeGreaterThan(result.z1[1]);
    // After moving rope 1, it should be on top
    expect(result.z2[1]).toBeGreaterThan(result.z2[0]);
  });
});
