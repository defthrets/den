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
const FURNITURE_BASE_Y    = 0.85;
const FURNITURE_BASE_SCALE = 1.05; // overall — small enough that 1×1 items fit on one tile

const FURNITURE_CATEGORIES = [
  { id: 'seating',    label: 'Seating'    },
  { id: 'surfaces',   label: 'Surfaces'   },
  { id: 'electronics',label: 'Electronics'},
  { id: 'decor',      label: 'Decor'      },
  { id: 'structures', label: 'Structures' },
];

// scale ≈ visual width factor relative to a 1-tile baseline (1.0).
// Multi-tile items get larger scale so they span their footprint.
const FURNITURE_CATALOG = [
  // ── Seating
  { id: 'chair_wood',  name: 'Wooden chair', category: 'seating',     scale: 1.0,  footprint: [1, 1] },
  { id: 'sofa_red',    name: 'Red sofa',     category: 'seating',     scale: 1.7,  footprint: [2, 1] },
  // ── Surfaces
  { id: 'bed_blue',    name: 'Blue bed',     category: 'surfaces',    scale: 1.7,  footprint: [2, 1] },
  { id: 'table_round', name: 'Round table',  category: 'surfaces',    scale: 1.0,  footprint: [1, 1] },
  { id: 'desk_wood',   name: 'Wooden desk',  category: 'surfaces',    scale: 1.4,  footprint: [2, 1] },
  // ── Electronics
  { id: 'tv_crt',      name: 'CRT TV',       category: 'electronics', scale: 0.9,  footprint: [1, 1] },
  { id: 'computer',    name: 'Computer',     category: 'electronics', scale: 0.85, footprint: [1, 1] },
  { id: 'fridge',      name: 'Fridge',       category: 'electronics', scale: 1.0,  footprint: [1, 1] },
  { id: 'fish_tank',   name: 'Fish tank',    category: 'electronics', scale: 1.0,  footprint: [1, 1] },
  // ── Decor
  { id: 'plant_tall',  name: 'Tall plant',   category: 'decor',       scale: 0.95, footprint: [1, 1] },
  { id: 'lamp_floor',  name: 'Floor lamp',   category: 'decor',       scale: 0.85, footprint: [1, 1] },
  { id: 'rug_persian', name: 'Persian rug',  category: 'decor',       scale: 1.7,  footprint: [2, 2], layer: 'floor' },
  { id: 'painting',    name: 'Painting',     category: 'decor',       scale: 0.75, footprint: [1, 1] },
  { id: 'bookshelf',   name: 'Bookshelf',    category: 'decor',       scale: 1.1,  footprint: [1, 1] },
  // ── Structures
  { id: 'doorway',     name: 'Doorway',      category: 'structures',  scale: 1.05, footprint: [1, 1] },
  { id: 'window',      name: 'Window',       category: 'structures',  scale: 0.85, footprint: [1, 1] },
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

function drawFurniture(item) {
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

  const dx = Math.round(sx - w / 2);
  const dy = Math.round(sy - h + padBelowBase);

  ctx.imageSmoothingEnabled = false;
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
