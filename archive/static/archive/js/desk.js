/* ══════════════════════════════════════════════════════════════════
   AXIOM — MESA DE INVESTIGACIÓN 3D (Three.js / WebGL)
   Base experimental. NO toca el backend ni la UI 2D.
   · Escritorio con MeshStandardMaterial + SpotLight cenital + sombras.
   · Parallax de cámara acoplado al cursor.
   · Sobres manila 3D (uno por folio del agente) que se abren al hacer clic.
   · Arrastre con inercia y asentamiento sobre la mesa.
   · Doble clic → inspección flotante con rotación libre en 3 ejes.
   · Audio con paneo estéreo según la posición en pantalla + zumbido de lámpara.
══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

(() => {
  const canvas = document.getElementById('desk-canvas');
  const fallback = document.getElementById('desk-fallback');
  if (!canvas) return;
  const fail = (e) => { console.error('[AXIOM 3D]', e); if (fallback) fallback.style.display = 'flex'; };

  try {

  // ── Datos del agente (mismo localStorage namespaced) ──────────────
  const AGENT = window.AXIOM_AGENT_ID || 'GUEST';
  const ARCHIVE_KEY = 'axiom_archive_1920_' + AGENT;
  const authorized = JSON.parse(document.getElementById('desk-folios').textContent || '[]');
  let archive = {};
  try { archive = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '{}'); } catch (_) {}

  // ── Renderer / escena / cámara ────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  window.__axiomDeskOK = true;   // señal: Three.js cargó y la escena arrancó
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050506);
  scene.fog = new THREE.Fog(0x050506, 20, 40);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  const CAM_BASE = new THREE.Vector3(0, 8, 9);
  camera.position.copy(CAM_BASE);
  camera.lookAt(0, 0, 0);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  // ── Iluminación cinematográfica ───────────────────────────────────
  scene.add(new THREE.AmbientLight(0x3a3326, 0.35));
  // SpotLight cenital (decay 0 = brillo predecible, sin caída física)
  const spot = new THREE.SpotLight(0xffe8c0, 3.4, 0, Math.PI / 6.2, 0.65, 0);
  spot.position.set(0, 13, 3.5);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.camera.near = 1; spot.shadow.camera.far = 40;
  spot.shadow.bias = -0.0004;
  scene.add(spot); scene.add(spot.target);
  const fill = new THREE.DirectionalLight(0x556070, 0.22);
  fill.position.set(-7, 7, -5); scene.add(fill);
  // bombilla visible
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
  bulb.position.copy(spot.position); bulb.position.y -= 0.4; scene.add(bulb);

  // ── Escritorio ────────────────────────────────────────────────────
  function woodTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#5e3f23'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 150; i++) {
      x.strokeStyle = `rgba(${30 + Math.random() * 40},${20 + Math.random() * 25},${8 + Math.random() * 14},${0.12 + Math.random() * 0.2})`;
      x.lineWidth = 1 + Math.random() * 2;
      const y = Math.random() * 512;
      x.beginPath(); x.moveTo(0, y);
      x.bezierCurveTo(170, y + (Math.random() * 18 - 9), 340, y + (Math.random() * 18 - 9), 512, y);
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1.5);
    return t;
  }
  const deskMat = new THREE.MeshStandardMaterial({ map: woodTexture(), color: 0x7a5230, roughness: 0.82, metalness: 0.06 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(44, 1, 30), deskMat);
  desk.position.y = -0.5; desk.receiveShadow = true; scene.add(desk);
  const DESK_TOP = 0;

  // ── Texto en lienzo → textura (etiqueta del sobre) ────────────────
  function wrap(ctx, text, x, y, max, lh) {
    const words = String(text).split(' '); let line = '', yy = y;
    for (const w of words) {
      if (ctx.measureText(line + w).width > max && line) { ctx.fillText(line, x, yy); line = w + ' '; yy += lh; }
      else line += w + ' ';
    }
    ctx.fillText(line, x, yy);
  }
  function labelTexture(folio) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 360;
    const x = c.getContext('2d');
    x.fillStyle = '#c9b27c'; x.fillRect(0, 0, 512, 360);
    x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 8; x.strokeRect(10, 10, 492, 340);
    x.fillStyle = '#2a1c0c'; x.font = 'bold 38px "Courier New", monospace';
    x.fillText('MINISTRY OF DEFENCE', 28, 70);
    x.fillStyle = '#8a1414'; x.font = 'bold 30px "Courier New", monospace';
    x.fillText('RESTRICTED', 28, 118);
    x.strokeStyle = '#a01818'; x.lineWidth = 4; x.strokeRect(28, 150, 280, 60);
    x.fillStyle = '#a01818'; x.font = 'bold 36px "Courier New", monospace';
    x.fillText(folio.id || 'EXPED', 42, 194);
    x.fillStyle = '#2a2418'; x.font = '24px "Courier New", monospace';
    wrap(x, (folio.title || 'EXPEDIENTE').toUpperCase(), 28, 262, 456, 30);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  // ── Sobres manila (uno por folio) ─────────────────────────────────
  const MANILA = 0xccb27a;
  const envelopes = [];
  const pickables = [];

  function makeEnvelope(folio, i, n) {
    const g = new THREE.Group();
    const W = 3.0, H = 0.14, D = 4.0;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(W, H, D),
      new THREE.MeshStandardMaterial({ color: MANILA, roughness: 0.93, metalness: 0.02 }));
    base.castShadow = true; base.receiveShadow = true; g.add(base);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 0.95, D * 0.95),
      new THREE.MeshStandardMaterial({ map: labelTexture(folio), roughness: 0.96 }));
    label.rotation.x = -Math.PI / 2; label.position.y = H / 2 + 0.003; g.add(label);

    // Solapa con bisagra en el borde trasero (z = -D/2)
    const flapPivot = new THREE.Group();
    flapPivot.position.set(0, H / 2, -D / 2); g.add(flapPivot);
    const flap = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.05, D * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xbfa66f, roughness: 0.9 }));
    flap.position.set(0, 0, D * 0.5 / 2); flap.castShadow = true; flapPivot.add(flap);

    const restY = DESK_TOP + H / 2;
    g.position.set((i - (n - 1) / 2) * 3.7, restY, (i % 2 ? 0.5 : -0.5));
    g.rotation.y = Math.random() * 0.18 - 0.09;
    g.userData = {
      folio, flapPivot, open: false, openT: 0,
      vel: new THREE.Vector3(), settling: false, restY,
      home: null,
    };
    [base, label, flap].forEach((m) => { m.userData.env = g; pickables.push(m); });
    envelopes.push(g); scene.add(g);
  }

  // Construir desde la lista autorizada (o, en su defecto, lo que haya local)
  const list = authorized.length ? authorized : Object.values(archive).map((f) => ({ id: f.id, title: f.title }));
  list.forEach((f, i) => makeEnvelope(Object.assign({}, f, archive[f.id] || {}), i, list.length || 1));

  // ── Audio (paneo estéreo por posición) ────────────────────────────
  let actx = null, master = null;
  function audioResume() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
      // zumbido de lámpara (transformador de alta tensión)
      const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58;
      const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 130;
      const g = actx.createGain(); g.gain.value = 0.05;
      o.connect(f); f.connect(g); g.connect(master); o.start();
    } catch (_) {}
  }
  function blip(kind, panX) {
    if (!actx) return;
    try {
      const dur = kind === 'thud' ? 0.2 : kind === 'drag' ? 0.12 : 0.08;
      const sr = actx.sampleRate, len = Math.floor(sr * dur);
      const b = actx.createBuffer(1, len, sr); const d = b.getChannelData(0);
      const decay = kind === 'thud' ? 4 : kind === 'drag' ? 2 : 9;
      for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay); }
      const src = actx.createBufferSource(); src.buffer = b;
      const bp = actx.createBiquadFilter();
      bp.type = kind === 'thud' ? 'lowpass' : 'bandpass';
      bp.frequency.value = kind === 'thud' ? 220 : kind === 'clip' ? 3400 : 950;
      const pan = actx.createStereoPanner(); pan.pan.value = THREE.MathUtils.clamp(panX, -1, 1);
      const g = actx.createGain(); g.gain.value = kind === 'thud' ? 0.6 : 0.4;
      src.connect(bp); bp.connect(pan); pan.connect(g); g.connect(master); src.start();
    } catch (_) {}
  }
  const screenX = (obj) => { const v = obj.position.clone().project(camera); return THREE.MathUtils.clamp(v.x, -1, 1); };

  // ── Picking e interacción ─────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(DESK_TOP + 0.06));
  const tmp = new THREE.Vector3();
  const INSPECT_POS = new THREE.Vector3(0, 3.4, 5.2);

  let hovered = null, dragging = null, inspecting = null, rotating = false;
  let down = false, moved = false, downXY = null, lastXY = null, lastT = 0;
  let clickTimer = null;
  const parallax = new THREE.Vector2(0, 0);
  const dragOffset = new THREE.Vector3();

  function setPointer(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }
  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    return hits.length ? hits[0].object.userData.env : null;
  }
  function setHover(env) {
    if (hovered === env) return;
    if (hovered) hovered.children[0].material.emissive.setHex(0x000000);
    hovered = env;
    if (hovered) { hovered.children[0].material.emissive.setHex(0x332a10); }
    canvas.style.cursor = env ? 'grab' : 'default';
  }
  function toggleOpen(env) {
    env.userData.open = !env.userData.open;
    blip('clip', screenX(env));
  }
  function enterInspect(env) {
    inspecting = env;
    env.userData.home = { p: env.position.clone(), q: env.quaternion.clone() };
    env.userData.open = true;
    blip('drag', screenX(env));
  }
  function exitInspect() {
    if (!inspecting) return;
    const env = inspecting; inspecting = null; rotating = false;
    env.userData.returning = true;   // el loop lo devuelve a casa
  }

  canvas.addEventListener('pointerdown', (e) => {
    setPointer(e); audioResume();
    down = true; moved = false; downXY = { x: e.clientX, y: e.clientY };
    lastXY = { x: e.clientX, y: e.clientY }; lastT = performance.now();
    if (inspecting) { rotating = true; return; }
    const env = pick();
    if (env) {
      dragging = env; dragging.userData.settling = false; dragging.userData.vel.set(0, 0, 0);
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(dragPlane, tmp)) dragOffset.copy(env.position).sub(tmp);
      canvas.style.cursor = 'grabbing';
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    setPointer(e);
    parallax.x = (e.clientX / window.innerWidth - 0.5);
    parallax.y = (e.clientY / window.innerHeight - 0.5);
    if (Math.hypot(e.clientX - (downXY ? downXY.x : e.clientX), e.clientY - (downXY ? downXY.y : e.clientY)) > 5) moved = true;

    if (inspecting && rotating) {
      const dx = e.clientX - lastXY.x, dy = e.clientY - lastXY.y;
      inspecting.rotateY(dx * 0.01); inspecting.rotateX(dy * 0.01);
      lastXY = { x: e.clientX, y: e.clientY }; return;
    }
    if (dragging) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(dragPlane, tmp)) {
        const np = tmp.add(dragOffset); np.y = dragging.userData.restY + 0.6;  // levantado al arrastrar
        const now = performance.now(), dt = Math.max(16, now - lastT) / 1000;
        dragging.userData.vel.copy(np).sub(dragging.position).multiplyScalar(1 / dt);
        dragging.position.copy(np); lastT = now;
        // inclinación por inercia
        dragging.rotation.z = THREE.MathUtils.clamp(-dragging.userData.vel.x * 0.03, -0.3, 0.3);
        dragging.rotation.x = THREE.MathUtils.clamp(dragging.userData.vel.z * 0.03, -0.3, 0.3);
      }
    } else if (!inspecting) {
      setHover(pick());
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (dragging) {
      const env = dragging; dragging = null;
      env.userData.settling = true;       // el loop aplica inercia + asienta
      blip('drag', screenX(env));
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      canvas.style.cursor = 'grab';
    }
    if (inspecting) rotating = false;
    down = false;
  });

  // clic (abrir) vs doble clic (inspeccionar): retardo de desambiguación
  canvas.addEventListener('click', (e) => {
    if (moved || inspecting) return;
    setPointer(e); const env = pick(); if (!env) { if (inspecting) exitInspect(); return; }
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => toggleOpen(env), 240);
  });
  canvas.addEventListener('dblclick', (e) => {
    clearTimeout(clickTimer);
    if (inspecting) return;
    setPointer(e); const env = pick(); if (env) enterInspect(env);
  });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') exitInspect(); });

  // ── Bucle de animación ────────────────────────────────────────────
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());

    // Parallax de cámara (desactivado durante inspección)
    if (!inspecting) {
      tmp.set(CAM_BASE.x + parallax.x * 1.6, CAM_BASE.y - parallax.y * 1.0, CAM_BASE.z);
      camera.position.lerp(tmp, 0.06);
      camera.lookAt(0, 0, 0);
    }

    for (const env of envelopes) {
      const u = env.userData;
      // apertura de solapa (interpolación suave ~0.8s)
      u.openT += ((u.open ? 1 : 0) - u.openT) * Math.min(1, dt * 4);
      u.flapPivot.rotation.x = -2.35 * u.openT;

      if (u === inspecting) {
        env.position.lerp(INSPECT_POS, 0.12);
      } else if (u.returning && u.home) {
        env.position.lerp(u.home.p, 0.14);
        env.quaternion.slerp(u.home.q, 0.14);
        if (env.position.distanceTo(u.home.p) < 0.02) { env.position.copy(u.home.p); env.quaternion.copy(u.home.q); u.returning = false; }
      } else if (u.settling) {
        env.position.addScaledVector(u.vel, dt);
        u.vel.multiplyScalar(0.86);
        env.position.x = THREE.MathUtils.clamp(env.position.x, -10, 10);
        env.position.z = THREE.MathUtils.clamp(env.position.z, -6.5, 6.5);
        env.position.y += (u.restY - env.position.y) * 0.2;
        env.rotation.z += (0 - env.rotation.z) * 0.18;
        env.rotation.x += (0 - env.rotation.x) * 0.18;
        if (u.vel.length() < 0.05 && Math.abs(env.position.y - u.restY) < 0.01) {
          u.settling = false; u.vel.set(0, 0, 0);
          env.position.y = u.restY; blip('thud', screenX(env));
        }
      } else if (u !== dragging) {
        env.position.y += (u.restY - env.position.y) * 0.2;  // reposo
      }
    }
    renderer.render(scene, camera);
  }
  animate();

  } catch (e) { fail(e); }
})();
