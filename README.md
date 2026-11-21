# Indicador de temblores · USFX

Sensor de nivel de agua con Arduino UNO que detecta temblores y los muestra en un panel web, en vivo.

**Panel en vivo:** https://panel-sensor-agua.vercel.app

Hecho por Paul Alejandro Guzmán Calle · https://alej-gz.vercel.app

## Contenido

| Ruta | Qué es |
|---|---|
| `firmware/sensor_agua/` | Sketch del Arduino UNO (niveles 1 a 5, buzzer, detector de temblor). |
| `panel/` | Panel web (HTML, CSS y JS sin dependencias) + funciones de Vercel. |
| `panel/api/` | `publicar` (recibe los datos del presentador, protegido con clave) y `estado` (los entrega a los visitantes). |
| `app-escritorio/` | App de escritorio (Electron) que abre el panel. |
| `herramientas/monitor/` | Monitor serie simple para probar la placa. |
| `assets/qr/` | Códigos QR del panel. |
| `Abrir panel.bat` | Abre el panel en local. |

Los guiones, informes y material del stand viven solo en local (`docs/`, no se publican).

## Cómo funciona la transmisión en vivo

1. El presentador conecta el Arduino por USB y abre el panel en Chrome o Edge (Web Serial).
2. Pulsa **Transmitir en vivo** e ingresa la clave. El panel envía las lecturas a `/api/publicar`.
3. Los datos se guardan en Upstash Redis y los visitantes los leen desde `/api/estado` (caché de 1 s en la CDN).
4. Quien abre el enlace o el QR ve el sensor en tiempo real. Sin transmisión, ve "Esperando transmisión".

## Despliegue (Vercel)

Variables de entorno necesarias en el proyecto:

- `KV_REST_API_URL` y `KV_REST_API_TOKEN`: las crea la integración de Upstash Redis.
- `PUBLISH_TOKEN`: clave que protege `/api/publicar` (no está en el repositorio).

```
cd panel
npx vercel deploy --prod
```

## Probar el panel en local

```
cd panel
node server.mjs
```

## Nota sobre la música

El reproductor usa tres canciones comerciales que **no están en este repositorio** por derechos de autor.
Se sirven desde un almacén de Vercel Blob (las direcciones están en `panel/js/extras.js`).
Si clonas el proyecto, cambia esas rutas por tus propios archivos MP3.
