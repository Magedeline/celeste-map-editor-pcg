import * as crypto from 'crypto';
import { createEmptyRoom } from './mapParser';
import { PathValidationAnchor, validateRoomPath } from './pathValidation';
import { createPcgRandom, nextFloat, nextInt, pickOne } from './pcg';
import { getTemplatePaletteById, TemplateDefinition, TemplateEntityBlueprint } from './templateRegistry';
import { CelesteMap, ChapterArchetype, Entity, GeneratorMode, PreviewMetadata, PreviewPathValidation, PreviewRoomRole, PreviewValidationSummary, Room, RoomPlatformVariant, RoomShellVariant, TileGrid } from './types';

export type RandomizerMode = 'pseudo' | 'true';
export type RoomLayoutMode = 'grid' | 'criticalPath' | 'criticalPathBranches' | 'openSkeleton';
export type HouseKitId =
    | 'house'
    | 'resort'
    | 'cliffside'
    | 'kirby'
    | 'mario'
    | 'metroidvania'
    | 'labybirth'
    | 'pizzatower'
    | 'arcade';

export interface RoomClusterOptions {
    randomizerMode: RandomizerMode;
    seed?: number;
    generatorMode?: GeneratorMode;
    layoutMode?: RoomLayoutMode;
    archetype?: ChapterArchetype;
    templatePaletteId?: string;
    clusterWidth: number;
    clusterHeight: number;
    roomWidth: number;
    roomHeight: number;
    kitId: HouseKitId;
    roomGap?: number;
}

export interface GeneratedRoomClusterResult {
    map: CelesteMap;
    summary: string;
    seedLabel: string;
}

export interface HouseKitInfo {
    id: HouseKitId;
    label: string;
    description: string;
}

export interface ChapterArchetypeInfo {
    id: ChapterArchetype;
    label: string;
    description: string;
    recommendedLayout: RoomLayoutMode;
}

interface RandomSource {
    nextFloat(): number;
    nextInt(maxExclusive: number): number;
    pickOne<T>(items: readonly T[]): T;
    chance(probability: number): boolean;
    label: string;
}

interface HouseKit {
    id: HouseKitId;
    label: string;
    description: string;
    namePrefix: string;
    wallTile: string;
    backgroundTile: string;
    platformTile: string;
    trimTile: string;
    music: string;
    ambience: string;
}

type RoomRole = PreviewRoomRole;

interface ConnectionFlags {
    hasLeft: boolean;
    hasRight: boolean;
    hasUp: boolean;
    hasDown: boolean;
}

interface RoomPaintProfile {
    shellVariant: RoomShellVariant;
    platformVariant: RoomPlatformVariant;
    textureStride: number;
    textureChance: number;
    supportSpacing: number;
    tallSupports: boolean;
    extraPlatformPasses: number;
}

interface TopologyNode {
    id: number;
    row: number;
    column: number;
    role: RoomRole;
    connections: number[];
}

interface GeneratedTopology {
    nodes: TopologyNode[];
    startId: number;
    goalId: number;
    mainPath: number[];
    layoutLabel: string;
}

interface ChapterArchetypeProfile extends ChapterArchetypeInfo {
    preferredOrientation?: 'horizontal' | 'vertical';
    preferredOuterReverse?: boolean;
    preferredInnerAlternate?: boolean;
}

interface ActiveTemplateAssignment {
    nodeId: number;
    role: RoomRole;
    templateId: string;
    templateLabel: string;
    shellVariant?: RoomShellVariant;
    platformVariant?: RoomPlatformVariant;
    textureChance?: number;
    supportSpacing?: number;
    extraPlatformPasses?: number;
    colorOverride?: number;
    entityBlueprints?: readonly TemplateEntityBlueprint[];
}

type PathValidationByNodeId = Map<number, PreviewPathValidation>;

interface HybridRepairResult {
    repairedNodeIds: number[];
    pathValidationByNodeId: PathValidationByNodeId;
}

const HOUSE_KITS: readonly HouseKit[] = [
    {
        id: 'house',
        label: 'House Kit',
        description: 'Warm wood interiors with framed rooms and loft-like platforms.',
        namePrefix: 'house',
        wallTile: '9',
        backgroundTile: '1',
        platformTile: 'a',
        trimTile: '5',
        music: 'resort',
        ambience: 'event:/env/amb/04_main',
    },
    {
        id: 'resort',
        label: 'Resort Kit',
        description: 'Denser indoor rooms with cement and tower accents.',
        namePrefix: 'resort',
        wallTile: '7',
        backgroundTile: '6',
        platformTile: '4',
        trimTile: '5',
        music: 'resort',
        ambience: 'event:/env/amb/03_resort',
    },
    {
        id: 'cliffside',
        label: 'Cliffside Kit',
        description: 'Rougher support beams and rocky outer shells.',
        namePrefix: 'cliff',
        wallTile: 'b',
        backgroundTile: '8',
        platformTile: '9',
        trimTile: 'f',
        music: 'cliffside',
        ambience: 'event:/env/amb/02_awake',
    },
    {
        id: 'kirby',
        label: 'Kirby Kit',
        description: 'Bright toybox rooms with soft pastel walls and playful trim.',
        namePrefix: 'kirby',
        wallTile: 'c',
        backgroundTile: '3',
        platformTile: 'd',
        trimTile: 'e',
        music: 'lvl1',
        ambience: 'event:/env/amb/01_main',
    },
    {
        id: 'mario',
        label: 'Mario Kit',
        description: 'Chunky platforming rooms with bold brick shells and bright trims.',
        namePrefix: 'mario',
        wallTile: '2',
        backgroundTile: '4',
        platformTile: '6',
        trimTile: '8',
        music: 'oldsite',
        ambience: 'event:/env/amb/01_main',
    },
    {
        id: 'metroidvania',
        label: 'Metroidvania Kit',
        description: 'Moody fortress rooms built around denser stone and exploration beats.',
        namePrefix: 'metro',
        wallTile: 'f',
        backgroundTile: '2',
        platformTile: '7',
        trimTile: 'b',
        music: 'temple',
        ambience: 'event:/env/amb/05_mirror',
    },
    {
        id: 'labybirth',
        label: 'Labybirth Kit',
        description: 'Maze-heavy interiors with older stonework and dusty support beams.',
        namePrefix: 'laby',
        wallTile: '6',
        backgroundTile: '1',
        platformTile: '5',
        trimTile: '9',
        music: 'resort',
        ambience: 'event:/env/amb/03_resort',
    },
    {
        id: 'pizzatower',
        label: 'Pizza Tower Kit',
        description: 'Fast, loud rooms with exaggerated trims and sharp platform contrast.',
        namePrefix: 'pizza',
        wallTile: 'd',
        backgroundTile: '5',
        platformTile: 'a',
        trimTile: 'c',
        music: 'mirror',
        ambience: 'event:/env/amb/02_awake',
    },
    {
        id: 'arcade',
        label: 'Arcade Kit',
        description: 'Neon-styled rooms with high contrast blocks and synthetic trim.',
        namePrefix: 'arcade',
        wallTile: '3',
        backgroundTile: '8',
        platformTile: 'e',
        trimTile: '4',
        music: 'reflection',
        ambience: 'event:/env/amb/05_mirror',
    },
];

const CHAPTER_ARCHETYPES: readonly ChapterArchetypeProfile[] = [
    {
        id: 'linearAscent',
        label: 'Linear Ascent',
        description: 'A steady climb with a strong main route, one checkpoint, and a final ascent push.',
        recommendedLayout: 'criticalPath',
        preferredOrientation: 'vertical',
        preferredOuterReverse: false,
        preferredInnerAlternate: false,
    },
    {
        id: 'longRunDensityBurst',
        label: 'Long Run With Density Burst',
        description: 'A cleaner opening and ending with a denser central knot where pacing spikes.',
        recommendedLayout: 'criticalPathBranches',
        preferredOrientation: 'horizontal',
        preferredOuterReverse: false,
        preferredInnerAlternate: true,
    },
    {
        id: 'spineCompactBranching',
        label: 'Spine With Compact Branching',
        description: 'A visible main route plus short side branches clustered around a compact knot.',
        recommendedLayout: 'criticalPathBranches',
    },
    {
        id: 'landmarkCorridor',
        label: 'Landmark Corridor',
        description: 'A sparse route built around one long corridor or standout set-piece traversal room.',
        recommendedLayout: 'criticalPath',
        preferredOrientation: 'horizontal',
        preferredOuterReverse: false,
        preferredInnerAlternate: false,
    },
    {
        id: 'celesteCategory',
        label: 'Celeste Category',
        description: 'A chapter-shaped Celeste route with a readable intro, berry detours, a checkpoint anchor, and a late summit set-piece.',
        recommendedLayout: 'criticalPathBranches',
        preferredOrientation: 'vertical',
        preferredOuterReverse: false,
        preferredInnerAlternate: true,
    },
    {
        id: 'segmentedSummit',
        label: 'Segmented Summit',
        description: 'A segmented climb with visible phase breaks and stronger late-stage escalation.',
        recommendedLayout: 'criticalPath',
        preferredOrientation: 'vertical',
        preferredOuterReverse: false,
        preferredInnerAlternate: true,
    },
];

export function getAvailableHouseKits(): readonly HouseKitInfo[] {
    return HOUSE_KITS.map(({ id, label, description }) => ({ id, label, description }));
}

export function getAvailableChapterArchetypes(): readonly ChapterArchetypeInfo[] {
    return CHAPTER_ARCHETYPES.map(({ id, label, description, recommendedLayout }) => ({
        id,
        label,
        description,
        recommendedLayout,
    }));
}

export function generateRoomCluster(
    baseMap: CelesteMap,
    options: RoomClusterOptions
): GeneratedRoomClusterResult {
    const houseKit = HOUSE_KITS.find((kit) => kit.id === options.kitId) ?? HOUSE_KITS[0];
    const archetype = resolveChapterArchetype(options.archetype);
    const generatorMode = options.generatorMode ?? 'procedural';
    const random = createRandomSource(options);
    const layoutMode = options.layoutMode ?? archetype.recommendedLayout;
    const roomGap = options.roomGap ?? 16;
    const topology = buildTopology(options, random, layoutMode, archetype);
    const templateAssignments = buildTemplateAssignments(topology, archetype.id, generatorMode, options.templatePaletteId);
    const roomsById = new Map<number, Room>();
    const roomNamesById = new Map<number, string>();

    for (const node of topology.nodes) {
        const roomName = buildGeneratedRoomName(node, topology, archetype);
        const templateAssignment = templateAssignments.get(node.id);
        const room = createEmptyRoom(
            roomName,
            node.column * (options.roomWidth + roomGap),
            node.row * (options.roomHeight + roomGap),
            options.roomWidth,
            options.roomHeight
        );

        room.music = houseKit.music;
        room.ambience = houseKit.ambience;
        room.color = templateAssignment?.colorOverride ?? getRoleColor(node.role, random);

        paintRoom(room, houseKit, random, getConnectionFlags(node, options), node, topology, archetype, templateAssignment);
        roomsById.set(node.id, room);
        roomNamesById.set(node.id, roomName);
    }

    populateEntities(topology, roomsById, options, random, templateAssignments);
    let pathValidationByNodeId = validateGeneratedRooms(topology, roomsById, options);
    let repairedNodeIds: number[] = [];

    if (generatorMode === 'hybrid') {
        const repairResult = repairHybridRooms(topology, roomsById, options, houseKit, pathValidationByNodeId);
        pathValidationByNodeId = repairResult.pathValidationByNodeId;
        repairedNodeIds = repairResult.repairedNodeIds;
    }

    const rooms = topology.nodes
        .slice()
        .sort((left, right) => left.row - right.row || left.column - right.column)
        .map((node) => roomsById.get(node.id))
        .filter((room): room is Room => Boolean(room));

    const map: CelesteMap = {
        ...baseMap,
        rooms,
        fillers: [],
        previewMetadata: buildPreviewMetadata(topology, roomNamesById, layoutMode, archetype.id, generatorMode, options.templatePaletteId, templateAssignments, pathValidationByNodeId),
    };

    const roomCount = topology.nodes.length;
    const randomizerLabel = options.randomizerMode === 'pseudo' ? 'Pseudo Randomizer' : 'True Randomizer';

    return {
        map,
        summary: `Generated ${roomCount} ${houseKit.label} rooms in ${topology.layoutLabel} mode using the ${archetype.label} archetype${buildTemplateSummarySuffix(generatorMode, options.templatePaletteId)} with ${randomizerLabel} (${random.label}). ${buildValidationSummaryLabel(summarizeValidation(pathValidationByNodeId))}${buildRepairSummarySuffix(repairedNodeIds)}`,
        seedLabel: random.label,
    };
}

function buildRepairSummarySuffix(repairedNodeIds: readonly number[]): string {
    if (repairedNodeIds.length === 0) {
        return '';
    }

    return ` Auto-repaired ${repairedNodeIds.length} hybrid room${repairedNodeIds.length === 1 ? '' : 's'} after validation.`;
}

function buildTemplateSummarySuffix(generatorMode: GeneratorMode, templatePaletteId?: string): string {
    if (generatorMode !== 'hybrid') {
        return '';
    }

    const palette = getTemplatePaletteById(templatePaletteId);
    return palette ? ` with the ${palette.label} hybrid palette` : ' in hybrid template mode';
}

function resolveChapterArchetype(archetype?: ChapterArchetype): ChapterArchetypeProfile {
    return CHAPTER_ARCHETYPES.find((entry) => entry.id === archetype) ?? CHAPTER_ARCHETYPES[0];
}

function buildTopology(
    options: RoomClusterOptions,
    random: RandomSource,
    layoutMode: RoomLayoutMode,
    archetype: ChapterArchetypeProfile
): GeneratedTopology {
    switch (layoutMode) {
        case 'criticalPath':
            return buildCriticalPathTopology(options, random, false, archetype);
        case 'criticalPathBranches':
            return buildCriticalPathTopology(options, random, true, archetype);
        case 'openSkeleton':
            return buildOpenSkeletonTopology(options, random, archetype);
        case 'grid':
        default:
            return buildGridTopology(options, random, archetype);
    }
}

function buildGridTopology(options: RoomClusterOptions, random: RandomSource, archetype: ChapterArchetypeProfile): GeneratedTopology {
    const nodes = createTopologyNodes(options);
    for (const node of nodes) {
        for (const neighborId of getOrthogonalNeighborIds(node.id, options)) {
            connectNodes(nodes, node.id, neighborId);
        }
    }

    const mainPath = createSerpentinePath(options, random, archetype);
    assignPathRoles(nodes, mainPath, archetype);

    return {
        nodes: finalizeNodes(nodes),
        startId: mainPath[0],
        goalId: mainPath[mainPath.length - 1],
        mainPath,
        layoutLabel: 'Grid',
    };
}

function buildCriticalPathTopology(
    options: RoomClusterOptions,
    random: RandomSource,
    withBranches: boolean,
    archetype: ChapterArchetypeProfile
): GeneratedTopology {
    const nodes = createTopologyNodes(options);
    const serpentinePath = createSerpentinePath(options, random, archetype);
    const mainPathLength = withBranches
        ? getBranchLayoutMainPathLength(options, serpentinePath.length, archetype)
        : serpentinePath.length;
    const mainPath = serpentinePath.slice(0, mainPathLength);

    for (let index = 0; index < mainPath.length - 1; index++) {
        connectNodes(nodes, mainPath[index], mainPath[index + 1]);
    }

    if (withBranches) {
        const connectedIds = new Set<number>(mainPath);
        for (const nodeId of serpentinePath.slice(mainPathLength)) {
            const candidates = getOrthogonalNeighborIds(nodeId, options)
                .filter((candidateId) => connectedIds.has(candidateId))
                .sort((left, right) => nodeDegree(nodes, left) - nodeDegree(nodes, right));
            const preferred = candidates.find((candidateId) => mainPath.includes(candidateId));
            const targetId = preferred ?? candidates[0] ?? mainPath[random.nextInt(mainPath.length)];
            connectNodes(nodes, nodeId, targetId);
            connectedIds.add(nodeId);
        }
    }

    assignPathRoles(nodes, mainPath, archetype);
    if (withBranches) {
        for (const node of nodes) {
            if (!mainPath.includes(node.id)) {
                node.role = node.connections.size <= 1 ? 'reward' : 'branch';
            }
        }

        assignArchetypeSpecificRoles(nodes, mainPath, archetype);
    }

    return {
        nodes: finalizeNodes(nodes),
        startId: mainPath[0],
        goalId: mainPath[mainPath.length - 1],
        mainPath,
        layoutLabel: withBranches ? 'Critical Path + Branches' : 'Critical Path',
    };
}

function getBranchLayoutMainPathLength(
    options: RoomClusterOptions,
    totalRooms: number,
    archetype: ChapterArchetypeProfile
): number {
    const baseLength = options.clusterWidth + options.clusterHeight + Math.floor(totalRooms * 0.15);
    const archetypeBias = archetype.id === 'longRunDensityBurst'
        ? 1.15
        : archetype.id === 'spineCompactBranching'
            ? 0.9
            : archetype.id === 'landmarkCorridor'
                ? 0.85
                : archetype.id === 'celesteCategory'
                    ? 1.05
                : archetype.id === 'segmentedSummit'
                    ? 1.05
                    : 1;
    const targetLength = Math.round(baseLength * archetypeBias);
    return Math.max(2, Math.min(totalRooms - 1, targetLength));
}

function buildOpenSkeletonTopology(options: RoomClusterOptions, random: RandomSource, archetype: ChapterArchetypeProfile): GeneratedTopology {
    const nodes = createTopologyNodes(options);
    const totalNodes = nodes.length;
    const visited = new Set<number>();
    const frontier: Array<[number, number]> = [];
    const rootId = random.nextInt(totalNodes);
    visited.add(rootId);
    pushFrontierEdges(frontier, rootId, visited, options);

    while (visited.size < totalNodes && frontier.length > 0) {
        const edgeIndex = random.nextInt(frontier.length);
        const [fromId, toId] = frontier.splice(edgeIndex, 1)[0];
        if (visited.has(toId)) {
            continue;
        }

        connectNodes(nodes, fromId, toId);
        visited.add(toId);
        pushFrontierEdges(frontier, toId, visited, options);
    }

    const extraEdges = Math.max(1, Math.floor(totalNodes / 4));
    let addedEdges = 0;
    let attempts = 0;
    while (addedEdges < extraEdges && attempts < totalNodes * 10) {
        attempts += 1;
        const nodeId = random.nextInt(totalNodes);
        const candidates = getOrthogonalNeighborIds(nodeId, options).filter(
            (candidateId) => !nodes[nodeId].connections.has(candidateId)
        );

        if (candidates.length === 0) {
            continue;
        }

        connectNodes(nodes, nodeId, random.pickOne(candidates));
        addedEdges += 1;
    }

    const startId = findFarthestNode(nodes, rootId).id;
    const farthestFromStart = findFarthestNode(nodes, startId);
    const goalId = farthestFromStart.id;
    const mainPath = reconstructPath(farthestFromStart.previous, startId, goalId);
    assignSkeletonRoles(nodes, mainPath, archetype);

    return {
        nodes: finalizeNodes(nodes),
        startId,
        goalId,
        mainPath,
        layoutLabel: 'Open Skeleton',
    };
}

function createTopologyNodes(options: RoomClusterOptions): Array<Omit<TopologyNode, 'connections'> & { connections: Set<number> }> {
    const nodes: Array<Omit<TopologyNode, 'connections'> & { connections: Set<number> }> = [];
    let id = 0;
    for (let row = 0; row < options.clusterHeight; row++) {
        for (let column = 0; column < options.clusterWidth; column++) {
            nodes.push({
                id,
                row,
                column,
                role: 'path',
                connections: new Set<number>(),
            });
            id += 1;
        }
    }
    return nodes;
}

function finalizeNodes(
    nodes: Array<Omit<TopologyNode, 'connections'> & { connections: Set<number> }>
): TopologyNode[] {
    return nodes.map((node) => ({
        ...node,
        connections: Array.from(node.connections).sort((left, right) => left - right),
    }));
}

function createSerpentinePath(options: RoomClusterOptions, random: RandomSource, archetype: ChapterArchetypeProfile): number[] {
    const path: number[] = [];
    const horizontal = archetype.preferredOrientation
        ? archetype.preferredOrientation === 'horizontal'
        : random.chance(0.5);
    const reverseOuter = archetype.preferredOuterReverse ?? random.chance(0.5);
    const reverseInnerStart = archetype.preferredInnerAlternate ?? random.chance(0.5);

    if (horizontal) {
        const rows = range(options.clusterHeight, reverseOuter);
        rows.forEach((row, rowIndex) => {
            const columns = range(options.clusterWidth, reverseInnerStart ? rowIndex % 2 === 0 : rowIndex % 2 === 1);
            columns.forEach((column) => {
                path.push(row * options.clusterWidth + column);
            });
        });
    } else {
        const columns = range(options.clusterWidth, reverseOuter);
        columns.forEach((column, columnIndex) => {
            const rows = range(options.clusterHeight, reverseInnerStart ? columnIndex % 2 === 0 : columnIndex % 2 === 1);
            rows.forEach((row) => {
                path.push(row * options.clusterWidth + column);
            });
        });
    }

    return path;
}

function range(length: number, reversed: boolean): number[] {
    const values = Array.from({ length }, (_, index) => index);
    return reversed ? values.reverse() : values;
}

function getOrthogonalNeighborIds(nodeId: number, options: RoomClusterOptions): number[] {
    const row = Math.floor(nodeId / options.clusterWidth);
    const column = nodeId % options.clusterWidth;
    const neighbors: number[] = [];

    if (column > 0) {
        neighbors.push(nodeId - 1);
    }
    if (column < options.clusterWidth - 1) {
        neighbors.push(nodeId + 1);
    }
    if (row > 0) {
        neighbors.push(nodeId - options.clusterWidth);
    }
    if (row < options.clusterHeight - 1) {
        neighbors.push(nodeId + options.clusterWidth);
    }

    return neighbors;
}

function connectNodes(
    nodes: Array<Omit<TopologyNode, 'connections'> & { connections: Set<number> }>,
    leftId: number,
    rightId: number
): void {
    if (leftId === rightId) {
        return;
    }

    nodes[leftId].connections.add(rightId);
    nodes[rightId].connections.add(leftId);
}

function pushFrontierEdges(
    frontier: Array<[number, number]>,
    nodeId: number,
    visited: Set<number>,
    options: RoomClusterOptions
): void {
    for (const neighborId of getOrthogonalNeighborIds(nodeId, options)) {
        if (!visited.has(neighborId)) {
            frontier.push([nodeId, neighborId]);
        }
    }
}

function findFarthestNode(
    nodes: Array<Omit<TopologyNode, 'connections'> & { connections: Set<number> }>,
    startId: number
): { id: number; previous: Map<number, number | undefined> } {
    const queue: number[] = [startId];
    const distance = new Map<number, number>([[startId, 0]]);
    const previous = new Map<number, number | undefined>([[startId, undefined]]);
    let farthestId = startId;

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (currentId === undefined) {
            continue;
        }

        const currentDistance = distance.get(currentId) ?? 0;
        if (currentDistance > (distance.get(farthestId) ?? 0)) {
            farthestId = currentId;
        }

        for (const neighborId of nodes[currentId].connections) {
            if (distance.has(neighborId)) {
                continue;
            }

            distance.set(neighborId, currentDistance + 1);
            previous.set(neighborId, currentId);
            queue.push(neighborId);
        }
    }

    return { id: farthestId, previous };
}

function reconstructPath(previous: Map<number, number | undefined>, startId: number, goalId: number): number[] {
    const path: number[] = [];
    let currentId: number | undefined = goalId;
    while (currentId !== undefined) {
        path.push(currentId);
        if (currentId === startId) {
            break;
        }
        currentId = previous.get(currentId);
    }
    return path.reverse();
}

function assignPathRoles(
    nodes: Array<Omit<TopologyNode, 'connections'> & { connections: Set<number> }>,
    mainPath: number[],
    archetype: ChapterArchetypeProfile
): void {
    for (const node of nodes) {
        node.role = 'path';
    }

    if (mainPath.length === 0) {
        return;
    }

    nodes[mainPath[0]].role = 'start';
    nodes[mainPath[mainPath.length - 1]].role = 'goal';

    if (mainPath.length >= 4) {
        nodes[mainPath[1]].role = 'intro';
    }

    if (mainPath.length >= 5) {
        nodes[mainPath[Math.floor(mainPath.length / 2)]].role = 'checkpoint';
    }

    assignArchetypeSpecificRoles(nodes, mainPath, archetype);
}

function assignSkeletonRoles(
    nodes: Array<Omit<TopologyNode, 'connections'> & { connections: Set<number> }>,
    mainPath: number[],
    archetype: ChapterArchetypeProfile
): void {
    const mainPathIds = new Set(mainPath);
    for (const node of nodes) {
        if (node.connections.size >= 3) {
            node.role = 'hub';
        } else if (!mainPathIds.has(node.id)) {
            node.role = node.connections.size <= 1 ? 'reward' : 'branch';
        } else {
            node.role = 'path';
        }
    }

    if (mainPath.length > 0) {
        nodes[mainPath[0]].role = 'start';
        nodes[mainPath[mainPath.length - 1]].role = 'goal';
        if (mainPath.length >= 5) {
            nodes[mainPath[Math.floor(mainPath.length / 2)]].role = 'checkpoint';
        }
    }

    assignArchetypeSpecificRoles(nodes, mainPath, archetype);
}

function assignArchetypeSpecificRoles(
    nodes: Array<Omit<TopologyNode, 'connections'> & { connections: Set<number> }>,
    mainPath: number[],
    archetype: ChapterArchetypeProfile
): void {
    if (mainPath.length < 4) {
        return;
    }

    switch (archetype.id) {
        case 'linearAscent':
            if (mainPath.length >= 6) {
                nodes[mainPath[mainPath.length - 2]].role = 'setpiece';
            }
            break;
        case 'longRunDensityBurst': {
            const knotIndex = Math.max(2, Math.floor(mainPath.length / 2) - 1);
            nodes[mainPath[knotIndex]].role = 'knot';
            if (mainPath.length >= 7) {
                nodes[mainPath[Math.min(mainPath.length - 2, knotIndex + 1)]].role = 'setpiece';
            }
            break;
        }
        case 'spineCompactBranching': {
            const hubCandidate = mainPath.find((nodeId) => nodes[nodeId].connections.size >= 3);
            if (hubCandidate !== undefined) {
                nodes[hubCandidate].role = 'hub';
            }
            break;
        }
        case 'landmarkCorridor':
            nodes[mainPath[Math.max(2, Math.floor(mainPath.length * 0.66))]].role = 'setpiece';
            break;
        case 'celesteCategory': {
            const checkpointIndex = Math.floor(mainPath.length / 2);
            let knotIndex = Math.max(2, Math.floor(mainPath.length * 0.38));
            if (knotIndex === checkpointIndex) {
                knotIndex = Math.max(2, checkpointIndex - 1);
            }

            const hubCandidate = mainPath.find(
                (nodeId, index) => index >= 2 && index < mainPath.length - 2 && nodes[nodeId].connections.size >= 3
            );
            const hubIndex = hubCandidate !== undefined ? mainPath.indexOf(hubCandidate) : Math.max(2, Math.floor(mainPath.length * 0.28));
            const setpieceIndex = Math.min(mainPath.length - 2, Math.max(checkpointIndex + 1, Math.floor(mainPath.length * 0.76)));

            nodes[mainPath[hubIndex]].role = 'hub';
            if (mainPath.length >= 7) {
                nodes[mainPath[knotIndex]].role = 'knot';
            }
            if (mainPath.length >= 8) {
                nodes[mainPath[setpieceIndex]].role = 'setpiece';
            }
            break;
        }
        case 'segmentedSummit':
            nodes[mainPath[Math.max(2, Math.floor(mainPath.length * 0.75))]].role = 'setpiece';
            break;
    }
}

function nodeDegree(
    nodes: Array<Omit<TopologyNode, 'connections'> & { connections: Set<number> }>,
    nodeId: number
): number {
    return nodes[nodeId].connections.size;
}

function getRoleColor(role: RoomRole, random: RandomSource): number {
    switch (role) {
        case 'start':
            return 2;
        case 'goal':
            return 7;
        case 'checkpoint':
            return 5;
        case 'hub':
            return 6;
        case 'branch':
            return 1;
        case 'intro':
            return 3;
        case 'reward':
            return 4;
        case 'setpiece':
            return 0;
        case 'knot':
            return 5;
        case 'path':
        default:
            return random.nextInt(8);
    }
}

function getConnectionFlags(node: TopologyNode, options: RoomClusterOptions): ConnectionFlags {
    const neighborSet = new Set<number>(node.connections);
    const leftId = node.column > 0 ? node.id - 1 : undefined;
    const rightId = node.column < options.clusterWidth - 1 ? node.id + 1 : undefined;
    const upId = node.row > 0 ? node.id - options.clusterWidth : undefined;
    const downId = node.row < options.clusterHeight - 1 ? node.id + options.clusterWidth : undefined;

    return {
        hasLeft: leftId !== undefined && neighborSet.has(leftId),
        hasRight: rightId !== undefined && neighborSet.has(rightId),
        hasUp: upId !== undefined && neighborSet.has(upId),
        hasDown: downId !== undefined && neighborSet.has(downId),
    };
}

function populateEntities(
    topology: GeneratedTopology,
    roomsById: Map<number, Room>,
    options: RoomClusterOptions,
    random: RandomSource,
    templateAssignments: Map<number, ActiveTemplateAssignment>
): void {
    const startRoom = roomsById.get(topology.startId);
    if (startRoom) {
        startRoom.entities.push(createEntity(random, 'player', 24, options.roomHeight - 32));
    }

    const goalRoom = roomsById.get(topology.goalId);
    if (goalRoom) {
        goalRoom.entities.push(createEntity(random, 'strawberry', options.roomWidth - 48, 40));
        if (goalRoom.tileWidth > 18) {
            goalRoom.entities.push(createEntity(random, 'spring', options.roomWidth - 72, options.roomHeight - 32));
        }
    }

    for (const node of topology.nodes) {
        const room = roomsById.get(node.id);
        if (!room || node.id === topology.startId || node.id === topology.goalId) {
            continue;
        }

        if (node.role === 'checkpoint') {
            room.entities.push(createEntity(random, 'checkpoint', Math.floor(options.roomWidth / 2), options.roomHeight - 32));
            room.entities.push(createEntity(random, 'refill', Math.floor(options.roomWidth / 2), Math.max(40, Math.floor(options.roomHeight * 0.34))));
        } else if (node.role === 'intro') {
            room.entities.push(createEntity(random, 'spring', Math.floor(options.roomWidth * 0.28), options.roomHeight - 32));
        } else if (node.role === 'reward' && random.chance(0.8)) {
            room.entities.push(createEntity(random, 'strawberry', Math.floor(options.roomWidth / 2), 40));
            room.entities.push(createEntity(random, 'refill', Math.floor(options.roomWidth / 2), Math.max(56, Math.floor(options.roomHeight * 0.42))));
        } else if (node.role === 'branch' && random.chance(0.2)) {
            room.entities.push(createEntity(random, 'strawberry', Math.floor(options.roomWidth / 2), 40));
            room.entities.push(createEntity(random, 'spring', Math.floor(options.roomWidth * 0.72), options.roomHeight - 32));
        } else if (node.role === 'hub' && random.chance(0.75)) {
            room.entities.push(createEntity(random, 'spring', Math.floor(options.roomWidth / 2), options.roomHeight - 32));
            room.entities.push(createEntity(random, 'refill', Math.floor(options.roomWidth / 2), Math.max(48, Math.floor(options.roomHeight * 0.36))));
        } else if (node.role === 'setpiece' && random.chance(0.7)) {
            room.entities.push(createEntity(random, 'spring', Math.floor(options.roomWidth / 2), options.roomHeight - 32));
            room.entities.push(createEntity(random, 'spikesDown', Math.floor(options.roomWidth / 2) - 20, 24, { width: 40, height: 8 }));
        } else if (node.role === 'knot' && random.chance(0.7)) {
            room.entities.push(createEntity(random, 'refill', Math.floor(options.roomWidth / 2), Math.max(48, Math.floor(options.roomHeight * 0.38))));
            room.entities.push(createEntity(random, 'spikesRight', 12, Math.floor(options.roomHeight / 2) - 16, { width: 8, height: 32 }));
            room.entities.push(createEntity(random, 'spikesLeft', options.roomWidth - 20, Math.floor(options.roomHeight / 2) - 16, { width: 8, height: 32 }));
        }

        addTemplateEntities(room, options, random, templateAssignments.get(node.id));
    }
}

function addTemplateEntities(
    room: Room,
    options: RoomClusterOptions,
    random: RandomSource,
    templateAssignment?: ActiveTemplateAssignment
): void {
    if (!templateAssignment?.entityBlueprints) {
        return;
    }

    for (const blueprint of templateAssignment.entityBlueprints) {
        if (blueprint.chance !== undefined && !random.chance(blueprint.chance)) {
            continue;
        }

        room.entities.push(
            createEntity(
                random,
                blueprint.name,
                Math.floor(options.roomWidth * blueprint.xRatio),
                Math.floor(options.roomHeight * blueprint.yRatio),
                blueprint.width !== undefined || blueprint.height !== undefined
                    ? { width: blueprint.width, height: blueprint.height }
                    : undefined
            )
        );
    }
}

function buildGeneratedRoomName(
    node: TopologyNode,
    topology: GeneratedTopology,
    archetype: ChapterArchetypeProfile
): string {
    const pathIndex = topology.mainPath.indexOf(node.id);
    const suffix = pathIndex >= 0 ? String(pathIndex).padStart(2, '0') : `${node.row}_${node.column}`;
    return `${archetype.id}_${node.role}_${suffix}`;
}

function buildPreviewMetadata(
    topology: GeneratedTopology,
    roomNamesById: Map<number, string>,
    layoutMode: RoomLayoutMode,
    archetype: ChapterArchetype,
    generatorMode: GeneratorMode,
    templatePaletteId: string | undefined,
    templateAssignments: Map<number, ActiveTemplateAssignment>,
    pathValidationByNodeId: PathValidationByNodeId
): PreviewMetadata {
    return {
        layoutMode,
        archetype,
        generatorMode,
        templatePaletteId,
        validationSummary: summarizeValidation(pathValidationByNodeId),
        templateAssignments: Array.from(templateAssignments.values())
            .sort((left, right) => left.nodeId - right.nodeId)
            .map((assignment) => ({
                nodeId: assignment.nodeId,
                role: assignment.role,
                templateId: assignment.templateId,
            })),
        startNodeId: topology.startId,
        goalNodeId: topology.goalId,
        mainPathNodeIds: topology.mainPath,
        nodes: topology.nodes.map((node) => ({
            id: node.id,
            roomName: roomNamesById.get(node.id) ?? `room_${node.id}`,
            row: node.row,
            column: node.column,
            role: node.role,
            connections: node.connections,
            phase: describeNodePhase(node, topology),
            segment: getNodeSegment(node, topology),
            validation: pathValidationByNodeId.get(node.id),
        })),
    };
}

function validateGeneratedRooms(
    topology: GeneratedTopology,
    roomsById: Map<number, Room>,
    options: RoomClusterOptions
): PathValidationByNodeId {
    const validation = new Map<number, PreviewPathValidation>();
    for (const node of topology.nodes) {
        const room = roomsById.get(node.id);
        if (!room) {
            continue;
        }

        validation.set(node.id, validateRoomPath(room, {
            role: node.role,
            anchors: buildValidationAnchors(node, topology, options),
        }));
    }

    return validation;
}

function buildValidationAnchors(
    node: TopologyNode,
    topology: GeneratedTopology,
    options: RoomClusterOptions
): PathValidationAnchor[] {
    const mainPathIndex = topology.mainPath.indexOf(node.id);
    const focus = getRoleFocusAnchor(node.role, options);
    const anchors: PathValidationAnchor[] = [];

    if (node.id === topology.startId) {
        anchors.push({ x: Math.floor(options.roomWidth * 0.16), y: options.roomHeight - 32 });
        const nextId = topology.mainPath[1];
        if (nextId !== undefined) {
            anchors.push(getConnectionAnchor(node, nextId, options));
        }
        return anchors;
    }

    if (node.id === topology.goalId) {
        const previousId = topology.mainPath[Math.max(0, topology.mainPath.length - 2)];
        if (previousId !== undefined && previousId !== node.id) {
            anchors.push(getConnectionAnchor(node, previousId, options));
        }
        anchors.push({ x: Math.floor(options.roomWidth * 0.64), y: Math.floor(options.roomHeight * 0.22) });
        return anchors;
    }

    if (mainPathIndex >= 0) {
        const previousId = topology.mainPath[mainPathIndex - 1];
        const nextId = topology.mainPath[mainPathIndex + 1];
        if (previousId !== undefined) {
            anchors.push(getConnectionAnchor(node, previousId, options));
        }
        anchors.push(focus);
        if (nextId !== undefined) {
            anchors.push(getConnectionAnchor(node, nextId, options));
        }
        return anchors;
    }

    const sortedConnections = node.connections.slice().sort((left, right) => left - right);
    if (sortedConnections[0] !== undefined) {
        anchors.push(getConnectionAnchor(node, sortedConnections[0], options));
    }
    anchors.push(focus);
    if (sortedConnections[1] !== undefined) {
        anchors.push(getConnectionAnchor(node, sortedConnections[1], options));
    }

    return anchors;
}

function getRoleFocusAnchor(role: RoomRole, options: RoomClusterOptions): PathValidationAnchor {
    switch (role) {
        case 'intro':
        case 'start':
            return { x: Math.floor(options.roomWidth * 0.28), y: Math.floor(options.roomHeight * 0.72) };
        case 'checkpoint':
        case 'hub':
            return { x: Math.floor(options.roomWidth * 0.5), y: Math.floor(options.roomHeight * 0.54) };
        case 'reward':
            return { x: Math.floor(options.roomWidth * 0.5), y: Math.floor(options.roomHeight * 0.28) };
        case 'branch':
            return { x: Math.floor(options.roomWidth * 0.72), y: Math.floor(options.roomHeight * 0.38) };
        case 'setpiece':
            return { x: Math.floor(options.roomWidth * 0.56), y: Math.floor(options.roomHeight * 0.34) };
        case 'knot':
            return { x: Math.floor(options.roomWidth * 0.5), y: Math.floor(options.roomHeight * 0.46) };
        case 'goal':
            return { x: Math.floor(options.roomWidth * 0.64), y: Math.floor(options.roomHeight * 0.22) };
        case 'path':
        default:
            return { x: Math.floor(options.roomWidth * 0.5), y: Math.floor(options.roomHeight * 0.48) };
    }
}

function getConnectionAnchor(node: TopologyNode, neighborId: number, options: RoomClusterOptions): PathValidationAnchor {
    if (neighborId === node.id - 1) {
        return { x: 12, y: Math.floor(options.roomHeight * 0.66) };
    }
    if (neighborId === node.id + 1) {
        return { x: options.roomWidth - 12, y: Math.floor(options.roomHeight * 0.66) };
    }
    if (neighborId < node.id) {
        return { x: Math.floor(options.roomWidth * 0.5), y: 12 };
    }
    return { x: Math.floor(options.roomWidth * 0.5), y: options.roomHeight - 16 };
}

function summarizeValidation(pathValidationByNodeId: PathValidationByNodeId): PreviewValidationSummary {
    let likelyViable = 0;
    let uncertain = 0;
    let unstable = 0;

    for (const validation of pathValidationByNodeId.values()) {
        if (validation.status === 'likelyViable') {
            likelyViable += 1;
        } else if (validation.status === 'uncertain') {
            uncertain += 1;
        } else {
            unstable += 1;
        }
    }

    return {
        overallStatus: unstable > 0 ? 'unstable' : uncertain > 0 ? 'uncertain' : 'likelyViable',
        likelyViable,
        uncertain,
        unstable,
    };
}

function repairHybridRooms(
    topology: GeneratedTopology,
    roomsById: Map<number, Room>,
    options: RoomClusterOptions,
    houseKit: HouseKit,
    initialValidationByNodeId: PathValidationByNodeId
): HybridRepairResult {
    let pathValidationByNodeId = initialValidationByNodeId;
    const repairedNodeIds = new Set<number>();

    for (let pass = 0; pass < 2; pass++) {
        const unstableNodes = topology.nodes.filter((node) => pathValidationByNodeId.get(node.id)?.status === 'unstable');
        if (unstableNodes.length === 0) {
            break;
        }

        let changed = false;
        for (const node of unstableNodes) {
            const room = roomsById.get(node.id);
            const validation = pathValidationByNodeId.get(node.id);
            if (!room || !validation) {
                continue;
            }

            if (reinforceRoomTraversal(room, validation, houseKit.platformTile, houseKit.trimTile, options)) {
                repairedNodeIds.add(node.id);
                changed = true;
            }
        }

        if (!changed) {
            break;
        }

        pathValidationByNodeId = validateGeneratedRooms(topology, roomsById, options);
    }

    return {
        repairedNodeIds: Array.from(repairedNodeIds).sort((left, right) => left - right),
        pathValidationByNodeId,
    };
}

function reinforceRoomTraversal(
    room: Room,
    validation: PreviewPathValidation,
    platformTile: string,
    trimTile: string,
    options: RoomClusterOptions
): boolean {
    const grid = room.tilesFg;
    if (!grid) {
        return false;
    }

    const route = validation.sampledRoute && validation.sampledRoute.length > 0
        ? validation.sampledRoute
        : validation.anchors;
    if (!route || route.length === 0) {
        return false;
    }

    let changed = false;
    const sampleStride = Math.max(1, Math.floor(route.length / 5));

    for (let index = 0; index < route.length; index += sampleStride) {
        const point = route[index];
        const centerTileX = clampTile(Math.floor(point.x / 8), 3, grid.width - 4);
        const platformTileY = clampTile(Math.floor((point.y + Math.max(16, options.roomHeight * 0.08)) / 8), 3, grid.height - 4);
        const platformWidth = index === 0 || index >= route.length - sampleStride ? 7 : 5;
        const platformX = clampTile(centerTileX - Math.floor(platformWidth / 2), 1, grid.width - platformWidth - 1);
        const clearanceHeight = platformTileY > 5 ? 3 : 2;

        clearRect(grid, platformX, Math.max(1, platformTileY - clearanceHeight), platformWidth, clearanceHeight);
        fillRect(grid, platformX, platformTileY, platformWidth, 1, platformTile);
        if (platformWidth >= 5) {
            setTile(grid, platformX, platformTileY, trimTile);
            setTile(grid, platformX + platformWidth - 1, platformTileY, trimTile);
        }
        changed = true;
    }

    return changed;
}

function clampTile(value: number, min: number, max: number): number {
    if (min > max) {
        return min;
    }

    return Math.max(min, Math.min(max, value));
}

function buildValidationSummaryLabel(summary: PreviewValidationSummary): string {
    return `Validation: ${summary.likelyViable} likely viable, ${summary.uncertain} uncertain, ${summary.unstable} unstable.`;
}

function describeNodePhase(node: TopologyNode, topology: GeneratedTopology): string {
    const pathIndex = topology.mainPath.indexOf(node.id);
    if (pathIndex === -1) {
        return node.role === 'reward' ? 'reward' : 'branch';
    }

    if (pathIndex === 0) {
        return 'intro';
    }
    if (pathIndex === topology.mainPath.length - 1) {
        return 'finale';
    }
    if (pathIndex <= Math.floor(topology.mainPath.length / 3)) {
        return 'build';
    }
    if (pathIndex >= Math.floor(topology.mainPath.length * 0.66)) {
        return 'escalation';
    }
    return 'checkpoint';
}

function getNodeSegment(node: TopologyNode, topology: GeneratedTopology): number {
    const pathIndex = topology.mainPath.indexOf(node.id);
    if (pathIndex < 0 || topology.mainPath.length <= 1) {
        return 0;
    }
    return Math.min(2, Math.floor((pathIndex / Math.max(1, topology.mainPath.length - 1)) * 3));
}

function createRandomSource(options: RoomClusterOptions): RandomSource {
    if (options.randomizerMode === 'pseudo') {
        const seed = normalizeSeed(options.seed ?? Date.now());
        const rng = createPcgRandom({ seedLo32: seed });
        return {
            nextFloat: () => nextFloat(rng),
            nextInt: (maxExclusive) => nextInt(rng, maxExclusive),
            pickOne: <T>(items: readonly T[]) => pickOne(rng, items),
            chance: (probability) => nextFloat(rng) < probability,
            label: `seed=${seed}`,
        };
    }

    const trueSeed = crypto.randomBytes(8).toString('hex');
    return {
        nextFloat: () => crypto.randomInt(0, 1_000_000) / 1_000_000,
        nextInt: (maxExclusive) => {
            if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
                throw new Error('maxExclusive must be a positive integer');
            }
            return crypto.randomInt(0, maxExclusive);
        },
        pickOne: <T>(items: readonly T[]) => {
            if (items.length === 0) {
                throw new Error('items must not be empty');
            }
            return items[crypto.randomInt(0, items.length)];
        },
        chance: (probability) => crypto.randomInt(0, 1_000_000) / 1_000_000 < probability,
        label: `crypto=${trueSeed}`,
    };
}

function normalizeSeed(seed: number): number {
    const numericSeed = Number(seed);
    if (!Number.isFinite(numericSeed)) {
        return 0;
    }
    return Math.abs(Math.trunc(numericSeed)) >>> 0;
}

function paintRoom(
    room: Room,
    houseKit: HouseKit,
    random: RandomSource,
    connections: ConnectionFlags,
    node: TopologyNode,
    topology: GeneratedTopology,
    archetype: ChapterArchetypeProfile,
    templateAssignment?: ActiveTemplateAssignment
): void {
    const foreground = requireGrid(room.tilesFg);
    const background = requireGrid(room.tilesBg);
    const profile = buildRoomPaintProfile(node, topology, archetype, templateAssignment);

    fill(background, houseKit.backgroundTile);
    addBackgroundTexture(background, houseKit, random, profile);
    paintShell(foreground, houseKit, random, profile);
    carveConnections(foreground, connections);
    addPlatforms(foreground, houseKit, random, connections, profile);
    addRoleFeatures(foreground, background, houseKit, node.role);
    addSupports(background, houseKit, random, profile);
}

function buildRoomPaintProfile(
    node: TopologyNode,
    topology: GeneratedTopology,
    archetype: ChapterArchetypeProfile,
    templateAssignment?: ActiveTemplateAssignment
): RoomPaintProfile {
    const phase = describeNodePhase(node, topology);
    const profile: RoomPaintProfile = {
        shellVariant: 'default',
        platformVariant: 'scattered',
        textureStride: 5,
        textureChance: 0.22,
        supportSpacing: 6,
        tallSupports: false,
        extraPlatformPasses: 0,
    };

    switch (archetype.id) {
        case 'linearAscent':
            profile.shellVariant = 'stairwell';
            profile.platformVariant = 'ascending';
            profile.textureStride = 6;
            profile.supportSpacing = 7;
            break;
        case 'longRunDensityBurst':
            profile.shellVariant = phase === 'checkpoint' || node.role === 'knot' ? 'arena' : 'loft';
            profile.platformVariant = phase === 'checkpoint' || node.role === 'knot' ? 'arena' : 'scattered';
            profile.textureChance = 0.28;
            profile.extraPlatformPasses = 1;
            break;
        case 'spineCompactBranching':
            profile.shellVariant = 'perch';
            profile.platformVariant = 'flanks';
            profile.supportSpacing = 8;
            break;
        case 'landmarkCorridor':
            profile.shellVariant = 'corridor';
            profile.platformVariant = 'corridor';
            profile.textureStride = 7;
            profile.supportSpacing = 9;
            break;
        case 'celesteCategory':
            profile.shellVariant = phase === 'escalation' || phase === 'finale' ? 'stairwell' : 'loft';
            profile.platformVariant = phase === 'build' ? 'flanks' : 'ascending';
            profile.textureChance = 0.24;
            profile.supportSpacing = 7;
            profile.extraPlatformPasses = 1;
            break;
        case 'segmentedSummit':
            profile.shellVariant = phase === 'escalation' || phase === 'finale' ? 'stairwell' : 'loft';
            profile.platformVariant = 'ascending';
            profile.textureChance = 0.26;
            profile.tallSupports = true;
            break;
    }

    switch (node.role) {
        case 'start':
        case 'intro':
            profile.shellVariant = 'loft';
            profile.platformVariant = 'ascending';
            break;
        case 'checkpoint':
        case 'hub':
            profile.shellVariant = 'arena';
            profile.platformVariant = 'arena';
            profile.tallSupports = true;
            break;
        case 'branch':
            profile.shellVariant = 'perch';
            profile.platformVariant = 'branchPerch';
            break;
        case 'reward':
            profile.shellVariant = 'perch';
            profile.platformVariant = 'branchPerch';
            profile.textureChance = 0.16;
            break;
        case 'setpiece':
            profile.shellVariant = 'corridor';
            profile.platformVariant = 'corridor';
            profile.extraPlatformPasses = Math.max(profile.extraPlatformPasses, 1);
            break;
        case 'knot':
            profile.shellVariant = 'arena';
            profile.platformVariant = 'flanks';
            profile.extraPlatformPasses = 1;
            break;
        case 'goal':
            profile.shellVariant = 'stairwell';
            profile.platformVariant = 'ascending';
            profile.tallSupports = true;
            break;
    }

    if (templateAssignment) {
        profile.shellVariant = templateAssignment.shellVariant ?? profile.shellVariant;
        profile.platformVariant = templateAssignment.platformVariant ?? profile.platformVariant;
        profile.textureChance = templateAssignment.textureChance ?? profile.textureChance;
        profile.supportSpacing = templateAssignment.supportSpacing ?? profile.supportSpacing;
        profile.extraPlatformPasses = templateAssignment.extraPlatformPasses ?? profile.extraPlatformPasses;
    }

    return profile;
}

function buildTemplateAssignments(
    topology: GeneratedTopology,
    archetype: ChapterArchetype,
    generatorMode: GeneratorMode,
    templatePaletteId?: string
): Map<number, ActiveTemplateAssignment> {
    if (generatorMode !== 'hybrid' || archetype !== 'celesteCategory') {
        return new Map<number, ActiveTemplateAssignment>();
    }

    const palette = getTemplatePaletteById(templatePaletteId);
    if (!palette || !palette.supportedArchetypes.includes(archetype)) {
        return new Map<number, ActiveTemplateAssignment>();
    }

    const assignments = new Map<number, ActiveTemplateAssignment>();
    for (const node of topology.nodes) {
        const phase = describeNodePhase(node, topology);
        const directMatch = palette.templates.find((template) =>
            template.targetRoles.includes(node.role)
            && (!template.preferredPhases || template.preferredPhases.includes(phase))
        );
        const fallbackMatch = directMatch ?? palette.templates.find((template) => template.targetRoles.includes(node.role));
        if (!fallbackMatch) {
            continue;
        }

        assignments.set(node.id, createTemplateAssignment(node, fallbackMatch));
    }

    return assignments;
}

function createTemplateAssignment(node: TopologyNode, template: TemplateDefinition): ActiveTemplateAssignment {
    return {
        nodeId: node.id,
        role: node.role,
        templateId: template.id,
        templateLabel: template.label,
        shellVariant: template.shellVariant,
        platformVariant: template.platformVariant,
        textureChance: template.textureChance,
        supportSpacing: template.supportSpacing,
        extraPlatformPasses: template.extraPlatformPasses,
        colorOverride: template.colorOverride,
        entityBlueprints: template.entityBlueprints,
    };
}

function requireGrid(grid: TileGrid | null): TileGrid {
    if (!grid) {
        throw new Error('Expected tile grid to be initialized');
    }
    return grid;
}

function fill(grid: TileGrid, tile: string): void {
    grid.tiles.fill(tile);
}

function addBackgroundTexture(grid: TileGrid, houseKit: HouseKit, random: RandomSource, profile: RoomPaintProfile): void {
    for (let y = 1; y < grid.height - 1; y++) {
        for (let x = 1; x < grid.width - 1; x++) {
            if ((x + y) % profile.textureStride === 0 && random.chance(profile.textureChance)) {
                setTile(grid, x, y, houseKit.trimTile);
            }
        }
    }
}

function paintShell(grid: TileGrid, houseKit: HouseKit, random: RandomSource, profile: RoomPaintProfile): void {
    fill(grid, '0');

    fillRect(grid, 0, 0, grid.width, 1, houseKit.trimTile);
    fillRect(grid, 0, grid.height - 2, grid.width, 2, houseKit.wallTile);
    fillRect(grid, 0, 0, 1, grid.height, houseKit.wallTile);
    fillRect(grid, grid.width - 1, 0, 1, grid.height, houseKit.wallTile);

    switch (profile.shellVariant) {
        case 'loft': {
            const loftWidth = Math.max(6, Math.floor(grid.width * 0.38));
            const loftX = Math.max(2, Math.floor((grid.width - loftWidth) * 0.5));
            const loftY = 3 + random.nextInt(Math.max(1, Math.floor(grid.height / 4)));
            fillRect(grid, loftX, loftY, loftWidth, 1, houseKit.platformTile);
            break;
        }
        case 'stairwell': {
            const stepWidth = Math.max(4, Math.floor(grid.width / 5));
            for (let step = 0; step < 3; step++) {
                const width = Math.max(4, stepWidth - step);
                const x = 2 + step * Math.max(3, Math.floor((grid.width - stepWidth - 4) / 3));
                const y = grid.height - 6 - step * 3;
                fillRect(grid, x, y, Math.min(width, grid.width - x - 2), 1, houseKit.platformTile);
            }
            break;
        }
        case 'corridor': {
            const corridorY = Math.max(4, Math.floor(grid.height * 0.45));
            fillRect(grid, 2, corridorY, grid.width - 4, 1, houseKit.platformTile);
            clearRect(grid, Math.max(3, Math.floor(grid.width / 2) - 3), corridorY, 6, 1);
            break;
        }
        case 'perch': {
            fillRect(grid, 3, Math.max(4, Math.floor(grid.height * 0.35)), Math.max(4, Math.floor(grid.width / 4)), 1, houseKit.platformTile);
            fillRect(grid, grid.width - 3 - Math.max(4, Math.floor(grid.width / 4)), Math.max(6, Math.floor(grid.height * 0.55)), Math.max(4, Math.floor(grid.width / 4)), 1, houseKit.platformTile);
            break;
        }
        case 'arena': {
            const middleY = Math.max(5, Math.floor(grid.height * 0.5));
            fillRect(grid, 3, middleY, Math.max(6, Math.floor(grid.width / 3)), 1, houseKit.platformTile);
            fillRect(grid, grid.width - 3 - Math.max(6, Math.floor(grid.width / 3)), middleY, Math.max(6, Math.floor(grid.width / 3)), 1, houseKit.platformTile);
            break;
        }
    }

    if (grid.width > 16) {
        const inset = 3 + random.nextInt(3);
        fillRect(grid, inset, grid.height - 6, grid.width - inset * 2, 1, houseKit.platformTile);
    }

    if (profile.shellVariant === 'default' && random.chance(0.55)) {
        const loftWidth = Math.max(6, Math.floor(grid.width / 3));
        const loftX = 2 + random.nextInt(Math.max(1, grid.width - loftWidth - 4));
        const loftY = 4 + random.nextInt(Math.max(1, Math.floor(grid.height / 3)));
        fillRect(grid, loftX, loftY, loftWidth, 1, houseKit.platformTile);
    }
}

function carveConnections(
    grid: TileGrid,
    connections: ConnectionFlags
): void {
    const midY = Math.floor(grid.height * 0.65);
    const sideDoorHeight = 4;
    const topDoorWidth = 4;

    if (connections.hasLeft) {
        clearRect(grid, 0, midY - sideDoorHeight, 1, sideDoorHeight);
    }
    if (connections.hasRight) {
        clearRect(grid, grid.width - 1, midY - sideDoorHeight, 1, sideDoorHeight);
    }
    if (connections.hasUp) {
        clearRect(grid, Math.floor(grid.width / 2) - 2, 0, topDoorWidth, 1);
        clearRect(grid, Math.floor(grid.width / 2) - 1, 1, 2, 2);
    }
    if (connections.hasDown) {
        clearRect(grid, Math.floor(grid.width / 2) - 2, grid.height - 2, topDoorWidth, 2);
    }

    if (grid.width > 14) {
        clearRect(grid, 2, grid.height - 4, 3, 2);
        clearRect(grid, grid.width - 5, grid.height - 4, 3, 2);
    }
}

function addRoleFeatures(grid: TileGrid, background: TileGrid, houseKit: HouseKit, role: RoomRole): void {
    const centerX = Math.floor(grid.width / 2) - 2;
    if (role === 'checkpoint') {
        fillRect(grid, centerX, grid.height - 8, 5, 1, houseKit.platformTile);
        clearRect(grid, centerX + 1, grid.height - 9, 3, 1);
    } else if (role === 'start' || role === 'intro') {
        fillRect(grid, 2, grid.height - 9, 6, 1, houseKit.trimTile);
    } else if (role === 'hub') {
        fillRect(grid, 3, Math.floor(grid.height / 2), 4, 1, houseKit.platformTile);
        fillRect(grid, grid.width - 7, Math.floor(grid.height / 2) - 2, 4, 1, houseKit.platformTile);
    } else if (role === 'branch') {
        fillRect(grid, grid.width - 7, 5, 4, 1, houseKit.trimTile);
    } else if (role === 'reward') {
        fillRect(grid, centerX, 5, 5, 1, houseKit.trimTile);
        fillRect(background, centerX + 1, 3, 3, 1, houseKit.trimTile);
    } else if (role === 'setpiece') {
        fillRect(grid, centerX - 3, Math.floor(grid.height / 2), 11, 1, houseKit.trimTile);
        fillRect(grid, centerX - 1, Math.floor(grid.height / 2) - 3, 7, 1, houseKit.platformTile);
    } else if (role === 'knot') {
        fillRect(grid, centerX - 2, Math.floor(grid.height / 2) - 3, 9, 1, houseKit.platformTile);
        fillRect(grid, centerX - 3, Math.floor(grid.height / 2) + 2, 11, 1, houseKit.trimTile);
    } else if (role === 'goal') {
        fillRect(grid, centerX, 4, 5, 1, houseKit.trimTile);
    }
}

function addPlatforms(
    grid: TileGrid,
    houseKit: HouseKit,
    random: RandomSource,
    connections: ConnectionFlags,
    profile: RoomPaintProfile
): void {
    const passes = 1 + profile.extraPlatformPasses;
    for (let pass = 0; pass < passes; pass++) {
        switch (profile.platformVariant) {
            case 'ascending':
                for (let step = 0; step < 2; step++) {
                    const width = Math.max(4, Math.floor(grid.width / 5));
                    const x = 3 + step * Math.max(4, Math.floor((grid.width - width - 6) / 2));
                    const y = Math.max(4, grid.height - 11 - step * 3 - pass);
                    fillRect(grid, x, y, Math.min(width, grid.width - x - 2), 1, houseKit.platformTile);
                }
                break;
            case 'flanks': {
                const y = Math.max(5, Math.floor(grid.height * 0.42) + pass * 2);
                const width = Math.max(4, Math.floor(grid.width / 4));
                fillRect(grid, 2, y, width, 1, houseKit.platformTile);
                fillRect(grid, grid.width - width - 2, y + 1, width, 1, houseKit.platformTile);
                break;
            }
            case 'branchPerch': {
                const width = Math.max(4, Math.floor(grid.width / 4));
                const rightBiased = connections.hasLeft || !connections.hasRight;
                const x = rightBiased ? grid.width - width - 3 : 3;
                const y = Math.max(4, Math.floor(grid.height * 0.34)) + pass * 2;
                fillRect(grid, x, y, width, 1, houseKit.platformTile);
                fillRect(grid, Math.max(3, Math.floor(grid.width / 2) - 2), y + 4, 4, 1, houseKit.trimTile);
                break;
            }
            case 'corridor': {
                const y = Math.max(5, Math.floor(grid.height * 0.35) + pass * 3);
                fillRect(grid, 3, y, Math.max(6, Math.floor(grid.width / 3)), 1, houseKit.platformTile);
                fillRect(grid, grid.width - 3 - Math.max(6, Math.floor(grid.width / 3)), y + 2, Math.max(6, Math.floor(grid.width / 3)), 1, houseKit.platformTile);
                break;
            }
            case 'arena': {
                const width = Math.max(4, Math.floor(grid.width / 5));
                const y = Math.max(5, Math.floor(grid.height * 0.3) + pass * 3);
                fillRect(grid, Math.max(2, Math.floor(grid.width / 2) - width - 1), y, width, 1, houseKit.platformTile);
                fillRect(grid, Math.min(grid.width - width - 2, Math.floor(grid.width / 2) + 1), y, width, 1, houseKit.platformTile);
                break;
            }
            case 'scattered':
            default: {
                const platformCount = 1 + random.nextInt(3);
                for (let index = 0; index < platformCount; index++) {
                    const width = 4 + random.nextInt(Math.max(2, Math.floor(grid.width / 4)));
                    const x = 2 + random.nextInt(Math.max(1, grid.width - width - 4));
                    const y = 5 + random.nextInt(Math.max(1, grid.height - 11));
                    fillRect(grid, x, y, width, 1, houseKit.platformTile);

                    if (random.chance(0.4)) {
                        setTile(grid, x, y - 1, houseKit.trimTile);
                        setTile(grid, x + width - 1, y - 1, houseKit.trimTile);
                    }
                }
                break;
            }
        }
    }
}

function addSupports(grid: TileGrid, houseKit: HouseKit, random: RandomSource, profile: RoomPaintProfile): void {
    for (let x = 3; x < grid.width - 3; x += profile.supportSpacing) {
        if (random.chance(0.65)) {
            fillRect(grid, x, profile.tallSupports ? 1 : 2, 1, grid.height - (profile.tallSupports ? 2 : 4), houseKit.trimTile);
        }
    }
}

function fillRect(grid: TileGrid, x: number, y: number, width: number, height: number, tile: string): void {
    for (let offsetY = 0; offsetY < height; offsetY++) {
        for (let offsetX = 0; offsetX < width; offsetX++) {
            setTile(grid, x + offsetX, y + offsetY, tile);
        }
    }
}

function clearRect(grid: TileGrid, x: number, y: number, width: number, height: number): void {
    fillRect(grid, x, y, width, height, '0');
}

function setTile(grid: TileGrid, x: number, y: number, tile: string): void {
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
        return;
    }
    grid.tiles[y * grid.width + x] = tile;
}

function createEntity(
    random: RandomSource,
    name: string,
    x: number,
    y: number,
    options?: Partial<Pick<Entity, 'width' | 'height' | 'attributes' | 'nodes'>>
): Entity {
    return {
        name,
        id: random.nextInt(999_999) + 1,
        x,
        y,
        width: options?.width ?? 8,
        height: options?.height ?? 8,
        nodes: options?.nodes ?? [],
        attributes: options?.attributes ?? {},
    };
}