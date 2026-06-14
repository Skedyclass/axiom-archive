/* ══════════════════════════════════════════════════════════════════
   ASPERTER VS REAL LIFE — secuencia 3D cinematográfica (Three.js/WebGL)
   Estados: 'menu' → 'dolly' → 'caminando' → 'ascensor' → 'transicion' → 'escritorio'
   Sin assets externos: geometría procedural, bump map de lana en canvas,
   animación por código (no AnimationMixer) y audio sintetizado.
   No toca el backend ni la UI 2D.
══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

(() => {
  const canvas = document.getElementById('desk-canvas');
  const fallback = document.getElementById('desk-fallback');
  if (!canvas) return;
  const fail = (e) => { console.error('[ASPERTER 3D]', e); if (fallback) fallback.style.display = 'flex'; };

  try {
  const MU = THREE.MathUtils;
  const promptEl = document.getElementById('desk-prompt');
  const helpEl = document.getElementById('hud-help');
  const menuEl = document.getElementById('menu');
  const playBtn = document.getElementById('menu-play');
  const setHelp = (t) => { if (helpEl) helpEl.innerHTML = t; };

  const AGENT = window.AXIOM_AGENT_ID || 'GUEST';
  const ARCHIVE_KEY = 'axiom_archive_1920_' + AGENT;
  const authorized = JSON.parse(document.getElementById('desk-folios').textContent || '[]');
  let archive = {};
  try { archive = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '{}'); } catch (_) {}

  // ── Renderer / escena / cámara ────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  window.__axiomDeskOK = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040405);
  scene.fog = new THREE.Fog(0x040405, 14, 52);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  const DESK_CAM = new THREE.Vector3(0, 8, 9);
  const MENU_CAM = new THREE.Vector3(2.6, 1.25, 4.3);
  const MENU_LOOK = new THREE.Vector3(0, 0.5, 0);
  const lookTarget = new THREE.Vector3().copy(MENU_LOOK);
  camera.position.copy(MENU_CAM); camera.lookAt(lookTarget);
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  scene.add(new THREE.AmbientLight(0x26262e, 0.4));

  // ── Texturas procedurales ─────────────────────────────────────────
  function woodTexture(rep) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.fillStyle = '#4a3115'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 160; i++) {
      x.strokeStyle = `rgba(${28 + Math.random() * 38},${18 + Math.random() * 22},${8 + Math.random() * 12},${0.12 + Math.random() * 0.22})`;
      x.lineWidth = 1 + Math.random() * 2; const y = Math.random() * 512;
      x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(170, y + (Math.random() * 18 - 9), 340, y + (Math.random() * 18 - 9), 512, y); x.stroke();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep || 2, rep || 1.5); return t;
  }
  function noiseBump() {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const img = x.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + Math.random() * 140; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); return t;
  }
  function radialSprite() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); return t;
  }

  // ── ESCRITORIO (sala final, en el origen) ─────────────────────────
  const spot = new THREE.SpotLight(0xffe8c0, 0.0, 0, Math.PI / 6.2, 0.65, 0);
  spot.position.set(0, 13, 3.5); spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048); spot.shadow.camera.near = 1; spot.shadow.camera.far = 40; spot.shadow.bias = -0.0004;
  scene.add(spot); scene.add(spot.target);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
  bulb.position.set(0, 12.6, 3.5); scene.add(bulb);

  const desk = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 8),
    new THREE.MeshStandardMaterial({ map: woodTexture(2), color: 0x6a4527, roughness: 0.8, metalness: 0.08 }));
  desk.position.y = -0.5; desk.receiveShadow = true; scene.add(desk);
  const DESK_TOP = 0;
  const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(44, 34),
    new THREE.MeshStandardMaterial({ color: 0x121009, roughness: 1 }));
  roomFloor.rotation.x = -Math.PI / 2; roomFloor.position.y = -1.0; roomFloor.receiveShadow = true; scene.add(roomFloor);

  // ── PROPS DEL MENÚ (lámpara lateral, teléfono baquelita, cenicero, humo) ──
  const menuProps = new THREE.Group(); scene.add(menuProps);
  // lámpara de escritorio (luz lateral cálida que parpadea)
  const lampSpot = new THREE.SpotLight(0xffd28a, 4.5, 14, Math.PI / 5, 0.5, 1.4);
  lampSpot.position.set(-2.6, 2.2, 1.4); lampSpot.castShadow = true; lampSpot.shadow.mapSize.set(1024, 1024);
  menuProps.add(lampSpot); menuProps.add(lampSpot.target); lampSpot.target.position.set(0.3, 0, 0);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.6 });
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.12, 16), lampMat); lampBase.position.set(-2.8, 0.06, 1.4); lampBase.castShadow = true; menuProps.add(lampBase);
  const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 8), lampMat); lampArm.position.set(-2.8, 0.9, 1.4); lampArm.rotation.z = 0.5; lampArm.castShadow = true; menuProps.add(lampArm);
  const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.45, 16, 1, true), lampMat); lampHead.position.set(-2.4, 1.7, 1.4); lampHead.rotation.z = -0.9; lampHead.castShadow = true; menuProps.add(lampHead);
  // teléfono de baquelita
  const baq = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.25, metalness: 0.4 });
  const phone = new THREE.Group();
  const phBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.7), baq); phBody.position.y = 0.15; phBody.castShadow = true; phone.add(phBody);
  const phHandle = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.16), baq); phHandle.position.y = 0.37; phHandle.castShadow = true; phone.add(phHandle);
  const phDial = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 18), baq); phDial.rotation.x = Math.PI / 2; phDial.position.set(0, 0.31, 0.18); phone.add(phDial);
  phone.position.set(1.4, DESK_TOP, 0.2); phone.rotation.y = -0.4; menuProps.add(phone);
  // cenicero + cigarrillo + humo
  const ashtray = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 10, 24),
    new THREE.MeshStandardMaterial({ color: 0x20201e, roughness: 0.4, metalness: 0.3 }));
  ashtray.rotation.x = Math.PI / 2; ashtray.position.set(-0.6, DESK_TOP + 0.05, 0.5); ashtray.castShadow = true; menuProps.add(ashtray);
  const cig = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xe8e0d0 }));
  cig.rotation.z = Math.PI / 2; cig.position.set(-0.45, DESK_TOP + 0.07, 0.5); menuProps.add(cig);
  const cigTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff5a1a })); cigTip.position.set(-0.2, DESK_TOP + 0.07, 0.5); menuProps.add(cigTip);
  const smokeOrigin = new THREE.Vector3(-0.2, DESK_TOP + 0.1, 0.5);
  const SMOKE_N = 46;
  const smokeGeo = new THREE.BufferGeometry();
  const smokePos = new Float32Array(SMOKE_N * 3);
  for (let i = 0; i < SMOKE_N; i++) { smokePos[i * 3] = smokeOrigin.x + (Math.random() * 0.1 - 0.05); smokePos[i * 3 + 1] = smokeOrigin.y + Math.random() * 1.6; smokePos[i * 3 + 2] = smokeOrigin.z + (Math.random() * 0.1 - 0.05); }
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({ map: radialSprite(), size: 0.5, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x9aa0a6 }));
  menuProps.add(smoke);

  // ── ETIQUETA + SOBRES ─────────────────────────────────────────────
  function wrap(ctx, text, x, y, max, lh) {
    const words = String(text).split(' '); let line = '', yy = y;
    for (const w of words) { if (ctx.measureText(line + w).width > max && line) { ctx.fillText(line, x, yy); line = w + ' '; yy += lh; } else line += w + ' '; }
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
    x.fillStyle = '#2a2418'; x.font = '24px "Courier New", monospace'; wrap(x, (folio.title || 'EXPEDIENTE').toUpperCase(), 28, 262, 456, 30);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const MANILA = 0xccb27a;
  const envelopes = [], pickables = [];
  function makeEnvelope(folio, i, n) {
    const g = new THREE.Group();
    const W = 3.0, H = 0.14, D = 4.0;
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshStandardMaterial({ color: MANILA, roughness: 0.93, metalness: 0.02 }));
    base.castShadow = true; base.receiveShadow = true; g.add(base);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.95, D * 0.95), new THREE.MeshStandardMaterial({ map: labelTexture(folio), roughness: 0.96 }));
    label.rotation.x = -Math.PI / 2; label.position.y = H / 2 + 0.003; g.add(label);
    const flapPivot = new THREE.Group(); flapPivot.position.set(0, H / 2, -D / 2); g.add(flapPivot);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, D * 0.5), new THREE.MeshStandardMaterial({ color: 0xbfa66f, roughness: 0.9 }));
    flap.position.set(0, 0, D * 0.5 / 2); flap.castShadow = true; flapPivot.add(flap);
    const restY = DESK_TOP + H / 2;
    g.position.set(n <= 1 ? 0 : (i - (n - 1) / 2) * 3.6, restY, (i % 2 ? 0.5 : -0.5));
    g.rotation.y = MU.randFloat(-0.09, 0.09); g.visible = false; g.scale.setScalar(0.6);
    g.userData = { folio, flapPivot, open: false, openT: 0, vel: new THREE.Vector3(), settling: false, restY, home: null, popT: 0 };
    [base, label, flap].forEach((m) => { m.userData.env = g; pickables.push(m); });
    envelopes.push(g); scene.add(g);
  }
  let list = authorized.length ? authorized : Object.values(archive).map((f) => ({ id: f.id, title: f.title }));
  if (!list.length) list = [{ id: 'EXPED-0000', title: 'ARCHIVO VACÍO' }];
  list.forEach((f, i) => makeEnvelope(Object.assign({}, f, archive[f.id] || {}), i, list.length));

  // ── PASILLO ───────────────────────────────────────────────────────
  const corridor = new THREE.Group(); scene.add(corridor);
  const HALL_X = 3, HALL_H = 4, HALL_Z0 = 7, HALL_Z1 = 46;
  const wallMat = new THREE.MeshStandardMaterial({ map: woodTexture(4), color: 0x3a2c1c, roughness: 0.95 });
  const hallLen = HALL_Z1 - HALL_Z0, hallMidZ = (HALL_Z0 + HALL_Z1) / 2;
  const hFloor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_X * 2, hallLen), new THREE.MeshStandardMaterial({ color: 0x16140f, roughness: 1 }));
  hFloor.rotation.x = -Math.PI / 2; hFloor.position.set(0, 0, hallMidZ); hFloor.receiveShadow = true; corridor.add(hFloor);
  const hCeil = new THREE.Mesh(new THREE.PlaneGeometry(HALL_X * 2, hallLen), new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: 1 }));
  hCeil.rotation.x = Math.PI / 2; hCeil.position.set(0, HALL_H, hallMidZ); corridor.add(hCeil);
  [-HALL_X, HALL_X].forEach((sx) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(hallLen, HALL_H), wallMat);
    w.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2; w.position.set(sx, HALL_H / 2, hallMidZ); w.receiveShadow = true; corridor.add(w);
  });
  function doorSign(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#0a0a0a'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#caa23a';
    x.font = 'bold 24px "Courier New", monospace'; x.textAlign = 'center'; x.fillText(text, 128, 41);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const OFFICES = ['OFICINA 101', 'LAB. DE DATOS', 'OFICINA 103', 'ARCHIVO C-4', 'OFICINA 107', 'SALA DE RELÉS', 'OFICINA 111', 'DESVÍO 12'];
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2c241a, roughness: 0.8, metalness: 0.2 });
  for (let k = 0; k < OFFICES.length; k++) {
    const z = HALL_Z0 + 5 + k * 4.6; if (z > HALL_Z1 - 2) break;
    const sx = (k % 2 === 0) ? -HALL_X + 0.06 : HALL_X - 0.06;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 1.5), doorMat); door.position.set(sx, 1.3, z); door.castShadow = true; corridor.add(door);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.32), new THREE.MeshStandardMaterial({ map: doorSign(OFFICES[k]), emissive: 0x1a1405, emissiveIntensity: 0.6, roughness: 1 }));
    sign.position.set(sx + (sx < 0 ? 0.07 : -0.07), 2.5, z); sign.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2; corridor.add(sign);
  }
  // luces de techo (titilan)
  const hallLights = [];
  for (let z = HALL_Z0 + 4; z < HALL_Z1; z += 6) {
    const pl = new THREE.PointLight(0xffe0a0, 1.2, 13, 2); pl.position.set(0, HALL_H - 0.2, z);
    pl.userData = { base: 1.2, phase: Math.random() * 10 }; corridor.add(pl); hallLights.push(pl);
    const fix = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.25), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    fix.position.set(0, HALL_H - 0.06, z); corridor.add(fix);
  }
  // ventilador de techo
  const fan = new THREE.Group(); fan.position.set(0, HALL_H - 0.35, HALL_Z0 + 16);
  const fanHub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.18, 12), doorMat); fan.add(fanHub);
  for (let b = 0; b < 4; b++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.03, 0.28), doorMat); blade.position.x = 0.85; blade.rotation.y = 0; const arm = new THREE.Group(); arm.rotation.y = b * Math.PI / 2; arm.add(blade); fan.add(arm); }
  corridor.add(fan);
  // papeles sueltos (se elevan cerca del héroe)
  const papers = [];
  for (let p = 0; p < 7; p++) {
    const pa = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.66), new THREE.MeshStandardMaterial({ color: 0xd9d2bd, roughness: 1, side: THREE.DoubleSide }));
    const px = MU.randFloat(-2.2, 2.2), pz = HALL_Z0 + 6 + Math.random() * (hallLen - 10);
    pa.position.set(px, 0.02, pz); pa.rotation.x = -Math.PI / 2; pa.rotation.z = Math.random() * 6;
    pa.userData = { rest: new THREE.Vector3(px, 0.02, pz), spin: MU.randFloat(0.5, 2) };
    corridor.add(pa); papers.push(pa);
  }

  // ── ASCENSOR (al inicio del pasillo, z≈HALL_Z0) ───────────────────
  const elevator = new THREE.Group(); elevator.position.set(0, 0, HALL_Z0 - 0.5); scene.add(elevator);
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5, metalness: 0.8 });
  const elBack = new THREE.Mesh(new THREE.BoxGeometry(HALL_X * 2, HALL_H, 0.2), metal); elBack.position.set(0, HALL_H / 2, -1.4); elBack.receiveShadow = true; elevator.add(elBack);
  const grateL = new THREE.Mesh(new THREE.BoxGeometry(HALL_X, HALL_H, 0.18), metal); grateL.position.set(-HALL_X - 0.1, HALL_H / 2, 0.2); grateL.castShadow = true; elevator.add(grateL);
  const grateR = new THREE.Mesh(new THREE.BoxGeometry(HALL_X, HALL_H, 0.18), metal); grateR.position.set(HALL_X + 0.1, HALL_H / 2, 0.2); grateR.castShadow = true; elevator.add(grateR);
  const extBars = [];
  for (let i = 0; i < 5; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd27a })); bar.position.set(i % 2 ? -HALL_X - 0.4 : HALL_X + 0.4, i * 1.2, -1.0); bar.visible = false; elevator.add(bar); extBars.push(bar); }

  // ── HÉROE (gabán con relieve de lana + fedora) ────────────────────
  const hero = new THREE.Group();
  const woolMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.95, metalness: 0.04, bumpMap: noiseBump(), bumpScale: 0.05 });
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.8 });
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 1.5, 16), woolMat); coat.position.y = 0.75; coat.castShadow = true; hero.add(coat);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.5, 12), woolMat); torso.position.y = 1.55; torso.castShadow = true; hero.add(torso);
  const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), woolMat); shoulderL.position.set(-0.3, 1.6, 0); shoulderL.castShadow = true; hero.add(shoulderL);
  const shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), woolMat); shoulderR.position.set(0.3, 1.6, 0); shoulderR.castShadow = true; hero.add(shoulderR);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), feltMat); head.position.y = 1.92; head.castShadow = true; hero.add(head);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 18), feltMat); brim.position.y = 2.02; brim.castShadow = true; hero.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.32, 16), feltMat); crown.position.y = 2.2; crown.castShadow = true; hero.add(crown);
  hero.position.set(0, 0, HALL_Z1 - 3); hero.rotation.y = Math.PI; scene.add(hero);
  // luz de contorno cálida que sigue al héroe → sombra larga e intimidante
  const rim = new THREE.PointLight(0xffcaa0, 2.0, 22, 2); rim.castShadow = true; rim.shadow.mapSize.set(1024, 1024); rim.shadow.bias = -0.0005; scene.add(rim);

  // ── AUDIO ─────────────────────────────────────────────────────────
  let actx = null, master = null, lampHum = null, airGain = null;
  function audioResume() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
      const sr = actx.sampleRate, n = sr * 2, buf = actx.createBuffer(1, n, sr), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1);
      const air = actx.createBufferSource(); air.buffer = buf; air.loop = true;
      const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      airGain = actx.createGain(); airGain.gain.value = 0.035;
      air.connect(lp); lp.connect(airGain); airGain.connect(master); air.start();
      const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58;
      const lf = actx.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 130;
      lampHum = actx.createGain(); lampHum.gain.value = 0.0;
      o.connect(lf); lf.connect(lampHum); lampHum.connect(master); o.start();
    } catch (_) {}
  }
  function blip(kind, panX) {
    if (!actx) return;
    try {
      const dur = kind === 'thud' ? 0.2 : kind === 'step' ? 0.16 : kind === 'switch' ? 0.07 : kind === 'clank' ? 0.18 : kind === 'drag' ? 0.12 : 0.08;
      const sr = actx.sampleRate, len = Math.floor(sr * dur), b = actx.createBuffer(1, len, sr), dd = b.getChannelData(0);
      const decay = kind === 'thud' ? 4 : kind === 'step' ? 5 : kind === 'switch' ? 10 : kind === 'clank' ? 5 : kind === 'drag' ? 2 : 9;
      for (let i = 0; i < len; i++) { const t = i / len; dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay); }
      const src = actx.createBufferSource(); src.buffer = b;
      const bp = actx.createBiquadFilter();
      bp.type = (kind === 'thud' || kind === 'step') ? 'lowpass' : 'bandpass';
      bp.frequency.value = kind === 'thud' ? 220 : kind === 'step' ? 320 : kind === 'switch' ? 2600 : kind === 'clank' ? 1500 : kind === 'clip' ? 3400 : 950;
      const pan = actx.createStereoPanner(); pan.pan.value = MU.clamp(panX || 0, -1, 1);
      const g = actx.createGain(); g.gain.value = kind === 'thud' ? 0.6 : kind === 'switch' ? 0.5 : 0.4;
      src.connect(bp); bp.connect(pan); pan.connect(g); g.connect(master); src.start();
    } catch (_) {}
  }
  function swell() { if (airGain) { try { airGain.gain.linearRampToValueAtTime(0.12, actx.currentTime + 1.4); } catch (_) {} } }
  const screenX = (obj) => { const v = obj.position.clone().project(camera); return MU.clamp(v.x, -1, 1); };

  // ── ENTRADA ───────────────────────────────────────────────────────
  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.key] = true; if (e.key === 'Escape') exitInspect(); if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault(); audioResume(); });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  const FWD = ['a', 'A', 'd', 'D', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'w', 'W'];
  const wantsForward = () => FWD.some((k) => keys[k]);

  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(DESK_TOP + 0.06)), tmp = new THREE.Vector3();
  const INSPECT_POS = new THREE.Vector3(0, 3.4, 5.4);
  let hovered = null, dragging = null, inspecting = null, rotating = false;
  let moved = false, downXY = null, lastXY = null, lastT = 0, clickTimer = null, firstClickDone = false;
  const dragOffset = new THREE.Vector3();
  const setPointer = (e) => { pointer.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.y = -(e.clientY / window.innerHeight) * 2 + 1; };
  function pick() { raycaster.setFromCamera(pointer, camera); const h = raycaster.intersectObjects(pickables, false); return h.length ? h[0].object.userData.env : null; }
  function setHover(env) { if (hovered === env) return; if (hovered) hovered.children[0].material.emissive.setHex(0x000000); hovered = env; if (hovered) hovered.children[0].material.emissive.setHex(0x332a10); canvas.style.cursor = env ? 'grab' : 'default'; }
  function toggleOpen(env) { env.userData.open = !env.userData.open; blip('clip', screenX(env)); if (!firstClickDone) { firstClickDone = true; if (promptEl) promptEl.classList.remove('is-on'); blip('thud', screenX(env)); } }
  function enterInspect(env) { inspecting = env; env.userData.home = { p: env.position.clone(), q: env.quaternion.clone() }; env.userData.open = true; blip('drag', screenX(env)); }
  function exitInspect() { if (!inspecting) return; const env = inspecting; inspecting = null; rotating = false; env.userData.returning = true; }

  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'escritorio') return;
    setPointer(e); audioResume(); moved = false; downXY = { x: e.clientX, y: e.clientY }; lastXY = { x: e.clientX, y: e.clientY }; lastT = performance.now();
    if (inspecting) { rotating = true; return; }
    const env = pick();
    if (env) { dragging = env; dragging.userData.settling = false; dragging.userData.vel.set(0, 0, 0); raycaster.setFromCamera(pointer, camera); if (raycaster.ray.intersectPlane(dragPlane, tmp)) dragOffset.copy(env.position).sub(tmp); canvas.style.cursor = 'grabbing'; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
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
  canvas.addEventListener('click', (e) => { if (state !== 'escritorio' || moved || inspecting) return; setPointer(e); const env = pick(); if (!env) return; clearTimeout(clickTimer); clickTimer = setTimeout(() => toggleOpen(env), 240); });
  canvas.addEventListener('dblclick', (e) => { if (state !== 'escritorio') return; clearTimeout(clickTimer); if (inspecting) return; setPointer(e); const env = pick(); if (env) enterInspect(env); });

  // ── MENÚ → DOLLY → JUEGO ──────────────────────────────────────────
  let state = 'menu';
  if (helpEl) helpEl.style.display = 'none';
  let dollyT = 0; const DOLLY_DUR = 1.5; const dollyFrom = new THREE.Vector3();
  if (playBtn) {
    playBtn.addEventListener('pointerenter', () => { audioResume(); blip('switch', -0.2); });
    playBtn.addEventListener('click', () => {
      audioResume(); blip('switch', 0); swell();
      if (menuEl) menuEl.classList.add('hidden');
      state = 'dolly'; dollyT = 0; dollyFrom.copy(camera.position);
    });
  }
  function beginWalk() {
    state = 'caminando';
    menuProps.visible = false; lampSpot.intensity = 0;
    hero.position.set(0, 0, HALL_Z1 - 3);
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.position.set(0, 2.6, hero.position.z + 5.5);
    if (helpEl) helpEl.style.display = '';
    setHelp('<b>← →</b> / <b>A D</b> avanzar por el pasillo');
  }

  // ── ASCENSOR / TRANSICIÓN ─────────────────────────────────────────
  let ascT = 0; const ASC_DUR = 3.6;
  let transT = 0; const TRANS_DUR = 2.8; const camFrom = new THREE.Vector3(), lookFrom = new THREE.Vector3();
  function enterAscensor() { state = 'ascensor'; ascT = 0; setHelp('··· ASCENSOR EN DESCENSO ···'); blip('clank', 0); extBars.forEach((b) => { b.visible = true; }); }
  function startTransition() { state = 'transicion'; transT = 0; camFrom.copy(camera.position); lookFrom.copy(lookTarget); envelopes.forEach((g) => { g.visible = true; }); }
  function enterDesk() { state = 'escritorio'; setHelp('<b>CLIC</b> abrir · <b>ARRASTRAR</b> mover · <b>DOBLE CLIC</b> rotar · <b>ESC</b> soltar'); if (promptEl) promptEl.classList.add('is-on'); }

  // ── BUCLE ─────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta()), now = performance.now() / 1000;

    fan.rotation.y += dt * 0.8;                       // ventilador girando
    if (smoke && menuProps.visible) {                  // humo del cigarrillo (en menú)
      const pos = smokeGeo.attributes.position;
      for (let i = 0; i < SMOKE_N; i++) {
        let y = pos.getY(i) + dt * 0.35;
        let xx = pos.getX(i) + Math.sin(now * 1.5 + i) * dt * 0.04;
        if (y > smokeOrigin.y + 1.8) { y = smokeOrigin.y; xx = smokeOrigin.x + (Math.random() * 0.1 - 0.05); }
        pos.setY(i, y); pos.setX(i, xx);
      }
      pos.needsUpdate = true;
    }

    if (state === 'menu') {
      camera.position.x = MENU_CAM.x + Math.sin(now * 0.4) * 0.05;
      camera.lookAt(lookTarget);
      lampSpot.intensity = 4.5 * (0.78 + Math.random() * 0.24);   // parpadeo de lámpara
      cigTip.material.color.setHex(Math.random() > 0.5 ? 0xff5a1a : 0xc83a0a);

    } else if (state === 'dolly') {
      dollyT += dt; const k = MU.smoothstep(dollyT / DOLLY_DUR, 0, 1);
      camera.position.lerpVectors(dollyFrom, new THREE.Vector3(0.4, 0.95, 1.5), k);
      camera.fov = MU.lerp(50, 34, k); camera.updateProjectionMatrix();
      camera.lookAt(lookTarget);
      lampSpot.intensity = 4.5 * (0.78 + Math.random() * 0.24);
      if (dollyT >= DOLLY_DUR) beginWalk();

    } else if (state === 'caminando') {
      for (const pl of hallLights) { pl.userData.phase += dt; const f = (Math.sin(pl.userData.phase * 2.3) > 0.93 || Math.random() > 0.992) ? MU.randFloat(0.2, 0.7) : 1; pl.intensity += (pl.userData.base * f - pl.intensity) * 0.4; }
      const moving = wantsForward();
      if (moving && hero.position.z > HALL_Z0 + 1) {
        hero.position.z -= 2.2 * dt; walkPhase += dt * 6;
        hero.position.y = Math.abs(Math.sin(walkPhase)) * 0.06;
        hero.rotation.z = Math.sin(walkPhase) * 0.04;
        crown.rotation.z = brim.rotation.z = Math.sin(walkPhase * 0.5) * 0.02;
        stepCooldown -= dt; if (stepCooldown <= 0) { blip('step', 0); stepCooldown = 0.42; }
      } else {
        hero.position.y += (0 - hero.position.y) * 0.2;
        idlePhase += dt;
        crown.rotation.z = brim.rotation.z = Math.sin(idlePhase * 0.8) * 0.06;   // idle: ajustar sombrero / mirar
        hero.rotation.y = Math.PI + Math.sin(idlePhase * 0.5) * 0.06;
      }
      // luz de contorno detrás del héroe → sombra larga hacia el frente
      rim.position.set(hero.position.x + 0.5, 4.2, hero.position.z + 3.5);
      // papeles que se elevan en vórtice al pasar cerca
      for (const pa of papers) {
        const near = Math.abs(pa.userData.rest.z - hero.position.z) < 3 && moving;
        if (near) { pa.position.y += (1.2 - pa.position.y) * 0.06; pa.rotation.z += pa.userData.spin * dt; pa.position.x += Math.sin(now * 3 + pa.userData.spin) * dt * 0.3; }
        else { pa.position.lerp(pa.userData.rest, 0.05); pa.rotation.x = -Math.PI / 2; }
      }
      tmp.set(hero.position.x, 2.6, hero.position.z + 5.5); camera.position.lerp(tmp, 0.12);
      lookTarget.set(hero.position.x, 1.3, hero.position.z - 8); camera.lookAt(lookTarget);
      if (hero.position.z <= HALL_Z0 + 1.2) enterAscensor();

    } else if (state === 'ascensor') {
      ascT += dt;
      // Fase A: rejillas cierran
      const close = MU.clamp(ascT / 1.1, 0, 1);
      grateL.position.x = MU.lerp(-HALL_X - 0.1, -HALL_X / 2, close);
      grateR.position.x = MU.lerp(HALL_X + 0.1, HALL_X / 2, close);
      // Fase B: vibración + barras exteriores subiendo (ilusión de descenso)
      if (ascT > 1.1) {
        const shake = 0.03; camera.position.x += (Math.random() * 2 - 1) * shake; camera.position.y += (Math.random() * 2 - 1) * shake;
        for (const bar of extBars) { bar.position.y += dt * 6; if (bar.position.y > HALL_H + 0.5) bar.position.y = -0.5; }
      } else {
        tmp.set(hero.position.x, 2.4, hero.position.z + 4.5); camera.position.lerp(tmp, 0.1); lookTarget.set(0, 1.4, hero.position.z - 4); camera.lookAt(lookTarget);
      }
      if (ascT >= ASC_DUR) { extBars.forEach((b) => { b.visible = false; }); startTransition(); }

    } else if (state === 'transicion') {
      transT += dt; const k = MU.smoothstep(transT / TRANS_DUR, 0, 1);
      camera.position.lerpVectors(camFrom, DESK_CAM, k);
      lookTarget.lerpVectors(lookFrom, new THREE.Vector3(0, 0, 0), k); camera.lookAt(lookTarget);
      spot.intensity = 3.4 * k; if (lampHum) lampHum.gain.value = 0.05 * k;
      corridor.traverse((o) => { if (o.isPointLight) o.intensity *= (1 - 0.6 * dt); });
      rim.intensity *= (1 - 0.5 * dt);
      envelopes.forEach((g) => { g.userData.popT = Math.min(1, g.userData.popT + dt * 1.6); g.scale.setScalar(0.6 + 0.4 * g.userData.popT); });
      if (transT >= TRANS_DUR) { camera.position.copy(DESK_CAM); envelopes.forEach((g) => g.scale.setScalar(1)); enterDesk(); }

    } else { // escritorio
      camera.lookAt(0, 0, 0);
      for (const env of envelopes) {
        const u = env.userData;
        u.openT += ((u.open ? 1 : 0) - u.openT) * Math.min(1, dt * 4); u.flapPivot.rotation.x = -2.35 * u.openT;
        if (u === inspecting) env.position.lerp(INSPECT_POS, 0.12);
        else if (u.returning && u.home) { env.position.lerp(u.home.p, 0.14); env.quaternion.slerp(u.home.q, 0.14); if (env.position.distanceTo(u.home.p) < 0.02) { env.position.copy(u.home.p); env.quaternion.copy(u.home.q); u.returning = false; } }
        else if (u.settling) {
          env.position.addScaledVector(u.vel, dt); u.vel.multiplyScalar(0.86);
          env.position.x = MU.clamp(env.position.x, -5, 5); env.position.z = MU.clamp(env.position.z, -3.4, 3.4);
          env.position.y += (u.restY - env.position.y) * 0.2; env.rotation.z += (0 - env.rotation.z) * 0.18; env.rotation.x += (0 - env.rotation.x) * 0.18;
          if (u.vel.length() < 0.05 && Math.abs(env.position.y - u.restY) < 0.01) { u.settling = false; u.vel.set(0, 0, 0); env.position.y = u.restY; blip('thud', screenX(env)); }
        } else if (u !== dragging) env.position.y += (u.restY - env.position.y) * 0.2;
      }
    }
    renderer.render(scene, camera);
  }
  let walkPhase = 0, idlePhase = 0, stepCooldown = 0;
  animate();

  } catch (e) { fail(e); }
})();
