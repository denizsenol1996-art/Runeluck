@echo off
title 3DC Casino - Public Host
color 0A
cd /d "%~dp0"

REM ── Config — pas hier de subdomain aan als je wilt ──
set TUNNEL_NAME=runeluck
set DOMAIN=3dc.dexah69.com
set CFD="C:\Program Files (x86)\cloudflared\cloudflared.exe"

echo.
echo  ====================================
echo   3DC Casino — Public Host (Cloudflare)
echo  ====================================
echo.

REM ── First-time Cloudflare login ──
if not exist "%USERPROFILE%\.cloudflared\cert.pem" (
  echo [SETUP] Cloudflare login - browser opent...
  %CFD% tunnel login
  if errorlevel 1 (
    echo [ERROR] Login mislukt.
    pause
    exit /b 1
  )
)

REM ── Tunnel aanmaken als hij nog niet bestaat ──
%CFD% tunnel list 2>nul | findstr /C:"%TUNNEL_NAME%" >nul
if errorlevel 1 (
  echo [SETUP] Tunnel "%TUNNEL_NAME%" aanmaken...
  %CFD% tunnel create %TUNNEL_NAME%
  echo [SETUP] DNS koppelen aan %DOMAIN%...
  %CFD% tunnel route dns %TUNNEL_NAME% %DOMAIN%
)

echo.
echo  ------------------------------------
echo   Local:  http://localhost:3000
echo   Public: https://%DOMAIN%
echo  ------------------------------------
echo.

REM ── Start de Node server in een aparte window ──
start "3DC Server" cmd /k "cd /d %~dp0 && node server.js"

REM ── Wacht even tot de server up is, dan tunnel openen ──
timeout /t 3 /nobreak >nul
echo [TUNNEL] Verbinden met Cloudflare...
%CFD% tunnel run %TUNNEL_NAME%

echo.
echo  Tunnel gestopt.
pause
