// Aviso en el navegador cuando el sensor llega al nivel 4 o 5 (notificacion, vibracion y titulo de la pestana).

import { $, NOMBRES_NIVEL, almacen } from './util.js';
import { t } from './i18n.js';

const CLAVE = 'sensorAgua.avisos';
const UMBRAL_NIVEL = 4;
const ENFRIAMIENTO_MS = 20000;   // no repetir el aviso en menos de 20 s

export function initAlertas(store, avisar) {
  const opt = $('opt-notify');
  if (!opt) return;
  let previo = 0;
  let ultimo = 0;
  let tituloOriginal = document.title;
  let parpadeo = null;

  const soportado = 'Notification' in window;
  opt.checked = almacen.leer(CLAVE, false) && soportado && Notification.permission === 'granted';

  opt.addEventListener('change', async () => {
    if (!opt.checked) {
      almacen.guardar(CLAVE, false);
      avisar(t('Avisos desactivados'), '', 3000);
      return;
    }
    if (!soportado) {
      opt.checked = false;
      avisar(t('Tu navegador no permite notificaciones.'), 'error', 6000);
      return;
    }
    let permiso = Notification.permission;
    if (permiso === 'default') permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      opt.checked = false;
      avisar(t('Permiso denegado. Actívalo en la configuración del navegador.'), 'error', 7000);
      return;
    }
    almacen.guardar(CLAVE, true);
    avisar(t('Avisos activados'), '', 3000);
  });

  function pararParpadeo() {
    if (parpadeo) { clearInterval(parpadeo); parpadeo = null; document.title = tituloOriginal; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pararParpadeo(); });

  function lanzar(nivel) {
    const nombre = NOMBRES_NIVEL[nivel] ?? '';
    const titulo = `${t('Nivel')} ${nivel} · ${nombre}`;
    try { navigator.vibrate?.([220, 90, 220]); } catch { /* sin vibracion */ }
    if (opt.checked && soportado && Notification.permission === 'granted') {
      try {
        new Notification(titulo, { body: t('Vibración fuerte detectada'), icon: 'icon-192.png', tag: 'sensor-agua' });
      } catch { /* algunos moviles exigen service worker: queda el aviso en pantalla */ }
    }
    if (document.hidden && !parpadeo) {
      tituloOriginal = document.title;
      let alterna = false;
      parpadeo = setInterval(() => { document.title = alterna ? tituloOriginal : `⚠ ${titulo}`; alterna = !alterna; }, 900);
    }
  }

  store.addEventListener('sample', () => {
    const n = store.actual?.nivel ?? 0;
    if (opt.checked && n >= UMBRAL_NIVEL && previo < UMBRAL_NIVEL && Date.now() - ultimo > ENFRIAMIENTO_MS) {
      ultimo = Date.now();
      lanzar(n);
    }
    previo = n;
  });
  store.addEventListener('reset', () => { previo = 0; });
}
