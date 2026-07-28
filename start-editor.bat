@echo off
setlocal
cd /d "%~dp0"
set "PORT=4173"
set "URL=http://localhost:%PORT%/editor.html"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/editor.html' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "Amorist PowerShell Server" powershell.exe -NoExit -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port %PORT% -Root "%~dp0."
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$u='http://127.0.0.1:%PORT%/editor.html'; 1..40 | ForEach-Object { try { Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 1 | Out-Null; exit 0 } catch { Start-Sleep -Milliseconds 250 } }; exit 1"
  if errorlevel 1 (
    echo Amorist local server failed to start.
    pause
    exit /b 1
  )
)
start "" "%URL%"
endlocal
