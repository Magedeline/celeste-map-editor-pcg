declare module 'pcg-random' {
    type PcgState = [number, number, number, number];

    class PcgRandom {
        constructor();
        constructor(seedLo32: number, seedHi32?: number);
        constructor(seedLo32: number, seedHi32: number, incLo32: number, incHi32: number);
        constructor(seed: bigint, inc?: bigint);
        constructor(state: PcgState);

        setSeed(): void;
        setSeed(seedLo32: number, seedHi32?: number): void;
        setSeed(seedLo32: number, seedHi32: number, incLo32: number, incHi32: number): void;
        setSeed(seed: bigint, inc?: bigint): void;
        setSeed(state: PcgState): void;

        getState(): PcgState;
        setState(state: PcgState): void;
        integer(max?: number): number;
        number(): number;
        next32(): number;
    }

    export = PcgRandom;
}