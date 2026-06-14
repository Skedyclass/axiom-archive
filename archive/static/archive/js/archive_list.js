/* ══════════════════════════════════════════════════════════════════
   AXIOM — Archivero del agente + VISOR DE EXPEDIENTE
   · Pinta las tarjetas cruzando IDs autorizados (servidor) con el board
     pesado del localStorage (`axiom_agent_archive`).
   · Al INSPECCIONAR, abre un visor superpuesto que simula la apertura
     física de una carpeta clasificada y despliega la evidencia escalonada,
     en solo lectura, conservando X/Y/Z exactos de la Mesa de Trabajo.
══════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const ARCHIVE_KEY = 'axiom_agent_archive';
  const IMG_BASE = window.AXIOM_IMG_BASE || '/static/archive/img/';
  const grid  = document.getElementById('agent-archive');
  const empty = document.getElementById('archive-empty');
  if (!grid) return;

  const authorized = JSON.parse(document.getElementById('agent-folios').textContent || '[]');

  // ── utilidades ──
  const readArchive = () => { try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '{}'); } catch (_) { return {}; } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const imgSrc = (img) => !img ? '' : (img.startsWith('data:') ? img : IMG_BASE + img + '.svg');
  const countPieces = (b) => (b && Array.isArray(b.pages)) ? b.pages.reduce((n, p) => n + ((p.items && p.items.length) || 0), 0) : 0;

  // ════════════════════════════════════════════════════════════════
  //  LISTA DE EXPEDIENTES
  // ════════════════════════════════════════════════════════════════
  function renderList() {
    const archive = readArchive();
    if (!authorized.length) { grid.hidden = true; empty.hidden = false; return; }
    empty.hidden = true; grid.hidden = false; grid.innerHTML = '';

    authorized.forEach((folio) => {
      const local = archive[folio.id];
      const missing = !local;
      const pieces = local ? countPieces(local.board) : null;

      // Cada expediente = carpeta manila cerrada (image_a6adbb)
      const card = document.createElement('a');
      card.className = 'folio-folder' + (missing ? ' is-missing' : '');
      card.href = (window.AXIOM_FOLIO_VIEW_URL || '#').replace('FOLIO-XXXX', folio.id);
      card.innerHTML = `
        <div class="ff-tab"></div>
        <div class="ff-clip"></div>
        <div class="ff-head">MINISTRY OF DEFENCE</div>
        <div class="ff-restricted">RESTRICTED</div>
        <div class="ff-id">${esc(folio.id)}</div>
        <div class="ff-title">${esc(folio.title)}</div>
        <div class="ff-sticker">
          <span>FILED: ${esc(folio.date || '██.██.██')}</span>
          <span>SIG: AGT-${esc((folio.id.match(/\d+/) || ['00'])[0])}</span>
        </div>
        <div class="ff-closed">${missing ? 'DATA OFFLINE' : 'CLOSED UNTIL ████'}</div>
        <div class="ff-action">${missing ? '⚠ NO DISPONIBLE' : '▸ INSPECCIONAR — ' + pieces + ' EVID.'}</div>`;

      // Interceptamos: abrimos el visor inmersivo. Si algo falla, NO dejamos
      // al agente atascado: navegamos a la página del expediente como respaldo.
      card.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          openFolder(folio, local);
        } catch (err) {
          console.error('[AXIOM] El visor falló, navegando al expediente:', err);
          window.location.href = card.href;
        }
      });
      grid.appendChild(card);
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  RENDERIZADOR DE EVIDENCIA (SOLO LECTURA)
  // ════════════════════════════════════════════════════════════════
  const SVGNS = 'http://www.w3.org/2000/svg';

  function positionEl(el, item) {
    el.style.left = item.x + 'px'; el.style.top = item.y + 'px';
    el.style.zIndex = item.z; el.style.transform = `rotate(${item.rot || 0}deg)`;
  }

  function buildPiece(item) {
    const el = document.createElement('div');
    el.className = `ev ev-${item.type} fv-piece`;

    if (item.type === 'polaroid') {
      el.innerHTML = `<div class="pol-photo ${item.img ? '' : 'is-empty'}"></div><div class="pol-caption">${esc(item.text)}</div>`;
      if (item.img) el.querySelector('.pol-photo').style.backgroundImage = `url('${imgSrc(item.img)}')`;

    } else if (item.type === 'note') {
      el.classList.add(`note-${item.variant || 'grid'}`);
      el.innerHTML = `<div class="note-text">${esc(item.text)}</div>`;

    } else if (item.type === 'idcard') {
      el.innerHTML = `<div class="id-head"><span>AXIOM // ID</span><span>${esc(item.level)}</span></div>
        <div class="id-body"><div class="id-photo"></div>
          <div class="id-fields"><span class="id-name">${esc(item.name)}</span>
            <span>${esc(item.role)}</span><br>COD: <span>${esc(item.code)}</span></div></div>
        <div class="id-barcode"></div>`;
      if (item.img) el.querySelector('.id-photo').style.backgroundImage = `url('${imgSrc(item.img)}')`;

    } else if (item.type === 'cassette') {
      el.innerHTML = `<div class="cas-flat">
          <div class="cas-file">TAPE_DRIVE_A_TRANSCRIPT.TXT</div>
          <div class="cas-ascii">[ (o)=========(o) ]</div>
          <div class="cas-label">${esc(item.text)}</div></div>`;

    } else if (item.type === 'stamp') {
      el.innerHTML = `<span>${esc(item.text)}</span>`;

    } else if (item.type === 'inkstamp') {
      el.classList.add(`ink-${item.ink || 'red'}`);
      el.innerHTML = `<span>${esc(item.text)}</span>`;
    }
    positionEl(el, item);
    return el;
  }

  // Orden de aparición: fondo → reportes escritos → fotos → clips/sellos
  const REVEAL_ORDER = { note: 1, cassette: 1, idcard: 2, polaroid: 2, clip: 3, stamp: 3, inkstamp: 3 };

  let revealTimers = [];
  function clearTimers() { revealTimers.forEach(clearTimeout); revealTimers = []; }

  function drawThreads(ctx) {
    const { svg, pieces, links } = ctx;
    svg.innerHTML = '';
    if (!links || !links.length) return;
    const byId = {};
    pieces.forEach((p) => { byId[p.item.id] = p.el; });
    links.forEach((l) => {
      const a = byId[l.from], b = byId[l.to];
      if (!a || !b) return;
      const ax = a.offsetLeft + a.offsetWidth / 2, ay = a.offsetTop + a.offsetHeight / 2;
      const bx = b.offsetLeft + b.offsetWidth / 2, by = b.offsetTop + b.offsetHeight / 2;
      const ln = document.createElementNS(SVGNS, 'line');
      ln.setAttribute('x1', ax); ln.setAttribute('y1', ay);
      ln.setAttribute('x2', bx); ln.setAttribute('y2', by);
      ln.setAttribute('class', 'ws-thread');
      svg.appendChild(ln);
      [[ax, ay], [bx, by]].forEach(([x, y]) => {
        const r = document.createElementNS(SVGNS, 'rect');
        r.setAttribute('x', x - 3); r.setAttribute('y', y - 3);
        r.setAttribute('width', 6); r.setAttribute('height', 6);
        r.setAttribute('class', 'ws-thread-pin');
        svg.appendChild(r);
      });
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  VISOR — estado + paginación + página restringida + luz UV
  // ════════════════════════════════════════════════════════════════
  const viewer  = document.getElementById('folder-viewer');
  const folder  = document.getElementById('fv-folder');
  const canvas  = document.getElementById('fv-canvas');
  const addInfo = document.getElementById('fv-addinfo');
  const sticker = document.getElementById('fv-sticker');
  const pager   = document.getElementById('fv-pager');
  const tabsBox = document.getElementById('fv-tabs');
  const prevBtn = document.getElementById('fv-prev');
  const nextBtn = document.getElementById('fv-next');
  const uvBtn   = document.getElementById('fv-uv');
  const keybox  = document.getElementById('fv-keybox');
  const keyInput = document.getElementById('fv-keybox-input');

  const DEFAULT_KEY = 'AXIOM';
  const pageKey = (pg) => String((pg && pg.key) || DEFAULT_KEY).trim().toUpperCase();
  const isRestricted = (pg) => !!(pg && pg.restricted);

  let view = null;          // { pages, index, unlocked:Set, ctx }
  let isOpen = false;
  let pendingPage = null;   // página esperando clave
  let uvOn = false;

  function sound(name) { try { if (window.AxiomSound) window.AxiomSound.play(name); } catch (_) {} }

  // ── render de una página concreta ──
  function renderPage(animate) {
    clearTimers();
    canvas.innerHTML = '';
    const page = view.pages[view.index] || { items: [], links: [] };

    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'ws-links');
    svg.setAttribute('width', '900'); svg.setAttribute('height', '700');
    canvas.appendChild(svg);

    const pieces = (page.items || []).slice().sort((a, b) => a.z - b.z).map((item) => {
      const el = buildPiece(item); canvas.appendChild(el); return { el, item };
    });
    injectUvMark();
    view.ctx = { svg, pieces, links: page.links || [] };

    if (animate) { canvas.classList.remove('fv-page-anim'); void canvas.offsetWidth; canvas.classList.add('fv-page-anim'); }

    const ordered = pieces.slice().sort((a, b) =>
      (REVEAL_ORDER[a.item.type] || 9) - (REVEAL_ORDER[b.item.type] || 9) || (a.item.z - b.item.z));
    ordered.forEach((p, i) => revealTimers.push(setTimeout(() => p.el.classList.add('is-revealed'), i * 70)));
    revealTimers.push(setTimeout(() => drawThreads(view.ctx), ordered.length * 70 + 120));

    buildTabs();
    updatePager();
  }

  // Marca oculta revelable con luz UV. En la 1ª hoja delata la clave restringida.
  function injectUvMark() {
    const mark = document.createElement('div');
    mark.className = 'uv-hidden uv-mark';
    const restricted = view.pages.find(isRestricted);
    mark.textContent = (restricted && view.index === 0)
      ? '⟂ CLAVE OCULTA → ' + pageKey(restricted)
      : '⟂ AXIOM/UV ' + String(view.index + 1).padStart(2, '0') + ' — SIN MARCAS';
    canvas.appendChild(mark);
  }

  function buildTabs() {
    tabsBox.innerHTML = '';
    view.pages.forEach((pg, i) => {
      const t = document.createElement('button');
      const locked = isRestricted(pg) && !view.unlocked.has(i);
      t.className = 'fv-tab' + (i === view.index ? ' is-active' : '') + (locked ? ' is-locked' : '');
      t.textContent = 'PAG_' + String(i + 1).padStart(2, '0');
      t.addEventListener('click', () => goToPage(i));
      tabsBox.appendChild(t);
    });
  }
  function updatePager() {
    prevBtn.disabled = view.index <= 0;
    nextBtn.disabled = view.index >= view.pages.length - 1;
  }

  function goToPage(i) {
    if (!view || i < 0 || i >= view.pages.length || i === view.index) return;
    const target = view.pages[i];
    if (isRestricted(target) && !view.unlocked.has(i)) { promptKey(i); return; }
    hideKeybox();
    view.index = i;
    renderPage(true);
  }

  // ── página de clasificación restringida ──
  function promptKey(i) {
    pendingPage = i;
    keybox.hidden = false;
    pager.classList.add('is-restricted');
    keyInput.value = ''; keyInput.placeholder = 'CLAVE>'; keyInput.focus();
  }
  function hideKeybox() { keybox.hidden = true; pager.classList.remove('is-restricted'); pendingPage = null; }
  function tryKey() {
    if (pendingPage == null) return;
    if (keyInput.value.trim().toUpperCase() === pageKey(view.pages[pendingPage])) {
      const i = pendingPage; view.unlocked.add(i); hideKeybox();
      view.index = i; renderPage(true); sound('open');
    } else { keyInput.value = ''; keyInput.placeholder = 'CLAVE INCORRECTA'; }
  }

  // ── luz UV ──
  function setUv(on) {
    uvOn = on;
    viewer.classList.toggle('uv-on', on);
    uvBtn.classList.toggle('is-on', on);
    uvBtn.textContent = '[ LUZ_UV: ' + (on ? 'ON' : 'OFF') + ' ]';
  }

  function openFolder(folio, local) {
    document.getElementById('fv-title').textContent = folio.id;
    document.getElementById('fv-code').textContent = folio.id;
    canvas.dataset.label = (folio.title || 'EVIDENCIA').toUpperCase();
    if (sticker) sticker.innerHTML = `FILED ${esc(folio.date || '██.██.██')} · SIG AGT-${esc((folio.id.match(/\d+/) || ['00'])[0])}`;
    addInfo.href = (window.AXIOM_FOLIO_EXPAND_URL || '#').replace('FOLIO-XXXX', folio.id);
    addInfo.hidden = true;
    setUv(false); hideKeybox(); pager.hidden = true;

    const board = (local && local.board) || null;
    let pages = (board && board.pages && board.pages.length) ? board.pages : null;
    if (!pages) {
      pages = [{ items: [{ id: 'na', type: 'note', variant: 'cipher', x: 300, y: 280, z: 1,
                           text: 'EVIDENCIA NO DISPONIBLE\nEN ESTE TERMINAL.' }], links: [] }];
    }
    view = { pages, index: 0, unlocked: new Set(), ctx: null };

    sound('open');
    viewer.hidden = false;
    folder.classList.add('is-closed', 'is-armed');
    folder.classList.remove('is-open');
    isOpen = true;

    void folder.offsetWidth;
    requestAnimationFrame(() => {
      viewer.classList.add('is-visible');
      requestAnimationFrame(() => { folder.classList.remove('is-closed'); folder.classList.add('is-open'); });
    });

    // Tras el deslizamiento (0.3s) montamos la página y la paginación.
    clearTimers();
    revealTimers.push(setTimeout(() => {
      pager.hidden = false;
      renderPage(false);
      addInfo.hidden = false;
      folder.classList.remove('is-armed');
    }, 320));
  }

  function closeFolder() {
    if (!isOpen) return;
    clearTimers();
    addInfo.hidden = true; pager.hidden = true; hideKeybox(); setUv(false);
    if (view && view.ctx) { view.ctx.pieces.forEach((p) => p.el.classList.remove('is-revealed')); view.ctx.svg.innerHTML = ''; }
    sound('close');
    folder.classList.add('is-armed');
    folder.classList.remove('is-open');
    folder.classList.add('is-closed');
    viewer.classList.remove('is-visible');
    isOpen = false;
    setTimeout(() => {
      viewer.hidden = true; folder.classList.remove('is-armed');
      canvas.innerHTML = ''; view = null;
    }, 340);
  }

  // ── arranque ──  (renderList PRIMERO: la lista nunca depende del visor)
  renderList();

  const closeBtn = document.getElementById('fv-close');
  if (closeBtn) closeBtn.addEventListener('click', closeFolder);
  if (prevBtn) prevBtn.addEventListener('click', () => view && goToPage(view.index - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => view && goToPage(view.index + 1));
  if (uvBtn) uvBtn.addEventListener('click', () => setUv(!uvOn));
  if (keyInput) keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryKey(); });
  const keyGo = document.getElementById('fv-keybox-go');
  if (keyGo) keyGo.addEventListener('click', tryKey);

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen) return;
    if (!keybox.hidden) { hideKeybox(); return; }   // ESC cierra primero la consola
    closeFolder();
  });
  // Clic en el fondo oscuro (fuera de la carpeta) también cierra.
  if (viewer) viewer.addEventListener('click', (e) => {
    if (e.target === viewer || (e.target.classList && e.target.classList.contains('fv-stage'))) closeFolder();
  });
  window.addEventListener('storage', (e) => { if (e.key === ARCHIVE_KEY) renderList(); });
})();
