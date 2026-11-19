// Punto de entrada: conecta la fuente de datos (placa o demo), el estado y las vistas.

import { parseLine } from './protocol.js';
import { SerialSource } from './serial.js';
import { SimSource } from './simulator.js';
import { RemoteSource } from './remote.js';
import { Publicador } from './publisher.js';
import './extras.js';
import { initAlertas } from './alertas.js';
import { initProyector } from './proyector.js';
import { initProyecto } from './proyecto.js';
import { t, lang, aplicarIdioma, alternarIdioma } from './i18n.js';
import { Store } from './store.js';
import { initActivo } from './views/activo.js';
import { initPrueba } from './views/prueba.js';
import { $, almacen, NOMBRES_NIVEL } from './util.js';

const store = new Store();
const pub = new Publicador();
let fuente = null;

// Interfaz que comparten las vistas
const ui = {
  eventos: new EventTarget(),
  get conectado() { return fuente !== null; },
  get tipo() { return fuente?.kind ?? null; },
  async enviar(texto) {
    if (!fuente) return false;
    try {
      await fuente.send(texto);
      store.addLog(`> ${texto.trim()}`, 'out');
      return true;
    } catch (e) {
      store.addLog(`${t('Error al enviar')}: ${e.message}`, 'err');
      return false;
    }
  },
  simular(n) {
    if (fuente?.kind === 'demo') fuente.temblor(n);
  },
};

// --- Avisos ---
const notice = $('notice');
let noticeTimer;
function aviso(texto, tipo = '', ms = 8000) {
  notice.textContent = t(texto);
  notice.className = `notice ${tipo}`;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  if (ms) noticeTimer = setTimeout(() => { notice.hidden = true; }, ms);
}

// --- Conexion ---
function pintarConexion() {
  const pill = $('conn-status');
  const estado = fuente?.kind ?? 'off';
  pill.dataset.state = estado;
  const remoto = fuente?.kind === 'remote';
  if (remoto) {
    pill.dataset.state = fuente.vivo ? 'serial' : 'demo';
    pill.lastChild.textContent = t(fuente.vivo ? 'En vivo' : 'Esperando transmisión');
  } else {
    pill.lastChild.textContent = t({ serial: 'Arduino conectado', demo: 'Modo demo', off: 'Desconectado' }[estado]);
  }
  $('btn-connect').hidden = !!fuente && !remoto;
  $('btn-demo').hidden = !!fuente && !remoto;
  $('btn-watch').hidden = !!fuente;
  $('btn-disconnect').hidden = !fuente || remoto;
  $('btn-live').hidden = !fuente || remoto;
  $('btn-live').textContent = t(pub.activo ? 'Detener transmisión' : 'Transmitir en vivo');
  $('btn-live').classList.toggle('primary', !pub.activo);
  ui.eventos.dispatchEvent(new Event('conexion'));
}

async function usar(nueva) {
  if (fuente) await desconectar();
  store.reset();

  nueva.addEventListener('line', (e) => {
    if (nueva.kind !== 'remote') pub.push(e.detail);
    const msg = parseLine(e.detail);
    if (!msg) return;
    if (msg.type !== 'sample') store.addLog(e.detail);
    store.handle(msg);
  });
  nueva.addEventListener('error', (e) => {
    store.addLog(`Error: ${e.detail?.message ?? e.detail}`, 'err');
  });
  nueva.addEventListener('estado', (e) => {
    pintarConexion();
    if (e.detail) aviso('Transmisión en vivo: estás viendo el sensor en tiempo real.', '', 5000);
    else aviso('El sensor no está transmitiendo ahora. Esta página se actualizará sola cuando empiece.', '', 0);
  });
  nueva.addEventListener('close', () => {
    if (fuente === nueva) {
      fuente = null;
      pintarConexion();
      aviso('Se perdió la conexión con la placa. ¿Se desconectó el cable USB?', 'error');
    }
  });

  await nueva.connect();
  fuente = nueva;
  pintarConexion();

  // Si en unos segundos no llegan datos, volver a pedir el modo datos
  setTimeout(() => {
    if (fuente === nueva && nueva.kind === 'serial' && store.count === 0) {
      nueva.send('d').catch(() => {});
      setTimeout(() => {
        if (fuente === nueva && store.count === 0) {
          aviso('La placa no envía datos. Comprueba que tenga cargado el sketch sensor_agua.ino actualizado.', 'error', 0);
        }
      }, 3000);
    }
  }, 4500);
}

async function desconectar() {
  const f = fuente;
  fuente = null;
  if (pub.activo) pub.detener();
  if (f) {
    if (f.kind === 'serial') { try { await f.send('t'); } catch { /* ignorar */ } }
    await f.disconnect();
  }
  pintarConexion();
}

$('btn-connect').addEventListener('click', async () => {
  if (!SerialSource.soportado()) {
    aviso('Este navegador no puede conectarse al Arduino. Abre el panel en Google Chrome o Microsoft Edge.', 'error', 0);
    return;
  }
  try {
    await usar(new SerialSource());
    aviso('Conectado. La placa se reinicia al conectar; los datos llegan en unos 2 segundos.', '', 5000);
  } catch (e) {
    if (e.name === 'NotFoundError') return; // el usuario cerro el selector de puertos
    const ocupado = /open|ocupad|access|denied/i.test(e.message);
    aviso(ocupado
      ? 'El puerto está ocupado. Cierra el monitor serie (Abrir monitor.bat) o el Arduino IDE y vuelve a intentar.'
      : `No se pudo conectar: ${e.message}`, 'error', 0);
  }
});

$('btn-demo').addEventListener('click', async () => {
  if (!(await pub.autorizar())) {
    aviso('Clave incorrecta. El modo demo solo está disponible para quien presenta.', 'error', 6000);
    return;
  }
  usar(new SimSource());
  aviso('Modo demo: datos simulados con la misma lógica que la placa. Hay temblores automáticos cada 10–20 s.', '', 6000);
});

$('btn-watch').addEventListener('click', () => usar(new RemoteSource()).catch((e) => aviso(`No se pudo conectar a la transmisión: ${e.message}`, 'error', 0)));

$('btn-live').addEventListener('click', () => {
  if (pub.activo) {
    pub.detener();
    aviso('Transmisión detenida. Los visitantes ya no reciben datos.', '', 5000);
  } else if (pub.iniciar()) {
    aviso('Transmitiendo en vivo: quien abra el enlace o el QR verá lo que registra tu sensor.', 'ok', 6000);
  }
});
pub.addEventListener('cambio', pintarConexion);
pub.addEventListener('fallo', (e) => aviso(e.detail, 'error', 0));

$('btn-disconnect').addEventListener('click', desconectar);

if (!SerialSource.soportado()) {
  aviso('Para conectar el Arduino usa Google Chrome o Microsoft Edge. La demo funciona en cualquier navegador.', '', 0);
}

// --- Pestanas ---
initActivo(store, ui);
const prueba = initPrueba(store, ui);

function mostrarVista(nombre) {
  const vista = ['prueba', 'proyecto'].includes(nombre) ? nombre : 'activo';
  document.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === vista)));
  $('view-activo').hidden = vista !== 'activo';
  $('view-prueba').hidden = vista !== 'prueba';
  $('view-proyecto').hidden = vista !== 'proyecto';
  prueba.setVisible(vista === 'prueba');
  almacen.guardar('sensorAgua.vista', vista);
  if (location.hash !== `#${vista}`) history.replaceState(null, '', `#${vista}`);
}
document.querySelectorAll('[role="tab"]').forEach((b) => b.addEventListener('click', () => mostrarVista(b.dataset.tab)));
window.addEventListener('hashchange', () => mostrarVista(location.hash.slice(1)));
mostrarVista(location.hash.slice(1) || almacen.leer('sensorAgua.vista', 'activo'));

initAlertas(store, aviso);
initProyector();
initProyecto();

// Idioma: ES/EN
const NIVELES_ES = [...NOMBRES_NIVEL];
const btnLang = $('btn-lang');
function aplicarNiveles() { NOMBRES_NIVEL.splice(0, NOMBRES_NIVEL.length, ...NIVELES_ES.map(t)); }
btnLang.addEventListener('click', alternarIdioma);
window.addEventListener('idioma', () => {
  aplicarNiveles();
  btnLang.textContent = lang === 'en' ? 'ES' : 'EN';
  pintarConexion();
});
aplicarNiveles();
btnLang.textContent = lang === 'en' ? 'ES' : 'EN';
aplicarIdioma();

pintarConexion();
// Quien abre el enlace (o el QR) ve la transmisión en vivo automaticamente; si elige Arduino o Demo, la reemplaza
usar(new RemoteSource()).catch(() => {});
window.addEventListener('beforeunload', () => { if (fuente) fuente.disconnect(); });
