// Furniture catalogue, room layout state, and renderer.
//
// Each placed item carries `{ id, col, row, rotated }`. `rotated: true`
// flips the sprite horizontally — iso symmetry makes this a correct
// "facing the other diagonal" view without a second generation.

const FURNITURE_FRAME_W = 96;
const FURNITURE_FRAME_H = 96;
const FURNITURE_BASE_Y  = 0.85;
const FURNITURE_SCALE   = 1.9;

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
  { id: 'doorway',     name: 'Doorway' },
  { id: 'window',      name: 'Window' },
];

const FURNITURE_BY_ID = Object.fromEntries(FURNITURE_CATALOG.map(i => [i.id, i]));

// Live placements. The editor mutates this array.
const ROOM_FURNITURE = [
  { id: 'doorway',     col: 9, row: 0, rotated: false },
  { id: 'bookshelf',   col: 0, row: 0, rotated: false },
  { id: 'sofa_red',    col: 1, row: 1, rotated: false },
  { id: 'table_round', col: 2, row: 2, rotated: false },
  { id: 'lamp_floor',  col: 3, row: 0, rotated: false },
  { id: 'tv_crt',      col: 5, row: 0, rotated: false },
  { id: 'fridge',      col: 7, row: 0, rotated: false },
  { id: 'bed_blue',    col: 8, row: 2, rotated: false },
  { id: 'rug_persian', col: 4, row: 4, rotated: false },
  { id: 'chair_wood',  col: 6, row: 3, rotated: true  },
  { id: 'plant_tall',  col: 9, row: 7, rotated: false },
  { id: 'plant_tall',  col: 0, row: 7, rotated: false },
  { id: 'fish_tank',   col: 2, row: 6, rotated: false },
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

  const dx = Math.round(sx - w / 2);
  const dy = Math.round(sy - h + padBelowBase);

  ctx.imageSmoothingEnabled = false;
  if (item.rotated) {
    ctx.save();
    // Mirror around the sprite's vertical center
    ctx.translate(sx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-sx, 0);
    ctx.drawImage(sprite, dx, dy, Math.round(w), Math.round(h));
    ctx.restore();
  } else {
    ctx.drawImage(sprite, dx, dy, Math.round(w), Math.round(h));
  }
}

// Hit-test a tile -> return the topmost furniture placement at that tile
function furnitureAtTile(col, row) {
  for (let i = ROOM_FURNITURE.length - 1; i >= 0; i--) {
    const f = ROOM_FURNITURE[i];
    if (f.col === col && f.row === row) return { item: f, index: i };
  }
  return null;
}
