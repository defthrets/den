// Friends modal — opens from the top-bar friends button, lists every
// friend with a pixel-art avatar preview, and visits them on tap.
// Add-friend prompts for a name and seeds an empty default den.

(() => {
  const modal      = document.getElementById('friendsModal');
  const closeBtn   = document.getElementById('friendsClose');
  const addBtn     = document.getElementById('friendAddBtn');
  const list       = document.getElementById('friendsList');
  const openBtn    = document.getElementById('friendsBtn');
  const backBtn    = document.getElementById('back');

  function open()  { modal.classList.add('open'); render(); }
  function close() { modal.classList.remove('open'); }

  function makeAvatarChip(preset) {
    // Renders a 32x32 head-and-shoulders sample from the sprite sheet so
    // each friend row shows a recognisable avatar.
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    const img = new Image();
    img.src = `sprites/${preset}.png?v=${(window.den && window.den.SPRITE_VERSION) || 1}`;
    const blit = () => {
      cx.clearRect(0, 0, 32, 32);
      if (img.naturalWidth > 0) {
        // First frame, row 0 (south-facing), top portion of 92x92 frame.
        cx.drawImage(img, 0, 0, 92, 92, -28, -10, 92, 92);
      }
    };
    if (img.complete) blit(); else img.onload = blit;
    return c;
  }

  function render() {
    list.innerHTML = '';
    const current = window.friends.denState.current;

    // "My den" row at the top so you can always navigate home.
    const meRow = document.createElement('div');
    meRow.className = 'friend-row' + (current === 'me' ? ' current' : '');
    meRow.innerHTML = `
      <div class="avatar"></div>
      <div class="meta"><div class="name">my den</div><div class="sub">home</div></div>
    `;
    const meCfg = window.den && window.den.me && window.den.me.cfg;
    meRow.querySelector('.avatar').appendChild(
      makeAvatarChip(meCfg && meCfg.preset || 'casual_blue_boy')
    );
    meRow.onclick = () => { window.friends.goHome(); close(); };
    list.appendChild(meRow);

    for (const f of window.friends.FRIENDS) {
      const row = document.createElement('div');
      row.className = 'friend-row' + (current === f.id ? ' current' : '');
      const den = f.den;
      row.innerHTML = `
        <div class="avatar"></div>
        <div class="meta"><div class="name">${f.name}</div>
        <div class="sub">${den.wallId} walls · ${den.floorId} floor</div></div>
      `;
      row.querySelector('.avatar').appendChild(makeAvatarChip(f.preset));
      row.onclick = () => { window.friends.visitFriend(f.id); close(); };
      list.appendChild(row);
    }
  }

  if (openBtn) openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (addBtn) addBtn.addEventListener('click', () => {
    const name = prompt('Friend name?');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const friend = window.friends.addFriend(trimmed);
    if (friend) render();
  });
  // Back button: when we're visiting someone, take us home.
  if (backBtn) backBtn.addEventListener('click', () => {
    if (window.friends.denState.current !== 'me') {
      window.friends.goHome();
    }
  });

  // Initialise state so we start in "my den" with the friend hidden.
  if (window.friends) {
    setTimeout(() => window.friends.goHome(), 50);
  }
})();
