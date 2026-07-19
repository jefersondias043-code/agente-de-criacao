@echo off
title Removedor de Fundo - instalacao da IA (aguarde)
cd /d "%~dp0removedor-server"

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERRO] Python nao foi encontrado.
  echo Instale o Python 3.10 ou superior em https://www.python.org/downloads/
  echo e marque "Add Python to PATH" no instalador. Depois rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)

if not exist "venv" (
  echo Criando ambiente Python isolado ^(venv^)...
  python -m venv venv
)

echo.
echo Instalando a inteligencia artificial ^(primeira vez pode levar alguns minutos^)...
echo.
call "venv\Scripts\python.exe" -m pip install --upgrade pip
call "venv\Scripts\pip.exe" install -r requirements.txt
if errorlevel 1 (
  echo.
  echo [ERRO] Falha ao instalar as dependencias. Verifique sua conexao e tente de novo.
  echo.
  pause
  exit /b 1
)

echo.
echo ==========================================================
echo  Pronto! A IA foi instalada.
echo  Agora use "Removedor.bat" para ligar o servidor quando
echo  for usar a ferramenta Removedor de Fundo.
echo ==========================================================
echo.
pause
