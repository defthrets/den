// Avatar customiser — full preset (Body) OR mix-and-match per part
// (Head / Torso / Legs / Shoes). Picking in a part tab updates JUST that
// layer's preset id; Body picks all four to the same preset for a quick
// reset.
(() => {
  const den       = window.den;
  const modal     = document.getElementById('customiser');
  const closeBtn  = document.getElementById('custClose');
  const saveBtn   = document.getElementById('custSave');
  const profile   = document.getElementById('profile');
  const content   = document.getElementById('custContent');
  const previewC  = document.getElementById('avatarPreview');
  const previewX  = previewC.getContext('2d');
  const tabsEl    = document.getElementById('custTabs');
  previewX.imageSmoothingEnabled = false;
  previewC.width  = den.FRAME_W;
  previewC.height = den.FRAME_H;

  const TABS = [
    { id: 'body',  label: 'Body'  },
    { id: 'head',  label: 'Head'  },
    { id: 'torso', label: 'Torso' },
    { id: 'legs',  label: 'Legs'  },
    { id: 'shoes', label: 'Shoes' },
  ];
  let activeTab = 'body';

  // Draft state — what the user has tentatively picked but not saved.
  // Always keep a `parts` object so the preview composites correctly.
  let draft = { parts: { head: '', torso: '', legs: '', shoes: '' } };

  function syncDraftFromAvatar() {
    const cfg = den.me.cfg;
    if (cfg.parts) {
      draft = { parts: { ...cfg.parts } };
    } else {
      // Legacy single-preset → seed all four parts to that preset.
      draft = { parts: { head: cfg.preset, torso: cfg.preset,
                          legs: cfg.preset, shoes: cfg.preset } };
    }
  }

  const spriteCache = {};
  function loadSprite(name) {
    if (spriteCache[name]) return spriteCache[name];
    const img = new Image();
    img.src = `sprites/${name}.png?v=${den.SPRITE_VERSION ?? 1}`;
    spriteCache[name] = img;
    return img;
  }

  // ── Preview render ──────────────────────────────────────────────────
  // Always composites the four part-sheets from the current draft so the
  // user sees the live result.
  function renderPreview() {
    previewX.clearRect(0, 0, previewC.width, previewC.height);
    const layers = ['head', 'torso', 'legs', 'shoes'];
    const imgs = layers.map(l => loadSprite(`${l}_${draft.parts[l]}`));
    const draw = () => {
      previewX.clearRect(0, 0, previewC.width, previewC.height);
      for (const img of imgs) {
        if (img.complete && img.naturalWidth > 0) {
          previewX.drawImage(img, 0, 0, den.FRAME_W, den.FRAME_H,
                                  0, 0, previewC.width, previewC.height);
        }
      }
    };
    let remaining = imgs.length;
    const ready = () => { if (--remaining <= 0) draw(); };
    for (const img of imgs) {
      if (img.complete) ready();
      else { img.onload = ready; img.onerror = ready; }
    }
    draw();  // also paint whatever's already cached
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    tabsEl.style.display = 'flex';
    tabsEl.style.overflowX = 'auto';
    for (const t of TABS) {
      const el = document.createElement('div');
      el.className = 'cust-tab' + (t.id === activeTab ? ' active' : '');
      el.textContent = t.label;
      el.style.flex = '0 0 auto';
      el.style.padding = '12px 18px';
      el.onclick = () => { activeTab = t.id; renderTabs(); renderContent(); };
      tabsEl.appendChild(el);
    }
  }

  function renderContent() {
    content.innerHTML = '';
    if (activeTab === 'body') renderBodyPicker();
    else renderPartPicker(activeTab);
  }

  function renderBodyPicker() {
    const label = document.createElement('div');
    label.className = 'cust-section-label';
    label.textContent = 'PICK A FULL SET';
    content.appendChild(label);

    const row = document.createElement('div');
    row.className = 'styles-row';
    row.style.gap = '12px';
    content.appendChild(row);

    for (const p of den.presets) row.appendChild(makeFullChip(p));

    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:14px; color:var(--text-muted); font-size:11px; line-height:1.4;';
    hint.textContent = 'Or pick parts independently from the Head / Torso / Legs / Shoes tabs.';
    content.appendChild(hint);
  }

  function renderPartPicker(layer) {
    const label = document.createElement('div');
    label.className = 'cust-section-label';
    label.textContent = layer.toUpperCase();
    content.appendChild(label);

    const row = document.createElement('div');
    row.className = 'styles-row';
    row.style.gap = '12px';
    content.appendChild(row);

    for (const p of den.presets) row.appendChild(makePartChip(layer, p));
  }

  function makeFullChip(preset) {
    const active = ['head','torso','legs','shoes']
      .every(l => draft.parts[l] === preset.id);
    const div = document.createElement('div');
    div.className = 'style-chip' + (active ? ' active' : '');

    const c = document.createElement('canvas');
    c.width = den.FRAME_W; c.height = den.FRAME_H;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    const img = loadSprite(preset.id);
    const blit = () => cx.drawImage(img, 0, 0, den.FRAME_W, den.FRAME_H, 0, 0, c.width, c.height);
    if (img.complete) blit(); else { img.onload = blit; img.onerror = blit; }

    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = preset.name;

    div.appendChild(c); div.appendChild(lbl);
    div.onclick = () => {
      for (const l of ['head','torso','legs','shoes']) draft.parts[l] = preset.id;
      renderBodyPicker();
      renderPreview();
    };
    return div;
  }

  function makePartChip(layer, preset) {
    const active = draft.parts[layer] === preset.id;
    const div = document.createElement('div');
    div.className = 'style-chip' + (active ? ' active' : '');

    // Show ONLY this layer's band — easier to compare options.
    const c = document.createElement('canvas');
    c.width = den.FRAME_W; c.height = den.FRAME_H;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    const img = loadSprite(`${layer}_${preset.id}`);
    const blit = () => cx.drawImage(img, 0, 0, den.FRAME_W, den.FRAME_H, 0, 0, c.width, c.height);
    if (img.complete) blit(); else { img.onload = blit; img.onerror = blit; }

    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = preset.name;

    div.appendChild(c); div.appendChild(lbl);
    div.onclick = () => {
      draft.parts[layer] = preset.id;
      renderPartPicker(layer);
      renderPreview();
    };
    return div;
  }

  function open() {
    syncDraftFromAvatar();
    activeTab = 'body';
    renderTabs();
    renderContent();
    renderPreview();
    modal.classList.add('open');
  }
  function close() { modal.classList.remove('open'); }
  function save() {
    den.setParts(den.me, draft.parts);
    close();
  }

  profile.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  saveBtn.addEventListener('click', save);
})();
