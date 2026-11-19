// Interpreta las lineas que envia la placa en modo datos (comando 'd').
//
//   D<lectura>,<variacion>,<nivel>,<flags>   flags: bit0 = buzzer, bit1 = temblor en curso
//   E1                                       empieza un temblor
//   E0,<dur ms>,<osc>,<nivel max>,<var max>,<lect min>,<lect max>
//   U<n1>,<n2>,<n3>,<n4>,<n5>,<histeresis>,<ventana ms>
//   S<0|1>                                   sonido de la alarma: 0 = pitido, 1 = melodia
//   cualquier otra linea -> texto

const numeros = (s) => s.split(',').map((x) => (x.trim() === '' ? NaN : Number(x)));
const validos = (arr, n) => arr.length >= n && arr.slice(0, n).every(Number.isFinite);

export function parseLine(crudo) {
  const linea = crudo.trim();
  if (!linea) return null;

  if (linea[0] === 'D') {
    const p = numeros(linea.slice(1));
    if (validos(p, 4)) {
      return {
        type: 'sample',
        lectura: p[0],
        variacion: p[1],
        nivel: p[2],
        buzzer: (p[3] & 1) === 1,
        sismo: (p[3] & 2) === 2,
      };
    }
  }

  if (linea === 'E1') return { type: 'tremorStart' };

  if (linea.startsWith('E0,')) {
    const p = numeros(linea.slice(3));
    if (validos(p, 6)) {
      return {
        type: 'tremorEnd',
        duracionMs: p[0],
        oscilaciones: p[1],
        nivelMax: p[2],
        variacionMax: p[3],
        lecturaMin: p[4],
        lecturaMax: p[5],
      };
    }
  }

  if (linea[0] === 'U') {
    const p = numeros(linea.slice(1));
    if (validos(p, 5)) {
      return {
        type: 'config',
        umbrales: p.slice(0, 5),
        histeresis: Number.isFinite(p[5]) ? p[5] : null,
        ventanaMs: Number.isFinite(p[6]) ? p[6] : null,
      };
    }
  }

  if (linea === 'S0' || linea === 'S1') return { type: 'sound', melodia: linea === 'S1' };

  return { type: 'text', text: linea };
}
