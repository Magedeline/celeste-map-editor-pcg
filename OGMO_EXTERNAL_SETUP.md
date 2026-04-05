# OGMO 3 External Script Setup Guide

## ⚠️ If OGMO Freezes or Doesn't Respond

If OGMO 3 becomes unresponsive when opening maps, this is likely because:
1. **External scripts are not properly configured** (they never run, but something else hangs UI)
2. **Paths are incorrect** (script hangs waiting for network path or missing file)
3. **Node.js is not in PATH** (script times out trying to execute)

### Quick Fix: Verify Node.js in PATH

Open PowerShell and run:
```powershell
node --version
```

If this fails, Node.js is not in your PATH. Add it:
1. Find Node.js installation: `C:\Program Files\nodejs` (usually)
2. Add to Windows PATH:
   - Win + X → System → Advanced system settings → Environment Variables
   - Edit `PATH`, add: `C:\Program Files\nodejs`
   - Restart OGMO 3

---

## 📋 Proper OGMO 3 Configuration

### Step 1: Close OGMO 3
If OGMO is frozen, use Task Manager to close it completely.

### Step 2: Configure External Tools in OGMO 3

1. **Open OGMO 3**
2. **Open your project** (maps/project.ogmo)
3. **Go to: Edit → Project Properties**
4. **Find: External Tools** (or look in left sidebar for "External Scripts")
5. **Click: Add New Tool**

### Step 3: Add "Export to Celeste" Tool

Configure as follows:

| Field | Value |
|-------|-------|
| **Name** | `Export to Celeste` |
| **Path** | `E:\Celeste\celeste-map-editor-vscode\tools\ogmo-export.bat` |
| **Arguments** | `{project_dir} {current_file}` |
| **Run Minimized** | ☑️ (recommended) |

**Click: Save/Apply**

### Step 4: Add "Import from Celeste" Tool

| Field | Value |
|-------|-------|
| **Name** | `Import from Celeste` |
| **Path** | `E:\Celeste\celeste-map-editor-vscode\tools\celeste-export.bat` |
| **Arguments** | `{project_dir} {current_file}` |
| **Run Minimized** | ☑️ (recommended) |

**Click: Save/Apply**

### Step 5: Test the Tools

1. **Open any map** in OGMO 3
2. **Right-click on the map** in the left panel or press the menu button
3. **Look for:**
   - "Export to Celeste"
   - "Import from Celeste"

4. **Click one to test**
5. **A command window should appear and run**
6. **Logs will be created:**
   - `E:\Celeste\celeste-map-editor-vscode\ogmo-export.log`
   - `E:\Celeste\celeste-map-editor-vscode\celeste-export.log`

---

## 🧪 Testing Scripts Manually

### Test 1: Run Diagnostic
```powershell
cd "E:\Celeste\celeste-map-editor-vscode\tools"
.\diagnose.bat
```

This checks:
- ✅ Node.js installation
- ✅ Dependencies (xml2js)
- ✅ Script files exist
- ✅ Scripts respond to help command

### Test 2: Test Conversion Directly
```powershell
cd "E:\Celeste\celeste-map-editor-vscode"
node ogmo-to-celeste.js maps/aside/a_00_Prologue.ogmo ./test-output
```

If this works:
- Files will be created in `./test-output`
- The batch scripts should work
- If this fails, check the error message

### Test 3: Test Batch Script Directly
```powershell
cd "E:\Celeste\celeste-map-editor-vscode\tools"
.\ogmo-export.bat "E:\Celeste\celeste-map-editor-vscode\maps" "E:\Celeste\celeste-map-editor-vscode\maps\aside\a_00_Prologue.ogmo"
```

---

## 🔧 Troubleshooting

### Issue: "Cannot find node"
**Solution:**
```powershell
# Find where Node.js is installed
Get-Command node | Select-Object Source

# Add to PATH if needed
$env:PATH += ";C:\Program Files\nodejs"
node --version
```

### Issue: "xml2js not found"
**Solution:**
```powershell
cd "E:\Celeste\celeste-map-editor-vscode"
npm install xml2js
```

### Issue: "Cannot find file" in script
**Solution:**
- Check that batch file uses **absolute paths** for Node.js scripts
- Verify working directory is set correctly
- See log files: `ogmo-export.log`, `celeste-export.log`

### Issue: OGMO Still Freezes
**Solution:**
1. Close OGMO
2. Delete OGMO's settings/cache:
   - `%APPDATA%\OgmoEditor3`
   - Restart OGMO
3. Try reconfiguring external tools with **Run Minimized** checked
4. Use absolute paths only (no relative paths like `{project_dir}`)

### Issue: Output Directory Doesn't Match Expectations
The scripts output to:
- **OGMO Export:** `celeste-export/` folder in workspace root
- **Celeste Import:** `ogmo-export/` folder in workspace root

Create these directories if they don't exist:
```powershell
mkdir "E:\Celeste\celeste-map-editor-vscode\celeste-export"
mkdir "E:\Celeste\celeste-map-editor-vscode\ogmo-export"
```

---

## 📝 Script Locations (Update These Paths in OGMO)

| Tool | Full Path |
|------|-----------|
| OGMO Export | `E:\Celeste\celeste-map-editor-vscode\tools\ogmo-export.bat` |
| Celeste Export | `E:\Celeste\celeste-map-editor-vscode\tools\celeste-export.bat` |
| Bulk Convert | `E:\Celeste\celeste-map-editor-vscode\tools\bulk-convert.bat` |

---

## 🐛 Debug Logs

After running a script, check these log files for error details:

```powershell
# Show recent errors
Get-Content "E:\Celeste\celeste-map-editor-vscode\ogmo-export.log" -Tail 20

# Or watch in real-time
Get-Content "E:\Celeste\celeste-map-editor-vscode\ogmo-export.log" -Wait -Tail 5
```

---

## ✅ Verification Checklist

- [ ] Node.js installed (`node --version` works in PowerShell)
- [ ] Node.js in PATH (can run `node` from any folder)
- [ ] xml2js installed (`npm list xml2js`)
- [ ] OGMO external tools configured in Project Properties
- [ ] Batch file paths are absolute (not relative)
- [ ] `{project_dir}` and `{current_file}` tokens used in arguments
- [ ] "Run Minimized" is checked
- [ ] Output directories exist or will be auto-created
- [ ] Manual test works: `node ogmo-to-celeste.js input.ogmo output/`
- [ ] Batch script test works: `.\ogmo-export.bat`

Once all checks pass, OGMO should properly call your conversion scripts!

---

## 🔗 Additional Resources

- [Node.js Download](https://nodejs.org)
- [OGMO 3 Documentation](https://ogmo-editor-3.github.io/)
- [Batch File Variables Reference](https://en.wikibooks.org/wiki/Batch_Files/Variables)
