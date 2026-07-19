@echo off
title Removedor de Fundo - servidor de IA (mantenha esta janela aberta)
cd /d "%~dp0removedor-server"

if not exist "venv\Scripts\python.exe" (
  echo.
  echo [ERRO] A IA ainda nao foi instalada.
  echo Rode primeiro o arquivo "Instalar Removedor.bat".
  echo.
  pause
  exit /b 1
)

echo Iniciando o servidor de IA do Removedor de Fundo...
echo MANTENHA esta janela aberta enquanto usar a ferramenta. Feche-a para desligar.
echo.
echo (A primeira remocao de cada modelo baixa o arquivo da IA uma vez so.)
echo.
call "venv\Scripts\python.exe" server.py
echo.
echo Servidor encerrado. Pressione uma tecla para fechar.
pause >nul
