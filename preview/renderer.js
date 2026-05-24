// Den preview renderer — mirrors mobile/lib/features/room/* exactly.
// Same isometric math, same colours, same avatar pixel layout.

// ── Constants ────────────────────────────────────────────────────────────
const TILE_W = 64;
const TILE_H = 32;
const TILE_W_HALF = TILE_W / 2;
const TILE_H_HALF = TILE_H / 2;
const ROOM_COLS = 10;
const ROOM_ROWS = 8;

// Boost 1.5 × zoom 2/3 = 1.0 → every source pixel = exactly 1 screen pixel.
// X/Y factors are 1.0 so we don't reintroduce fractional scaling. The
// "shorter/fatter" squish would break pixel alignment, so it's off.
const AVATAR_SCALE_BOOST = 1.5;
const AVATAR_X_FACTOR = 1.0;
const AVATAR_Y_FACTOR = 1.0;

// Sprite sheet layout (PixelLab create-character + template walk):
//   6 cols (walk-cycle frames) × 4 rows (facing direction). 92×92 each.
//   Rows: 0=south, 1=east, 2=north, 3=west.
const FRAME_W = 92;
const FRAME_H = 92;
const WALK_FRAMES = 6;
const DIR_S = 0, DIR_E = 1, DIR_N = 2, DIR_W = 3;

const WALK_DURATION = 0.35;        // seconds per tile-step (was 0.85)
const WALK_FRAME_DURATION = 0.09;  // walk-cycle frame duration (was 0.14)
// Speech bubble lifecycle: spawn at speaker's head → slow float up to
// settle line → hold briefly → pop (fade + small scale up). The rise is
// intentionally long so the eye can follow the message drifting upward.
const BUBBLE_TARGET_Y = 110;         // settle line, CSS px from top — sits just below the topbar.
const BUBBLE_RISE_TIME = 5.5;        // seconds to drift up to target (very slow, smooth)
const BUBBLE_HOLD_TIME = 1.2;        // seconds parked at target after arrival
const BUBBLE_FADE_TIME = 0.6;        // fade + pop duration
const BUBBLE_LIFETIME = BUBBLE_RISE_TIME + BUBBLE_HOLD_TIME + BUBBLE_FADE_TIME;
// Throttle: minimum gap (seconds) between consecutive bubbles from the
// same speaker — keeps the stack from blowing up under spam.
const BUBBLE_MIN_GAP = 0.4;
const _lastBubbleAt = {};

// Bump when regenerating sprites so the browser fetches the new PNGs.
const SPRITE_VERSION = 24;

const PAL = {
  skyTop:        '#1A2744',
  skyBottom:     '#2D4A7A',
  floorTopA:     '#C8B99A',
  floorTopB:     '#B5A688',
  floorLeftFace: '#8A7A60',
  floorRightFace:'#9E8D70',
  floorOutline:  '#6E5E48',
  wallLight:     '#DDD0BA',
  wallDark:      '#C4B49E',
  wallOutline:   '#9A8870',
  accent:        '#F5A623',
  friendDot:     '#88BBFF',
  bubbleFill:    '#FFFFFF',
  bubbleBorder:  '#202830',
  bubbleText:    '#1A1A2E',
};

// ── Iso math ────────────────────────────────────────────────────────────────
function tileToScreen(col, row) {
  return { x: (col - row) * TILE_W_HALF, y: (col + row) * TILE_H_HALF };
}
function screenToTile(sx, sy) {
  return {
    col: (sx / TILE_W_HALF + sy / TILE_H_HALF) / 2,
    row: (sy / TILE_H_HALF - sx / TILE_W_HALF) / 2,
  };
}
function tileDepth(col, row) { return (col + row) * 10; }

// ── Layered avatar rendering ────────────────────────────────────────────
// Templates and catalog live in wardrobe.js. We compose body + hair +
// shirt + pants at sprite-build time. AvatarConfig now carries style ids
// alongside colours so two avatars can mix-and-match.
// Dimensions of the design grid (wardrobe.js exposes the same as TPL_W/H)
const AVATAR_W = TPL_W;
const AVATAR_H = TPL_H;

function parseHex(hex) {
  if (hex[0] === '#') hex = hex.slice(1);
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
function rgbStr(r, g, b) { return `rgb(${r|0},${g|0},${b|0})`; }
function hexToRgba(hex, a) {
  const c = parseHex(hex);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}
function darken(hex, amt) {
  const c = parseHex(hex);
  return rgbStr(c.r * (1 - amt), c.g * (1 - amt), c.b * (1 - amt));
}
function lighten(hex, amt) {
  const c = parseHex(hex);
  return rgbStr(c.r + (255 - c.r) * amt, c.g + (255 - c.g) * amt, c.b + (255 - c.b) * amt);
}

// Resolve a pixel-art char into an RGBA byte tuple using the avatar config.
function resolveColor(ch, cfg) {
  switch (ch) {
    case '.': return null;
    case 'o': return [0, 0, 0, 255];
    case 'H': return rgbaFromCss(cfg.hair);
    case 'h': return rgbaFromCss(darken(cfg.hair, 0.30));
    case 'l': return rgbaFromCss(lighten(cfg.hair, 0.25));
    case 'S': return rgbaFromCss(cfg.skin);
    case 's': return rgbaFromCss(darken(cfg.skin, 0.20));
    case 'L': return rgbaFromCss(lighten(cfg.skin, 0.18));
    case 'e': return [26, 26, 46, 255];      // pupil
    case 'w': return [255, 255, 255, 255];    // eye white
    case 'B': return [58, 40, 32, 255];       // brow / mouth shadow
    case 'M': return [204, 102, 119, 255];    // mouth
    case '1': return rgbaFromCss(cfg.shirt);
    case '2': return rgbaFromCss(darken(cfg.shirt, 0.22));
    case '3': return rgbaFromCss(lighten(cfg.shirt, 0.18));
    case 'c': return rgbaFromCss(cfg.skin);
    case 'P': return rgbaFromCss(cfg.pants);
    case 'p': return rgbaFromCss(darken(cfg.pants, 0.22));
    case 'X': return [42, 42, 42, 255];
    case 'x': return [22, 22, 22, 255];
    default:  return null;
  }
}
function rgbaFromCss(css) {
  // Accepts '#rrggbb' or 'rgb(r,g,b)'
  if (css[0] === '#') {
    const c = parseHex(css);
    return [c.r, c.g, c.b, 255];
  }
  const m = css.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), 255];
}

function _at(tpl, x, y) {
  const row = tpl[y];
  if (!row) return '.';
  return row[x] || '.';
}

// Compose hair > shirt > pants > body and return the first non-'.' char.
function composedCharAt(x, y, cfg) {
  const hairTpl  = WARDROBE.hair[cfg.hairStyle].template;
  const shirtTpl = WARDROBE.shirt[cfg.shirtStyle].template;
  const pantsTpl = WARDROBE.pants[cfg.pantsStyle].template;

  let ch = _at(hairTpl, x, y);  if (ch !== '.') return ch;
  ch     = _at(shirtTpl, x, y); if (ch !== '.') return ch;
  ch     = _at(pantsTpl, x, y); if (ch !== '.') return ch;
  return _at(WARDROBE.body, x, y);
}

// Build an offscreen canvas with the composed avatar at 1:1 pixel scale.
function buildAvatarSprite(cfg) {
  const off = document.createElement('canvas');
  off.width = AVATAR_W;
  off.height = AVATAR_H;
  const octx = off.getContext('2d');
  const img = octx.createImageData(AVATAR_W, AVATAR_H);

  for (let y = 0; y < AVATAR_H; y++) {
    for (let x = 0; x < AVATAR_W; x++) {
      const ch = composedCharAt(x, y, cfg);
      if (ch === '.') continue;
      const px = resolveColor(ch, cfg);
      if (!px) continue;
      const idx = (y * AVATAR_W + x) * 4;
      img.data[idx]     = px[0];
      img.data[idx + 1] = px[1];
      img.data[idx + 2] = px[2];
      img.data[idx + 3] = px[3];
    }
  }
  octx.putImageData(img, 0, 0);
  return off;
}

// ── Canvas / state ───────────────────────────────────────────────────────
const canvas = document.getElementById('room');
const ctx = canvas.getContext('2d');

let zoom = 1;
let viewportW = 0, viewportH = 0;

const ROOM_CX = 32;
const ROOM_CY = 128;
const ROOM_W = 576;
const FACE_H = 5;
const WALL_H = 96;  // 3 tile-heights (32 × 3); display = 64

const me     = makeAvatar('me',     5, 5, true,  { preset: 'casual_blue_boy' });
const friend = makeAvatar('friend', 3, 3, false, { preset: 'casual_blue_girl' });
const avatars = [me, friend];

const bubbles = [];

function makeAvatar(userId, col, row, isMe, cfg) {
  const a = {
    userId, col, row, isMe, cfg,
    state: 'idle', target: null, walkT: 0, bob: Math.random() * Math.PI * 2,
    sprite: null,
    partSprites: null,   // populated when cfg.parts is set
    direction: DIR_S,
    walkFrame: 0,
    walkFrameTimer: 0,
    pathQueue: [],
    sittingOn: null,
    sittingIntent: null,
  };
  syncAvatarSprites(a);
  return a;
}

// Build a.sprite (single sheet) OR a.partSprites (4 layer sheets) based on
// cfg. Layered cfg.parts wins; falls back to cfg.preset for the legacy
// single-sheet path so existing call sites keep working.
function syncAvatarSprites(a) {
  if (a.cfg && a.cfg.parts) {
    a.partSprites = {};
    for (const layer of ['head', 'torso', 'legs', 'shoes']) {
      const preset = a.cfg.parts[layer];
      if (!preset) continue;
      const img = new Image();
      img.src = `sprites/${layer}_${preset}.png?v=${SPRITE_VERSION}`;
      a.partSprites[layer] = img;
    }
    a.sprite = null;
  } else {
    a.partSprites = null;
    const img = new Image();
    img.src = `sprites/${a.cfg.preset}.png?v=${SPRITE_VERSION}`;
    a.sprite = img;
  }
}

// 8-directional BFS path from (sc, sr) to (tc, tr), avoiding any tile
// that isTileBlocked() reports as solid. Diagonals are allowed only if
// at least one of the two adjacent cardinal tiles is also walkable —
// prevents the avatar from squeezing diagonally between two corners of
// solid furniture. Returns step tiles after the start, or null.
//
// opts.allowBlockedDest: lets the FINAL tile be solid (used when the
// player is walking to sit on a chair/couch — they want to land on the
// blocked tile itself, not next to it).
function findPath(sc, sr, tc, tr, opts) {
  opts = opts || {};
  if (sc === tc && sr === tr) return [];
  const blocked = (c, r) =>
    typeof isTileBlocked === 'function' && isTileBlocked(c, r);
  if (!opts.allowBlockedDest && blocked(tc, tr)) return null;
  const key = (c, r) => r * ROOM_COLS + c;
  const visited = new Set([key(sc, sr)]);
  const prev = new Map();
  const queue = [[sc, sr]];
  // Cardinals first so equal-cost paths prefer non-diagonal moves.
  const dirs = [
    [ 1,  0], [-1,  0], [ 0,  1], [ 0, -1],
    [ 1,  1], [-1,  1], [ 1, -1], [-1, -1],
  ];
  while (queue.length) {
    const [c, r] = queue.shift();
    for (const [dc, dr] of dirs) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= ROOM_COLS || nr < 0 || nr >= ROOM_ROWS) continue;
      const k = key(nc, nr);
      if (visited.has(k)) continue;
      const isDest = (nc === tc && nr === tr);
      // Skip solid tiles unless we're landing on the destination AND
      // the caller explicitly allows a blocked destination.
      if (blocked(nc, nr) && !(opts.allowBlockedDest && isDest)) continue;
      // Diagonal corner-cut protection: require at least one orthogonal
      // neighbour walkable so we don't slip between two diagonal blockers.
      if (dc !== 0 && dr !== 0) {
        if (blocked(c + dc, r) && blocked(c, r + dr)) continue;
      }
      visited.add(k);
      prev.set(k, [c, r]);
      if (nc === tc && nr === tr) {
        const out = [[nc, nr]];
        let curK = k;
        while (prev.has(curK)) {
          const [pc, pr] = prev.get(curK);
          if (pc === sc && pr === sr) break;
          out.unshift([pc, pr]);
          curK = key(pc, pr);
        }
        return out;
      }
      queue.push([nc, nr]);
    }
  }
  return null;
}

function directionFromMovement(dcol, drow) {
  // Work in screen space so "south" = visually down, not grid-row+.
  // Iso: screen_x ∝ (dcol - drow), screen_y ∝ (dcol + drow), with tile 64×32
  // so a unit of (dcol - drow) is twice as wide as a unit of (dcol + drow).
  const sx = dcol - drow;
  const sy = dcol + drow;
  if (Math.abs(2 * sx) > Math.abs(sy)) {
    return sx >= 0 ? DIR_E : DIR_W;
  }
  return sy >= 0 ? DIR_S : DIR_N;
}

// ── Layout ───────────────────────────────────────────────────────────────
function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;
  viewportW = rect.width;
  viewportH = rect.height;
  // Snap zoom to a clean fraction so source pixels downsample with a
  // consistent, repeating pattern instead of fractional aliasing. 2/3
  // keeps each pixel run uniform; 1/2 etc are picked when the viewport
  // is too narrow for 2/3. Upscaling only happens at integer multiples.
  const raw = viewportW / ROOM_W;
  const choices = [3, 2, 1, 2/3, 1/2, 1/3, 1/4];
  zoom = choices.reduce((best, z) =>
    Math.abs(z - raw) < Math.abs(best - raw) ? z : best, choices[choices.length - 1]);
}
window.addEventListener('resize', resize);
resize();

function worldToScreen(wx, wy) {
  return {
    sx: viewportW / 2 + (wx - ROOM_CX) * zoom,
    sy: viewportH / 2 + (wy - ROOM_CY) * zoom,
  };
}
function screenToWorld(sx, sy) {
  return {
    wx: (sx - viewportW / 2) / zoom + ROOM_CX,
    wy: (sy - viewportH / 2) / zoom + ROOM_CY,
  };
}

// ── Texture cache (PixelLab floor/wall PNGs) ───────────────────────────
const _texCache = {};
function loadTexture(name) {
  if (_texCache[name]) return _texCache[name];
  const img = new Image();
  img.src = `textures/${name}.png?v=${SPRITE_VERSION}`;
  _texCache[name] = img;
  return img;
}
// Built-in offset of the PixelLab iso tile inside the 64x64 canvas: the
// diamond's north corner sits at (32, 22) — see tools/generate-textures.
const FLOOR_TILE_NORTH_X = 32;
const FLOOR_TILE_NORTH_Y = 22;
const _wallPatternCache = {};
function wallPatternFor(styleId) {
  const tex = loadTexture(`wall_${styleId}`);
  if (!tex.complete || tex.naturalWidth === 0) return null;
  const key = `${styleId}@${zoom}`;
  if (_wallPatternCache[key]) return _wallPatternCache[key];
  return _wallPatternCache[key] = ctx.createPattern(tex, 'repeat');
}

// Integer-pixel screen position of a tile's NORTH corner. Snapping the
// half-tile step to integers means adjacent tiles always sit on a
// consistent pixel grid — fixes the seam jitter you get when
// TILE_W_HALF * zoom is fractional (e.g. 32 * 2/3 = 21.33).
function tileToScreenIntPx(col, row) {
  const dxHalf = Math.round(TILE_W_HALF * zoom);
  const dyHalf = Math.round(TILE_H_HALF * zoom);
  // Anchor the grid on tile (0,0)'s north corner via the regular projection
  // so the integer-grid origin matches the canvas centre's math.
  const origin = worldToScreen(0, -TILE_H_HALF);
  return {
    sx: Math.round(origin.sx + (col - row) * dxHalf),
    sy: Math.round(origin.sy + (col + row) * dyHalf),
  };
}

// ── Floor / walls ────────────────────────────────────────────────────────
function drawFloorTile(col, row) {
  // Snap floor tiles to an integer pixel grid so adjacent tiles tile
  // cleanly with no fractional-spacing seams. Avatars/furniture still use
  // the fractional projection so their motion stays smooth.
  const intPos = tileToScreenIntPx(col, row);
  const sx = intPos.sx, sy = intPos.sy;
  const w = TILE_W * zoom;
  const dh = TILE_H * zoom;
  const fh = FACE_H * zoom;
  const fs = (typeof currentFloorStyle === 'function') ? currentFloorStyle() : null;

  // PixelLab texture path: if a floor_<id>.png exists, drawImage it
  // and skip the procedural diamond entirely.
  if (fs) {
    const tex = loadTexture(`floor_${fs.id}`);
    if (tex.complete && tex.naturalWidth > 0) {
      // Texture dim in screen px — snap to integer so adjacent tiles use
      // identical width/height.
      const dw    = Math.round(tex.naturalWidth  * zoom);
      const dhTex = Math.round(tex.naturalHeight * zoom);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        tex,
        sx - Math.round(FLOOR_TILE_NORTH_X * zoom),
        sy - Math.round(FLOOR_TILE_NORTH_Y * zoom),
        dw, dhTex,
      );
      return;
    }
  }

  const topA = fs ? fs.topA : PAL.floorTopA;
  const topB = fs ? fs.topB : PAL.floorTopB;
  const leftFace = fs ? fs.leftFace : PAL.floorLeftFace;
  const rightFace = fs ? fs.rightFace : PAL.floorRightFace;
  const outline = fs ? fs.outline : PAL.floorOutline;
  const alt = (col + row) % 2 === 0;

  ctx.save();
  ctx.translate(Math.round(sx - w / 2), sy);

  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w,     dh / 2);
  ctx.lineTo(w / 2, dh);
  ctx.lineTo(0,     dh / 2);
  ctx.closePath();
  ctx.fillStyle = alt ? topB : topA;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 0.75;
  ctx.stroke();

  if (fs && fs.pattern && typeof drawFloorPattern === 'function') {
    drawFloorPattern(ctx, fs, w, dh, col, row);
  }

  ctx.beginPath();
  ctx.moveTo(0,     dh / 2);
  ctx.lineTo(w / 2, dh);
  ctx.lineTo(w / 2, dh + fh);
  ctx.lineTo(0,     dh / 2 + fh);
  ctx.closePath();
  ctx.fillStyle = leftFace;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w / 2, dh);
  ctx.lineTo(w,     dh / 2);
  ctx.lineTo(w,     dh / 2 + fh);
  ctx.lineTo(w / 2, dh + fh);
  ctx.closePath();
  ctx.fillStyle = rightFace;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBackRightWall() {
  const bL = tileToScreen(0, 0);          bL.y -= TILE_H_HALF;
  const bR = tileToScreen(ROOM_COLS, 0);  bR.y -= TILE_H_HALF;
  const s = (typeof currentWallStyle === 'function') ? currentWallStyle() : null;
  drawWallPanel(bL, bR, WALL_H, s ? s.light : PAL.wallLight, ROOM_COLS, s);
}
function drawBackLeftWall() {
  const bR = tileToScreen(0, 0);          bR.y -= TILE_H_HALF;
  const bL = tileToScreen(0, ROOM_ROWS);  bL.y -= TILE_H_HALF;
  const s = (typeof currentWallStyle === 'function') ? currentWallStyle() : null;
  drawWallPanel(bL, bR, WALL_H, s ? s.dark : PAL.wallDark, ROOM_ROWS, s);
}
function drawWallPanel(bLw, bRw, wh, fill, divisions, style) {
  const pBL = worldToScreen(bLw.x, bLw.y);
  const pBR = worldToScreen(bRw.x, bRw.y);
  const pTL = worldToScreen(bLw.x, bLw.y - wh);
  const pTR = worldToScreen(bRw.x, bRw.y - wh);

  // PixelLab wall texture path: tile the wall_<id>.png across the panel.
  // We skew the pattern so each repeat lays along the wall surface — that
  // way the texture follows the wall's iso angle instead of staying axis-
  // aligned on screen.
  const pat = style ? wallPatternFor(style.id) : null;
  if (pat) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pBL.sx, pBL.sy);
    ctx.lineTo(pBR.sx, pBR.sy);
    ctx.lineTo(pTR.sx, pTR.sy);
    ctx.lineTo(pTL.sx, pTL.sy);
    ctx.closePath();
    ctx.clip();
    // Tangent along the wall surface — one texture's worth of screen pixels.
    const tw = 64 * zoom;
    const wallScreenW = Math.hypot(pBR.sx - pBL.sx, pBR.sy - pBL.sy) || 1;
    const slopeX = (pBR.sx - pBL.sx) / wallScreenW * tw;
    const slopeY = (pBR.sy - pBL.sy) / wallScreenW * tw;
    // ctx.transform() MULTIPLIES into the existing matrix — preserves the
    // ctx.scale(dpr, dpr) we set in resize(). setTransform() would wipe
    // dpr scaling and break wall rendering on Retina / mobile screens.
    ctx.transform(
      slopeX / tw, slopeY / tw,    // x basis: along the wall
      0, 1,                         // y basis: straight down (vertical)
      pBL.sx, pBL.sy - wh * zoom,   // origin: top-left of wall quad
    );
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, wallScreenW, wh * zoom);
    ctx.restore();
    // Outline on top
    ctx.beginPath();
    ctx.moveTo(pBL.sx, pBL.sy);
    ctx.lineTo(pBR.sx, pBR.sy);
    ctx.lineTo(pTR.sx, pTR.sy);
    ctx.lineTo(pTL.sx, pTL.sy);
    ctx.closePath();
    ctx.strokeStyle = (style && style.outline) || PAL.wallOutline;
    ctx.lineWidth = 0.75;
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(pBL.sx, pBL.sy);
  ctx.lineTo(pBR.sx, pBR.sy);
  ctx.lineTo(pTR.sx, pTR.sy);
  ctx.lineTo(pTL.sx, pTL.sy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = (style && style.outline) || PAL.wallOutline;
  ctx.lineWidth = 0.75;
  ctx.stroke();

  if (style && style.pattern && typeof drawWallPattern === 'function') {
    drawWallPattern(ctx, style, pBL, pBR, wh, zoom);
  }

  // Mortar lines: derive a faint shade from the wall's outline colour so
  // they read as a subtle texture on every wall style instead of beige
  // showing through on dark/coloured walls. Patterned walls (Victorian)
  // skip them entirely so the damask reads cleanly.
  if (style && style.pattern) {
    return;
  }
  ctx.strokeStyle = (style && style.outline)
    ? hexToRgba(style.outline, 0.32)
    : 'rgba(154,136,112,0.35)';
  ctx.lineWidth = 0.5;
  for (let dy = 12 * zoom; dy < wh * zoom; dy += 14 * zoom) {
    ctx.beginPath();
    ctx.moveTo(pBL.sx, pBL.sy - dy);
    ctx.lineTo(pBR.sx, pBR.sy - dy);
    ctx.stroke();
  }
  ctx.beginPath();
  const dx = (pBR.sx - pBL.sx) / divisions;
  const dyT = (pBR.sy - pBL.sy) / divisions;
  for (let i = 1; i < divisions; i++) {
    const sx = pBL.sx + dx * i;
    const sy = pBL.sy + dyT * i;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, sy - wh * zoom);
  }
  ctx.stroke();
}

// ── Avatar ───────────────────────────────────────────────────────────────
function avatarWorldPos(a) {
  if (a.state === 'walking' && a.target) {
    const from = tileToScreen(a.col, a.row);
    const to   = tileToScreen(a.target.col, a.target.row);
    // Pure linear interpolation — constant velocity per tile so multi-tile
    // walks read as one continuous motion. easeInOut would peak at 2x speed
    // in the middle of a step, which looked like the last step "speeds up".
    const t = a.walkT;
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  }
  const p = tileToScreen(a.col, a.row);
  return { x: p.x, y: p.y };
}

// Empirically tuned so the character's feet sit flush on the tile.
// Lower values shift the whole sprite DOWN (more of the frame extends
// below the tile center). 0.93 was too high (feet floating);
// 0.87 was too low (feet through floor).
const FEET_ANCHOR_Y = 0.90;

function drawAvatar(a) {
  // Layered (head/torso/legs/shoes) when cfg.parts is set, otherwise
  // single-sheet legacy path. The layered path waits for all 4 parts to
  // be loaded before drawing anything to avoid one-frame flicker.
  const layered = a.partSprites && Object.keys(a.partSprites).length > 0;
  if (layered) {
    for (const layer of ['head', 'torso', 'legs', 'shoes']) {
      const img = a.partSprites[layer];
      if (!img || !img.complete || img.naturalWidth === 0) return;
    }
  } else if (!a.sprite || !a.sprite.complete || a.sprite.naturalWidth === 0) {
    return;
  }

  const { x: wx, y: wy } = avatarWorldPos(a);
  const { sx, sy } = worldToScreen(wx, wy);
  const scale = zoom * AVATAR_SCALE_BOOST;
  const w = FRAME_W * scale * AVATAR_X_FACTOR;
  const h = FRAME_H * scale * AVATAR_Y_FACTOR;
  const padBelowFeet = (1 - FEET_ANCHOR_Y) * h;

  // Shadow lives at the feet, not the frame bottom
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(sx, sy, 9 * scale, 2.6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Idle bob — also stops when sitting (you don't bob on a chair).
  const bob = a.state === 'idle' ? Math.sin(a.bob) * 0.5 * scale : 0;

  // Col = walk frame, row = facing direction.
  const frameCol = a.state === 'walking' ? a.walkFrame : 0;
  const frameRow = a.direction;

  // Sitting pose: raise the sprite so the feet land on the cushion of
  // the chair/couch instead of the floor. 16 source-px is roughly the
  // height of the seat above the tile centre at our sprite proportions.
  const sitLift = (a.state === 'sitting') ? 16 * scale : 0;

  ctx.imageSmoothingEnabled = false;
  const dstX = Math.round(sx - w / 2);
  const dstY = Math.round(sy - h + padBelowFeet + bob - sitLift);
  const dstW = Math.round(w);
  const dstH = Math.round(h);
  if (layered) {
    // All 4 layer sheets are the same dimensions and use the same
    // (col, row) frame index, so each drawImage stamps its band into
    // the correct slot of the composite.
    for (const layer of ['head', 'torso', 'legs', 'shoes']) {
      ctx.drawImage(
        a.partSprites[layer],
        frameCol * FRAME_W, frameRow * FRAME_H, FRAME_W, FRAME_H,
        dstX, dstY, dstW, dstH,
      );
    }
  } else {
    ctx.drawImage(
      a.sprite,
      frameCol * FRAME_W, frameRow * FRAME_H, FRAME_W, FRAME_H,
      dstX, dstY, dstW, dstH,
    );
  }

  // Username dot above head — also lifted while sitting.
  ctx.fillStyle = a.isMe ? PAL.accent : PAL.friendDot;
  ctx.beginPath();
  ctx.arc(sx, sy - h + padBelowFeet + bob - 5 - sitLift, 3 * Math.max(1, zoom), 0, Math.PI * 2);
  ctx.fill();
}

// ── Chat bubbles ─────────────────────────────────────────────────────────
function spawnBubble(a, text) {
  // Throttle: if this avatar just spoke, drop the new bubble. Keeps
  // spammy senders from burying the stack.
  const now = performance.now() / 1000;
  if (_lastBubbleAt[a.userId] != null
      && (now - _lastBubbleAt[a.userId]) < BUBBLE_MIN_GAP) {
    return;
  }
  _lastBubbleAt[a.userId] = now;

  const { x: wx, y: wy } = avatarWorldPos(a);
  const { sx, sy } = worldToScreen(wx, wy);
  // Spawn just above the avatar's head, not exactly at the sprite top.
  const headY = sy - FRAME_H * zoom * AVATAR_SCALE_BOOST * AVATAR_Y_FACTOR * FEET_ANCHOR_Y - 8;

  // Newest bubble settles at BUBBLE_TARGET_Y. Existing bubbles whose
  // settled X overlaps get pushed up the stack so we never overlap.
  const stackStep = 28;
  let targetY = BUBBLE_TARGET_Y;
  for (const b of bubbles) {
    // If horizontally near, bump the older one up by stackStep.
    if (Math.abs(b.sx - sx) < 80 && b.targetY >= targetY - 4) {
      b.targetY -= stackStep;
    }
  }

  bubbles.push({
    userId: a.userId,
    text,
    sx,
    sy: headY,          // start above the speaker's head
    startY: headY,
    targetY,            // animate up to here
    age: 0,
    lifetime: BUBBLE_LIFETIME,
  });
}

function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.age += dt;
    if (b.age >= b.lifetime) {
      bubbles.splice(i, 1);
      continue;
    }
    // Rise phase: gentle ease-out (quadratic) over BUBBLE_RISE_TIME
    // so the bubble drifts upward smoothly rather than snapping up.
    const t = Math.min(1, b.age / BUBBLE_RISE_TIME);
    const e = 1 - (1 - t) * (1 - t);
    b.sy = b.startY + (b.targetY - b.startY) * e;
  }
}

function drawBubbles() {
  ctx.font = 'bold 14px "Pixelify Sans", "Courier New", monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  for (const b of bubbles) {
    const fadeStart = BUBBLE_LIFETIME - BUBBLE_FADE_TIME;
    let alpha = 1;
    let scale = 1;
    if (b.age >= fadeStart) {
      // Final 0.5s — fade out + small pop scale-up.
      const f = (b.age - fadeStart) / BUBBLE_FADE_TIME;
      alpha = Math.max(0, 1 - f);
      scale = 1 + 0.18 * f;
    } else {
      // Pop-in: scale up briefly at spawn.
      const popIn = Math.min(1, b.age / 0.15);
      scale = 0.6 + 0.4 * popIn;
      alpha = popIn;
    }
    // Tail visible only while still attached to speaker (rise phase).
    const withTail = b.age < BUBBLE_RISE_TIME * 0.5;
    drawSpeechBubble(b.sx, b.sy, b.text, alpha, withTail, scale);
  }
}

function drawSpeechBubble(cx, cy, text, alpha, withTail, scale) {
  const padX = 10, padY = 6;
  const maxW = 220;
  const m = ctx.measureText(text);
  const w = Math.min(maxW, m.width + padX * 2);
  const h = 24;
  const x = Math.round(cx - w / 2);
  const y = Math.round(cy - h);
  const r = 12;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (scale && scale !== 1) {
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  roundedRect(x + 1, y + 2, w, h, r);
  ctx.fill();

  // Bubble
  ctx.fillStyle = PAL.bubbleFill;
  roundedRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = PAL.bubbleBorder;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Tail (only briefly, while bubble is fresh)
  if (withTail) {
    ctx.beginPath();
    ctx.moveTo(cx - 5, y + h - 0.5);
    ctx.lineTo(cx + 0, y + h + 6);
    ctx.lineTo(cx + 5, y + h - 0.5);
    ctx.closePath();
    ctx.fillStyle = PAL.bubbleFill;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 5, y + h);
    ctx.lineTo(cx + 0, y + h + 6);
    ctx.lineTo(cx + 5, y + h);
    ctx.strokeStyle = PAL.bubbleBorder;
    ctx.stroke();
  }

  // Text
  ctx.fillStyle = PAL.bubbleText;
  let toDraw = text;
  if (m.width > maxW - padX * 2) {
    // Ellipsise
    while (toDraw.length > 4 && ctx.measureText(toDraw + '…').width > maxW - padX * 2) {
      toDraw = toDraw.slice(0, -1);
    }
    toDraw += '…';
  }
  ctx.textAlign = 'center';
  ctx.fillText(toDraw, cx, y + h / 2 + 0.5);

  ctx.restore();
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Helpers ──────────────────────────────────────────────────────────────
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

// ── Render loop ──────────────────────────────────────────────────────────
function frame(dtMs) {
  const dt = Math.min(dtMs / 1000, 0.05);

  for (const a of avatars) {
    a.bob += dt * 2.5;
    if (a.state === 'walking' && a.target) {
      a.walkT = Math.min(1, a.walkT + dt / WALK_DURATION);

      // Face the direction we're walking
      a.direction = directionFromMovement(a.target.col - a.col, a.target.row - a.row);

      a.walkFrameTimer += dt;
      if (a.walkFrameTimer >= WALK_FRAME_DURATION) {
        a.walkFrame = (a.walkFrame + 1) % WALK_FRAMES;
        a.walkFrameTimer = 0;
      }

      if (a.walkT >= 1) {
        a.col = a.target.col; a.row = a.target.row;
        a.target = null; a.walkT = 0;
        // Pop the next queued step (skip any that became blocked since
        // being queued — UNLESS it's the final step and we have a
        // sitting intent armed for that tile).
        while (a.pathQueue && a.pathQueue.length) {
          const next = a.pathQueue.shift();
          if (next.col === a.col && next.row === a.row) continue;
          const isFinal = a.pathQueue.length === 0;
          const sitDest = a.sittingIntent
            && next.col === a.sittingIntent.col
            && next.row === a.sittingIntent.row
            && isFinal;
          if (typeof isTileBlocked === 'function'
              && isTileBlocked(next.col, next.row)
              && !sitDest) continue;
          a.target = next;
          break;
        }
        if (!a.target) {
          // Either we hit the seat tile or just stopped walking.
          if (a.sittingIntent
              && a.col === a.sittingIntent.col
              && a.row === a.sittingIntent.row) {
            a.state = 'sitting';
            a.sittingOn = a.sittingIntent.furnitureIndex;
            a.direction = DIR_S;
            a.walkFrame = 0;
          } else {
            a.state = 'idle';
            a.walkFrame = 0; a.walkFrameTimer = 0;
          }
          a.sittingIntent = null;
        }
      }
    }
  }
  updateBubbles(dt);

  ctx.clearRect(0, 0, viewportW, viewportH);

  // Draw list
  const items = [];
  items.push({ depth: -100, draw: drawBackRightWall });
  items.push({ depth: -99,  draw: drawBackLeftWall });
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      items.push({ depth: tileDepth(c, r), draw: () => drawFloorTile(c, r) });
    }
  }
  // Layer system so rugs/floor decals always sit BELOW everything that
  // stands on the floor, regardless of which tile they're on:
  //   floor tiles:       tile_depth                    (~0–160)
  //   floor decals/rugs: 500 + tile_depth              (500–660)
  //   3D furniture:      1000 + tile_depth + 2         (1002–1162)
  //   avatars:           1000 + tile_depth + 5         (1005–1165)
  // Furniture + avatars share the 1000 base so they still depth-sort
  // correctly against each other across tiles.
  const pickedUpIdx = window.editor?.state?.pickedUpIndex ?? -1;
  const selectedIdx = window.editor?.state?.selectedPlacedIndex ?? -1;
  const dragCol = window.editor?.state?.dragCol;
  const dragRow = window.editor?.state?.dragRow;
  for (let i = 0; i < ROOM_FURNITURE.length; i++) {
    let f = ROOM_FURNITURE[i];
    const pickedUp = i === pickedUpIdx;
    const selected = i === selectedIdx;
    // While dragging, render the picked-up item at the drag tile so it
    // visually follows the cursor/finger.
    if (pickedUp && dragCol != null && dragRow != null) {
      f = { ...f, col: dragCol, row: dragRow };
    }
    const meta = FURNITURE_BY_ID[f.id];
    const isFloor = meta?.layer === 'floor';
    const base = isFloor ? 500 : 1000;
    const offset = isFloor ? 0 : 2;
    const depth = pickedUp ? 5000 : base + tileDepth(f.col, f.row) + offset;
    items.push({ depth, draw: () => drawFurniture(f, { pickedUp, selected }) });
  }
  for (const a of avatars) {
    // Linear t everywhere so depth-sort lerp matches avatarWorldPos exactly.
    const t = (a.state === 'walking' && a.target) ? a.walkT : 0;
    const liveCol = a.state === 'walking' && a.target
      ? a.target.col * t + a.col * (1 - t)
      : a.col;
    const liveRow = a.state === 'walking' && a.target
      ? a.target.row * t + a.row * (1 - t)
      : a.row;
    items.push({ depth: 1000 + tileDepth(Math.round(liveCol), Math.round(liveRow)) + 5, draw: () => drawAvatar(a) });
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();

  // Bubbles render last, on top of everything in the world.
  drawBubbles();
}

let last = performance.now();
function loop(now) {
  frame(now - last);
  last = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ── Input: tap to walk ──────────────────────────────────────────────────
// Pointer routing:
//   - In editor MOVE mode, pointerdown on a placed item starts a drag.
//     pointermove follows the cursor; pointerup drops at the current tile.
//   - In editor PLACE mode (default), pointerdown/up just records a tap
//     whose duration controls rotate (short) vs delete (long-press).
//   - Outside the editor, pointerup walks the avatar to the tile.
let _downAt = 0;
let _downTile = null;
let _downPixel = null;
let _dragging = false;

function pixelFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  return { px: e.clientX - rect.left, py: e.clientY - rect.top };
}

function tileFromEvent(e) {
  const { px, py } = pixelFromEvent(e);
  const { wx, wy } = screenToWorld(px, py);
  const t = screenToTile(wx, wy);
  const tc = Math.round(t.col);
  const tr = Math.round(t.row);
  if (tc < 0 || tc >= ROOM_COLS || tr < 0 || tr >= ROOM_ROWS) return null;
  return { col: tc, row: tr };
}

canvas.addEventListener('pointerdown', (e) => {
  const tile = tileFromEvent(e);
  if (!tile) return;
  _downAt = Date.now();
  _downTile = tile;
  _downPixel = pixelFromEvent(e);
  _dragging = false;

  // Move-mode pickup begins immediately on pointerdown — pixel-perfect
  // hit test picks up whichever piece the user actually touched.
  if (window.editor?.state.active && window.editor.state.mode === 'move') {
    const hit = (typeof furnitureAtPixel === 'function')
      ? furnitureAtPixel(_downPixel.px, _downPixel.py)
      : null;
    if (hit) {
      if (window.editor.onDragStartAtIndex
            ? window.editor.onDragStartAtIndex(hit.index, hit.item.col, hit.item.row)
            : window.editor.onDragStart(hit.item.col, hit.item.row)) {
        _dragging = true;
        canvas.setPointerCapture(e.pointerId);
      }
    }
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!_dragging) return;
  const tile = tileFromEvent(e);
  if (tile) window.editor.onDragMove(tile.col, tile.row);
});

canvas.addEventListener('pointerup', (e) => {
  if (!_downTile) return;
  const dur = Date.now() - _downAt;
  const tile = _downTile;
  _downTile = null;

  if (_dragging) {
    const dropTile = tileFromEvent(e) || tile;
    window.editor.onDragEnd(dropTile.col, dropTile.row);
    _dragging = false;
    return;
  }

  // Editor intercepts taps (place / select / rotate / delete).
  // Pass both the tile (for placement target) and pixel hit (for picking
  // a placed piece by its sprite, not by the tile beneath it).
  if (window.editor && window.editor.state.active) {
    const pix = pixelFromEvent(e);
    const hit = (typeof furnitureAtPixel === 'function')
      ? furnitureAtPixel(pix.px, pix.py)
      : null;
    window.editor.onTileClick(tile.col, tile.row, dur, hit);
    return;
  }
  // Walk the avatar — but first, check if the user tapped a SITTABLE
  // furniture piece. If so, path to its seat tile (which is normally
  // blocked) and arm the sitting intent so we transition to the seated
  // pose on arrival.
  let sitTarget = null;
  if (typeof furnitureAtPixel === 'function') {
    const pix2 = pixelFromEvent(e);
    const hit2 = furnitureAtPixel(pix2.px, pix2.py);
    if (hit2) {
      const meta = FURNITURE_BY_ID[hit2.item.id];
      if (meta && meta.sittable) {
        const [sdx, sdy] = meta.seatTile || [0, 0];
        sitTarget = { col: hit2.item.col + sdx, row: hit2.item.row + sdy,
                      furnitureIndex: hit2.index };
      }
    }
  }
  // If not sitting and the destination tile is blocked, ignore the click.
  if (!sitTarget &&
      typeof isTileBlocked === 'function' && isTileBlocked(tile.col, tile.row)) {
    return;
  }
  // Tapping somewhere ELSE while seated stands you up.
  if (!sitTarget && me.sittingOn != null) {
    me.sittingOn = null;
    me.state = 'idle';
  }
  // Compute path from where the avatar will END UP after the current
  // step (= me.target if walking, else its current tile).
  const fromCol = (me.state === 'walking' && me.target) ? me.target.col : me.col;
  const fromRow = (me.state === 'walking' && me.target) ? me.target.row : me.row;
  const destCol = sitTarget ? sitTarget.col : tile.col;
  const destRow = sitTarget ? sitTarget.row : tile.row;
  const path = findPath(fromCol, fromRow, destCol, destRow,
                         sitTarget ? { allowBlockedDest: true } : undefined);
  if (!path || path.length === 0) {
    // Already on the seat tile → sit immediately.
    if (sitTarget && me.col === destCol && me.row === destRow) {
      me.sittingOn = sitTarget.furnitureIndex;
      me.state = 'sitting';
      me.direction = DIR_S;
      me.walkFrame = 0;
    }
    return;
  }
  // Pass the sitting intent through to the walk-step loop so the final
  // blocked tile is accepted instead of skipped.
  me.sittingIntent = sitTarget;
  // Replace any previously-queued steps with the new path. Current step
  // (if any) finishes first; subsequent steps come from the new path.
  me.pathQueue.length = 0;
  if (me.state === 'walking' && me.target) {
    for (const [c, r] of path) me.pathQueue.push({ col: c, row: r });
  } else {
    me.target = { col: path[0][0], row: path[0][1] };
    me.state = 'walking';
    me.walkT = 0;
    for (let i = 1; i < path.length; i++) {
      me.pathQueue.push({ col: path[i][0], row: path[i][1] });
    }
  }
});

canvas.addEventListener('pointercancel', () => {
  if (_dragging) { window.editor.cancelDrag(); _dragging = false; }
  _downTile = null;
});

// ── Chat input interactions ────────────────────────────────────────────
const input    = document.getElementById('msgInput');
const sendBtn  = document.getElementById('sendBtn');
const keyboard = document.getElementById('keyboard');

// Detect touch devices — on a real phone the OS keyboard appears
// natively, so the faux keyboard would be a duplicate. We only show
// the surrogate keyboard on desktop / non-touch browsers.
const isTouchDevice = matchMedia('(pointer: coarse)').matches
                    || (navigator.maxTouchPoints > 0);
const inputBar = document.querySelector('.input-bar');
function openKeyboard()  {
  if (isTouchDevice) return;  // OS keyboard handles it
  keyboard.classList.add('open');
  inputBar.classList.add('kbd-open');
}
function closeKeyboard() {
  if (isTouchDevice) return;
  keyboard.classList.remove('open');
  inputBar.classList.remove('kbd-open');
}
input.addEventListener('focus', openKeyboard);
input.addEventListener('blur',  closeKeyboard);
// Hint the OS keyboard to show a "send" enter key.
input.setAttribute('enterkeyhint', 'send');
// On mobile, lift the input bar above the OS keyboard. The layout
// viewport stays the same height when iOS opens the keyboard, so we
// track the visual viewport's height + offset and translate the bar up
// by the missing pixels. Using transform instead of `bottom` so the
// CSS `bottom: 0` rule still anchors it normally when no keyboard.
if (isTouchDevice && window.visualViewport) {
  const vv = window.visualViewport;
  const sync = () => {
    const lift = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    inputBar.style.transform = `translateY(${-lift}px)`;
  };
  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  // iOS sometimes fires the visualViewport resize after focus by 150-300ms;
  // run sync on focus too so the bar lifts immediately when known.
  input.addEventListener('focus', () => {
    sync();
    setTimeout(sync, 100);
    setTimeout(sync, 350);
  });
  input.addEventListener('blur', () => {
    inputBar.style.transform = '';
  });
  sync();
}

sendBtn.addEventListener('click', send);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

function send() {
  const t = input.value.trim();
  if (!t) return;
  spawnBubble(me, t);
  input.value = '';

  // Demo friend echo
  setTimeout(() => {
    const replies = ['cool', 'haha', 'nice', 'yeah?', 'love it', 'totally', 'lol'];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    spawnBubble(friend, reply);
  }, 1200);
}

// Welcome bubble on load
setTimeout(() => spawnBubble(friend, 'hey welcome to my den :)'), 600);

// ── Expose helpers for the customiser modal ───────────────────────────
window.den = {
  me,
  friend,
  avatars,    // exposed so friends.js / public-rooms.js can add/remove NPCs
  makeAvatar, // for NPC spawning
  presets: [
    // Boys (shared anatomy + skin)
    { id: 'casual_blue_boy',    name: 'Casual',  body: 'boy'  },
    { id: 'punk_red_boy',       name: 'Punk',    body: 'boy'  },
    { id: 'preppy_boy',         name: 'Preppy',  body: 'boy'  },
    { id: 'nerd_kid',           name: 'Nerd',    body: 'boy'  },
    { id: 'athlete_boy',        name: 'Athlete', body: 'boy'  },
    { id: 'hoodie_boy',         name: 'Hoodie',  body: 'boy'  },
    // Girls (shared anatomy + skin)
    { id: 'casual_blue_girl',   name: 'Casual',  body: 'girl' },
    { id: 'blonde_yellow_girl', name: 'Sunny',   body: 'girl' },
    { id: 'goth_girl',          name: 'Goth',    body: 'girl' },
    { id: 'punk_girl',          name: 'Punk',    body: 'girl' },
    { id: 'preppy_girl',        name: 'Preppy',  body: 'girl' },
    { id: 'floral_girl',        name: 'Floral',  body: 'girl' },
  ],
  FRAME_W,
  FRAME_H,
  SPRITE_VERSION,
  setPreset(avatar, presetId) {
    // Setting a full preset clears any layered parts so the user gets a
    // clean single-sheet character.
    avatar.cfg = { preset: presetId };
    syncAvatarSprites(avatar);
  },
  setParts(avatar, parts) {
    // parts = { head, torso, legs, shoes } — each is a preset id.
    avatar.cfg = { parts: { ...parts } };
    syncAvatarSprites(avatar);
  },
};
