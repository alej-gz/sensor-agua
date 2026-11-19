// App de escritorio (Windows) del Indicador de temblores.
// - Abre el panel en su propia ventana. En linea carga la ultima version publicada; sin internet usa la copia
//   incluida en la app (carpeta panel/), y los datos en vivo (/api) se piden al sitio publicado.
// - Permite conectar el Arduino por USB (Web Serial) con un selector de puerto nativo.

const { app, BrowserWindow, Menu, session, shell, dialog, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REMOTO = 'https://panel-sensor-agua.vercel.app';
const RAIZ_PANEL = path.join(__dirname, 'panel');
const ICONO = path.join(__dirname, 'build', 'icon.ico');
const ORIGENES_CONFIABLES = new Set([REMOTO, 'app://panel']);
const PERMISOS = new Set(['serial', 'notifications', 'fullscreen', 'clipboard-sanitized-write', 'clipboard-read', 'media']);

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let ventana = null;
let enLinea = true;

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function origenConfiable(origen) {
  try {
    const o = new URL(origen);
    return ORIGENES_CONFIABLES.has(o.origin) || ORIGENES_CONFIABLES.has(`${o.protocol}//${o.host}`);
  } catch {
    return false;
  }
}

function registrarProtocolo() {
  protocol.handle('app', async (req) => {
    const u = new URL(req.url);
    // Datos en vivo: se piden al sitio publicado
    if (u.pathname.startsWith('/api/')) {
      const init = { method: req.method, headers: req.headers };
      if (!['GET', 'HEAD'].includes(req.method)) { init.body = req.body; init.duplex = 'half'; }
      try { return await net.fetch(REMOTO + u.pathname + u.search, init); } catch { return new Response('Sin conexión', { status: 503 }); }
    }
    let rel = decodeURIComponent(u.pathname);
    if (rel === '/' || rel.endsWith('/')) rel += 'index.html';
    const archivo = path.normalize(path.join(RAIZ_PANEL, rel));
    if (!archivo.startsWith(RAIZ_PANEL)) return new Response('Prohibido', { status: 403 });
    try {
      const r = await net.fetch(pathToFileURL(archivo).toString());
      const tipo = TIPOS[path.extname(archivo).toLowerCase()];
      if (!tipo) return r;
      const h = new Headers(r.headers);
      h.set('Content-Type', tipo);
      return new Response(r.body, { status: r.status, headers: h });
    } catch {
      return new Response('No encontrado', { status: 404 });
    }
  });
}

function configurarSesion() {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((wc, permiso, cb, detalles) => {
    cb(PERMISOS.has(permiso) && origenConfiable(detalles?.requestingUrl || wc.getURL()));
  });
  ses.setPermissionCheckHandler((wc, permiso, origen) => PERMISOS.has(permiso) && origenConfiable(origen));
  ses.setDevicePermissionHandler((d) => d.deviceType === 'serial' && origenConfiable(d.origin));

  // Selector de puerto del Arduino (Web Serial)
  ses.on('select-serial-port', (evento, puertos, wc, callback) => {
    evento.preventDefault();
    if (!puertos.length) {
      dialog.showMessageBoxSync(ventana, {
        type: 'info', title: 'Indicador de temblores', buttons: ['Entendido'],
        message: 'No se encontró ninguna placa.',
        detail: 'Conecta el Arduino por USB, cierra el Arduino IDE o el monitor serie si están abiertos, y vuelve a pulsar «Conectar Arduino».',
      });
      callback('');
      return;
    }
    if (puertos.length === 1) { callback(puertos[0].portId); return; }
    const botones = puertos.map((p) => `${p.displayName || 'Puerto serie'} (${p.portName})`).concat('Cancelar');
    const r = dialog.showMessageBoxSync(ventana, {
      type: 'question', title: 'Elegir puerto', message: '¿A qué puerto está conectado el Arduino?',
      buttons: botones, cancelId: botones.length - 1, defaultId: 0, noLink: true,
    });
    callback(r === botones.length - 1 ? '' : puertos[r].portId);
  });
}

function cargarEnLinea() {
  enLinea = true;
  ventana.loadURL(`${REMOTO}/?source=app`);
}
function cargarLocal() {
  enLinea = false;
  ventana.loadURL('app://panel/index.html?source=app');
}

function crearMenu() {
  const plantilla = [
    { label: 'Archivo', submenu: [{ label: 'Salir', accelerator: 'Alt+F4', role: 'quit' }] },
    {
      label: 'Ver',
      submenu: [
        { label: 'Recargar', accelerator: 'CmdOrCtrl+R', click: () => ventana?.reload() },
        { label: 'Volver a cargar en línea', click: () => cargarEnLinea() },
        { label: 'Usar la copia sin conexión', click: () => cargarLocal() },
        { type: 'separator' },
        { label: 'Pantalla completa', accelerator: 'F11', role: 'togglefullscreen' },
        { label: 'Acercar', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: 'Alejar', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Tamaño normal', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        { label: 'Abrir en el navegador', click: () => shell.openExternal(REMOTO) },
        { label: 'Página de Paul Alejandro Guzmán Calle', click: () => shell.openExternal('https://alej-gz.vercel.app/') },
        { label: 'Código fuente (GitHub)', click: () => shell.openExternal('https://github.com/alej-gz/sensor-agua') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(plantilla));
}

function crearVentana() {
  ventana = new BrowserWindow({
    width: 1360, height: 860, minWidth: 420, minHeight: 560,
    backgroundColor: '#1A0A0A', title: 'Indicador de temblores · USFX', icon: ICONO,
    autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  ventana.once('ready-to-show', () => ventana.show());

  // Los enlaces externos se abren en el navegador, no dentro de la app
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  ventana.webContents.on('will-navigate', (e, url) => {
    let origen = '';
    try { origen = new URL(url).origin; } catch { /* ignorar */ }
    if (!ORIGENES_CONFIABLES.has(origen) && origen !== 'app://panel') {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  // Sin internet al abrir: se usa la copia incluida
  ventana.webContents.on('did-fail-load', (e, codigo, descripcion, url, esPrincipal) => {
    if (esPrincipal && enLinea && codigo !== -3) cargarLocal();
  });
  ventana.on('closed', () => { ventana = null; });

  cargarEnLinea();
}

app.on('second-instance', () => {
  if (ventana) { if (ventana.isMinimized()) ventana.restore(); ventana.focus(); }
});

app.whenReady().then(() => {
  registrarProtocolo();
  configurarSesion();
  crearMenu();
  crearVentana();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) crearVentana(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
