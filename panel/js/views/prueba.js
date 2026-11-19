// Vista "Modo prueba": graficas en vivo, estadisticas, grabacion, umbrales y consola.

import { $, NOMBRES_NIVEL, fmtNum, fmtHora, fmtReloj, descargarCSV, marcaArchivo } from '../util.js';
import { TimeChart } from '../chart.js';
import { t, lang } from '../i18n.js';

const loc = () => (lang === 'en' ? 'en-GB' : 'es');
const COLORES_NIVEL = ['--lv0', '--lv1', '--lv2', '--lv3', '--lv4', '--lv5'];

export function initPrueba(store, ui) {
  let ventanaMs = 30000;
  let pausado = false;
  let visible = false;

  const chartLect = new TimeChart($('chart-read'), {
    series: [{ clave: 'lect', color: '--series-read', ancho: 1.6 }],
    spanMin: 12,
  });
  const chartVar = new TimeChart($('chart-var'), {
    series: [{ clave: 'vari', color: '--series-var', ancho: 1.8 }],
    spanMin: 20,
    cero: true,
  });

  // --- Ventana de tiempo y pausa ---
  const botonesVentana = [...document.querySelectorAll('#win-seg button')];
  botonesVentana.forEach((b) => b.addEventListener('click', () => {
    ventanaMs = Number(b.dataset.win) * 1000;
    botonesVentana.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    dibujar();
    renderStats();
  }));

  $('btn-pause').addEventListener('click', (e) => {
    pausado = !pausado;
    e.currentTarget.textContent = t(pausado ? 'Reanudar gráficas' : 'Pausar gráficas');
  });

  // --- Graficas (a ~30 fps mientras la vista esta visible) ---
  function dibujar() {
    const w = store.ventana(ventanaMs);
    chartLect.dibujar(w.t, { lect: w.lect }, ventanaMs);
    chartVar.dibujar(w.t, { vari: w.vari }, ventanaMs);
  }

  let ultimoFrame = 0;
  function bucle(ts) {
    if (visible && !pausado && ts - ultimoFrame > 33) {
      ultimoFrame = ts;
      dibujar();
    }
    requestAnimationFrame(bucle);
  }
  requestAnimationFrame(bucle);

  function aplicarUmbralesEnGrafica() {
    chartVar.setLineas((store.umbrales || []).map((u, i) => ({
      valor: u, etiqueta: `N${i + 1} ${u}`, color: COLORES_NIVEL[i + 1],
    })));
    const meta = $('th-meta');
    if (store.umbrales) {
      store.umbrales.forEach((u, i) => { $(`th-${i + 1}`).value = u; });
      meta.textContent = `${t('Histéresis')}: ${store.histeresis ?? '–'} ${t('puntos')} · ${t('Ventana de variación')}: ${store.ventanaMs ?? '–'} ms`;
      $('win-info').textContent = store.ventanaMs ? `· ${t('ventana')} ${store.ventanaMs} ms` : '';
    }
  }

  // --- Estadisticas ---
  function renderStats() {
    const w = store.ventana(ventanaMs);
    const n = w.lect.length;
    $('st-rate').textContent = ui.conectado ? `${fmtNum(store.frecuencia(), 1)} Hz` : '–';
    $('st-n').textContent = n ? n.toLocaleString(loc()) : '–';
    if (!n) {
      ['st-minmax', 'st-mean', 'st-sd', 'st-var', 'st-level'].forEach((id) => { $(id).textContent = '–'; });
    } else {
      let min = Infinity; let max = -Infinity; let suma = 0; let sumaV = 0; let maxV = 0;
      for (let i = 0; i < n; i++) {
        const v = w.lect[i];
        if (v < min) min = v;
        if (v > max) max = v;
        suma += v;
        sumaV += w.vari[i];
        if (w.vari[i] > maxV) maxV = w.vari[i];
      }
      const media = suma / n;
      let sq = 0;
      for (let i = 0; i < n; i++) sq += (w.lect[i] - media) ** 2;
      $('st-minmax').textContent = `${min} / ${max}`;
      $('st-mean').textContent = fmtNum(media, 1);
      $('st-sd').textContent = fmtNum(Math.sqrt(sq / n), 2);
      $('st-var').textContent = `${fmtNum(sumaV / n, 1)} / ${maxV}`;
      const s = store.actual;
      $('st-level').textContent = s ? `${s.nivel} · ${NOMBRES_NIVEL[s.nivel]}` : '–';
    }

    // Tiempo en cada nivel
    const total = store.nivelMs.reduce((a, b) => a + b, 0);
    store.nivelMs.forEach((ms, i) => {
      const pct = total ? (ms / total) * 100 : 0;
      barras[i].bar.style.width = `${pct}%`;
      barras[i].pct.textContent = `${fmtNum(pct, 1)} %`;
      barras[i].fila.title = `${NOMBRES_NIVEL[i]}: ${fmtReloj(ms)}`;
    });

    // Grabacion
    if (store.grabando) {
      $('rec-info').textContent = `${t('Grabando')} · ${store.grabacion.length.toLocaleString(loc())} ${t('muestras')} · ${fmtReloj(store.grabacion.length * 20)}`;
    }
  }

  const barras = [];
  const cont = $('level-bars');
  for (let i = 0; i <= 5; i++) {
    const fila = document.createElement('div');
    fila.className = 'lb';
    fila.dataset.level = String(i);
    fila.innerHTML = `<b>${i}</b><span class="bar"><i></i></span><span class="pct">0 %</span>`;
    cont.appendChild(fila);
    barras.push({ fila, bar: fila.querySelector('i'), pct: fila.querySelector('.pct') });
  }
  $('btn-reset-levels').addEventListener('click', () => { store.reiniciarNiveles(); renderStats(); });
  setInterval(() => { if (visible) renderStats(); }, 250);

  // --- Grabacion ---
  const btnRec = $('btn-rec');
  btnRec.addEventListener('click', () => {
    if (store.grabando) store.detenerGrabacion();
    else store.iniciarGrabacion();
  });
  store.addEventListener('recording', () => {
    btnRec.setAttribute('aria-pressed', String(store.grabando));
    btnRec.lastChild.textContent = t(store.grabando ? 'Detener' : 'Grabar');
    $('btn-export-rec').disabled = store.grabacion.length === 0 && !store.grabando;
    if (!store.grabando) {
      $('rec-info').textContent = store.grabacion.length
        ? `${t('Grabación lista')} · ${store.grabacion.length.toLocaleString(loc())} ${t('muestras')}`
        : t('Sin grabación');
    }
  });
  $('btn-export-rec').addEventListener('click', () => {
    if (!store.grabacion.length) return;
    descargarCSV(`grabacion-sensor-${marcaArchivo()}.csv`, [
      ['fecha_hora', 't_ms', 'lectura', 'variacion', 'nivel', 'buzzer', 'temblor'],
      ...store.grabacion,
    ]);
  });

  // --- Temblores de la sesion ---
  function renderTemblores() {
    const filas = store.sesion.temblores;
    const tbody = $('tremor-rows');
    tbody.innerHTML = '';
    for (const r of [...filas].reverse()) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.n}</td><td>${fmtHora(r.inicio)}</td><td>${fmtNum(r.duracionMs / 1000, 1)} s</td>
        <td>${r.oscilaciones}</td><td>${fmtNum(r.oscPorSeg, 1)}</td>
        <td><span class="chip" data-level="${r.nivelMax}">${r.nivelMax}</span></td>
        <td>${r.variacionMax}</td><td>${r.lecturaMin}</td><td>${r.lecturaMax}</td>`;
      tbody.appendChild(tr);
    }
    $('tremor-empty').hidden = filas.length > 0;
    $('btn-export-tremors').disabled = filas.length === 0;
  }
  $('btn-export-tremors').addEventListener('click', () => {
    descargarCSV(`temblores-${marcaArchivo()}.csv`, [
      ['n', 'hora', 'duracion_ms', 'oscilaciones', 'osc_por_seg', 'nivel_max', 'variacion_max', 'lectura_min', 'lectura_max'],
      ...store.sesion.temblores.map((r) => [
        r.n, new Date(r.inicio).toISOString(), r.duracionMs, r.oscilaciones,
        fmtNum(r.oscPorSeg, 2), r.nivelMax, r.variacionMax, r.lecturaMin, r.lecturaMax,
      ]),
    ]);
  });

  // --- Umbrales ---
  const msg = $('th-msg');
  const aviso = (texto, tipo = '') => { msg.textContent = texto; msg.className = `small ${tipo}`; };

  $('btn-th-send').addEventListener('click', async () => {
    const v = [1, 2, 3, 4, 5].map((i) => Number($(`th-${i}`).value));
    const ok = v.every((x, i) => Number.isInteger(x) && x >= 1 && x <= 1023 && (i === 0 || x > v[i - 1]));
    if (!ok) { aviso(t('Los umbrales deben ser enteros de 1 a 1023 y de menor a mayor.'), 'err'); return; }
    if (await ui.enviar(`u${v.join(',')}\n`)) aviso(t('Enviado. La placa los guarda en su memoria (EEPROM).'), 'ok');
    else aviso(t('No hay conexión con la placa.'), 'err');
  });
  $('btn-th-read').addEventListener('click', async () => {
    if (await ui.enviar('v')) aviso(t('Umbrales leídos de la placa.'), 'ok');
    else aviso(t('No hay conexión con la placa.'), 'err');
  });
  $('btn-th-reset').addEventListener('click', async () => {
    if (!confirm(t('¿Restaurar los umbrales por defecto en la placa?'))) return;
    if (await ui.enviar('r')) aviso(t('Restaurados los valores por defecto.'), 'ok');
    else aviso(t('No hay conexión con la placa.'), 'err');
  });

  // --- Sonido de la alarma (pitido o melodia) ---
  const optMelodia = $('opt-melody');
  const msgMelodia = $('melody-msg');
  function pintarSonido() {
    optMelodia.disabled = !ui.conectado;
    if (store.melodia === null) {
      optMelodia.checked = false;
      msgMelodia.textContent = ui.conectado
        ? t('Esperando el estado de la placa… (si no aparece, carga el sketch actualizado).')
        : t('Conecta la placa para elegir el sonido.');
      return;
    }
    optMelodia.checked = store.melodia;
    msgMelodia.textContent = store.melodia
      ? t('Activado: en el nivel 5 suena la melodía. La placa lo guarda en su memoria.')
      : t('Desactivado: en el nivel 5 suena el pitido continuo.');
  }
  optMelodia.addEventListener('change', async () => {
    const quiero = optMelodia.checked;
    msgMelodia.textContent = t('Enviado, esperando confirmación de la placa…');  // la respuesta 'S' lo reemplaza
    if (!(await ui.enviar(quiero ? 'm' : 'b'))) {
      optMelodia.checked = !quiero;
      msgMelodia.textContent = t('No hay conexión con la placa.');
    }
  });
  store.addEventListener('sound', pintarSonido);
  ui.eventos.addEventListener('conexion', pintarSonido);

  // --- Consola ---
  const log = $('log');
  function agregarLinea({ texto, clase }) {
    const pegado = log.scrollTop + log.clientHeight >= log.scrollHeight - 8;
    const div = document.createElement('div');
    if (clase) div.className = clase;
    div.textContent = texto;
    log.appendChild(div);
    while (log.childElementCount > 400) log.firstChild.remove();
    if (pegado) log.scrollTop = log.scrollHeight;
  }
  store.addEventListener('log', (e) => agregarLinea(e.detail));
  $('btn-clear-log').addEventListener('click', () => { log.innerHTML = ''; });
  $('cmd-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('cmd-input');
    const texto = input.value.trim();
    if (!texto) return;
    if (!(await ui.enviar(`${texto}\n`))) agregarLinea({ texto: t('No hay conexión con la placa.'), clase: 'err' });
    input.value = '';
  });

  // --- Herramientas de la demo ---
  document.querySelectorAll('[data-sim]').forEach((b) => {
    b.addEventListener('click', () => ui.simular(Number(b.dataset.sim)));
  });
  ui.eventos.addEventListener('conexion', () => {
    $('demo-tools').hidden = ui.tipo !== 'demo';
    renderStats();
  });

  // --- Eventos del estado ---
  store.addEventListener('config', aplicarUmbralesEnGrafica);
  store.addEventListener('tremor', renderTemblores);
  store.addEventListener('reset', () => {
    renderTemblores();
    aplicarUmbralesEnGrafica();
    pintarSonido();
    store.dispatchEvent(new Event('recording'));
    dibujar();
    renderStats();
  });

  // Al cambiar de idioma se vuelven a pintar los textos que genera el programa
  window.addEventListener('idioma', () => {
    $('btn-pause').textContent = t(pausado ? 'Reanudar gráficas' : 'Pausar gráficas');
    aplicarUmbralesEnGrafica();
    pintarSonido();
    store.dispatchEvent(new Event('recording'));
    renderStats();
    dibujar();
  });

  return {
    setVisible(v) {
      visible = v;
      if (v) { dibujar(); renderStats(); }
    },
  };
}
