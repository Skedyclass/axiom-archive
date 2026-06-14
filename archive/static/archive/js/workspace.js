/* ══════════════════════════════════════════════════════════════════
   AXIOM — MESA DE TRABAJO
   Persistencia INTELIGENTE:
     · El board pesado (imágenes base64, coordenadas, notas, hilos, sellos)
       vive en localStorage → key `axiom_agent_archive` = { folioId: {id,title,date,board} }.
     · El servidor solo recibe { folio_id, title } y mantiene el índice de
       folios autorizados en la sesión.

   Modos: create | view (solo lectura) | expand (ampliar, originales bloqueadas).

   Herramientas: Polaroid (revelado químico), Nota, Tarjeta ID, Casete,
   Clip, Hilo rojo (vincular), Sello de tinta (RECHAZADO/APROBADO/QUEMAR),
   e intercepción de señal a los 5 min.
   Sin dependencias.
══════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const CFG  = JSON.parse(document.getElementById('ws-config').textContent);
  const MODE = CFG.mode || 'create';
  const CAN_ADD = (MODE === 'create' || MODE === 'expand');
  const CSRF = document.querySelector('[name=csrfmiddlewaretoken]').value;

  const ARCHIVE_KEY = 'axiom_agent_archive';   // todos los folios pesados
  const DRAFT_KEY   = 'axiom_workspace_draft';  // borrador de "create"

  // ── Estado ────────────────────────────────────────────────────────
  let state = { v: 1, title: CFG.title || 'EXPEDIENTE', pages: [], active: 0 };
  let folioId = CFG.folioId || null;
  let zCounter = 1, uid = 0;
  const lockedIds = new Set();
  const nextId = () => `e${Date.now().toString(36)}${(uid++).toString(36)}`;

  // ── Modos de herramienta ───────────────────────────────────────────
  let linkMode = false, linkSource = null;
  let stampPending = null;             // { label, ink }
  let inkColor = 'red';

  // ── DOM ─────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const stage = $('ws-stage'), tabs = $('ws-page-tabs'), ctx = $('ws-ctx'), statusEl = $('ws-status');

  // ════════════════════════════════════════════════════════════════
  //  ALMACÉN LOCAL
  // ════════════════════════════════════════════════════════════════
  function readArchive() {
    try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '{}'); } catch (_) { return {}; }
  }
  function writeArchive(obj) {
    try { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(obj)); return true; }
    catch (e) { toast('ALMACÉN LOCAL LLENO — libera espacio', 'error'); return false; }
  }
  function putFolio(id, title, board) {
    const arc = readArchive();
    const prev = arc[id] || {};
    arc[id] = { id, title: title || prev.title || 'EXPEDIENTE',
                date: prev.date || new Date().toLocaleDateString(), board };
    return writeArchive(arc);
  }

  // ════════════════════════════════════════════════════════════════
  //  MODELO
  // ════════════════════════════════════════════════════════════════
  function newPage(label) {
    return { id: `p${Date.now().toString(36)}${(uid++).toString(36)}`,
             label: label || `PÁGINA ${state.pages.length + 1}`, items: [], links: [] };
  }
  function activePage() { return state.pages[state.active]; }
  const isLocked = (id) => lockedIds.has(id);

  function defaultItem(type) {
    const base = { id: nextId(), type, x: 320, y: 220, rot: rand(-6, 6), z: ++zCounter };
    switch (type) {
      case 'polaroid': return { ...base, img: '', text: 'sin etiquetar' };
      case 'note':     return { ...base, text: 'Escribe aquí…', variant: 'grid' };
      case 'cipher':   return { ...base, type: 'note', variant: 'cipher', rot: rand(-3, 3),
                                text: '⚡ SEÑAL INTERCEPTADA — 0x7F\nTRANSMISIÓN PARCIAL:\n\n'
                                    + 'RWwgY3VlcnZvIHZ1ZWxh\nIGFsIGFtYW5lY2Vy\n\n[FORMATO: BASE64]' };
      case 'idcard':   return { ...base, name: 'APELLIDO, N.', role: 'ANALISTA',
                                level: '3', code: 'AX-0000', img: '' };
      case 'cassette': return { ...base, text: 'AUDIO INTERCEPTADO\n— transcripción —' };
      case 'stamp':    return { ...base, rot: rand(-12, 12), text: 'CLASIFICADO' };
      case 'inkstamp': return { ...base, rot: rand(-14, 14), text: 'RECHAZADO', ink: 'red' };
      case 'clip':     return { ...base, rot: rand(-8, 8) };
      default:         return base;
    }
  }

  function buildEl(item) {
    const el = document.createElement('div');
    el.className = `ev ev-${item.type}`;
    el.dataset.id = item.id;
    const locked = isLocked(item.id);
    if (locked) el.classList.add('is-locked');
    const ed = locked ? 'false' : 'true';

    if (item.type === 'polaroid') {
      el.innerHTML = `<div class="pol-photo ${item.img ? '' : 'is-empty'}" data-role="photo"></div>
        <div class="pol-caption" contenteditable="${ed}" data-bind="text"></div>`;
      paintPhoto(el.querySelector('.pol-photo'), item.img);
      el.querySelector('.pol-caption').textContent = item.text;

    } else if (item.type === 'note') {
      el.classList.add(`note-${item.variant || 'grid'}`);
      el.innerHTML = `<div class="note-text" contenteditable="${ed}" data-bind="text"></div>`;
      el.querySelector('.note-text').textContent = item.text;

    } else if (item.type === 'idcard') {
      el.innerHTML = `<div class="id-head"><span>AXIOM // ID</span><span data-bind="level" contenteditable="${ed}">${esc(item.level)}</span></div>
        <div class="id-body"><div class="id-photo" data-role="photo"></div>
          <div class="id-fields"><span class="id-name" data-bind="name" contenteditable="${ed}">${esc(item.name)}</span>
            <span data-bind="role" contenteditable="${ed}">${esc(item.role)}</span><br>
            COD: <span data-bind="code" contenteditable="${ed}">${esc(item.code)}</span></div></div>
        <div class="id-barcode"></div>`;
      paintPhoto(el.querySelector('.id-photo'), item.img);

    } else if (item.type === 'cassette') {
      el.innerHTML = `<div class="cas-flat">
          <div class="cas-file">TAPE_DRIVE_A_TRANSCRIPT.TXT</div>
          <div class="cas-ascii">[ (o)=========(o) ]</div>
          <div class="cas-label" contenteditable="${ed}" data-bind="text"></div>
        </div>`;
      el.querySelector('.cas-label').textContent = item.text;

    } else if (item.type === 'stamp') {
      el.innerHTML = `<span data-bind="text" contenteditable="${ed}">${esc(item.text)}</span>`;

    } else if (item.type === 'inkstamp') {
      el.classList.add(`ink-${item.ink || 'red'}`);
      el.innerHTML = `<span data-bind="text" contenteditable="${ed}">${esc(item.text)}</span>`;
    }

    positionEl(el, item);
    if (!locked) { bindEditable(el, item); wirePhoto(el, item); }
    return el;
  }

  function paintPhoto(node, img) {
    if (!node) return;
    if (img) { node.style.backgroundImage = `url('${img.startsWith('data:') ? img : photoSrc(img)}')`;
               node.classList.remove('is-empty'); }
    else { node.style.backgroundImage = ''; node.classList.add('is-empty'); }
  }
  function photoSrc(key) { const p = CFG.photos.find((p) => p.key === key); return p ? p.src : ''; }

  function positionEl(el, item) {
    el.style.left = item.x + 'px'; el.style.top = item.y + 'px';
    el.style.zIndex = item.z; el.style.transform = `rotate(${item.rot}deg)`;
  }

  function bindEditable(el, item) {
    el.querySelectorAll('[data-bind]').forEach((node) => {
      node.addEventListener('blur', () => { item[node.dataset.bind] = node.textContent.trim(); autosave(); });
      node.addEventListener('pointerdown', (e) => { if (!linkMode && !stampPending) e.stopPropagation(); });
    });
  }
  function wirePhoto(el, item) {
    const photo = el.querySelector('[data-role="photo"]');
    if (photo) photo._openPicker = () => openPhotoPicker(item, photo, el);
  }

  function developPolaroid(el) {
    if (!el || !el.classList.contains('ev-polaroid')) return;
    el.classList.remove('is-developing'); void el.offsetWidth;
    el.classList.add('is-developing');
    setTimeout(() => el.classList.remove('is-developing'), 3200);
  }

  // ════════════════════════════════════════════════════════════════
  //  RENDER + HILOS (SVG)
  // ════════════════════════════════════════════════════════════════
  let linksSvg = null;

  function render() {
    tabs.innerHTML = '';
    state.pages.forEach((pg, i) => {
      const t = document.createElement('button');
      t.className = 'ws-page-tab' + (i === state.active ? ' is-active' : '');
      t.textContent = pg.label;
      t.addEventListener('click', () => { state.active = i; linkSource = null; render(); hideCtx(); });
      tabs.appendChild(t);
    });

    stage.innerHTML = '';
    const canvas = document.createElement('div');
    canvas.className = 'ws-canvas';
    canvas.id = 'ws-canvas';
    canvas.dataset.label = activePage().label;

    linksSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    linksSvg.setAttribute('class', 'ws-links');
    linksSvg.setAttribute('width', '900'); linksSvg.setAttribute('height', '700');
    canvas.appendChild(linksSvg);

    activePage().items.slice().sort((a, b) => a.z - b.z)
      .forEach((item) => canvas.appendChild(buildEl(item)));
    stage.appendChild(canvas);
    updateLinks();

    canvas.addEventListener('pointerdown', (e) => { if (e.target === canvas) { clearSelection(); } });
    canvas.addEventListener('click', onCanvasClick);
  }

  function updateLinks() {
    if (!linksSvg) return;
    const canvas = $('ws-canvas');
    const page = activePage();
    page.links = (page.links || []).filter((l) =>
      page.items.some((i) => i.id === l.from) && page.items.some((i) => i.id === l.to));
    linksSvg.innerHTML = '';
    page.links.forEach((l) => {
      const a = canvas.querySelector(`.ev[data-id="${l.from}"]`);
      const b = canvas.querySelector(`.ev[data-id="${l.to}"]`);
      if (!a || !b) return;
      const ax = a.offsetLeft + a.offsetWidth / 2, ay = a.offsetTop + a.offsetHeight / 2;
      const bx = b.offsetLeft + b.offsetWidth / 2, by = b.offsetTop + b.offsetHeight / 2;
      linksSvg.appendChild(svgLine(ax, ay, bx, by));
      linksSvg.appendChild(svgPin(ax, ay));
      linksSvg.appendChild(svgPin(bx, by));
    });
  }
  function svgLine(x1, y1, x2, y2) {
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    ln.setAttribute('x1', x1); ln.setAttribute('y1', y1);
    ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
    ln.setAttribute('class', 'ws-thread');
    return ln;
  }
  function svgPin(x, y) {
    // Pin cuadrado pixelado (trazado vectorial tosco de computadora vieja)
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', x - 3); r.setAttribute('y', y - 3);
    r.setAttribute('width', 6); r.setAttribute('height', 6);
    r.setAttribute('class', 'ws-thread-pin');
    return r;
  }

  // ════════════════════════════════════════════════════════════════
  //  AÑADIR / ELIMINAR
  // ════════════════════════════════════════════════════════════════
  function addItem(type, at) {
    if (!CAN_ADD) return null;
    const item = defaultItem(type);
    if (at) { item.x = at.x; item.y = at.y; } else { item.x += rand(-30, 30); item.y += rand(-30, 30); }
    activePage().items.push(item);
    const el = buildEl(item);
    $('ws-canvas').appendChild(el);
    selectEl(el, item);
    if (item.type === 'polaroid' || item.type === 'idcard') {
      const photo = el.querySelector('[data-role="photo"]');
      if (photo) openPhotoPicker(item, photo, el);
    }
    autosave();
    return item;
  }

  function deleteItem(item, el) {
    if (isLocked(item.id)) { toast('PIEZA BLOQUEADA — registro original', 'error'); return; }
    const pg = activePage();
    const idx = pg.items.indexOf(item);
    if (idx > -1) pg.items.splice(idx, 1);
    pg.links = (pg.links || []).filter((l) => l.from !== item.id && l.to !== item.id);
    el.remove(); hideCtx(); updateLinks(); autosave();
  }

  // ════════════════════════════════════════════════════════════════
  //  SELECCIÓN + CAPAS + CTX
  // ════════════════════════════════════════════════════════════════
  let selected = null;
  function selectEl(el, item) {
    clearSelection();
    if (isLocked(item.id)) return;
    selected = { el, item };
    el.classList.add('is-selected');
    bringToFront(item, el); showCtx();
  }
  function clearSelection() {
    if (selected) selected.el.classList.remove('is-selected');
    selected = null; hideCtx();
  }
  function bringToFront(item, el) { item.z = ++zCounter; el.style.zIndex = item.z; updateLinks(); }
  function sendToBack(item, el) {
    item.z = Math.min(...activePage().items.map((i) => i.z)) - 1; el.style.zIndex = item.z; updateLinks();
  }
  function rotate(item, el, d) {
    item.rot = ((item.rot + d + 180) % 360) - 180;
    el.style.transform = `rotate(${item.rot}deg)`; positionCtx(); updateLinks();
  }
  function showCtx() { ctx.hidden = false; positionCtx(); }
  function hideCtx() { ctx.hidden = true; }
  function positionCtx() {
    if (!selected || ctx.hidden) return;
    const r = selected.el.getBoundingClientRect();
    ctx.style.left = Math.max(8, r.left) + 'px';
    ctx.style.top = Math.max(8, r.top - 40) + 'px';
  }
  ctx.addEventListener('click', (e) => {
    const act = e.target.dataset.act; if (!act || !selected) return;
    const { item, el } = selected;
    if (act === 'front') bringToFront(item, el);
    if (act === 'back')  sendToBack(item, el);
    if (act === 'rotL')  rotate(item, el, -8);
    if (act === 'rotR')  rotate(item, el, 8);
    if (act === 'delete') deleteItem(item, el);
    autosave();
  });

  // ════════════════════════════════════════════════════════════════
  //  ARRASTRE (deshabilitado en modo Hilo o Sello)
  // ════════════════════════════════════════════════════════════════
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (linkMode || stampPending) return;
    if (e.target.isContentEditable) return;
    const el = e.target.closest('.ev'); if (!el) return;
    const item = findItem(el.dataset.id);
    if (!item || isLocked(item.id)) return;
    const r = $('ws-canvas').getBoundingClientRect();
    drag = { el, item, photoNode: e.target.closest('[data-role="photo"]'),
             startX: e.clientX, startY: e.clientY,
             offX: e.clientX - r.left - item.x, offY: e.clientY - r.top - item.y, moved: false };
    el.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 4) return;
    if (!drag.moved) { drag.moved = true; drag.el.classList.add('is-dragging'); selectEl(drag.el, drag.item); }
    const r = $('ws-canvas').getBoundingClientRect();
    drag.item.x = Math.round(e.clientX - r.left - drag.offX);
    drag.item.y = Math.round(e.clientY - r.top - drag.offY);
    positionEl(drag.el, drag.item); positionCtx(); updateLinks();
  });
  stage.addEventListener('pointerup', (e) => {
    if (!drag) return;
    drag.el.classList.remove('is-dragging');
    try { drag.el.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!drag.moved) {
      selectEl(drag.el, drag.item);
      if (drag.photoNode && drag.photoNode._openPicker) drag.photoNode._openPicker();
    } else { autosave(); }
    drag = null;
  });
  stage.addEventListener('dblclick', (e) => {
    const ed = e.target.closest('[contenteditable="true"]'); if (ed) ed.focus();
  });
  document.addEventListener('scroll', () => { positionCtx(); }, true);
  window.addEventListener('resize', positionCtx);
  function findItem(id) { return activePage().items.find((i) => i.id === id); }

  // ════════════════════════════════════════════════════════════════
  //  CLICK EN CANVAS — Hilo rojo / Sello de tinta
  // ════════════════════════════════════════════════════════════════
  function onCanvasClick(e) {
    // 1) Colocar sello de tinta
    if (stampPending) {
      const r = $('ws-canvas').getBoundingClientRect();
      const it = addItem('inkstamp', { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) });
      if (it) { it.text = stampPending.label; it.ink = stampPending.ink;
                const el = $('ws-canvas').querySelector(`.ev[data-id="${it.id}"]`);
                el.classList.remove('ink-red', 'ink-black');
                el.classList.add('ink-' + stampPending.ink);
                el.querySelector('[data-bind="text"]').textContent = stampPending.label;
                autosave(); }
      exitStampMode();
      return;
    }
    // 2) Vincular evidencias con hilo rojo
    if (linkMode) {
      const evEl = e.target.closest('.ev'); if (!evEl) { setLinkSource(null); return; }
      const item = findItem(evEl.dataset.id); if (!item) return;
      if (!linkSource) { setLinkSource(item); return; }
      if (linkSource.id === item.id) { setLinkSource(null); return; }
      toggleLink(linkSource.id, item.id);
      setLinkSource(null);
    }
  }

  function setLinkSource(item) {
    $('ws-canvas').querySelectorAll('.ev.link-source').forEach((n) => n.classList.remove('link-source'));
    linkSource = item;
    if (item) {
      const el = $('ws-canvas').querySelector(`.ev[data-id="${item.id}"]`);
      if (el) el.classList.add('link-source');
    }
  }
  function toggleLink(from, to) {
    const pg = activePage(); pg.links = pg.links || [];
    const i = pg.links.findIndex((l) => (l.from === from && l.to === to) || (l.from === to && l.to === from));
    if (i > -1) { pg.links.splice(i, 1); toast('VÍNCULO ELIMINADO', 'ok'); }
    else { pg.links.push({ from, to }); toast('EVIDENCIAS VINCULADAS', 'ok'); }
    updateLinks(); autosave();
  }

  function setLinkMode(on) {
    linkMode = on; setLinkSource(null);
    $('ws-link').classList.toggle('is-active', on);
    document.querySelector('.ws-shell').classList.toggle('is-linking', on);
    if (on) { exitStampMode(); clearSelection(); $('ws-hint').textContent = 'HILO ROJO: clic en dos evidencias para conectarlas'; }
    else { $('ws-hint').textContent = defaultHint(); }
  }

  // ════════════════════════════════════════════════════════════════
  //  SELLO DE TINTA — caja de herramientas
  // ════════════════════════════════════════════════════════════════
  const inkbox = $('ws-inkbox');
  $('ws-ink-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    inkbox.hidden = !inkbox.hidden;
  });
  document.addEventListener('click', (e) => {
    if (!inkbox.hidden && !e.target.closest('.ws-inkwrap')) inkbox.hidden = true;
  });
  inkbox.querySelectorAll('.ws-ink-swatch').forEach((s) => s.addEventListener('click', () => {
    inkColor = s.dataset.ink;
    inkbox.querySelectorAll('.ws-ink-swatch').forEach((x) => x.classList.toggle('is-active', x === s));
  }));
  inkbox.querySelectorAll('[data-stamp]').forEach((b) => b.addEventListener('click', () => {
    enterStampMode(b.dataset.stamp, inkColor);
    inkbox.hidden = true;
  }));
  function enterStampMode(label, ink) {
    if (!CAN_ADD) return;
    setLinkMode(false);
    stampPending = { label, ink };
    document.querySelector('.ws-shell').classList.add('is-stamping');
    $('ws-hint').textContent = `SELLO "${label}" (${ink === 'red' ? 'ROJA' : 'NEGRA'}): clic para estampar`;
  }
  function exitStampMode() {
    stampPending = null;
    document.querySelector('.ws-shell').classList.remove('is-stamping');
    if (!linkMode) $('ws-hint').textContent = defaultHint();
  }

  // ════════════════════════════════════════════════════════════════
  //  FOTOGRAFÍA
  // ════════════════════════════════════════════════════════════════
  const photoModal = $('ws-photo-modal'), photoGrid = $('ws-photo-grid');
  let photoTarget = null;
  CFG.photos.forEach((p) => {
    const opt = document.createElement('div');
    opt.className = 'ws-photo-opt';
    opt.innerHTML = `<img src="${p.src}" alt=""><span>${esc(p.label)}</span>`;
    opt.addEventListener('click', () => {
      if (!photoTarget) return;
      photoTarget.item.img = p.key; paintPhoto(photoTarget.node, p.key);
      developPolaroid(photoTarget.el); closePhotoPicker(); autosave();
    });
    photoGrid.appendChild(opt);
  });
  function openPhotoPicker(item, node, el) { photoTarget = { item, node, el }; photoModal.hidden = false; }
  function closePhotoPicker() { photoModal.hidden = true; photoTarget = null; }
  $('ws-photo-close').addEventListener('click', closePhotoPicker);
  $('ws-upload').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file || !photoTarget) return;
    const reader = new FileReader();
    reader.onload = () => {
      photoTarget.item.img = reader.result; paintPhoto(photoTarget.node, reader.result);
      developPolaroid(photoTarget.el); $('ws-upload-warn').hidden = false;
      closePhotoPicker(); autosave();
    };
    reader.readAsDataURL(file);
  });

  // ════════════════════════════════════════════════════════════════
  //  SERIALIZACIÓN + AUTOSAVE (localStorage)
  // ════════════════════════════════════════════════════════════════
  function serialize() {
    return JSON.parse(JSON.stringify({ v: state.v, title: state.title, pages: state.pages, active: state.active }));
  }
  function autosave() {
    if (MODE === 'view') return;
    if (MODE === 'expand' && folioId) {
      putFolio(folioId, state.title, serialize());           // actualiza el folio en el almacén
    } else {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(serialize())); } catch (_) {}
    }
  }

  function hydrate(board, lockExisting) {
    if (!board || !Array.isArray(board.pages) || !board.pages.length) return false;
    state = { v: board.v || 1, title: board.title || CFG.title || 'EXPEDIENTE',
              pages: board.pages, active: Math.min(board.active || 0, board.pages.length - 1) };
    zCounter = 1;
    state.pages.forEach((pg) => {
      pg.links = pg.links || [];
      pg.items.forEach((it) => { if (it.z > zCounter) zCounter = it.z; if (lockExisting) lockedIds.add(it.id); });
    });
    render();
    return true;
  }

  // ════════════════════════════════════════════════════════════════
  //  GUARDAR EN EL ARCHIVERO
  // ════════════════════════════════════════════════════════════════
  const saveModal = $('ws-save-modal'), titleInput = $('ws-folio-title');
  function openSaveModal() {
    titleInput.value = state.title && state.title !== 'EXPEDIENTE' ? state.title : '';
    saveModal.hidden = false; titleInput.focus();
  }
  function closeSaveModal() { saveModal.hidden = true; }

  async function archiveFolio() {
    const title = titleInput.value.trim() || 'EXPEDIENTE SIN TÍTULO';
    state.title = title;
    try {
      // 1) Registro LIGERO en el servidor (solo id + título)
      const res = await fetch(CFG.saveUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF },
        body: JSON.stringify({ folio_id: folioId, title }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Error al archivar');
      folioId = data.folio_id;

      // 2) DATOS PESADOS al localStorage bajo ese folio
      if (!putFolio(folioId, title, serialize())) return;     // aborta si el almacén está lleno
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}

      closeSaveModal();
      toast('EXPEDIENTE ARCHIVADO — ' + folioId, 'ok');
      // Volvemos al archivero: el folio se reabre con la animación de carpeta.
      setTimeout(() => { window.location.href = CFG.archiveUrl || data.viewUrl; }, 900);
    } catch (err) { toast('FALLO AL ARCHIVAR: ' + err.message, 'error'); }
  }

  // ════════════════════════════════════════════════════════════════
  //  INTERCEPCIÓN DE SEÑAL (5 min)
  // ════════════════════════════════════════════════════════════════
  function armSignalIntercept() {
    if (!CAN_ADD) return;
    const signal = $('ws-signal');
    setTimeout(() => { signal.hidden = false;
      toast('⚡ INTERCEPCIÓN DE SEÑAL — nuevo documento disponible', 'ok'); }, 5 * 60 * 1000);
    signal.addEventListener('click', () => { addItem('cipher'); signal.hidden = true; });
  }

  // ════════════════════════════════════════════════════════════════
  //  TOAST
  // ════════════════════════════════════════════════════════════════
  let toastTimer;
  function toast(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = 'ws-status is-show' + (kind ? ' is-' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { statusEl.className = 'ws-status'; }, 3400);
  }

  // ════════════════════════════════════════════════════════════════
  //  MODO DE UI
  // ════════════════════════════════════════════════════════════════
  function defaultHint() {
    if (MODE === 'view') return 'Folio archivado — registro de solo lectura';
    if (MODE === 'expand') return 'Piezas originales bloqueadas • añade nueva evidencia';
    return 'Arrastra • Doble clic edita texto • Hilo rojo vincula • Sello estampa';
  }
  function applyMode() {
    const label = $('ws-title-label');
    if (MODE === 'view') {
      label.textContent = (CFG.title || 'EXPEDIENTE') + ' — SOLO LECTURA';
      document.querySelectorAll('[data-tools]').forEach((n) => (n.hidden = true));
      $('ws-save').hidden = true;
      const cta = $('ws-expand-cta'); cta.hidden = false; cta.href = CFG.expandUrl;
    } else if (MODE === 'expand') {
      label.textContent = (CFG.title || 'EXPEDIENTE') + ' — AMPLIANDO';
      $('ws-save-label').textContent = 'ACTUALIZAR EXPEDIENTE';
    } else {
      label.textContent = 'MESA DE TRABAJO';
    }
    $('ws-hint').textContent = defaultHint();
  }

  // ════════════════════════════════════════════════════════════════
  //  EVENTOS GLOBALES
  // ════════════════════════════════════════════════════════════════
  document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addItem(b.dataset.add)));
  $('ws-add-page').addEventListener('click', () => {
    if (!CAN_ADD) return;
    state.pages.push(newPage()); state.active = state.pages.length - 1;
    render(); autosave(); toast('PÁGINA AGREGADA', 'ok');
  });
  $('ws-link').addEventListener('click', () => setLinkMode(!linkMode));
  $('ws-save').addEventListener('click', openSaveModal);
  $('ws-save-cancel').addEventListener('click', closeSaveModal);
  $('ws-save-confirm').addEventListener('click', archiveFolio);
  titleInput && titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') archiveFolio(); });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSaveModal(); closePhotoPicker(); clearSelection(); setLinkMode(false); exitStampMode(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !e.target.isContentEditable) {
      e.preventDefault(); deleteItem(selected.item, selected.el);
    }
  });

  // ════════════════════════════════════════════════════════════════
  //  UTILIDADES
  // ════════════════════════════════════════════════════════════════
  function rand(min, max) { return Math.round(min + Math.random() * (max - min)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ════════════════════════════════════════════════════════════════
  //  ARRANQUE
  // ════════════════════════════════════════════════════════════════
  function boot() {
    applyMode();
    if (MODE === 'view' || MODE === 'expand') {
      const rec = readArchive()[folioId];
      const ok = rec && hydrate(rec.board, MODE === 'expand');
      if (!ok) {
        state.pages = [newPage('PÁGINA 1')]; render();
        toast('⚠ EVIDENCIA NO ENCONTRADA EN ESTE DISPOSITIVO', 'error');
      }
    } else {
      let restored = false;
      try { const d = localStorage.getItem(DRAFT_KEY); if (d) restored = hydrate(JSON.parse(d), false); } catch (_) {}
      if (!restored) { state.pages = [newPage('PÁGINA 1')]; render(); }
    }
    armSignalIntercept();
  }
  boot();
})();
