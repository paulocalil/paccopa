@echo off
REM ============================================================
REM  Pac Copa 2026 - atalho para Windows
REM  Instala dependencias (1a vez), sobe o servidor e abre o
REM  navegador em http://localhost:3000
REM ============================================================
cd /d "%~dp0"

if not exist "node_modules" (
  echo Instalando dependencias pela primeira vez...
  call npm install
)

echo Abrindo http://localhost:3000 ...
start "" "http://localhost:3000"

call npm start
