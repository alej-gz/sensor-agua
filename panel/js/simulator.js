// Fuente de datos simulada: genera las mismas lineas que la placa en modo datos.
// Sirve para mostrar el panel sin el Arduino conectado.

import { t as tr } from './i18n.js';

import { Detector, POR_DEFECTO } from './detector.js';

// Ruido gaussiano (Box-Muller)
function gauss() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Amplitud (puntos) aproximada para alcanzar cada nivel con los umbrales por defecto
const AMPLITUD = [0, 6.5, 9.5, 13, 16, 21];

export class SimSource extends EventTarget {
  kind = 'demo';

  constructor() {
    super();
    this.det = new Detector();
    this.modoDatos = false;
    this.melodia = false;
    this.base = 300;
    this.deriva = 0;
    this.temblorActual = null;
  }

  _emitir(linea) {
    this.dispatchEvent(new CustomEvent('line', { detail: linea }));
  }

  async connect() {
    this.t0 = performance.now();
    this.simT = 0;
    this.proximoAuto = 5000;
    this._emitir(tr('=== Indicador de temblores (SIMULADOR) ==='));
    this._emitir(tr('Datos simulados con la misma logica que la placa.'));
    this._timer = setInterval(() => this._tick(), 20);
    setTimeout(() => this.send('d'), 200);
  }

  async disconnect() {
    clearInterval(this._timer);
    this._timer = null;
    this.dispatchEvent(new Event('close'));
  }

  // Lanza un temblor de la intensidad indicada (1..5)
  temblor(intensidad) {
    const n = Math.min(5, Math.max(1, intensidad));
    this.temblorActual = {
      inicio: this.simT,
      dur: 3000 + Math.random() * 4000,
      amp: AMPLITUD[n] * (0.95 + Math.random() * 0.15),
      freq: 1.9 + Math.random() * 1.4,
    };
  }

  _tick() {
    const ahora = performance.now() - this.t0;
    let n = 0;
    while (this.simT + 20 <= ahora && n < 50) {
      this.simT += 20;
      this._muestra();
      n++;
    }
    if (n === 50) this.simT = ahora; // la pestaña estuvo en segundo plano: no recuperar todo
  }

  _muestra() {
    const t = this.simT;
    if (!this.temblorActual && t >= this.proximoAuto) this.temblor(1 + Math.floor(Math.random() * 5));

    this.deriva = this.deriva * 0.999 + gauss() * 0.02;
    let v = this.base + this.deriva + gauss() * 0.8;

    const tr = this.temblorActual;
    if (tr) {
      const x = (t - tr.inicio) / tr.dur;
      if (x >= 1) {
        this.temblorActual = null;
        this.proximoAuto = t + 9000 + Math.random() * 9000;
      } else {
        const envolvente = Math.sin(Math.PI * x) ** 0.6;
        v += tr.amp * envolvente * Math.sin(2 * Math.PI * tr.freq * (t - tr.inicio) / 1000);
        v += gauss() * tr.amp * 0.08;
      }
    }

    const lectura = Math.max(0, Math.min(1023, Math.round(v)));
    const r = this.det.paso(lectura, t);
    if (!this.modoDatos) return;

    for (const e of r.eventos) {
      if (e.type === 'start') this._emitir('E1');
      else this._emitir(`E0,${e.duracionMs},${e.oscilaciones},${e.nivelMax},${e.variacionMax},${e.lecturaMin},${e.lecturaMax}`);
    }
    this._emitir(`D${r.lectura},${r.variacion},${r.nivel},${(r.buzzer ? 1 : 0) | (r.sismo ? 2 : 0)}`);
  }

  _config() {
    const d = this.det;
    this._emitir(`U${d.umbrales.join(',')},${d.histeresis},${d.ventana * d.periodoMs}`);
  }

  _sonido() {
    this._emitir(this.modoDatos ? `S${this.melodia ? 1 : 0}`
      : `Sonido de la alarma: ${this.melodia ? 'melodia' : 'pitido continuo'}`);
  }

  // Acepta los mismos comandos que la placa (los relevantes para el panel)
  async send(texto) {
    const t = texto.trim();
    if (/^u/i.test(t)) {
      const v = (t.match(/\d+/g) || []).map(Number);
      const ok = v.length === 5 && v.every((x, i) => x >= 1 && x <= 1023 && (i === 0 || x > v[i - 1]));
      if (!ok) {
        this._emitir(tr('Error: umbrales fuera de rango (1-1023) o no van de menor a mayor.'));
        return;
      }
      this.det.umbrales = v;
      this._emitir(tr('Umbrales actualizados.'));
      if (this.modoDatos) this._config();
      return;
    }
    for (const c of t.toLowerCase()) {
      if (c === 'd') { this.modoDatos = true; this._config(); this._sonido(); }
      else if (c === 't') { this.modoDatos = false; this._emitir(tr('Modo texto.')); }
      else if (c === 'v') { this._config(); this._sonido(); }
      else if (c === 'm' || c === 'b') { this.melodia = c === 'm'; this._sonido(); }
      else if (c === 'r') {
        this.det.umbrales = [...POR_DEFECTO.umbrales];
        this._emitir(tr('Umbrales por defecto restaurados.'));
        this._config();
      } else if (c === 'h') this._emitir(tr('Simulador: comandos d, t, v, r, m, b, u10,16,23,31,40'));
    }
  }
}
