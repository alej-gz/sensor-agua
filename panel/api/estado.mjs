// Los visitantes leen aqui lo ultimo que transmitio el presentador.
// La respuesta se cachea 1 s en la CDN de Vercel: muchos visitantes = una sola lectura a Redis por segundo.
import { pipeline } from './_redis.mjs';

const ENTREGAR = 200;   // ultimas lineas que se devuelven (4 s a 50 Hz)

export default async function handler(req, res) {
  try {
    const [total, lineas, ultimo, cfgU, cfgS] = await pipeline([
      ['GET', 'sa:total'],
      ['LRANGE', 'sa:lineas', String(-ENTREGAR), '-1'],
      ['GET', 'sa:ultimo'],
      ['GET', 'sa:cfgU'],
      ['GET', 'sa:cfgS'],
    ]);
    res.setHeader('Cache-Control', 'public, s-maxage=1, stale-while-revalidate=2');
    return res.status(200).json({
      total: Number(total) || 0,
      lineas: lineas || [],
      edadMs: ultimo ? Date.now() - Number(ultimo) : null,
      cfg: [cfgU, cfgS].filter(Boolean),
    });
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(500).json({ error: e.message });
  }
}
