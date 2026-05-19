// Furniture catalogue + per-room placements.
//
// Each item is a 96x96 PNG generated via Retro Diffusion's
// rd_plus__isometric_asset style. Sprites are loaded lazily and cached.
// The "feet" of each sprite (where the object meets the floor) sit at
// roughly 85% down the 96px frame — same trick we use for avatars.

const FURNITURE_FRAME_W = 96;
const FURNITURE_FRAME_H = 96;
const FURNITURE_BASE_Y  = 0.85; // 0..1 where the object's base touches the floor
const FURNITURE_SCALE   = 1.9;  // matches the avatar scale so chair/sofa/etc sit proportionally next to characters

const FURNITURE_CATALOG = [
  { id: 'chair_wood',  name: 'Wooden chair' },
  { id: 'sofa_red',    name: 'Red sofa' },
  { id: 'bed_blue',    name: 'Blue bed' },
  { id: 'plant_tall',  name: 'Tall plant' },
  { id: 'table_round', name: 'Round table' },
  { id: 'lamp_floor',  name: 'Floor lamp' },
  { id: 'rug_persian', name: 'Persian rug' },
  { id: 'bookshelf',   name: 'Bookshelf' },
  { id: 'tv_crt',      name: 'CRT TV' },
  { id: 'fridge',      name: 'Fridge' },
  { id: 'desk_wood',   name: 'Wooden desk' },
  { id: 'computer',    name: 'Computer' },
  { id: 'fish_tank',   name: 'Fish tank' },
  { id: 'painting',    name: 'Painting' },
];

// Per-room placements. Eventually this comes from /users/:id/room.
// { id, col, row } — col/row are tile coords in the 10x8 room.
const ROOM_FURNITURE = [
  { id: 'bookshelf',   col: 0, row: 0 },
  { id: 'sofa_red',    col: 1, row: 1 },
  { id: 'table_round', col: 2, row: 2 },
  { id: 'lamp_floor',  col: 3, row: 0 },
  { id: 'tv_crt',      col: 5, row: 0 },
  { id: 'fridge',      col: 8, row: 0 },
  { id: 'bed_blue',    col: 8, row: 2 },
  { id: 'rug_persian', col: 4, row: 4 },
  { id: 'chair_wood',  col: 6, row: 3 },
  { id: 'plant_tall',  col: 9, row: 7 },
  { id: 'plant_tall',  col: 0, row: 7 },
  { id: 'fish_tank',   col: 2, row: 6 },
];

const furnitureSprites = {};
function loadFurnitureSprite(id) {
  if (furnitureSprites[id]) return furnitureSprites[id];
  const img = new Image();
  img.src = `furniture/${id}.png?v=${typeof SPRITE_VERSION !== 'undefined' ? SPRITE_VERSION : 1}`;
  furnitureSprites[id] = img;
  return img;
}

function drawFurniture(item) {
  const sprite = loadFurnitureSprite(item.id);
  if (!sprite.complete || sprite.naturalWidth === 0) return;

  const c = tileToScreen(item.col, item.row);
  const { sx, sy } = worldToScreen(c.x, c.y);
  const scale = zoom * FURNITURE_SCALE;
  const w = FURNITURE_FRAME_W * scale;
  const h = FURNITURE_FRAME_H * scale;
  const padBelowBase = (1 - FURNITURE_BASE_Y) * h;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sprite,
    Math.round(sx - w / 2),
    Math.round(sy - h + padBelowBase),
    Math.round(w),
    Math.round(h),
  );
}
