# Celeste PCG Generator Tool

A native C++ procedural content generator for creating random Celeste maps with varied room layouts, platforms, and entities.

## Features

✨ **Procedurally Generated Levels**
- Random room generation with multiple archetype styles
- Configurable difficulty progression
- Multiple house kits (themes)
- Proper entity placement (players, springs, strawberries, etc.)

🎮 **Multiple Archetypes**
- Linear Ascent (vertical progression)
- Long Run with Density Burst
- Spine with Compact Branching
- Landmark Corridor
- Celeste Category
- Segmented Summit

🏠 **House Kits**
- House Kit (default)
- Resort Kit
- Cliffside Kit
- Kirby Kit
- Mario Kit
- Metroidvania Kit
- Labybirth Kit
- Pizza Tower Kit
- Arcade Kit

## Requirements

- Windows, Linux, or Mac
- No external dependencies (self-contained executable)

## Installation

1. Extract the `celeste_pcg_generator.exe` to your desired location
2. Optionally, add to your PATH for system-wide access

## Usage

### Basic Command

```bash
celeste_pcg_generator
```

Generates a random map using default parameters and outputs JSON to stdout.

### Output

The generator outputs a complete Celeste map in JSON format containing:
- **4 rooms** with full tile data
- **Entity placement** (player start, collectibles, hazards)
- **Background and foreground layers**
- **Room connections** and topology
- **Metadata** for level progression

### Example Output

```json
{
  "summary": "Generated 4 House Kit rooms in Celeste Randomizer mode...",
  "rooms": [
    {
      "name": "linearAscent_start_00",
      "x": 0,
      "y": 0,
      "width": 320,
      "height": 184,
      "tilesFg": { ... },
      "tilesBg": { ... },
      "entities": [ ... ]
    },
    ...
  ]
}
```

### Saving Output

```bash
celeste_pcg_generator > my_level.json
```

## Tile Characters

- `9` = Wall tiles
- `1` = Background tiles
- `a` = Platform tiles
- `5` = Trim/detail tiles
- `0` = Empty/air

## Next Steps

1. **Export the JSON** from the generator
2. **Import into Celeste Editor** using your map editor of choice
3. **Customize** the generated level as desired
4. **Package** as a Celeste mod

## Building from Source

### Requirements
- G++ or Clang (C++17 support)
- PCG-CPP library (included)
- FastNoiseLite (included)

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

### Source Code Files

- **main.cpp** - Entry point and main generation logic
- **room_renderer.cpp** - Room tile rendering and entity placement
- **topology.cpp** - Room connection and layout generation
- **json_output.cpp** - JSON serialization
- **options.cpp** - Command-line parsing
- **models.hpp** - Data structures
- **catalog.hpp** - Archetype and kit definitions

## Recent Fixes

- ✅ Fixed uninitialized struct members causing memory issues
- ✅ Improved tile generation accuracy
- ✅ Proper entity placement validation

See `CPP_FIX_SUMMARY.md` for technical details.

## Performance

- **Generation Time**: < 100ms per level
- **Output Size**: ~10-15 KB per 4-room level
- **Memory Usage**: Minimal (< 10 MB)

## License

MIT - Feel free to use, modify, and distribute

## Credits

- Built with PCG-CPP for procedural randomization
- FastNoiseLite for noise generation
- Celeste modding community for inspiration

## Support

For issues or feature requests, refer to the included source code documentation.

---

**Version**: 1.0.0  
**Last Updated**: May 22, 2026  
**Status**: Production Ready ✅
