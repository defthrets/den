// Avatar customiser modal — uses window.den exposed by renderer.js
(() => {
  const den = window.den;
  const modal     = document.getElementById('customiser');
  const closeBtn  = document.getElementById('custClose');
  const saveBtn   = document.getElementById('custSave');
  const profile   = document.getElementById('profile');
  const tabsEl    = document.getElementById('custTabs');
  const content   = document.getElementById('custContent');
  const previewC  = document.getElementById('avatarPreview');
  const previewX  = previewC.getContext('2d');
  previewX.imageSmoothingEnabled = false;

  // Working copy that we mutate while the modal is open. Only copied
  // back to me.cfg on Save.
  let draft = null;
  let activeTab = 'hair';

  function open() {
    draft = { ...den.me.cfg };
    activeTab = 'hair';
    renderTabs();
    renderTab();
    renderPreview();
    modal.classList.add('open');
  }
  function close() { modal.classList.remove('open'); }
  function save() {
    den.me.cfg = draft;
    den.rebuildSprite(den.me);
    close();
    // TODO: PUT /users/me/avatar with draft
  }

  profile.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  saveBtn.addEventListener('click', save);

  // ── Tabs ────────────────────────────────────────────────────────────
  function renderTabs() {
    [...tabsEl.children].forEach((el) => {
      el.classList.toggle('active', el.dataset.tab === activeTab);
      el.onclick = () => { activeTab = el.dataset.tab; renderTabs(); renderTab(); };
    });
  }

  // ── Preview ─────────────────────────────────────────────────────────
  function renderPreview() {
    const sprite = den.buildAvatarSprite(draft);
    previewX.clearRect(0, 0, previewC.width, previewC.height);
    previewX.drawImage(sprite, 0, 0);
  }

  // ── Chip rendering — show a tiny avatar with just one part swapped ──
  function chipSprite(partKey, styleId, cfg) {
    const tempCfg = { ...cfg };
    tempCfg[`${partKey}Style`] = styleId;
    return den.buildAvatarSprite(tempCfg);
  }

  function makeStyleChip(partKey, opt) {
    const div = document.createElement('div');
    div.className = 'style-chip' + (draft[`${partKey}Style`] === opt.id ? ' active' : '');
    const c = document.createElement('canvas');
    c.width = den.AVATAR_W; c.height = den.AVATAR_H;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(chipSprite(partKey, opt.id, draft), 0, 0);
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = opt.name;
    div.appendChild(c);
    div.appendChild(lbl);
    div.onclick = () => {
      draft[`${partKey}Style`] = opt.id;
      renderTab(); renderPreview();
    };
    return div;
  }

  function makeColorSwatch(slot, hex) {
    const div = document.createElement('div');
    div.className = 'color-swatch' + (draft[slot] === hex ? ' active' : '');
    div.style.background = hex;
    div.onclick = () => {
      draft[slot] = hex;
      renderTab(); renderPreview();
    };
    return div;
  }

  function renderTab() {
    content.innerHTML = '';

    const stylesLbl = document.createElement('div');
    stylesLbl.className = 'cust-section-label';
    const colorsLbl = document.createElement('div');
    colorsLbl.className = 'cust-section-label';
    colorsLbl.textContent = 'Color';

    const stylesRow = document.createElement('div');
    stylesRow.className = 'styles-row';
    const colorsRow = document.createElement('div');
    colorsRow.className = 'colors-row';

    switch (activeTab) {
      case 'hair':
        stylesLbl.textContent = 'Hair style';
        den.WARDROBE.hair.forEach(o => stylesRow.appendChild(makeStyleChip('hair', o)));
        den.WARDROBE.hairColors.forEach(c => colorsRow.appendChild(makeColorSwatch('hair', c)));
        content.append(stylesLbl, stylesRow, colorsLbl, colorsRow);
        break;
      case 'skin':
        colorsLbl.textContent = 'Skin tone';
        den.WARDROBE.skinTones.forEach(c => colorsRow.appendChild(makeColorSwatch('skin', c)));
        content.append(colorsLbl, colorsRow);
        break;
      case 'shirt':
        stylesLbl.textContent = 'Shirt style';
        den.WARDROBE.shirt.forEach(o => stylesRow.appendChild(makeStyleChip('shirt', o)));
        den.WARDROBE.shirtColors.forEach(c => colorsRow.appendChild(makeColorSwatch('shirt', c)));
        content.append(stylesLbl, stylesRow, colorsLbl, colorsRow);
        break;
      case 'pants':
        stylesLbl.textContent = 'Pants style';
        den.WARDROBE.pants.forEach(o => stylesRow.appendChild(makeStyleChip('pants', o)));
        den.WARDROBE.pantsColors.forEach(c => colorsRow.appendChild(makeColorSwatch('pants', c)));
        content.append(stylesLbl, stylesRow, colorsLbl, colorsRow);
        break;
    }
  }
})();
