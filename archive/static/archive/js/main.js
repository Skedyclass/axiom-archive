// AXIOM Archive — efectos de interfaz

/* ══════════════════════════════════════════════════════════════════
   AUDIO DIEGÉTICO — sonidos clandestinos de la mesa
   Intenta reproducir un MP3 local (static/archive/audio/*.mp3). Si el
   archivo no existe o el navegador bloquea la reproducción, sintetiza un
   ruido equivalente con WebAudio (papel al abrir / clic metálico al cerrar),
   de modo que SIEMPRE hay respuesta sonora y nunca se bloquea el hilo.
══════════════════════════════════════════════════════════════════ */
window.AxiomSound = (function () {
  const BASE = window.AXIOM_AUDIO_BASE || '/static/archive/audio/';
  const FILES = { open: 'open_folder.mp3', close: 'close_folder.mp3',
                  type: 'teletype_clack.mp3', relay: 'relay_clack.mp3' };
  const VOL   = { open: 0.55, close: 0.6, type: 0.3, relay: 0.5 };
  // Parámetros del respaldo sintetizado por sonido.
  const SYNTH = {
    open:  { dur: 0.45, freq: 1700, q: 0.6, gain: 0.5, decay: 1.6, rough: true },
    close: { dur: 0.12, freq: 3200, q: 2.2, gain: 0.7, decay: 7 },
    type:  { dur: 0.045, freq: 2600, q: 3.5, gain: 0.35, decay: 9 },  // golpe seco de teletipo
    relay: { dur: 0.11, freq: 1400, q: 1.4, gain: 0.6, decay: 6 },    // golpe metálico de relé
  };
  const cache = {};
  let actx = null;

  function element(name) {
    if (cache[name]) return cache[name];
    const a = new Audio(BASE + FILES[name]);
    a.preload = 'auto';
    a.volume = VOL[name] || 0.5;
    cache[name] = a;
    return a;
  }

  // Respaldo: ráfaga de ruido filtrado (sin assets externos)
  function synth(name) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = actx || new AC();
      if (actx.state === 'suspended') actx.resume();

      const cfg = SYNTH[name] || SYNTH.close;
      const sr = actx.sampleRate;
      const len = Math.floor(sr * cfg.dur);
      const buf = actx.createBuffer(1, len, sr);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const env = Math.pow(1 - t, cfg.decay) * (cfg.rough ? (0.7 + 0.3 * Math.random()) : 1);
        ch[i] = (Math.random() * 2 - 1) * env;
      }
      const src = actx.createBufferSource(); src.buffer = buf;
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = cfg.freq; bp.Q.value = cfg.q;
      const g = actx.createGain(); g.gain.value = cfg.gain;
      src.connect(bp); bp.connect(g); g.connect(actx.destination);
      src.start();
    } catch (_) { /* sin audio disponible: silencioso */ }
  }

  function play(name) {
    if (!FILES[name]) return;
    let a;
    try { a = element(name); a.currentTime = 0; } catch (_) { return synth(name); }
    let p;
    try { p = a.play(); } catch (_) { return synth(name); }
    if (p && typeof p.catch === 'function') p.catch(() => synth(name));
  }

  return { play };
})();

/* ══════════════════════════════════════════════════════════════════
   TELETIPO — tira de papel continuo que imprime carácter a carácter
   con golpes metálicos. Uso: AxiomTeletype.print('MENSAJE').
══════════════════════════════════════════════════════════════════ */
window.AxiomTeletype = (function () {
  let strip, line, timer;
  function ensure() {
    if (strip) return;
    strip = document.createElement('div');
    strip.className = 'axiom-teletype';
    strip.setAttribute('aria-live', 'polite');
    line = document.createElement('span');
    line.className = 'axiom-teletype-line';
    strip.appendChild(line);
    (document.body || document.documentElement).appendChild(strip);
  }
  function print(text) {
    ensure();
    clearTimeout(timer);
    strip.classList.add('is-on');
    const full = '» ' + String(text == null ? '' : text);
    let i = 0; line.textContent = '';
    (function step() {
      if (i < full.length) {
        const c = full[i];
        line.textContent += c;
        if (c !== ' ' && (i % 2 === 0) && window.AxiomSound) window.AxiomSound.play('type');
        i++; timer = setTimeout(step, 28);
      } else {
        timer = setTimeout(() => strip.classList.remove('is-on'), 4500);
      }
    })();
  }
  return { print };
})();

/* ══════════════════════════════════════════════════════════════════
   OSCILOSCOPIO — onda verde rústica renderizada en <canvas> (GPU-friendly).
   Uso: AxiomScope.start() / .stop() / .toggle().
══════════════════════════════════════════════════════════════════ */
window.AxiomScope = (function () {
  let cv, ctx, raf, running = false, t = 0;
  function ensure() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.className = 'axiom-scope';
    cv.width = 600; cv.height = 90;
    (document.body || document.documentElement).appendChild(cv);
    ctx = cv.getContext('2d');
  }
  function frame() {
    t += 0.09;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = 'rgba(0,255,0,0.12)'; ctx.lineWidth = 1;
    for (let x = 0; x <= cv.width; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, cv.height / 2); ctx.lineTo(cv.width, cv.height / 2); ctx.stroke();
    ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2; ctx.shadowColor = '#00ff00'; ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let x = 0; x <= cv.width; x++) {
      const n = Math.sin(x * 0.05 + t) * 0.5 + Math.sin(x * 0.13 + t * 1.7) * 0.28 + (Math.random() * 2 - 1) * 0.18;
      const y = cv.height / 2 + n * (cv.height * 0.36);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    raf = requestAnimationFrame(frame);
  }
  function start() { ensure(); if (running) return true; running = true; cv.classList.add('is-on'); frame(); return true; }
  function stop()  { running = false; if (raf) cancelAnimationFrame(raf); if (cv) cv.classList.remove('is-on'); return false; }
  function toggle() { return running ? stop() : start(); }
  return { start, stop, toggle, isRunning: () => running };
})();

/* ══════════════════════════════════════════════════════════════════
   CARGADOR ELECTROMECÁNICO — congela la máquina con relés y tubos.
   Uso:  await AxiomLoader.run({ label, ms })   // devuelve Promise
   Se usa en acciones con peso (login, abrir, guardar, pasar página).
══════════════════════════════════════════════════════════════════ */
window.AxiomLoader = (function () {
  const LABELS = [
    '[ PROCESANDO RELEVADORES... ]',
    '[ ENGRANANDO DISCOS MECÁNICOS... ]',
    '[ CALENTANDO TUBOS DE VACÍO... ]',
    '[ ALINEANDO ENGRANAJES DE LATÓN... ]',
  ];
  let clackTimer, barTimer, hideTimer;

  function run(opts) {
    opts = opts || {};
    const overlay = document.getElementById('ax-loader');
    if (!overlay) return Promise.resolve();      // sin overlay: no bloquea
    const labelEl = document.getElementById('ax-loader-label');
    const fillEl = document.getElementById('ax-loader-fill');
    const ms = opts.ms || (1700 + Math.floor(Math.random() * 700));   // ~1.7–2.4 s
    labelEl.textContent = opts.label || LABELS[Math.floor(Math.random() * LABELS.length)];

    clearInterval(clackTimer); clearInterval(barTimer); clearTimeout(hideTimer);
    overlay.hidden = false;
    // forzar reflow para reiniciar la barra
    fillEl.style.transition = 'none'; fillEl.style.width = '0%'; void fillEl.offsetWidth;
    fillEl.style.transition = 'width 0.18s steps(4)';

    // sonido de relés repetido durante el ciclo
    if (window.AxiomSound) {
      window.AxiomSound.play('relay');
      clackTimer = setInterval(() => window.AxiomSound.play('relay'), 360);
    }
    // barra tosca a saltos
    let pct = 0;
    barTimer = setInterval(() => {
      pct = Math.min(100, pct + (8 + Math.random() * 22));
      fillEl.style.width = pct + '%';
    }, Math.max(120, ms / 9));

    return new Promise((resolve) => {
      hideTimer = setTimeout(() => {
        clearInterval(clackTimer); clearInterval(barTimer);
        fillEl.style.width = '100%';
        overlay.hidden = true;
        resolve();
      }, ms);
    });
  }
  return { run };
})();

document.addEventListener('DOMContentLoaded', () => {

  // ── Efecto de escritura en el placeholder del login
  const input = document.querySelector('.code-input');
  if (input) {
    const hints = ['AXIOM-1920-_____', 'INGRESE CLAVE DE AGENTE', ''];
    let h = 0;
    setInterval(() => {
      if (document.activeElement !== input) {
        input.placeholder = hints[h % hints.length];
        h++;
      }
    }, 2200);

    // Solo mayúsculas; se permiten letras, números y guiones (claves largas).
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
    });

    // Accionar relés: el envío del login pasa por el cargador mecánico.
    const form = input.closest('form');
    if (form) form.addEventListener('submit', (e) => {
      if (form.dataset.relayed) return;        // segunda pasada: envío real
      e.preventDefault();
      const go = () => { form.dataset.relayed = '1'; form.submit(); };
      if (window.AxiomLoader) window.AxiomLoader.run({ label: '[ ACCIONANDO RELÉS DE ACCESO... ]' }).then(go);
      else go();
    });
  }

  // ── Efecto glitch en el logo del login
  const logo = document.querySelector('.login-logo');
  if (logo) {
    const originalText = logo.textContent;
    const glitchChars = '█▓▒░';
    let glitchTimeout;

    const glitch = () => {
      if (Math.random() > 0.7) {
        const pos = Math.floor(Math.random() * originalText.length);
        const arr = originalText.split('');
        arr[pos] = glitchChars[Math.floor(Math.random() * glitchChars.length)];
        logo.textContent = arr.join('');
        setTimeout(() => { logo.textContent = originalText; }, 80);
      }
      glitchTimeout = setTimeout(glitch, 800 + Math.random() * 2000);
    };
    glitch();
  }

  // ── Reloj del sistema en la barra (formato terminal, tick por segundo)
  const meta = document.querySelector('.archive-meta');
  if (meta) {
    const accessEl = meta.querySelector('.access-time');
    if (accessEl) {
      const tick = () => {
        const n = new Date();
        accessEl.textContent =
          `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`;
      };
      tick();
      setInterval(tick, 1000);
    }
  }

  // Sin animaciones de entrada ni transiciones de hover:
  // la estación es cruda y directa. El estilo de hover lo maneja el CSS.

  // ── Desgaste por calor de la lámpara del proyector ──
  // Tras 3 min sin actividad, la página activa se "quema" (sepia). Cualquier
  // movimiento del cursor activa el "enfriamiento" y recupera el tono.
  let lampTimer;
  const heatUp = () => document.body.classList.add('lamp-hot');
  const coolDown = () => {
    document.body.classList.remove('lamp-hot');
    clearTimeout(lampTimer);
    lampTimer = setTimeout(heatUp, 180000);   // 3 minutos
  };
  ['mousemove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(
    (ev) => window.addEventListener(ev, coolDown, { passive: true }));
  coolDown();

});
