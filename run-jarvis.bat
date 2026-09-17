@echo off
title JARVIS System Software Launcher
echo ===================================================
echo   J.A.R.V.I.S. SYSTEM SOFTWARE NATIVE LAUNCHER
echo ===================================================
echo.

:: Check if npm is in path
where npm >col 2>nul
if %errorlevel% neq 0 (
    echo [System] npm not detected in PATH. Checking default installer path...
    if exist "C:\Program Files\nodejs" (
        echo [System] Temporarily adding Node.js directory to PATH...
        set PATH=C:\Program Files\nodejs;%PATH%
    ) else (
        echo [ERROR] Node.js is not detected on your system.
        echo Please run `winget install OpenJS.NodeJS.LTS` to install it.
        pause
        exit /b 1
    )
)

echo Starting J.A.R.V.I.S. Python Desktop Uplink...
start "JARVIS Python Agent" python -u jarvis-local-agent.py

echo Starting dev server and native shell...
npm run electron:dev
pause
