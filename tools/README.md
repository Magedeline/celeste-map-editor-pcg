# Tools Directory

This directory contains helper tools and integrations for the Celeste Map Editor.

## Contents

### ogmo3/
External tools and resources for Ogmo 3 integration.

**To set up:**
1. Download Ogmo 3 from: https://github.com/Ogmo-Editor/OgmoEditor3/releases
2. Extract to this directory or add to system PATH
3. Run: `OgmoEditor3.exe`

---

## Installing Tools

### MonoGame Pipeline Tool
```bash
npm run build:monogame-tools
```

This builds:
- `CelesteMapMonoGamePreview.exe` - Real-time preview
- `CelesteMapNativeEditor.exe` - Full native editor

### Ogmo 3
Located at: `E:\Celeste\Ogmo Editor`

**IMPORTANT:** The source code build has dependency issues with old Haxe-based npm packages. 
For immediate use:
1. Download the precompiled Windows release from: https://github.com/Ogmo-Editor/OgmoEditor3/releases
2. Extract into the `E:\Celeste\Ogmo Editor` directory
3. See `docs/OGMO3_BUILD_STATUS.md` for details

**Launch (after installing binary):**
```powershell
# From project root
.\tools\launch-ogmo.ps1
```

Alternative launch methods:
- Use `tools\launch-ogmo.bat` for Batch/CMD
- Or manually: `cd "E:\Celeste\Ogmo Editor" && npx electron .`

---

## Map Format Conversion

Convert between Ogmo 3 and Celeste formats:

```bash
# Ogmo → Celeste
npm run convert:ogmo-to-celeste -- --input map.oel --output map.json

# Celeste → Ogmo
npm run convert:celeste-to-ogmo -- --input map.json --output map.oel
```

See [OGMO_QUICKSTART.md](../docs/OGMO_QUICKSTART.md) for complete workflows.

---

## Sprite Asset Pipeline

Use MonoGame Pipeline Tool to manage sprites:

```bash
mgcb-editor
```

This opens a GUI for:
- Importing PNG sprites
- Building sprite sheets
- Configuring compression
- Generating XNB assets

Output goes to: `bin/content/`

---

## Development

Scripts in this directory:
- `ogmo-to-celeste.ts` - Convert Ogmo Editor projects to Celeste maps
- `celeste-to-ogmo.ts` - Convert Celeste maps to Ogmo Editor format

See [../scripts/](../scripts/) for the actual implementation.
