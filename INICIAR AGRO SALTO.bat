@echo off
chcp 65001 >nul
title AGRO SALTO ERP - Iniciando...
setlocal

:: Guardar la ruta base del proyecto (donde está este .bat)
set "BASE=%~dp0"
set "BASE=%BASE:~0,-1%"

echo.
echo  ===========================================
echo    ERP AGRO SALTO - Iniciando Sistema...
echo  ===========================================
echo.

:: --- Paso 1: Liberar puertos si quedaron ocupados ---
echo  [1/3] Liberando puertos anteriores...
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr /R "0.0.0.0:3001 \[::\]:3001"') do (
    taskkill /PID %%P /F >nul 2>&1
)
for /f "tokens=5" %%P in ('netstat -ano 2^>nul ^| findstr /R "0.0.0.0:5173 \[::\]:5173"') do (
    taskkill /PID %%P /F >nul 2>&1
)
timeout /t 2 /nobreak >nul

:: --- Paso 2: Iniciar Backend ---
echo  [2/3] Iniciando Backend...
set "BACKEND_DIR=%BASE%\backend"
start "AGRO SALTO - Backend" cmd /k "title AGRO SALTO - Backend & cd /d "%BACKEND_DIR%" & echo. & echo  [Backend] Servidor corriendo en http://localhost:3001 & echo  No cierres esta ventana. & echo. & npm start"
timeout /t 6 /nobreak >nul

:: --- Paso 3: Iniciar Frontend ---
echo  [3/3] Iniciando Frontend...
set "FRONTEND_DIR=%BASE%\frontend"
start "AGRO SALTO - Frontend" cmd /k "title AGRO SALTO - Frontend & cd /d "%FRONTEND_DIR%" & echo. & echo  [Frontend] Interfaz corriendo en http://localhost:5173 & echo  No cierres esta ventana. & echo. & npm run dev"
timeout /t 9 /nobreak >nul

:: --- Abrir navegador ---
echo  Abriendo navegador en http://localhost:5173 ...
start "" http://localhost:5173

echo.
echo  ===========================================
echo    Sistema iniciado!
echo    URL: http://localhost:5173
echo.
echo    IMPORTANTE: No cierres las dos ventanas
echo    negras que se abrieron (Backend y Frontend)
echo  ===========================================
echo.
pause
endlocal
