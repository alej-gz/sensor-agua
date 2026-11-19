// Service worker: deja la app instalable y abrible sin conexion.
// Estrategia: primero la red (para que las actualizaciones lleguen siempre); si no hay red, la copia guardada.
// Nunca guarda /api/* (datos en vivo) ni archivos de otros sitios (fuentes, canciones).

const CACHE = 'temblores-v1';

const NUCLEO = [
  './', 'index.html', 'manifest.webmanifest',
  'css/styles.css',
  'js/main.js', 'js/app.js', 'js/alarm.js', 'js/alertas.js', 'js/chart.js', 'js/detector.js', 'js/extras.js',
  'js/i18n.js', 'js/i18n-en.js', 'js/protocol.js', 'js/proyecto.js', 'js/proyector.js', 'js/publisher.js',
  'js/remote.js', 'js/wakelock.js', 'js/serial.js', 'js/simulator.js', 'js/store.js', 'js/util.js',
  'js/views/activo.js', 'js/views/prueba.js',
  'img/usfx-oscuro.png', 'img/usfx-claro.png', 'img/firma.png', 'img/qr.png',
  'icon-192.png', 'icon-512.png', 'favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Si un archivo falla, el resto se guarda igual
    await Promise.allSettled(NUCLEO.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;       // fuentes, canciones...
  if (url.pathname.startsWith('/api/')) return;          // datos en vivo: siempre red
  if (req.headers.has('range')) return;                  // audio/video parciales

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const resp = await fetch(req);
      if (resp && resp.ok && resp.type === 'basic') cache.put(req, resp.clone());
      return resp;
    } catch {
      const guardada = await cache.match(req, { ignoreSearch: true });
      if (guardada) return guardada;
      if (req.mode === 'navigate') {
        const inicio = (await cache.match('index.html')) || (await cache.match('./'));
        if (inicio) return inicio;
      }
      return new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
