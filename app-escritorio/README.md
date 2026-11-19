# App de escritorio (Windows)

Versión de escritorio del **Indicador de temblores · USFX**, hecha con [Electron](https://www.electronjs.org/).

- Abre el panel en su propia ventana, sin barra del navegador.
- En línea carga siempre la última versión publicada (`https://panel-sensor-agua.vercel.app`).
- **Sin internet** usa una copia incluida en la app, y los datos en vivo se piden al sitio publicado cuando hay conexión.
- Conecta el Arduino por **USB** (Web Serial) con un selector de puerto nativo.
- Los enlaces externos se abren en el navegador.

## Descargas

Los `.exe` no están en el repositorio (pesan unos 110 MB). Se generan con el script de abajo.

| Archivo | Para qué |
|---|---|
| `Indicador-de-temblores-portable.exe` | Se abre con doble clic, sin instalar. |
| `Indicador-de-temblores-instalador.exe` | Instala la app con acceso directo en el escritorio y en el menú Inicio. |

> Los ejecutables **no están firmados**. Windows SmartScreen puede mostrar «Windows protegió tu PC»:
> pulsa **Más información → Ejecutar de todas formas**.

## Compilar

```powershell
cd app-escritorio
.\construir.ps1
```

El script copia el código y el panel a `Documents\app-temblores\src` (fuera de OneDrive, para no sincronizar
`node_modules`), instala las dependencias, compila y deja los `.exe` en `Documents\app-temblores`.

Para probar sin compilar: `npm install` y `npm start` dentro de la carpeta de compilación.
