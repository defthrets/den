// Friends list + den-visit system.
//
// Each friend has a stored "den" — wall + floor style ids and a furniture
// list — that gets swapped in when you visit them. Your own den is held in
// MY_DEN so we can restore it via the back button.
//
// Sample friends are seeded with hand-decorated rooms so navigation feels
// alive in the preview before the server is wired up.

const MY_DEN = {
  name: "my den",
  preset: 'casual_blue_boy',
  wallId: 'beige',
  floorId: 'stone',
  furniture: [],   // your own room starts empty; you decorate via the editor
};

// Spawn point for the visitor — fixed "door" tile in every den.
const VISITOR_SPAWN = { col: 5, row: 7 };

const FRIENDS = [
  {
    id: 'alice',
    name: 'alice',
    preset: 'casual_blue_girl',
    spawn: { col: 4, row: 3 },
    den: {
      wallId: 'vict_red',
      floorId: 'wood',
      furniture: [
        { id: 'bed_blue',    col: 0, row: 0, rotated: false },
        { id: 'rug_persian', col: 3, row: 2, rotated: false },
        { id: 'sofa_red',    col: 5, row: 1, rotated: false },
        { id: 'lamp_floor',  col: 9, row: 0, rotated: false },
        { id: 'painting',    col: 8, row: 0, rotated: false },
      ],
    },
  },
  {
    id: 'bob',
    name: 'bob',
    preset: 'casual_blue_boy',
    spawn: { col: 6, row: 3 },
    den: {
      wallId: 'charcoal',
      floorId: 'tile_d',
      furniture: [
        { id: 'tv_crt',      col: 4, row: 0, rotated: false },
        { id: 'sofa_red',    col: 1, row: 3, rotated: false },
        { id: 'plant_tall',  col: 9, row: 0, rotated: false },
        { id: 'computer',    col: 7, row: 0, rotated: false },
        { id: 'fridge',      col: 0, row: 0, rotated: false },
      ],
    },
  },
  {
    id: 'coco',
    name: 'coco',
    preset: 'casual_blue_girl',
    spawn: { col: 5, row: 2 },
    den: {
      wallId: 'mint',
      floorId: 'marble',
      furniture: [
        { id: 'couch_dirty_v1', col: 3, row: 0, rotated: false },
        { id: 'table_round',    col: 5, row: 4, rotated: false },
        { id: 'plant_tall',     col: 0, row: 0, rotated: false },
        { id: 'bookshelf',      col: 8, row: 0, rotated: false },
        { id: 'painting',       col: 1, row: 0, rotated: false },
      ],
    },
  },
  {
    id: 'dex',
    name: 'dex',
    preset: 'casual_blue_boy',
    spawn: { col: 4, row: 2 },
    den: {
      wallId: 'vict_navy',
      floorId: 'brick',
      furniture: [
        { id: 'couch_dirty_v3', col: 2, row: 2, rotated: false },
        { id: 'chair_wood',     col: 6, row: 3, rotated: false },
        { id: 'fish_tank',      col: 4, row: 0, rotated: false },
        { id: 'lamp_floor',     col: 8, row: 4, rotated: false },
      ],
    },
  },
];

// 'me' or a friend id. null on init falls back to 'me'.
const denState = { current: 'me' };
window.denState = denState;

function applyDen(den) {
  // Update the global style + furniture list in place so existing
  // bindings in styles.js / furniture.js pick up the swap on next frame.
  window.roomStyle.wallId  = den.wallId  || 'beige';
  window.roomStyle.floorId = den.floorId || 'stone';
  ROOM_FURNITURE.length = 0;
  for (const f of (den.furniture || [])) {
    ROOM_FURNITURE.push({ ...f });
  }
}

function setRoomChipName(text) {
  const el = document.getElementById('roomName');
  if (el) el.textContent = text;
}

function visitFriend(id) {
  const f = FRIENDS.find(x => x.id === id);
  if (!f) return;
  if (window.publicRooms && window.publicRooms.clearPublicRoom) {
    window.publicRooms.clearPublicRoom();
  }
  denState.current = id;
  applyDen(f.den);
  // Spawn me at the door, friend at their idle spot.
  if (window.den && window.den.me) {
    window.den.me.col = VISITOR_SPAWN.col;
    window.den.me.row = VISITOR_SPAWN.row;
    window.den.me.target = null;
    window.den.me.state = 'idle';
    if (window.den.me.pathQueue) window.den.me.pathQueue.length = 0;
  }
  if (window.den && window.den.friend) {
    window.den.friend.col = f.spawn.col;
    window.den.friend.row = f.spawn.row;
    window.den.friend.userId = f.id;
    window.den.friend.target = null;
    window.den.friend.state = 'idle';
    // Swap their sprite preset if different
    if (window.den.setPreset) window.den.setPreset(window.den.friend, f.preset);
  }
  setRoomChipName(`${f.name}'s den`);
}

function goHome() {
  // If we're leaving a public room, clear NPC avatars first.
  if (window.publicRooms && window.publicRooms.clearPublicRoom) {
    window.publicRooms.clearPublicRoom();
  }
  denState.current = 'me';
  applyDen(MY_DEN);
  if (window.den && window.den.me) {
    window.den.me.col = 5;
    window.den.me.row = 5;
    window.den.me.target = null;
    window.den.me.state = 'idle';
    if (window.den.me.pathQueue) window.den.me.pathQueue.length = 0;
  }
  if (window.den && window.den.friend) {
    // Hide the friend by parking off-screen for now.
    window.den.friend.col = -100;
    window.den.friend.row = -100;
    window.den.friend.userId = 'friend';
  }
  setRoomChipName('my den');
}

function addFriend(name, preset) {
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '') || `friend${FRIENDS.length + 1}`;
  if (FRIENDS.some(f => f.id === id)) return null;
  const friend = {
    id, name,
    preset: preset || (FRIENDS.length % 2 === 0 ? 'casual_blue_girl' : 'casual_blue_boy'),
    spawn: { col: 5, row: 3 },
    den: { wallId: 'beige', floorId: 'stone', furniture: [] },
  };
  FRIENDS.push(friend);
  return friend;
}

window.friends = { FRIENDS, MY_DEN, denState, visitFriend, goHome, addFriend };
