// A character's face, in its little frame by the health bars of a fight (fight.js: thine, bigger,
// and each of the others'): its head and shoulders, cut out of the first drawing of its idle pose
// (a square `crop` of its height from just over the top of its head, `over`, on the column its
// middle stands on; a rig may nudge it, its `face`: { x, y, crop }), drawn crisp, what glows in it
// glowing, into a canvas `size` CSS pixels square (game.css, .face).

const FACE = { crop: 0.36, over: 0.05, least: 10 };

export function drawFace(canvas, sheet, size) {
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(1, Math.round(size * dpr));
  if (canvas.width !== W || canvas.height !== W) {
    canvas.width = W;
    canvas.height = W;
  }
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, W, W);
  if (!sheet) return;
  const def = sheet.anims.idle || Object.values(sheet.anims)[0];
  const i = def.frames[0];
  // (the sheet the drawing is in: a big pose's own, heroes/core.js)
  const slot = sheet.slots?.[i];
  const grid = slot?.big ? sheet.big : sheet;
  const at = slot ? slot.k : i;
  const { frameW: FW, frameH: FH } = grid;
  const nudge = sheet.rig?.face || {};
  // (its feet on the frame's last row, its head `head` over them: heroes/core.js)
  const S = Math.min(FW, FH, Math.max(FACE.least, Math.round(sheet.head * (nudge.crop ?? FACE.crop))));
  const anchor = grid.anchor ?? FW / 2;
  const left = Math.max(0, Math.min(FW - S, Math.round(anchor - S / 2 + (nudge.x || 0))));
  const top = Math.max(0, Math.min(FH - S, Math.round(FH - sheet.head - S * FACE.over + (nudge.y || 0))));
  const sx = (at % grid.cols) * FW + left;
  const sy = Math.floor(at / grid.cols) * FH + top;
  g.imageSmoothingEnabled = false;
  g.drawImage(grid.color, sx, sy, S, S, 0, 0, W, W);
  if (grid.glow) {
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.45;
    g.drawImage(grid.glow, sx, sy, S, S, 0, 0, W, W);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
}
