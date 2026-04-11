// Pure rope twisting engine — no DOM, no rendering.
// Exports functions for creating boards, moving rope ends, and querying twist state.

function createBoard(pegs, ropes) {
  // pegs: [{x, y}, ...]
  // ropes: [[pegA, pegB], ...] — which pegs each rope connects
  const numRopes = ropes.length;
  const ropeAtPeg = new Array(pegs.length).fill(null);
  const ropeData = ropes.map((r, i) => {
    ropeAtPeg[r[0]] = { rope: i, end: 0 };
    ropeAtPeg[r[1]] = { rope: i, end: 1 };
    return { pegs: [...r] };
  });

  // twists[i][j] = signed integer, how many times rope i and j are twisted
  const twists = [];
  for (let i = 0; i < numRopes; i++) {
    twists[i] = new Array(numRopes).fill(0);
  }

  // zOrder[ropeIdx] = draw priority (higher = on top at crossings)
  const zOrder = [];
  for (let i = 0; i < numRopes; i++) zOrder[i] = i;

  return { pegs, ropes: ropeData, ropeAtPeg, twists, zOrder, zCounter: numRopes - 1 };
}

function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-10) return null; // parallel
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / denom;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / denom;
  // Proper crossing: both parameters strictly between 0 and 1
  // Use small epsilon to avoid floating point edge cases
  if (t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999) {
    return { t, u };
  }
  return null;
}

function crossSign(ax, ay, bx, by, cx, cy, dx, dy) {
  // Sign of the cross product of direction(A→B) × direction(C→D)
  const v = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  return v > 0 ? 1 : -1;
}

function moveRopeEnd(board, fromPeg, toPeg) {
  // Move the rope end at fromPeg to toPeg.
  //
  // Picking up the end puts it on the top layer. As it drags across other
  // ropes, it always goes OVER them (since it's on top). The z-order of
  // the crossed rope determines whether it's an "over-under" or "over-over"
  // interaction, which affects the twist sign.
  //
  // The straight-line path from fromPeg to toPeg determines which ropes
  // are crossed.
  const re = board.ropeAtPeg[fromPeg];
  if (!re) throw new Error(`No rope end at peg ${fromPeg}`);
  if (board.ropeAtPeg[toPeg] !== null) throw new Error(`Peg ${toPeg} is occupied`);

  const ropeIdx = re.rope;
  const endIdx = re.end;
  const p1 = board.pegs[fromPeg];
  const p2 = board.pegs[toPeg];

  // The picked-up rope goes to the top layer BEFORE crossing detection.
  // This means the dragged end is always above any rope it crosses.
  board.zCounter++;
  board.zOrder[ropeIdx] = board.zCounter;

  // Check which other ropes are crossed by the path from fromPeg to toPeg.
  for (let j = 0; j < board.ropes.length; j++) {
    if (j === ropeIdx) continue;
    const other = board.ropes[j];
    const c = board.pegs[other.pegs[0]];
    const d = board.pegs[other.pegs[1]];
    const hit = segmentsIntersect(p1.x, p1.y, p2.x, p2.y, c.x, c.y, d.x, d.y);
    if (hit) {
      // The dragged rope is on top (just raised to highest z).
      // The geometric cross product gives the rotational direction.
      // We use canonical ordering (flip when ropeIdx > j) so that
      // braiding accumulates: A over B then B over A = 2 twists.
      let sign = crossSign(p1.x, p1.y, p2.x, p2.y, c.x, c.y, d.x, d.y);
      if (ropeIdx > j) sign = -sign;
      board.twists[ropeIdx][j] += sign;
      board.twists[j][ropeIdx] += sign;
    }
  }

  // Update peg assignments
  board.ropes[ropeIdx].pegs[endIdx] = toPeg;
  board.ropeAtPeg[toPeg] = re;
  board.ropeAtPeg[fromPeg] = null;
}

function getZOrder(board, ropeIdx) {
  return board.zOrder[ropeIdx];
}

function getTwist(board, ropeA, ropeB) {
  return board.twists[ropeA][ropeB];
}

function totalTwists(board) {
  let t = 0;
  for (let i = 0; i < board.ropes.length; i++) {
    for (let j = i + 1; j < board.ropes.length; j++) {
      t += Math.abs(board.twists[i][j]);
    }
  }
  return t;
}

function printBoard(board) {
  console.log('Pegs:', board.pegs.map((p, i) => `${i}:(${p.x},${p.y})`).join('  '));
  console.log('Ropes:', board.ropes.map((r, i) => `R${i}:${r.pegs[0]}-${r.pegs[1]}`).join('  '));
  console.log('RopeAtPeg:', board.ropeAtPeg.map((r, i) =>
    r ? `${i}:R${r.rope}e${r.end}` : `${i}:_`).join('  '));
  console.log('Twists:', JSON.stringify(board.twists));
  console.log('Total twists:', totalTwists(board));
  console.log();
}

module.exports = { createBoard, moveRopeEnd, getTwist, getZOrder, totalTwists, segmentsIntersect, crossSign, printBoard };
