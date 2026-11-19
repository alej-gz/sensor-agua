// Conexion con la placa por USB usando Web Serial (Chrome o Edge).
// Emite: 'line' (detail = texto de la linea), 'close', 'error' (detail = Error).

export class SerialSource extends EventTarget {
  kind = 'serial';

  static soportado() {
    return 'serial' in navigator;
  }

  async connect() {
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: 9600 });
    this._cerrando = false;
    this._cola = Promise.resolve();
    this._leer();
    // El UNO se reinicia al abrir el puerto: esperar a que arranque y pedir el modo datos
    this._timer = setTimeout(() => this.send('d'), 2300);
  }

  async _leer() {
    const decoder = new TextDecoderStream();
    this._tuberia = this.port.readable.pipeTo(decoder.writable).catch(() => {});
    this._reader = decoder.readable.getReader();
    let resto = '';
    try {
      for (;;) {
        const { value, done } = await this._reader.read();
        if (done) break;
        resto += value;
        let i;
        while ((i = resto.indexOf('\n')) >= 0) {
          const linea = resto.slice(0, i).replace(/\r$/, '');
          resto = resto.slice(i + 1);
          this.dispatchEvent(new CustomEvent('line', { detail: linea }));
        }
        if (resto.length > 4096) resto = ''; // basura sin saltos de linea
      }
    } catch (e) {
      if (!this._cerrando) this.dispatchEvent(new CustomEvent('error', { detail: e }));
    } finally {
      try { this._reader.releaseLock(); } catch { /* ya liberado */ }
    }
    if (!this._cerrando) {
      // Se desconecto el cable o fallo la lectura
      try { await this.port.close(); } catch { /* ignorar */ }
      this.dispatchEvent(new Event('close'));
    }
  }

  // Los envios se encolan para que nunca se pisen dos escrituras
  send(texto) {
    this._cola = this._cola.then(async () => {
      if (!this.port?.writable) throw new Error('Puerto cerrado');
      const w = this.port.writable.getWriter();
      try {
        await w.write(new TextEncoder().encode(texto));
      } finally {
        w.releaseLock();
      }
    });
    return this._cola;
  }

  async disconnect() {
    this._cerrando = true;
    clearTimeout(this._timer);
    try { await this._reader?.cancel(); } catch { /* ignorar */ }
    try { await this._tuberia; } catch { /* ignorar */ }
    try { await this.port?.close(); } catch { /* ignorar */ }
    this.dispatchEvent(new Event('close'));
  }
}
