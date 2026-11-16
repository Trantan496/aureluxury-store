@echo off
setlocal EnableExtensions

rem Starts the production build on localhost and exposes it through a pre-created
rem Cloudflare Tunnel for https://aureluxury.store. No Nginx configuration is used.
cd /d "%~dp0"

set "AUREL_PORT=3000"
set "AUREL_ORIGIN=https://aureluxury.store"

if not exist ".env" (
  echo ERROR: .env is missing. Copy .env.example and configure production values first.
  goto :failed
)

findstr /R /C:"^BETTER_AUTH_URL=\"https://aureluxury\.store\"$" ".env" >nul
if errorlevel 1 (
  echo ERROR: BETTER_AUTH_URL in .env must be exactly %AUREL_ORIGIN%
  echo This protects Better Auth origin and cookie handling on the public domain.
  goto :failed
)

where cloudflared >nul 2>&1
if errorlevel 1 (
  echo ERROR: cloudflared is not installed or is not on PATH.
  echo Follow docs\CLOUDFLARE_TUNNEL_SETUP.md, then run this file again.
  goto :failed
)

if "%CLOUDFLARE_TUNNEL_TOKEN%"=="" (
  echo ERROR: CLOUDFLARE_TUNNEL_TOKEN is not set for this Command Prompt.
  echo Create a named Cloudflare Tunnel with public hostname aureluxury.store,
  echo then set its connector token only in your local environment.
  goto :failed
)

call npm.cmd run db:start
if errorlevel 1 goto :failed

call npm.cmd run build
if errorlevel 1 goto :failed

echo Starting AUREL at %AUREL_ORIGIN% through Cloudflare Tunnel...
echo Keep this window open. Press Ctrl+C to stop the tunnel.
start "AUREL Next.js" /min "%ComSpec%" /d /c "cd /d ""%~dp0"" && npm.cmd run start -- --hostname 127.0.0.1 --port %AUREL_PORT%"
timeout /t 3 /nobreak >nul
cloudflared tunnel run --token "%CLOUDFLARE_TUNNEL_TOKEN%"
exit /b %errorlevel%

:failed
echo.
pause
exit /b 1
