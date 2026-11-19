// Utilidades compartidas: formatos, nombres de nivel, CSV y almacenamiento local.

import { lang } from './i18n.js';

export const NOMBRES_NIVEL = ['Sin movimiento', 'Muy leve', 'Leve', 'Moderado', 'Fuerte', 'Muy fuerte'];

export const $ = (id) => document.getElementById(id);

export function fmtNum(n, dec = 1) {
  return Number.isFinite(n) ? n.toFixed(dec).replace('.', lang === 'en' ? '.' : ',') : '–';
}

export function fmtSeg(ms) {
  return `${fmtNum(ms / 1000, 1)} s`;
}

export function fmtHora(fecha) {
  return new Date(fecha).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtReloj(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${ss}`;
}

// CSV con ';' (Excel en español lo abre en columnas directamente)
export function descargarCSV(nombre, filas) {
  const csv = filas
    .map((fila) => fila.map((c) => {
      const s = String(c ?? '');
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';'))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function marcaArchivo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// localStorage puede no estar disponible (modo privado, bloqueos): nunca debe romper la app
export const almacen = {
  leer(clave, porDefecto) {
    try {
      const v = localStorage.getItem(clave);
      return v == null ? porDefecto : JSON.parse(v);
    } catch {
      return porDefecto;
    }
  },
  guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
  },
};
