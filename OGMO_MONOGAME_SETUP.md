# MonoGame Sprites + Ogmo 3 Integration - Setup Complete ✓

This document summarizes the tools and integrations now available in your Celeste Map Editor project.

---

## 🎉 What's Been Installed

### 1. **MonoGame Pipeline Tool (MGCB)**
- **Status**: ✓ Installed globally
- **Version**: 3.8.4.1
- **Purpose**: Manage sprite assets, build XNB files, configure texture compression

**Usage:**
```bash
# GUI mode (recommended for beginners)
mgcb-editor

# Command line (for automation)
mgcb build content/Content.mgcb
mgcb-editor content/Content.mgcb
```

**What it does:**
- Import PNG sprite sheets
- Define sprite regions and animations
- Build final XNB assets for MonoGame
- Configure compression and output formats

---

### 2. **Ogmo Editor 3 Integration**
- **Status**: ✓ Found and ready to use
- **Location**: `E:\Celeste\Ogmo Editor`
- **Version**: 3.4.0 Community Edition
- **Purpose**: Professional tile-based map editor

**Launch Ogmo 3:**
```bash
# PowerShell
.\tools\launch-ogmo.ps1

# Command Prompt
.\tools\launch-ogmo.bat

# Or directly from the source directory
cd "E:\Celeste\Ogmo Editor"
npm start
```

**What it provides:**
- Visual tile and entity placement
- Layer support for organized room design
- Custom entity and trigger definitions
- Export/import to multiple formats

---

### 3. **Map Format Converters**
- **Status**: ✓ Installed and ready
- **Files**: 
  - `scripts/ogmo-to-celeste.ts`
  - `scripts/celeste-to-ogmo.ts`
- **Dependencies**: xml2js, ts-node, @types/xml2js

**Usage:**
```bash
# Convert Ogmo → Celeste
npm run convert:ogmo-to-celeste -- --input map.oel --output map.json

# Convert Celeste → Ogmo
npm run convert:celeste-to-ogmo -- --input map.json --output map.oel
```

---

## 📦 New Dependencies Added

```json
{
  "devDependencies": {
    "ts-node": "^10.9.2",
    "@types/xml2js": "^0.4.14"
  },
  "dependencies": {
    "xml2js": "^0.6.2"
  }
}
```

---

## 🛠️ New npm Scripts

| Script | Command | Purpose |
|--------|---------|---------| 
| `build:monogame-tools` | `npm run build:monogame-tools` | Build preview + editor |
| `build:monogame-preview` | `npm run build:monogame-preview` | Build preview only |
| `build:monogame-editor` | `npm run build:monogame-editor` | Build editor only |
| **convert:ogmo-to-celeste** | `npm run convert:ogmo-to-celeste -- --input X --output Y` | Ogmo → Celeste |
| **convert:celeste-to-ogmo** | `npm run convert:celeste-to-ogmo -- --input X --output Y` | Celeste → Ogmo |

---

## 📚 Documentation Files Created

1. **[docs/OGMO_SETUP.md](../docs/OGMO_SETUP.md)** - Complete setup guide
   - Installation instructions
   - Format mapping details
   - Workflow examples
   - Best practices

2. **[docs/OGMO_QUICKSTART.md](../docs/OGMO_QUICKSTART.md)** - Quick start guide
   - Step-by-step tutorials
   - Full workflow examples
   - Keyboard shortcuts
   - Troubleshooting

3. **[tools/README.md](./README.md)** - Tools directory overview
   - File organization
   - Tool descriptions
   - Development notes

---

## 🚀 Quick Start Workflow

### Create a Map
```bash
# 1. Open Ogmo 3
OgmoEditor3.exe

# 2. Design your rooms, tiles, entities
# (Save as map.oel)

# 3. Convert to Celeste format
npm run convert:ogmo-to-celeste -- --input map.oel --output map.json

# 4. Open in VS Code
# The map.json now appears in the editor
```

### Create Sprites
```bash
# 1. Create artwork (Aseprite, Krita, GIMP, etc.)
# Save as PNG files to assets/sprites/

# 2. Open MonoGame Pipeline
mgcb-editor

# 3. Create new project (or open existing content.mgcb)

# 4. Import PNG sprites
# Right-click → Add sprite files

# 5. Build
# Build menu → Build
# Output: bin/content/sprites.xnb

# 6. Use in maps
# Reference sprite in Ogmo entity definitions
```

### Edit Full Workflow
```
Design in Ogmo → Convert → Edit in Celeste → Preview in MonoGame
```

---

## 📁 Project Structure

```
celeste-map-editor-vscode/
├── assets/
│   ├── sprites/              ← PNG source art
│   ├── tilesets/             ← 8x8 pixel tile images
│   └── Content.mgcb          ← MonoGame config
├── bin/
│   └── content/              ← Built XNB assets
├── maps/
│   ├── *.oel                 ← Ogmo Editor files
│   ├── *.json                ← Celeste format
│   └── exports/              ← Converted maps
├── scripts/
│   ├── ogmo-to-celeste.ts    ← Converter (OEL→JSON)
│   └── celeste-to-ogmo.ts    ← Converter (JSON→OEL)
├── tools/
│   └── ogmo3/                ← Ogmo 3 files (when downloaded)
├── docs/
│   ├── OGMO_SETUP.md         ← Full setup guide
│   ├── OGMO_QUICKSTART.md    ← 10-step tutorial
│   └── generator-modes-plan.md
└── csharp-monogame-preview/  ← Preview viewer
```

---

## 🎮 MonoGame Tools Features

### Native Editor (CelesteMapNativeEditor.exe)
- **Room Layout**: Click to select, drag to move rooms
- **Tile Painting**: FG and BG tiles with brush selection
- **Entity Placement**: Add/remove game objects
- **Triggers**: Define trigger volumes
- **Real-time Grid**: Grid display for selected room
- **Keyboard Controls**: 
  - M/F/B/E/T/X for tool selection
  - Tab to cycle tools
  - Delete to remove selected room
  - Ctrl+S to save

### Preview Viewer (CelesteMapMonoGamePreview.exe)
- **Room Selection**: Left-click to select and highlight
- **Grid Display**: Shows grid for selected rooms
- **Pan & Zoom**: Right-drag to pan, scroll to zoom
- **Auto-reload**: Watches for map changes

---

## 🔄 Format Conversion Details

### Ogmo → Celeste Mapping
```
Ogmo Layer              → Celeste Field
─────────────────────────────────────
Room                    → Room
Tileset (name=Foreground) → TilesFg
Tileset (name=Background) → TilesBg
Entity                  → Entities / Triggers
Decal                   → DecalsFg / DecalsBg
```

### Celeste → Ogmo Mapping
```
Celeste Field           → Ogmo Layer
─────────────────────────────────────
Room                    → Level
TilesFg                 → Tileset (Foreground)
TilesBg                 → Tileset (Background)
Entities                → Entity
Triggers                → Entity (type=trigger)
DecalsFg/Bg             → Decal
```

---

## ✅ Verification Checklist

- [x] MonoGame Pipeline Tool (MGCB) installed
- [x] Ogmo 3 integration scripts created
- [x] Map format converters implemented
- [x] npm scripts configured
- [x] TypeScript dependencies resolved
- [x] Documentation generated
- [x] Room selection fixed in MonoGame preview/editor
- [x] Coordinate conversion corrected

---

## 🆘 Next Steps

1. **Download Ogmo 3**:
   - Visit: https://github.com/Ogmo-Editor/OgmoEditor3/releases
   - Extract or install with winget

2. **Read the quick start**:
   - Open: `docs/OGMO_QUICKSTART.md`
   - Follow the 10-step workflow

3. **Test conversion**:
   ```bash
   npm run convert:ogmo-to-celeste -- --input sample.oel --output sample.json
   ```

4. **Build a test map**:
   - Create in Ogmo 3
   - Convert to Celeste format
   - Open in VS Code editor
   - Preview in MonoGame window

---

## 📞 Troubleshooting

**Script won't run?**
```bash
npm install  # Reinstall dependencies
```

**MGCB not found?**
```bash
dotnet tool install -g dotnet-mgcb
```

**Conversion fails?**
- Check file path is correct
- Ensure Ogmo file is valid XML
- Review error output for details

**Ogmo GUI won't open?**
- Try running as Administrator
- Check antivirus isn't blocking it
- Verify correct platform version (win64/macOS/linux)

---

## 📖 References

- **Ogmo 3 Docs**: https://ogmo-editor-3.github.io/
- **MonoGame Docs**: https://docs.monogame.net/
- **Celeste Modding**: https://celestemod.com/
- **Asset Pipeline**: https://docs.monogame.net/articles/content_pipeline/

---

**Version**: 1.0  
**Date**: March 26, 2026  
**Status**: ✓ Complete and ready to use
