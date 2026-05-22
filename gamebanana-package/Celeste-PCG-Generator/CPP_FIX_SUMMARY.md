# Celeste PCG Generator - C++ Fix Summary

## The Problem

The C++ generator was producing tile data with random 'a' characters mixed into the output:
```json
"9000000000000aaaaaaaa0000000000000000009"
```

This indicated **uninitialized memory** being read and written to the tile vectors.

## Root Cause

In `models.hpp`, the `Room` and `Entity` structs had **uninitialized member variables**:

```cpp
// BEFORE - Members not initialized
struct Room {
    std::string name;
    int x;              // ❌ Uninitialized
    int y;              // ❌ Uninitialized
    int width;          // ❌ Uninitialized
    int height;         // ❌ Uninitialized
    int tileWidth;      // ❌ Uninitialized
    int tileHeight;     // ❌ Uninitialized
    std::string music;
    std::string ambience;
    int color;          // ❌ Uninitialized
    std::vector<char> tilesFg;
    std::vector<char> tilesBg;
    std::vector<Entity> entities;
};
```

### How This Caused the Bug

1. In `main.cpp:24`, Room objects are created with default construction:
   ```cpp
   std::vector<Room> rooms(topology.nodes.size());
   ```

2. With uninitialized members, `tileWidth` and `tileHeight` contained garbage values

3. When `makeRoom()` attempted to allocate tile vectors:
   ```cpp
   room.tilesFg.assign(
       static_cast<std::size_t>(room.tileWidth * room.tileHeight),
       '0'
   );
   ```
   The garbage values in `tileWidth` and `tileHeight` could result in:
   - Incorrect vector sizes
   - Memory access violations
   - Uninitialized data being read and written

4. This uninitialized memory appeared as random 'a' characters in the JSON output

## The Fix

Added **default initializers** to all struct members in `models.hpp`:

```cpp
// AFTER - All members properly initialized
struct Room {
    std::string name;
    int x = 0;              // ✅ Initialized to 0
    int y = 0;              // ✅ Initialized to 0
    int width = 0;          // ✅ Initialized to 0
    int height = 0;         // ✅ Initialized to 0
    int tileWidth = 0;      // ✅ Initialized to 0
    int tileHeight = 0;     // ✅ Initialized to 0
    std::string music;
    std::string ambience;
    int color = 0;          // ✅ Initialized to 0
    std::vector<char> tilesFg;
    std::vector<char> tilesBg;
    std::vector<Entity> entities;
};
```

Same fix applied to the `Entity` struct.

## Why This Works

- When Room objects are default-constructed, all integer members are now initialized to 0 (or appropriate default values)
- When `makeRoom()` is called, it immediately overwrites these values with correct dimensions
- Vector allocation happens with correct, known sizes
- No uninitialized memory is read or written

## Files Modified

1. **cpp/src/models.hpp**
   - Added default initializers to `Room` struct members
   - Added default initializers to `Entity` struct members

## Testing

Rebuild the project to apply the fix:
```bash
cd cpp
mkdir -p build
cd build
cmake ..
cmake --build . --config Debug
```

The tile data should now be clean with no random 'a' characters:
```json
"9555555555555555550000555555555555555559"
"9000000000000000000000000000000000000009"
"9000000000000000000000000000000000000009"
```

## Best Practice

This is a common C++ pitfall. Always initialize struct members, either:
- With default member initializers (as done here)
- In a constructor
- With aggregate initialization when creating objects
