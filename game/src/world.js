// The game's rules and state, with no drawing and no browser in it: the city
// (roads, buildings, parks, docks), the player on foot or in a car, traffic,
// pedestrians, police, the wanted level, cash pickups and the 4-mission story.
// step() advances one fixed step and returns what happened as bit flags, so
// the caller can react (sound, save, screens) without the world knowing
// about screens. Nothing here allocates after createWorld returns.
import {
  CAR, CASH_PICKUPS, PARKED, PEDS, PLAYER, POLICE, ROADS_X, ROADS_Y,
  ROAD_W, TRAFFIC, WANTED, WATER_Y, WORLD,
} from './config.js';
import { int, pick, range } from './random.js';

export const EVENT_PICKUP = 1;
export const EVENT_PUNCH = 2;
export const EVENT_CRASH = 4;
export const EVENT_MISSION = 8;
export const EVENT_BUSTED = 16;
export const EVENT_COMPLETE = 32;
export const EVENT_CRIME = 64;

export const MISSIONS = [
  {
    title: 'The Pickup',
    text: 'Go to the docks and collect the package. Press E at the marker.',
    target: { x: 1500, y: 2220, label: 'Docks — the package' },
    reward: 200, timer: 0,
  },
  {
    title: 'The Drop',
    text: 'Deliver the package uptown before the timer runs out. Press E at the marker.',
    target: { x: 300, y: 300, label: 'Uptown drop-off' },
    reward: 350, timer: 90,
  },
  {
    title: 'Hot Wheels',
    text: 'Steal any parked car, then bring it to Sunset Garage.',
    target: { x: 1900, y: 1100, label: 'Sunset Garage' },
    reward: 400, timer: 0,
  },
  {
    title: 'Lose the Heat',
    text: 'The cops are on you. Lose the wanted level — stay out of sight.',
    target: null,
    reward: 500, timer: 0,
  },
];

const CAR_COLORS = ['#d94f3d', '#3d7ad9', '#e8b93c', '#7a4fd9', '#3dd9a7', '#d9d9d9', '#2b2b33', '#e87ab0'];
const PED_COLORS = ['#e8e8e8', '#4f7ad9', '#d94f8a', '#7ad94f', '#e8a94f', '#8a5a3b', '#5a3bd9'];
const PIER = { x: 1440, y: 2080, w: 120, h: 200 };

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + clamp(d, -t, t);
}

/** Circle vs rectangle: push the circle out, return true when they overlapped. */
function resolveCircleRect(p, r, rect) {
  const cx = clamp(p.x, rect.x, rect.x + rect.w);
  const cy = clamp(p.y, rect.y, rect.y + rect.h);
  let dx = p.x - cx;
  let dy = p.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * r;
    p.y = cy + (dy / d) * r;
  } else {
    // Centre inside the rectangle: push out along the smallest penetration.
    const left = p.x - rect.x;
    const right = rect.x + rect.w - p.x;
    const top = p.y - rect.y;
    const bottom = rect.y + rect.h - p.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = rect.x - r;
    else if (m === right) p.x = rect.x + rect.w + r;
    else if (m === top) p.y = rect.y - r;
    else p.y = rect.y + rect.h + r;
  }
  return true;
}

function nearestIndex(list, v) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < list.length; i += 1) {
    const d = Math.abs(list[i] - v);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export function createWorld(random) {
  // ---- city generation (seeded, so ?seed= reproduces the same city) ----
  const buildings = [];
  const trees = [];
  const parks = [];

  function xIntervals() {
    const out = [];
    let start = 0;
    for (const c of ROADS_X) {
      out.push([start, c - ROAD_W / 2]);
      start = c + ROAD_W / 2;
    }
    out.push([start, WORLD.width]);
    return out;
  }
  function yIntervals() {
    const out = [];
    let start = 0;
    for (const c of ROADS_Y) {
      out.push([start, c - ROAD_W / 2]);
      start = c + ROAD_W / 2;
    }
    out.push([start, WATER_Y]);
    return out;
  }

  for (const [x0, x1] of xIntervals()) {
    for (const [y0, y1] of yIntervals()) {
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 60 || h < 60) continue;
      const isDockRow = y0 >= 1970;
      if (random() < (isDockRow ? 0.45 : 0.28)) {
        parks.push({ x: x0, y: y0, w, h });
        const n = int(random, 5, 11);
        for (let i = 0; i < n; i += 1) {
          trees.push({ x: range(random, x0 + 14, x1 - 14), y: range(random, y0 + 14, y1 - 14), r: range(random, 9, 15) });
        }
        continue;
      }
      // One or two buildings per block.
      const split = w > 200 && h > 140 && random() < 0.6;
      if (split) {
        const vertical = random() < 0.5;
        if (vertical) {
          const cut = x0 + w * range(random, 0.42, 0.58);
          buildings.push({ x: x0 + 14, y: y0 + 14, w: cut - x0 - 28, h: h - 28, color: pick(random, ['#7a5c46', '#5d6b7a', '#6b4a5e', '#4a6b5d', '#715f3a', '#54496b']), seed: random() });
          buildings.push({ x: cut + 14, y: y0 + 14, w: x1 - cut - 28, h: h - 28, color: pick(random, ['#7a5c46', '#5d6b7a', '#6b4a5e', '#4a6b5d', '#715f3a', '#54496b']), seed: random() });
        } else {
          const cut = y0 + h * range(random, 0.42, 0.58);
          buildings.push({ x: x0 + 14, y: y0 + 14, w: w - 28, h: cut - y0 - 28, color: pick(random, ['#7a5c46', '#5d6b7a', '#6b4a5e', '#4a6b5d', '#715f3a', '#54496b']), seed: random() });
          buildings.push({ x: x0 + 14, y: cut + 14, w: w - 28, h: y1 - cut - 28, color: pick(random, ['#7a5c46', '#5d6b7a', '#6b4a5e', '#4a6b5d', '#715f3a', '#54496b']), seed: random() });
        }
      } else {
        buildings.push({ x: x0 + 14, y: y0 + 14, w: w - 28, h: h - 28, color: pick(random, ['#7a5c46', '#5d6b7a', '#6b4a5e', '#4a6b5d', '#715f3a', '#54496b']), seed: random() });
      }
    }
  }

  const cars = [];
  const peds = [];
  const policeCars = [];
  const cops = [];
  const pickups = [];
  const player = { x: 1500, y: 1500, angle: -Math.PI / 2, hp: PLAYER.hp, car: null, punchCooldown: 0, hurtTimer: 99, speed: 0 };

  const state = {
    player, cars, peds, policeCars, cops, pickups, buildings, trees, parks,
    cash: 0, wanted: 0, timeSinceCrime: 99, decayAccum: 0, bustTimer: 0,
    missionIndex: 0, missionTimer: 0, missionStolen: false,
    missionTarget: null, hasSave: false,
    storyComplete: false, busted: false, bustReason: '',
    elapsed: 0, toast: '', toastUntil: 0,
  };

  function updateMissionTarget() {
    const mission = state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
    state.missionTarget = mission && mission.target
      ? { title: mission.title, text: mission.text, x: mission.target.x, y: mission.target.y, label: mission.target.label }
      : mission ? { title: mission.title, text: mission.text, x: null, y: null, label: '' } : null;
  }

  function isWater(x, y) {
    if (y < WATER_Y) return false;
    return !(x > PIER.x && x < PIER.x + PIER.w && y > PIER.y && y < PIER.y + PIER.h);
  }

  function blockedByBuilding(p, r) {
    let hit = false;
    for (let i = 0; i < buildings.length; i += 1) {
      if (resolveCircleRect(p, r, buildings[i])) hit = true;
    }
    return hit;
  }

  function randomRoadSpot() {
    // A random point on a random road, away from intersections.
    if (random() < 0.5) {
      const ry = pick(random, ROADS_Y);
      const x = range(random, 160, WORLD.width - 160);
      return { x, y: ry + (random() < 0.5 ? 35 : -35) };
    }
    const rx = pick(random, ROADS_X);
    const y = range(random, 160, WATER_Y - 160);
    return { x: rx + (random() < 0.5 ? 35 : -35), y };
  }

  function spawnTrafficCar() {
    const axis = random() < 0.5 ? 'x' : 'y';
    const dir = random() < 0.5 ? 1 : -1;
    let roadIndex;
    let pos;
    if (axis === 'x') {
      roadIndex = int(random, 0, ROADS_Y.length - 1);
      pos = range(random, 200, WORLD.width - 200);
    } else {
      roadIndex = int(random, 0, ROADS_X.length - 1);
      pos = range(random, 200, WATER_Y - 200);
    }
    return {
      kind: 'traffic', axis, dir, roadIndex, pos,
      lane: axis === 'x' ? (dir > 0 ? 35 : -35) : (dir > 0 ? -35 : 35),
      speed: range(random, TRAFFIC.speedMin, TRAFFIC.speedMax),
      color: pick(random, CAR_COLORS), x: 0, y: 0, angle: 0, hp: CAR.hp,
    };
  }

  function placeTrafficCar(car) {
    if (car.axis === 'x') {
      car.x = car.pos;
      car.y = ROADS_Y[car.roadIndex] + car.lane;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    } else {
      car.x = ROADS_X[car.roadIndex] + car.lane;
      car.y = car.pos;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  function spawnParkedCar() {
    const axis = random() < 0.5 ? 'x' : 'y';
    const side = random() < 0.5 ? 1 : -1;
    let x;
    let y;
    let angle;
    if (axis === 'x') {
      const ry = pick(random, ROADS_Y);
      x = range(random, 220, WORLD.width - 220);
      y = ry + side * (ROAD_W / 2 - 22);
      angle = side > 0 ? 0 : Math.PI;
    } else {
      const rx = pick(random, ROADS_X);
      x = rx + side * (ROAD_W / 2 - 22);
      y = range(random, 220, WATER_Y - 220);
      angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    return { kind: 'parked', x, y, angle, speed: 0, color: pick(random, CAR_COLORS), hp: CAR.hp };
  }

  function spawnPed() {
    const axis = random() < 0.5 ? 'x' : 'y';
    const dir = random() < 0.5 ? 1 : -1;
    const side = random() < 0.5 ? 1 : -1;
    let x;
    let y;
    if (axis === 'x') {
      const ry = pick(random, ROADS_Y);
      x = range(random, 120, WORLD.width - 120);
      y = ry + side * (ROAD_W / 2 + 16);
    } else {
      const rx = pick(random, ROADS_X);
      x = rx + side * (ROAD_W / 2 + 16);
      y = range(random, 120, WATER_Y - 120);
    }
    return {
      x, y, axis, dir, side,
      angle: axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: range(random, PEDS.speedMin, PEDS.speedMax),
      color: pick(random, PED_COLORS), down: 0, flee: 0, stagger: 0,
    };
  }

  function spawnPickup(x, y) {
    pickups.push({ x, y, amount: 25, active: true });
  }

  function reset() {
    cars.length = 0;
    peds.length = 0;
    policeCars.length = 0;
    cops.length = 0;
    pickups.length = 0;
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      const car = spawnTrafficCar();
      placeTrafficCar(car);
      cars.push(car);
    }
    for (let i = 0; i < PARKED.count; i += 1) cars.push(spawnParkedCar());
    for (let i = 0; i < PEDS.count; i += 1) peds.push(spawnPed());
    for (let i = 0; i < CASH_PICKUPS; i += 1) {
      const spot = randomRoadSpot();
      spawnPickup(spot.x + range(random, -30, 30), spot.y + range(random, -30, 30));
    }
    player.x = 1500;
    player.y = 1500;
    player.angle = -Math.PI / 2;
    player.hp = PLAYER.hp;
    player.car = null;
    player.punchCooldown = 0;
    player.hurtTimer = 99;
    player.speed = 0;
    state.cash = 0;
    state.wanted = 0;
    state.timeSinceCrime = 99;
    state.decayAccum = 0;
    state.bustTimer = 0;
    state.missionIndex = 0;
    state.missionTimer = 0;
    state.missionStolen = false;
    state.storyComplete = false;
    state.busted = false;
    state.bustReason = '';
    state.elapsed = 0;
    state.toast = '';
    state.toastUntil = 0;
    updateMissionTarget();
  }

  function addWanted(n) {
    state.wanted = Math.min(WANTED.max, state.wanted + n);
    state.timeSinceCrime = 0;
    state.decayAccum = 0;
    return EVENT_CRIME;
  }

  function setToast(text) {
    state.toast = text;
    state.toastUntil = state.elapsed + 3.5;
  }

  function currentMission() {
    return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
  }

  function completeMission() {
    const mission = currentMission();
    if (!mission) return 0;
    state.cash += mission.reward;
    setToast(`${mission.title} complete! +$${mission.reward}`);
    state.missionIndex += 1;
    state.missionTimer = 0;
    state.missionStolen = false;
    updateMissionTarget();
    let events = EVENT_MISSION;
    if (state.missionIndex === 2) {
      // Mission 3 starts hot.
    }
    if (state.missionIndex === 3) {
      state.wanted = 3;
      state.timeSinceCrime = 0;
      events |= EVENT_CRIME;
    }
    if (state.missionIndex >= MISSIONS.length) {
      state.storyComplete = true;
      events |= EVENT_COMPLETE;
    }
    return events;
  }

  function ensurePolice() {
    const want = state.wanted > 0 ? Math.min(state.wanted, POLICE.maxCars) : 0;
    while (policeCars.length < want) {
      const spot = randomRoadSpot();
      // Spawn a good distance away, on a road.
      if (dist(spot.x, spot.y, player.x, player.y) < 500) continue;
      policeCars.push({
        kind: 'police', x: spot.x, y: spot.y, angle: angleTo(spot.x, spot.y, player.x, player.y),
        speed: 0, color: '#2f6fb2', hp: CAR.hp, ramCooldown: 0, copCooldown: 0,
      });
    }
    while (policeCars.length > want) policeCars.pop();
  }

  function bust(reason) {
    if (state.busted) return 0;
    state.busted = true;
    state.bustReason = reason;
    return EVENT_BUSTED;
  }

  // ---- per-entity updates ----

  function stepTraffic(dt) {
    for (const car of cars) {
      if (car.kind !== 'traffic') continue;
      car.pos += car.speed * car.dir * dt;
      const limit = car.axis === 'x' ? WORLD.width - 160 : WATER_Y - 160;
      if (car.pos > limit || car.pos < 160) {
        car.dir *= -1;
        car.lane = car.axis === 'x' ? (car.dir > 0 ? 35 : -35) : (car.dir > 0 ? -35 : 35);
        car.pos = clamp(car.pos, 160, limit);
      }
      // At an intersection, sometimes turn onto the crossing road.
      if (random() < 0.35) {
        if (car.axis === 'x') {
          const rx = ROADS_X[nearestIndex(ROADS_X, car.pos)];
          if (Math.abs(car.pos - rx) < car.speed * dt * 1.5) {
            car.axis = 'y';
            car.roadIndex = nearestIndex(ROADS_X, car.pos);
            car.pos = ROADS_Y[car.roadIndex] + car.lane;
            car.dir = random() < 0.5 ? 1 : -1;
            car.lane = car.dir > 0 ? -35 : 35;
          }
        } else {
          const ry = ROADS_Y[nearestIndex(ROADS_Y, car.pos)];
          if (Math.abs(car.pos - ry) < car.speed * dt * 1.5) {
            car.axis = 'x';
            car.roadIndex = nearestIndex(ROADS_Y, car.pos);
            car.pos = ROADS_X[car.roadIndex] + car.lane;
            car.dir = random() < 0.5 ? 1 : -1;
            car.lane = car.dir > 0 ? 35 : -35;
          }
        }
      }
      placeTrafficCar(car);
    }
    // Simple separation so traffic does not pile up on one spot, and so it
    // does not drive through parked cars.
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        if (a.kind !== 'traffic' && b.kind !== 'traffic') continue;
        if (a.kind === 'parked' && b.kind === 'parked') continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d > 0.01 && d < 70) {
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          if (a.kind === 'traffic' && b.kind === 'traffic') {
            const push = (70 - d) / 2;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
          } else if (a.kind === 'traffic') {
            // Parked car holds its ground; the moving car gets out of the way.
            a.x -= nx * (70 - d);
            a.y -= ny * (70 - d);
          } else {
            b.x += nx * (70 - d);
            b.y += ny * (70 - d);
          }
        }
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) ped.flee = 2.5;
        continue;
      }
      if (ped.stagger > 0) {
        ped.stagger -= dt;
        continue;
      }
      const speed = ped.flee > 0 ? 260 : ped.speed;
      if (ped.flee > 0) {
        ped.flee -= dt;
        ped.angle = angleTo(player.x, player.y, ped.x, ped.y); // run away from the player
      }
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
      if (ped.flee <= 0) {
        // Wander: at an intersection, sometimes turn; at the map edge, turn back.
        if (random() < 0.2) {
          if (ped.axis === 'x') {
            const rx = ROADS_X[nearestIndex(ROADS_X, ped.x)];
            if (Math.abs(ped.x - rx) < 40) {
              ped.axis = 'y';
              ped.dir = random() < 0.5 ? 1 : -1;
              ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
              ped.y = clamp(ped.y, 120, WATER_Y - 120);
            }
          } else {
            const ry = ROADS_Y[nearestIndex(ROADS_Y, ped.y)];
            if (Math.abs(ped.y - ry) < 40) {
              ped.axis = 'x';
              ped.dir = random() < 0.5 ? 1 : -1;
              ped.angle = ped.dir > 0 ? 0 : Math.PI;
              ped.x = clamp(ped.x, 120, WORLD.width - 120);
            }
          }
        }
        if (ped.x < 100 || ped.x > WORLD.width - 100 || ped.y < 100 || ped.y > WATER_Y - 100) {
          ped.angle += Math.PI;
          ped.dir *= -1;
          ped.x = clamp(ped.x, 100, WORLD.width - 100);
          ped.y = clamp(ped.y, 100, WATER_Y - 100);
        }
      }
      // Stay out of buildings.
      blockedByBuilding(ped, 12);
    }
  }

  function stepPolice(dt) {
    ensurePolice();
    const px = player.x;
    const py = player.y;
    for (const cop of policeCars) {
      cop.ramCooldown = Math.max(0, cop.ramCooldown - dt);
      cop.copCooldown = Math.max(0, cop.copCooldown - dt);
      const d = dist(cop.x, cop.y, px, py);
      const desired = angleTo(cop.x, cop.y, px, py);
      cop.angle = angleLerp(cop.angle, desired, 3.4 * dt);
      const targetSpeed = d > 90 ? POLICE.carSpeed : 0;
      cop.speed += clamp(targetSpeed - cop.speed, -900 * dt, 600 * dt);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      cop.x = clamp(cop.x, 80, WORLD.width - 80);
      cop.y = clamp(cop.y, 80, WATER_Y - 80);
      // Ram a player car, or send a foot cop after a player on foot.
      if (player.car && d < 62 && cop.ramCooldown === 0) {
        cop.ramCooldown = 0.8;
        player.car.hp -= POLICE.ramDamage;
        player.car.speed *= 0.6;
        if (player.car.hp <= 0) return bust('Your car was wrecked by the VCPD.');
        return EVENT_CRASH;
      }
      if (!player.car && d < 120 && cop.copCooldown === 0 && cops.length < (state.wanted >= 2 ? 2 : 1)) {
        cop.copCooldown = 6;
        cops.push({
          x: cop.x, y: cop.y, angle: cop.angle, speed: POLICE.footSpeed,
          color: '#1c3a5e', stagger: 0, punchTimer: 0,
        });
      }
    }
    for (let i = cops.length - 1; i >= 0; i -= 1) {
      const cop = cops[i];
      if (cop.stagger > 0) {
        cop.stagger -= dt;
        continue;
      }
      const d = dist(cop.x, cop.y, px, py);
      cop.angle = angleTo(cop.x, cop.y, px, py);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      blockedByBuilding(cop, 12);
      if (d < POLICE.bustDistance) {
        state.bustTimer += dt;
        if (state.bustTimer > POLICE.bustTime) return bust('Busted by the VCPD.');
      } else {
        state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
      }
      // A foot cop far behind the action gives up and leaves.
      if (d > 1400 || state.wanted === 0) cops.splice(i, 1);
    }
    return 0;
  }

  function stepPlayer(dt, move, actions) {
    const p = player;
    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    p.hurtTimer += dt;
    if (p.hurtTimer > 5 && p.hp < PLAYER.hp) p.hp = Math.min(PLAYER.hp, p.hp + PLAYER.hpRegen * dt);

    if (actions & 4 /* INTERACT */) {
      if (!p.car) {
        const mission = currentMission();
        if (mission && mission.target && dist(p.x, p.y, mission.target.x, mission.target.y) < 90
          && (state.missionIndex === 0 || state.missionIndex === 1)) {
          return completeMission();
        }
        // Enter the nearest parked car.
        let best = null;
        let bestD = 80;
        for (const car of cars) {
          if (car.kind !== 'parked') continue;
          const d = dist(p.x, p.y, car.x, car.y);
          if (d < bestD) { bestD = d; best = car; }
        }
        if (best) {
          p.car = best;
          best.kind = 'player';
          best.speed = 0;
          p.angle = best.angle;
          const ev = addWanted(WANTED.stealCar);
          setToast('Car stolen! The VCPD is on to you.');
          if (state.missionIndex === 2) state.missionStolen = true;
          return ev;
        }
      } else {
        // Step out of the car.
        const car = p.car;
        car.kind = 'parked';
        car.speed = 0;
        p.car = null;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
        p.angle = car.angle;
        blockedByBuilding(p, PLAYER.radius);
      }
    }

    if (actions & 8 /* PUNCH */ && !p.car && p.punchCooldown === 0) {
      p.punchCooldown = 0.4;
      let hit = false;
      const reach = 62;
      for (const ped of peds) {
        if (ped.down > 0) continue;
        const d = dist(p.x, p.y, ped.x, ped.y);
        if (d > reach) continue;
        const ang = Math.abs(angleTo(p.x, p.y, ped.x, ped.y) - p.angle);
        if (ang > 1.2 && d > 30) continue;
        ped.down = 3;
        hit = true;
        if (random() < 0.5) spawnPickup(ped.x, ped.y);
        addWanted(WANTED.punchPed);
      }
      for (const cop of cops) {
        const d = dist(p.x, p.y, cop.x, cop.y);
        if (d < reach) {
          cop.stagger = 1;
          hit = true;
          addWanted(WANTED.punchCop);
        }
      }
      if (hit) return EVENT_PUNCH | EVENT_CRIME;
      return EVENT_PUNCH;
    }

    if (p.car) {
      const car = p.car;
      // Steering follows speed; reversing steers the other way.
      const steer = move.x * CAR.turnRate * clamp(Math.abs(car.speed) / 200, 0.25, 1);
      car.angle += steer * dt * (car.speed >= 0 ? 1 : -1);
      if (move.y < 0) car.speed += CAR.accel * dt;
      else if (move.y > 0) car.speed -= CAR.brake * dt;
      else car.speed *= Math.max(0, 1 - 0.7 * dt);
      car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 40, WORLD.width - 40);
      car.y = clamp(car.y, 40, WATER_Y - 40);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = car.speed;
      if (blockedByBuilding(car, 30)) {
        if (Math.abs(car.speed) > 320) {
          car.hp -= 5;
          car.speed *= 0.4;
          if (car.hp <= 0) return bust('Your car was wrecked.');
          return EVENT_CRASH;
        }
        car.speed *= 0.5;
      }
      if (isWater(car.x, car.y)) {
        car.x -= Math.cos(car.angle) * car.speed * dt;
        car.y -= Math.sin(car.angle) * car.speed * dt;
        car.speed *= 0.4;
      }
      // Bump traffic and police cars.
      for (const other of cars) {
        if (other === car || other.kind === 'parked') continue;
        const d = dist(car.x, car.y, other.x, other.y);
        if (d > 0.01 && d < 58) {
          const nx = (other.x - car.x) / d;
          const ny = (other.y - car.y) / d;
          const push = (58 - d) / 2;
          car.x -= nx * push;
          car.y -= ny * push;
          other.x += nx * push;
          other.y += ny * push;
          car.speed *= 0.85;
          if (other.kind === 'traffic') other.speed *= 0.7;
        }
      }
      for (const cop of policeCars) {
        const d = dist(car.x, car.y, cop.x, cop.y);
        if (d > 0.01 && d < 58) {
          const nx = (cop.x - car.x) / d;
          const ny = (cop.y - car.y) / d;
          const push = (58 - d) / 2;
          car.x -= nx * push;
          car.y -= ny * push;
          cop.x += nx * push;
          cop.y += ny * push;
        }
      }
    } else {
      const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const mx = move.x;
      const my = move.y;
      const len = Math.hypot(mx, my);
      if (len > 0) {
        p.x += (mx / len) * speed * dt;
        p.y += (my / len) * speed * dt;
        p.angle = Math.atan2(my, mx);
        p.speed = speed;
      } else {
        p.speed = 0;
      }
      p.x = clamp(p.x, 20, WORLD.width - 20);
      p.y = clamp(p.y, 20, WORLD.height - 20);
      if (isWater(p.x, p.y)) {
        // Step back out of the water.
        p.x -= (mx / (len || 1)) * speed * dt;
        p.y -= (my / (len || 1)) * speed * dt;
      }
      blockedByBuilding(p, PLAYER.radius);
      // Traffic can hit a pedestrian player.
      for (const car of cars) {
        if (car.kind !== 'traffic') continue;
        if (dist(p.x, p.y, car.x, car.y) < 34 && p.hurtTimer > 1) {
          p.hp -= 15;
          p.hurtTimer = 0;
          p.x += Math.cos(car.angle) * 40;
          p.y += Math.sin(car.angle) * 40;
          if (p.hp <= 0) return bust('Run over in traffic.');
          return EVENT_CRASH;
        }
      }
    }

    // Cash pickups.
    for (const pickup of pickups) {
      if (!pickup.active) continue;
      if (dist(p.x, p.y, pickup.x, pickup.y) < 30) {
        pickup.active = false;
        state.cash += pickup.amount;
        return EVENT_PICKUP;
      }
    }
    return 0;
  }

  function stepMission(dt) {
    const mission = currentMission();
    if (!mission) return 0;
    if (state.missionIndex === 1) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        state.missionTimer = MISSIONS[1].timer;
        setToast('Too slow! The drop is still waiting — go again.');
      }
    }
    if (state.missionIndex === 2 && state.missionStolen && player.car
      && dist(player.x, player.y, mission.target.x, mission.target.y) < 110) {
      return completeMission();
    }
    if (state.missionIndex === 3 && state.wanted === 0) {
      return completeMission();
    }
    return 0;
  }

  /**
   * One fixed step. `move` is {x, y, run}; `actions` is the ACTION_* bit flags
   * (only INTERACT and PUNCH are used here). With `attract` set, the city
   * lives (traffic, pedestrians) but the player, police and missions wait.
   */
  function step(dt, move, actions, attract) {
    let events = 0;
    state.elapsed += dt;
    if (state.toast && state.elapsed > state.toastUntil) state.toast = '';
    stepTraffic(dt);
    stepPeds(dt);
    if (attract || state.busted) return events;
    state.timeSinceCrime += dt;
    // Wanted decays when the heat is off and no cop is close.
    if (state.wanted > 0 && state.timeSinceCrime > 10) {
      let nearest = Infinity;
      for (const cop of policeCars) nearest = Math.min(nearest, dist(cop.x, cop.y, player.x, player.y));
      for (const cop of cops) nearest = Math.min(nearest, dist(cop.x, cop.y, player.x, player.y));
      if (nearest > 500) {
        state.decayAccum += dt;
        const per = state.missionIndex === 3 ? WANTED.decayMission4 : WANTED.decaySeconds;
        if (state.decayAccum >= per) {
          state.decayAccum = 0;
          state.wanted -= 1;
        }
      } else {
        state.decayAccum = 0;
      }
    }
    events |= stepPlayer(dt, move, actions);
    if (state.busted) return events;
    events |= stepPolice(dt);
    if (state.busted) return events;
    if (state.missionIndex === 1 && state.missionTimer === 0) state.missionTimer = MISSIONS[1].timer;
    events |= stepMission(dt);
    return events;
  }

  // ---- shot staging helpers (used by shots.js, not by the live game) ----

  function placePlayerInCar(x, y, angle, color) {
    const car = { kind: 'player', x, y, angle, speed: 220, color: color || '#d94f3d', hp: CAR.hp };
    cars.push(car);
    player.car = car;
    player.x = x;
    player.y = y;
    player.angle = angle;
    return car;
  }

  function setMission(index, timer) {
    state.missionIndex = index;
    state.missionTimer = timer ?? (MISSIONS[index] ? MISSIONS[index].timer : 0);
    state.missionStolen = index === 2;
    updateMissionTarget();
  }

  function forceBusted(reason) {
    state.busted = true;
    state.bustReason = reason || 'Busted by the VCPD.';
    state.wanted = 3;
  }

  function applySave(save) {
    if (!save) return;
    state.cash = save.cash || 0;
    state.missionIndex = Math.min(save.missionIndex || 0, MISSIONS.length);
    state.storyComplete = state.missionIndex >= MISSIONS.length;
    updateMissionTarget();
    if (state.missionIndex === 1) state.missionTimer = MISSIONS[1].timer;
    if (state.missionIndex === 3) {
      state.wanted = 3;
      state.timeSinceCrime = 0;
    }
  }

  function saveData() {
    return { cash: state.cash, missionIndex: state.missionIndex };
  }

  reset();
  return {
    state, reset, step, currentMission, setToast, applySave, saveData,
    placePlayerInCar, setMission, forceBusted, MISSIONS, PIER,
  };
}
