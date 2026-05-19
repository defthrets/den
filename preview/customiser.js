// Avatar customiser modal — body picker + parts UI (Habbo-style).
//
// "Body" works today (picks boy / girl base sprite generated via PixelLab).
// Hair / Glasses / Top / Pants / Shoes / Accessory tabs are scaffolded
// with placeholder content while we generate part variants.
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
    { id: 'body',      label: 'Body',      stub: false },
    { id: 'hair',      label: 'Hair',      stub: true  },
    { id: 'glasses',   label: 'Glasses',   stub: true  },
    { id: 'top',       label: 'Top',       stub: true  },
    { id: 'pants',     label: 'Pants',     stub: true  },
    { id: 'shoes',     label: 'Shoes',     stub: true  },
    { id: 'accessory', label: 'Accessory', stub: true  },
  ];
  let activeTab = 'body';
  let draftPreset = den.me.cfg.preset;
  const spriteCache = {};

  function loadSprite(id) {
    if (spriteCache[id]) return spriteCache[id];
    const img = new Image();
    img.src = `sprites/${id}.png?v=${den.SPRITE_VERSION ?? 1}`;
    spriteCache[id] = img;
    return img;
  }

  function renderPreview() {
    const img = loadSprite(draftPreset);
    const draw = () => {
      previewX.clearRect(0, 0, previewC.width, previewC.height);
      previewX.drawImage(img, 0, 0, den.FRAME_W, den.FRAME_H, 0, 0, previewC.width, previewC.height);
    };
    if (img.complete) draw();
    else img.onload = draw;
  }

  function renderTabs() {
    tabsEl.innerHTML = '';
    tabsEl.style.display = 'flex';
    tabsEl.style.overflowX = 'auto';
    for (const t of TABS) {
      const el = document.createElement('div');
      el.className = 'cust-tab' + (t.id === activeTab ? ' active' : '');
      el.dataset.tab = t.id;
      el.textContent = t.label;
      el.style.flex = '0 0 auto';
      el.style.padding = '12px 18px';
      el.onclick = () => { activeTab = t.id; renderTabs(); renderContent(); };
      tabsEl.appendChild(el);
    }
  }

  function renderContent() {
    content.innerHTML = '';
    if (activeTab === 'body') {
      renderBodyPicker();
    } else {
      renderStub(TABS.find(t => t.id === activeTab));
    }
  }

  function renderBodyPicker() {
    const label = document.createElement('div');
    label.className = 'cust-section-label';
    label.textContent = 'BODY';
    content.appendChild(label);

    const row = document.createElement('div');
    row.className = 'styles-row';
    row.style.gap = '12px';
    content.appendChild(row);

    for (const p of den.presets) {
      row.appendChild(makeBodyChip(p));
    }
  }

  function makeBodyChip(preset) {
    const active = preset.id === draftPreset;
    const div = document.createElement('div');
    div.className = 'style-chip' + (active ? ' active' : '');

    const c = document.createElement('canvas');
    c.width = den.FRAME_W;
    c.height = den.FRAME_H;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    const img = loadSprite(preset.id);
    const blit = () => cx.drawImage(img, 0, 0, den.FRAME_W, den.FRAME_H, 0, 0, c.width, c.height);
    if (img.complete) blit(); else img.onload = blit;

    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = preset.name;

    div.appendChild(c);
    div.appendChild(lbl);
    div.onclick = () => {
      draftPreset = preset.id;
      renderBodyPicker();
      renderPreview();
    };
    return div;
  }

  function renderStub(tab) {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      padding: 32px 16px;
      text-align: center;
      color: var(--text-muted, #8B949E);
    `;
    wrap.innerHTML = `
      <div style="font-size:14px; font-weight:600; color:var(--text,#E6EDF3); margin-bottom:6px;">
        ${tab.label} — coming soon
      </div>
      <div style="font-size:12px; line-height:1.55;">
        Once we generate the ${tab.label.toLowerCase()} variants via PixelLab,<br/>
        you'll be able to pick options here and they'll layer onto your character.
      </div>
    `;
    content.appendChild(wrap);
  }

  function open() {
    draftPreset = den.me.cfg.preset;
    activeTab = 'body';
    renderTabs();
    renderContent();
    renderPreview();
    modal.classList.add('open');
  }
  function close() { modal.classList.remove('open'); }
  function save() {
    den.setPreset(den.me, draftPreset);
    close();
    // TODO: PUT /users/me/avatar with { preset: draftPreset }
  }

  profile.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  saveBtn.addEventListener('click', save);
})();
