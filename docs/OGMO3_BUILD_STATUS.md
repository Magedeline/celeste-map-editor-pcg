# Ogmo 3 Build Status & Troubleshooting

## Current Status

✅ **COMPLETED:**
- Room selection UX improved in MonoGame editors
- Map format conversion scripts ready (TypeScript)
- MonoGame Pipeline Tool (MGCB 3.8.4.1) verified
- Comprehensive documentation created
- Launcher scripts configured

⚠️ **STATUS: Source Build Failed**
- Ogmo 3 CE 3.4.0 at `E:\Celeste\Ogmo Editor` is **source code only**
- Automatic npm install fails due to legacy dependency conflicts
- Haxe compilation toolchain not configured

## The Problem

The local Ogmo 3 copy is a Haxe-based Electron application with outdated npm dependencies:

```
npm error code 1
npm error Error: Cannot find module 'sshpk'
npm error path E:\Celeste\Ogmo Editor\node_modules\node-sass
```

**Root Causes:**
1. **node-sass@4.14.1** - Deprecated in 2020, incompatible with Node.js v24.13.1
2. **Broken dependency chain** - `http-signature → request → sshpk (missing)`
3. **phantomjs-prebuilt** - Locked/inaccessible during npm cleanup
4. **Missing Haxe toolchain** - Project requires Haxe compiler for source build

## Solution: Download Pre-Built Release

### Recommended: Get Windows Binary

The easiest solution is to download the precompiled Windows release:

1. **Visit:** https://github.com/Ogmo-Editor/OgmoEditor3/releases
2. **Download:** Latest Windows `.zip` file (version 3.4.0 or newer)
3. **Extract:** Overwrite contents of `E:\Celeste\Ogmo Editor` with extracted files
4. **Verify:** Run `launch-ogmo.ps1` or `launch-ogmo.bat` from `/tools/` directory

### Alternative: Use Map Converter Scripts

If you don't need the Ogmo 3 UI right now, you can still work with Ogmo 3 format files using the conversion scripts:

```powershell
# Convert Ogmo 3 format to Celeste
npm run convert:ogmo-to-celeste -- --input mymap.oel --output mymap.json

# Convert Celeste to Ogmo 3 format
npm run convert:celeste-to-ogmo -- --input mymap.json --output mymap.oel
```

This allows you to:
- Edit maps in Ogmo 3 (once installed)
- Convert to Celeste format for testing
- Use both editors on the same maps

## Build from Source (Advanced)

If you want to build from source, you'll need:

1. **Haxe Compiler** - https://haxe.org/download/
2. **Fix Node Dependencies** - Replace `node-sass` with `sass`:
   ```powershell
   cd "E:\Celeste\Ogmo Editor"
   npm install sass@1.69.0 --save
   (Edit package.json to remove node-sass)
   npm install --legacy-peer-deps
   npm run build
   npm run dist
   ```
3. **Or:** Use Node.js v18 LTS (compatible with old dependencies)

## Quick Start

### Fast Path: Use Conversion Scripts
```powershell
# From project root
npm run convert:ogmo-to-celeste -- --input maps/MyMap.oel --output maps/MyMap.json
```

### Best Path: Download Binary
1. Get Windows release from GitHub
2. Extract to `E:\Celeste\Ogmo Editor`
3. Run `tools/launch-ogmo.ps1`

### Then Test Conversion
```powershell
# Create map in Ogmo 3, save as map.oel
npm run convert:ogmo-to-celeste -- --input map.oel --output map.json
# Test in MonoGame preview
```

## What's Working

- ✅ MonoGame in-editor preview and native editor (enhanced with room selection)
- ✅ Room selection (left-click) with proper coordinate math
- ✅ Celeste ↔ Ogmo 3 format conversion
- ✅ MGCB sprite asset pipeline
- ✅ Map format documentation

## Next Steps

**Immediate:**
1. Download Ogmo 3 Windows release (.zip)
2. Extract to `E:\Celeste\Ogmo Editor`
3. Verify with `tools/launch-ogmo.ps1`

**Testing:**
1. Create/edit map in Ogmo 3
2. Convert to Celeste format: `npm run convert:ogmo-to-celeste --`
3. Preview in MonoGame editor
4. Make changes in Celeste format
5. Convert back: `npm run convert:celeste-to-ogmo --`

## See Also

- [Ogmo 3 Setup Guide](./OGMO_SETUP.md)
- [Ogmo 3 Quick Start](./OGMO_QUICKSTART.md)
- [Ogmo-MonoGame Integration](./OGMO_MONOGAME_SETUP.md)
