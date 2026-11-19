// App instalable (PWA) y opciones de accesibilidad / rendimiento.
// Se importa primero en main.js para que las preferencias se apliquen antes de dibujar nada.

const CLAVE_A11Y = 'sensorAgua.a11y';
const raiz = document.documentElement;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- Accesibilidad
function leerPrefs() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_A11Y) || 'null');
    if (g && typeof g === 'object') return g;
  } catch { /* sin almacenamiento */ }
  return null;
}

// Sin preferencia guardada: se decide segun el dispositivo
function prefsPorDefecto() {
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const conexion = navigator.connection;
  const modesto = (navigator.deviceMemory && navigator.deviceMemory <= 2)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
    || conexion?.saveData === true;
  return { particulas: reducido || modesto, anim: reducido, texto: false };
}

const prefs = { ...prefsPorDefecto(), ...(leerPrefs() || {}) };

function aplicarPrefs() {
  raiz.toggleAttribute('data-sin-particulas', !!prefs.particulas);
  raiz.toggleAttribute('data-sin-anim', !!prefs.anim);
  raiz.toggleAttribute('data-texto-grande', !!prefs.texto);
  window.dispatchEvent(new Event('a11y'));
}
function guardarPrefs() {
  try { localStorage.setItem(CLAVE_A11Y, JSON.stringify(prefs)); } catch { /* sin almacenamiento */ }
}
aplicarPrefs();

function iniciarPanel() {
  const btn = $('btn-a11y');
  const panel = $('a11y-panel');
  if (!btn || !panel) return;

  const mapa = { 'a11y-particulas': 'particulas', 'a11y-anim': 'anim', 'a11y-texto': 'texto' };
  Object.entries(mapa).forEach(([id, clave]) => {
    const el = $(id);
    el.checked = !!prefs[clave];
    el.addEventListener('change', () => {
      prefs[clave] = el.checked;
      guardarPrefs();
      aplicarPrefs();
    });
  });

  const abrir = (si) => {
    panel.hidden = !si;
    btn.setAttribute('aria-expanded', String(si));
    if (si) $('a11y-particulas').focus();
  };
  btn.addEventListener('click', () => abrir(panel.hidden));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { abrir(false); btn.focus(); } });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) abrir(false);
  });
}

// ---------------------------------------------------------------- Menu del celular
function iniciarMenu() {
  const barra = document.querySelector('.topbar');
  const btn = $('btn-menu');
  if (!barra || !btn) return;
  const abrir = (si) => {
    barra.classList.toggle('menu-open', si);
    btn.setAttribute('aria-expanded', String(si));
  };
  btn.addEventListener('click', () => abrir(!barra.classList.contains('menu-open')));
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => window.scrollTo({ top: 0 })));
  // Al elegir una opcion del menu, se cierra para que se vea el resultado
  barra.addEventListener('click', (e) => {
    const b = e.target.closest('button, a');
    if (b && b !== btn && barra.classList.contains('menu-open') && b.closest('.tabs, .conn')) setTimeout(() => abrir(false), 60);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && barra.classList.contains('menu-open')) { abrir(false); btn.focus(); } });
  document.addEventListener('click', (e) => { if (barra.classList.contains('menu-open') && !barra.contains(e.target)) abrir(false); });
  // Al pasar a escritorio el menu vuelve a su estado normal
  matchMedia('(min-width: 761px)').addEventListener('change', (m) => { if (m.matches) abrir(false); });
}

// ---------------------------------------------------------------- App instalable
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let eventoInstalar = null;

function iniciarInstalacion() {
  const btn = $('btn-install');
  if (!btn) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const dlgIos = $('ios-dialog');

  if (standalone()) { btn.hidden = true; return; }

  // Android / escritorio (Chrome, Edge)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalar = e;
    btn.hidden = false;
  });
  window.addEventListener('appinstalled', () => { eventoInstalar = null; btn.hidden = true; });

  // iPhone / iPad: no hay boton automatico, se explica el camino manual
  if (ios) btn.hidden = false;

  btn.addEventListener('click', async () => {
    if (eventoInstalar) {
      eventoInstalar.prompt();
      try { await eventoInstalar.userChoice; } catch { /* cancelado */ }
      eventoInstalar = null;
      btn.hidden = true;
    } else if (ios && dlgIos) {
      if (typeof dlgIos.showModal === 'function') dlgIos.showModal(); else dlgIos.setAttribute('open', '');
    }
  });
  dlgIos?.addEventListener('click', (e) => { if (e.target === dlgIos) dlgIos.close(); });
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const seguro = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!seguro) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(() => { raiz.dataset.sw = 'ok'; }).catch(() => {});
  });
}

if (/Electron/i.test(navigator.userAgent)) document.addEventListener('DOMContentLoaded', () => $('pie-descarga')?.setAttribute('hidden', ''));

let arrancado = false;
function arrancar() {
  if (arrancado) return;
  arrancado = true;
  iniciarMenu();
  iniciarPanel();
  iniciarInstalacion();
}
document.addEventListener('DOMContentLoaded', arrancar);
if (document.readyState !== 'loading') arrancar();
registrarServiceWorker();
