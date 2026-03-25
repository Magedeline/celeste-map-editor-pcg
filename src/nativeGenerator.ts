import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { generateRoomCluster, GeneratedRoomClusterResult, RoomClusterOptions } from './proceduralGeneration';
import { CelesteMap, PreviewMetadata, Room, TileGrid } from './types';

const execFileAsync = promisify(execFile);
const EXECUTABLE_NAME = process.platform === 'win32' ? 'celeste_pcg_generator.exe' : 'celeste_pcg_generator';

interface NativeGeneratorResponse {
    rooms: unknown[];
    summary: string;
    seedLabel: string;
    previewMetadata?: PreviewMetadata;
}

export async function generateRoomClusterWithNativeFallback(
    extensionRoot: string,
    baseMap: CelesteMap,
    options: RoomClusterOptions
): Promise<GeneratedRoomClusterResult> {
    if ((options.generatorMode ?? 'procedural') !== 'procedural') {
        const fallback = generateRoomCluster(baseMap, options);
        return {
            ...fallback,
            summary: `${fallback.summary} TS generator active because hybrid and graph-authored modes are not supported by the native C++ generator yet.`,
        };
    }

    const executablePath = findNativeGeneratorExecutable(extensionRoot);
    if (!executablePath) {
        const fallback = generateRoomCluster(baseMap, options);
        return {
            ...fallback,
            summary: `${fallback.summary} TS fallback active because the native C++ generator is not built yet.`,
        };
    }

    try {
        const response = await runNativeGenerator(executablePath, options);
        return {
            map: {
                ...baseMap,
                rooms: normalizeNativeRooms(response.rooms),
                fillers: [],
                previewMetadata: response.previewMetadata,
            },
            summary: `${response.summary} Native C++ generator: ${path.basename(executablePath)}.`,
            seedLabel: response.seedLabel,
        };
    } catch (error) {
        const fallback = generateRoomCluster(baseMap, options);
        const reason = error instanceof Error ? error.message : 'unknown native generator error';
        return {
            ...fallback,
            summary: `${fallback.summary} TS fallback active because the native C++ generator failed: ${reason}.`,
        };
    }
}

function findNativeGeneratorExecutable(extensionRoot: string): string | undefined {
    const candidates = [
        path.join(extensionRoot, 'cpp', 'build', 'Release', EXECUTABLE_NAME),
        path.join(extensionRoot, 'cpp', 'build', 'Debug', EXECUTABLE_NAME),
        path.join(extensionRoot, 'cpp', 'build', EXECUTABLE_NAME),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate));
}

async function runNativeGenerator(
    executablePath: string,
    options: RoomClusterOptions
): Promise<NativeGeneratorResponse> {
    const args = [
        '--mode', options.randomizerMode,
        '--layout', options.layoutMode ?? 'grid',
        '--archetype', options.archetype ?? 'linearAscent',
        '--cluster-width', String(options.clusterWidth),
        '--cluster-height', String(options.clusterHeight),
        '--room-width', String(options.roomWidth),
        '--room-height', String(options.roomHeight),
        '--kit', options.kitId,
        '--room-gap', String(options.roomGap ?? 16),
    ];

    if (options.seed !== undefined) {
        args.push('--seed', String(options.seed));
    }

    const { stdout, stderr } = await execFileAsync(executablePath, args, {
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
    });

    if (stderr.trim().length > 0) {
        throw new Error(stderr.trim());
    }

    const parsed = JSON.parse(stdout) as Partial<NativeGeneratorResponse>;
    if (!Array.isArray(parsed.rooms) || typeof parsed.summary !== 'string' || typeof parsed.seedLabel !== 'string') {
        throw new Error('native generator returned an invalid response payload');
    }

    return parsed as NativeGeneratorResponse;
}

function normalizeNativeRooms(rawRooms: unknown[]): Room[] {
    return rawRooms.map((rawRoom) => {
        const room = rawRoom as Room & {
            tilesFg?: TileGrid & { tiles: string[] };
            tilesBg?: TileGrid & { tiles: string[] };
        };

        return {
            ...room,
            tilesFg: normalizeGrid(room.tilesFg),
            tilesBg: normalizeGrid(room.tilesBg),
        };
    });
}

function normalizeGrid(grid: TileGrid | null | undefined): TileGrid | null {
    if (!grid) {
        return null;
    }

    if (grid.tiles.length === grid.width * grid.height) {
        return grid;
    }

    const flattened: string[] = [];
    for (const row of grid.tiles) {
        for (const character of row) {
            flattened.push(character);
        }
    }

    return {
        width: grid.width,
        height: grid.height,
        tiles: flattened,
    };
}