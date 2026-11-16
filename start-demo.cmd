@echo off
setlocal
cd /d "%~dp0"
call npm.cmd run db:start
if errorlevel 1 goto failed
if not exist ".next\BUILD_ID" (
  call npm.cmd run build
  if errorlevel 1 goto failed
)
echo Open http://localhost:3000/products
echo Keep this window open while presenting. Press Ctrl+C to stop.
call npm.cmd run start -- --hostname 127.0.0.1 --port 3000
if errorlevel 1 goto failed
exit /b 0
:failed
echo Demo startup failed. See the error above and docs/DEMO_IMPLEMENTATION_2026-11-01.md.
pause
exit /b 1
