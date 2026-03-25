# Generator Modes Plan

This plan turns the current procedural chapter generator into a multi-mode authoring system with three explicit workflows:

1. Procedural mode
2. Hybrid template-backed mode
3. Author-guided graph mode

The recommendation is to implement the modes in that order. Hybrid mode reuses the existing generator pipeline with the least disruption. Graph mode should build on the same metadata and validation layer instead of introducing a second topology model.

## Goals

- Keep the existing procedural generator as the default path.
- Add curated room or set-piece injection without giving up seed-based replay.
- Let designers shape a chapter route directly when procedural controls are not precise enough.
- Preserve TypeScript and native parity where it matters, but avoid blocking new editor workflows on C++ support.

## Research Adjustments

The plan above aligns well with Robinet, Gómez-Maureira, and Preuss, `Towards a Celeste AI Framework: Agent-free Automated 2D Level Generation for Multidirectional Platformers` (FDG 2025). That paper suggests a few constraints and opportunities that should directly influence this repo.

### Keep the two-step pipeline

The paper explicitly separates generation into:

1. a high-level skeleton with start, end, and room arrangement
2. room content generation inside the skeleton

That matches this repo's current architecture and reinforces the decision to keep graph and topology authoring separate from room realization. Graph mode should edit the skeleton. Hybrid mode should bias the room realization stage, not replace skeleton generation.

### Treat structure and entities as one gameplay problem

One of the paper's clearest points is that Celeste level quality is not just tile structure. Entity placement is part of the path definition, and removing a refill, bouncer, or hazard can make a room impossible or trivial.

Implication for this repo:

- hybrid templates should bundle tile and entity intent together
- graph-authored nodes should support traversal and hazard profiles, not just room role labels
- future validation should score rooms using both geometry and entity support

### Split generation knowledge by orientation and difficulty

The paper warns that mixing horizontal and vertical structures into one model harms structural quality. It also suggests classifying training rooms by difficulty instead of relying only on chapter identity.

Implication for this repo:

- template palettes should eventually be tagged by traversal orientation:
  - horizontal
  - vertical
  - mixed
- archetypes should prefer palettes matching their movement profile
- future template and graph systems should expose a difficulty band separate from archetype
- the generator should avoid pretending that one room family fits intro, climb, detour, and summit equally well

### Add lightweight playability heuristics before agent simulation

The paper's agent-free evaluation is valuable here because this repo also lacks a full Celeste-playing AI. Two findings matter:

- simple path existence is only an upper bound on true playability
- path support quality improves when measuring both average support distance and variance, not only one metric

Implication for this repo:

- add a lightweight path-support validator before graph realization becomes user-facing
- score candidate rooms using:
  - path continuity
  - mean support distance along the route
  - variance of support distance along the route
- treat large variance as a sign of unstable traversal, even when a theoretical route exists

This is a better next validation layer than trying to build a full Celeste agent immediately.

### Prefer post-processing passes over fully implicit generation

The paper attributes some of its success to post-processing, especially around exit cleanup and strategic gameplay element placement.

Implication for this repo:

- keep room generation layered:
  - skeleton
  - paint shell
  - place platforms
  - inject traversal entities
  - validate path support
  - add decorative or optional rewards
- hybrid templates should act as post-processing constraints on selected node roles
- graph realization should include an explicit connector and exit cleanup pass

### Be careful with room scale and evaluation budget

The paper notes that playability assessment becomes less reliable for large rooms because heuristic search budgets become the bottleneck.

Implication for this repo:

- keep validation conservative for large rooms
- treat tall or wide showcase rooms as requiring more permissive heuristics or explicit author guidance
- do not overfit generator success metrics to large-room path checks alone

## Additional Milestones

The paper adds two concrete milestones that should sit between the current phases.

### Phase 2.5: Heuristic Path Validation

Objective: add an agent-free room viability pass before graph mode becomes editable by users.

Files:

- new file: `src/pathValidation.ts`
- `src/proceduralGeneration.ts`
- `src/celesteMapEditorProvider.ts`

Changes:

- approximate an intended route from room entrances to exits
- measure support distance along the route
- compute mean and variance for support quality
- flag rooms with unstable traversal support
- surface warnings in preview metadata and the editor UI

Acceptance criteria:

- generated rooms can be marked `likely viable`, `uncertain`, or `unstable`
- hybrid templates and graph-authored realizations can be validated without a full Celeste-playing agent

### Phase 3.5: Difficulty and Orientation Tags

Objective: make curated generation data more Celeste-specific by separating traversal style and challenge level.

Files:

- `src/types.ts`
- `src/templateRegistry.ts`
- `src/proceduralGeneration.ts`

Changes:

- add template tags for orientation and difficulty band
- let archetypes express preferred movement styles
- allow graph-authored nodes to request difficulty escalation by segment

Acceptance criteria:

- templates can be filtered by vertical, horizontal, or mixed traversal
- hybrid generation can escalate challenge without swapping archetypes

## Current Seams

The current codebase already has the right boundaries for this work:

- `src/types.ts`: shared generator and preview data model.
- `src/proceduralGeneration.ts`: topology construction, room roles, archetypes, and room painting.
- `src/celesteMapEditorProvider.ts`: command flow, webview state, preview rendering, and interaction routing.
- `src/nativeGenerator.ts`: native subprocess boundary.
- `cpp/src/main.cpp`: native generator parity.

Two existing concepts should become first-class instead of staying generator-only internals:

- template metadata
- editable topology metadata

## Recommended Direction

### Mode 1: Procedural

This is the existing generator flow:

- seed
- archetype
- topology mode
- room kit and phase heuristics

No architectural rewrite is needed. The main change is to treat procedural mode as one explicit generator mode instead of the only mode.

### Mode 2: Hybrid

Hybrid mode should combine a generated chapter skeleton with curated room families or set-pieces.

The practical version for this repo is not a generic prefab system. It is a role-driven template system for Celeste chapter structures:

- intro room templates
- checkpoint anchor templates
- berry detour templates
- summit or set-piece templates
- transition shaft templates

The generator still decides structure, pacing, and placement. Templates constrain or override the internals of selected rooms.

### Mode 3: Author-Guided Graph

Graph mode should let the user author the chapter route directly by editing nodes and edges, then use the existing room realization pipeline to fill in room geometry and props.

This should be graph-first, not tile-first:

- create nodes
- connect nodes
- assign roles and phases
- mark start, checkpoint anchors, optional branches, and summit
- realize the graph into rooms

## Phase Plan

## Phase 0: Foundations

Objective: make generator mode and authored metadata explicit in the shared model.

Files:

- `src/types.ts`
- `src/proceduralGeneration.ts`
- `src/nativeGenerator.ts`

Changes:

- Add `GeneratorMode = 'procedural' | 'hybrid' | 'graphAuthored'`.
- Extend `RoomClusterOptions` with `generatorMode`.
- Add optional template metadata fields to preview metadata:
  - `templatePaletteId?`
  - `templateAssignments?`
- Add first-class editable graph types:
  - `ChapterGraph`
  - `ChapterGraphNode`
  - `ChapterGraphEdge`
- Add conversion helpers between generated preview topology and editable graph topology.

Acceptance criteria:

- Existing procedural generation still compiles and behaves the same when `generatorMode` is omitted.
- Maps can carry mode and template metadata in preview metadata without changing `.bin` serialization.

## Phase 1: TypeScript Template Registry

Objective: create a template registry that can drive hybrid generation in the TypeScript path first.

Files:

- `src/types.ts`
- `src/proceduralGeneration.ts`
- `src/celesteMapEditorProvider.ts`
- new file: `src/templateRegistry.ts`
- new folder: `templates/` or `assets/templates/`

Changes:

- Add `TemplateDefinition` and `TemplatePalette` types.
- Move built-in curated generation presets into a registry-backed structure.
- Load template palettes from JSON in the TypeScript generator.
- Support room-role targeting in templates, for example:
  - `hub`
  - `checkpoint`
  - `setpiece`
  - `berry`
- Allow parameterized template selection, such as difficulty band, traversal flavor, and density.

Acceptance criteria:

- The editor can list available template palettes.
- Hybrid mode can generate a room cluster using TypeScript only.
- Preview metadata records which palette and template assignments were used.

## Phase 2: Hybrid Generation Flow

Objective: route the existing generator through a hybrid path without replacing the underlying topology builders.

Files:

- `src/proceduralGeneration.ts`
- `src/celesteMapEditorProvider.ts`
- optional later parity:
  - `src/nativeGenerator.ts`
  - `cpp/src/main.cpp`

Changes:

- Add a `generateHybridRoomCluster()` path that:
  - builds topology as normal
  - assigns roles and phases as normal
  - injects template constraints for selected nodes
  - realizes rooms using template-aware paint profiles
- Add a generate flow in the editor that asks for:
  - generator mode
  - archetype
  - layout mode
  - template palette when hybrid mode is selected
- Keep native generation procedural-only at first if needed.

Acceptance criteria:

- The editor exposes `procedural` and `hybrid` as separate generation flows.
- Hybrid maps remain seed-replayable from stored metadata.
- When native support is unavailable for hybrid mode, the editor falls back to TypeScript cleanly.

## Phase 3: Editable Graph Model

Objective: make chapter topology editable instead of treating preview topology as disposable output.

Files:

- `src/types.ts`
- `src/proceduralGeneration.ts`
- new file: `src/graphAuthoring.ts`

Changes:

- Add mutable graph operations:
  - add node
  - remove node
  - connect nodes
  - disconnect nodes
  - assign role
  - assign phase override
- Add validation helpers:
  - start and end existence
  - connectivity
  - checkpoint placement sanity
  - no isolated nodes unless explicitly allowed
- Add conversion helpers:
  - `previewMetadataToGraph()`
  - `graphToPreviewMetadata()`

Acceptance criteria:

- A generated chapter preview can be converted into an editable graph and back.
- Validation errors can be surfaced before room realization.

## Phase 4: Graph Editor UI

Objective: add a dedicated graph editing mode to the webview.

Files:

- `src/celesteMapEditorProvider.ts`

Changes:

- Add a UI mode toggle:
  - `Tile Edit`
  - `Graph Edit`
- In graph mode, render:
  - nodes
  - edges
  - role markers
  - phase coloring
- Add interactions:
  - create node
  - drag node
  - connect nodes
  - delete edge
  - edit node role
  - mark checkpoint or summit
- Keep tile editing disabled or visually secondary while graph editing is active.

Acceptance criteria:

- A user can create and edit a chapter graph entirely in the webview.
- The graph view reuses the existing preview overlay language so roles and phases remain readable.

## Phase 5: Graph Realization and Persistence

Objective: realize authored graphs into room layouts and persist the authored topology.

Files:

- `src/celesteMapEditorProvider.ts`
- `src/proceduralGeneration.ts`
- `src/mapParser.ts`
- `src/mapSerializer.ts`

Changes:

- Add a graph-to-room realization pass that uses the existing room painting and traversal placement systems.
- Decide persistence strategy before implementation:
  - sidecar JSON file
  - optional metadata block in map data
  - preview-only ephemeral storage
- The recommended first version is a sidecar JSON file because it avoids risky `.bin` format changes.

Acceptance criteria:

- Authored graphs can be reopened and edited later.
- Realized maps preserve enough metadata to regenerate or inspect chapter structure.

## Native Strategy

The native generator should not block editor evolution.

Recommended order:

1. Keep native parity for procedural mode.
2. Let hybrid mode run in TypeScript until template definitions stabilize.
3. Add native template support only after the template schema is proven.
4. Keep graph authoring client-side and use native only for optional realization later.

This keeps the launcher stable while the editor grows new workflows.

## Immediate Next Milestone

The best next implementation target is Phase 1.

Why:

- It adds visible value quickly.
- It reuses the current generator instead of replacing it.
- It directly improves the new `celesteCategory` archetype by letting specific roles use curated room families.
- It creates the data model needed for graph mode later.

## First Implementation Slice

The first concrete slice should be small and measurable:

1. Add `GeneratorMode` and template metadata to `src/types.ts`.
2. Create `src/templateRegistry.ts` with one built-in palette.
3. Add a hybrid generate path in `src/proceduralGeneration.ts` for `celesteCategory` only.
4. Add a palette picker to the generate flow in `src/celesteMapEditorProvider.ts`.
5. Store the selected palette and template assignments in preview metadata.

If that slice works, the system has crossed the important line from single-generator PCG to multi-mode authoring.
