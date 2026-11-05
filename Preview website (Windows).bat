@echo off
rem Double-click to build the website and open a preview in your browser.
rem Close this window (or press Ctrl+C) to stop the preview.
cd /d "%~dp0"
echo Building the Out and About Books website...
node build.mjs
if errorlevel 1 (
  echo.
  echo The build did not work. Read the message above for the reason.
  pause
  exit /b 1
)
echo.
echo Starting the preview at http://localhost:3000 ...
echo To stop it, close this window or press Ctrl+C.
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"
call npx -y serve _site -l 3000
pause
