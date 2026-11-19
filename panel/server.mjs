// Servidor local minimo para el panel (sin dependencias).
// Web Serial solo funciona en paginas servidas desde localhost / 127.0.0.1, por eso hace falta.
// Uso: node server.mjs        (abre el navegador solo)
//      node server.mjs --no-open

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const servidor = http.createServer((req, res) => {
  let ruta;
  try {
    ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.normalize(path.join(raiz, ruta));
  const rel = path.relative(raiz, archivo);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(archivo, (err, datos) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
      return;
    }
    res.writeHead(200, {
      'Content-Type': tipos[path.extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(datos);
  });
});

function abrirNavegador(url) {
  if (process.platform === 'win32') {
    // Preferir Chrome o Edge: son los que soportan Web Serial
    const chrome = [
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    ].find((p) => fs.existsSync(p));
    exec(chrome ? `"${chrome}" "${url}"` : `start "" msedge "${url}"`);
  } else if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

let puerto = Number(process.env.PORT) || 8765;
function escuchar() {
  servidor.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && puerto < 8775) {
      puerto++;
      escuchar();
    } else {
      console.error('No se pudo iniciar el servidor:', e.message);
      process.exit(1);
    }
  });
  servidor.listen(puerto, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${puerto}/`;
    console.log(`\n  Panel del indicador de temblores: ${url}`);
    console.log('  Deja esta ventana abierta mientras usas el panel. Cierrala para detenerlo.\n');
    if (!process.argv.includes('--no-open')) abrirNavegador(url);
  });
}
escuchar();
