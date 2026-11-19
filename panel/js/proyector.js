// Modo proyector: solo el nivel actual, enorme, para mostrar en una pantalla grande.

import { $ } from './util.js';
import { t } from './i18n.js';

export function initProyector() {
  const raiz = document.documentElement;
  const btn = $('btn-proyector');
  const salir = $('proy-salir');
  if (!btn || !salir) return { alternar() {}, activo: () => false };

  const activo = () => raiz.dataset.proyector === '1';

  function entrar() {
    // El modo proyector muestra la vista principal
    if (location.hash !== '#activo') { location.hash = '#activo'; }
    raiz.dataset.proyector = '1';
    salir.hidden = false;
    window.scrollTo(0, 0);
    raiz.requestFullscreen?.().catch(() => {});
    btn.setAttribute('aria-pressed', 'true');
    salir.focus({ preventScroll: true });
  }

  function dejar() {
    delete raiz.dataset.proyector;
    salir.hidden = true;
    btn.setAttribute('aria-pressed', 'false');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  const alternar = () => (activo() ? dejar() : entrar());
  btn.addEventListener('click', alternar);
  window.addEventListener('atajo-proyector', alternar);
  salir.addEventListener('click', dejar);
  // Si el usuario sale de pantalla completa con Esc, tambien se sale del modo
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && activo()) dejar(); });
  window.addEventListener('idioma', () => {
    btn.title = `${t('Modo proyector')} (V)`;
  });
  return { alternar, activo };
}
