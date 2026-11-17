// A small seeded random source (mulberry32) plus helpers, so a ?seed= URL
// always builds the same city. The live game seeds from the clock.

/** A deterministic generator: call it, get a float in [0, 1). */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One element of `items`, chosen uniformly. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

/** A float between min (inclusive) and max (exclusive). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** A whole number between min and max, both inclusive. */
export function int(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}
