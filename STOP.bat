@echo off
title Market Historical Analyzer - STOP
echo ===================================================
echo   Stopping Market Historical Analyzer...
echo ===================================================
echo.

:: Kill all Node.js processes
echo [INFO] Stopping all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK]  Node.js processes stopped successfully.
) else (
    echo [INFO] No Node.js processes were running.
)

:: Free port 3000 (Vite frontend)
echo [INFO] Releasing port 3000 (Vite)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Free port 5000 (Express backend, if used)
echo [INFO] Releasing port 5000 (Express)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo ===================================================
echo   Server stopped. Safe to close this window.
echo ===================================================
echo.
pause
