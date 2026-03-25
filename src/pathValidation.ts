import { PreviewPathValidation, PreviewRoomRole, PreviewViabilityStatus, Room } from './types';

export interface PathValidationAnchor {
    x: number;
    y: number;
}

export interface RoomPathValidationContext {
    role: PreviewRoomRole;
    anchors: PathValidationAnchor[];
}

const SAMPLE_STEP = 8;
const SUPPORT_RADIUS = 16;
const MAX_SUPPORT_DISTANCE = 96;
const MAX_DISTANCE_PENALTY = 128;

export function validateRoomPath(room: Room, context: RoomPathValidationContext): PreviewPathValidation {
    const samples = sampleRoute(context.anchors);
    if (!room.tilesFg || samples.length === 0) {
        return {
            status: 'uncertain',
            meanSupportDistance: MAX_DISTANCE_PENALTY,
            supportDistanceVariance: 0,
            unsupportedFraction: 1,
            sampledPoints: samples.length,
            anchors: context.anchors,
            sampledRoute: samples,
        };
    }

    const distances = samples.map((sample) => measureSupportDistance(room, sample.x, sample.y));
    const meanSupportDistance = average(distances);
    const supportDistanceVariance = average(distances.map((distance) => {
        const delta = distance - meanSupportDistance;
        return delta * delta;
    }));
    const unsupportedFraction = distances.filter((distance) => distance >= MAX_SUPPORT_DISTANCE).length / distances.length;

    return {
        status: classifyStatus(meanSupportDistance, supportDistanceVariance, unsupportedFraction, context.role),
        meanSupportDistance: roundMetric(meanSupportDistance),
        supportDistanceVariance: roundMetric(supportDistanceVariance),
        unsupportedFraction: roundMetric(unsupportedFraction),
        sampledPoints: samples.length,
        anchors: context.anchors,
        sampledRoute: samples.map((sample) => ({ x: roundMetric(sample.x), y: roundMetric(sample.y) })),
    };
}

function sampleRoute(anchors: PathValidationAnchor[]): PathValidationAnchor[] {
    const uniqueAnchors = anchors.filter((anchor, index) => index === 0 || !samePoint(anchor, anchors[index - 1]));
    if (uniqueAnchors.length === 0) {
        return [];
    }
    if (uniqueAnchors.length === 1) {
        return uniqueAnchors;
    }

    const samples: PathValidationAnchor[] = [uniqueAnchors[0]];
    for (let index = 0; index < uniqueAnchors.length - 1; index++) {
        const start = uniqueAnchors[index];
        const end = uniqueAnchors[index + 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const steps = Math.max(1, Math.ceil(length / SAMPLE_STEP));

        for (let step = 1; step <= steps; step++) {
            const t = step / steps;
            samples.push({
                x: start.x + dx * t,
                y: start.y + dy * t,
            });
        }
    }

    return samples;
}

function samePoint(left: PathValidationAnchor, right: PathValidationAnchor): boolean {
    return left.x === right.x && left.y === right.y;
}

function measureSupportDistance(room: Room, x: number, y: number): number {
    if (!room.tilesFg) {
        return MAX_DISTANCE_PENALTY;
    }

    let bestDistance = Number.POSITIVE_INFINITY;
    for (let offsetX = -SUPPORT_RADIUS; offsetX <= SUPPORT_RADIUS; offsetX += SAMPLE_STEP) {
        const worldX = clamp(x + offsetX, 0, room.width - 1);
        const tileX = clamp(Math.floor(worldX / 8), 0, room.tilesFg.width - 1);
        const startTileY = clamp(Math.floor(y / 8), 0, room.tilesFg.height - 1);

        for (let tileY = startTileY; tileY < room.tilesFg.height; tileY++) {
            if (!isSupportTile(room, tileX, tileY)) {
                continue;
            }

            const supportY = tileY * 8;
            const verticalDistance = Math.max(0, supportY - y);
            bestDistance = Math.min(bestDistance, Math.hypot(offsetX, verticalDistance));
            break;
        }
    }

    return Number.isFinite(bestDistance) ? Math.min(bestDistance, MAX_DISTANCE_PENALTY) : MAX_DISTANCE_PENALTY;
}

function isSupportTile(room: Room, tileX: number, tileY: number): boolean {
    const tile = room.tilesFg?.tiles[tileY * room.tilesFg.width + tileX];
    if (tile && tile !== '0') {
        return true;
    }

    const tileWorldX = tileX * 8;
    const tileWorldY = tileY * 8;
    return room.entities.some((entity) => entity.name.toLowerCase().includes('jumpthru')
        && tileWorldX < entity.x + entity.width
        && tileWorldX + 8 > entity.x
        && tileWorldY < entity.y + entity.height
        && tileWorldY + 8 > entity.y);
}

function classifyStatus(
    meanSupportDistance: number,
    supportDistanceVariance: number,
    unsupportedFraction: number,
    role: PreviewRoomRole
): PreviewViabilityStatus {
    const roleSlack = role === 'reward' || role === 'branch' ? 8 : 0;
    const likelyMean = 28 + roleSlack;
    const likelyVariance = 260 + roleSlack * 12;
    const uncertainMean = 48 + roleSlack;
    const uncertainVariance = 720 + roleSlack * 18;

    if (meanSupportDistance <= likelyMean && supportDistanceVariance <= likelyVariance && unsupportedFraction <= 0.12) {
        return 'likelyViable';
    }

    if (meanSupportDistance <= uncertainMean && supportDistanceVariance <= uncertainVariance && unsupportedFraction <= 0.3) {
        return 'uncertain';
    }

    return 'unstable';
}

function average(values: number[]): number {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function roundMetric(value: number): number {
    return Math.round(value * 100) / 100;
}
