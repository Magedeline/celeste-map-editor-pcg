# Ogmo to Celeste Mod Converter

Converts `.ogmo` XML map files to Celeste mod JSON format that can be used in your Celeste mods.

## Installation

Make sure you have `xml2js` installed:

```bash
npm install
```

## Usage

### Option 1: Convert all maps (recommended)

```bash
npm run export:ogmo-to-json
```

This converts all 69 maps from the `maps/` directory and exports them to `celeste-mod-export/` with preserved folder structure.

### Option 2: Using Node directly

```bash
# Convert entire maps directory
node ogmo-to-celeste.js maps ./celeste-mod-export

# Convert single map file
node ogmo-to-celeste.js maps/aside/a_00_Prologue.ogmo ./output

# Convert single side directory
node ogmo-to-celeste.js maps/aside ./celeste-mod-export
```

### Option 3: Using ts-node (TypeScript)

```bash
npm run convert:ogmo-to-celeste
```

## Output Format

Each `.ogmo` file is converted to `.json` with the following structure:

```json
{
  "package": "a_00_Prologue",
  "levels": [
    {
      "id": "-1",
      "name": "Room",
      "width": 320,
      "height": 180,
      "xoffset": -368,
      "yoffset": 0,
      "solids": "000000...\n111111...",
      "bg": "000000...\n111111...",
      "entities": [
        {
          "name": "player",
          "x": 312,
          "y": 136
        },
        {
          "name": "introCar",
          "x": 208,
          "y": 152
        }
      ],
      "decals": [
        {
          "x": 292,
          "y": 132,
          "texture": "generic/grass_b.png"
        }
      ]
    }
  ]
}
```

## Output Directory Structure

```
celeste-mod-export/
├── aside/
│   ├── a_00_Prologue.json
│   ├── a_01_City.json
│   └── ...
├── bside/
│   ├── b_01_City.json
│   └── ...
├── cside/
│   └── ...
└── dside/
    └── ...
```

## What Gets Converted

- **Tile Data**: Solids and background tiles from the `.ogmo` format
- **Entities**: All entities (player, enemies, items, hazards, etc.) with positions
- **Decals**: Decorative elements with textures
- **Level Properties**: Width, height, offsets for each level

## Using Converted Maps in Your Mod

1. Run the converter to generate JSON files
2. Copy the JSON files to your Celeste mod directory
3. In your mod code, load and parse the JSON maps

Example (C# for Celeste):
```csharp
var mapJson = File.ReadAllText("path/to/a_00_Prologue.json");
var mapData = JsonConvert.DeserializeObject<MapData>(mapJson);
```

Or in JavaScript/TypeScript:
```javascript
const map = require('./maps/based/a_00_Prologue.json');
console.log(map.levels[0].entities); // Access entities
```

## Troubleshooting

If you get an error about missing `xml2js`:
```bash
npm install xml2js
```

If conversion fails on a specific file:
- Check that the `.ogmo` file is valid XML
- Verify it has a `<level>` or `<map>` root element
- Check the console output for specific error details

## Advanced Usage

### Convert to custom output path

```bash
node ogmo-to-celeste.js maps/aside ./my-custom-output
```

### Convert single file to custom location

```bash
node ogmo-to-celeste.js maps/aside/a_13_Fire.ogmo ./temp/fire-map.json
```

## File Information

- **Script**: `ogmo-to-celeste.js`
- **npm command**: `npm run export:ogmo-to-json`
- **Supported input**: `.ogmo` XML files
- **Output format**: `.json` (Celeste mod compatible)
- **Supported map sides**: a-side, b-side, c-side, d-side

