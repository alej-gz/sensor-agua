// Fuente "en vivo" para los visitantes: recibe por internet lo que transmite el panel del presentador.
// Misma interfaz que SerialSource / SimSource: emite 'line' (texto del protocolo de la placa).
// Ademas emite 'estado' (detail = true/false) cuando el presentador empieza o deja de transmitir.

const SONDEO_MS = 1000;
const MAX_COLA = 400;

export class RemoteSource extends EventTarget {
  kind = 'remote';
  vivo = false;

  async connect() {
    this._cola = [];
    this._total = null;
    this._activo = true;
    this._primera = true;
    await this._sondear();
    this._sondeo = setInterval(() => this._sondear(), SONDEO_MS);
    // Las muestras llegan en bloques de 1 s: se reparten a 20 ms para que la grafica fluya
    this._reloj = setInterval(() => this._reproducir(), 20);
  }

  async _sondear() {
    try {
      const r = await fetch('/api/estado', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!this._activo) return;

      const vivo = d.edadMs !== null && d.edadMs < 8000;
      if (vivo !== this.vivo || this._primera) {
        this.vivo = vivo;
        this.dispatchEvent(new CustomEvent('estado', { detail: vivo }));
      }
      this._primera = false;
      if (!vivo) { this._total = null; return; }

      if (this._total === null) {
        // Primera vez: configuracion de la placa y solo ~2 s de historia
        d.cfg.forEach((l) => this.dispatchEvent(new CustomEvent('line', { detail: l })));
        this._total = d.total;
        this._cola.push(...d.lineas.slice(-100));
      } else {
        const nuevas = d.total - this._total;
        if (nuevas > 0) this._cola.push(...d.lineas.slice(-Math.min(nuevas, d.lineas.length)));
        this._total = d.total;
      }
      if (this._cola.length > MAX_COLA) this._cola.splice(0, this._cola.length - MAX_COLA);
    } catch (e) {
      this.dispatchEvent(new CustomEvent('error', { detail: e }));
    }
  }

  _reproducir() {
    // Si se acumula retraso, se acelera un poco para alcanzar el vivo
    const n = this._cola.length > 150 ? 3 : this._cola.length > 75 ? 2 : 1;
    for (let k = 0; k < n && this._cola.length; k++) {
      this.dispatchEvent(new CustomEvent('line', { detail: this._cola.shift() }));
    }
  }

  async send() {
    throw new Error('Estás viendo la transmisión en vivo: solo lectura');
  }

  async disconnect() {
    this._activo = false;
    clearInterval(this._sondeo);
    clearInterval(this._reloj);
  }
}
