// Room editor — palette + place / move / rotate / delete.
//
// Modes:
//   place  — tap an empty tile to drop the selected palette item.
//            tap a placed item to rotate.
//            long-press a placed item to delete.
//   move   — tap a placed item to pick it up; tap any empty tile to
//            drop it there. Tap-cancel returns it to where it was.
(() => {
  const den       = window.den;
  const editBtn   = document.getElementById('editBtn');
  const panel     = document.getElementById('editorPanel');
  const doneBtn   = document.getElementById('editorDone');
  const modeBtn   = document.getElementById('editorMode');
  const titleEl   = document.getElementById('editorTitle');
  const hintEl    = document.getElementById('editorHint');
  const palette   = document.getElementById('editorPalette');

  const state = {
    active: false,
    mode: 'place',          // 'place' | 'move'
    activeCategory: FURNITURE_CATEGORIES[0].id,
    selectedId: null,       // palette item to place
    placeRotated: false,    // rotate preview before placing
    selectedPlacedIndex: -1, // index in ROOM_FURNITURE of currently-selected placed piece
    pickedUpIndex: -1,      // index in ROOM_FURNITURE while moving
    dragCol: null,
    dragRow: null,
  };

  // ── Palette / chips ────────────────────────────────────────────────
  // Categories now include 'walls' and 'floors' alongside furniture.
  // Style chips don't get placed — tapping them swaps the active wall
  // or floor style on window.roomStyle.
  const STYLE_CATS = [
    { id: 'walls',  label: 'Walls'  },
    { id: 'floors', label: 'Floors' },
  ];
  function allCategories() {
    return [...FURNITURE_CATEGORIES, ...STYLE_CATS];
  }
  function renderPalette() {
    palette.innerHTML = '';

    const tabs = document.createElement('div');
    tabs.className = 'palette-tabs';
    for (const cat of allCategories()) {
      const t = document.createElement('div');
      t.className = 'palette-tab' + (cat.id === state.activeCategory ? ' active' : '');
      t.textContent = cat.label;
      t.onclick = () => { state.activeCategory = cat.id; renderPalette(); };
      tabs.appendChild(t);
    }
    palette.appendChild(tabs);

    const row = document.createElement('div');
    row.className = 'palette-row';
    palette.appendChild(row);

    if (state.activeCategory === 'walls') {
      const styles = (typeof WALL_STYLES !== 'undefined') ? WALL_STYLES : [];
      for (const s of styles) row.appendChild(makeWallChip(s));
    } else if (state.activeCategory === 'floors') {
      const styles = (typeof FLOOR_STYLES !== 'undefined') ? FLOOR_STYLES : [];
      for (const s of styles) row.appendChild(makeFloorChip(s));
    } else {
      const items = FURNITURE_CATALOG.filter(i => i.category === state.activeCategory);
      for (const item of items) row.appendChild(makeChip(item));
    }
  }

  function makeWallChip(style) {
    const chip = document.createElement('div');
    const active = (window.roomStyle && window.roomStyle.wallId === style.id);
    chip.className = 'palette-chip' + (active ? ' active' : '');
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    // Two-tone preview: light triangle (back-right wall) over dark triangle (back-left)
    cx.fillStyle = style.light; cx.fillRect(0, 0, 64, 64);
    cx.fillStyle = style.dark;
    cx.beginPath(); cx.moveTo(0,0); cx.lineTo(64,0); cx.lineTo(0,64); cx.closePath(); cx.fill();
    // Hint of pattern accent
    if (style.accent) {
      cx.fillStyle = style.accent;
      cx.globalAlpha = 0.5;
      for (let y = 8; y < 64; y += 16) {
        for (let x = (y/16 % 2 === 0 ? 8 : 16); x < 64; x += 16) {
          cx.beginPath();
          cx.moveTo(x, y-4); cx.lineTo(x+3, y); cx.lineTo(x, y+4); cx.lineTo(x-3, y); cx.closePath(); cx.fill();
        }
      }
      cx.globalAlpha = 1;
    }
    cx.strokeStyle = style.outline; cx.lineWidth = 1; cx.strokeRect(0.5,0.5,63,63);

    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = style.name;

    chip.appendChild(c); chip.appendChild(lbl);
    chip.onclick = () => {
      window.roomStyle.wallId = style.id;
      renderPalette();
    };
    return chip;
  }

  function makeFloorChip(style) {
    const chip = document.createElement('div');
    const active = (window.roomStyle && window.roomStyle.floorId === style.id);
    chip.className = 'palette-chip' + (active ? ' active' : '');
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    // Mini iso diamond × 2 to suggest checker
    const drawDiamond = (cxOff, cyOff, fill) => {
      cx.fillStyle = fill;
      cx.beginPath();
      cx.moveTo(cxOff, cyOff - 12); cx.lineTo(cxOff + 22, cyOff); cx.lineTo(cxOff, cyOff + 12); cx.lineTo(cxOff - 22, cyOff); cx.closePath();
      cx.fill();
      cx.strokeStyle = style.outline; cx.lineWidth = 0.5; cx.stroke();
    };
    cx.fillStyle = '#1A2030'; cx.fillRect(0, 0, 64, 64);
    drawDiamond(20, 20, style.topA);
    drawDiamond(44, 20, style.topB);
    drawDiamond(20, 44, style.topB);
    drawDiamond(44, 44, style.topA);

    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = style.name;

    chip.appendChild(c); chip.appendChild(lbl);
    chip.onclick = () => {
      window.roomStyle.floorId = style.id;
      renderPalette();
    };
    return chip;
  }

  function makeChip(item) {
    const chip = document.createElement('div');
    chip.className = 'palette-chip' + (item.id === state.selectedId ? ' active' : '');
    chip.dataset.id = item.id;

    const c = document.createElement('canvas');
    c.width = FURNITURE_FRAME_W;
    c.height = FURNITURE_FRAME_H;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    const img = loadFurnitureSprite(item.id);
    const blit = () => {
      cx.clearRect(0, 0, c.width, c.height);
      if (img.naturalWidth > 0) {
        cx.drawImage(img, 0, 0, FURNITURE_FRAME_W, FURNITURE_FRAME_H, 0, 0, c.width, c.height);
      }
    };
    if (img.complete) blit(); else { img.onload = blit; img.onerror = blit; }

    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = item.name;

    chip.appendChild(c);
    chip.appendChild(lbl);
    chip.onclick = () => {
      if (state.mode !== 'place') setMode('place');
      state.selectedId = (state.selectedId === item.id) ? null : item.id;
      renderPalette();
    };
    return chip;
  }

  // ── Mode handling ──────────────────────────────────────────────────
  function setMode(next) {
    state.mode = next;
    state.pickedUpIndex = -1;
    state.selectedId = next === 'place' ? state.selectedId : null;
    document.body.classList.remove('editor-picked-up');
    syncHeader();
    modeBtn.classList.toggle('active', next === 'move');
  }

  function syncHeader() {
    if (state.mode === 'move') {
      if (state.pickedUpIndex >= 0) {
        titleEl.textContent = 'Move furniture';
        hintEl.textContent = 'tap an empty tile to drop · tap selected item to cancel';
      } else {
        titleEl.textContent = 'Move furniture';
        hintEl.textContent = 'tap a placed item to pick it up';
      }
    } else {
      titleEl.textContent = 'Place furniture';
      hintEl.textContent = 'tap tile to place · tap item to rotate · long-press to delete';
    }
  }

  function setActive(on) {
    state.active = on;
    panel.classList.toggle('open', on);
    document.body.classList.toggle('editing', on);
    if (on) { setMode('place'); renderPalette(); }
    else {
      state.selectedPlacedIndex = -1;
      hideActionBar();
    }
  }

  editBtn.addEventListener('click', () => setActive(true));
  doneBtn.addEventListener('click', () => setActive(false));
  modeBtn.addEventListener('click', () => {
    setMode(state.mode === 'place' ? 'move' : 'place');
    renderPalette();
  });

  // ── Tile click logic ───────────────────────────────────────────────
  // `pixelHit` is the optional pixel-perfect hit (sprite-level), passed
  // in by the renderer. If a click lands on visible pixels of a sprite,
  // we treat THAT piece as the target — regardless of which tile the
  // anchor sits on. Falling back to tile-based hit-test only when the
  // click missed every sprite.
  function onTileClick(col, row, durationMs, pixelHit) {
    if (!state.active) return false;

    const existing = pixelHit || furnitureAtTile(col, row);

    // ─── MOVE mode ───────────────────────────────────────────────
    if (state.mode === 'move') {
      // Holding nothing yet: tap a placed item to pick it up
      if (state.pickedUpIndex < 0) {
        if (!existing) return true;
        state.pickedUpIndex = existing.index;
        document.body.classList.add('editor-picked-up');
        syncHeader();
        return true;
      }
      // Tapping the picked-up item: cancel
      if (existing && existing.index === state.pickedUpIndex) {
        state.pickedUpIndex = -1;
        document.body.classList.remove('editor-picked-up');
        syncHeader();
        return true;
      }
      // Otherwise: drop at (col, row) if the footprint fits
      const item = ROOM_FURNITURE[state.pickedUpIndex];
      const meta = FURNITURE_BY_ID[item.id];
      const [fw, fh] = meta?.footprint || [1, 1];
      if (canPlaceFootprint(col, row, fw, fh, state.pickedUpIndex)) {
        item.col = col;
        item.row = row;
        state.pickedUpIndex = -1;
        document.body.classList.remove('editor-picked-up');
        syncHeader();
      }
      return true;
    }

    // ─── PLACE mode ──────────────────────────────────────────────
    // Tap an existing piece: SELECT it (highlight + floating toolbar).
    // Tap the already-selected piece again: deselect.
    if (existing) {
      state.selectedPlacedIndex =
        state.selectedPlacedIndex === existing.index ? -1 : existing.index;
      syncHeader();
      positionActionToolbar();
      return true;
    }
    // Tap empty tile while a placed piece is selected: deselect.
    if (state.selectedPlacedIndex >= 0) {
      state.selectedPlacedIndex = -1;
      syncHeader();
      positionActionToolbar();
      return true;
    }
    // Tap empty tile with a palette item selected: place it.
    if (state.selectedId) {
      const meta = FURNITURE_BY_ID[state.selectedId];
      const [fw, fh] = meta?.footprint || [1, 1];
      if (canPlaceFootprint(col, row, fw, fh)) {
        ROOM_FURNITURE.push({
          id: state.selectedId, col, row, rotated: state.placeRotated,
        });
      }
      return true;
    }
    return true;
  }

  // ── Floating action toolbar (Rotate / Delete) for selected piece ──
  let actionBar = null;
  function ensureActionBar() {
    if (actionBar) return actionBar;
    actionBar = document.createElement('div');
    actionBar.id = 'furnitureActions';
    actionBar.style.cssText =
      'position:absolute;display:none;z-index:7;gap:6px;flex-direction:row;' +
      'pointer-events:auto;transform:translate(-50%,-100%);';
    const mkBtn = (label, cls, onClick) => {
      const b = document.createElement('button');
      b.className = cls;
      b.textContent = label;
      b.onclick = (e) => { e.stopPropagation(); onClick(); };
      return b;
    };
    actionBar.appendChild(mkBtn('Rotate', 'editor-mode', () => {
      if (state.selectedPlacedIndex < 0) return;
      const it = ROOM_FURNITURE[state.selectedPlacedIndex];
      it.rotated = !it.rotated;
    }));
    actionBar.appendChild(mkBtn('Delete', 'editor-mode', () => {
      if (state.selectedPlacedIndex < 0) return;
      ROOM_FURNITURE.splice(state.selectedPlacedIndex, 1);
      state.selectedPlacedIndex = -1;
      hideActionBar();
      syncHeader();
    }));
    document.querySelector('.screen').appendChild(actionBar);
    return actionBar;
  }
  function hideActionBar() {
    if (actionBar) actionBar.style.display = 'none';
  }
  function positionActionToolbar() {
    const bar = ensureActionBar();
    bar.style.display = 'flex';
    if (state.selectedPlacedIndex < 0) { bar.style.display = 'none'; return; }
    // Position over the piece's centre (footprint midpoint).
    const item = ROOM_FURNITURE[state.selectedPlacedIndex];
    const meta = FURNITURE_BY_ID[item.id] || { footprint: [1,1] };
    const [fw, fh] = meta.footprint || [1, 1];
    const cx = item.col + (fw - 1) / 2;
    const cy = item.row + (fh - 1) / 2;
    if (typeof tileToScreen === 'function' && typeof worldToScreen === 'function') {
      const c = tileToScreen(cx, cy);
      const screen = worldToScreen(c.x, c.y);
      const canvasRect = document.getElementById('room').getBoundingClientRect();
      const phoneRect  = document.querySelector('.screen').getBoundingClientRect();
      const left = (canvasRect.left - phoneRect.left) + screen.sx;
      const top  = (canvasRect.top  - phoneRect.top)  + screen.sy - 60;
      bar.style.left = left + 'px';
      bar.style.top  = top + 'px';
    }
  }

  // ── Drag handlers (move mode) ──────────────────────────────────────
  function onDragStart(col, row) {
    if (!state.active || state.mode !== 'move') return false;
    const hit = furnitureAtTile(col, row);
    if (!hit) return false;
    state.pickedUpIndex = hit.index;
    state.dragCol = col;
    state.dragRow = row;
    document.body.classList.add('editor-picked-up');
    syncHeader();
    return true;
  }
  // Renderer can call this when it's already done a pixel-perfect hit
  // test and knows the exact piece the user grabbed.
  function onDragStartAtIndex(index, col, row) {
    if (!state.active || state.mode !== 'move') return false;
    if (index < 0 || index >= ROOM_FURNITURE.length) return false;
    state.pickedUpIndex = index;
    state.dragCol = col;
    state.dragRow = row;
    document.body.classList.add('editor-picked-up');
    syncHeader();
    return true;
  }
  function onDragMove(col, row) {
    if (state.pickedUpIndex < 0) return false;
    state.dragCol = col;
    state.dragRow = row;
    return true;
  }
  function onDragEnd(col, row) {
    if (state.pickedUpIndex < 0) return false;
    const item = ROOM_FURNITURE[state.pickedUpIndex];
    const meta = FURNITURE_BY_ID[item.id];
    const [fw, fh] = meta?.footprint || [1, 1];
    if (col != null && canPlaceFootprint(col, row, fw, fh, state.pickedUpIndex)) {
      item.col = col;
      item.row = row;
    }
    state.pickedUpIndex = -1;
    state.dragCol = null;
    state.dragRow = null;
    document.body.classList.remove('editor-picked-up');
    syncHeader();
    positionActionToolbar();
    return true;
  }
  function cancelDrag() {
    if (state.pickedUpIndex < 0) return;
    state.pickedUpIndex = -1;
    state.dragCol = null;
    state.dragRow = null;
    document.body.classList.remove('editor-picked-up');
    syncHeader();
  }

  window.editor = {
    state, onTileClick,
    onDragStart, onDragStartAtIndex,
    onDragMove, onDragEnd, cancelDrag,
  };
})();
