// Cliente minimo de Upstash Redis por REST (sin dependencias).
const URL_REST = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export async function pipeline(comandos) {
  if (!URL_REST || !TOKEN) throw new Error('Falta conectar la base de datos Redis');
  const r = await fetch(`${URL_REST}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(comandos),
  });
  if (!r.ok) throw new Error(`Redis ${r.status}`);
  const datos = await r.json();
  return datos.map((d) => {
    if (d.error) throw new Error(d.error);
    return d.result;
  });
}
