# OGMO External Scripts

These scripts integrate Celeste map conversions with OGMO 3 Editor as external tools.

## Available Scripts

### `ogmo-export.bat`
Converts OGMO map files to Celeste JSON format.

**Usage in OGMO:**
1. Go to **Project Settings** → **External Tools**
2. Click **Add**
3. Configure:
   - **Name:** "Export to Celeste"
   - **Path:** `path\to\ogmo-export.bat`
   - **Arguments:** `{project_dir} {current_file}`
   - **Run minimized:** (optional)

### `celeste-export.bat`
Converts Celeste JSON maps to OGMO format.

**Usage in OGMO:**
1. Same as above
2. Configure:
   - **Name:** "Import from Celeste"
   - **Path:** `path\to\celeste-export.bat`

### `bulk-convert.bat`
Batch converts entire directories of maps.

**Usage:**
```bash
bulk-convert sides        # Convert aside, bside, cside, dside
bulk-convert maps         # Recursively convert all maps
bulk-convert auto         # Auto-detect and convert
```

**Examples:**
```bash
cd tools
bulk-convert sides                    # Convert all sides in ./maps
bulk-convert maps C:\path\to\maps     # Convert custom directory
```

## Standalone Node.js Scripts

If you prefer command-line usage:

### `ogmo-to-celeste.js`
```bash
node ogmo-to-celeste.js input.ogmo output.json
node ogmo-to-celeste.js ./maps ./celeste-export
```

### `celeste-to-ogmo.js`
```bash
node celeste-to-ogmo.js input.json output.oel
node celeste-to-ogmo.js ./celeste-mod ./ogmo-export
```

## Requirements

- **Node.js** 14+ installed
- **npm dependencies:** `xml2js` (install with `npm install`)

## Configuration

### OGMO Project Integration

Edit your OGMO `project.ogmo` file:

```xml
<externalScripts>
  <script label="Export to Celeste" path="tools/ogmo-export.bat" />
  <script label="Import from Celeste" path="tools/celeste-export.bat" />
</externalScripts>
```

### npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "export:ogmo": "node ogmo-to-celeste.js",
    "export:celeste": "node celeste-to-ogmo.js"
  }
}
```

Then run:
```bash
npm run export:ogmo maps/aside ./output
npm run export:celeste ./celeste-mod ./output
```

## Troubleshooting

**Error: "Cannot find module 'xml2js'"**
```bash
npm install xml2js
```

**Script won't run from OGMO**
- Check that Node.js is in your PATH: `node --version`
- Use absolute paths in OGMO external tool configuration
- Ensure .bat files have correct line endings (LF or CRLF)

**Files not converting**
- Check input file format (must be .ogmo, .oel, or .json)
- Verify file permissions and disk space
- Check console output for specific errors

## Output Formats

### Celeste JSON Structure
```json
{
  "levels": [
    {
      "id": "room_id",
      "name": "Room Name",
      "width": 320,
      "height": 180,
      "solids": "tile_data...",
      "bg": "tile_data...",
      "entities": [...],
      "decals": [...]
    }
  ]
}
```

### OGMO XML Structure
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ogmo version="3.4.0">
  <map>
    <level id="room_id" width="320" height="180">
      <tiles tileset="solids">tile_data...</tiles>
      <entity name="player" x="160" y="90" />
    </level>
  </map>
</ogmo>
```

## Batch Operations

### Convert all aside maps:
```bash
node ogmo-to-celeste.js ./maps/aside ./celeste-export/aside
```

### Convert all sides:
```bash
bulk-convert sides ./maps
```

### Monitor and convert on changes:
```bash
npm run watch
npm run convert:ogmo-to-celeste -- --watch ./maps
```

## Integration with VS Code

In VS Code settings, configure the Celeste Map Editor extension:

```json
{
  "celesteMapEditor.ogmoExportPath": "./tools",
  "celesteMapEditor.autoConvertOnSave": true
}
```

Then use VS Code's built-in tasks to run conversions.
