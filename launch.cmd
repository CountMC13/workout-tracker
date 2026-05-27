@echo off
title Physio Tracker
cd /d "%~dp0"

REM Install dependencies on first run.
if not exist "node_modules" (
  echo Installing dependencies, please wait...
  call npm install || goto :error
)

REM Build the app if it hasn't been built yet.
if not exist "dist\index.html" (
  echo Building app, please wait...
  call npm run build || goto :error
)

echo.
echo  Physio Tracker is starting...
echo  It will open in your browser at http://localhost:4173/
echo.
echo  Keep this window open while using the app.
echo  Close it (or press Ctrl+C) to stop.
echo.

REM Open the browser shortly after, then run the server in this window.
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start "" http://localhost:4173/"
call npm run preview -- --port 4173 --strictPort
goto :eof

:error
echo.
echo  Something went wrong. See the messages above.
pause
