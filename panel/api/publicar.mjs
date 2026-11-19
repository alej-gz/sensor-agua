// El panel del presentador envia aqui las lineas que llegan del Arduino.
import { timingSafeEqual } from 'node:crypto';
import { pipeline } from './_redis.mjs';

const MAX_LINEAS = 300;       // por peticion
const HISTORIA = 300;         // lineas que se conservan (6 s a 50 Hz)

function claveValida(recibida) {
  const esperada = process.env.PUBLISH_TOKEN || '';
  if (!esperada || typeof recibida !== 'string') return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo no permitido' });
  if (!claveValida(req.headers['x-clave'])) return res.status(401).json({ error: 'Clave incorrecta' });

  const lineas = Array.isArray(req.body?.lineas) ? req.body.lineas : [];
  // Solo se aceptan los tipos de linea del protocolo de la placa (D, E, U, S) con formato simple
  const validas = lineas
    .slice(0, MAX_LINEAS)
    .filter((l) => typeof l === 'string' && l.length <= 80 && /^(D-?\d|E[01]|U\d|S[01])[0-9,\-]*$/.test(l));
  if (!validas.length) return res.status(200).json({ ok: true, guardadas: 0 });

  const cmds = [
    ['RPUSH', 'sa:lineas', ...validas],
    ['LTRIM', 'sa:lineas', String(-HISTORIA), '-1'],
    ['INCRBY', 'sa:total', String(validas.length)],
    ['SET', 'sa:ultimo', String(Date.now())],
  ];
  const cfgU = validas.filter((l) => l[0] === 'U').pop();
  const cfgS = validas.filter((l) => l[0] === 'S').pop();
  if (cfgU) cmds.push(['SET', 'sa:cfgU', cfgU]);
  if (cfgS) cmds.push(['SET', 'sa:cfgS', cfgS]);

  try {
    await pipeline(cmds);
    return res.status(200).json({ ok: true, guardadas: validas.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
