/* ══════════════════════════════════════════════════════════════════
   ASPERTER VS REAL LIFE — motor de juego (Three.js / WebGL, sin build)
   Estados: 'menu' → 'dolly' → 'cinematica_taxi' → 'exploracion_oficina'
            → 'inspeccion' → 'ascensor' → 'fin'
   Sin assets externos: geometría procedural, bump map en canvas, animación
   por código y audio sintetizado (WebAudio). El backend Django solo sirve
   esta página: el juego corre 100% en el cliente.
══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

(() => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const fail = (e) => { console.error('[ASPERTER]', e); const f = document.getElementById('fallback'); if (f) f.style.display = 'flex'; };

  try {
  const MU = THREE.MathUtils;
  const $ = (id) => document.getElementById(id);
  const menuEl = $('menu'), playBtn = $('menu-play'), helpEl = $('hud-help'), promptEl = $('prompt');
  const subsEl = $('subs'), subsWho = $('subs-who'), subsText = $('subs-text');
  const setHelp = (t) => { if (helpEl) { helpEl.style.display = t ? 'block' : 'none'; helpEl.innerHTML = t || ''; } };

  // ── Renderer / escena / cámara ────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  window.__gameOK = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040405);
  scene.fog = new THREE.FogExp2(0x040405, 0.035);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 300);
  const ambient = new THREE.AmbientLight(0x20222a, 0.5); scene.add(ambient);
  function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); resize();

  // ── Texturas procedurales ─────────────────────────────────────────
  function wood(rep, base) {
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.fillStyle = base || '#4a3115'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 150; i++) { x.strokeStyle = `rgba(${28 + Math.random() * 38},${18 + Math.random() * 22},${8 + Math.random() * 12},${0.12 + Math.random() * 0.22})`; x.lineWidth = 1 + Math.random() * 2; const y = Math.random() * 512; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(170, y + (Math.random() * 18 - 9), 340, y + (Math.random() * 18 - 9), 512, y); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep || 2, rep || 2); return t;
  }
  function bump() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const im = x.createImageData(128, 128); for (let i = 0; i < im.data.length; i += 4) { const v = 110 + Math.random() * 140; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 4); return t; }
  function sprite() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
  function labelTex(folio) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 360; const x = c.getContext('2d');
    x.fillStyle = '#c9b27c'; x.fillRect(0, 0, 512, 360); x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 8; x.strokeRect(10, 10, 492, 340);
    x.fillStyle = '#2a1c0c'; x.font = 'bold 38px "Courier New",monospace'; x.fillText('MINISTRY OF DEFENCE', 28, 70);
    x.fillStyle = '#8a1414'; x.font = 'bold 30px "Courier New",monospace'; x.fillText('RESTRICTED', 28, 118);
    x.strokeStyle = '#a01818'; x.lineWidth = 4; x.strokeRect(28, 150, 280, 60); x.fillStyle = '#a01818'; x.font = 'bold 34px "Courier New",monospace'; x.fillText(folio.id || 'EXPED', 42, 194);
    x.fillStyle = '#2a2418'; x.font = '22px "Courier New",monospace'; x.fillText((folio.title || 'EXPEDIENTE').slice(0, 26).toUpperCase(), 28, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ── OFICINA (sala principal) ──────────────────────────────────────
  const RX = 10, RZ = 12, RH = 5;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), new THREE.MeshStandardMaterial({ color: 0x161310, roughness: 1, map: wood(6, '#241a10') }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RX * 2, RZ * 2), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = RH; scene.add(ceil);
  const wallMat = new THREE.MeshStandardMaterial({ map: wood(3, '#33271a'), color: 0x4a3a26, roughness: 0.95 });
  function wall(w, x, z, ry) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, RH), wallMat); m.position.set(x, RH / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); }
  wall(RX * 2, 0, -RZ, 0); wall(RX * 2, 0, RZ, Math.PI); wall(RZ * 2, -RX, 0, Math.PI / 2); wall(RZ * 2, RX, 0, -Math.PI / 2);

  // Ventilador de techo
  const fan = new THREE.Group(); fan.position.set(0, RH - 0.3, 0);
  const fanMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.4 });
  fan.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.18, 12), fanMat));
  for (let b = 0; b < 4; b++) { const arm = new THREE.Group(); arm.rotation.y = b * Math.PI / 2; const bl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.03, 0.3), fanMat); bl.position.x = 0.9; arm.add(bl); fan.add(arm); }
  scene.add(fan);

  // Ventana con persianas (líneas de sombra) — luz lunar fría exterior
  const moon = new THREE.SpotLight(0x86a0c0, 2.2, 40, Math.PI / 4, 0.6, 1.2); moon.position.set(-9.5, 4.2, -6); moon.target.position.set(2, 0, 0); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); scene.add(moon); scene.add(moon.target);
  for (let i = 0; i < 8; i++) { const slat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 2.4), new THREE.MeshStandardMaterial({ color: 0x20242a })); slat.position.set(-9.92, 1.4 + i * 0.28, -6); scene.add(slat); }

  // ── Escritorios (uno es el del menú; dos son inspeccionables) ─────
  const deskMat = new THREE.MeshStandardMaterial({ map: wood(2, '#3a2614'), color: 0x6a4527, roughness: 0.8, metalness: 0.06 });
  function makeDesk(x, z) { const g = new THREE.Group(); const top = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 1.8), deskMat); top.position.y = 1.0; top.castShadow = top.receiveShadow = true; g.add(top); for (const sx of [-1.5, 1.5]) for (const sz of [-0.7, 0.7]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.16), deskMat); leg.position.set(sx, 0.5, sz); g.add(leg); } g.position.set(x, 0, z); scene.add(g); g.userData = { topY: 1.09 }; return g; }
  const nightDesk = makeDesk(0, -10.5);     // foco del menú
  const deskA = makeDesk(-6.5, 1), deskB = makeDesk(6.5, 1);

  // Props del menú sobre nightDesk
  const menuProps = new THREE.Group(); scene.add(menuProps);
  const lampSpot = new THREE.SpotLight(0xffd28a, 5.0, 12, Math.PI / 5, 0.5, 1.5); lampSpot.position.set(-1.6, 2.2, -9.6); lampSpot.castShadow = true; lampSpot.shadow.mapSize.set(1024, 1024); menuProps.add(lampSpot); menuProps.add(lampSpot.target); lampSpot.target.position.set(0.3, 1.0, -10.5);
  const blkMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.3, metalness: 0.4 });
  const lamp = new THREE.Group(); lamp.add(mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.1, 16), blkMat, 0, 1.14, 0)); lamp.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), blkMat, 0, 1.8, 0, 0.5)); lamp.add(mesh(new THREE.ConeGeometry(0.26, 0.4, 16, 1, true), blkMat, 0.4, 2.45, 0, -0.9)); lamp.position.set(-1.6, 0, -9.6); menuProps.add(lamp);
  const phone = new THREE.Group(); phone.add(mesh(new THREE.BoxGeometry(0.8, 0.28, 0.6), blkMat, 0, 1.23, 0)); phone.add(mesh(new THREE.BoxGeometry(0.9, 0.12, 0.14), blkMat, 0, 1.42, 0)); phone.position.set(1.2, 0, -10.4); phone.rotation.y = -0.4; menuProps.add(phone);
  const ash = mesh(new THREE.TorusGeometry(0.2, 0.06, 10, 22), new THREE.MeshStandardMaterial({ color: 0x20201e, roughness: 0.4, metalness: 0.3 }), -0.5, 1.13, -10.2); ash.rotation.x = Math.PI / 2; menuProps.add(ash);
  const cigTip = mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff5a1a }), -0.2, 1.15, -10.2); menuProps.add(cigTip);
  const smokeO = new THREE.Vector3(-0.2, 1.2, -10.2), SMK = 44, sg = new THREE.BufferGeometry(), sp = new Float32Array(SMK * 3);
  for (let i = 0; i < SMK; i++) { sp[i * 3] = smokeO.x + Math.random() * 0.1 - 0.05; sp[i * 3 + 1] = smokeO.y + Math.random() * 1.6; sp[i * 3 + 2] = smokeO.z + Math.random() * 0.1 - 0.05; }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const smoke = new THREE.Points(sg, new THREE.PointsMaterial({ map: sprite(), size: 0.45, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, color: 0x9aa0a6 })); menuProps.add(smoke);

  function mesh(geo, mat, x, y, z, rz) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); if (rz) m.rotation.z = rz; m.castShadow = true; return m; }

  // ── Expedientes (sobre los escritorios inspeccionables) ───────────
  const FOLIOS = [{ id: 'EXPED-101', title: 'INCIDENTE DEL 62' }, { id: 'EXPED-207', title: 'NIVEL CERO' }];
  const envelopes = [], pickEnv = [];
  function makeEnvelope(folio, desk) {
    const g = new THREE.Group(); const W = 1.6, H = 0.1, D = 2.1;
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), new THREE.MeshStandardMaterial({ color: 0xccb27a, roughness: 0.93 })); base.castShadow = base.receiveShadow = true; g.add(base);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.95, D * 0.95), new THREE.MeshStandardMaterial({ map: labelTex(folio), roughness: 0.96 })); lab.rotation.x = -Math.PI / 2; lab.position.y = H / 2 + 0.002; g.add(lab);
    const piv = new THREE.Group(); piv.position.set(0, H / 2, -D / 2); g.add(piv);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, D * 0.5), new THREE.MeshStandardMaterial({ color: 0xbfa66f, roughness: 0.9 })); flap.position.set(0, 0, D * 0.25); flap.castShadow = true; piv.add(flap);
    g.position.set(desk.position.x, desk.userData.topY + H / 2, desk.position.z); g.rotation.y = MU.randFloat(-0.1, 0.1);
    g.userData = { piv, open: false, openT: 0, desk };
    [base, lab, flap].forEach((m) => { m.userData.env = g; pickEnv.push(m); });
    envelopes.push(g); scene.add(g);
  }
  makeEnvelope(FOLIOS[0], deskA); makeEnvelope(FOLIOS[1], deskB);

  // ── Palancas (energía) + ASCENSOR ─────────────────────────────────
  const leverMat = new THREE.MeshStandardMaterial({ color: 0x8a1414, roughness: 0.5, metalness: 0.5 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5, metalness: 0.85 });
  function makeLever(x, y, z) { const g = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.18), metal); box.castShadow = true; g.add(box); const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), leverMat); arm.position.y = 0.3; arm.geometry.translate(0, 0.0, 0); g.add(arm); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), leverMat); knob.position.y = 0.55; g.add(knob); g.userData = { arm, on: false }; g.position.set(x, y, z); scene.add(g); return g; }
  const powerLever = makeLever(-9.6, 1.4, 2); powerLever.rotation.y = Math.PI / 2;
  // Ascensor
  const elevator = new THREE.Group(); elevator.position.set(0, 0, 11.2); scene.add(elevator);
  elevator.add(meshAt(new THREE.BoxGeometry(5, RH, 0.3), metal, 0, RH / 2, 0.6, true));
  const grateL = meshAt(new THREE.BoxGeometry(2.5, RH, 0.2), metal, -3.6, RH / 2, -0.4, true);
  const grateR = meshAt(new THREE.BoxGeometry(2.5, RH, 0.2), metal, 3.6, RH / 2, -0.4, true);
  elevator.add(grateL); elevator.add(grateR);
  const elLever = makeLever(1.8, 1.4, 10.6);
  const extBars = []; for (let i = 0; i < 6; i++) { const bar = meshAt(new THREE.BoxGeometry(0.5, 0.6, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd27a }), i % 2 ? -2.7 : 2.7, i * 1.0, 11.9, false); bar.visible = false; scene.add(bar); extBars.push(bar); }
  function meshAt(geo, mat, x, y, z, sh) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sh) m.castShadow = m.receiveShadow = true; return m; }
  const pickInteract = [powerLever.children[0], elLever.children[0], deskA.children[0], deskB.children[0]];

  // ── HÉROE (Winston) + LINTERNA ────────────────────────────────────
  const hero = new THREE.Group();
  const wool = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.95, metalness: 0.04, bumpMap: bump(), bumpScale: 0.05 });
  const felt = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.8 });
  hero.add(mesh(new THREE.CylinderGeometry(0.32, 0.58, 1.4, 16), wool, 0, 0.8, 0));
  hero.add(mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.45, 12), wool, 0, 1.5, 0));
  const legL = mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), felt, -0.16, 0.35, 0), legR = mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), felt, 0.16, 0.35, 0); hero.add(legL); hero.add(legR);
  hero.add(mesh(new THREE.SphereGeometry(0.19, 16, 16), felt, 0, 1.82, 0));
  const brim = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 18), felt, 0, 1.92, 0); hero.add(brim);
  hero.add(mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.3, 16), felt, 0, 2.1, 0));
  hero.position.set(0, 0, 8); hero.rotation.y = Math.PI; hero.visible = false; scene.add(hero);
  // linterna dinamo
  const flash = new THREE.SpotLight(0xfff0d0, 0.0, 26, Math.PI / 7, 0.4, 1.0); flash.castShadow = true; flash.shadow.mapSize.set(1024, 1024); scene.add(flash); scene.add(flash.target);

  // ── TAXI (cinemática) ─────────────────────────────────────────────
  const taxi = new THREE.Group(); taxi.position.set(0, 0, 120); taxi.visible = false; scene.add(taxi);
  taxi.add(meshAt(new THREE.BoxGeometry(6, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.6 }), 0, 0.2, 0, true));
  taxi.add(meshAt(new THREE.BoxGeometry(2.6, 1.2, 0.4), blkMat, 0, 1.2, 1.6, true));   // respaldo delantero
  const taxista = new THREE.Group(); taxista.add(mesh(new THREE.CylinderGeometry(0.35, 0.5, 1.1, 12), wool, 0, 1.4, 0)); taxista.add(mesh(new THREE.SphereGeometry(0.22, 12, 12), felt, 0, 2.1, 0)); taxista.position.set(-0.8, 0, 2.4); taxi.add(taxista);
  const winston = new THREE.Group(); winston.add(mesh(new THREE.CylinderGeometry(0.34, 0.55, 1.3, 14), wool, 0, 1.4, 0)); winston.add(mesh(new THREE.SphereGeometry(0.2, 14, 14), felt, 0, 2.05, 0)); winston.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 18), felt, 0, 2.18, 0)); winston.add(mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.3, 16), felt, 0, 2.36, 0)); winston.position.set(0.5, 0, -1.5); winston.rotation.y = 0.3; taxi.add(winston);
  // lluvia + luces que pasan
  const RN = 300, rg = new THREE.BufferGeometry(), rp = new Float32Array(RN * 3);
  for (let i = 0; i < RN; i++) { rp[i * 3] = MU.randFloat(-8, 8); rp[i * 3 + 1] = MU.randFloat(0, 12); rp[i * 3 + 2] = MU.randFloat(-8, 8); }
  rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0x9fb6cc, size: 0.06, transparent: true, opacity: 0.5 })); taxi.add(rain);
  const passLights = []; for (let i = 0; i < 6; i++) { const pl = new THREE.PointLight(i % 2 ? 0xff7040 : 0x60a0ff, 2.0, 10, 2); pl.position.set(i % 2 ? -5 : 5, MU.randFloat(1, 3), MU.randFloat(-8, 8)); taxi.add(pl); passLights.push(pl); }

  // ── AUDIO ─────────────────────────────────────────────────────────
  let actx = null, master = null, airGain = null, flashHum = null;
  function audioResume() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
      const sr = actx.sampleRate, n = sr * 2, buf = actx.createBuffer(1, n, sr), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const air = actx.createBufferSource(); air.buffer = buf; air.loop = true; const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; airGain = actx.createGain(); airGain.gain.value = 0.04; air.connect(lp); lp.connect(airGain); airGain.connect(master); air.start();
    } catch (_) {}
  }
  function blip(kind, panX) {
    if (!actx) return;
    try {
      const P = { thud: [0.2, 4, 'lowpass', 220, 0.6], step: [0.17, 5, 'lowpass', 300, 0.4], switch: [0.07, 10, 'bandpass', 2600, 0.5], clank: [0.22, 5, 'bandpass', 1300, 0.55], type: [0.04, 9, 'bandpass', 2600, 0.3], clip: [0.08, 9, 'bandpass', 3200, 0.4], drag: [0.12, 2, 'bandpass', 950, 0.4], splash: [0.16, 3, 'lowpass', 700, 0.45] };
      const c = P[kind] || P.clip; const sr = actx.sampleRate, len = Math.floor(sr * c[0]), b = actx.createBuffer(1, len, sr), dd = b.getChannelData(0);
      for (let i = 0; i < len; i++) { const t = i / len; dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, c[1]); }
      const src = actx.createBufferSource(); src.buffer = b; const bp = actx.createBiquadFilter(); bp.type = c[2]; bp.frequency.value = c[3];
      const pan = actx.createStereoPanner(); pan.pan.value = MU.clamp(panX || 0, -1, 1); const g = actx.createGain(); g.gain.value = c[4];
      src.connect(bp); bp.connect(pan); pan.connect(g); g.connect(master); src.start();
    } catch (_) {}
  }
  function swell() { if (airGain) { try { airGain.gain.linearRampToValueAtTime(0.13, actx.currentTime + 1.4); } catch (_) {} } }

  // ── ENTRADA ───────────────────────────────────────────────────────
  const keys = {}; let yaw = Math.PI, pitch = -0.1;
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape') exitInspect(); if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault(); audioResume(); });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), tmp = new THREE.Vector3();
  const setPointer = (e) => { pointer.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.y = -(e.clientY / window.innerHeight) * 2 + 1; };

  canvas.addEventListener('pointermove', (e) => {
    setPointer(e);
    if (state === 'exploracion_oficina') { yaw -= (e.movementX || 0) * 0.0026; pitch = MU.clamp(pitch - (e.movementY || 0) * 0.0024, -0.6, 0.4); }
    if (state === 'inspeccion' && rotating && inspectEnv) { inspectEnv.rotateY((e.movementX || 0) * 0.01); inspectEnv.rotateX((e.movementY || 0) * 0.01); }
  });
  canvas.addEventListener('pointerdown', (e) => {
    audioResume(); setPointer(e);
    if (state === 'exploracion_oficina') {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickInteract, false)[0];
      if (hit) {
        const root = hit.object.parent;
        if (root === powerLever) powerOn();
        else if (root === elLever) { if (powerOn_) startAscensor(); else { blip('switch', 0); flashMsg('SIN ENERGÍA — ACTIVE LA PALANCA ROJA'); } }
        else if (root === deskA) startInspect(deskA);
        else if (root === deskB) startInspect(deskB);
      }
    } else if (state === 'inspeccion') {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickEnv, false)[0];
      if (hit) { rotating = true; const env = hit.object.userData.env; env.userData.open = !env.userData.open; blip('thud', 0); }
    }
  });
  canvas.addEventListener('pointerup', () => { rotating = false; });

  // ── HUD / mensajes ────────────────────────────────────────────────
  let msgT = 0;
  function flashMsg(t) { setHelp('<b>' + t + '</b>'); msgT = 2.5; }

  // ── DIÁLOGOS DE LA CINEMÁTICA ─────────────────────────────────────
  const DIALOG = [
    ['TAXISTA', '¿Seguro que quiere que lo deje ahí, señor Carrey? Ese edificio de Axiom lleva cerrado desde el incidente del 62...'],
    ['WINSTON CARREY', 'Solo maneje. Hay papeles en esa oficina que no pueden quedarse enterrados para siempre. Juan Carlos e Ismael me aseguraron que la zona estaría despejada esta noche.'],
    ['TAXISTA', 'Como diga, jefe. Pero si el sistema de seguridad electromecánico se activa solo... nadie va a bajar a sacarlo de ahí.'],
  ];
  let dlgIndex = -1, dlgChars = 0, dlgFull = '', dlgTimer = 0, dlgDone = false;
  function startDialog(i) {
    dlgIndex = i; if (i >= DIALOG.length) { subsEl.classList.remove('is-on'); arriveOffice(); return; }
    subsEl.classList.add('is-on'); subsWho.textContent = DIALOG[i][0]; dlgFull = DIALOG[i][1]; dlgChars = 0; dlgDone = false; subsText.textContent = ''; dlgTimer = 0;
    if (i === 1) winston.rotation.z = -0.06;   // se ajusta el sombrero
  }
  function advanceDialog() { if (!dlgDone) { dlgChars = dlgFull.length; subsText.textContent = dlgFull; dlgDone = true; } else startDialog(dlgIndex + 1); }
  canvas.addEventListener('click', () => { if (state === 'cinematica_taxi') advanceDialog(); });

  // ── MENÚ / DOLLY ──────────────────────────────────────────────────
  let state = 'menu';
  const MENU_CAM = new THREE.Vector3(2.2, 1.55, -7.2), MENU_LOOK = new THREE.Vector3(0, 1.1, -10.4);
  camera.position.copy(MENU_CAM); camera.lookAt(MENU_LOOK);
  let dollyT = 0; const dollyFrom = new THREE.Vector3();
  if (playBtn) {
    playBtn.addEventListener('pointerenter', () => { audioResume(); blip('switch', -0.2); });
    playBtn.addEventListener('click', () => { audioResume(); blip('switch', 0); swell(); if (menuEl) menuEl.classList.add('hidden'); state = 'dolly'; dollyT = 0; dollyFrom.copy(camera.position); });
  }
  function startTaxi() { state = 'cinematica_taxi'; menuProps.visible = false; lampSpot.intensity = 0; taxi.visible = true; ambient.intensity = 0.3; startDialog(0); }
  function arriveOffice() {
    blip('splash', 0); taxi.visible = false; hero.visible = true; ambient.intensity = 0.16; flash.intensity = 5.5;
    state = 'exploracion_oficina'; hero.position.set(0, 0, 8); yaw = Math.PI; pitch = -0.1;
    setHelp('<b>WASD</b> mover · <b>MOUSE</b> mirar/linterna · <b>CLIC</b> interactuar');
    if (promptEl) { promptEl.textContent = '[ ENCUENTRE LA PALANCA DE ENERGÍA (ROJA) ]'; promptEl.classList.add('is-on'); }
  }

  // ── ENERGÍA / INSPECCIÓN / ASCENSOR ───────────────────────────────
  let powerOn_ = false;
  function powerOn() {
    if (powerOn_) return; powerOn_ = true; blip('clank', -0.4); powerLever.userData.arm.rotation.x = 0.7;
    ambient.intensity = 0.42; moon.intensity = 3.2;
    if (promptEl) promptEl.textContent = '[ ENERGÍA RESTAURADA — VAYA AL ASCENSOR ]';
    flashMsg('ENERGÍA RESTAURADA');
  }
  let inspectEnv = null, rotating = false, inspectFrom = new THREE.Vector3(), inspectDesk = null, inspectT = 0;
  function startInspect(desk) { state = 'inspeccion'; inspectDesk = desk; inspectFrom.copy(camera.position); inspectT = 0; inspectEnv = envelopes.find((e) => e.userData.desk === desk) || null; setHelp('<b>CLIC</b> abrir/rotar expediente · <b>ESC</b> volver'); if (promptEl) promptEl.classList.remove('is-on'); }
  function exitInspect() { if (state !== 'inspeccion') return; state = 'exploracion_oficina'; inspectDesk = null; inspectEnv = null; setHelp('<b>WASD</b> mover · <b>MOUSE</b> mirar · <b>CLIC</b> interactuar'); }

  let ascT = 0; function startAscensor() { state = 'ascensor'; ascT = 0; blip('clank', 0); setHelp('··· ASCENSOR DESCENDIENDO ···'); extBars.forEach((b) => b.visible = true); if (promptEl) promptEl.classList.remove('is-on'); }

  // ── BUCLE ─────────────────────────────────────────────────────────
  const clock = new THREE.Clock(); let walkPhase = 0, stepCD = 0;
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta()), now = performance.now() / 1000;
    fan.rotation.y += dt * 0.7;
    if (msgT > 0) { msgT -= dt; if (msgT <= 0 && state === 'exploracion_oficina') setHelp('<b>WASD</b> mover · <b>MOUSE</b> mirar · <b>CLIC</b> interactuar'); }

    if (menuProps.visible) { const pos = sg.attributes.position; for (let i = 0; i < SMK; i++) { let y = pos.getY(i) + dt * 0.32; if (y > smokeO.y + 1.7) y = smokeO.y; pos.setY(i, y); } pos.needsUpdate = true; cigTip.material.color.setHex(Math.random() > 0.5 ? 0xff5a1a : 0xc83a0a); }

    if (state === 'menu') {
      camera.position.x = MENU_CAM.x + Math.sin(now * 0.4) * 0.04; camera.lookAt(MENU_LOOK);
      lampSpot.intensity = 5.0 * (0.78 + Math.random() * 0.24);

    } else if (state === 'dolly') {
      dollyT += dt; const k = MU.smoothstep(dollyT / 1.4, 0, 1);
      camera.position.lerpVectors(dollyFrom, new THREE.Vector3(0.4, 1.2, -9.2), k); camera.fov = MU.lerp(52, 32, k); camera.updateProjectionMatrix(); camera.lookAt(MENU_LOOK);
      lampSpot.intensity = 5.0 * (0.78 + Math.random() * 0.24);
      if (dollyT >= 1.4) { camera.fov = 52; camera.updateProjectionMatrix(); startTaxi(); }

    } else if (state === 'cinematica_taxi') {
      // cámara dentro del taxi
      camera.position.set(taxi.position.x + 0.2, 1.7, taxi.position.z + 3.2); camera.lookAt(taxi.position.x + 0.3, 1.5, taxi.position.z - 1);
      // lluvia cae
      const rpos = rg.attributes.position; for (let i = 0; i < RN; i++) { let y = rpos.getY(i) - dt * 14; if (y < 0) y = 12; rpos.setY(i, y); } rpos.needsUpdate = true;
      // luces que pasan
      for (const pl of passLights) { pl.position.z -= dt * 22; if (pl.position.z < taxi.position.z - 9) pl.position.z = taxi.position.z + 9; }
      // tipeo del subtítulo
      if (!dlgDone) { dlgTimer += dt; if (dlgTimer > 0.028) { dlgTimer = 0; dlgChars = Math.min(dlgFull.length, dlgChars + 1); subsText.textContent = dlgFull.slice(0, dlgChars); if (dlgChars % 2 === 0) blip('type', 0); if (dlgChars >= dlgFull.length) { dlgDone = true; setTimeout(() => { if (state === 'cinematica_taxi' && dlgDone) advanceDialog(); }, 1400); } } }

    } else if (state === 'exploracion_oficina') {
      // movimiento WASD relativo al yaw
      hero.rotation.y = yaw; const sp = 3.0; let mx = 0, mz = 0;
      if (keys['w']) mz += 1; if (keys['s']) mz -= 1; if (keys['a']) mx -= 1; if (keys['d']) mx += 1;
      const moving = mx || mz;
      if (moving) {
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        hero.position.x += (fx * mz + Math.cos(yaw) * mx) * sp * dt;
        hero.position.z += (fz * mz - Math.sin(yaw) * mx) * sp * dt;
        hero.position.x = MU.clamp(hero.position.x, -RX + 1, RX - 1); hero.position.z = MU.clamp(hero.position.z, -RZ + 1, RZ - 1);
        walkPhase += dt * 7; legL.rotation.x = Math.sin(walkPhase) * 0.5; legR.rotation.x = -Math.sin(walkPhase) * 0.5; hero.position.y = Math.abs(Math.sin(walkPhase)) * 0.04;
        stepCD -= dt; if (stepCD <= 0) { blip('splash', MU.clamp(hero.position.x / RX, -1, 1)); stepCD = 0.4; }
      } else { legL.rotation.x = legR.rotation.x = 0; hero.position.y += (0 - hero.position.y) * 0.2; }
      // cámara 3ª persona detrás del héroe
      const cx = hero.position.x - Math.sin(yaw) * 4.5, cz = hero.position.z - Math.cos(yaw) * 4.5;
      camera.position.lerp(tmp.set(cx, 3.0, cz), 0.15);
      camera.lookAt(hero.position.x + Math.sin(yaw) * 3, 1.4, hero.position.z + Math.cos(yaw) * 3);
      // linterna sigue el rumbo + pitch del mouse
      flash.position.set(hero.position.x, 1.7, hero.position.z);
      flash.target.position.set(hero.position.x + Math.sin(yaw) * 6, 1.7 + pitch * 6, hero.position.z + Math.cos(yaw) * 6);

    } else if (state === 'inspeccion') {
      inspectT = Math.min(1, inspectT + dt * 1.5);
      const top = new THREE.Vector3(inspectDesk.position.x, 3.4, inspectDesk.position.z + 0.01);
      camera.position.lerpVectors(inspectFrom, top, MU.smoothstep(inspectT, 0, 1));
      camera.lookAt(inspectDesk.position.x, 1.0, inspectDesk.position.z);
      flash.position.set(inspectDesk.position.x, 4, inspectDesk.position.z); flash.target.position.set(inspectDesk.position.x, 1, inspectDesk.position.z); flash.intensity = 7;
      for (const env of envelopes) { const u = env.userData; u.openT += ((u.open ? 1 : 0) - u.openT) * Math.min(1, dt * 3); u.piv.rotation.x = -2.4 * u.openT; }

    } else if (state === 'ascensor') {
      ascT += dt; const close = MU.clamp(ascT / 1.2, 0, 1);
      grateL.position.x = MU.lerp(-3.6, -1.25, close); grateR.position.x = MU.lerp(3.6, 1.25, close);
      if (ascT > 1.2) { const s = 0.04; camera.position.x += (Math.random() * 2 - 1) * s; camera.position.y += (Math.random() * 2 - 1) * s; for (const bar of extBars) { bar.position.y += dt * 6; if (bar.position.y > RH + 0.5) bar.position.y = -0.5; } ambient.intensity *= (1 - 0.4 * dt); flash.intensity *= (1 - 0.5 * dt); }
      else { camera.position.lerp(tmp.set(hero.position.x, 2.2, hero.position.z - 3), 0.1); camera.lookAt(0, 1.4, 12); }
      if (ascT >= 4.2) { state = 'fin'; setHelp('<b>CAPÍTULO 1 COMPLETO — DESCENSO A NIVEL CERO…</b>'); }

    } else if (state === 'fin') {
      scene.background.lerp(new THREE.Color(0x000000), 0.02);
    }
    renderer.render(scene, camera);
  }
  animate();

  } catch (e) { fail(e); }
})();
