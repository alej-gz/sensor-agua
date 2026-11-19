// Detalles de la pagina personal: 3 temas (cada uno con su cancion), reproductor y particulas flotantes.

const TEMAS = [
  { id: 'dog', emoji: '🐾', titulo: "Man's Best Friend", meta: '#1A0A0A', pista: 'audio/such-a-funny-way.mp3', nombre: 'such a funny way', simbolos: ['🐾', '✧', '·'] },
  { id: 'cmih', emoji: '☕', titulo: "Short n' Sweet", meta: '#0D2030', pista: 'audio/cmih.mp3', nombre: "couldn't make it harder", simbolos: ['☕', '✧', '♡'] },
  { id: 'default', emoji: '✉️', titulo: "Emails I Can't Send", meta: '#FFF5F5', pista: 'audio/garden.mp3', nombre: 'garden', simbolos: ['❤', '♥', '♡', '✧', '❀'] },
];
const CLAVE = 'sensorAgua.tema';
const $ = (id) => document.getElementById(id);

const leer = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
const guardar = (v) => { try { localStorage.setItem(CLAVE, v); } catch { /* sin almacenamiento */ } };

const audio = $('pl-audio');
const btnPlay = $('pl-btn');
const ico = $('pl-ico');
const PLAY = '<path d="M8 5v14l11-7z"/>';
const PAUSA = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';
let actual = TEMAS[0];

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

function pausarUI() {
  ico.innerHTML = PLAY;
  btnPlay.setAttribute('aria-label', 'Reproducir');
}

function aplicar(tema) {
  actual = tema;
  const raiz = document.documentElement;
  if (tema.id === 'default') raiz.removeAttribute('data-theme'); else raiz.setAttribute('data-theme', tema.id);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema.meta);
  const sig = TEMAS[(TEMAS.indexOf(tema) + 1) % TEMAS.length];
  const b = $('theme-btn');
  b.textContent = tema.emoji;
  b.title = `Cambiar a ${sig.titulo} ${sig.emoji}`;
  guardar(tema.id);
  // Cada tema tiene su cancion: al cambiar se detiene la anterior
  audio.pause();
  audio.src = tema.pista;
  audio.currentTime = 0;
  $('pl-prog').style.width = '0%';
  $('pl-title').textContent = `listening: ${tema.nombre}`;
  pausarUI();
  particulas();
}

$('theme-btn').addEventListener('click', () => aplicar(TEMAS[(TEMAS.indexOf(actual) + 1) % TEMAS.length]));

btnPlay.addEventListener('click', () => {
  if (audio.paused) {
    audio.play().then(() => {
      ico.innerHTML = PAUSA;
      btnPlay.setAttribute('aria-label', 'Pausar');
    }).catch(() => pausarUI());
  } else {
    audio.pause();
    pausarUI();
  }
});
audio.addEventListener('timeupdate', () => {
  if (audio.duration > 0) $('pl-prog').style.width = `${(audio.currentTime / audio.duration) * 100}%`;
});
audio.addEventListener('ended', () => { pausarUI(); $('pl-prog').style.width = '0%'; });

const pedido = new URLSearchParams(location.search).get('tema');
// --- Ventana con el codigo QR ---
const dlg = $('qr-dialog');
$('btn-qr').addEventListener('click', () => { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', ''); });
dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // clic fuera
$('qr-copiar').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  const url = 'https://panel-sensor-agua.vercel.app/';
  try { await navigator.clipboard.writeText(url); b.textContent = '¡Copiado!'; } catch { b.textContent = 'Copia: ' + url; }
  setTimeout(() => { b.textContent = 'Copiar enlace'; }, 2200);
});

aplicar(TEMAS.find((t) => t.id === (pedido || leer())) || TEMAS[0]);
