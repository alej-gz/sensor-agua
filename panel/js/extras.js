import { alternarIdioma } from './i18n.js';

// Detalles de la pagina personal: 3 temas, reproductor con lista (saltar, volumen, barra), particulas y atajos.

const BLOB = 'https://tiq98qw41ktboeja.public.blob.vercel-storage.com/audio/';

// Lista de canciones: la del tema activo suena por defecto, pero se puede saltar a cualquiera
const PISTAS = [
  { nombre: 'such a funny way', url: BLOB + 'such-a-funny-way.mp3' },
  { nombre: "couldn't make it harder", url: BLOB + 'cmih.mp3' },
  { nombre: 'garden', url: BLOB + 'garden.mp3' },
];

const TEMAS = [
  { id: 'dog', emoji: '🐾', titulo: "Man's Best Friend", meta: '#1A0A0A', pista: 0, simbolos: ['🐾', '✧', '·'] },
  { id: 'cmih', emoji: '☕', titulo: "Short n' Sweet", meta: '#0D2030', pista: 1, simbolos: ['☕', '✧', '♡'] },
  { id: 'default', emoji: '✉️', titulo: "Emails I Can't Send", meta: '#FFF5F5', pista: 2, simbolos: ['❤', '♥', '♡', '✧', '❀'] },
];

const CLAVE = 'sensorAgua.tema';
const CLAVE_VOL = 'sensorAgua.volumen';
const $ = (id) => document.getElementById(id);

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

const audio = $('pl-audio');
const btnPlay = $('pl-btn');
const ico = $('pl-ico');
const seek = $('pl-seek');
const vol = $('pl-vol');
const PLAY = '<path d="M8 5v14l11-7z"/>';
const PAUSA = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';

let actual = TEMAS[0];
let indice = 0;          // cancion cargada
let arrastrando = false;

// ---------- Particulas ----------
function particulas() {
  const cont = $('particulas');
  cont.textContent = '';
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('span');
    s.textContent = actual.simbolos[Math.floor(Math.random() * actual.simbolos.length)];
    s.style.left = `${Math.random() * 100}%`;
    s.style.fontSize = `${14 + Math.random() * 18}px`;
    s.style.animationDelay = `${-Math.random() * 24}s`;
    s.style.animationDuration = `${14 + Math.random() * 14}s`;
    s.style.setProperty('--op', (0.12 + Math.random() * 0.2).toFixed(2));
    s.style.setProperty('--dx', `${Math.round(-30 + Math.random() * 60)}px`);
    cont.appendChild(s);
  }
}

// ---------- Reproductor ----------
const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

function pintarEstado() {
  const suena = !audio.paused;
  ico.innerHTML = suena ? PAUSA : PLAY;
  btnPlay.setAttribute('aria-label', suena ? 'Pausar' : 'Reproducir');
  $('pl-kicker').textContent = suena ? 'now playing...' : 'paused';
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = suena ? 'playing' : 'paused';
}

function pintarPista() {
  const p = PISTAS[indice];
  $('pl-title').textContent = p.nombre;
  $('pl-num').textContent = `${indice + 1}/${PISTAS.length}`;
  seek.value = 0;
  $('pl-time').textContent = '0:00';
  if ('mediaSession' in navigator && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: p.nombre, artist: 'Indicador de temblores · USFX' });
  }
}

function cargar(i, reproducir) {
  indice = (i + PISTAS.length) % PISTAS.length;
  audio.src = PISTAS[indice].url;
  audio.currentTime = 0;
  pintarPista();
  if (reproducir) audio.play().catch(() => {});
  pintarEstado();
}

function alternar() {
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}
function siguiente() { cargar(indice + 1, !audio.paused); }
function anterior() {
  // Como en cualquier reproductor: si ya avanzo, reinicia; si no, va a la anterior
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  cargar(indice - 1, !audio.paused);
}

btnPlay.addEventListener('click', alternar);
$('pl-next').addEventListener('click', siguiente);
$('pl-prev').addEventListener('click', anterior);
audio.addEventListener('play', pintarEstado);
audio.addEventListener('pause', pintarEstado);
audio.addEventListener('ended', () => cargar(indice + 1, true));   // sigue con la lista
audio.addEventListener('timeupdate', () => {
  if (!arrastrando && audio.duration > 0) seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
  $('pl-time').textContent = `${fmt(audio.currentTime)} / ${fmt(audio.duration)}`;
});
audio.addEventListener('loadedmetadata', () => { $('pl-time').textContent = `0:00 / ${fmt(audio.duration)}`; });
audio.addEventListener('error', () => { $('pl-kicker').textContent = 'no se pudo cargar'; });

seek.addEventListener('input', () => { arrastrando = true; });
seek.addEventListener('change', () => {
  if (audio.duration > 0) audio.currentTime = (seek.value / 1000) * audio.duration;
  arrastrando = false;
});

const v0 = Number(leer(CLAVE_VOL));
vol.value = Number.isFinite(v0) && leer(CLAVE_VOL) !== null ? v0 : 70;
audio.volume = vol.value / 100;
vol.addEventListener('input', () => { audio.volume = vol.value / 100; guardar(CLAVE_VOL, vol.value); });

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => audio.play());
  ms.setActionHandler('pause', () => audio.pause());
  ms.setActionHandler('nexttrack', siguiente);
  ms.setActionHandler('previoustrack', anterior);
}

// ---------- Temas ----------
function aplicar(tema, cambiarCancion = true) {
  actual = tema;
  const raiz = document.documentElement;
  if (tema.id === 'default') raiz.removeAttribute('data-theme'); else raiz.setAttribute('data-theme', tema.id);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema.meta);
  const sig = TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length];
  const b = $('theme-btn');
  b.textContent = tema.emoji;
  b.title = `Cambiar a ${sig.titulo} ${sig.emoji} (T)`;
  guardar(CLAVE, tema.id);
  // La cancion del tema es la de inicio; si ya estaba sonando, la nueva sigue sonando
  if (cambiarCancion) cargar(tema.pista, !audio.paused);
  particulas();
}
const siguienteTema = () => aplicar(TEMAS[(TEMAS.indexOf(actual) + 1) % TEMAS.length]);
$('theme-btn').addEventListener('click', siguienteTema);

// ---------- Visor de fotos del prototipo ----------
const fd = $('foto-dialog');
document.querySelectorAll('.foto').forEach((b) => b.addEventListener('click', () => {
  $('foto-img').src = b.dataset.full;
  $('foto-img').alt = b.dataset.alt || '';
  $('foto-alt').textContent = b.dataset.alt || '';
  if (typeof fd.showModal === 'function') fd.showModal(); else fd.setAttribute('open', '');
}));
fd.addEventListener('click', (e) => { if (e.target === fd) fd.close(); });

// ---------- Compartir (solo donde el navegador lo permite, p. ej. celulares) ----------
const share = $('btn-share');
if (navigator.share) {
  share.hidden = false;
  share.addEventListener('click', () => {
    navigator.share({ title: 'Indicador de temblores · USFX', text: 'Sensor de nivel de agua con Arduino que detecta temblores, en vivo.', url: 'https://panel-sensor-agua.vercel.app/' }).catch(() => {});
  });
}

// El enlace de la leyenda cambia de pestana; al llegar se sube al inicio
document.querySelectorAll('.ley-mas').forEach((a) => a.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' })));

// ---------- Ventana con el codigo QR ----------
const dlg = $('qr-dialog');
const abrirQR = () => { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); };
$('btn-qr').addEventListener('click', abrirQR);
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // clic fuera
$('qr-copiar').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  const url = 'https://panel-sensor-agua.vercel.app/';
  try { await navigator.clipboard.writeText(url); b.textContent = '¡Copiado!'; } catch { b.textContent = 'Copia: ' + url; }
  setTimeout(() => { b.textContent = 'Copiar enlace'; }, 2200);
});

// ---------- Atajos de teclado ----------
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  if (document.querySelector('dialog[open]')) return;
  switch (e.key.toLowerCase()) {
    case 'm': alternar(); break;
    case 'n': siguiente(); break;
    case 'p': anterior(); break;
    case 't': siguienteTema(); break;
    case 'q': abrirQR(); break;
    case 'v': window.dispatchEvent(new Event('atajo-proyector')); break;
    case 'l': alternarIdioma(); break;
    default: return;
  }
  e.preventDefault();
});

const pedido = new URLSearchParams(location.search).get('tema');
aplicar(TEMAS.find((t) => t.id === (pedido || leer(CLAVE))) || TEMAS[0]);
