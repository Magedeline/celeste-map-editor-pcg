@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "APP_DIR=%ROOT_DIR%electron-app"

if not exist "%APP_DIR%\package.json" (
  echo [ERROR] Could not find electron-app\package.json
  echo Expected path: "%APP_DIR%"
  pause
  exit /b 1
)

cd /d "%APP_DIR%"

if not exist "node_modules\electron\package.json" (
  echo [INFO] Installing Electron dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Launching Celeste Map Editor (PCG)...
call npm start

endlocal