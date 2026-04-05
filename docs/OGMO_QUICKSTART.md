# Ogmo 3 + MonoGame Sprites Quick Start Guide

## 1. Launch Ogmo 3

### Your Local Installation
Ogmo 3 is already installed at: `E:\Celeste\Ogmo Editor`

**Quick Launch:**
```powershell
# PowerShell (from project root)
.\tools\launch-ogmo.ps1

# Or Batch (from project root)
.\tools\launch-ogmo.bat
```

**Manual Launch:**
```powershell
# From the Ogmo directory
cd "E:\Celeste\Ogmo Editor"
npm install  # First time only
npm start
```

### macOS
```bash
# Download from releases page
# Or use Homebrew (if available):
brew install ogmo-editor
```

### Linux
Download from: https://github.com/Ogmo-Editor/OgmoEditor3/releases

---

## 2. Verify MonoGame Tools

```bash
# Verify MGCB (MonoGame Content Builder) is installed
mgcb --version

# If not installed:
dotnet tool install -g dotnet-mgcb
```

---

## 3. Create a Map in Ogmo 3

### Step 1: Launch Ogmo 3
```powershell
OgmoEditor3.exe
# Or if installed via package manager, just search "Ogmo" in Start Menu
```

### Step 2: Create New Project
- File → New Project
- Set dimensions (e.g., 320×184 for Celeste rooms)
- Define layers:
  - **Tiles_FG** (Foreground layer)
  - **Tiles_BG** (Background layer)
  - **Entities** (game objects)
  - **Decals** (visual decorations)

### Step 3: Design Your Rooms
- Import sprite tilesets (Celeste uses 8×8 tiles)
- Paint tiles on layers
- Place entities and decals
- Save as `map.oel`

---

## 4. Convert Ogmo Map to Celeste Format

```bash
# From the project root
npm run convert:ogmo-to-celeste -- --input path/to/map.oel --output path/to/map.json

# Example:
npm run convert:ogmo-to-celeste -- --input ./maps/mymap.oel --output ./maps/mymap.json
```

**Output:**
- `map.json` is now ready to use in VS Code Celeste editor
- Can be opened in the native MonoGame editor
- Shows in the preview window

---

## 5. Edit Sprites with MonoGame Pipeline

### Create/Import Sprites

```bash
# Launch the MonoGame Pipeline Tool GUI
mgcb-editor

# Or use the command line:
mgcb build content/Content.mgcb
```

**In mgcb-editor:**
1. Create new project: `content/Content.mgcb`
2. Add PNG sprites from `assets/sprites/`
3. Configure texture compression and output format
4. Build → generates XNB files in `bin/content/`

### Reference Sprites in Maps

In Ogmo 3 entity definitions:
- Set sprite path to built XNB file: `content/sprites/player`
- MonoGame preview will render the sprite

---

## 6. Full Workflow Example

### Edit Map
```
1. Open Ogmo 3
2. Create/edit rooms and place entities
3. Save as mymap.oel
4. Run: npm run convert:ogmo-to-celeste -- --input mymap.oel --output mymap.json
5. Open mymap.json in VS Code → Celeste editor
6. Fine-tune in MonoGame preview (L-click to select rooms, see grid)
```

### Edit Sprites
```
1. Create sprite artwork (Aseprite, Krita, GIMP)
2. Export as PNG to assets/sprites/
3. Open mgcb-editor
4. Import PNG files
5. Build → outputs XNB to bin/content/
6. Sprites now available for use in maps
```

### Export Back to Ogmo
```bash
# If you edit in Celeste format and want to re-edit in Ogmo:
npm run convert:celeste-to-ogmo -- --input mymap.json --output mymap.oel
```

---

## 7. Key File Locations

```
project-root/
├── assets/
│   ├── sprites/          ← Put PNG sprites here
│   ├── tilesets/         ← Tileset images (8x8 pixel tiles)
│   └── Content.mgcb      ← MonoGame Pipeline config
├── bin/
│   └── content/          ← Built XNB assets (auto-generated)
├── maps/
│   ├── *.oel             ← Ogmo Editor projects
│   └── *.json            ← Celeste map format
└── scripts/
    ├── ogmo-to-celeste.ts
    └── celeste-to-ogmo.ts
```

---

## 8. npm Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run build:monogame-tools` | Build both preview & native editor |
| `npm run build:monogame-preview` | Build preview only |
| `npm run build:monogame-editor` | Build native editor only |
| `npm run convert:ogmo-to-celeste` | Convert .oel → .json |
| `npm run convert:celeste-to-ogmo` | Convert .json → .oel |
| `npm run lint:md` | Check markdown syntax |

---

## 9. Keyboard Shortcuts

### MonoGame Native Editor
- **M** - Room Layout tool (for room selection & dragging)
- **F** - Foreground Tiles tool
- **B** - Background Tiles tool
- **E** - Entities tool
- **T** - Triggers tool
- **X** - Erase tool
- **Tab** - Cycle through tools
- **Left-click** - Select room / paint tiles / place entities
- **Right-click** - Erase tiles / remove entities
- **Scroll** - Zoom in/out
- **Right-drag** - Pan camera
- **Delete/Backspace** - Delete selected room

### Ogmo 3
- **Left-click** → Select & paint
- **Right-click** → Multi-select or erase
- **Middle-drag** → Pan
- **Scroll** → Zoom
- **Ctrl+S** (or Cmd+S) → Save

---

## 10. Troubleshooting

### "Ogmo file not recognized"
- Ensure file is XML format (`.oel` or `.json`)
- Validate format: `npm run convert:ogmo-to-celeste` should show errors

### "Conversion script not found"
- Run: `npm install` to install dependencies
- Check `ts-node` is in devDependencies

### "MonoGame sprites not showing"
- Rebuild assets: `mgcb build content/Content.mgcb`
- Check sprite paths match entity definitions
- Verify XNB files exist in `bin/content/`

### "Ogmo Editor won't start"
- Download correct platform (win64/macOS/linux)
- Try running as Administrator (Windows)
- Check antivirus isn't blocking execution

---

## Resources

- 📚 [Ogmo 3 Documentation](https://ogmo-editor-3.github.io/)
- 🎮 [MonoGame Docs](https://docs.monogame.net/)
- 🚀 [Celeste Modding Guide](https://celestemod.com/)
- 🛠️ [MonoGame Content Pipeline](https://docs.monogame.net/articles/content_pipeline/index.html)
