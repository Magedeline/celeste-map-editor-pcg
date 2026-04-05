#!/usr/bin/env powershell
<#
.SYNOPSIS
    Ogmo 3 Editor Launcher
    
.DESCRIPTION
    Launches Ogmo 3 Editor from the local installation at E:\Celeste\Ogmo Editor
    
.EXAMPLE
    .\launch-ogmo.ps1
#>

$OgmoPath = "E:\Celeste\Ogmo Editor"

Write-Host "Launching Ogmo 3 Editor..." -ForegroundColor Green
Write-Host "Path: $OgmoPath" -ForegroundColor Cyan

# Check for executable
$ExePath = Join-Path $OgmoPath "OgmoEditor3.exe"
if (Test-Path $ExePath) {
    Write-Host "Found executable, launching..." -ForegroundColor Green
    & $ExePath
    exit 0
}

# Check for dist output
$DistExe = Join-Path $OgmoPath "dist\OgmoEditor3.exe"
if (Test-Path $DistExe) {
    Write-Host "Found built executable, launching..." -ForegroundColor Green
    & $DistExe
    exit 0
}

# Check for source (Node.js/Electron)
$PackageJson = Join-Path $OgmoPath "package.json"
if (Test-Path $PackageJson) {
    Write-Host "Source code detected (Haxe project)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "⚠️  The local copy is source code only and requires Haxe compilation." -ForegroundColor Yellow
    Write-Host "    Automatic npm build has failed due to old dependencies (node-sass, etc)." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "RECOMMENDED: Download pre-built Windows release:" -ForegroundColor Cyan
    Write-Host "  1. Visit: https://github.com/Ogmo-Editor/OgmoEditor3/releases" -ForegroundColor Cyan
    Write-Host "  2. Download the Windows .zip for version 3.4.0 or later" -ForegroundColor Cyan
    Write-Host "  3. Extract to: $OgmoPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "ALTERNATIVELY: Use the Celeste map converter scripts" -ForegroundColor Green
    Write-Host "  Converting between Ogmo 3 and Celeste formats:" -ForegroundColor Green
    Write-Host "    npm run convert:ogmo-to-celeste -- --input map.oel --output map.json" -ForegroundColor Green
    Write-Host "    npm run convert:celeste-to-ogmo -- --input map.json --output map.oel" -ForegroundColor Green
    Write-Host ""
    exit 1
}

# Not found
Write-Host ""
Write-Host "ERROR: Ogmo 3 not found at: $OgmoPath" -ForegroundColor Red
Write-Host ""
Write-Host "To build from source:" -ForegroundColor Yellow
Write-Host "  1. cd $OgmoPath"
Write-Host "  2. npm install"
Write-Host "  3. npm start"
Write-Host ""
exit 1
