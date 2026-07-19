@echo off
title Agente - servidor local (mantenha esta janela aberta)
cd /d "%~dp0videograb-server"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERRO] Node.js nao foi encontrado.
  echo Instale em https://nodejs.org e rode este atalho de novo.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Instalando dependencias do VideoGrab ^(primeira vez, 1-2 min^)...
  call npm install
  echo.
)

echo Iniciando o servidor. O navegador vai abrir em alguns segundos.
echo MANTENHA esta janela aberta enquanto usar o app. Feche-a para desligar.
echo.
start "" /min powershell -NoProfile -Command "Start-Sleep 3; Start-Process 'http://localhost:3000'"
node server.js
echo.
echo Servidor encerrado. Pressione uma tecla para fechar.
pause >nul