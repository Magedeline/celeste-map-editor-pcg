const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const launcherProject = path.join(repoRoot, 'pcg-launcher', 'CelestePcgLauncher.csproj');
const publishDir = path.join(repoRoot, 'pcg-launcher', 'publish');
const nativeGenerator = path.join(repoRoot, 'cpp', 'build', 'Release', 'celeste_pcg_generator.exe');
const launcherExecutable = path.join(publishDir, 'CelestePcgLauncher.exe');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function writePowerShellHelpers() {
  const createShortcutScript = `$ErrorActionPreference = 'Stop'

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LauncherPath = Join-Path $SourceDir 'CelestePcgLauncher.exe'
if (-not (Test-Path $LauncherPath)) {
  throw 'CelestePcgLauncher.exe was not found next to this script.'
}

$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath 'Celeste PCG Launcher.lnk'

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $LauncherPath
$Shortcut.WorkingDirectory = $SourceDir
$Shortcut.IconLocation = $LauncherPath
$Shortcut.Save()

Write-Host "Desktop shortcut created at $ShortcutPath"
`;

  const installScript = `$ErrorActionPreference = 'Stop'

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Join-Path $env:LOCALAPPDATA 'CelestePcgLauncher'

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Copy-Item -Path (Join-Path $SourceDir '*') -Destination $InstallDir -Recurse -Force

$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $DesktopPath 'Celeste PCG Launcher.lnk'
$LauncherPath = Join-Path $InstallDir 'CelestePcgLauncher.exe'

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $LauncherPath
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.IconLocation = $LauncherPath
$Shortcut.Save()

Write-Host "Launcher installed to $InstallDir"
Write-Host "Desktop shortcut created at $ShortcutPath"
`;

  fs.writeFileSync(path.join(publishDir, 'Create-DesktopShortcut.ps1'), createShortcutScript, 'utf8');
  fs.writeFileSync(path.join(publishDir, 'Install-CelestePcgLauncher.ps1'), installScript, 'utf8');

  const createShortcutBatch = `@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Create-DesktopShortcut.ps1"
if errorlevel 1 (
  echo.
  echo Failed to create the desktop shortcut.
  pause
  exit /b 1
)
echo.
echo Desktop shortcut created successfully.
pause
`;

  const installBatch = `@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-CelestePcgLauncher.ps1"
if errorlevel 1 (
  echo.
  echo Failed to install the launcher.
  pause
  exit /b 1
)
echo.
echo Launcher installed successfully.
pause
`;

  fs.writeFileSync(path.join(publishDir, 'Create-DesktopShortcut.bat'), createShortcutBatch, 'utf8');
  fs.writeFileSync(path.join(publishDir, 'Install-CelestePcgLauncher.bat'), installBatch, 'utf8');
}

run(process.execPath, [path.join(repoRoot, 'scripts', 'build-native.js')]);

run('dotnet', [
  'publish',
  launcherProject,
  '-c', 'Release',
  '-r', 'win-x64',
  '--self-contained', 'true',
  '-p:PublishSingleFile=true',
  '-p:IncludeNativeLibrariesForSelfExtract=true',
  '-o', publishDir,
]);

fs.copyFileSync(nativeGenerator, path.join(publishDir, 'celeste_pcg_generator.exe'));
if (!fs.existsSync(launcherExecutable)) {
  throw new Error(`Launcher executable not found at ${launcherExecutable}`);
}

writePowerShellHelpers();

console.log(`PCG launcher published to ${publishDir}`);