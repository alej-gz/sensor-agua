// Mantiene la pantalla encendida mientras haga falta (transmitiendo en vivo o en modo proyector).
// Usa la API estandar Screen Wake Lock. El navegador la suelta solo cuando la pestana se oculta;
// aqui se vuelve a pedir en cuanto vuelve a verse.

const razones = new Set();
let sentinela = null;
const raiz = document.documentElement;

export const soportado = 'wakeLock' in navigator;

function marcar(activa) {
  if (activa) raiz.dataset.pantalla = 'activa'; else delete raiz.dataset.pantalla;
}

async function adquirir() {
  if (!soportado || sentinela || !razones.size || document.visibilityState !== 'visible') return;
  try {
    const s = await navigator.wakeLock.request('screen');
    sentinela = s;
    marcar(true);
    s.addEventListener('release', () => {
      if (sentinela === s) { sentinela = null; marcar(false); }
    });
    // Si mientras tanto dejo de hacer falta, se suelta de inmediato
    if (!razones.size) soltar();
  } catch {
    sentinela = null;
    marcar(false);
  }
}

async function soltar() {
  const s = sentinela;
  sentinela = null;
  marcar(false);
  if (s) { try { await s.release(); } catch { /* ya liberado */ } }
}

// pantallaActiva('transmision', true) la pide; pantallaActiva('transmision', false) la deja de pedir
export function pantallaActiva(razon, si) {
  if (si) razones.add(razon); else razones.delete(razon);
  if (razones.size) adquirir(); else soltar();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') adquirir();
});
