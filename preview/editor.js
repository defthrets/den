// Room editor — overlays the room with a furniture palette, lets you
// place, rotate, and delete items.
//
// While editor.state.active is true, the renderer's tile-click handler
// routes through editor.onTileClick instead of walking the avatar.
(() => {
  const editBtn   = document.getElementById('editBtn');
  const panel     = document.getElementById('editorPanel');
  const doneBtn   = document.getElementById('editorDone');
  const palette   = document.getElementById('editorPalette');

  const state = {
    active: false,
    activeCategory: FURNITURE_CATEGORIES[0].id,
    selectedId: null,
  };

  // ── Render category tabs + palette ─────────────────────────────────
  function renderPalette() {
    palette.innerHTML = '';

    // Category tabs
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

    // Items for the active category
    const row = document.createElement('div');
    row.className = 'palette-row';
    palette.appendChild(row);

    const items = FURNITURE_CATALOG.filter(i => i.category === state.activeCategory);
    for (const item of items) {
      row.appendChild(makeChip(item));
    }
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
      state.selectedId = (state.selectedId === item.id) ? null : item.id;
      renderPalette();
    };
    return chip;
  }

  function setActive(on) {
    state.active = on;
    panel.classList.toggle('open', on);
    document.body.classList.toggle('editing', on);
    if (on) renderPalette();
  }

  editBtn.addEventListener('click', () => setActive(true));
  doneBtn.addEventListener('click', () => setActive(false));

  // Called by renderer.js when a tile is tapped in edit mode.
  function onTileClick(col, row, durationMs) {
    if (!state.active) return false;

    const existing = furnitureAtTile(col, row);

    // Long-press deletes
    if (existing && durationMs >= 500) {
      ROOM_FURNITURE.splice(existing.index, 1);
      return true;
    }
    // Tap on existing furniture: rotate (flip)
    if (existing) {
      existing.item.rotated = !existing.item.rotated;
      return true;
    }
    // Empty tile + palette selection: place
    if (state.selectedId) {
      ROOM_FURNITURE.push({
        id: state.selectedId,
        col, row,
        rotated: false,
      });
      return true;
    }
    return true;
  }

  window.editor = { state, onTileClick };
})();
