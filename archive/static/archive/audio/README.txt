AXIOM ARCHIVE — Audio diegético
================================

Coloca aquí dos archivos de sonido para la apertura/cierre del expediente:

  open_folder.mp3    → papel rascando / carpeta abriéndose (~0.4–0.6 s)
  close_folder.mp3   → clic seco de plástico/metal del clip (~0.1–0.2 s)
  teletype_clack.mp3 → golpe metálico seco de teletipo (~0.05 s, se repite por carácter)

El reproductor está en static/archive/js/main.js (window.AxiomSound).

Comportamiento:
  · Si el MP3 existe, se reproduce al INSPECCIONAR / CERRAR.
  · Si falta el archivo o el navegador bloquea la reproducción, main.js
    SINTETIZA un sonido equivalente con WebAudio (ruido filtrado), de modo
    que la interfaz nunca queda muda ni se bloquea.

Por lo tanto los .mp3 son OPCIONALES: mejoran el realismo, pero sin ellos
la experiencia sigue teniendo respuesta sonora.

Sugerencias de fuentes libres: freesound.org (busca "paper rustle",
"folder open", "plastic click"), exporta a MP3 y respeta estos nombres.
