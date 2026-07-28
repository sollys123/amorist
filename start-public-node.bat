@echo off
setlocal
cd /d "%~dp0"
set "PORT=4173"
set "URL=http://localhost:%PORT%/index.html"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Use start-public.bat instead, or install Node.js.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/index.html' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "Amorist Node Server" cmd.exe /k node "%~dp0serve.mjs"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$u='http://127.0.0.1:%PORT%/index.html'; 1..40 | ForEach-Object { try { Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 1 | Out-Null; exit 0 } catch { Start-Sleep -Milliseconds 250 } }; exit 1"
  if errorlevel 1 (
    echo Amorist Node server failed to start.
    pause
    exit /b 1
  )
)
start "" "%URL%"
endlocal
