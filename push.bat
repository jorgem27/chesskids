@echo off
setlocal enabledelayedexpansion

:: Navigate to project root
cd /d "%~dp0"

echo ========================================================
echo      ChessKids Academy - Push Code & Database
echo ========================================================
echo.

:: Determine commit message
set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" (
    set /p "COMMIT_MSG=Enter commit message (press Enter for default): "
)
if "!COMMIT_MSG!"=="" (
    set "COMMIT_MSG=Update code and database - %DATE% %TIME%"
)

:: Step 1: Git Add, Commit & Push
echo.
echo [1/3] Staging and committing changes to Git...
git add -A

:: Check if there are changes to commit
git diff --cached --quiet
if %ERRORLEVEL% neq 0 (
    git commit -m "!COMMIT_MSG!"
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Git commit failed.
        pause
        exit /b 1
    )
) else (
    echo [INFO] No new local changes to commit.
)

echo.
echo [2/3] Pushing to GitHub (origin main)...
git push origin main
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to push to origin main!
    pause
    exit /b 1
)
echo [OK] Code successfully pushed to main branch.

:: Step 2: Push database migrations to remote Cloudflare D1
echo.
echo [3/3] Pushing database migrations to remote Cloudflare D1...
call npm run db:migrate:remote
if %ERRORLEVEL% neq 0 (
    echo.
    echo [WARNING] Remote database migration did not finish successfully or was cancelled.
    echo Please verify you are logged in to Cloudflare with: npx wrangler login
) else (
    echo [OK] Remote database migrations applied successfully.
)

:: Step 3 (Optional): Cloudflare Worker deployment
echo.
echo ========================================================
echo [OPTIONAL] Would you also like to deploy the site to Cloudflare now?
set /p "DEPLOY_NOW=Deploy now? (y/N): "
if /i "!DEPLOY_NOW!"=="y" (
    echo [INFO] Deploying to Cloudflare Workers...
    call npm run deploy
)

echo.
echo ========================================================
echo   Push process completed!
echo ========================================================
echo.
pause
