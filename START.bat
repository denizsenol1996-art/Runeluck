@echo off
title RuneLuck Casino
echo Starting RuneLuck Casino...
echo Layout will auto-save to: layouts/current.json
echo.
cd /d "%~dp0"
node server.js
pause
