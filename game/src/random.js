// Small deterministic RNG + math helpers so the city looks the same every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function int(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Pick one entry by weight: entries look like { value, weight } or
// { name, weight, ... }. Heavier entries are more likely; a weight of 0
// never wins. Falls back to a uniform pick when the weights add to 0.
export function weightedPick(rng, entries) {
  let total = 0;
  for (const e of entries) total += Math.max(0, e.weight || 0);
  if (total <= 0) return pick(rng, entries);
  let roll = rng() * total;
  for (const e of entries) {
    roll -= Math.max(0, e.weight || 0);
    if (roll <= 0) return e;
  }
  return entries[entries.length - 1];
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function turnToward(angle, target, maxStep) {
  let d = target - angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (d > maxStep) d = maxStep;
  else if (d < -maxStep) d = -maxStep;
  return angle + d;
}
