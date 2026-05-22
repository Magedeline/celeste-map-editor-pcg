Celeste Map Editor v1.0.0
==========================

A standalone desktop map editor for Celeste with PCG (Procedural Content Generation) support.

BUILD INFO
----------
- Version: 1.0.0
- Platform: Windows x64
- Type: Portable executable
- Size: ~80 MB

INCLUDED FEATURES
-----------------
- Full map editing (rooms, tiles, entities, triggers)
- Visual checkpoint indicators (CP badges on rooms)
- Room Properties modal with working checkboxes
- Inspector panel with live editing
- Topology graph visualization
- PCG room generation (requires C++ generator)
- GAN fill support (requires Python GAN server)

RECENT FIXES
------------
- Fixed checkbox interaction in Room Properties modal
- Fixed inspector panel checkbox styling
- Added checkpoint visual indicators (room list, canvas, inspector)
- Added pointer-events handling for modal interactions

LAUNCH
------
Simply run "Celeste Map Editor 1.0.0.exe" - no installation required.

NOTE
----
The PCG generator (celeste_pcg_generator.exe) is not included in this build
as it requires C++ compilation. The editor will work for manual map editing
and can open existing .bin files.
