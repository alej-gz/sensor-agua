// Vista "Siempre activo": indicador grande, LEDs, sesion e historial.

import { $, NOMBRES_NIVEL, fmtHora, fmtSeg, fmtReloj, fmtNum } from '../util.js';
import { AlarmaSonora } from '../alarm.js';
import { almacen } from '../util.js';
import { t as tr } from '../i18n.js';

export function initActivo(store, ui) {
  const card = $('level-card');
  const leds = [...document.querySelectorAll('#act-leds .led')];
  const alarma = new AlarmaSonora();
  let pendiente = false;

  // --- Opciones ---
  const optSonido = $('opt-sound');
  optSonido.checked = almacen.leer('sensorAgua.sonido', false);
  alarma.activa = optSonido.checked;
  optSonido.addEventListener('change', () => {
    alarma.setActiva(optSonido.checked);
    almacen.guardar('sensorAgua.sonido', optSonido.checked);
  });

  $('btn-fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  });

  $('btn-clear-history').addEventListener('click', () => {
    if (confirm('¿Borrar todo el historial de temblores guardado en este navegador?')) store.borrarHistorial();
  });

  // --- Indicador ---
  function renderNivel() {
    pendiente = false;
    const s = store.actual;
    if (!s) {
      card.dataset.level = '0';
      card.dataset.alarm = '0';
      $('act-level').textContent = '–';
      $('act-level-name').textContent = ui.conectado ? tr('Esperando datos…') : tr('Conecta la placa o abre la demo');
      $('act-var').textContent = '–';
      $('act-read').textContent = '–';
      $('act-meter').style.width = '0%';
      leds.forEach((l) => l.classList.remove('on'));
      alarma.actualizar(false);
      return;
    }
    card.dataset.level = String(s.nivel);
    card.dataset.alarm = s.buzzer ? '1' : '0';
    $('act-level').textContent = s.nivel;
    $('act-level-name').textContent = NOMBRES_NIVEL[s.nivel] ?? '–';
    $('act-var').textContent = s.variacion;
    $('act-read').textContent = s.lectura;
    leds.forEach((l) => {
      const n = Number(l.dataset.n);
      l.classList.toggle('on', n === 5 ? s.buzzer : Math.min(s.nivel, 4) === n);
    });
    const escala = maxEscala();
    $('act-meter').style.width = `${Math.min(100, (s.variacion / escala) * 100)}%`;
    alarma.actualizar(s.buzzer);
  }

  const maxEscala = () => (store.umbrales ? store.umbrales[4] * 1.25 : 50);

  function renderMarcas() {
    const cont = $('act-ticks');
    cont.innerHTML = '';
    if (!store.umbrales) return;
    const escala = maxEscala();
    store.umbrales.forEach((u, i) => {
      const s = document.createElement('span');
      s.style.left = `${(u / escala) * 100}%`;
      s.textContent = `N${i + 1}`;
      s.title = `Nivel ${i + 1}: variación ≥ ${u}`;
      cont.appendChild(s);
    });
  }

  // --- Estado, sesion, ultimo temblor ---
  function renderEstado() {
    const el = $('act-state');
    if (!ui.conectado) {
      el.textContent = tr('Sin conexión');
      el.classList.remove('live');
    } else if (store.sismo.activo) {
      el.textContent = `${tr('Temblor en curso')} · ${fmtSeg(Date.now() - store.sismo.inicio)}`;
      el.classList.add('live');
    } else {
      el.textContent = store.actual ? tr('En reposo · vigilando') : tr('Esperando datos…');
      el.classList.remove('live');
    }
    $('act-uptime').textContent = ui.conectado ? fmtReloj(Date.now() - store.sesion.inicio) : '00:00:00';
  }

  function renderSesion() {
    const t = store.sesion.temblores;
    $('act-count').textContent = t.length;
    $('act-max').textContent = t.length ? store.sesion.nivelMax : '–';

    const ultimo = store.historial[0];
    const box = $('act-last');
    if (!ultimo) {
      box.className = 'last empty';
      box.textContent = tr('Ninguno todavía');
    } else {
      box.className = 'last';
      box.innerHTML = `
        <div class="last-title"><span class="chip" data-level="${ultimo.nivelMax}">${ultimo.nivelMax}</span>${NOMBRES_NIVEL[ultimo.nivelMax]}</div>
        <div class="last-meta">
          <div><b>${fmtHora(ultimo.inicio)}</b>${tr('hora')}</div>
          <div><b>${fmtSeg(ultimo.duracionMs)}</b>${tr('duración')}</div>
          <div><b>${ultimo.oscilaciones}</b>${tr('oscilaciones')}</div>
        </div>`;
    }

    const lista = $('act-history');
    lista.innerHTML = '';
    for (const r of store.historial.slice(0, 60)) {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="chip" data-level="${r.nivelMax}">${r.nivelMax}</span>
        <time>${fmtHora(r.inicio)}</time>
        <span>${NOMBRES_NIVEL[r.nivelMax]}</span>
        <span class="meta">${fmtSeg(r.duracionMs)} · ${r.oscilaciones} osc · ${fmtNum(r.oscPorSeg, 1)} osc/s · var. máx ${r.variacionMax}</span>`;
      lista.appendChild(li);
    }
    $('act-history-empty').hidden = store.historial.length > 0;
  }

  store.addEventListener('sample', () => {
    if (!pendiente) {
      pendiente = true;
      requestAnimationFrame(renderNivel);
    }
  });
  store.addEventListener('config', () => { renderMarcas(); renderNivel(); });
  store.addEventListener('tremor', renderSesion);
  store.addEventListener('tremorstart', renderEstado);
  store.addEventListener('reset', () => { renderMarcas(); renderNivel(); renderSesion(); renderEstado(); });
  ui.eventos.addEventListener('conexion', () => { renderNivel(); renderEstado(); });
  setInterval(renderEstado, 500);

  window.addEventListener('idioma', () => { renderMarcas(); renderNivel(); renderSesion(); renderEstado(); });

  renderMarcas();
  renderNivel();
  renderSesion();
  renderEstado();
}
