import { ChapterArchetype, PreviewRoomRole, RoomPlatformVariant, RoomShellVariant } from './types';

export interface TemplateEntityBlueprint {
    name: string;
    xRatio: number;
    yRatio: number;
    width?: number;
    height?: number;
    chance?: number;
}

export interface TemplateDefinition {
    id: string;
    label: string;
    description: string;
    targetRoles: readonly PreviewRoomRole[];
    preferredPhases?: readonly string[];
    shellVariant?: RoomShellVariant;
    platformVariant?: RoomPlatformVariant;
    textureChance?: number;
    supportSpacing?: number;
    extraPlatformPasses?: number;
    colorOverride?: number;
    entityBlueprints?: readonly TemplateEntityBlueprint[];
}

export interface TemplatePaletteInfo {
    id: string;
    label: string;
    description: string;
    supportedArchetypes: readonly ChapterArchetype[];
}

export interface TemplatePalette extends TemplatePaletteInfo {
    templates: readonly TemplateDefinition[];
}

const TEMPLATE_PALETTES: readonly TemplatePalette[] = [
    {
        id: 'celesteCategorySummit',
        label: 'Celeste Category Summit',
        description: 'Curated intro, berry, checkpoint, and summit templates for Celeste Category chapters.',
        supportedArchetypes: ['celesteCategory'],
        templates: [
            {
                id: 'introClimb',
                label: 'Intro Climb',
                description: 'Lofted opening beats with a clear upward ramp and a readable warm-up.',
                targetRoles: ['start', 'intro'],
                preferredPhases: ['intro', 'build'],
                shellVariant: 'loft',
                platformVariant: 'ascending',
                textureChance: 0.18,
                supportSpacing: 8,
                colorOverride: 3,
            },
            {
                id: 'berryDetour',
                label: 'Berry Detour',
                description: 'Off-route perch rooms that reward detours with collectibles and a refill reset.',
                targetRoles: ['branch', 'reward'],
                preferredPhases: ['branch', 'reward', 'build'],
                shellVariant: 'perch',
                platformVariant: 'branchPerch',
                textureChance: 0.14,
                supportSpacing: 9,
                colorOverride: 4,
                entityBlueprints: [
                    { name: 'strawberry', xRatio: 0.5, yRatio: 0.2, chance: 0.9 },
                    { name: 'refill', xRatio: 0.5, yRatio: 0.44, chance: 0.65 },
                ],
            },
            {
                id: 'checkpointAnchor',
                label: 'Checkpoint Anchor',
                description: 'Breather rooms with a centered anchor and stable arena geometry before the second half.',
                targetRoles: ['checkpoint', 'hub'],
                preferredPhases: ['checkpoint'],
                shellVariant: 'arena',
                platformVariant: 'arena',
                textureChance: 0.2,
                supportSpacing: 8,
                extraPlatformPasses: 1,
                colorOverride: 5,
            },
            {
                id: 'summitPush',
                label: 'Summit Push',
                description: 'Late gauntlet rooms with stronger vertical motion and tighter summit pressure.',
                targetRoles: ['knot', 'setpiece', 'goal'],
                preferredPhases: ['escalation', 'finale'],
                shellVariant: 'stairwell',
                platformVariant: 'ascending',
                textureChance: 0.27,
                supportSpacing: 6,
                extraPlatformPasses: 1,
                colorOverride: 7,
                entityBlueprints: [
                    { name: 'refill', xRatio: 0.5, yRatio: 0.34, chance: 0.5 },
                    { name: 'spikesDown', xRatio: 0.5, yRatio: 0.13, width: 40, height: 8, chance: 0.55 },
                ],
            },
        ],
    },
];

export function getAvailableTemplatePalettes(archetype?: ChapterArchetype): readonly TemplatePaletteInfo[] {
    return TEMPLATE_PALETTES
        .filter((palette) => !archetype || palette.supportedArchetypes.includes(archetype))
        .map(({ id, label, description, supportedArchetypes }) => ({
            id,
            label,
            description,
            supportedArchetypes,
        }));
}

export function getTemplatePaletteById(id?: string): TemplatePalette | undefined {
    return TEMPLATE_PALETTES.find((palette) => palette.id === id);
}
