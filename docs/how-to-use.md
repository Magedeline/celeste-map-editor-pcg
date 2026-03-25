# How To Use

This guide is the repo wiki-style walkthrough for day-to-day usage.

## Build The Extension

1. Install Node.js 18 or newer.
2. Run `npm install`.
3. Run `npm run compile` for a production build or `npm run watch` while iterating.

## Open The Editor

1. Open the workspace in VS Code.
2. Press `F5` to start the Extension Development Host.
3. Open any Celeste `.bin` file.
4. Choose `Celeste Map Editor` when VS Code asks which editor to use.

## Create Or Edit Maps

1. Run `Celeste: New Map` to create a new map.
2. Use the room list in the left panel to switch rooms.
3. Use the tile palette and tool buttons to paint FG and BG tiles.
4. Save with `Ctrl+S`.

## Generate A Chapter Layout

1. Run `Celeste: Generate Room Cluster`.
2. Choose the randomizer mode.
3. Choose a kit, layout mode, and chapter archetype.
4. For `Celeste Category`, choose either `Procedural` or `Hybrid Template-Backed`.
5. If you choose hybrid mode, select a template palette.

## Read The Validation Overlays

1. Use `Overlay` in the toolbar to show room-local route validation.
2. Use `Topology` to show the chapter-wide minimap overlay.
3. Green nodes are likely viable.
4. Yellow nodes are uncertain.
5. Red nodes are unstable.
6. In hybrid mode, unstable rooms now receive an automatic repair pass before the final summary is produced.

## Use The Windows Launcher

1. Run `npm run publish:pcg-launcher` to publish the standalone launcher.
2. Run `npm run package:pcg-launcher` to produce the zip bundle.
3. Open `pcg-launcher/publish/CelestePcgLauncher.exe` to preview and export generated layouts outside VS Code.

## Export Data

1. Run `Celeste: Export Map as JSON` to export a JSON copy.
2. Run `Celeste: Export Lonn + MonoGame Compatibility Bundle` to generate the interoperability bundle.

## Where To Look Next

1. [generator-modes-plan.md](generator-modes-plan.md)
2. [../README.md](../README.md)
