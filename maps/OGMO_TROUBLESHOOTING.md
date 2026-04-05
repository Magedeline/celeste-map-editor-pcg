# Ogmo 3 Map Editor - Troubleshooting Guide

## Problem: Ogmo 3 Won't Open Maps

### Quick Checklist

- [ ] Have you opened **project.json** first (not project.oel)?
- [ ] Is Ogmo 3 actually installed at `E:\Celeste\Ogmo Editor`?
- [ ] Are you using Ogmo 3 (not Ogmo 2)?
- [ ] Check the Ogmo 3 console for error messages

---

## Solution 1: Open Project File First

**The most common issue!** Ogmo needs to load the project configuration before opening maps.

### Step 1: Start Fresh
1. Open Ogmo 3 Editor: `E:\Celeste\Ogmo Editor`
2. Look for: **File → Open Project** (or **File → New Project**)
3. Navigate to: `E:\Celeste\celeste-map-editor-vscode\maps\`

### Step 2: Choose the Project File
Select **ONE** of these files to open:
- **project.json** (recommended - newer format)
- **project.oel** (older XML format)

### Step 3: Let it Load
Wait for Ogmo to fully load the project configuration. You should see:
- Tileset list on the left
- Layer list
- Entity definitions

---

## Solution 2: Open Individual Maps

Once the project is loaded:

1. **File → Open Level** (or Open Map)
2. Navigate to map folder:
   ```
   E:\Celeste\celeste-map-editor-vscode\maps\aside\
   ```
3. Select a `.ogmo` file, e.g., `00_Prologue.ogmo`
4. Click Open

The map should load showing:
- Tile grid (even if tileset images are missing)
- Entities as colored boxes
- Decals

---

## Solution 3: Common Errors & Fixes

### Error: "Project not found"
- Make sure project.json or project.oel exists in the maps folder
- Check file spelling is exact

### Error: "Cannot parse level"
- The `.ogmo` XML format might be different than Ogmo expects
- Try opening the TEST_LEVEL.ogmo file first to verify Ogmo works

### Error: "Tileset not found"
- This is **NORMAL** - we don't have Celeste's actual tileset images
- Ogmo will still work, just won't show tile graphics
- You can still edit entities and room structure

### Maps appear empty
- Check the Layers panel - make sure Entities and Solids layers are visible
- Click the eye icon to show/hide layers

---

## Solution 4: Manual Map Setup

If Ogmo won't recognize the automatic project:

### Create a New Project from Scratch
1. **File → New Project**
2. Fill in settings:
   - **Name**: Celeste Maps
   - **Default Width**: 320
   - **Default Height**: 180
3. **Add Tilesets**:
   - Tileset ID: `solids` (8x8 tiles)
   - Tileset ID: `bg` (8x8 tiles)
4. **Add Layers**:
   - Layer: `solids` (Tile layer)
   - Layer: `bg` (Tile layer)
   - Layer: `entities` (Entity layer)
   - Layer: `decals` (Decal layer)
5. **Add Entities** (copy from project.json)

### Then Open Maps
Once the project is configured, open individual `.ogmo` files from the folders.

---

## Solution 5: Try Test Level First

Before opening complex maps, try:

1. **File → Open Level**
2. Select: `E:\Celeste\celeste-map-editor-vscode\maps\TEST_LEVEL.ogmo`
3. This is a minimal test file

If TEST_LEVEL opens and shows content, Ogmo is working correctly. Then try opening other maps.

---

## Solution 6: Check Ogmo 3 Version

The format might differ between Ogmo versions. Verify which version you have:

1. **Help → About** (in Ogmo)
2. Look for version number

This guide was made for **Ogmo 3**. If you have Ogmo 2, the project format is different.

---

## Advanced: Convert Maps to Correct Format

If Ogmo still won't open the `.ogmo` files, the XML structure might need adjustment.

### Option A: Manual Fix
Edit a problematic `.ogmo` file and check:
- XML structure is valid
- All attributes are quoted
- No encoding issues

### Option B: Re-generate with Correct Format
Run the conversion script again (we can adjust the XML output format):

```powershell
npm run convert:bin-to-ogmo -- --input "E:\Celeste\celeste-map-editor-vscode\maps"
```

---

## Format References

### Project File (project.json)
- Defines tilesets
- Defines layers
- Defines entity types
- Lists level files

### Level File (*.ogmo)
- Contains room data
- Contains tile data for each layer
- Contains entities with positions
- Contains decals

---

## If Nothing Works

1. **Verify Ogmo 3 is installed**:
   - Open: `E:\Celeste\Ogmo Editor`
   - Check if the application starts

2. **Try opening system file browser in Ogmo**:
   - **File → Open** and browse to maps folder manually

3. **Check Ogmo console for errors**:
   - Look for error messages that might explain the issue

4. **Contact support**:
   - Ogmo 3 GitHub: https://github.com/dododoyo/Ogmo-3-IDE
   - Celeste Modding: https://celestemod.com/

---

## Next Steps if Successful

Once Ogmo is displaying maps:

1. **Edit Rooms**: Modify room layout in visual editor
2. **Add/Move Entities**: Place game objects
3. **Edit Tiles**: Modify collision and background
4. **Save**: Ogmo should auto-save `.ogmo` files
5. **Export**: Use Ogmo's export feature to save other formats if needed

---

## File Locations Reference

```
E:\Celeste\celeste-map-editor-vscode\maps\
├── project.json               ← Open this in Ogmo
├── project.oel               ← Alternative project file
├── README_MAPS.md           ← This file
├── TEST_LEVEL.ogmo          ← Test if Ogmo works
├── aside/                    ← A-Side maps
│   ├── 00_Prologue.ogmo
│   ├── 01_City.ogmo
│   └── ...
├── bside/                    ← B-Side maps
├── cside/                    ← C-Side maps
└── dside/                    ← D-Side maps
```

Good luck! 🎮
