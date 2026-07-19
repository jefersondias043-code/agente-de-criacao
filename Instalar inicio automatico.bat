@echo off
title Agente - ativar inicio automatico
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERRO] Node.js nao foi encontrado.
  echo Instale em https://nodejs.org e rode de novo.
  echo.
  pause
  exit /b 1
)

echo Ativando o inicio automatico (servidor sobe junto com o Windows)...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "AgenteVideoGrab" /t REG_SZ /d "wscript.exe %~sdp0servidor.vbs" /f >nul
if errorlevel 1 (echo [AVISO] Nao consegui registrar o inicio automatico.) else (echo  - inicio automatico ATIVADO)

echo Criando o atalho "Agente" na Area de Trabalho...
> "%USERPROFILE%\Desktop\Agente.url" echo [InternetShortcut]
>> "%USERPROFILE%\Desktop\Agente.url" echo URL=http://localhost:3000

echo Iniciando o servidor agora...
start "" wscript.exe "%~sdp0servidor.vbs"
start "" /min powershell -NoProfile -Command "Start-Sleep 4; Start-Process 'http://localhost:3000'"

echo.
echo ============================================
echo  Pronto! Feito UMA vez, para sempre.
echo  O servidor passa a subir sozinho no login.
echo  Abra o app pelo icone "Agente" na Area de
echo  Trabalho (ou http://localhost:3000).
echo ============================================
echo.
echo Para desativar: "Desinstalar inicio automatico.bat".
echo.
pause
