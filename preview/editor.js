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
    selectedId: null,       // palette item (place mode)
    pickedUpIndex: -1,      // index in ROOM_FURNITURE while moving
    dragCol: null,          // current drag-hover tile (drives render)
    dragRow: null,
  };

  // ── Palette / chips ────────────────────────────────────────────────
  function renderPalette() {
    palette.innerHTML = '';

    const tabs = document.createElement('div');
    tabs.className = 'palette-tabs';
    for (const cat of FURNITURE_CATEGORIES) {
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
    const items = FURNITURE_CATALOG.filter(i => i.category === state.activeCategory);
    for (const item of items) row.appendChild(makeChip(item));
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
  }

  editBtn.addEventListener('click', () => setActive(true));
  doneBtn.addEventListener('click', () => setActive(false));
  modeBtn.addEventListener('click', () => {
    setMode(state.mode === 'place' ? 'move' : 'place');
    renderPalette();
  });

  // ── Tile click logic ───────────────────────────────────────────────
  function onTileClick(col, row, durationMs) {
    if (!state.active) return false;

    const existing = furnitureAtTile(col, row);

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
    // Long-press deletes
    if (existing && durationMs >= 500) {
      ROOM_FURNITURE.splice(existing.index, 1);
      return true;
    }
    // Tap on existing furniture: rotate
    if (existing) {
      existing.item.rotated = !existing.item.rotated;
      return true;
    }
    // Empty tile + palette selection: place
    if (state.selectedId) {
      const meta = FURNITURE_BY_ID[state.selectedId];
      const [fw, fh] = meta?.footprint || [1, 1];
      if (canPlaceFootprint(col, row, fw, fh)) {
        ROOM_FURNITURE.push({ id: state.selectedId, col, row, rotated: false });
      }
      return true;
    }
    return true;
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

  window.editor = { state, onTileClick, onDragStart, onDragMove, onDragEnd, cancelDrag };
})();
