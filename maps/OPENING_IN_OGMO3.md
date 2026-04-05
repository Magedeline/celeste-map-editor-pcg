# Opening Maps in Ogmo 3 - Two Methods

## ⚠️ Issue: Ogmo 3 Hangs or Won't Load

If Ogmo 3 hangs or fails to open `.ogmo` files, try these solutions:

---

## Method 1: Open Individual Map Files (Recommended) ✅

**This is the simplest approach and works best in Ogmo 3:**

1. **Launch Ogmo 3 Editor**
   - Run: `E:\Celeste\Ogmo Editor\Ogmo.exe`

2. **Open a Map File**
   - In Ogmo 3: **File → Open**
   - Navigate to: `E:\Celeste\celeste-map-editor-vscode\maps\aside`
   - Select a `.ogmo` file, for example:
     - `13_Fire.ogmo` ← Start with this (smallest, simplest)
     - `00_Prologue.ogmo` ← Second try
     - `01_City.ogmo` ← Or this one

3. **Wait for Ogmo to Load**
   - First load may take a few seconds
   - Ogmo should display the level with tiles and entities

4. **Edit the Map**
   - Use Ogmo 3's tools to create/modify the map
   - Save with **Ctrl+S**

---

## Method 2: Using Project File

**If Method 1 works, then try this:**

1. **Open Ogmo 3**
2. **File → Open Project**
3. Select: `E:\Celeste\celeste-map-editor-vscode\maps\project.json`
4. Once loaded, **File → Open Level**
5. Pick any `.ogmo` file

---

## Troubleshooting If Methods 1 & 2 Fail

### **If Ogmo hangs or crashes:**

1. **Check Ogmo 3 is installed correctly**
   - Should be at: `E:\Celeste\Ogmo Editor`
   - Verify Ogmo.exe exists
   - Try running Ogmo directly, without opening a file

2. **Try opening a super simple map first**
   - Smallest file: `aside/13_Fire.ogmo` (300 bytes)
   - Command: `E:\Celeste\Ogmo Editor\Ogmo.exe "E:\Celeste\celeste-map-editor-vscode\maps\aside\13_Fire.ogmo"`

3. **Check file format**
   - Open a `.ogmo` file in Notepad
   - Should start with: `<?xml version="1.0"?>`
   - Should have: `<level ...>` tags

4. **Verify Ogmo 3 Version**
   - Different versions of Ogmo have different format requirements
   - Check if you have "Ogmo 3" or an older version
   - Older versions might have different XML structure

### **If project loading fails:**

1. **Try with project.oel instead**
   - Ogmo sometimes prefers XML project format
   - File → Open Project → select `project.oel`

2. **Verify project file exists**
   - `E:\Celeste\celeste-map-editor-vscode\maps\project.json` (OK)
   - `E:\Celeste\celeste-map-editor-vscode\maps\project.oel` (OK)

---

## What Changed

The `.ogmo` files have been regenerated with correct XML structure:

| Before | After |
|--------|-------|
| `<project>` wrapper | ✅ Correct `<level>` or `<map>` root |
| Outdated XML structure | ✅ Ogmo 3 compatible format |
| Project-based (problematic) | ✅ Can open files directly |

---

## Still Having Issues?

If none of these work, the issue might be:

1. **Ogmo 3 version incompatibility**
   - You might have a different Ogmo editor version
   - Try finding/installing official Ogmo 3 Editor

2. **Tileset path issue**
   - Ogmo can't find image files for tilesets
   - This would hang the program

3. **Different Ogmo format expected**
   - The maps might need a different XML structure
   - Would need sample `.ogmo` file from working Ogmo 3 project

---

## Quick Test

Try this command to open the simplest map:

```bash
"E:\Celeste\Ogmo Editor\Ogmo.exe" "E:\Celeste\celeste-map-editor-vscode\maps\aside\13_Fire.ogmo"
```

This should:
- Open Ogmo 3
- Load the smallest map file
- Show a simple 32x32 level with tiles and one player entity

If this works, you can open any other `.ogmo` file the same way!
