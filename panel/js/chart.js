// Grafica de series en el tiempo sobre <canvas>, sin dependencias.
// Eje X: segundos hacia atras desde "ahora". Eje Y: fijo o automatico.

function pasoBonito(rango) {
  const bruto = rango / 5;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

export class TimeChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{series: {clave: string, color: string, ancho?: number}[], yMin?: number, yMax?: number,
   *          spanMin?: number, cero?: boolean}} opciones
   */
  constructor(canvas, opciones) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.o = { spanMin: 10, cero: false, ...opciones };
    this.lineas = [];       // umbrales: [{valor, etiqueta, color}]
    this.pad = { l: 46, r: 46, t: 12, b: 24 };
    new ResizeObserver(() => this._medir()).observe(canvas);
    this._medir();
  }

  _medir() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this._ultimo) this.dibujar(...this._ultimo);
  }

  setLineas(lineas) {
    this.lineas = lineas || [];
  }

  /**
   * @param {number[]} t        tiempos (ms) en orden cronologico
   * @param {Object<string, number[]>} datos  valores por clave de serie
   * @param {number} ventanaMs  ancho de la ventana visible
   */
  dibujar(t, datos, ventanaMs) {
    this._ultimo = [t, datos, ventanaMs];
    const { ctx, w, h, pad } = this;
    if (!w || !h) return;
    const css = getComputedStyle(this.canvas);
    const color = (v) => (v.startsWith('--') ? css.getPropertyValue(v).trim() : v);
    const cGrid = color('--chart-grid');
    const cAxis = color('--chart-axis');
    const cText = color('--chart-text');

    ctx.clearRect(0, 0, w, h);
    const x0 = pad.l;
    const x1 = w - pad.r;
    const y0 = pad.t;
    const y1 = h - pad.b;

    // Rango Y
    let min = Infinity;
    let max = -Infinity;
    if (this.o.yMin != null && this.o.yMax != null) {
      min = this.o.yMin;
      max = this.o.yMax;
    } else {
      for (const s of this.o.series) for (const v of datos[s.clave] || []) { if (v < min) min = v; if (v > max) max = v; }
      for (const l of this.lineas) { if (l.valor < min) min = l.valor; if (l.valor > max) max = l.valor; }
      if (!Number.isFinite(min)) { min = 0; max = this.o.spanMin; }
      if (this.o.cero) min = Math.min(0, min);
      const span = Math.max(this.o.spanMin, max - min);
      const centro = (max + min) / 2;
      min = this.o.cero ? min : centro - span / 2;
      max = this.o.cero ? Math.max(max, min + span) : centro + span / 2;
      const margen = (max - min) * 0.1;
      max += margen;
      if (!this.o.cero) min -= margen;
    }
    const yDe = (v) => y1 - ((v - min) / (max - min)) * (y1 - y0);

    // Rejilla horizontal + etiquetas
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    const paso = pasoBonito(max - min);
    ctx.textAlign = 'right';
    for (let v = Math.ceil(min / paso) * paso; v <= max; v += paso) {
      const y = Math.round(yDe(v)) + 0.5;
      ctx.strokeStyle = cGrid;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillStyle = cText;
      ctx.fillText(String(Math.round(v * 100) / 100), x0 - 8, y);
    }

    // Rejilla vertical (segundos hacia atras)
    const tFin = t.length ? t[t.length - 1] : 0;
    const xDe = (ti) => x1 - ((tFin - ti) / ventanaMs) * (x1 - x0);
    const pasoS = ventanaMs <= 10000 ? 2 : ventanaMs <= 30000 ? 5 : ventanaMs <= 60000 ? 10 : 20;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let s = 0; s * 1000 <= ventanaMs; s += pasoS) {
      const x = Math.round(x1 - (s * 1000 / ventanaMs) * (x1 - x0)) + 0.5;
      ctx.strokeStyle = cGrid;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      ctx.fillStyle = cText;
      ctx.fillText(s === 0 ? 'ahora' : `−${s} s`, x, y1 + 6);
    }
    ctx.strokeStyle = cAxis;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);

    // Lineas de umbral
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const l of this.lineas) {
      const y = Math.round(yDe(l.valor)) + 0.5;
      if (y < y0 || y > y1) continue;
      ctx.strokeStyle = color(l.color);
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color(l.color);
      ctx.fillText(l.etiqueta, x1 + 6, y);
    }

    // Series
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.lineJoin = 'round';
    for (const s of this.o.series) {
      const valores = datos[s.clave] || [];
      if (valores.length < 2) continue;
      ctx.strokeStyle = color(s.color);
      ctx.lineWidth = s.ancho || 1.6;
      ctx.beginPath();
      for (let i = 0; i < valores.length; i++) {
        const x = xDe(t[i]);
        const y = yDe(valores[i]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    if (!t.length) {
      ctx.fillStyle = cText;
      ctx.textAlign = 'center';
      ctx.font = '13px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('Sin datos: conecta la placa o abre la demo', (x0 + x1) / 2, (y0 + y1) / 2);
    }
  }
}
