/* ══════════════════════════════════════════════════════════════════
   AXIOM — SECUENCIA 3D JUGABLE (Three.js / WebGL)
   Máquina de estados:  'caminando' → 'transicion' → 'escritorio'
   · FASE 1: pasillo noir industrial, luces parpadeantes, personaje de gabán
     y fedora controlado con A/D o flechas (avance pesado).
   · FASE 2: al cruzar la puerta "ARCHIVO", la cámara desciende interpolada a
     una vista cenital sobre el escritorio; se enciende la SpotLight y aparece
     el expediente cerrado (MINISTRY OF DEFENCE / RESTRICTED).
   · FASE 3: controles de teclado off; prompt parpadeante; el clic abre el
     expediente y entra al núcleo (inspección/arrastre 3D + localStorage).
   No toca el backend ni la UI 2D.
══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

(() => {
  const canvas = document.getElementById('desk-canvas');
  const fallback = document.getElementById('desk-fallback');
  if (!canvas) return;
  const fail = (e) => { console.error('[AXIOM 3D]', e); if (fallback) fallback.style.display = 'flex'; };

  try {
  const MU = THREE.MathUtils;
  const promptEl = document.getElementById('desk-prompt');
  const helpEl = document.getElementById('hud-help');
  const setHelp = (t) => { if (helpEl) helpEl.innerHTML = t; };

  // ── Datos del agente ──────────────────────────────────────────────
  const AGENT = window.AXIOM_AGENT_ID || 'GUEST';
  const ARCHIVE_KEY = 'axiom_archive_1920_' + AGENT;
  const authorized = JSON.parse(document.getElementById('desk-folios').textContent || '[]');
  let archive = {};
  try { archive = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '{}'); } catch (_) {}

  // ── Renderer / escena ─────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  window.__axiomDeskOK = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040405);
  scene.fog = new THREE.Fog(0x040405, 14, 50);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  const DESK_CAM = new THREE.Vector3(0, 8, 9);   // vista cenital final
  const lookTarget = new THREE.Vector3(0, 1.4, 16);
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  scene.add(new THREE.AmbientLight(0x2a2a33, 0.4));

  // ════════════════════════════════════════════════════════════════
  //  ESCRITORIO (sala al final del pasillo, en el origen)
  // ════════════════════════════════════════════════════════════════
  const spot = new THREE.SpotLight(0xffe8c0, 0.0, 0, Math.PI / 6.2, 0.65, 0); // empieza apagada
  spot.position.set(0, 13, 3.5); spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048); spot.shadow.camera.near = 1; spot.shadow.camera.far = 40;
  spot.shadow.bias = -0.0004;
  scene.add(spot); scene.add(spot.target);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
  bulb.position.set(0, 12.6, 3.5); scene.add(bulb);

  function woodTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#5e3f23'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 150; i++) {
      x.strokeStyle = `rgba(${30 + Math.random() * 40},${20 + Math.random() * 25},${8 + Math.random() * 14},${0.12 + Math.random() * 0.2})`;
      x.lineWidth = 1 + Math.random() * 2; const y = Math.random() * 512;
      x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(170, y + (Math.random() * 18 - 9), 340, y + (Math.random() * 18 - 9), 512, y); x.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.5); return t;
  }
  const desk = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 8),
    new THREE.MeshStandardMaterial({ map: woodTexture(), color: 0x7a5230, roughness: 0.82, metalness: 0.06 }));
  desk.position.y = -0.5; desk.receiveShadow = true; scene.add(desk);
  const DESK_TOP = 0;
  // suelo de la sala (oscuro, recibe sombra)
  const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30),
    new THREE.MeshStandardMaterial({ color: 0x14140f, roughness: 1 }));
  roomFloor.rotation.x = -Math.PI / 2; roomFloor.position.set(0, -1.0, 0); roomFloor.receiveShadow = true; scene.add(roomFloor);

  // ── Etiqueta del expediente (canvas → textura) ────────────────────
  function wrap(ctx, text, x, y, max, lh) {
    const words = String(text).split(' '); let line = '', yy = y;
    for (const w of words) {
      if (ctx.measureText(line + w).width > max && line) { ctx.fillText(line, x, yy); line = w + ' '; yy += lh; }
      else line += w + ' ';
    }
    ctx.fillText(line, x, yy);
  }
  function labelTexture(folio) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 360; const x = c.getContext('2d');
    x.fillStyle = '#c9b27c'; x.fillRect(0, 0, 512, 360);
    x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 8; x.strokeRect(10, 10, 492, 340);
    x.fillStyle = '#2a1c0c'; x.font = 'bold 38px "Courier New", monospace'; x.fillText('MINISTRY OF DEFENCE', 28, 70);
    x.fillStyle = '#8a1414'; x.font = 'bold 30px "Courier New", monospace'; x.fillText('RESTRICTED', 28, 118);
    x.strokeStyle = '#a01818'; x.lineWidth = 4; x.strokeRect(28, 150, 280, 60);
    x.fillStyle = '#a01818'; x.font = 'bold 36px "Courier New", monospace'; x.fillText(folio.id || 'EXPED', 42, 194);
    x.fillStyle = '#2a2418'; x.font = '24px "Courier New", monospace';
    wrap(x, (folio.title || 'EXPEDIENTE').toUpperCase(), 28, 262, 456, 30);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ── Sobres manila ─────────────────────────────────────────────────
  const MANILA = 0xccb27a;
  const envelopes = [], pickables = [];
  function makeEnvelope(folio, i, n) {
    const g = new THREE.Group();
    const W = 3.0, H = 0.14, D = 4.0;
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, H, D),
      new THREE.MeshStandardMaterial({ color: MANILA, roughness: 0.93, metalness: 0.02 }));
    base.castShadow = true; base.receiveShadow = true; g.add(base);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.95, D * 0.95),
      new THREE.MeshStandardMaterial({ map: labelTexture(folio), roughness: 0.96 }));
    label.rotation.x = -Math.PI / 2; label.position.y = H / 2 + 0.003; g.add(label);
    const flapPivot = new THREE.Group(); flapPivot.position.set(0, H / 2, -D / 2); g.add(flapPivot);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, D * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xbfa66f, roughness: 0.9 }));
    flap.position.set(0, 0, D * 0.5 / 2); flap.castShadow = true; flapPivot.add(flap);
    const restY = DESK_TOP + H / 2;
    g.position.set(n <= 1 ? 0 : (i - (n - 1) / 2) * 3.6, restY, (i % 2 ? 0.5 : -0.5));
    g.rotation.y = MU.randFloat(-0.09, 0.09);
    g.visible = false; g.scale.setScalar(0.6);
    g.userData = { folio, flapPivot, open: false, openT: 0, vel: new THREE.Vector3(), settling: false, restY, home: null, popT: 0 };
    [base, label, flap].forEach((m) => { m.userData.env = g; pickables.push(m); });
    envelopes.push(g); scene.add(g);
  }
  let list = authorized.length ? authorized : Object.values(archive).map((f) => ({ id: f.id, title: f.title }));
  if (!list.length) list = [{ id: 'EXPED-0000', title: 'ARCHIVO VACÍO' }];   // la intro siempre culmina en un sobre
  list.forEach((f, i) => makeEnvelope(Object.assign({}, f, archive[f.id] || {}), i, list.length));

  // ════════════════════════════════════════════════════════════════
  //  PASILLO NOIR (FASE 1)
  // ════════════════════════════════════════════════════════════════
  const corridor = new THREE.Group(); scene.add(corridor);
  const HALL_X = 3, HALL_H = 4, HALL_Z0 = 7, HALL_Z1 = 46;   // de la puerta (z=7) al fondo (z=46)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x23211b, roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x16140f, roughness: 1 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 1 });
  const hallLen = HALL_Z1 - HALL_Z0, hallMidZ = (HALL_Z0 + HALL_Z1) / 2;

  const hFloor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_X * 2, hallLen), floorMat);
  hFloor.rotation.x = -Math.PI / 2; hFloor.position.set(0, 0, hallMidZ); hFloor.receiveShadow = true; corridor.add(hFloor);
  const hCeil = new THREE.Mesh(new THREE.PlaneGeometry(HALL_X * 2, hallLen), ceilMat);
  hCeil.rotation.x = Math.PI / 2; hCeil.position.set(0, HALL_H, hallMidZ); corridor.add(hCeil);
  [-HALL_X, HALL_X].forEach((sx) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(hallLen, HALL_H), wallMat);
    w.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    w.position.set(sx, HALL_H / 2, hallMidZ); w.receiveShadow = true; corridor.add(w);
  });

  // Puertas con número de oficina (texturas de canvas)
  function doorSign(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, 256, 64);
    x.fillStyle = '#caa23a'; x.font = 'bold 26px "Courier New", monospace'; x.textAlign = 'center';
    x.fillText(text, 128, 42);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const OFFICES = ['OFICINA 101', 'LAB. DE DATOS', 'OFICINA 103', 'ARCHIVO C-4', 'OFICINA 107', 'SALA DE RELÉS', 'OFICINA 111', 'DESVÍO 12'];
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2c241a, roughness: 0.8, metalness: 0.2 });
  for (let k = 0; k < OFFICES.length; k++) {
    const z = HALL_Z0 + 4 + k * 4.6; if (z > HALL_Z1 - 2) break;
    const sx = (k % 2 === 0) ? -HALL_X + 0.06 : HALL_X - 0.06;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 1.5), doorMat);
    door.position.set(sx, 1.3, z); door.castShadow = true; corridor.add(door);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.34),
      new THREE.MeshStandardMaterial({ map: doorSign(OFFICES[k]), emissive: 0x1a1405, emissiveIntensity: 0.6, roughness: 1 }));
    sign.position.set(sx + (sx < 0 ? 0.07 : -0.07), 2.5, z);
    sign.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2; corridor.add(sign);
  }

  // Puerta final "ARCHIVO / INVESTIGACIÓN" (abierta, marco iluminado en z=HALL_Z0)
  const archSign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5),
    new THREE.MeshStandardMaterial({ map: doorSign('ARCHIVO / INVESTIGACIÓN'), emissive: 0x2a2008, emissiveIntensity: 1.0, roughness: 1 }));
  archSign.position.set(0, HALL_H - 0.4, HALL_Z0 + 0.1); corridor.add(archSign);

  // Luces de techo (PointLight) — una titila al azar
  const hallLights = [];
  for (let z = HALL_Z0 + 3; z < HALL_Z1; z += 6) {
    const pl = new THREE.PointLight(0xffe0a0, 1.2, 12, 2);
    pl.position.set(0, HALL_H - 0.2, z);
    pl.userData = { base: 1.2, flick: 0, phase: Math.random() * 10 };
    corridor.add(pl); hallLights.push(pl);
    const fix = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.25), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    fix.position.copy(pl.position); fix.position.y = HALL_H - 0.06; corridor.add(fix);
  }

  // ════════════════════════════════════════════════════════════════
  //  PERSONAJE (silueta: gabán + fedora, todo negro)
  // ════════════════════════════════════════════════════════════════
  const hero = new THREE.Group();
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.7, metalness: 0.05 });
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.6, 1.5, 14), blackMat);
  coat.position.y = 0.75; coat.castShadow = true; hero.add(coat);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.5, 12), blackMat);
  torso.position.y = 1.55; torso.castShadow = true; hero.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), blackMat);
  head.position.y = 1.92; head.castShadow = true; hero.add(head);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 18), blackMat);
  brim.position.y = 2.02; brim.castShadow = true; hero.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.32, 16), blackMat);
  crown.position.y = 2.2; crown.castShadow = true; hero.add(crown);
  hero.position.set(0, 0, HALL_Z1 - 3);   // arranca al fondo del pasillo
  hero.rotation.y = Math.PI;               // mira hacia -Z (hacia la puerta del archivo)
  scene.add(hero);
  // Cámara inicial detrás del héroe (evita el ease desde el origen)
  camera.position.set(0, 2.6, hero.position.z + 5.5);
  camera.lookAt(0, 1.3, hero.position.z - 8);

  // ════════════════════════════════════════════════════════════════
  //  AUDIO (ambiente + pasos + paneo + zumbidos)
  // ════════════════════════════════════════════════════════════════
  let actx = null, master = null, lampHum = null;
  function audioResume() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
      // aire acondicionado: ruido grave en bucle
      const sr = actx.sampleRate, n = sr * 2, buf = actx.createBuffer(1, n, sr), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1);
      const air = actx.createBufferSource(); air.buffer = buf; air.loop = true;
      const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      const ag = actx.createGain(); ag.gain.value = 0.04;
      air.connect(lp); lp.connect(ag); ag.connect(master); air.start();
      // zumbido de lámpara (off hasta el escritorio)
      const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58;
      const lf = actx.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 130;
      lampHum = actx.createGain(); lampHum.gain.value = 0.0;
      o.connect(lf); lf.connect(lampHum); lampHum.connect(master); o.start();
    } catch (_) {}
  }
  function blip(kind, panX) {
    if (!actx) return;
    try {
      const dur = kind === 'thud' ? 0.2 : kind === 'step' ? 0.16 : kind === 'drag' ? 0.12 : 0.08;
      const sr = actx.sampleRate, len = Math.floor(sr * dur), b = actx.createBuffer(1, len, sr), d = b.getChannelData(0);
      const decay = kind === 'thud' ? 4 : kind === 'step' ? 5 : kind === 'drag' ? 2 : 9;
      for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay); }
      const src = actx.createBufferSource(); src.buffer = b;
      const bp = actx.createBiquadFilter();
      bp.type = (kind === 'thud' || kind === 'step') ? 'lowpass' : 'bandpass';
      bp.frequency.value = kind === 'thud' ? 220 : kind === 'step' ? 320 : kind === 'clip' ? 3400 : 950;
      const pan = actx.createStereoPanner(); pan.pan.value = MU.clamp(panX || 0, -1, 1);
      const g = actx.createGain(); g.gain.value = kind === 'step' ? 0.35 : kind === 'thud' ? 0.6 : 0.4;
      src.connect(bp); bp.connect(pan); pan.connect(g); g.connect(master); src.start();
    } catch (_) {}
  }
  const screenX = (obj) => { const v = obj.position.clone().project(camera); return MU.clamp(v.x, -1, 1); };

  // ════════════════════════════════════════════════════════════════
  //  ENTRADA
  // ════════════════════════════════════════════════════════════════
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'Escape') exitInspect();
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    audioResume();
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  const FWD = ['a', 'A', 'd', 'D', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'w', 'W'];
  const wantsForward = () => FWD.some((k) => keys[k]);

  // ── Mouse (solo activo en 'escritorio') ──
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(DESK_TOP + 0.06)), tmp = new THREE.Vector3();
  const INSPECT_POS = new THREE.Vector3(0, 3.4, 5.4);
  let hovered = null, dragging = null, inspecting = null, rotating = false;
  let moved = false, downXY = null, lastXY = null, lastT = 0, clickTimer = null, firstClickDone = false;
  const dragOffset = new THREE.Vector3();
  const setPointer = (e) => { pointer.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.y = -(e.clientY / window.innerHeight) * 2 + 1; };
  function pick() { raycaster.setFromCamera(pointer, camera); const h = raycaster.intersectObjects(pickables, false); return h.length ? h[0].object.userData.env : null; }
  function setHover(env) {
    if (hovered === env) return;
    if (hovered) hovered.children[0].material.emissive.setHex(0x000000);
    hovered = env; if (hovered) hovered.children[0].material.emissive.setHex(0x332a10);
    canvas.style.cursor = env ? 'grab' : 'default';
  }
  function toggleOpen(env) { env.userData.open = !env.userData.open; blip('clip', screenX(env)); if (!firstClickDone) { firstClickDone = true; promptEl.classList.remove('is-on'); blip('thud', screenX(env)); } }
  function enterInspect(env) { inspecting = env; env.userData.home = { p: env.position.clone(), q: env.quaternion.clone() }; env.userData.open = true; blip('drag', screenX(env)); }
  function exitInspect() { if (!inspecting) return; const env = inspecting; inspecting = null; rotating = false; env.userData.returning = true; }

  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'escritorio') return;
    setPointer(e); audioResume(); moved = false; downXY = { x: e.clientX, y: e.clientY }; lastXY = { x: e.clientX, y: e.clientY }; lastT = performance.now();
    if (inspecting) { rotating = true; return; }
    const env = pick();
    if (env) {
      dragging = env; dragging.userData.settling = false; dragging.userData.vel.set(0, 0, 0);
      raycaster.setFromCamera(pointer, camera); if (raycaster.ray.intersectPlane(dragPlane, tmp)) dragOffset.copy(env.position).sub(tmp);
      canvas.style.cursor = 'grabbing'; try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (state !== 'escritorio') return;
    setPointer(e);
    if (downXY && Math.hypot(e.clientX - downXY.x, e.clientY - downXY.y) > 5) moved = true;
    if (inspecting && rotating) { inspecting.rotateY((e.clientX - lastXY.x) * 0.01); inspecting.rotateX((e.clientY - lastXY.y) * 0.01); lastXY = { x: e.clientX, y: e.clientY }; return; }
    if (dragging) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(dragPlane, tmp)) {
        const np = tmp.add(dragOffset); np.y = dragging.userData.restY + 0.6;
        const now = performance.now(), dt = Math.max(16, now - lastT) / 1000;
        dragging.userData.vel.copy(np).sub(dragging.position).multiplyScalar(1 / dt);
        dragging.position.copy(np); lastT = now;
        dragging.rotation.z = MU.clamp(-dragging.userData.vel.x * 0.03, -0.3, 0.3);
        dragging.rotation.x = MU.clamp(dragging.userData.vel.z * 0.03, -0.3, 0.3);
      }
    } else if (!inspecting) setHover(pick());
  });
  canvas.addEventListener('pointerup', (e) => {
    if (dragging) { const env = dragging; dragging = null; env.userData.settling = true; blip('drag', screenX(env)); try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} canvas.style.cursor = 'grab'; }
    if (inspecting) rotating = false;
  });
  canvas.addEventListener('click', (e) => {
    if (state !== 'escritorio' || moved || inspecting) return;
    setPointer(e); const env = pick(); if (!env) return;
    clearTimeout(clickTimer); clickTimer = setTimeout(() => toggleOpen(env), 240);
  });
  canvas.addEventListener('dblclick', (e) => {
    if (state !== 'escritorio') return;
    clearTimeout(clickTimer); if (inspecting) return;
    setPointer(e); const env = pick(); if (env) enterInspect(env);
  });

  // ════════════════════════════════════════════════════════════════
  //  MÁQUINA DE ESTADOS + BUCLE
  // ════════════════════════════════════════════════════════════════
  let state = 'caminando';
  setHelp('<b>← →</b> / <b>A D</b> avanzar por el pasillo');
  let walkPhase = 0, stepCooldown = 0;
  let transT = 0; const TRANS_DUR = 2.8;
  let camFrom = new THREE.Vector3(), lookFrom = new THREE.Vector3();
  const clock = new THREE.Clock();

  function startTransition() {
    state = 'transicion'; transT = 0;
    camFrom.copy(camera.position); lookFrom.copy(lookTarget);
    setHelp('···');
    envelopes.forEach((g) => { g.visible = true; });
  }
  function enterDesk() {
    state = 'escritorio';
    setHelp('<b>CLIC</b> abrir · <b>ARRASTRAR</b> mover · <b>DOBLE CLIC</b> rotar · <b>ESC</b> soltar');
    promptEl.classList.add('is-on');
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());

    // luces del pasillo: titileo aleatorio (solo durante la caminata)
    if (state === 'caminando') {
      for (const pl of hallLights) {
        pl.userData.phase += dt;
        const f = (Math.sin(pl.userData.phase * 2.3) > 0.93 || Math.random() > 0.992) ? MU.randFloat(0.2, 0.7) : 1;
        pl.intensity += (pl.userData.base * f - pl.intensity) * 0.4;
      }
    }

    if (state === 'caminando') {
      const moving = wantsForward();
      if (moving && hero.position.z > HALL_Z0 + 0.5) {
        hero.position.z -= 2.2 * dt;            // avance pesado y pausado
        walkPhase += dt * 6;
        hero.position.y = Math.abs(Math.sin(walkPhase)) * 0.06;   // bamboleo
        hero.rotation.z = Math.sin(walkPhase) * 0.03;
        stepCooldown -= dt;
        if (stepCooldown <= 0) { blip('step', 0); stepCooldown = 0.42; }
      } else { hero.position.y += (0 - hero.position.y) * 0.2; }

      // cámara en tercera persona detrás del héroe
      tmp.set(hero.position.x, 2.6, hero.position.z + 5.5);
      camera.position.lerp(tmp, 0.12);
      lookTarget.set(hero.position.x, 1.3, hero.position.z - 8);
      camera.lookAt(lookTarget);

      if (hero.position.z <= HALL_Z0 + 0.6) startTransition();

    } else if (state === 'transicion') {
      transT += dt;
      const k = MU.smoothstep(transT / TRANS_DUR, 0, 1);
      camera.position.lerpVectors(camFrom, DESK_CAM, k);
      lookTarget.lerpVectors(lookFrom, new THREE.Vector3(0, 0, 0), k);
      camera.lookAt(lookTarget);
      spot.intensity = 3.4 * k;                       // se enciende la luz cenital
      if (lampHum) lampHum.gain.value = 0.05 * k;
      corridor.traverse((o) => { if (o.isPointLight) o.intensity *= (1 - 0.6 * dt); });
      hero.position.z -= 1.0 * dt;                     // sigue entrando y se pierde en sombra
      envelopes.forEach((g) => { g.userData.popT = Math.min(1, g.userData.popT + dt * 1.6); g.scale.setScalar(0.6 + 0.4 * g.userData.popT); });
      if (transT >= TRANS_DUR) { camera.position.copy(DESK_CAM); envelopes.forEach((g) => g.scale.setScalar(1)); enterDesk(); }

    } else { // escritorio
      // parallax sutil
      camera.lookAt(0, 0, 0);
      for (const env of envelopes) {
        const u = env.userData;
        u.openT += ((u.open ? 1 : 0) - u.openT) * Math.min(1, dt * 4);
        u.flapPivot.rotation.x = -2.35 * u.openT;
        if (u === inspecting) env.position.lerp(INSPECT_POS, 0.12);
        else if (u.returning && u.home) {
          env.position.lerp(u.home.p, 0.14); env.quaternion.slerp(u.home.q, 0.14);
          if (env.position.distanceTo(u.home.p) < 0.02) { env.position.copy(u.home.p); env.quaternion.copy(u.home.q); u.returning = false; }
        } else if (u.settling) {
          env.position.addScaledVector(u.vel, dt); u.vel.multiplyScalar(0.86);
          env.position.x = MU.clamp(env.position.x, -5, 5); env.position.z = MU.clamp(env.position.z, -3.4, 3.4);
          env.position.y += (u.restY - env.position.y) * 0.2;
          env.rotation.z += (0 - env.rotation.z) * 0.18; env.rotation.x += (0 - env.rotation.x) * 0.18;
          if (u.vel.length() < 0.05 && Math.abs(env.position.y - u.restY) < 0.01) { u.settling = false; u.vel.set(0, 0, 0); env.position.y = u.restY; blip('thud', screenX(env)); }
        } else if (u !== dragging) env.position.y += (u.restY - env.position.y) * 0.2;
      }
    }
    renderer.render(scene, camera);
  }
  animate();

  } catch (e) { fail(e); }
})();
