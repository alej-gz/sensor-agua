@echo off
title Panel - Indicador de temblores
cd /d "%~dp0panel"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Instalalo desde https://nodejs.org y vuelve a abrir este archivo.
  pause
  exit /b
)
node server.mjs
pause
