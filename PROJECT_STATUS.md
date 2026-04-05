# Celeste MonoGame & Ogmo 3 Integration - Project Status

## ✅ Completed Work

### 1. **MonoGame Room Selection Fixed**
- **Files Modified:**
  - `csharp-monogame-preview/PreviewGame.cs` - Enhanced with room selection UI
  - `csharp-native-editor/NativeEditorGame.cs` - Separated selection from dragging

- **What's Fixed:**
  - Room selection now responds to left-clicks (was broken due to coordinate math)
  - Corrected screen-to-world transformation: `(screenX - cameraX) / zoom`
  - Room dragging now requires pointer movement threshold (4 pixels) before activating
  - Both projects compile successfully with no errors

- **How It Works:**
  - Left-click = Select room (shows green grid)
  - Click + drag = Moves selected room (after moving 4+ pixels)
  - Fixes UX where clicking would immediately drag rooms accidentally

### 2. **Map Format Conversion Tools Ready**
- **Scripts:**
  - `scripts/ogmo-to-celeste.ts` - Convert Ogmo 3 .oel XML → Celeste .json
  - `scripts/celeste-to-ogmo.ts` - Convert Celeste .json → Ogmo 3 .oel XML

- **npm Commands:**
  ```powershell
  npm run convert:ogmo-to-celeste -- --input map.oel --output map.json
  npm run convert:celeste-to-ogmo -- --input map.json --output map.oel
  ```

- **Features:**
  - Bidirectional conversion between formats
  - Maps rooms, tilesets (FG/BG), entities, triggers, and decals
  - Command-line usage from project root
  - Both scripts verified working

### 3. **MonoGame Pipeline Tool Verified**
- **Tool:** MGCB (MonoGame Content Builder) v3.8.4.1
- **Location:** Installed globally on system
- **Status:** ✅ Ready to use
- **Usage:**
  ```bash
  mgcb-editor          # GUI for sprite asset management
  mgcb <file.mgcb>     # CLI for building content
  ```

### 4. **Comprehensive Documentation Created**
- `docs/OGMO_SETUP.md` - Complete integration guide
- `docs/OGMO_QUICKSTART.md` - 10-step workflow tutorial
- `docs/OGMO3_BUILD_STATUS.md` - Build troubleshooting guide
- `docs/OGMO_MONOGAME_SETUP.md` - Deep integration reference
- `tools/README.md` - Tool directory guide

### 5. **Launcher Scripts Created**
- `tools/launch-ogmo.ps1` - PowerShell launcher (with error handling)
- `tools/launch-ogmo.bat` - Batch launcher (with instructions)
- Updated to detect and guide users through setup

---

## ⏳ Pending: Ogmo 3 Editor Executable

### The Issue
Ogmo 3 CE 3.4.0 at `E:\Celeste\Ogmo Editor` is **source code only** (Haxe project).

Automatic npm install fails with:
```
npm error Error: Cannot find module 'sshpk'
npm error code 1 (node-sass build script failure)
```

**Root Causes:**
- `node-sass@4.14.1` - Deprecated, incompatible with Node.js v24.13.1
- Missing Haxe compiler for source build
- Broken transitive dependencies from old npm packages

### The Solution: Download Binary Release

**Follow these steps:**

1. **Visit GitHub Releases:**
   ```
   https://github.com/Ogmo-Editor/OgmoEditor3/releases
   ```

2. **Download Windows Binary**
   - Look for version 3.4.0 or newer
   - Download the `.zip` file named something like `OgmoEditor3-3.4.0-win.zip`

3. **Extract to Installation Directory**
   ```
   E:\Celeste\Ogmo Editor
   ```

4. **Verify Installation**
   ```powershell
   # From project root
   .\tools\launch-ogmo.ps1
   ```

### Alternative: Use Conversion Scripts Now

If you can't get the Ogmo 3 editor running yet, the conversion scripts still work:

```powershell
# Create maps in another tool (or manually edit JSON)
# Then convert to Celeste format
npm run convert:ogmo-to-celeste -- --input mymap.oel --output mymap.json

# Test in MonoGame preview
# Edit as needed
# Convert back
npm run convert:celeste-to-ogmo -- --input mymap.json --output mymap.oel
```

---

## 🚀 Quick Start

### 1. Test Room Selection (Right Now)
```powershell
# Build MonoGame projects
dotnet build csharp-monogame-preview/CelesteMapMonoGamePreview.csproj
dotnet build csharp-native-editor/CelesteMapNativeEditor.csproj

# Run either editor/preview and try clicking rooms
```

### 2. Test Map Conversion (Right Now)
```powershell
# Try the conversion script (no Ogmo 3 app needed yet)
npm run convert:ogmo-to-celeste -- --help
```

### 3. Get Ogmo 3 Running (When Ready)
1. Download Windows release from GitHub (see "The Solution" above)
2. Extract to `E:\Celeste\Ogmo Editor`
3. Run `.\tools\launch-ogmo.ps1`
4. Create maps in Ogmo 3, convert to Celeste format

---

## 📁 Project Structure

```
celeste-map-editor-vscode/
├── src/                              # VS Code extension source
├── csharp-monogame-preview/          # Preview viewer (ENHANCED)
│   └── PreviewGame.cs                # Fixed coordinate math
├── csharp-native-editor/             # Full editor (ENHANCED)
│   └── NativeEditorGame.cs           # Added room selection + drag threshold
├── csharp-monogame-shared/           # Shared interop layer
├── scripts/
│   ├── ogmo-to-celeste.ts            # ✅ Ogmo XML → Celeste JSON
│   └── celeste-to-ogmo.ts            # ✅ Celeste JSON → Ogmo XML
├── tools/
│   ├── launch-ogmo.ps1               # ✅ PowerShell launcher
│   ├── launch-ogmo.bat               # ✅ Batch launcher
│   └── README.md                     # ✅ Tools guide
├── docs/
│   ├── OGMO_SETUP.md                 # ✅ Integration guide
│   ├── OGMO_QUICKSTART.md            # ✅ 10-step tutorial
│   ├── OGMO3_BUILD_STATUS.md         # ✅ Build troubleshooting (NEW)
│   └── OGMO_MONOGAME_SETUP.md        # ✅ Deep integration reference
├── package.json                      # ✅ npm scripts updated
└── README.md
```

---

## 📊 Feature Summary

| Feature | Status | Notes |
|---------|--------|-------|
| MonoGame room selection | ✅ Ready | Fixed coordinate math, click to select |
| Room drag threshold | ✅ Ready | 4-pixel movement before drag activates |
| MGCB sprite tools | ✅ Ready | v3.8.4.1 installed, use `mgcb-editor` |
| Ogmo→Celeste conversion | ✅ Ready | `npm run convert:ogmo-to-celeste --` |
| Celeste→Ogmo conversion | ✅ Ready | `npm run convert:celeste-to-ogmo --` |
| Ogmo 3 editor app | ⏳ Need binary | Download from GitHub releases |
| Launchers (PS1/Batch) | ✅ Ready | `tools/launch-ogmo.ps1` or `.bat` |
| Documentation | ✅ Complete | 4+ comprehensive guides |

---

## 🎯 What You Can Do Now

1. **✅ Use improved MonoGame editors** - Room selection works correctly
2. **✅ Convert between map formats** - Ogmo 3 ↔ Celeste JSON
3. **✅ Manage sprites** - MGCB content pipeline ready
4. **⏳ Edit in Ogmo 3** - Once you download the Windows binary release

---

## 📝 Next Steps

### Immediate (5 minutes)
1. Download Ogmo 3 Windows release from GitHub
2. Extract to `E:\Celeste\Ogmo Editor`
3. Run `tools\launch-ogmo.ps1`

### Short Term (Testing)
1. Create a test map in Ogmo 3
2. Export as `.oel` file
3. Convert to Celeste format: `npm run convert:ogmo-to-celeste --input test.oel --output test.json`
4. Open in MonoGame preview

### Long Term (Workflow)
- Edit maps in Ogmo 3 (visual editor)
- Convert to Celeste format for MonoGame
- Use MonoGame preview for real-time testing
- Iterate as needed

---

## 🔗 See Also

- [Ogmo 3 Build & Troubleshooting](./docs/OGMO3_BUILD_STATUS.md) - Detailed build info
- [Ogmo Setup Guide](./docs/OGMO_SETUP.md) - Complete integration
- [Quick Start Tutorial](./docs/OGMO_QUICKSTART.md) - 10-step workflow
- [GitHub: Ogmo 3 Community Edition](https://github.com/Ogmo-Editor/OgmoEditor3)
- [MonoGame Documentation](https://docs.monogame.net)

---

## ✨ Summary

**You now have:**
- ✅ Improved MonoGame editors with proper room selection
- ✅ Bidirectional map format converter scripts
- ✅ MonoGame sprite pipeline tool ready
- ✅ Comprehensive documentation and guides
- ✅ Ready-to-use launcher scripts

**To complete the setup:**
- Download Ogmo 3 Windows binary release (~5 min)
- Extract to the provided directory
- Start using the integrated workflow

The conversion scripts are ready to use immediately - no Ogmo 3 app needed to start converting maps between formats!
