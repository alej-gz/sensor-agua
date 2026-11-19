// Replica en JavaScript la logica del sketch (sensor_agua.ino).
// La usa el simulador para que la demo se comporte igual que la placa,
// y sirve como documentacion del algoritmo para revisarlo.

export const POR_DEFECTO = {
  umbrales: [10, 16, 22, 28, 34], // variacion minima para cada nivel
  histeresis: 3,                  // puntos por debajo del umbral para apagar
  ruido: 4,                       // cambios entre lecturas <= a esto no cuentan como actividad
  factorActividad: 0.6,           // peso de la actividad frente al rango
  ventana: 30,                    // lecturas en la ventana (30 x 20 ms = 0,6 s)
  periodoMs: 20,                  // una lectura cada 20 ms
  retencionMs: 2500,              // tiempo que se mantiene el nivel maximo
  bajadaMs: 400,                  // luego baja un nivel cada este tiempo
  finSismoMs: 3000,               // quieto este tiempo = fin del temblor
  alarmaMinMs: 3000,              // el buzzer suena al menos este tiempo
};

export class Detector {
  constructor(opciones = {}) {
    Object.assign(this, structuredClone(POR_DEFECTO), opciones);
    this.reiniciar();
  }

  reiniciar() {
    this.buf = [];
    this.activo = [false, false, false, false, false];
    this.nivelMostrado = 0;
    this.msNivel = 0;
    this.msAlarma = 0;
    this.enSismo = false;
    this.msInicio = 0;
    this.msUltimoMov = 0;
    this.osc = 0;
    this.nivelMax = 0;
    this.varMax = 0;
    this.lMin = 1023;
    this.lMax = 0;
    this.subiendo = true;
    this.extremo = null;
  }

  // Procesa una lectura en el instante `ahora` (ms). Devuelve el estado y los eventos.
  paso(lectura, ahora) {
    const eventos = [];

    // 1) Variacion = el mayor entre el rango (maximo - minimo de las ultimas `ventana`
    //    lecturas) y la actividad (suma de cambios entre lecturas seguidas mayores que
    //    `ruido`, por `factorActividad` / 2). Igual que calcularVariacion() del sketch.
    this.buf.push(lectura);
    if (this.buf.length > this.ventana) this.buf.shift();
    let variacion = 0;
    if (this.buf.length >= 2) {
      const rango = Math.max(...this.buf) - Math.min(...this.buf);
      let recorrido = 0;
      for (let i = 1; i < this.buf.length; i++) {
        const d = Math.abs(this.buf[i] - this.buf[i - 1]);
        if (d > this.ruido) recorrido += d - this.ruido;
      }
      const actividad = Math.trunc((recorrido * this.factorActividad) / 2);
      variacion = Math.min(Math.max(rango, actividad), 1023);
    }

    // 2) Nivel instantaneo con histeresis
    let inst = 0;
    for (let i = 0; i < 5; i++) {
      const u = this.umbrales[i];
      if (!this.activo[i] && variacion >= u) this.activo[i] = true;
      else if (this.activo[i] && variacion < u - this.histeresis) this.activo[i] = false;
      if (this.activo[i]) inst = i + 1;
    }

    // 3) Inicio / continuidad del temblor
    const moviendo = this.activo[0];
    if (moviendo) {
      if (!this.enSismo) {
        this.enSismo = true;
        this.msInicio = ahora;
        this.osc = 0;
        this.nivelMax = 0;
        this.varMax = 0;
        this.lMin = 1023;
        this.lMax = 0;
        eventos.push({ type: 'start' });
      }
      this.msUltimoMov = ahora;
    }

    // 4) Oscilaciones: pico seguido de una bajada mayor que medio umbral N1
    const h = Math.max(2, Math.floor(this.umbrales[0] / 2));
    if (this.extremo === null) this.extremo = lectura;
    if (this.subiendo) {
      if (lectura > this.extremo) this.extremo = lectura;
      else if (lectura < this.extremo - h) {
        if (this.enSismo) this.osc++;
        this.subiendo = false;
        this.extremo = lectura;
      }
    } else if (lectura < this.extremo) {
      this.extremo = lectura;
    } else if (lectura > this.extremo + h) {
      this.subiendo = true;
      this.extremo = lectura;
    }

    // 5) Estadisticas y fin del temblor
    if (this.enSismo) {
      this.nivelMax = Math.max(this.nivelMax, inst);
      this.varMax = Math.max(this.varMax, variacion);
      this.lMin = Math.min(this.lMin, lectura);
      this.lMax = Math.max(this.lMax, lectura);
      if (!moviendo && ahora - this.msUltimoMov >= this.finSismoMs) {
        eventos.push({
          type: 'end',
          duracionMs: this.msUltimoMov - this.msInicio,
          oscilaciones: this.osc,
          nivelMax: this.nivelMax,
          variacionMax: this.varMax,
          lecturaMin: this.lMin,
          lecturaMax: this.lMax,
        });
        this.enSismo = false;
      }
    }

    // 6) Retencion del nivel maximo (sube al instante, baja despacio)
    if (inst >= this.nivelMostrado) {
      if (inst >= 5 && this.nivelMostrado < 5) this.msAlarma = ahora;
      this.nivelMostrado = inst;
      this.msNivel = ahora;
    } else if (ahora - this.msNivel >= this.retencionMs) {
      this.nivelMostrado--;
      this.msNivel = ahora - this.retencionMs + this.bajadaMs;
      if (this.nivelMostrado < inst) this.nivelMostrado = inst;
    }

    // 7) Alarma (buzzer)
    const alarma = this.nivelMostrado >= 5 || (this.msAlarma !== 0 && ahora - this.msAlarma < this.alarmaMinMs);
    if (!alarma) this.msAlarma = 0;

    return { lectura, variacion, nivel: this.nivelMostrado, buzzer: alarma, sismo: this.enSismo, eventos };
  }
}
