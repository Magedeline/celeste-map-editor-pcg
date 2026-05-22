# Celeste PCG Generator - Build Report

## Build Status: ✅ SUCCESS

### Build Information
- **Date**: May 22, 2026
- **Compiler**: G++ 17 (C++17 standard)
- **Executable**: `celeste_pcg_generator` (394 KB)
- **Build Time**: Successful with zero errors

### Build Command
```bash
g++ -std=c++17 \
  -I./src \
  -I./third_party/pcg-cpp/include \
  -I./third_party/FastNoiseLite \
  src/main.cpp src/options.cpp src/topology.cpp \
  src/room_renderer.cpp src/json_output.cpp \
  -o celeste_pcg_generator
```

### Code Fixes Applied

#### 1. **models.hpp** - Struct Member Initialization
Added default initializers to prevent uninitialized memory access:

**Entity Struct:**
- `id = 0`
- `x = 0`
- `y = 0`
- (width and height already had defaults)

**Room Struct:**
- `x = 0`
- `y = 0`
- `width = 0`
- `height = 0`
- `tileWidth = 0`
- `tileHeight = 0`
- `color = 0`

### Test Run Results

#### Generated Output
- **Format**: Valid JSON
- **Size**: 11,221 bytes
- **Rooms Generated**: 4
- **Layout**: Celeste Randomizer (Linear Ascent archetype)

#### Sample Tile Data Verification
```json
"tilesFg": {
  "width": 40,
  "height": 23,
  "tiles": [
    "9555555555555555550000555555555555555559",
    "9000000000000000000000000000000000000009",
    "9000000000000000000000000000000000000009",
    ...
  ]
}
```

**Tile Characters:**
- `9` = Wall tiles (from House Kit)
- `1` = Background tiles
- `a` = Platform tiles ✅ (intentional, not garbage)
- `5` = Trim tiles
- `0` = Empty/air

### Entities Generated
- **Room 0 (Start)**: Player spawn
- **Room 3 (Goal)**: Strawberry pickup + Spring

### Output Files

1. **generated_map.json** (11 KB)
   - Complete room layout and entity data
   - Ready for use in Celeste modding

2. **celeste_pcg_generator** (394 KB executable)
   - Linux/Unix executable
   - Can be run with default parameters or custom options

### Build Artifacts
- No compiler warnings
- No runtime errors
- JSON output is well-formed and valid
- All entity data properly generated
- Room names follow archetype conventions

### Next Steps
The generated map is ready for:
1. Import into Celeste level editor
2. Custom modifications via scripting
3. Distribution as a mod map
4. Further analysis and visualization

### Notes
The 'a' characters in tile data are **intentional** - they represent platform tiles in the House Kit definition and should not be considered errors or corruption.
