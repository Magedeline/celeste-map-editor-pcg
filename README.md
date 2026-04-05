# Celeste Map Editor for Producal Content Generation

A visual tile map editor for Celeste `.bin` map files, built as a VS Code extension.

![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-007ACC)

## Features

- **Open Celeste .bin maps** directly in VS Code with a visual editor
- **2D Canvas-based tile editor** with zoom, pan, and grid overlay
- **Tile palette** with standard Celeste tile types (Dirt, Snow, Stone, etc.)
- **Layer management** — toggle visibility for FG/BG tiles, entities, triggers, decals
- **Drawing tools** — Pencil, Rectangle, Fill, Eraser
- **Room management** — view, switch between, and add new rooms
- **Procedural room clusters** — generate connected room layouts with seeded PCG or true randomness
- **Entity & trigger visualization** — see entities and triggers overlaid on the map
- **Save back to .bin** — full round-trip: open, edit, save
- **Export to JSON** — export map data for external tools
- **Compatibility bundle export** — generate Lönn Lua files, MonoGame scene JSON, C# DTO models, and a sample MonoGame viewer

## Getting Started

- How-to guide: [docs/how-to-use.md](docs/how-to-use.md)
- Public release checklist: [docs/public-release-wip.md](docs/public-release-wip.md)

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [VS Code](https://code.visualstudio.com/) 1.85+

### Build & Run

```bash
# Install dependencies
npm install

# Compile (development)
npm run watch

# Or compile for production
npm run compile

# Optional: build the native C++ room generator
npm run build:native

# Optional: publish a clickable Windows PCG launcher executable
npm run publish:pcg-launcher

# Optional: build and zip the Windows PCG launcher for sharing
npm run package:pcg-launcher
```

### Repo Governance

- Security policy: [SECURITY.md](SECURITY.md)
- Ownership rules: [.github/CODEOWNERS](.github/CODEOWNERS)

### Release Automation

- GitHub Actions release packaging: [.github/workflows/release-artifacts.yml](.github/workflows/release-artifacts.yml)
- Manual run: trigger the workflow from the Actions tab.
- Manual Marketplace publish: run the workflow with `publishMarketplace=true` after adding `VSCE_PAT`.
- Tagged run: push a tag like `v0.1.0` to build the VSIX, package the Windows launcher, generate checksums, attach those files to the GitHub release, and publish to the VS Code Marketplace when `VSCE_PAT` is configured.

### Launch in VS Code

1. Open the `celeste-map-editor-vscode` folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. In the new VS Code window, open any Celeste `.bin` map file
4. Select **"Celeste Map Editor"** when prompted for the editor

### Create a New Map

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run **"Celeste: New Map"**
3. Enter a package name and save location

## Controls

| Action | Control |
| ------ | ------- |
| Pan | Middle-click drag / Alt + Left-click drag |
| Zoom | Mouse wheel |
| Pencil tool | `B` |
| Rectangle tool | `R` |
| Fill tool | `G` |
| Eraser tool | `E` |
| Select tool | `V` |
| Save | `Ctrl+S` |

## Architecture

```text
src/
├── extension.ts                 # Extension entry point
├── celesteMapEditorProvider.ts  # Custom editor + WebView (HTML/CSS/JS)
├── mapParser.ts                 # Celeste .bin binary parser
├── mapSerializer.ts             # Serialize back to .bin
└── types.ts                     # TypeScript type definitions
```

### Binary Format

The Celeste `.bin` format uses:

- **7-bit encoded length-prefix strings** (same as .NET BinaryReader)
- **Lookup table** for repeated strings
- **Typed values**: bool, byte, int16, int32, float32, lookup string, raw string, RLE string
- **Recursive element tree** with attributes and children

### PCG Setup

This project now includes the `pcg-random` package for deterministic, seedable random number generation in the TypeScript extension runtime.

- Use [src/pcg.ts](src/pcg.ts) for seeded RNG helpers in editor or map-generation code.
- The attached `pcg-cpp` archive is not used directly here because this extension is bundled with Node.js + TypeScript and does not have a native C++ build pipeline.
- Keep security-sensitive values such as WebView CSP nonces on a cryptographically secure source rather than PCG.

### Procedural Cluster Generator

The editor now includes a built-in room-cluster generator with two randomization modes:

- `Pseudo Randomizer`: deterministic seeded generation using PCG.
- `True Randomizer`: non-deterministic generation using Node's cryptographic randomness.

Pseudo mode now supports auto-randomized seeds per run. In the VS Code flow you can leave the seed blank to generate a fresh deterministic seed for that run, and the Windows launcher now includes an `Auto-randomize pseudo seed each run` toggle so it no longer defaults to reusing `12345` unless you intentionally pin a seed.

The generator now also supports multiple room-topology modes:

- `Grid`: a dense full-adjacency room cluster.
- `Critical Path`: one start-to-goal route across the full room set.
- `Critical Path + Branches`: a main route with optional side rooms and reward detours.
- `Celeste Randomizer`: a paper-inspired chapter skeleton with a staged main route, branch rooms, and shortcut links.
- `Open Skeleton`: a hub-and-spoke structure with a few loops for more exploratory layouts.

Room interiors are now generated through a lightweight Markov-style model in the TypeScript extension runtime. The model is trained per generation pass from the currently loaded map rooms when available, then augmented with archetype-specific exemplar rooms so the generator still has a usable training corpus on empty maps.

Hybrid palette assignment now includes a lightweight Edgar-inspired solver pass before room painting. Templates carry footprint intent and typed exit-socket metadata, and the generator now runs a bounded whole-graph beam search that scores neighboring room compatibility instead of choosing each room independently.

Generated rooms are also evaluated with repeated route sampling rather than a single static path. The preview metadata now tracks support mean and variance across the selected route, viable route count across multiple attempts, and lightweight AOI-based interestingness, difficulty, and scarcity scores inspired by the FDG 2025 Celeste PCG paper.

The generator also includes themed kit presets so you can build clustered layouts in an editor-native workflow.

For the next implementation layer above topology modes, see [docs/pcg-archetypes.md](docs/pcg-archetypes.md).

- `House Kit`
- `Resort Kit`
- `Cliffside Kit`
- `Kirby Kit`
- `Mario Kit`
- `Metroidvania Kit`
- `Labybirth Kit`
- `Pizza Tower Kit`
- `Arcade Kit`

### Native C++ Generator

The extension now supports an optional external C++ generator executable.

- Source lives under [cpp/CMakeLists.txt](cpp/CMakeLists.txt) and [cpp/src/main.cpp](cpp/src/main.cpp).
- Build it with `npm run build:native`.
- On Windows, the build helper resolves CMake from standard install locations, so you do not need to restart VS Code just to refresh `PATH`.
- When the executable is present, the extension will prefer the native generator for room-cluster generation.
- The extension currently routes procedural room generation through the TypeScript path because the new Markov room generator has not been mirrored to the native C++ executable yet.
- If the executable is missing, the extension falls back to the in-process TypeScript generator.
- The C++ generator now uses `pcg-cpp` for pseudo-random generation.
- This repo now includes a vendored copy under `cpp/third_party/pcg-cpp`, so normal local builds do not need to fetch `pcg-cpp` during CMake configure.
- The vendored package came from the `pcg-cpp-0.98` headers and includes small MSVC compatibility backports in the vendored headers so it builds cleanly on the current Windows toolchain.
- If you remove the vendored folder, CMake will still fall back to fetching `pcg-cpp` automatically during configure.
- This keeps the VS Code integration in TypeScript while moving the procedural engine toward C++.

### Clickable Windows PCG Launcher

If you want a standalone window you can open by double-clicking instead of running commands inside VS Code, publish the launcher executable:

- Run `npm run publish:pcg-launcher`
- The published app is written to `pcg-launcher/publish/CelestePcgLauncher.exe`
- The launcher is now published as a self-contained Windows build, so other PCs do not need a separate .NET runtime installed
- The publish step also copies `celeste_pcg_generator.exe` next to the launcher so the GUI can call the native generator directly
- When you open the launcher, it gives you fields for mode, seed, kit, cluster size, room size, package name, output JSON path, and output `map.bin` path
- The launcher now also lets you choose the room layout mode directly, so you can switch between grid, critical path, branch-heavy, and open skeleton generation without going back to VS Code
- The generator and launcher now also expose a `Celeste Randomizer` chapter-graph mode that produces less rigid chapter layouts than the old fixed serpentine path
- The launcher now uses a Windows night-style dark theme so the generator, preview, and export workflow are easier on the eyes during longer sessions
- The launcher now renders a full-map preview panel so you can inspect the generated layout before exporting JSON or `map.bin`
- `Generate Preview` keeps the generated JSON in memory, updates the preview, and lets you export only after the layout looks correct
- The preview panel now supports mouse-wheel zoom, `+` / `-` zoom shortcuts, arrow-key panning, `Ctrl+0` reset, double-click reset, and a dedicated `Reset View` button
- The preview also shows a stronger per-kit accent theme and legend so each preset reads more distinctly before export
- The preview now draws layout-aware topology overlays, so the main route, branch links, checkpoints, and hub rooms are easier to read before export
- The launcher includes a kit help panel with descriptions for each theme so you can compare kits without leaving the app
- The launcher can still convert an existing JSON file into `map.bin` from the same window and now loads that JSON into the preview at the same time
- The launcher now remembers your last-used PCG settings in your local app data folder and reloads them the next time you open it

If you want a single shareable file, run `npm run package:pcg-launcher`.

- That command republishes the launcher and creates `pcg-launcher/CelestePcgLauncher-win-x64.zip`
- The zip contains the launcher, the native generator, and the required runtime files together
- The published folder and zip now also include `Install-CelestePcgLauncher.ps1` to copy the launcher into your local app data folder and create a desktop shortcut
- They also include `Create-DesktopShortcut.ps1` if you only want a desktop shortcut that points to the extracted folder
- They also include `Install-CelestePcgLauncher.bat` and `Create-DesktopShortcut.bat` so you can run the setup with a normal double-click even if PowerShell execution policy is restrictive

### Lönn + MonoGame Compatibility

The extension can export a compatibility bundle for downstream tooling:

- `monogame-scene.json`: a room-oriented scene export for C# runtime loading.
- `CelesteMapModels.cs`: DTO model types that work with MonoGame and MonoGame.Extended.
- `CelesteMapRenderer.cs`: a lightweight MonoGame renderer helper for the exported scene shape.
- `sample-monogame/*`: a minimal desktop viewer project that reads the exported scene JSON.
- `loenn/entities/*.lua` and `loenn/triggers/*.lua`: generated or imported Lönn Lua definitions for entities and triggers seen in the map.

Run the command `Celeste: Export Lönn + MonoGame Compatibility Bundle` to generate the bundle.

If `celesteMapEditor.loennPluginPath` points at an existing Lönn plugin folder, Lua files found in `entities`, `triggers`, `libraries`, and `helpers` are copied into the bundle and override generated definitions with the same relative path.

### MonoGame Live Preview

The repo now also includes a repo-local MonoGame live preview app for the active VS Code editor session.

- Run `Celeste: Open MonoGame Live Preview` while a `.bin` map is open in the custom editor.
- The extension writes a live scene bundle to `.celeste-monogame-live/.../preview/monogame-scene.json` by default.
- If `celesteMapEditor.monoGameLiveSync` is enabled, the preview bundle is rewritten as the active map changes, so the external MonoGame window hot-reloads without re-running the command.
- The preview project lives under `csharp-monogame-preview/` and can also be built directly with `npm run build:monogame-preview`.
- `celesteMapEditor.monoGamePreviewProjectPath` lets you point the command at a different MonoGame preview project if you move it or replace it.

### Standalone MonoGame Native Editor

The repo now also includes a separate native C# editor path outside the VS Code webview.

- Run `Celeste: Open MonoGame Native Editor` while a `.bin` map is open in the custom editor.
- The extension exports the current map into a scene bundle and launches the standalone editor from `csharp-native-editor/`.
- Saving in the native editor now writes through to the real `.bin` map in the workspace by importing the saved scene bundle back into the active custom editor document and immediately serializing that updated map to disk.
- The native editor still uses the exported `monogame-scene.json` bundle for live interchange, so the MonoGame window and VS Code editor stay in sync while editing.
- The native editor now supports room-level layout editing plus direct content editing: room selection, drag-to-move, arrow-key nudging, `Ctrl+Arrow` resizing, add room, delete room, foreground/background tile painting, trigger placement, entity placement, and erase mode.
- The native editor now also opens a dedicated native inspector window for the selected room. The inspector exposes room metadata fields, editable entity and trigger attributes, and foreground/background decal editing with add, remove, and apply controls.
- Tool hotkeys in the native editor: `Tab` cycle tools, `M` room layout, `F` foreground tiles, `B` background tiles, `E` entities, `T` triggers, `X` erase, `PageUp/PageDown` cycle entity or trigger brushes, number keys `1` to `0` choose the tile brush, and `Ctrl+S` saves the scene bundle.
- Build it directly with `npm run build:monogame-editor`.
- `celesteMapEditor.monoGameEditorProjectPath` lets you swap the launched editor project without changing the extension code.

### Shared C# MonoGame Runtime

The MonoGame preview and native editor both share the same runtime layer in `csharp-monogame-shared/`.

- `SceneModels.cs` contains the scene DTOs used by the exported JSON bundle.
- `CelesteMapRenderer.cs` contains the lightweight tile/entity renderer shared by both apps.
- `SceneBundle.cs` resolves the bundle path passed by the VS Code commands and loads or saves `monogame-scene.json`.

### Layers

| Layer | Description |
| ----- | ----------- |
| FG Tiles | Foreground solid tiles (collision) |
| BG Tiles | Background decorative tiles |
| Entities | Game objects (player, spinners, springs, etc.) |
| Triggers | Trigger regions (music, camera, etc.) |
| FG Decals | Foreground decorative sprites |
| BG Decals | Background decorative sprites |

## Configuration

| Setting | Default | Description |
| ------- | ------- | ----------- |
| `celesteMapEditor.celestePath` | `""` | Path to Celeste installation |
| `celesteMapEditor.gridSize` | `8` | Tile grid size in pixels |
| `celesteMapEditor.showGrid` | `true` | Show grid overlay |
| `celesteMapEditor.defaultRoomWidth` | `320` | Default new room width |
| `celesteMapEditor.defaultRoomHeight` | `184` | Default new room height |
| `celesteMapEditor.loennModulePrefix` | `CelesteMapEditor` | Prefix used for generated Lönn Lua stub names when an entity is not already namespaced |
| `celesteMapEditor.monoGameNamespace` | `CelesteMapEditor.Interop` | Namespace used in generated C# compatibility models |
| `celesteMapEditor.loennPluginPath` | `""` | Optional path to an existing Lönn plugin folder whose Lua files should be included in the compatibility export |

## Roadmap

- [ ] Tileset texture loading from Celeste's Graphics folder
- [ ] Entity placement and editing
- [ ] Trigger placement and editing  
- [ ] Decal placement with texture preview
- [ ] Undo/redo support
- [ ] Copy/paste rooms and selections
- [ ] Room property editing (music, wind, etc.)
- [ ] Multi-room overview map
- [ ] Integration with Lönn plugin definitions

## License

MIT
