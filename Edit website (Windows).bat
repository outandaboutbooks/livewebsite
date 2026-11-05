@echo off
rem Double-click to open the website editor on this computer.
rem Close this window (or press Ctrl+C) when you have finished.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from nodejs.org, then try again.
  pause
  exit /b 1
)
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3001"
node editor\server.mjs
echo.
echo The editor has stopped.
pause
