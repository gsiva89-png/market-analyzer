@echo off
:: Add portable Node.js to PATH
set "PORTABLE_NODE_PATH=d:\gps-tracking-system\node-portable\node-v18.16.0-win-x64"
if exist "%PORTABLE_NODE_PATH%" (
    set "PATH=%PORTABLE_NODE_PATH%;%PATH%"
)

:: Check node_modules
if not exist "node_modules\" (
    call npm install
)

:: Launch browser after 5 seconds
powershell -Command "Start-Job -ScriptBlock { Start-Sleep -Seconds 5; Start-Process 'http://localhost:3000' } | Out-Null"

:: Run server & client
call npm run dev
