@echo off
title Agente - desativar inicio automatico
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "AgenteVideoGrab" /f >nul 2>nul
if exist "%USERPROFILE%\Desktop\Agente.url" del "%USERPROFILE%\Desktop\Agente.url"
echo Inicio automatico DESATIVADO e atalho removido.
echo O servidor que ja estiver no ar continua ate fechar/reiniciar
echo (use "Parar Agente.vbs" para encerrar agora).
echo.
pause
