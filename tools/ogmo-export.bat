@echo off
REM OGMO External Script: Export Maps to Celeste Format
REM This script can be called by OGMO 3 as an external tool
REM Configure in OGMO Project Settings -> External Tools -> Add
REM 
REM Arguments: {project_dir} {current_file}
REM Output: Converted Celeste JSON files

setlocal enabledelayedexpansion

set PROJECT_DIR=%~1
set INPUT_FILE=%~2
set SCRIPT_DIR=%~dp0..
set OUTPUT_DIR=%PROJECT_DIR%\..\celeste-export

if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

echo.
echo ============================================
echo OGMO to Celeste Converter
echo ============================================
echo Input:  %INPUT_FILE%
echo Output: %OUTPUT_DIR%
echo.

if exist "%INPUT_FILE%" (
    node "%SCRIPT_DIR%\ogmo-to-celeste.js" "%INPUT_FILE%" "%OUTPUT_DIR%"
    if !errorlevel! equ 0 (
        echo.
        echo ✅ Conversion complete! Files saved to:
        echo    %OUTPUT_DIR%
        pause
    ) else (
        echo.
        echo ❌ Conversion failed!
        pause
    )
) else (
    echo ❌ Input file not found: %INPUT_FILE%
    pause
)
