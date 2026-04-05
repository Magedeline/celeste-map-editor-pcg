# Loenn Installation Guide

**Loenn** is the proper Celeste map editor that can decompile `.bin` files to JSON format. This is what we'll use for the `.bin` → `.json` → `.ogmo` conversion pipeline.

## What is Loenn?

Loenn is a modern, Python-based map editor for Celeste. It can:
- Open `.bin` map files directly
- Export maps to JSON format
- Handle Celeste 1.4+ maps
- Cross-platform support (Windows, macOS, Linux)

## Installation

### Option 1: Pre-built Windows Binary (Recommended)

1. Visit: https://github.com/CelestialCartographers/Loenn/releases
2. Download the latest `Loenn-vX.X.X-win-x64.zip` (Windows binary)
3. Extract to: `C:\Program Files\Loenn` or `%USERPROFILE%\scoop\apps\loenn\current`
4. Add to PATH (see section below)

### Option 2: Python Package

```powershell
pip install loenn
```

### Option 3: From Source

```powershell
git clone https://github.com/CelestialCartographers/Loenn.git
cd Loenn
pip install -e .
```

## Add Loenn to Windows PATH

### Method 1: Using System Settings (GUI)

1. Press `Win+X` and select "System"
2. Click "Advanced system settings"
3. Click "Environment Variables..."
4. Under "User variables", click "New..."
5. Variable name: `PATH`
6. Variable value: `C:\Program Files\Loenn` (or wherever you installed it)
7. Click OK, OK, OK
8. **Restart PowerShell/terminal**

### Method 2: Using PowerShell (as Administrator)

```powershell
# Replace path with your Loenn installation directory
[Environment]::SetEnvironmentVariable("PATH", "$env:PATH;C:\Program Files\Loenn", "User")
```

## Verify Installation

```powershell
loenn --version
```

or

```powershell
python -m loenn --version
```

Should show version number.

## Usage with Our Conversion Pipeline

Once installed, run:

```powershell
npm run convert:bin-to-ogmo -- --input "C:\Users\Gabriel L\Desktop\celeste\Mods\MaggyHelper\Maps\Maggy"
```

The script will:
1. Find Loenn automatically
2. Convert all `.bin` files → `.json` files
3. Convert all `.json` files → `.ogmo` files
4. Report success/skipped/failed counts

## Manual Conversion (Alternative)

If you prefer to manually decompile with Loenn:

```powershell
loenn from-binary input.bin output.json
```

Then run the JSON→Ogmo converter:

```powershell
npm run convert:json-to-ogmo-all -- --input "C:\path\to\maps"
```

## Troubleshooting

### "loenn: command not found"

- Ensure Loenn is installed: `pip install loenn` or download binary
- Verify PATH is updated: `$env:PATH`
- Restart PowerShell after updating PATH

### "ModuleNotFoundError: No module named 'loenn'"

- Install Python package: `pip install loenn`
- Or use pre-built binary instead

### Decompilation fails on specific maps

- Try using Loenn's GUI: Simply open the `.bin` file with Loenn
- Export as JSON from the GUI
- Re-run conversion script to generate `.ogmo` files

## Next Steps

1. Install Loenn
2. Run: `npm run convert:bin-to-ogmo -- --input "<your maps directory>"`
3. All `.ogmo` files will be ready to open in Ogmo 3 Editor

## References

- Loenn GitHub: https://github.com/CelestialCartographers/Loenn
- Celeste Modding: https://celestemod.com/
- Map Format Docs: https://github.com/CelestialCartographers/Loenn/wiki
