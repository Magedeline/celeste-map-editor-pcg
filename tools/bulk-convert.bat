@echo off
REM Bulk Conversion Utility
REM Converts entire map directories between Celeste and OGMO formats
REM 
REM Usage: bulk-convert [maps|sides|direction]
REM   maps       - Recursively convert all maps in a directory
REM   sides      - Convert all A/B/C/D side variations
REM   direction  - Convert based on file extension (auto-detect direction)

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0..
set MAPS_DIR=%SCRIPT_DIR%\maps

if "%~1"=="" (
    echo.
    echo Bulk Conversion Utility for Celeste Maps
    echo.
    echo Usage:
    echo   bulk-convert maps        - Recursively convert all directory maps
    echo   bulk-convert sides       - Convert all A/B/C/D side variations
    echo   bulk-convert auto        - Auto-detect format and convert
    echo.
    echo Examples:
    echo   bulk-convert maps        Converts %MAPS_DIR% recursively
    echo   bulk-convert sides       Converts aside, bside, cside, dside folders
    echo.
    pause
    exit /b 1
)

set MODE=%~1
set INPUT_DIR=%~2
if "!INPUT_DIR!"=="" set INPUT_DIR=!MAPS_DIR!

echo.
echo ============================================
echo Bulk Conversion - Mode: !MODE!
echo ============================================
echo Input:  !INPUT_DIR!
echo.

if /i "!MODE!"=="sides" (
    echo Converting all map sides...
    for %%S in (aside bside cside dside) do (
        set SIDE_DIR=!INPUT_DIR!\%%S
        if exist "!SIDE_DIR!" (
            echo.
            echo Processing %%S...
            node "!SCRIPT_DIR!\ogmo-to-celeste.js" "!SIDE_DIR!" "!SCRIPT_DIR!\..\celeste-export\%%S"
        )
    )
) else if /i "!MODE!"=="maps" (
    echo Recursively converting all maps...
    node "!SCRIPT_DIR!\ogmo-to-celeste.js" "!INPUT_DIR!" "!SCRIPT_DIR!\..\celeste-export"
) else if /i "!MODE!"=="auto" (
    echo Auto-detecting and converting...
    node "!SCRIPT_DIR!\ogmo-to-celeste.js" "!INPUT_DIR!" "!SCRIPT_DIR!\..\celeste-export"
) else (
    echo ❌ Unknown mode: !MODE!
    exit /b 1
)

echo.
echo ✅ Bulk conversion complete!
echo.
pause
