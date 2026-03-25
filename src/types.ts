/**
 * Celeste Map Editor - Type Definitions
 * 
 * These types mirror the Celeste .bin map format structure
 * as documented in the Lönn editor source.
 */

// ─── Binary Format Types ───────────────────────────────────────────────────────

/** Value types in the Celeste binary format */
export enum BinaryValueType {
    Bool = 0,
    Byte = 1,
    Int16 = 2,
    Int32 = 3,
    Float32 = 4,
    LookupString = 5,
    RawString = 6,
    RLEString = 7,
}

/** A raw element parsed from the binary tree structure */
export interface BinaryElement {
    __name: string;
    __children: BinaryElement[];
    [key: string]: any;
}

// ─── Map Data Types ────────────────────────────────────────────────────────────

export type ChapterArchetype =
    | 'linearAscent'
    | 'longRunDensityBurst'
    | 'spineCompactBranching'
    | 'landmarkCorridor'
    | 'celesteCategory'
    | 'segmentedSummit';

export type GeneratorMode = 'procedural' | 'hybrid' | 'graphAuthored';

export type RoomShellVariant = 'default' | 'loft' | 'stairwell' | 'corridor' | 'perch' | 'arena';
export type RoomPlatformVariant = 'scattered' | 'ascending' | 'flanks' | 'branchPerch' | 'corridor' | 'arena';

export type PreviewRoomRole =
    | 'start'
    | 'goal'
    | 'checkpoint'
    | 'hub'
    | 'path'
    | 'branch'
    | 'intro'
    | 'reward'
    | 'setpiece'
    | 'knot';

export type PreviewViabilityStatus = 'likelyViable' | 'uncertain' | 'unstable';

export interface PreviewPathPoint {
    x: number;
    y: number;
}

export interface PreviewPathValidation {
    status: PreviewViabilityStatus;
    meanSupportDistance: number;
    supportDistanceVariance: number;
    unsupportedFraction: number;
    sampledPoints: number;
    anchors?: PreviewPathPoint[];
    sampledRoute?: PreviewPathPoint[];
}

export interface PreviewValidationSummary {
    overallStatus: PreviewViabilityStatus;
    likelyViable: number;
    uncertain: number;
    unstable: number;
}

export interface PreviewTopologyNode {
    id: number;
    roomName: string;
    row: number;
    column: number;
    role: PreviewRoomRole;
    connections: number[];
    phase: string;
    segment: number;
    validation?: PreviewPathValidation;
}

export interface PreviewTemplateAssignment {
    nodeId: number;
    role: PreviewRoomRole;
    templateId: string;
}

export interface PreviewMetadata {
    layoutMode: string;
    archetype: ChapterArchetype;
    generatorMode?: GeneratorMode;
    templatePaletteId?: string;
    templateAssignments?: PreviewTemplateAssignment[];
    validationSummary?: PreviewValidationSummary;
    startNodeId: number;
    goalNodeId: number;
    mainPathNodeIds: number[];
    nodes: PreviewTopologyNode[];
}

/** Top-level map data */
export interface CelesteMap {
    packageName: string;
    rooms: Room[];
    fillers: Filler[];
    stylesFg: StyleEntry[];
    stylesBg: StyleEntry[];
    previewMetadata?: PreviewMetadata;
}

/** A rectangular filler region */
export interface Filler {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** A room (level) in the map */
export interface Room {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    tileWidth: number;
    tileHeight: number;

    // Audio
    music: string;
    musicLayer1: boolean;
    musicLayer2: boolean;
    musicLayer3: boolean;
    musicLayer4: boolean;
    altMusic: string;
    ambience: string;

    // Room properties
    dark: boolean;
    underwater: boolean;
    space: boolean;
    disableDownTransition: boolean;
    cameraOffsetX: number;
    cameraOffsetY: number;
    windPattern: string;
    color: number;

    // Tile data
    tilesFg: TileGrid | null;
    tilesBg: TileGrid | null;
    objTiles: ObjectTileGrid | null;

    // Map objects
    entities: Entity[];
    triggers: Trigger[];
    decalsFg: Decal[];
    decalsBg: Decal[];
}

/** Grid of tile characters (e.g., '0' = air, other chars = solid) */
export interface TileGrid {
    width: number;
    height: number;
    /** Flat array of single-character tile IDs, row-major */
    tiles: string[];
}

/** Grid of object tiles using numeric IDs */
export interface ObjectTileGrid {
    width: number;
    height: number;
    /** Flat array of numeric tile IDs, -1 = empty */
    tiles: number[];
}

/** A map entity */
export interface Entity {
    name: string;
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    nodes: EntityNode[];
    attributes: Record<string, any>;
}

/** A node belonging to an entity */
export interface EntityNode {
    x: number;
    y: number;
}

/** A trigger (similar to entity but for trigger regions) */
export type Trigger = Entity;

/** A decal (decorative sprite) */
export interface Decal {
    texture: string;
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    color: string;
}

/** A style entry (parallax background or effect) */
export interface StyleEntry {
    type: 'parallax' | 'effect';
    name?: string;
    texture?: string;
    x?: number;
    y?: number;
    scrollX?: number;
    scrollY?: number;
    speedX?: number;
    speedY?: number;
    color?: string;
    alpha?: number;
    flipX?: boolean;
    flipY?: boolean;
    loopX?: boolean;
    loopY?: boolean;
    blendMode?: string;
    only?: string;
    exclude?: string;
    flag?: string;
    notFlag?: string;
    tag?: string;
    [key: string]: any;
}

// ─── Editor Types ──────────────────────────────────────────────────────────────

/** The currently active editing tool */
export enum EditorTool {
    Select = 'select',
    Pencil = 'pencil',
    Rectangle = 'rectangle',
    Fill = 'fill',
    Eraser = 'eraser',
    Entity = 'entity',
    Trigger = 'trigger',
    Decal = 'decal',
}

/** Layer visibility/editing state */
export enum MapLayer {
    TilesFg = 'tilesFg',
    TilesBg = 'tilesBg',
    Entities = 'entities',
    Triggers = 'triggers',
    DecalsFg = 'decalsFg',
    DecalsBg = 'decalsBg',
}

/** Editor viewport state */
export interface Viewport {
    offsetX: number;
    offsetY: number;
    zoom: number;
}

/** Layer state for the editor */
export interface LayerState {
    layer: MapLayer;
    visible: boolean;
    locked: boolean;
    opacity: number;
}

/** Tile palette entry */
export interface TilePaletteEntry {
    char: string;
    label: string;
    color: string;
}

/** Messages passed from extension to webview */
export type ExtensionToWebviewMessage =
    | { type: 'loadMap'; data: CelesteMap }
    | { type: 'updateSettings'; settings: EditorSettings }
    | { type: 'setTool'; tool: EditorTool };

/** Messages passed from webview to extension */
export type WebviewToExtensionMessage =
    | { type: 'mapModified'; data: CelesteMap }
    | { type: 'requestSave' }
    | { type: 'log'; message: string }
    | { type: 'ready' }
    | { type: 'addRoom'; room: Partial<Room> }
    | { type: 'openProceduralGenerator' };

/** Editor settings from VS Code configuration */
export interface EditorSettings {
    gridSize: number;
    showGrid: boolean;
    celestePath: string;
    defaultRoomWidth: number;
    defaultRoomHeight: number;
}

// ─── Default Tile Palette ──────────────────────────────────────────────────────

/** 
 * Standard Celeste tile characters.
 * In the vanilla tileset:
 * - '0' = air/empty
 * - '1'-'9', 'a'-'z' etc. map to tileset entries in ForegroundTiles.xml / BackgroundTiles.xml
 */
export const DEFAULT_TILE_PALETTE: TilePaletteEntry[] = [
    { char: '0', label: 'Air', color: 'transparent' },
    { char: '1', label: 'Dirt', color: '#8B4513' },
    { char: '3', label: 'Snow', color: '#E8E8E8' },
    { char: '4', label: 'Girder', color: '#808080' },
    { char: '5', label: 'Tower', color: '#696969' },
    { char: '6', label: 'Stone', color: '#A0A0A0' },
    { char: '7', label: 'Cement', color: '#B0B0B0' },
    { char: '8', label: 'Rock', color: '#606060' },
    { char: '9', label: 'Wood', color: '#DEB887' },
    { char: 'a', label: 'Wood Stone', color: '#C8B07A' },
    { char: 'b', label: 'Cliffside', color: '#707060' },
    { char: 'c', label: 'Pool Edges', color: '#4080C0' },
    { char: 'd', label: 'Temple A', color: '#A09060' },
    { char: 'e', label: 'Temple B', color: '#908050' },
    { char: 'f', label: 'Cliffside 2', color: '#606050' },
    { char: 'g', label: 'Reflection', color: '#5060A0' },
    { char: 'h', label: 'Summit', color: '#9090A0' },
    { char: 'i', label: 'Core Ice', color: '#A0C0E0' },
    { char: 'j', label: 'Core Fire', color: '#E06030' },
    { char: 'k', label: 'Farewell', color: '#6070A0' },
    { char: 'l', label: 'Moon', color: '#404060' },
];
