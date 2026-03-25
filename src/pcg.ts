import PcgRandom = require('pcg-random');

export type PcgState = [number, number, number, number];

export interface PcgSeed {
    seedLo32: number;
    seedHi32?: number;
    incLo32?: number;
    incHi32?: number;
}

export function createPcgRandom(seed?: PcgSeed): PcgRandom {
    if (!seed) {
        return new PcgRandom();
    }

    if (seed.incLo32 !== undefined && seed.incHi32 !== undefined) {
        return new PcgRandom(
            seed.seedLo32,
            seed.seedHi32 ?? 0,
            seed.incLo32,
            seed.incHi32
        );
    }

    return new PcgRandom(seed.seedLo32, seed.seedHi32 ?? 0);
}

export function createPcgRandomFromState(state: PcgState): PcgRandom {
    return new PcgRandom(state);
}

export function nextFloat(rng: PcgRandom): number {
    return rng.number();
}

export function nextInt(rng: PcgRandom, maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new Error('maxExclusive must be a positive integer');
    }

    return rng.integer(maxExclusive);
}

export function pickOne<T>(rng: PcgRandom, items: readonly T[]): T {
    if (items.length === 0) {
        throw new Error('items must not be empty');
    }

    return items[nextInt(rng, items.length)];
}

export function clonePcgState(rng: PcgRandom): PcgState {
    return rng.getState();
}