# PCG Archetype Spec

This document turns the observed Celeste map patterns into concrete generator rules for future work.

The current generator in [src/proceduralGeneration.ts](../src/proceduralGeneration.ts) already supports topology modes such as `grid`, `criticalPath`, `criticalPathBranches`, and `openSkeleton`. The next step is to make those topologies feel like authored Celeste chapters rather than abstract room graphs.

## Design Goals

- Keep one readable main route in most layouts.
- Use compact knots instead of large open-world hubs.
- Reserve landmark rooms for pacing changes, checkpoints, and finales.
- Make room names and roles reflect progression, not only coordinates.
- Preserve editor readability in Lonn and in the launcher preview.

## Core Terms

- `macro shape`: the high-level outline of the map from overview zoom.
- `main route`: the primary playable path from start to goal.
- `knot`: a compact dense region where pacing or navigation changes.
- `landmark room`: a set-piece, checkpoint, intro, outro, or unusually large traversal room.
- `leaf branch`: a side room or short branch chain that does not continue the main route.

## Structural Rules

These rules should apply to most generated chapters regardless of theme kit.

1. Between 60% and 80% of rooms should belong to one main route.
2. Branch chains should usually be shorter than main-route segments.
3. Each chapter should contain 1 to 3 landmark rooms.
4. Macro direction should be visible from the full-map overview.
5. Dense room knots should be local exceptions, not the entire chapter.
6. Detached rooms should be rare and intentional.
7. Checkpoints should appear near topology transitions, not at arbitrary intervals.

## Recommended Room Roles

The existing room-role system should grow toward these semantic roles.

- `start`: initial spawn and teaching space.
- `intro`: low-pressure onboarding room.
- `path`: standard traversal room on the main route.
- `checkpoint`: topology hinge or pacing reset.
- `knot`: compact cluster anchor room.
- `hub`: locally branching room with more than two exits.
- `branch`: optional side-route room.
- `reward`: berry, item, lore, or optional challenge room.
- `setpiece`: oversized or mechanically distinct landmark room.
- `goal`: chapter exit or final reward room.

## Archetype Catalog

### 1. Linear Ascent

Best fit:

- Forsaken City style climbs
- Golden Ridge style rising traversal
- Summit subchains

Macro shape:

- diagonal up-right
- staircase climb
- vertical capstone at the end

Recommended room mix:

- 1 `start`
- 1 `intro`
- 4 to 8 `path`
- 1 `checkpoint`
- 1 `setpiece`
- 1 `goal`
- 0 to 2 `branch`

Generator rules:

- Favor horizontal-then-up or diagonal adjacency.
- Keep branches as short leaves.
- Place the checkpoint around the midpoint or before the last third.
- Reserve the last room or last two rooms for a stronger vertical finish.

### 2. Long Run With Density Burst

Best fit:

- Restore style layouts
- Reflection-like long traversals
- Core corridor variants

Macro shape:

- long horizontal route
- one dense middle knot
- cleaner exit stretch

Recommended room mix:

- 1 `start`
- 4 to 6 `path`
- 1 `knot`
- 1 `checkpoint`
- 1 `setpiece`
- 1 `goal`
- 1 to 3 `branch`

Generator rules:

- Keep the opening and closing thirds sparse.
- Insert a 3 to 5 room dense region in the middle.
- Use the knot as a place for route overlap, checkpointing, or mechanical shift.

### 3. Spine With Compact Branching

Best fit:

- Mirror Temple style exploration
- Old Site style clustered progression

Macro shape:

- one obvious spine
- compact central knot
- multiple short arms

Recommended room mix:

- 1 `start`
- 4 to 7 `path`
- 1 `hub`
- 1 `checkpoint`
- 2 to 4 `branch`
- 1 `reward`
- 1 `goal`

Generator rules:

- The main route must still be visually obvious from overview zoom.
- Branches should mostly be one-room or two-room leaves.
- Only one branch should be allowed to rejoin the spine.
- The hub should sit near the middle third, not at the very start.

### 4. Landmark Corridor

Best fit:

- Core-style long corridors
- intro-to-arena transitions
- high-contrast gimmick runs

Macro shape:

- small start cluster
- one unusually long room or corridor chain
- one major turn or payoff room

Recommended room mix:

- 1 `start`
- 1 `intro`
- 2 to 4 `path`
- 1 `setpiece`
- 1 `checkpoint`
- 1 `goal`
- 0 to 1 `branch`

Generator rules:

- Guarantee at least one room longer than the local average.
- Keep side content minimal.
- Use contrast in room dimensions to make the set-piece read clearly.

### 5. Segmented Summit

Best fit:

- Summit-style multi-phase climbs
- chapter chains with visible section color changes

Macro shape:

- multi-segment ascent
- each segment has its own local cadence
- visible chapter breakpoints

Recommended room mix:

- 1 `start`
- 2 to 4 segment groups
- each segment contains 2 to 4 `path` rooms
- 1 `checkpoint` at segment boundaries
- 1 `goal`

Generator rules:

- Split the main route into named segments.
- Allow room kit tint or preview overlay changes by segment.
- Put check-ins or pacing resets between segments, not inside them.

## Naming Rules

Generated rooms should move toward progression-oriented naming.

Examples:

- `start_00`
- `intro_00`
- `path_03`
- `checkpoint_01`
- `hub_00`
- `branch_02`
- `reward_01`
- `goal_00`

For segmented archetypes:

- `seg0_start_00`
- `seg1_path_02`
- `seg2_checkpoint_00`
- `seg3_goal_00`

Coordinate-only names such as `house_1_2` are still useful internally, but semantic names should become the preferred output once downstream compatibility is verified.

## Pacing Model

The generator should assign pacing phases before painting geometry.

Recommended default pacing order:

1. intro
2. build
3. first test
4. breath or branch
5. checkpoint
6. escalation
7. setpiece
8. finale

This pacing layer should sit above topology and below room painting.

## Implementation Plan

### Phase 1: Archetype Selection

Add an archetype selection layer above `layoutMode`.

Suggested type shape:

```ts
type ChapterArchetype =
  | 'linearAscent'
  | 'longRunDensityBurst'
  | 'spineCompactBranching'
  | 'landmarkCorridor'
  | 'segmentedSummit';
```

### Phase 2: Topology Constraints

Map each archetype onto an allowed subset of current topology modes.

- `linearAscent` -> `criticalPath`
- `longRunDensityBurst` -> `criticalPathBranches`
- `spineCompactBranching` -> `criticalPathBranches` or constrained `openSkeleton`
- `landmarkCorridor` -> `criticalPath`
- `segmentedSummit` -> `criticalPath`

### Phase 3: Role Assignment

Expand the current room-role system in [src/proceduralGeneration.ts](../src/proceduralGeneration.ts) beyond:

- `start`
- `goal`
- `checkpoint`
- `hub`
- `path`
- `branch`

Add:

- `intro`
- `reward`
- `setpiece`
- `knot`

### Phase 4: Naming and Preview

- Use semantic names in generated output.
- Expose archetype and pacing in launcher preview metadata.
- Color-code segments or pacing phases in [pcg-launcher/MapPreviewPanel.cs](../pcg-launcher/MapPreviewPanel.cs).

### Phase 5: Validation

Add a validation pass that checks:

- main route reachability
- branch depth limits
- checkpoint placement quality
- landmark count
- detached room count
- semantic naming coverage

## Non-Goals

The generator should not aim for the following by default.

- fully open-world metroidvania graphs
- high branch density in every chapter
- uniformly random room dimensions everywhere
- giant disconnected satellite rooms
- naming based only on export coordinates

## Recommended Next Code Changes

1. Add a `ChapterArchetype` type in [src/proceduralGeneration.ts](../src/proceduralGeneration.ts).
2. Add an archetype picker to [src/celesteMapEditorProvider.ts](../src/celesteMapEditorProvider.ts) and [pcg-launcher/MainForm.cs](../pcg-launcher/MainForm.cs).
3. Separate `topology mode` from `chapter archetype` so one controls graph shape and the other controls pacing and room roles.
4. Emit preview metadata in generator JSON instead of inferring everything from room names and door cuts.
5. Move room naming from coordinate-first to semantic-first once Lonn and binary export workflows are verified against generated maps.
