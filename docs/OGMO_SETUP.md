# Ogmo 3 and MonoGame Sprite Tools Integration

> ⚠️ **BUILD NOTE:** The source copy at `E:\Celeste\Ogmo Editor` requires a Haxe toolchain to compile. For immediate use, [download the precompiled Windows release](https://github.com/Ogmo-Editor/OgmoEditor3/releases) and extract into that directory. See [OGMO3_BUILD_STATUS.md](./OGMO3_BUILD_STATUS.md) for details.

## MonoGame Pipeline Tool (MGCB)

The MonoGame Content Builder is installed and ready to use.

### Usage

**Manage sprites and assets:**
```bash
mgcb <file.mgcb>
```

Or use the GUI:
```bash
mgcb-editor
```

**Common tasks:**
- Import PNG sprites
- Create sprite sheets
- Build XNB binary assets
- Configure texture compression

See: [MonoGame Pipeline Documentation](https://docs.monogame.net/articles/getting_started/1_setting_up_monogame.html)

---

## Ogmo 3 Editor Setup

Ogmo 3 is a professional tile-based map editor with support for custom entities and layers.

### Your Installation

Ogmo 3 Community Edition 3.4.0 is installed at:
```
E:\Celeste\Ogmo Editor
```

### Quick Launch

From the project root, run one of:

**PowerShell:**
```powershell
.\tools\launch-ogmo.ps1
```

**Batch (CMD):**
```cmd
.\tools\launch-ogmo.bat
```

**Manual Launch:**
```powershell
cd "E:\Celeste\Ogmo Editor"
npm install  # First run only
npm start    # Launches Electron app
```

### Quick Start

1. **Create a new project** in Ogmo 3
2. **Export to Celeste format**:
   - Use the included export script: `scripts/ogmo-to-celeste.ts`
   - Or manually export as JSON and convert

3. **Edit in Ogmo 3**:
   - Lay out rooms and tiles
   - Place entities and triggers
   - Define custom properties

4. **Import into Celeste Editor**:
   - Run: `npm run convert:ogmo-to-celeste`
   - The `*.oel` Ogmo file will be converted to Celeste map format

---

## Format Conversion

### Ogmo to Celeste

The project includes automatic conversion tools:

```bash
npm run convert:ogmo-to-celeste -- --input map.oel --output map.json
```

**Mapping:**
- Ogmo "Rooms" → Celeste "Rooms"
- Ogmo "Tilesets" → Celeste "TilesFg" / "TilesBg"
- Ogmo "Entities" → Celeste "Entities"
- Ogmo "Decals" → Celeste "DecalsFg" / "DecalsBg"

### Celeste to Ogmo

Export your Celeste map to Ogmo format:

```bash
npm run convert:celeste-to-ogmo -- --input map.json --output map.oel
```

---

## Workflow Example

### Edit in Ogmo 3 → Import to Celeste

1. Open Ogmo 3
2. Open or create a `.oel` project
3. Design your room layout, place tiles and entities
4. **Export** the map as JSON (File → Export)
5. Run: `npm run convert:ogmo-to-celeste`
6. Open the exported `.json` in VS Code Celeste editor
7. Fine-tune in the MonoGame preview if needed

### Create Sprites → Use in Map

1. **Create sprite assets:**
   - Design sprites in your image editor (Aseprite, Krita, etc.)
   - Save as PNG files

2. **Build sprites with MGCB:**
   ```bash
   mgcb-editor
   ```
   - Import PNG files
   - Configure sprite sheets
   - Build XNB files

3. **Reference in Ogmo 3:**
   - In entity definitions, point to built sprite assets
   - Place entities in the map editor

4. **Render in MonoGame preview:**
   - The preview will use built sprites to render entities

---

## Project Assets Structure

```
project/
├── assets/
│   ├── sprites/           # PNG source sprites
│   ├── tilesets/          # PNG tilesets
│   └── content.mgcb       # MGCB project
├── bin/
│   └── content/           # Built XNB assets
├── maps/
│   ├── *.oel              # Ogmo Editor projects
│   ├── *.json             # Celeste map format
│   └── exports/           # Converted maps
└── docs/
    └── OGMO_SETUP.md      # This file
```

---

## Best Practices

1. **Version control**: Commit `.oel` (Ogmo) and `.json` (Celeste) files separately
2. **Asset pipeline**: Always rebuild sprites with MGCB after changes
3. **Layering**: Use Ogmo's layer system to organize visual depth
4. **Entity types**: Define custom entity types in Ogmo to match Celeste game objects
5. **Testing**: Verify exports in the MonoGame preview before shipping

---

## Troubleshooting

**Conversion fails?**
- Ensure the input file is valid JSON or `.oel` XML
- Check that entity/tile IDs match between formats
- Review console output for specific error messages

**Sprites not rendering?**
- Run MGCB to rebuild content
- Verify sprite paths in entity definitions
- Check that XNB files exist in `bin/content/`

**Ogmo won't start?**
- Ensure you downloaded the correct platform version (win64, macOS, Linux)
- Try running as Administrator
- Check antivirus isn't blocking execution

---

## References

- [Ogmo 3 Official Docs](https://ogmo-editor-3.github.io/)
- [Ogmo 3 GitHub](https://github.com/Ogmo-Editor/OgmoEditor3)
- [MonoGame Documentation](https://docs.monogame.net/)
- [Celeste Modding](https://celestemod.com/)
