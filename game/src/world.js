// Velvet Bay city generation: road grid, building blocks, parks, parked cars,
// traffic, pedestrians. Everything comes from the seeded RNG in config.
import { ROADS_V, ROADS_H, ROAD_W, WORLD_W, WORLD_H, PALETTE } from './config.js';
import { range, int, pick } from './random.js';

export function createWorld(rng) {
  const buildings = [];
  const parks = [];

  for (let i = 0; i < ROADS_V.length - 1; i++) {
    for (let j = 0; j < ROADS_H.length - 1; j++) {
      const x0 = ROADS_V[i] + ROAD_W / 2 + 16;
      const x1 = ROADS_V[i + 1] - ROAD_W / 2 - 16;
      const y0 = ROADS_H[j] + ROAD_W / 2 + 16;
      const y1 = ROADS_H[j + 1] - ROAD_W / 2 - 16;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      if (rng() < 0.15) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      const cols = x1 - x0 > 260 ? 2 : 1;
      const rows = y1 - y0 > 240 ? 2 : 1;
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const bw = cw - 20;
          const bh = ch - 20;
          if (bw < 50 || bh < 50) continue;
          buildings.push({
            x: x0 + c * cw + 10,
            y: y0 + r * ch + 10,
            w: bw,
            h: bh,
            shade: 0.85 + rng() * 0.3,
            windows: int(rng, 2, 4),
          });
        }
      }
    }
  }

  // Parked cars sit along the road edges, ready to be borrowed.
  const parkedCars = [];
  for (let k = 0; k < 26; k++) {
    const vertical = rng() < 0.5;
    let x, y, angle;
    if (vertical) {
      const road = pick(rng, ROADS_V);
      x = road + (rng() < 0.5 ? -ROAD_W / 2 + 16 : ROAD_W / 2 - 16);
      y = range(rng, 120, WORLD_H - 120);
      angle = rng() < 0.5 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      const road = pick(rng, ROADS_H);
      y = road + (rng() < 0.5 ? -ROAD_W / 2 + 16 : ROAD_W / 2 - 16);
      x = range(rng, 120, WORLD_W - 120);
      angle = rng() < 0.5 ? 0 : Math.PI;
    }
    // Keep the spawn corner clear so the player starts on open road.
    if (Math.hypot(x - 600, y - 520) < 170) continue;
    parkedCars.push({ x, y, angle, color: pick(rng, PALETTE.carColors), parked: true, id: k });
  }

  // The gold Comet GT for mission 3 — parked on 14th, south of the 1160 road.
  const targetCar = {
    x: 1450,
    y: 1210,
    angle: Math.PI / 2,
    color: '#f5c518',
    parked: true,
    gold: true,
    id: 'gold',
  };

  const traffic = [];
  for (let k = 0; k < 22; k++) {
    const vertical = rng() < 0.5;
    if (vertical) {
      traffic.push({
        vertical: true,
        road: pick(rng, ROADS_V),
        pos: range(rng, 0, WORLD_H),
        dir: rng() < 0.5 ? 1 : -1,
        lane: (rng() < 0.5 ? -1 : 1) * 22,
        speed: range(rng, 95, 165),
        color: pick(rng, PALETTE.carColors),
      });
    } else {
      traffic.push({
        vertical: false,
        road: pick(rng, ROADS_H),
        pos: range(rng, 0, WORLD_W),
        dir: rng() < 0.5 ? 1 : -1,
        lane: (rng() < 0.5 ? -1 : 1) * 22,
        speed: range(rng, 95, 165),
        color: pick(rng, PALETTE.carColors),
      });
    }
  }

  const peds = [];
  for (let k = 0; k < 26; k++) {
    const vertical = rng() < 0.5;
    let x, y;
    if (vertical) {
      const road = pick(rng, ROADS_V);
      x = road + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
      y = range(rng, 100, WORLD_H - 100);
    } else {
      const road = pick(rng, ROADS_H);
      y = road + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
      x = range(rng, 100, WORLD_W - 100);
    }
    peds.push({
      x,
      y,
      tx: x,
      ty: y,
      speed: range(rng, 38, 68),
      down: 0,
      flee: 0,
      color: pick(rng, ['#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#e67e22', '#9b59b6']),
    });
  }

  return {
    buildings,
    parks,
    parkedCars,
    targetCar,
    traffic,
    peds,
    pickups: [],
    policeCars: [],
    footCops: [],
  };
}

export function circleHitsBuildings(buildings, x, y, r) {
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

export function trafficPos(t) {
  if (t.vertical) {
    return { x: t.road + t.lane, y: t.pos, angle: t.dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
  }
  return { x: t.pos, y: t.road + t.lane, angle: t.dir > 0 ? 0 : Math.PI };
}
