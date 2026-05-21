// Furniture catalogue, room layout state, and renderer.
//
// Catalog fields:
//   id, name, category, scale, layer ('floor' for rugs),
//   footprint  → [w, h] in tiles (e.g. sofa is [2,1])
//
// Placement: { id, col, row, rotated }
//   `col, row` = anchor tile (left/north corner of the footprint).
//   `rotated`  = horizontal flip → the other "facing the camera" view.

const FURNITURE_FRAME_W = 96;
const FURNITURE_FRAME_H = 96;
// Sprites are normalised so the visual base of every piece lands at
// y=92 in the 96-px frame (see tools/normalize-furniture.py).
const FURNITURE_BASE_Y    = 92 / 96;
// Set to 1.0 so 96 source × zoom 2/3 = exactly 64 display: clean 3:2
// nearest-neighbour pattern instead of fractional aliasing.
const FURNITURE_BASE_SCALE = 1.0;

const FURNITURE_CATEGORIES = [
  { id: 'seating',    label: 'Seating'    },
  { id: 'surfaces',   label: 'Surfaces'   },
  { id: 'electronics',label: 'Electronics'},
  { id: 'decor',      label: 'Decor'      },
  { id: 'structures', label: 'Structures' },
];

// scale ≈ visual width factor relative to a 1-tile baseline (1.0).
// Snapped to clean fractions of 2/3 so 96 source × scale × zoom is always
// an integer at zoom 2/3 (1.0 → 64 display, 1.5 → 96 display). No
// fractional aliasing. Multi-tile pieces use 1.5 so they read as ~2 tiles.
const FURNITURE_CATALOG = [
  // ── Seating
  { id: 'chair_wood',  name: 'Wooden chair', category: 'seating',     scale: 1.0, footprint: [1, 1] },
  { id: 'sofa_red',    name: 'Red sofa',     category: 'seating',     scale: 1.5, footprint: [2, 1] },
  // ── Surfaces
  { id: 'bed_blue',    name: 'Blue bed',     category: 'surfaces',    scale: 1.5, footprint: [2, 1] },
  { id: 'table_round', name: 'Round table',  category: 'surfaces',    scale: 1.0, footprint: [1, 1] },
  { id: 'desk_wood',   name: 'Wooden desk',  category: 'surfaces',    scale: 1.5, footprint: [2, 1] },
  // ── Electronics
  { id: 'tv_crt',      name: 'CRT TV',       category: 'electronics', scale: 1.0, footprint: [1, 1] },
  { id: 'computer',    name: 'Computer',     category: 'electronics', scale: 1.0, footprint: [1, 1] },
  { id: 'fridge',      name: 'Fridge',       category: 'electronics', scale: 1.0, footprint: [1, 1] },
  { id: 'fish_tank',   name: 'Fish tank',    category: 'electronics', scale: 1.0, footprint: [1, 1] },
  // ── Decor
  { id: 'plant_tall',  name: 'Tall plant',   category: 'decor',       scale: 1.0, footprint: [1, 1] },
  { id: 'lamp_floor',  name: 'Floor lamp',   category: 'decor',       scale: 1.0, footprint: [1, 1] },
  { id: 'rug_persian', name: 'Persian rug',  category: 'decor',       scale: 1.5, footprint: [2, 2], layer: 'floor' },
  { id: 'painting',    name: 'Painting',     category: 'decor',       scale: 1.0, footprint: [1, 1] },
  { id: 'bookshelf',   name: 'Bookshelf',    category: 'decor',       scale: 1.0, footprint: [1, 1] },
  // ── Structures
  { id: 'doorway',     name: 'Doorway',      category: 'structures',  scale: 1.0, footprint: [1, 1] },
  { id: 'window',      name: 'Window',       category: 'structures',  scale: 1.0, footprint: [1, 1] },
];

const FURNITURE_BY_ID = Object.fromEntries(FURNITURE_CATALOG.map(i => [i.id, i]));

// Empty room — place items via the editor.
const ROOM_FURNITURE = [];

const furnitureSprites = {};
function loadFurnitureSprite(id) {
  if (furnitureSprites[id]) return furnitureSprites[id];
  const img = new Image();
  img.src = `furniture/${id}.png?v=${typeof SPRITE_VERSION !== 'undefined' ? SPRITE_VERSION : 1}`;
  furnitureSprites[id] = img;
  return img;
}

// For multi-tile footprints, the sprite is centred on the iso midpoint
// of the footprint, so a 2×1 sofa straddles two tiles instead of
// hanging off one.
function footprintCenter(item) {
  const meta = FURNITURE_BY_ID[item.id] || { footprint: [1, 1] };
  const [fw, fh] = meta.footprint || [1, 1];
  const cx = item.col + (fw - 1) / 2;
  const cy = item.row + (fh - 1) / 2;
  return tileToScreen(cx, cy);
}

function drawFurniture(item, opts = {}) {
  const sprite = loadFurnitureSprite(item.id);
  if (!sprite.complete || sprite.naturalWidth === 0) return;

  const meta = FURNITURE_BY_ID[item.id] || { scale: 1.0 };
  const itemScale = FURNITURE_BASE_SCALE * (meta.scale ?? 1.0);

  const c = footprintCenter(item);
  const { sx, sy } = worldToScreen(c.x, c.y);
  const screenScale = zoom * itemScale;
  const w = FURNITURE_FRAME_W * screenScale;
  const h = FURNITURE_FRAME_H * screenScale;
  const padBelowBase = (1 - FURNITURE_BASE_Y) * h;

  // Lift the picked-up item a few pixels so it visually "floats"
  // while you're choosing where to drop it.
  const liftPx = opts.pickedUp ? -10 : 0;

  const dx = Math.round(sx - w / 2);
  const dy = Math.round(sy - h + padBelowBase + liftPx);

  ctx.imageSmoothingEnabled = false;

  // Shadow at the drop tile when picked up, so it's clear where it'll land
  if (opts.pickedUp) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(sx, sy - 2, w * 0.32, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (item.rotated) {
    ctx.save();
    ctx.translate(sx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-sx, 0);
    ctx.drawImage(sprite, dx, dy, Math.round(w), Math.round(h));
    ctx.restore();
  } else {
    ctx.drawImage(sprite, dx, dy, Math.round(w), Math.round(h));
  }

  // Outline glow on picked-up item
  if (opts.pickedUp) {
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 166, 35, 0.9)'; // accent
    ctx.lineWidth = 2;
    ctx.strokeRect(dx + 4, dy + 4, w - 8, h - 8);
    ctx.restore();
  }
}

// Tile occupancy: returns the furniture placement covering (col, row),
// taking each item's footprint into account.
function furnitureAtTile(col, row) {
  for (let i = ROOM_FURNITURE.length - 1; i >= 0; i--) {
    const f = ROOM_FURNITURE[i];
    const meta = FURNITURE_BY_ID[f.id];
    const [fw, fh] = meta?.footprint || [1, 1];
    if (col >= f.col && col < f.col + fw && row >= f.row && row < f.row + fh) {
      return { item: f, index: i };
    }
  }
  return null;
}

// True if (col, row) is blocked for avatar movement. Floor-layer items
// like rugs are walkable; everything else is solid.
function isTileBlocked(col, row) {
  const hit = furnitureAtTile(col, row);
  if (!hit) return false;
  const meta = FURNITURE_BY_ID[hit.item.id];
  return meta?.layer !== 'floor';
}

// Can a footprint of size [w, h] be placed at (col, row) without
// overlapping any non-floor-layer item already in the room?
function canPlaceFootprint(col, row, w, h, ignoreIndex = -1) {
  if (col < 0 || row < 0 || col + w > ROOM_COLS || row + h > ROOM_ROWS) return false;
  for (let dr = 0; dr < h; dr++) {
    for (let dc = 0; dc < w; dc++) {
      for (let i = 0; i < ROOM_FURNITURE.length; i++) {
        if (i === ignoreIndex) continue;
        const f = ROOM_FURNITURE[i];
        const m = FURNITURE_BY_ID[f.id];
        if (m?.layer === 'floor') continue;
        const [fw, fh] = m?.footprint || [1, 1];
        const c = col + dc, r = row + dr;
        if (c >= f.col && c < f.col + fw && r >= f.row && r < f.row + fh) return false;
      }
    }
  }
  return true;
}
