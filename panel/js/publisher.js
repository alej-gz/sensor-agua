// Envia por internet las lineas de la placa para que todos los visitantes las vean en vivo.
// Solo funciona con la clave de transmision (la define quien publica el panel en Vercel).

const CLAVE_LS = 'sensorAgua.clave';
const ENVIO_MS = 1000;   // un lote por segundo: la mitad de escrituras en Redis que con 500 ms

export class Publicador extends EventTarget {
  activo = false;

  _clave() {
    try { return localStorage.getItem(CLAVE_LS) || ''; } catch { return ''; }
  }

  // Comprueba la clave en el servidor (publicar sin lineas solo la valida)
  async autorizar() {
    let clave = this._clave();
    if (!clave) {
      clave = (window.prompt('Clave de acceso:') || '').trim();
      if (!clave) return false;
    }
    try {
      const r = await fetch('/api/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-clave': clave },
        body: JSON.stringify({ lineas: [] }),
      });
      if (r.status === 401) {
        try { localStorage.removeItem(CLAVE_LS); } catch { /* ignorar */ }
        return false;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      try { localStorage.setItem(CLAVE_LS, clave); } catch { /* sin almacenamiento */ }
      return true;
    } catch {
      return false;
    }
  }

  iniciar() {
    let clave = this._clave();
    if (!clave) {
      clave = (window.prompt('Clave de transmisión:') || '').trim();
      if (!clave) return false;
      try { localStorage.setItem(CLAVE_LS, clave); } catch { /* sin almacenamiento */ }
    }
    this._buf = [];
    this._fallos = 0;
    this.activo = true;
    this._timer = setInterval(() => this._enviar(), ENVIO_MS);
    this.dispatchEvent(new Event('cambio'));
    return true;
  }

  detener() {
    this.activo = false;
    clearInterval(this._timer);
    this._buf = [];
    this.dispatchEvent(new Event('cambio'));
  }

  // Se llama con cada linea que llega de la placa
  push(linea) {
    if (!this.activo || !/^[DEUS]/.test(linea)) return;
    this._buf.push(linea);
    if (this._buf.length > 600) this._buf.splice(0, this._buf.length - 600);
  }

  async _enviar() {
    if (!this._buf.length || this._enviando) return;
    this._enviando = true;
    const lineas = this._buf.splice(0, 300);
    try {
      const r = await fetch('/api/publicar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-clave': this._clave() },
        body: JSON.stringify({ lineas }),
      });
      if (r.status === 401) {
        try { localStorage.removeItem(CLAVE_LS); } catch { /* ignorar */ }
        this.detener();
        this.dispatchEvent(new CustomEvent('fallo', { detail: 'Clave incorrecta. Vuelve a pulsar «Transmitir en vivo».' }));
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      this._fallos = 0;
    } catch (e) {
      this._fallos++;
      if (this._fallos === 5) this.dispatchEvent(new CustomEvent('fallo', { detail: `No se puede transmitir: ${e.message}` }));
    } finally {
      this._enviando = false;
    }
  }
}
