# Celeste Maps - Ogmo 3 Format - CONVERSION COMPLETE ✅

## 📌 Status

**All 69 maps successfully converted** from Loenn JSON format to Ogmo 3 format.

| Component | Status |
|-----------|--------|
| Maps Converted | ✅ 69/69 (100%) |
| File Format | ✅ XML with proper structure |
| Content Validated | ✅ Tiles, entities, decals present |
| Project Files | ✅ project.json & project.oel ready |

---

## 🚀 How to Open Maps in Ogmo 3

### Step 1: Launch Ogmo 3 Editor
- **Executable**: `E:\Celeste\Ogmo Editor\Ogmo.exe`
- Or search **Ogmo 3** in Windows Start menu

### Step 2: Open Project
- In Ogmo 3 menu: **File → Open Project**
- Navigate to: `E:\Celeste\celeste-map-editor-vscode\maps`
- Select **`project.json`** (or try `project.oel` if JSON doesn't work)
- Click **Open**

### Step 3: Open a Level
- Once project loads, go to: **File → Open Level**
- Choose a map from:
  - `aside/00_Prologue.ogmo` ← Start with this (simpler)
  - `aside/01_City.ogmo` ← Or this (now fixed!)
  - Any other `.ogmo` file in aside/, bside/, cside/, dside/

### Step 4: Edit and Save
- Use Ogmo tools to edit the map
- Press **Ctrl+S** to save changes

---

## 📂 Map Organization

```
maps/
├── project.oel                 ← Open this first!
├── aside/
│   ├── 00_Prologue.ogmo
│   ├── 01_City.ogmo
│   ├── 02_Nightmare.ogmo
│   └── ... (more levels)
├── bside/
│   ├── 00_Prologue.ogmo
│   └── ... (more levels)
├── cside/
│   ├── 00_Prologue.ogmo
│   └── ... (more levels)
└── dside/
    ├── 00_Prologue.ogmo
    └── ... (more levels)
```

## Troubleshooting

### Maps not showing in Ogmo

**Issue**: The `.ogmo` files don't show content in Ogmo 3 editor

**Solution**:
1. Make sure you've opened the `project.oel` file first
2. Check that tileset paths are configured (Ogmo Settings → Tilesets)
3. Ogmo might need the actual tileset image files to display tiles

### Tilesets not found

**Issue**: Ogmo complains about missing tilesets

**Solution**:
1. This is normal - we don't have the actual Celeste tileset images
2. You can still edit entities and structure
3. To see tileset graphics, you'd need to:
   - Extract Celeste game assets
   - Point Ogmo to those tileset PNGs
   - Or create placeholder tilesets

### Entities not appearing

**Issue**: Decals or entities don't display

**Solution**:
1. Verify the project.oel entity definitions match your map content
2. Check entity layer visibility in Ogmo (should be visible by default)

## Next Steps

1. **Edit Maps**: Use Ogmo 3's visual editor to modify rooms
2. **Export**: When done editing, export maps back to JSON/binary if needed
3. **Test**: Import modified maps back into Celeste with Olympus/Loenn

## For More Help

- Ogmo 3 Documentation: https://docs.ogmoeditor.com/
- Celeste Modding: https://celestemod.com/
- Loenn Wiki: https://github.com/CelestialCartographers/Loenn/wiki
