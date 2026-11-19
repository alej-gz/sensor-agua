// Alarma sonora en el navegador (pitido intermitente mientras el buzzer de la placa suena).

export class AlarmaSonora {
  activa = false;
  sonando = false;

  setActiva(valor) {
    this.activa = valor;
    if (valor) this._contexto(); // desbloquear audio con el gesto del usuario
    if (!valor) this._parar();
  }

  actualizar(buzzer) {
    if (this.activa && buzzer && !this.sonando) this._iniciar();
    else if ((!buzzer || !this.activa) && this.sonando) this._parar();
  }

  _contexto() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  _iniciar() {
    const ctx = this._contexto();
    if (!ctx) return;
    this.sonando = true;
    this.osc = ctx.createOscillator();
    this.gain = ctx.createGain();
    this.osc.type = 'square';
    this.osc.frequency.value = 1800;
    this.gain.gain.value = 0;
    this.osc.connect(this.gain).connect(ctx.destination);
    this.osc.start();
    let on = false;
    this.intervalo = setInterval(() => {
      on = !on;
      this.gain.gain.setTargetAtTime(on ? 0.06 : 0, ctx.currentTime, 0.01);
    }, 220);
  }

  _parar() {
    this.sonando = false;
    clearInterval(this.intervalo);
    try { this.osc?.stop(); } catch { /* ya detenido */ }
    this.osc = null;
  }
}
