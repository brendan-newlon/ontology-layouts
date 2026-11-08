@echo off
rem Double-click to open the Layout Playback (and from it the Layout Lab) in your browser.
rem It starts up to two small windows: a page server for this folder (first free port from 8611) and the receiver that saves
rem Layout Lab sessions into _temp\ (port 8613). Close them to stop. Needs Node.js and Python on the PATH.
setlocal EnableDelayedExpansion
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js was not found on the PATH. Install it from https://nodejs.org and run this again. & pause & exit /b 1)
where python >nul 2>nul || (echo Python was not found on the PATH. Install it from https://www.python.org and run this again. & pause & exit /b 1)
rem the pages run the library through a generated copy of it: rebuild it so they always show the current code
node tools\layout-bench\build_base.mjs >nul || (echo Could not build tools\layout-bench\base_layout.js from src\ontology-layouts.js. & pause & exit /b 1)
if not exist _temp mkdir _temp
rem a token only this folder serves: a page server already running is reused only if it serves this folder
set "TOKEN=%RANDOM%%RANDOM%%RANDOM%"
> _temp\launcher_token.txt echo !TOKEN!
set "PORT="
for /l %%p in (8611,1,8630) do if not defined PORT if not %%p==8613 call :tryport %%p
if not defined PORT (echo Could not start a page server on any port from 8611 to 8630. & pause & exit /b 1)
netstat -ano | findstr /r /c:":8613 .*LISTENING" >nul
if errorlevel 1 start "Layout lab receiver - close to stop" /min python tools\recv.py
start "" "http://localhost:!PORT!/tools/layout-bench/playback.html"
exit /b 0

:tryport
call :hastoken %1
if defined OK (set "PORT=%1" & goto :eof)
netstat -ano | findstr /r /c:":%1 .*LISTENING" >nul
if not errorlevel 1 goto :eof
start "Layout pages on port %1 - close to stop" /min python -m http.server %1 --bind 127.0.0.1
for /l %%i in (1,1,20) do if not defined PORT (
  ping -n 1 -w 300 127.0.0.255 >nul
  call :hastoken %1
  if defined OK set "PORT=%1"
)
goto :eof

:hastoken
set "OK=" & set "GOT="
curl -s -m 2 http://127.0.0.1:%1/_temp/launcher_token.txt > "%TEMP%\layout_launcher_check.txt" 2>nul
set /p GOT=<"%TEMP%\layout_launcher_check.txt"
if "!GOT!"=="!TOKEN!" set "OK=1"
goto :eof
