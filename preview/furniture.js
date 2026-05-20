// Furniture catalogue, room layout state, and renderer.
//
// Each catalog entry: { id, name, category, scale }
//   `scale` is a multiplier on top of FURNITURE_BASE_SCALE so a sofa
//   reads bigger than a lamp at the same render call.
//   `category` groups items in the editor palette tabs.
//
// Each placed item: { id, col, row, rotated }
//   `rotated: true` flips the sprite horizontally = the other diagonal
//   facing — iso symmetry makes the flip a correct second view.

const FURNITURE_FRAME_W = 96;
const FURNITURE_FRAME_H = 96;
const FURNITURE_BASE_Y    = 0.85;
const FURNITURE_BASE_SCALE = 1.9; // multiplied by per-piece scale

const FURNITURE_CATEGORIES = [
  { id: 'seating',    label: 'Seating'    },
  { id: 'surfaces',   label: 'Surfaces'   },
  { id: 'electronics',label: 'Electronics'},
  { id: 'decor',      label: 'Decor'      },
  { id: 'structures', label: 'Structures' },
];

// scale is relative to a 1:1 reference (chair ~= 1). Real-world height
// proportions: chair ~80cm, sofa wider, bed bigger, bookshelf taller,
// fridge ~human height, lamp small, painting small.
const FURNITURE_CATALOG = [
  // ── Seating
  { id: 'chair_wood',  name: 'Wooden chair', category: 'seating',    scale: 0.9 },
  { id: 'sofa_red',    name: 'Red sofa',     category: 'seating',    scale: 1.3 },
  // ── Surfaces
  { id: 'bed_blue',    name: 'Blue bed',     category: 'surfaces',   scale: 1.3 },
  { id: 'table_round', name: 'Round table',  category: 'surfaces',   scale: 1.0 },
  { id: 'desk_wood',   name: 'Wooden desk',  category: 'surfaces',   scale: 1.0 },
  // ── Electronics
  { id: 'tv_crt',      name: 'CRT TV',       category: 'electronics',scale: 0.85 },
  { id: 'computer',    name: 'Computer',     category: 'electronics',scale: 0.8  },
  { id: 'fridge',      name: 'Fridge',       category: 'electronics',scale: 1.2  },
  { id: 'fish_tank',   name: 'Fish tank',    category: 'electronics',scale: 0.95 },
  // ── Decor
  { id: 'plant_tall',  name: 'Tall plant',   category: 'decor',      scale: 1.0  },
  { id: 'lamp_floor',  name: 'Floor lamp',   category: 'decor',      scale: 0.85 },
  { id: 'rug_persian', name: 'Persian rug',  category: 'decor',      scale: 1.1  },
  { id: 'painting',    name: 'Painting',     category: 'decor',      scale: 0.7  },
  { id: 'bookshelf',   name: 'Bookshelf',    category: 'decor',      scale: 1.2  },
  // ── Structures
  { id: 'doorway',     name: 'Doorway',      category: 'structures', scale: 1.2  },
  { id: 'window',      name: 'Window',       category: 'structures', scale: 0.85 },
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

function drawFurniture(item) {
  const sprite = loadFurnitureSprite(item.id);
  if (!sprite.complete || sprite.naturalWidth === 0) return;

  const meta = FURNITURE_BY_ID[item.id] || { scale: 1.0 };
  const itemScale = FURNITURE_BASE_SCALE * (meta.scale ?? 1.0);

  const c = tileToScreen(item.col, item.row);
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

function furnitureAtTile(col, row) {
  for (let i = ROOM_FURNITURE.length - 1; i >= 0; i--) {
    const f = ROOM_FURNITURE[i];
    if (f.col === col && f.row === row) return { item: f, index: i };
  }
  return null;
}
