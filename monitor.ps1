# Monitor serie simple para sensor_agua (9600 baudios).
# Escribe 1, 2, 3, v, r o h y presiona Enter. Ctrl+C o 'salir' para terminar.
param([string]$Puerto = "")

if (-not $Puerto) {
  $Puerto = [System.IO.Ports.SerialPort]::GetPortNames() | Select-Object -Last 1
}
if (-not $Puerto) { Write-Host "No se encontro ningun puerto COM. Conecta el Arduino." -ForegroundColor Red; Read-Host "Enter para salir"; exit }

$p = New-Object System.IO.Ports.SerialPort $Puerto, 9600
$p.DtrEnable = $true
try { $p.Open() } catch {
  Write-Host "No se pudo abrir $Puerto. Cierra el Arduino IDE u otro monitor y vuelve a intentar." -ForegroundColor Red
  Read-Host "Enter para salir"; exit
}

Write-Host "Conectado a $Puerto a 9600. Escribe un comando (1, 2, 3, v, r, h) y Enter. 'salir' para terminar." -ForegroundColor Green
$linea = ""
try {
  while ($true) {
    $txt = $p.ReadExisting()
    if ($txt) { Write-Host -NoNewline $txt }
    while ([Console]::KeyAvailable) {
      $k = [Console]::ReadKey($true)
      if ($k.Key -eq 'Enter') {
        Write-Host ""
        if ($linea -eq 'salir') { throw 'salir' }
        if ($linea) { $p.Write($linea + "`n"); Write-Host ">> $linea" -ForegroundColor Cyan }
        $linea = ""
      } elseif ($k.Key -eq 'Backspace') {
        if ($linea.Length) { $linea = $linea.Substring(0, $linea.Length - 1) }
      } else { $linea += $k.KeyChar }
    }
    Start-Sleep -Milliseconds 30
  }
} catch {} finally { $p.Close(); Write-Host "`nMonitor cerrado." }
