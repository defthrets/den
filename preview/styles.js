// Wall + floor style presets.
//
// Each style is procedural — base colour fields are used by the existing
// renderer; optional `pattern` is a function (ctx, panel) that draws an
// overlay (damask, planks, tile grouting…) into a wall or floor area.
//
// Active style ids are kept on window.roomStyle so renderer.js and editor.js
// share them without a global.

const WALL_STYLES = [
  // Plain solids
  { id: 'beige',       name: 'Beige',       light: '#DDD0BA', dark: '#C4B49E', outline: '#9A8870' },
  { id: 'powder_blue', name: 'Powder blue', light: '#D8E1E8', dark: '#A8B5C5', outline: '#6E7F94' },
  { id: 'mint',        name: 'Mint',        light: '#C8DDC8', dark: '#A0B8A0', outline: '#6A8470' },
  { id: 'rose',        name: 'Rose',        light: '#E8C8C8', dark: '#C0A0A0', outline: '#8C6E6E' },
  { id: 'charcoal',    name: 'Charcoal',    light: '#4A4F58', dark: '#363B43', outline: '#1F2228' },

  // Victorian wallpaper — base colour + damask diamond motif drawn on top.
  { id: 'vict_red',    name: 'Vict. red',    light: '#7A2A28', dark: '#5C1F1E', outline: '#3A1414',
    pattern: 'damask', accent: '#C9A876' },
  { id: 'vict_green',  name: 'Vict. green',  light: '#2E4A38', dark: '#22382A', outline: '#162320',
    pattern: 'damask', accent: '#C9A876' },
  { id: 'vict_navy',   name: 'Vict. navy',   light: '#22324F', dark: '#1A263C', outline: '#0E1626',
    pattern: 'damask', accent: '#C9A876' },
];

const FLOOR_STYLES = [
  // id, name, topA (lighter checker), topB (darker checker), leftFace, rightFace, outline, pattern
  { id: 'stone',     name: 'Stone',     topA: '#C8B99A', topB: '#B5A688', leftFace: '#8A7A60', rightFace: '#9E8D70', outline: '#6E5E48' },
  { id: 'wood',      name: 'Wood',      topA: '#B08552', topB: '#9A7142', leftFace: '#6B4A28', rightFace: '#7C5530', outline: '#3F2A17',
    pattern: 'planks' },
  { id: 'concrete',  name: 'Concrete',  topA: '#A2A2A2', topB: '#8C8C8C', leftFace: '#5D5D5D', rightFace: '#6F6F6F', outline: '#3A3A3A' },
  { id: 'tile_w',    name: 'White tile',topA: '#EFEFEF', topB: '#D6D6D6', leftFace: '#A8A8A8', rightFace: '#BCBCBC', outline: '#7A7A7A' },
  { id: 'tile_d',    name: 'Dark tile', topA: '#3D3D44', topB: '#2A2A30', leftFace: '#181820', rightFace: '#22222A', outline: '#0A0A0E' },
  { id: 'marble',    name: 'Marble',    topA: '#E8E6DC', topB: '#D6D4C8', leftFace: '#9A988C', rightFace: '#B0AEA0', outline: '#6E6C60' },
  { id: 'brick',     name: 'Brick',     topA: '#8B3A2A', topB: '#722E22', leftFace: '#4E1F16', rightFace: '#5C261C', outline: '#2A0E0A',
    pattern: 'brick' },
];

const WALL_BY_ID  = Object.fromEntries(WALL_STYLES.map(s => [s.id, s]));
const FLOOR_BY_ID = Object.fromEntries(FLOOR_STYLES.map(s => [s.id, s]));

const roomStyle = {
  wallId:  'beige',
  floorId: 'stone',
};
window.roomStyle = roomStyle;

function currentWallStyle()  { return WALL_BY_ID[roomStyle.wallId]   || WALL_STYLES[0];  }
function currentFloorStyle() { return FLOOR_BY_ID[roomStyle.floorId] || FLOOR_STYLES[0]; }

// ── Wall overlay patterns ──────────────────────────────────────────────────
// `bL`, `bR` are screen-space bottom corners; `wh` is wall height in WORLD
// pixels (caller already multiplied by zoom for screen extent).
function drawWallPattern(ctx, style, pBL, pBR, wh, zoom) {
  if (style.pattern !== 'damask' || !style.accent) return;
  // Clip to the wall quad so the pattern doesn't leak above the wall top.
  const dxW  = pBR.sx - pBL.sx;
  const dyW  = pBR.sy - pBL.sy;
  const topL = { sx: pBL.sx, sy: pBL.sy - wh * zoom };
  const topR = { sx: pBR.sx, sy: pBR.sy - wh * zoom };
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pBL.sx, pBL.sy);
  ctx.lineTo(pBR.sx, pBR.sy);
  ctx.lineTo(topR.sx, topR.sy);
  ctx.lineTo(topL.sx, topL.sy);
  ctx.closePath();
  ctx.clip();

  const wallScreenW = Math.hypot(dxW, dyW);
  const cellW = Math.max(20, wallScreenW / 6);
  const cellH = cellW * 0.5;
  ctx.fillStyle = style.accent;
  ctx.globalAlpha = 0.45;
  const cols = Math.ceil(wallScreenW / cellW) + 1;
  const rows = Math.ceil((wh * zoom) / cellH) + 1;
  for (let r = 0; r < rows; r++) {
    const stagger = (r % 2) * 0.5;
    for (let c = -1; c < cols; c++) {
      const t = (c + stagger) / cols;
      const cxScreen = pBL.sx + dxW * t;
      const cyBase   = pBL.sy + dyW * t;
      const cy       = cyBase - r * cellH - cellH * 0.5;
      ctx.beginPath();
      ctx.moveTo(cxScreen,             cy - cellH * 0.30);
      ctx.lineTo(cxScreen + cellW*0.18, cy);
      ctx.lineTo(cxScreen,             cy + cellH * 0.30);
      ctx.lineTo(cxScreen - cellW*0.18, cy);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── Floor tile overlay patterns ────────────────────────────────────────────
// Draws on top of the diamond face after the base fill. `bounds` is the
// local-coords diamond inside ctx.save()/translate already applied by the
// caller. `w`, `dh` are screen-space tile dims.
function drawFloorPattern(ctx, style, w, dh, col, row) {
  if (style.pattern === 'planks') {
    // Wood planks: 3 horizontal-ish stripes per tile in iso space.
    // Lines run from W corner (0, dh/2) toward E corner (w, dh/2), staggered.
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.lineWidth = 0.8;
    for (let i = 1; i < 4; i++) {
      const yy = (i / 4) * dh;
      ctx.beginPath();
      // Iso diamond: at vertical offset yy from top, the width is yy*w/dh
      // (going wider until middle then narrower). Compute clamp via abs.
      const t = yy < dh / 2 ? yy / (dh / 2) : 1 - (yy - dh / 2) / (dh / 2);
      const halfW = (w / 2) * t;
      ctx.moveTo(w / 2 - halfW, yy);
      ctx.lineTo(w / 2 + halfW, yy);
      ctx.stroke();
    }
    ctx.restore();
  } else if (style.pattern === 'brick') {
    // Brick: tiny stagger seam across the middle of each tile.
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(w * 0.25, dh / 2);
    ctx.lineTo(w * 0.75, dh / 2);
    ctx.stroke();
    if ((col + row) % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(w / 2, dh * 0.25);
      ctx.lineTo(w / 2, dh * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  }
}
