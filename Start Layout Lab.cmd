@echo off
rem Double-click to open the Layout Playback (and from it the Layout Lab) in your browser.
rem Starts two small windows: the page server on port 8011 and the receiver that saves Layout Lab sessions into _temp\ (port 8013).
rem Close those two windows to stop them. Needs Node.js and Python on the PATH.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js was not found on the PATH. Install it from https://nodejs.org and run this again. & pause & exit /b 1)
where python >nul 2>nul || (echo Python was not found on the PATH. Install it from https://www.python.org and run this again. & pause & exit /b 1)
rem the pages run the library through a generated copy of it: rebuild it so they always show the current code
node tools\layout-bench\build_base.mjs >nul || (echo Could not build tools\layout-bench\base_layout.js from src\ontology-layouts.js. & pause & exit /b 1)
netstat -ano | findstr /r /c:":8011 .*LISTENING" >nul
if not errorlevel 1 (
  echo Port 8011 is already in use, probably by a page server started earlier. Opening it as it is.
  echo If it shows an old copy, close the window titled "Layout pages" and run this again.
  timeout /t 4 /nobreak >nul
) else (
  start "Layout pages - close to stop" /min python -m http.server 8011 --bind 127.0.0.1
)
netstat -ano | findstr /r /c:":8013 .*LISTENING" >nul
if errorlevel 1 start "Layout lab receiver - close to stop" /min python tools\recv.py
timeout /t 2 /nobreak >nul
start "" "http://localhost:8011/tools/layout-bench/playback.html"
