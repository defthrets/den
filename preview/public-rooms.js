// Public rooms — Habbo-style shared spaces designed by us.
//
// Not editable by users. Live capacity is 30; preview seeds each room
// with 5-8 NPC avatars to simulate occupancy. Real backend will wire
// up live presence via the server-rooms WebSocket.

const PUBLIC_ROOMS = [
  {
    id: 'lobby',
    name: 'Lobby',
    description: 'the front door',
    wallId: 'beige',
    floorId: 'marble',
    furniture: [
      { id: 'sofa_red',    col: 0, row: 0, rotated: false },
      { id: 'chair_wood',  col: 4, row: 0, rotated: false },
      { id: 'plant_tall',  col: 9, row: 0, rotated: false },
      { id: 'plant_tall',  col: 0, row: 7, rotated: false },
      { id: 'painting',    col: 5, row: 0, rotated: false },
      { id: 'rug_persian', col: 4, row: 3, rotated: false },
    ],
    npcs: [
      { preset: 'casual_blue_girl', col: 1, row: 2 },
      { preset: 'casual_blue_boy',  col: 3, row: 4 },
      { preset: 'casual_blue_girl', col: 6, row: 5 },
      { preset: 'casual_blue_boy',  col: 8, row: 3 },
      { preset: 'casual_blue_girl', col: 2, row: 6 },
      { preset: 'casual_blue_boy',  col: 7, row: 2 },
    ],
  },
  {
    id: 'club',
    name: 'The Club',
    description: 'pumping all night',
    wallId: 'vict_navy',
    floorId: 'tile_d',
    furniture: [
      { id: 'tv_crt',         col: 4, row: 0, rotated: false },
      { id: 'couch_dirty_v1', col: 0, row: 2, rotated: false },
      { id: 'couch_dirty_v2', col: 7, row: 2, rotated: false },
      { id: 'couch_dirty_v3', col: 0, row: 6, rotated: false },
      { id: 'couch_dirty_v4', col: 7, row: 6, rotated: false },
      { id: 'lamp_floor',     col: 9, row: 0, rotated: false },
    ],
    npcs: [
      { preset: 'casual_blue_girl', col: 4, row: 3 },
      { preset: 'casual_blue_boy',  col: 5, row: 3 },
      { preset: 'casual_blue_girl', col: 4, row: 4 },
      { preset: 'casual_blue_boy',  col: 5, row: 4 },
      { preset: 'casual_blue_girl', col: 1, row: 4 },
      { preset: 'casual_blue_boy',  col: 8, row: 4 },
      { preset: 'casual_blue_girl', col: 3, row: 5 },
      { preset: 'casual_blue_boy',  col: 6, row: 5 },
    ],
  },
  {
    id: 'park',
    name: 'The Park',
    description: 'fresh air',
    wallId: 'mint',
    floorId: 'brick',
    furniture: [
      { id: 'plant_tall', col: 0, row: 0, rotated: false },
      { id: 'plant_tall', col: 3, row: 0, rotated: false },
      { id: 'plant_tall', col: 6, row: 0, rotated: false },
      { id: 'plant_tall', col: 9, row: 0, rotated: false },
      { id: 'chair_wood', col: 2, row: 4, rotated: false },
      { id: 'chair_wood', col: 4, row: 4, rotated: false },
      { id: 'chair_wood', col: 6, row: 4, rotated: false },
      { id: 'fish_tank',  col: 8, row: 6, rotated: false },
    ],
    npcs: [
      { preset: 'casual_blue_boy',  col: 1, row: 5 },
      { preset: 'casual_blue_girl', col: 3, row: 5 },
      { preset: 'casual_blue_boy',  col: 5, row: 6 },
      { preset: 'casual_blue_girl', col: 7, row: 5 },
      { preset: 'casual_blue_boy',  col: 2, row: 2 },
    ],
  },
  {
    id: 'pool',
    name: 'Pool',
    description: 'wet n wild',
    wallId: 'powder_blue',
    floorId: 'tile_w',
    furniture: [
      { id: 'chair_wood', col: 0, row: 0, rotated: false },
      { id: 'chair_wood', col: 0, row: 6, rotated: false },
      { id: 'chair_wood', col: 9, row: 0, rotated: false },
      { id: 'chair_wood', col: 9, row: 6, rotated: false },
      { id: 'fish_tank',  col: 4, row: 2, rotated: false },
      { id: 'plant_tall', col: 7, row: 0, rotated: false },
      { id: 'plant_tall', col: 2, row: 7, rotated: false },
    ],
    npcs: [
      { preset: 'casual_blue_girl', col: 2, row: 3 },
      { preset: 'casual_blue_boy',  col: 6, row: 3 },
      { preset: 'casual_blue_girl', col: 5, row: 5 },
      { preset: 'casual_blue_boy',  col: 3, row: 5 },
    ],
  },
  {
    id: 'hallway',
    name: 'Hallway',
    description: 'quiet passage',
    wallId: 'charcoal',
    floorId: 'concrete',
    furniture: [
      { id: 'doorway',    col: 0, row: 0, rotated: false },
      { id: 'doorway',    col: 9, row: 0, rotated: false },
      { id: 'plant_tall', col: 4, row: 0, rotated: false },
      { id: 'painting',   col: 2, row: 0, rotated: false },
      { id: 'painting',   col: 7, row: 0, rotated: false },
      { id: 'bookshelf',  col: 5, row: 7, rotated: false },
    ],
    npcs: [
      { preset: 'casual_blue_girl', col: 4, row: 5 },
      { preset: 'casual_blue_boy',  col: 6, row: 6 },
      { preset: 'casual_blue_girl', col: 2, row: 3 },
    ],
  },
];

const PUBLIC_BY_ID = Object.fromEntries(PUBLIC_ROOMS.map(r => [r.id, r]));

// NPCs we've added to the avatars array — tracked so we can clear them
// when leaving the room.
let _publicNpcs = [];

function _clearNpcs() {
  if (!(window.den && window.den.avatars)) return;
  for (const npc of _publicNpcs) {
    const i = window.den.avatars.indexOf(npc);
    if (i >= 0) window.den.avatars.splice(i, 1);
  }
  _publicNpcs = [];
}

function _spawnNpcs(room) {
  _clearNpcs();
  if (!(window.den && window.den.makeAvatar && window.den.avatars)) return;
  for (let i = 0; i < room.npcs.length; i++) {
    const n = room.npcs[i];
    const npc = window.den.makeAvatar(
      `npc_${room.id}_${i}`, n.col, n.row, false, { preset: n.preset }
    );
    window.den.avatars.push(npc);
    _publicNpcs.push(npc);
  }
}

function visitPublicRoom(id) {
  const room = PUBLIC_BY_ID[id];
  if (!room) return;
  // Re-use the den state from friends.js so back-home / room-chip work.
  if (!(window.friends && window.roomStyle && typeof ROOM_FURNITURE !== 'undefined')) return;
  window.friends.denState.current = `pub:${id}`;
  window.roomStyle.wallId  = room.wallId;
  window.roomStyle.floorId = room.floorId;
  ROOM_FURNITURE.length = 0;
  for (const f of room.furniture) ROOM_FURNITURE.push({ ...f });

  // Spawn NPCs to fake occupancy.
  _spawnNpcs(room);

  // Hide the "friend" demo avatar — only NPCs + me in public rooms.
  if (window.den && window.den.friend) {
    window.den.friend.col = -100;
    window.den.friend.row = -100;
  }
  // Me appears at the door.
  if (window.den && window.den.me) {
    window.den.me.col = 5;
    window.den.me.row = 7;
    window.den.me.target = null;
    window.den.me.state = 'idle';
    if (window.den.me.pathQueue) window.den.me.pathQueue.length = 0;
  }

  // Update room chip + indicate occupancy (NPCs + you = visible headcount).
  const el = document.getElementById('roomName');
  if (el) el.textContent = `${room.name}  (${room.npcs.length + 1}/30)`;

  // Mark the editor button visually so it's clear you can't edit here.
  document.body.classList.add('in-public-room');
}

// Called from friends.js goHome() so leaving a public room clears NPCs.
function clearPublicRoom() {
  _clearNpcs();
  document.body.classList.remove('in-public-room');
}

window.publicRooms = { PUBLIC_ROOMS, visitPublicRoom, clearPublicRoom };
