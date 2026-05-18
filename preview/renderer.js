// Den preview renderer — mirrors mobile/lib/features/room/* exactly.
// Same isometric math, same colours, same avatar pixel layout.

// ── Constants ────────────────────────────────────────────────────────────
const TILE_W = 64;
const TILE_H = 32;
const TILE_W_HALF = TILE_W / 2;
const TILE_H_HALF = TILE_H / 2;
const ROOM_COLS = 10;
const ROOM_ROWS = 8;

const AVATAR_SCALE_BOOST = 4.0;   // chunky Habbo-scale avatars

// Sprite sheet layout (rd_animation__small_sprites): 5 cols × 4 rows of 32×32 frames.
// Rows = facing direction (S, E, N, W). Cols 0-1 = walk cycle, col 2 = arm wave,
// col 3 = looking, col 4 = surprised / lay down.
const FRAME_W = 32;
const FRAME_H = 32;
const DIR_S = 0, DIR_E = 1, DIR_N = 2, DIR_W = 3;

const WALK_DURATION = 0.85;        // seconds per tile
const WALK_FRAME_DURATION = 0.22;  // seconds per walk-cycle frame
const BUBBLE_LIFETIME = 4.5;
const BUBBLE_RISE_SPEED = 26;

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
const WALL_H = 64;

const me     = makeAvatar('me',     5, 5, true,  { preset: 'casual_blue' });
const friend = makeAvatar('friend', 3, 3, false, { preset: 'tank_redhead' });
const avatars = [me, friend];

const bubbles = [];

function makeAvatar(userId, col, row, isMe, cfg) {
  const a = {
    userId, col, row, isMe, cfg,
    state: 'idle', target: null, walkT: 0, bob: Math.random() * Math.PI * 2,
    sprite: null,
    direction: DIR_S,
    walkFrame: 0,
    walkFrameTimer: 0,
  };
  a.sprite = new Image();
  a.sprite.src = `sprites/${cfg.preset}.png`;
  return a;
}

function directionFromMovement(dcol, drow) {
  if (Math.abs(dcol) >= Math.abs(drow)) {
    return dcol >= 0 ? DIR_E : DIR_W;
  }
  return drow >= 0 ? DIR_S : DIR_N;
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
  zoom = (viewportW * 0.92) / ROOM_W;
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

// ── Floor / walls ────────────────────────────────────────────────────────
function drawFloorTile(col, row) {
  const c = tileToScreen(col, row);
  const { sx, sy } = worldToScreen(c.x, c.y - TILE_H_HALF);
  const w = TILE_W * zoom;
  const dh = TILE_H * zoom;
  const fh = FACE_H * zoom;
  const alt = (col + row) % 2 === 0;

  ctx.save();
  ctx.translate(sx - w / 2, sy);

  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w,     dh / 2);
  ctx.lineTo(w / 2, dh);
  ctx.lineTo(0,     dh / 2);
  ctx.closePath();
  ctx.fillStyle = alt ? PAL.floorTopB : PAL.floorTopA;
  ctx.fill();
  ctx.strokeStyle = PAL.floorOutline;
  ctx.lineWidth = 0.75;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0,     dh / 2);
  ctx.lineTo(w / 2, dh);
  ctx.lineTo(w / 2, dh + fh);
  ctx.lineTo(0,     dh / 2 + fh);
  ctx.closePath();
  ctx.fillStyle = PAL.floorLeftFace;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w / 2, dh);
  ctx.lineTo(w,     dh / 2);
  ctx.lineTo(w,     dh / 2 + fh);
  ctx.lineTo(w / 2, dh + fh);
  ctx.closePath();
  ctx.fillStyle = PAL.floorRightFace;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBackRightWall() {
  const bL = tileToScreen(0, 0);          bL.y -= TILE_H_HALF;
  const bR = tileToScreen(ROOM_COLS, 0);  bR.y -= TILE_H_HALF;
  drawWallPanel(bL, bR, WALL_H, PAL.wallLight, ROOM_COLS);
}
function drawBackLeftWall() {
  const bR = tileToScreen(0, 0);          bR.y -= TILE_H_HALF;
  const bL = tileToScreen(0, ROOM_ROWS);  bL.y -= TILE_H_HALF;
  drawWallPanel(bL, bR, WALL_H, PAL.wallDark, ROOM_ROWS);
}
function drawWallPanel(bLw, bRw, wh, fill, divisions) {
  const pBL = worldToScreen(bLw.x, bLw.y);
  const pBR = worldToScreen(bRw.x, bRw.y);
  const pTL = worldToScreen(bLw.x, bLw.y - wh);
  const pTR = worldToScreen(bRw.x, bRw.y - wh);

  ctx.beginPath();
  ctx.moveTo(pBL.sx, pBL.sy);
  ctx.lineTo(pBR.sx, pBR.sy);
  ctx.lineTo(pTR.sx, pTR.sy);
  ctx.lineTo(pTL.sx, pTL.sy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = PAL.wallOutline;
  ctx.lineWidth = 0.75;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(154,136,112,0.35)';
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
    const t = easeInOut(a.walkT);
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  }
  const p = tileToScreen(a.col, a.row);
  return { x: p.x, y: p.y };
}

function drawAvatar(a) {
  if (!a.sprite.complete || a.sprite.naturalWidth === 0) return;

  const { x: wx, y: wy } = avatarWorldPos(a);
  const { sx, sy } = worldToScreen(wx, wy);
  const scale = zoom * AVATAR_SCALE_BOOST;
  const w = FRAME_W * scale;
  const h = FRAME_H * scale;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(sx, sy - 1, 9 * scale, 2.6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Idle bob
  const bob = a.state === 'idle' ? Math.sin(a.bob) * 0.5 * scale : 0;

  // Pick the right cell from the sheet
  const frameCol = a.state === 'walking' ? a.walkFrame : 0;
  const frameRow = a.direction;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    a.sprite,
    frameCol * FRAME_W, frameRow * FRAME_H, FRAME_W, FRAME_H,
    Math.round(sx - w / 2), Math.round(sy - h + bob), Math.round(w), Math.round(h),
  );

  // Username dot above head
  ctx.fillStyle = a.isMe ? PAL.accent : PAL.friendDot;
  ctx.beginPath();
  ctx.arc(sx, sy - h + bob - 5, 3 * Math.max(1, zoom), 0, Math.PI * 2);
  ctx.fill();
}

// ── Chat bubbles ─────────────────────────────────────────────────────────
function spawnBubble(a, text) {
  const { x: wx, y: wy } = avatarWorldPos(a);
  const { sx, sy } = worldToScreen(wx, wy);
  const headY = sy - FRAME_H * zoom * AVATAR_SCALE_BOOST - 4;

  // Push older bubbles from this avatar higher to stack neatly
  for (const b of bubbles) {
    if (b.userId === a.userId && b.targetY > headY - 30) {
      b.targetY -= 24;
    }
  }

  bubbles.push({
    userId: a.userId,
    text,
    sx,
    sy: headY,
    targetY: headY,
    age: 0,
    lifetime: BUBBLE_LIFETIME,
  });
}

function updateBubbles(dt) {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.age += dt;
    b.targetY -= BUBBLE_RISE_SPEED * dt;
    // Ease toward target
    b.sy += (b.targetY - b.sy) * Math.min(1, dt * 6);
    if (b.age >= b.lifetime) bubbles.splice(i, 1);
  }
}

function drawBubbles() {
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  for (const b of bubbles) {
    const fadeStart = b.lifetime * 0.7;
    const alpha = b.age > fadeStart
      ? Math.max(0, 1 - (b.age - fadeStart) / (b.lifetime - fadeStart))
      : 1;
    const popIn = Math.min(1, b.age / 0.15);
    drawSpeechBubble(b.sx, b.sy, b.text, alpha * popIn, b.age < 0.4);
  }
}

function drawSpeechBubble(cx, cy, text, alpha, withTail) {
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

      // Update facing from the movement vector
      a.direction = directionFromMovement(a.target.col - a.col, a.target.row - a.row);

      // Cycle the walk frame (cols 0 ↔ 1)
      a.walkFrameTimer += dt;
      if (a.walkFrameTimer >= WALK_FRAME_DURATION) {
        a.walkFrame = 1 - a.walkFrame;
        a.walkFrameTimer = 0;
      }

      if (a.walkT >= 1) {
        a.col = a.target.col; a.row = a.target.row;
        a.target = null; a.state = 'idle'; a.walkT = 0;
        a.walkFrame = 0; a.walkFrameTimer = 0;
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
  for (const a of avatars) {
    const liveCol = a.state === 'walking' && a.target
      ? a.target.col * easeInOut(a.walkT) + a.col * (1 - easeInOut(a.walkT))
      : a.col;
    const liveRow = a.state === 'walking' && a.target
      ? a.target.row * easeInOut(a.walkT) + a.row * (1 - easeInOut(a.walkT))
      : a.row;
    items.push({ depth: tileDepth(Math.round(liveCol), Math.round(liveRow)) + 5, draw: () => drawAvatar(a) });
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
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const { wx, wy } = screenToWorld(px, py);
  const t = screenToTile(wx, wy);
  const tc = Math.round(t.col);
  const tr = Math.round(t.row);
  if (tc >= 0 && tc < ROOM_COLS && tr >= 0 && tr < ROOM_ROWS) {
    me.target = { col: tc, row: tr };
    me.state = 'walking';
    me.walkT = 0;
  }
});

// ── Chat input interactions ────────────────────────────────────────────
const input    = document.getElementById('msgInput');
const sendBtn  = document.getElementById('sendBtn');
const keyboard = document.getElementById('keyboard');

// Show the faux keyboard whenever the input is focused. On a real device,
// the OS keyboard slides up and Flutter's MediaQuery.viewInsets handles
// the layout shift — this is just the preview's visual surrogate.
const inputBar = document.querySelector('.input-bar');
function openKeyboard()  { keyboard.classList.add('open');    inputBar.classList.add('kbd-open');    }
function closeKeyboard() { keyboard.classList.remove('open'); inputBar.classList.remove('kbd-open'); }
input.addEventListener('focus', openKeyboard);
input.addEventListener('blur',  closeKeyboard);

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
  presets: [
    { id: 'casual_blue',   name: 'Casual' },
    { id: 'tank_redhead',  name: 'Tank'   },
    { id: 'punk_purple',   name: 'Punk'   },
    { id: 'summer_yellow', name: 'Summer' },
  ],
  FRAME_W,
  FRAME_H,
  setPreset(avatar, presetId) {
    avatar.cfg = { ...avatar.cfg, preset: presetId };
    avatar.sprite = new Image();
    avatar.sprite.src = `sprites/${presetId}.png`;
  },
};
