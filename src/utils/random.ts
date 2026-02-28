/**
 * Seeded pseudo-random number generator using the mulberry32 algorithm.
 * Provides deterministic randomness for reproducible game simulations.
 */

export interface RNG {
  /** Returns a float in [0, 1). */
  next(): number;
  /** Returns an integer in [min, max] (inclusive). */
  nextInt(min: number, max: number): number;
  /** Returns true with the given probability (0.0 to 1.0). */
  chance(probability: number): boolean;
}

/**
 * Creates a seeded PRNG using the mulberry32 algorithm.
 * Same seed always produces the same sequence.
 */
export function createRNG(seed: number): RNG {
  let state = seed | 0;

  function mulberry32(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next(): number {
      return mulberry32();
    },

    nextInt(min: number, max: number): number {
      const range = max - min + 1;
      return Math.floor(mulberry32() * range) + min;
    },

    chance(probability: number): boolean {
      return mulberry32() < probability;
    },
  };
}
