// Pestana "El proyecto": calculadora de corriente (ley de Ohm), simulador de niveles y descarga de tablas en CSV.

import { $, NOMBRES_NIVEL, descargarCSV } from './util.js';
import { t, lang } from './i18n.js';

const UMBRALES = [10, 16, 22, 28, 34];     // valores por defecto del sketch
const VREF = 5;
const ADC = 1023;
const LIMITE_MA = 20;

// ---------- Calculadora de corriente en un LED ----------
function initOhm() {
  const sel = $('ohm-led');
  const vcc = $('ohm-vcc');
  const res = $('ohm-r');
  if (!sel) return;

  function calcular() {
    const vf = Number(sel.value);
    const v = Number(vcc.value);
    const r = Number(res.value);
    $('ohm-vcc-v').textContent = `${v.toFixed(1)} V`;
    $('ohm-r-v').textContent = `${r} Ω`;

    const i = Math.max(0, (v - vf) / r);          // amperios
    const ma = i * 1000;
    const pmw = i * i * r * 1000;                 // potencia en la resistencia, mW
    $('ohm-i').textContent = ma.toFixed(1).replace('.', lang === 'en' ? '.' : ',');
    $('ohm-p').textContent = `${pmw.toFixed(0)} mW`;
    $('ohm-bar').style.width = `${Math.min(100, (ma / 30) * 100)}%`;

    let estado = 'ok';
    let texto = t('Seguro');
    if (v <= vf) { estado = 'off'; texto = t('El LED no enciende: el voltaje no supera al del LED'); }
    else if (ma > LIMITE_MA) { estado = 'peligro'; texto = t('Supera los 20 mA: puede dañar el pin'); }
    else if (ma > 15) { estado = 'alto'; texto = t('Cerca del límite'); }
    else if (ma < 3) { estado = 'tenue'; texto = t('Muy tenue: casi no se ve'); }
    const v8 = $('ohm-veredicto');
    v8.textContent = texto;
    v8.dataset.estado = estado;
  }
  [sel, vcc, res].forEach((el) => el.addEventListener('input', calcular));
  window.addEventListener('idioma', calcular);
  calcular();
}

// ---------- Simulador de niveles ----------
const nivelDe = (variacion) => UMBRALES.filter((u) => variacion >= u).length;

function initSim() {
  const rango = $('sim-var');
  if (!rango) return;
  const leds = [...document.querySelectorAll('#sim-leds .sled')];

  function pintar() {
    const dn = Number(rango.value);
    const nivel = nivelDe(dn);
    $('sim-var-v').textContent = `${dn} u`;
    $('sim-dv').textContent = `${((dn * VREF) / ADC).toFixed(3)} V`;
    $('sim-nivel').textContent = nivel;
    $('sim-nombre').textContent = NOMBRES_NIVEL[nivel];
    $('sim').dataset.level = String(nivel);
    // Como el sketch: solo se enciende el LED del nivel; el zumbador se suma en el nivel 5
    leds.forEach((l) => {
      const n = Number(l.dataset.n);
      l.classList.toggle('on', n === 5 ? nivel === 5 : Math.min(nivel, 4) === n);
    });
    document.querySelectorAll('#sim-presets button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === dn)));
  }
  rango.addEventListener('input', pintar);
  document.querySelectorAll('#sim-presets button').forEach((b) => b.addEventListener('click', () => { rango.value = b.dataset.v; pintar(); }));
  window.addEventListener('idioma', pintar);
  pintar();
}

// ---------- CSV con las tablas del informe ----------
function filasCSV() {
  const dv = (n) => ((n * VREF) / ADC).toFixed(3);
  const f = [];
  f.push([t('Umbrales de calibración')]);
  f.push([t('Nivel de alerta'), t('Variación desde (u)'), t('Variación hasta (u)'), t('Cambio de voltaje ΔV (V)'), t('Salidas activas'), t('Significado operativo')]);
  const sig = ['Normal (sin riesgo)', 'Advertencia leve', 'Vibración baja (precaución)', 'Vibración media (posible desalojo parcial)', 'Vibración alta (preparar evacuación)', 'Vibración muy fuerte (evacuación total)'];
  const sal = ['Ninguna', 'LED 1', 'LED 2', 'LED 3', 'LED 4', 'LED 4 + zumbador'];
  for (let n = 0; n <= 5; n++) {
    const desde = n === 0 ? 0 : UMBRALES[n - 1];
    const hasta = n === 5 ? '' : UMBRALES[n] - 1;
    f.push([n, desde, hasta, n === 0 ? '' : dv(desde), t(sal[n]), t(sig[n])]);
  }
  f.push([]);
  f.push([t('Tiempo de activación (programa con señales simuladas)')]);
  f.push([t('Nivel de alerta'), t('Amplitud de oscilación (u)'), t('Tiempo de activación (s)')]);
  [[1, 6, 0.38], [2, 9, 0.42], [3, 12, 0.42], [4, 15, 0.56], [5, 19, 0.42]].forEach((r) => f.push(r));
  f.push([]);
  f.push([t('Corriente por LED y potencia en la resistencia de 220 Ω')]);
  f.push([t('Tipo de LED'), t('Voltaje del LED (V)'), t('Corriente (mA)'), t('Potencia (W)')]);
  f.push([t('Azul / blanco'), 3.0, 9.1, 0.018]);
  f.push([t('Rojo'), 2.0, 13.6, 0.041]);
  return f;
}

function initCSV() {
  const b = $('btn-csv-proyecto');
  if (!b) return;
  b.addEventListener('click', () => {
    descargarCSV(lang === 'en' ? 'tremor-indicator-tables.csv' : 'indicador-temblores-tablas.csv', filasCSV());
    const original = b.textContent;
    b.textContent = t('Descargado');
    setTimeout(() => { b.textContent = original; }, 1800);
  });
}

export function initProyecto() {
  initOhm();
  initSim();
  initCSV();
}
