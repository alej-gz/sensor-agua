# Compila la app de escritorio (Windows) en una carpeta FUERA de OneDrive y deja los .exe en Documents\app-temblores.
# Requisitos: Node.js 22 o superior. Uso (desde PowerShell, en esta carpeta):   .\construir.ps1

$ErrorActionPreference = 'Stop'
$aqui   = $PSScriptRoot
$raiz   = Split-Path $aqui -Parent
$salida = Join-Path $env:USERPROFILE 'Documents\app-temblores'
$obra   = Join-Path $salida 'src'

New-Item -ItemType Directory -Force $obra | Out-Null

# 1) Codigo de la app + copia del panel (sin audio, sin funciones de servidor)
robocopy $aqui $obra /E /XD node_modules dist /XF construir.ps1 README.md /NFL /NDL /NJH /NJS /NP | Out-Null
robocopy (Join-Path $raiz 'panel') (Join-Path $obra 'panel') /E /XD audio api .vercel node_modules `
  /XF server.mjs package.json sw.js vercel.json .vercelignore .gitignore /NFL /NDL /NJH /NJS /NP | Out-Null

# 2) Instalar herramientas y compilar
Push-Location $obra
npm install --no-audit --no-fund
if (Test-Path dist) { Remove-Item dist -Recurse -Force }
npm run dist
Pop-Location

# 3) Dejar los .exe a la vista
Copy-Item (Join-Path $obra 'dist\*.exe') $salida -Force
Write-Host "`nListo. Archivos en: $salida" -ForegroundColor Green
Get-ChildItem $salida -Filter *.exe | ForEach-Object { '{0,8:N1} MB  {1}' -f ($_.Length / 1MB), $_.Name }
