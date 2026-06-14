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
  const FILES = { open: 'open_folder.mp3', close: 'close_folder.mp3' };
  const VOL   = { open: 0.55, close: 0.6 };
  const cache = {};
  let actx = null;

  function element(name) {
    if (cache[name]) return cache[name];
    const a = new Audio(BASE + FILES[name]);
    a.preload = 'auto';
    a.volume = VOL[name];
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

      const isOpen = name === 'open';
      const dur = isOpen ? 0.45 : 0.12;
      const sr = actx.sampleRate;
      const len = Math.floor(sr * dur);
      const buf = actx.createBuffer(1, len, sr);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // papel = decaimiento lento y áspero; clip = transitorio corto y seco
        const env = isOpen ? Math.pow(1 - t, 1.6) * (0.7 + 0.3 * Math.random())
                           : Math.pow(1 - t, 7);
        ch[i] = (Math.random() * 2 - 1) * env;
      }
      const src = actx.createBufferSource(); src.buffer = buf;
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = isOpen ? 1700 : 3200;
      bp.Q.value = isOpen ? 0.6 : 2.2;
      const g = actx.createGain(); g.gain.value = isOpen ? 0.5 : 0.7;
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
    // Manejo de la promesa: si falla (archivo ausente / autoplay), sintetiza.
    if (p && typeof p.catch === 'function') p.catch(() => synth(name));
  }

  return { play };
})();

document.addEventListener('DOMContentLoaded', () => {

  // ── Efecto de escritura en el placeholder del login
  const input = document.querySelector('.code-input');
  if (input) {
    const hints = ['_ _ _ _ - _ _ _ _', 'INGRESE CÓDIGO', ''];
    let h = 0;
    setInterval(() => {
      if (document.activeElement !== input) {
        input.placeholder = hints[h % hints.length];
        h++;
      }
    }, 2200);

    // Formato automático: agrega guión en posición 5
    input.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (val.length > 5) val = val.slice(0, 5) + '-' + val.slice(5, 9);
      e.target.value = val;
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

});
