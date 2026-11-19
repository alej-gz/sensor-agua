// Estado central del panel: muestras, temblores, umbrales, grabacion y registro.
// Las vistas escuchan sus eventos: 'sample', 'tremorstart', 'tremor', 'config', 'sound', 'log', 'reset', 'recording'.

import { almacen } from './util.js';

const HZ = 50;
const CAPACIDAD = HZ * 150;       // 150 s de historia para las graficas
const CLAVE_HISTORIAL = 'sensorAgua.historial';
const MAX_HISTORIAL = 200;
const MAX_LOG = 400;

export class Store extends EventTarget {
  constructor() {
    super();
    this.t = new Float64Array(CAPACIDAD);
    this.lect = new Int16Array(CAPACIDAD);
    this.vari = new Int16Array(CAPACIDAD);
    this.niv = new Int8Array(CAPACIDAD);
    this.historial = almacen.leer(CLAVE_HISTORIAL, []);
    this.log = [];
    this.reset();
  }

  _emit(tipo, detail) {
    this.dispatchEvent(new CustomEvent(tipo, { detail }));
  }

  reset() {
    this.head = 0;
    this.count = 0;
    this.ultimoT = 0;
    this.actual = null;
    this.umbrales = null;
    this.histeresis = null;
    this.ventanaMs = null;
    this.melodia = null;          // sonido de la alarma en la placa: null = desconocido
    this.sismo = { activo: false, inicio: 0 };
    this.sesion = { inicio: Date.now(), temblores: [], nivelMax: 0 };
    this.llegadas = [];
    this.nivelMs = [0, 0, 0, 0, 0, 0];
    this.grabando = false;
    this.grabacion = [];
    this.grabacionInicio = 0;
    this._emit('reset');
  }

  handle(msg) {
    switch (msg.type) {
      case 'sample': this._muestra(msg); break;
      case 'tremorStart':
        this.sismo = { activo: true, inicio: Date.now() };
        this._emit('tremorstart');
        break;
      case 'tremorEnd': this._finTemblor(msg); break;
      case 'config':
        this.umbrales = msg.umbrales;
        this.histeresis = msg.histeresis;
        this.ventanaMs = msg.ventanaMs;
        this._emit('config');
        break;
      case 'sound':
        this.melodia = msg.melodia;
        this._emit('sound');
        break;
      default: break;
    }
  }

  _muestra(s) {
    const llegada = performance.now();
    // Las lineas llegan en rafagas por USB: se reconstruye el eje de tiempo a 20 ms por muestra
    let t = this.ultimoT ? this.ultimoT + 1000 / HZ : llegada;
    if (Math.abs(llegada - t) > 250) t = llegada;
    this.ultimoT = t;

    const i = this.head;
    this.t[i] = t;
    this.lect[i] = s.lectura;
    this.vari[i] = s.variacion;
    this.niv[i] = s.nivel;
    this.head = (i + 1) % CAPACIDAD;
    if (this.count < CAPACIDAD) this.count++;

    this.llegadas.push(llegada);
    while (this.llegadas.length && llegada - this.llegadas[0] > 2000) this.llegadas.shift();

    if (s.nivel >= 0 && s.nivel <= 5) this.nivelMs[s.nivel] += 1000 / HZ;

    if (s.sismo && !this.sismo.activo) this.sismo = { activo: true, inicio: Date.now() };

    this.actual = { ...s, t };

    if (this.grabando) {
      this.grabacion.push([
        new Date().toISOString(), Math.round(t - this.grabacionInicio),
        s.lectura, s.variacion, s.nivel, s.buzzer ? 1 : 0, s.sismo ? 1 : 0,
      ]);
    }
    this._emit('sample');
  }

  _finTemblor(m) {
    const fin = Date.now();
    const inicio = this.sismo.activo ? this.sismo.inicio : fin - m.duracionMs - 3000;
    const registro = {
      n: this.sesion.temblores.length + 1,
      inicio,
      duracionMs: m.duracionMs,
      oscilaciones: m.oscilaciones,
      oscPorSeg: m.duracionMs > 0 ? m.oscilaciones * 1000 / m.duracionMs : 0,
      nivelMax: m.nivelMax,
      variacionMax: m.variacionMax,
      lecturaMin: m.lecturaMin,
      lecturaMax: m.lecturaMax,
    };
    this.sismo = { activo: false, inicio: 0 };
    this.sesion.temblores.push(registro);
    this.sesion.nivelMax = Math.max(this.sesion.nivelMax, m.nivelMax);
    this.historial.unshift(registro);
    if (this.historial.length > MAX_HISTORIAL) this.historial.length = MAX_HISTORIAL;
    almacen.guardar(CLAVE_HISTORIAL, this.historial);
    this._emit('tremor', registro);
  }

  borrarHistorial() {
    this.historial = [];
    almacen.guardar(CLAVE_HISTORIAL, []);
    this._emit('tremor', null);
  }

  reiniciarNiveles() {
    this.nivelMs = [0, 0, 0, 0, 0, 0];
  }

  addLog(texto, clase = '') {
    this.log.push({ texto, clase, hora: Date.now() });
    if (this.log.length > MAX_LOG) this.log.splice(0, this.log.length - MAX_LOG);
    this._emit('log', { texto, clase });
  }

  // Frecuencia real de llegada de muestras (Hz)
  frecuencia() {
    const n = this.llegadas.length;
    if (n < 2) return 0;
    const dt = this.llegadas[n - 1] - this.llegadas[0];
    return dt > 0 ? (n - 1) * 1000 / dt : 0;
  }

  // Muestras de los ultimos `ms` milisegundos, en orden cronologico
  ventana(ms) {
    const t = [];
    const lect = [];
    const vari = [];
    const niv = [];
    if (!this.count) return { t, lect, vari, niv };
    const fin = this.ultimoT;
    for (let k = 0; k < this.count; k++) {
      const i = (this.head - 1 - k + CAPACIDAD) % CAPACIDAD;
      if (fin - this.t[i] > ms) break;
      t.push(this.t[i]);
      lect.push(this.lect[i]);
      vari.push(this.vari[i]);
      niv.push(this.niv[i]);
    }
    t.reverse(); lect.reverse(); vari.reverse(); niv.reverse();
    return { t, lect, vari, niv };
  }

  iniciarGrabacion() {
    this.grabacion = [];
    this.grabacionInicio = this.ultimoT || performance.now();
    this.grabando = true;
    this._emit('recording');
  }

  detenerGrabacion() {
    this.grabando = false;
    this._emit('recording');
  }
}
