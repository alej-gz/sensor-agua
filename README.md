# Indicador de temblores · USFX

Sensor de nivel de agua con Arduino UNO que detecta temblores y los muestra en un panel web, en vivo.

**Panel en vivo:** https://panel-sensor-agua.vercel.app

Hecho por Paul Alejandro Guzmán Calle · https://alej-gz.vercel.app

## Contenido

| Ruta | Qué es |
|---|---|
| `sensor_agua.ino` | Sketch del Arduino UNO (niveles 1 a 5, buzzer, detector de temblor). |
| `panel/` | Panel web (HTML, CSS y JS sin dependencias) + funciones de Vercel. |
| `panel/api/` | `publicar` (recibe los datos del presentador, protegido con clave) y `estado` (los entrega a los visitantes). |
| `monitor.ps1`, `Abrir monitor.bat` | Monitor serie simple para probar la placa. |
| `qr_panel_*.png` | Códigos QR del panel. |

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

El reproductor del panel usa tres canciones comerciales que **no se incluyen** en este repositorio por derechos de autor.
Para usar el reproductor, coloca tus propios archivos MP3 en `panel/audio/` con los nombres `garden.mp3`, `such-a-funny-way.mp3` y `cmih.mp3`
(o cambia las rutas en `panel/js/extras.js`). Sin ellos, el panel funciona igual y el botón de reproducir queda sin sonido.
