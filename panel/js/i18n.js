// Idioma ES/EN. El HTML esta en espanol; en ingles se reemplaza texto por texto (sin tocar la estructura).
// - Texto estatico: se busca cada fragmento de texto del HTML en el diccionario de i18n-en.js.
// - Texto dinamico (JS): se escribe t('texto en espanol') y se traduce si el idioma es ingles.

import { EN_ESTATICO, EN_ATRIBUTOS } from './i18n-en.js';

const CLAVE = 'sensorAgua.idioma';
const norm = (s) => s.replace(/\s+/g, ' ').trim();

function idiomaInicial() {
  // Un enlace con ?lang=en (o ?lang=es) manda sobre lo guardado
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'es') {
    try { localStorage.setItem(CLAVE, q); } catch { /* sin almacenamiento */ }
    return q;
  }
  try {
    const g = localStorage.getItem(CLAVE);
    if (g === 'en' || g === 'es') return g;
  } catch { /* sin almacenamiento */ }
  return 'es';
}

export let lang = idiomaInicial();

// Cadenas que genera el JavaScript (avisos, estados, historial...)
const DIN = {
  'Esperando datos…': 'Waiting for data…',
  'Conecta la placa o abre la demo': 'Connect the board or open the demo',
  'Sin conexión': 'Not connected',
  'En reposo · vigilando': 'Idle · watching',
  'Ninguno todavía': 'None yet',
  'hora': 'time',
  'duración': 'duration',
  'oscilaciones': 'oscillations',
  'Temblor en curso': 'Tremor in progress',
  'Arduino conectado': 'Arduino connected',
  'Modo demo': 'Demo mode',
  'Desconectado': 'Disconnected',
  'En vivo': 'Live',
  'Esperando transmisión': 'Waiting for broadcast',
  'Transmitir en vivo': 'Broadcast live',
  'Detener transmisión': 'Stop broadcast',
  'Copiar enlace': 'Copy link',
  '¡Copiado!': 'Copied!',
  'Clave incorrecta. El modo demo solo está disponible para quien presenta.': 'Wrong key. Demo mode is only available to the presenter.',
  'Transmisión en vivo: estás viendo el sensor en tiempo real.': 'Live broadcast: you are watching the sensor in real time.',
  'El sensor no está transmitiendo ahora. Esta página se actualizará sola cuando empiece.': 'The sensor is not broadcasting right now. This page will update by itself when it starts.',
  'Transmisión detenida. Los visitantes ya no reciben datos.': 'Broadcast stopped. Visitors no longer receive data.',
  'Transmitiendo en vivo: quien abra el enlace o el QR verá lo que registra tu sensor.': 'Broadcasting live: anyone who opens the link or the QR will see what your sensor records.',
  'Se perdió la conexión con la placa. ¿Se desconectó el cable USB?': 'Lost the connection with the board. Was the USB cable unplugged?',
  'Este navegador no puede conectarse al Arduino. Abre el panel en Google Chrome o Microsoft Edge.': 'This browser cannot connect to the Arduino. Open the panel in Google Chrome or Microsoft Edge.',
  'Conectado. La placa se reinicia al conectar; los datos llegan en unos 2 segundos.': 'Connected. The board restarts when connecting; data arrives in about 2 seconds.',
  'Modo demo: datos simulados con la misma lógica que la placa. Hay temblores automáticos cada 10–20 s.': 'Demo mode: simulated data using the same logic as the board. Automatic tremors every 10–20 s.',
  'Para conectar el Arduino usa Google Chrome o Microsoft Edge. La demo funciona en cualquier navegador.': 'To connect the Arduino use Google Chrome or Microsoft Edge. The demo works in any browser.',
  'La placa no envía datos. Comprueba que tenga cargado el sketch sensor_agua.ino actualizado.': 'The board is not sending data. Check that it has the updated sensor_agua.ino sketch loaded.',
  'El puerto está ocupado. Cierra el monitor serie (Abrir monitor.bat) o el Arduino IDE y vuelve a intentar.': 'The port is busy. Close the serial monitor (Abrir monitor.bat) or the Arduino IDE and try again.',
  'Reanudar gráficas': 'Resume charts',
  'Pausar gráficas': 'Pause charts',
  'Histéresis': 'Hysteresis',
  'puntos': 'points',
  'Ventana de variación': 'Variation window',
  'ventana': 'window',
  'Grabando': 'Recording',
  'Grabación lista': 'Recording ready',
  'muestras': 'samples',
  'Detener': 'Stop',
  'Grabar': 'Record',
  'Sin grabación': 'No recording',
  'ahora': 'now',
  'Sin datos: conecta la placa o abre la demo': 'No data: connect the board or open the demo',
  'Los umbrales deben ser enteros de 1 a 1023 y de menor a mayor.': 'Thresholds must be integers from 1 to 1023, in increasing order.',
  'Enviado. La placa los guarda en su memoria (EEPROM).': 'Sent. The board saves them in its memory (EEPROM).',
  'No hay conexión con la placa.': 'The board is not connected.',
  'Umbrales leídos de la placa.': 'Thresholds read from the board.',
  '¿Restaurar los umbrales por defecto en la placa?': 'Restore the default thresholds on the board?',
  'Restaurados los valores por defecto.': 'Default values restored.',
  'Esperando el estado de la placa… (si no aparece, carga el sketch actualizado).': 'Waiting for the board status… (if it does not appear, upload the updated sketch).',
  'Conecta la placa para elegir el sonido.': 'Connect the board to choose the sound.',
  'Activado: en el nivel 5 suena la melodía. La placa lo guarda en su memoria.': 'On: at level 5 the melody plays. The board saves it in its memory.',
  'Desactivado: en el nivel 5 suena el pitido continuo.': 'Off: at level 5 the continuous beep plays.',
  'Enviado, esperando confirmación de la placa…': 'Sent, waiting for the board to confirm…',
  'Error al enviar': 'Error sending',
  '¿Borrar todo el historial de temblores guardado en este navegador?': 'Delete the whole tremor history saved in this browser?',
  'var. máx': 'max var.',
  '=== Indicador de temblores (SIMULADOR) ===': '=== Tremor indicator (SIMULATOR) ===',
  'Datos simulados con la misma logica que la placa.': 'Simulated data using the same logic as the board.',
  'Error: umbrales fuera de rango (1-1023) o no van de menor a mayor.': 'Error: thresholds out of range (1-1023) or not in increasing order.',
  'Umbrales actualizados.': 'Thresholds updated.',
  'Modo texto.': 'Text mode.',
  'Umbrales por defecto restaurados.': 'Default thresholds restored.',
  'Simulador: comandos d, t, v, r, m, b, u10,16,23,31,40': 'Simulator: commands d, t, v, r, m, b, u10,16,23,31,40',
  'La pantalla no se apagará mientras transmitas.': 'The screen will not turn off while you broadcast.',
  'Sin datos': 'No data',
  'Nivel': 'Level',
  'Avisos activados': 'Alerts on',
  'Avisos desactivados': 'Alerts off',
  'Tu navegador no permite notificaciones.': 'Your browser does not support notifications.',
  'Permiso denegado. Actívalo en la configuración del navegador.': 'Permission denied. Turn it on in your browser settings.',
  'Vibración fuerte detectada': 'Strong vibration detected',
  'Modo proyector': 'Projector mode',
  'Salir del modo proyector': 'Exit projector mode',
  'Seguro': 'Safe',
  'Cerca del límite': 'Close to the limit',
  'Supera los 20 mA: puede dañar el pin': 'Over 20 mA: it can damage the pin',
  'El LED no enciende: el voltaje no supera al del LED': 'The LED will not light: the supply voltage does not exceed the LED voltage',
  'Muy tenue: casi no se ve': 'Very dim: barely visible',
  'Descargado': 'Downloaded',
  'Agua quieta': 'Still water',
  'Golpe suave': 'Light tap',
  'Golpe fuerte': 'Hard hit',
  'Muy fuerte': 'Very strong',
  // Nombres de nivel
  'Sin movimiento': 'No movement',
  'Muy leve': 'Very slight',
  'Leve': 'Slight',
  'Moderado': 'Moderate',
  'Fuerte': 'Strong',
  'Muy fuerte': 'Very strong',
  // CSV
  'Umbrales de calibración': 'Calibration thresholds',
  'Nivel de alerta': 'Alert level',
  'Variación desde (u)': 'Variation from (units)',
  'Variación hasta (u)': 'Variation up to (units)',
  'Cambio de voltaje ΔV (V)': 'Voltage change ΔV (V)',
  'Salidas activas': 'Active outputs',
  'Significado operativo': 'Operational meaning',
  'Tiempo de activación (programa con señales simuladas)': 'Activation time (program run with simulated signals)',
  'Amplitud de oscilación (u)': 'Oscillation amplitude (units)',
  'Tiempo de activación (s)': 'Activation time (s)',
  'Corriente por LED y potencia en la resistencia de 220 Ω': 'Current per LED and power in the 220 Ω resistor',
  'Tipo de LED': 'LED type',
  'Voltaje del LED (V)': 'LED voltage (V)',
  'Corriente (mA)': 'Current (mA)',
  'Potencia (W)': 'Power (W)',
  'Azul / blanco': 'Blue / white',
  'Rojo': 'Red',
  'Ninguna': 'None',
  'Normal (sin riesgo)': 'Normal (no risk)',
  'Advertencia leve': 'Slight warning',
  'Vibración baja (precaución)': 'Low vibration (caution)',
  'Vibración media (posible desalojo parcial)': 'Medium vibration (possible partial evacuation)',
  'Vibración alta (preparar evacuación)': 'High vibration (prepare to evacuate)',
  'Vibración muy fuerte (evacuación total)': 'Very strong vibration (full evacuation)',
};

export function t(es) {
  return lang === 'en' ? (DIN[es] ?? es) : es;
}

// ---- texto estatico ----
const originalesTexto = new WeakMap();   // nodo de texto -> texto original
const originalesAttr = new WeakMap();    // elemento -> { atributo: original }
const ATRIBUTOS = ['title', 'aria-label', 'alt', 'placeholder'];

function traducirNodo(nodo) {
  const original = originalesTexto.has(nodo) ? originalesTexto.get(nodo) : nodo.nodeValue;
  const clave = norm(original);
  if (!clave) return;
  if (!originalesTexto.has(nodo)) originalesTexto.set(nodo, original);
  if (lang === 'en' && EN_ESTATICO[clave] !== undefined) {
    const ini = /^\s/.test(original) ? ' ' : '';
    const fin = /\s$/.test(original) ? ' ' : '';
    nodo.nodeValue = ini + EN_ESTATICO[clave] + fin;
  } else {
    nodo.nodeValue = original;
  }
}

function traducirAtributos(el) {
  for (const a of ATRIBUTOS) {
    if (!el.hasAttribute(a)) continue;
    let orig = originalesAttr.get(el);
    if (!orig) { orig = {}; originalesAttr.set(el, orig); }
    if (!(a in orig)) orig[a] = el.getAttribute(a);
    const clave = norm(orig[a]);
    el.setAttribute(a, lang === 'en' && EN_ATRIBUTOS[clave] !== undefined ? EN_ATRIBUTOS[clave] : orig[a]);
  }
}

export function aplicarIdioma(raiz = document.body) {
  document.documentElement.lang = lang;
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (/^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode?.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodos = [];
  while (w.nextNode()) nodos.push(w.currentNode);
  nodos.forEach(traducirNodo);
  raiz.querySelectorAll('*').forEach(traducirAtributos);
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    if (!meta.dataset.es) meta.dataset.es = meta.content;
    meta.content = lang === 'en' ? (EN_ATRIBUTOS[norm(meta.dataset.es)] ?? meta.dataset.es) : meta.dataset.es;
  }
  if (!document.documentElement.dataset.tituloEs) document.documentElement.dataset.tituloEs = document.title;
  document.title = lang === 'en' ? (EN_ATRIBUTOS[norm(document.documentElement.dataset.tituloEs)] ?? document.title) : document.documentElement.dataset.tituloEs;
}

export function setIdioma(nuevo) {
  lang = nuevo === 'en' ? 'en' : 'es';
  try { localStorage.setItem(CLAVE, lang); } catch { /* sin almacenamiento */ }
  aplicarIdioma();
  window.dispatchEvent(new Event('idioma'));
}

export function alternarIdioma() {
  setIdioma(lang === 'en' ? 'es' : 'en');
}
