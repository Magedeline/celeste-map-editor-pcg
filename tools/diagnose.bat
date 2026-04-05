@echo off
REM Diagnostic script to test OGMO external script setup
REM Run this to check for configuration issues

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0..
set LOG_FILE=%SCRIPT_DIR%\ogmo-debug.log

echo.
echo ============================================
echo OGMO Integration Diagnostic
echo ============================================
echo.

REM Clear log
if exist "%LOG_FILE%" del "%LOG_FILE%"

echo Checking Node.js installation...
node --version >> "%LOG_FILE%" 2>&1
if !errorlevel! equ 0 (
    echo ✅ Node.js found
    node --version
) else (
    echo ❌ Node.js not found in PATH
    echo    Please install Node.js from https://nodejs.org
    goto :error
)

echo.
echo Checking xml2js dependency...
cd /d "%SCRIPT_DIR%"
npm list xml2js >> "%LOG_FILE%" 2>&1
if !errorlevel! equ 0 (
    echo ✅ xml2js package installed
) else (
    echo ⚠️  xml2js not found, installing...
    npm install xml2js >> "%LOG_FILE%" 2>&1
    if !errorlevel! equ 0 (
        echo ✅ xml2js installed successfully
    ) else (
        echo ❌ Failed to install xml2js
        goto :error
    )
)

echo.
echo Checking script files...
if exist "%SCRIPT_DIR%\ogmo-to-celeste.js" (
    echo ✅ ogmo-to-celeste.js found
) else (
    echo ❌ ogmo-to-celeste.js NOT FOUND
    goto :error
)

if exist "%SCRIPT_DIR%\celeste-to-ogmo.js" (
    echo ✅ celeste-to-ogmo.js found
) else (
    echo ❌ celeste-to-ogmo.js NOT FOUND
    goto :error
)

echo.
echo Testing ogmo-to-celeste.js with a dummy call...
node "%SCRIPT_DIR%\ogmo-to-celeste.js" --help >> "%LOG_FILE%" 2>&1
if !errorlevel! equ 0 (
    echo ✅ ogmo-to-celeste.js responds correctly
) else (
    echo ⚠️  ogmo-to-celeste.js returned an error
    echo    This might be normal if there are file issues
)

echo.
echo Testing celeste-to-ogmo.js with a dummy call...
node "%SCRIPT_DIR%\celeste-to-ogmo.js" --help >> "%LOG_FILE%" 2>&1
if !errorlevel! equ 0 (
    echo ✅ celeste-to-ogmo.js responds correctly
) else (
    echo ⚠️  celeste-to-ogmo.js returned an error
)

echo.
echo ============================================
echo Diagnostic Results Summary
echo ============================================
echo.
echo OGMO External Script Configuration:
echo.
echo 1. In OGMO 3 Editor, go to:
echo    Project Settings ^> External Tools ^> Add
echo.
echo 2. Configure FIRST script:
echo    Name:      "Export to Celeste"
echo    Path:      "%SCRIPT_DIR%\tools\ogmo-export.bat"
echo    Arguments: {project_dir} {current_file}
echo.
echo 3. Configure SECOND script:
echo    Name:      "Import from Celeste"
echo    Path:      "%SCRIPT_DIR%\tools\celeste-export.bat"
echo    Arguments: {project_dir} {current_file}
echo.
echo After adding these, you can right-click any map in OGMO
echo and select one of these tools from the context menu.
echo.
echo ============================================
echo.
echo Detailed logs saved to: %LOG_FILE%
echo.
pause
exit /b 0

:error
echo.
echo ❌ Diagnostic failed! See logs above.
echo    Check %LOG_FILE% for details.
echo.
pause
exit /b 1
