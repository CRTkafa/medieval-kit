/**
 * Deterministic randomness.
 *
 * A procedural kit needs variation — perfect symmetry reads as "generated".
 * But the variation has to be repeatable: the same seed must always give the
 * same model, otherwise neither previews, nor tests, nor art direction hold
 * up. That is why Math.random() is not used.
 *
 * mulberry32: 32-bit state, fast, not cryptographic but far more than enough
 * for visual variation.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Symmetric deviation in the range -amount .. +amount. */
export function jitter(random: () => number, amount: number): number {
  return (random() * 2 - 1) * amount
}
