// Den preview renderer — mirrors mobile/lib/features/room/* exactly.
// Same isometric math, same colours, same avatar pixel layout.

const TILE_W = 64;
const TILE_H = 32;
const TILE_W_HALF = TILE_W / 2;
const TILE_H_HALF = TILE_H / 2;
const ROOM_COLS = 10;
const ROOM_ROWS = 8;

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
  skinA:         '#FFCC99',
  hairBrown:     '#4A3728',
  hairDark:      '#1A1A6E',
  shirtBlue:     '#4488CC',
  shirtRed:      '#CC4444',
  pantsNavy:     '#2244AA',
  shoeBlack:     '#2A2A2A',
  accent:        '#F5A623',
  friendDot:     '#88BBFF',
};

// Room center in isometric world coords (matches DenGame._roomCX/CY)
const ROOM_CX = 32;
const ROOM_CY = 128;
const ROOM_W = 576;
const FACE_H = 5;   // tile thickness
const WALL_H = 64;  // wall height in screen px

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

// ── State ────────────────────────────────────────────────────────────────
const canvas = document.getElementById('room');
const ctx = canvas.getContext('2d');

let zoom = 1;
let viewportW = 0, viewportH = 0;

const me     = { userId: 'me', col: 5, row: 5, isMe: true,  cfg: { shirt: PAL.shirtBlue, hair: PAL.hairBrown }, state: 'idle', target: null, walkT: 0, bob: 0 };
const friend = { userId: 'friend', col: 3, row: 3, isMe: false, cfg: { shirt: PAL.shirtRed,  hair: PAL.hairDark   }, state: 'idle', target: null, walkT: 0, bob: 0 };
const avatars = [me, friend];

// ── Resize / zoom ────────────────────────────────────────────────────────
function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  viewportW = rect.width;
  viewportH = rect.height;
  zoom = (viewportW * 0.92) / ROOM_W;
}
window.addEventListener('resize', resize);
resize();

// ── World → screen helper ────────────────────────────────────────────────
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

// ── Renderables ──────────────────────────────────────────────────────────
function drawFloorTile(col, row) {
  const c = tileToScreen(col, row);
  const { sx, sy } = worldToScreen(c.x, c.y - TILE_H_HALF); // top vertex of diamond
  const w = TILE_W * zoom;
  const dh = TILE_H * zoom;
  const fh = FACE_H * zoom;
  const alt = (col + row) % 2 === 0;

  ctx.save();
  ctx.translate(sx - w / 2, sy);

  // top face
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

  // left face
  ctx.beginPath();
  ctx.moveTo(0,         dh / 2);
  ctx.lineTo(w / 2,     dh);
  ctx.lineTo(w / 2,     dh + fh);
  ctx.lineTo(0,         dh / 2 + fh);
  ctx.closePath();
  ctx.fillStyle = PAL.floorLeftFace;
  ctx.fill();
  ctx.stroke();

  // right face
  ctx.beginPath();
  ctx.moveTo(w / 2,     dh);
  ctx.lineTo(w,         dh / 2);
  ctx.lineTo(w,         dh / 2 + fh);
  ctx.lineTo(w / 2,     dh + fh);
  ctx.closePath();
  ctx.fillStyle = PAL.floorRightFace;
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// One single back-right wall panel — runs from back corner down-right to far end of row=0.
function drawBackRightWall() {
  // Bottom edge runs from tile(0,0) top vertex to tile(COLS-1, 0) right vertex
  const bL = tileToScreen(0, 0);           bL.y -= TILE_H_HALF; // top vertex
  const bR = tileToScreen(ROOM_COLS, 0);   bR.y -= TILE_H_HALF; // virtual "next" tile's top vertex
  const wh = WALL_H;

  const pBL = worldToScreen(bL.x, bL.y);
  const pBR = worldToScreen(bR.x, bR.y);
  const pTL = worldToScreen(bL.x, bL.y - wh);
  const pTR = worldToScreen(bR.x, bR.y - wh);

  ctx.beginPath();
  ctx.moveTo(pBL.sx, pBL.sy);
  ctx.lineTo(pBR.sx, pBR.sy);
  ctx.lineTo(pTR.sx, pTR.sy);
  ctx.lineTo(pTL.sx, pTL.sy);
  ctx.closePath();
  ctx.fillStyle = PAL.wallLight;
  ctx.fill();
  ctx.strokeStyle = PAL.wallOutline;
  ctx.lineWidth = 0.75;
  ctx.stroke();

  // Brick courses
  ctx.strokeStyle = 'rgba(154,136,112,0.35)';
  ctx.lineWidth = 0.5;
  for (let dy = 12 * zoom; dy < wh * zoom; dy += 14 * zoom) {
    ctx.beginPath();
    ctx.moveTo(pBL.sx, pBL.sy - dy);
    ctx.lineTo(pBR.sx, pBR.sy - dy);
    ctx.stroke();
  }
  // Vertical mortar (every other course offset)
  ctx.beginPath();
  const dx = (pBR.sx - pBL.sx) / 10;
  const dyTotal = (pBR.sy - pBL.sy) / 10;
  for (let i = 1; i < 10; i++) {
    const sx = pBL.sx + dx * i;
    const sy = pBL.sy + dyTotal * i;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, sy - wh * zoom);
  }
  ctx.stroke();
}

// Back-left wall — runs from back corner down-left along col=0.
function drawBackLeftWall() {
  const bR = tileToScreen(0, 0);              bR.y -= TILE_H_HALF; // back corner top vertex
  const bL = tileToScreen(0, ROOM_ROWS);      bL.y -= TILE_H_HALF; // virtual "next" row top vertex
  const wh = WALL_H;

  const pBL = worldToScreen(bL.x, bL.y);
  const pBR = worldToScreen(bR.x, bR.y);
  const pTL = worldToScreen(bL.x, bL.y - wh);
  const pTR = worldToScreen(bR.x, bR.y - wh);

  ctx.beginPath();
  ctx.moveTo(pBL.sx, pBL.sy);
  ctx.lineTo(pBR.sx, pBR.sy);
  ctx.lineTo(pTR.sx, pTR.sy);
  ctx.lineTo(pTL.sx, pTL.sy);
  ctx.closePath();
  ctx.fillStyle = PAL.wallDark;
  ctx.fill();
  ctx.strokeStyle = PAL.wallOutline;
  ctx.lineWidth = 0.75;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(154,136,112,0.3)';
  ctx.lineWidth = 0.5;
  for (let dy = 12 * zoom; dy < wh * zoom; dy += 14 * zoom) {
    ctx.beginPath();
    ctx.moveTo(pBL.sx, pBL.sy - dy);
    ctx.lineTo(pBR.sx, pBR.sy - dy);
    ctx.stroke();
  }
  ctx.beginPath();
  const dx = (pBR.sx - pBL.sx) / 8;
  const dyTotal = (pBR.sy - pBL.sy) / 8;
  for (let i = 1; i < 8; i++) {
    const sx = pBL.sx + dx * i;
    const sy = pBL.sy + dyTotal * i;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx, sy - wh * zoom);
  }
  ctx.stroke();
}

function drawAvatar(a) {
  // Interpolate position if walking
  let col = a.col, row = a.row;
  let wx, wy;
  if (a.state === 'walking' && a.target) {
    const from = tileToScreen(a.col, a.row);
    const to   = tileToScreen(a.target.col, a.target.row);
    const t = easeInOut(a.walkT);
    wx = from.x + (to.x - from.x) * t;
    wy = from.y + (to.y - from.y) * t;
  } else {
    const p = tileToScreen(col, row);
    wx = p.x; wy = p.y;
  }
  const { sx, sy } = worldToScreen(wx, wy);
  const s = zoom; // pixel scale

  const W = 24, H = 42;
  const x0 = sx - (W * s) / 2;
  const y0 = sy - H * s + (a.state === 'idle' ? Math.sin(a.bob) * 0.6 * s : 0);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(sx, sy - 1, 10 * s, 3 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  function px(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x0 + x * s, y0 + y * s, w * s, h * s);
  }

  // Hair
  px(4, 0, 16, 7, a.cfg.hair);
  px(3, 6, 3, 4, a.cfg.hair);
  px(18, 6, 3, 4, a.cfg.hair);

  // Head
  px(4, 6, 16, 14, PAL.skinA);

  // Eyes
  px(7, 11, 3, 3, '#1A1A2E');
  px(14, 11, 3, 3, '#1A1A2E');
  px(9, 11, 1, 1, '#FFFFFF');
  px(16, 11, 1, 1, '#FFFFFF');

  // Mouth
  px(9, 16, 6, 2, '#CC8866');

  // Neck
  px(9, 20, 6, 3, PAL.skinA);

  // Shirt + shading
  px(3, 23, 18, 12, a.cfg.shirt);
  px(16, 23, 5, 12, darken(a.cfg.shirt, 0.18));

  // Collar
  px(9, 23, 6, 3, PAL.skinA);

  // Legs
  px(3, 35, 8, 7, PAL.pantsNavy);
  px(13, 35, 8, 7, PAL.pantsNavy);

  // Shoes
  px(2, 40, 9, 2, PAL.shoeBlack);
  px(13, 40, 9, 2, PAL.shoeBlack);

  // Username dot above head
  ctx.fillStyle = a.isMe ? PAL.accent : PAL.friendDot;
  ctx.beginPath();
  ctx.arc(sx, y0 - 4 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
}

// ── Helpers ──────────────────────────────────────────────────────────────
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function darken(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) * (1 - amt));
  const g = Math.max(0, ((n >> 8) & 0xff) * (1 - amt));
  const b = Math.max(0,  (n        & 0xff) * (1 - amt));
  return `rgb(${r|0},${g|0},${b|0})`;
}

// ── Render loop ──────────────────────────────────────────────────────────
function frame(dtMs) {
  const dt = Math.min(dtMs / 1000, 0.05);

  for (const a of avatars) {
    a.bob += dt * 2.5;
    if (a.state === 'walking' && a.target) {
      a.walkT = Math.min(1, a.walkT + dt / 0.35);
      if (a.walkT >= 1) {
        a.col = a.target.col; a.row = a.target.row;
        a.target = null; a.state = 'idle'; a.walkT = 0;
      }
    }
  }

  // Clear
  ctx.clearRect(0, 0, viewportW, viewportH);

  // Build draw list with depth
  const items = [];
  // Floor
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      items.push({ depth: tileDepth(c, r), draw: () => drawFloorTile(c, r) });
    }
  }
  // Back walls (continuous panels — drawn before any floor tile)
  items.push({ depth: -100, draw: drawBackRightWall });
  items.push({ depth: -99,  draw: drawBackLeftWall });
  // Avatars
  for (const a of avatars) {
    const c = a.state === 'walking' && a.target
      ? a.target.col * easeInOut(a.walkT) + a.col * (1 - easeInOut(a.walkT))
      : a.col;
    const r = a.state === 'walking' && a.target
      ? a.target.row * easeInOut(a.walkT) + a.row * (1 - easeInOut(a.walkT))
      : a.row;
    items.push({ depth: tileDepth(Math.round(c), Math.round(r)) + 5, draw: () => drawAvatar(a) });
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();
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

// ── Chat overlay interactions ──────────────────────────────────────────
const chat       = document.getElementById('chat');
const chatHandle = document.getElementById('chatHandle');
const messages   = document.getElementById('messages');
const input      = document.getElementById('msgInput');
const sendBtn    = document.getElementById('sendBtn');

chatHandle.addEventListener('click', () => chat.classList.toggle('expanded'));

function addBubble(text, me) {
  const div = document.createElement('div');
  div.className = 'bubble ' + (me ? 'me' : 'them');
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

sendBtn.addEventListener('click', send);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
function send() {
  const t = input.value.trim();
  if (!t) return;
  addBubble(t, true);
  input.value = '';
  if (!chat.classList.contains('expanded')) chat.classList.add('expanded');
  // Demo: friend echo after a sec
  setTimeout(() => addBubble('cool', false), 800);
}
