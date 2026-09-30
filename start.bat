@echo off
setlocal enabledelayedexpansion

:: Navigate to project root
cd /d "%~dp0"

echo ========================================================
echo           ChessKids Academy - Launching App
echo ========================================================
echo.

:: 1. Verify Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js 22+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 2. Verify dependencies
if not exist "node_modules\" (
    echo [INFO] Dependencies not found. Running npm install...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: 3. Ensure local database migrations are applied
echo [INFO] Checking local database migrations (Cloudflare D1 / SQLite)...
call npm run db:migrate
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Migration check returned non-zero code. Continuing startup...
)

echo.
echo ========================================================
echo   [OK] Server starting on: http://localhost:4321
echo   - Frontend: Astro + Preact UI
echo   - Backend:  Astro SSR API endpoints (/api/*) + Cloudflare D1
echo ========================================================
echo.

:: Open default browser after a short delay in the background
start "" /b cmd /c "ping 127.0.0.1 -n 3 >nul & start http://localhost:4321"

:: Start Astro dev server (serves both frontend and backend)
call npm run dev
