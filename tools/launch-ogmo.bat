@echo off
REM Ogmo 3 Editor Launcher
REM Uses the local installation at E:\Celeste\Ogmo Editor

set OGMO_PATH=E:\Celeste\Ogmo Editor

echo Launching Ogmo 3 Editor...
echo Path: %OGMO_PATH%

REM Option 1: If executable exists
if exist "%OGMO_PATH%\OgmoEditor3.exe" (
    start "" "%OGMO_PATH%\OgmoEditor3.exe"
    exit /b 0
)

REM Option 2: If it's a Node.js/Electron app, check source
if exist "%OGMO_PATH%\package.json" (
    echo.
    echo WARNING: Source code detected (Haxe project)
    echo.
    echo The local copy is source code that requires Haxe compilation.
    echo Automatic npm build has failed due to old dependencies.
    echo.
    echo RECOMMENDED: Download pre-built Windows release
    echo   1. Visit: https://github.com/Ogmo-Editor/OgmoEditor3/releases
    echo   2. Download Windows .zip for version 3.4.0 or later
    echo   3. Extract to: %OGMO_PATH%
    echo.
    echo ALTERNATIVELY: Use the Celeste map converter scripts
    echo   Converting between Ogmo 3 and Celeste formats:
    echo   npm run convert:ogmo-to-celeste -- --input map.oel --output map.json
    echo   npm run convert:celeste-to-ogmo -- --input map.json --output map.oel
    echo.
    pause
    exit /b 1
)

REM Option 3: Check for build output
if exist "%OGMO_PATH%\dist" (
    start "" "%OGMO_PATH%\dist\OgmoEditor3.exe"
    exit /b 0
)

echo.
echo ERROR: Ogmo 3 executable not found at:
echo   %OGMO_PATH%
echo.
echo To build from source:
echo   1. cd %OGMO_PATH%
echo   2. npm install
echo   3. npm start
echo.
pause
exit /b 1
