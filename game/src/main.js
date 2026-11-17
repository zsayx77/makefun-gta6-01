// Velvet Bay — Street Heat: game loop, driving, wanted system, police AI,
// combat, and the four-mission story. No network, no build step.
import {
  VIEW_W,
  VIEW_H,
  WORLD_W,
  WORLD_H,
  ROADS_V,
  ROADS_H,
  ROAD_W,
  SAVE_KEY,
  SEED,
  PLAYER_START,
  WALK_SPEED,
  RUN_SPEED,
  CAR_ACCEL,
  CAR_MAX_SPEED,
  CAR_REVERSE_MAX,
  MISSIONS,
} from './config.js';
import { mulberry32, clamp, dist, angleTo, turnToward, range } from './random.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { createWorld, circleHitsBuildings, trafficPos } from './world.js';
import { drawGame } from './render.js';
import { applyShot } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.sound = new SoundEngine();
    this.rng = mulberry32(SEED);
    this.world = createWorld(this.rng);
    this.time = 0;
    this.state = 'title';
    this.player = {
      x: PLAYER_START.x,
      y: PLAYER_START.y,
      angle: -Math.PI / 2,
      hp: 100,
      inCar: false,
      car: null,
      punchCd: 0,
      moving: false,
    };
    this.cam = { x: 0, y: 0 };
    this.cash = 0;
    this.wanted = 0;
    this.timeSinceCrime = 99;
    this.crimeCd = 0;
    this.missionIndex = 0;
    this.missionTimer = 0;
    this.flash = { text: '', ttl: 0 };
    this.bustedReason = '';
    this.policeSpawnT = 0;
    this.copSpawnT = 0;
    this.ramCd = 0;
    this.save = this.loadSave();
    if (this.save) {
      this.cash = this.save.cash || 0;
      this.missionIndex = clamp(this.save.missionIndex || 0, 0, MISSIONS.length - 1);
    }
    const m = this.currentMission();
    this.missionTimer = m ? m.timer || 0 : 0;
    this.centerCamera();
    window.__game = this;
  }

  currentMission() {
    return this.missionIndex < MISSIONS.length ? MISSIONS[this.missionIndex] : null;
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  saveGame() {
    try {
      this.save = { cash: this.cash, missionIndex: this.missionIndex };
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch (e) {}
  }

  centerCamera() {
    this.cam.x = clamp(this.player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    this.cam.y = clamp(this.player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  }

  addFlash(text, ttl) {
    this.flash = { text, ttl: ttl || 3 };
  }

  commitCrime(levels) {
    this.wanted = Math.min(5, this.wanted + levels);
    this.timeSinceCrime = 0;
  }

  spawnPlayerCar(x, y, angle, color) {
    return { x, y, angle, speed: 0, color, playerOwned: true, gold: false, parked: false, id: 'player' };
  }

  enterCar(car) {
    const idx = this.world.parkedCars.indexOf(car);
    if (idx >= 0) this.world.parkedCars.splice(idx, 1);
    if (car === this.world.targetCar) this.world.targetCar.parked = false;
    car.parked = false;
    car.speed = 0; // parked cars carry no speed field until they are driven
    this.player.car = car;
    this.player.inCar = true;
    this.player.x = car.x;
    this.player.y = car.y;
    this.player.angle = car.angle;
    // Foot cops cannot catch a car.
    this.world.footCops = [];
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.speed = 0;
    car.parked = true;
    const px = clamp(car.x + Math.cos(car.angle + Math.PI / 2) * 40, 20, WORLD_W - 20);
    const py = clamp(car.y + Math.sin(car.angle + Math.PI / 2) * 40, 20, WORLD_H - 20);
    this.player.x = px;
    this.player.y = py;
    this.player.inCar = false;
    this.player.car = null;
    if (!this.world.parkedCars.includes(car) && car !== this.world.targetCar) {
      this.world.parkedCars.push(car);
    }
  }

  nearestStealable() {
    if (this.player.inCar) return null;
    let best = null;
    let bestD = 78;
    const consider = (c) => {
      const d = dist(this.player.x, this.player.y, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    };
    for (const c of this.world.parkedCars) consider(c);
    if (this.world.targetCar.parked) consider(this.world.targetCar);
    return best;
  }

  spawnPoliceNear(n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = 620 + this.rng() * 160;
      this.world.policeCars.push({
        x: clamp(this.player.x + Math.cos(a) * d, 80, WORLD_W - 80),
        y: clamp(this.player.y + Math.sin(a) * d, 80, WORLD_H - 80),
        angle: 0,
        speed: 0,
        ramCd: 0,
      });
    }
  }

  spawnFootCopNear() {
    const a = this.rng() * Math.PI * 2;
    const d = 420 + this.rng() * 80;
    this.world.footCops.push({
      x: clamp(this.player.x + Math.cos(a) * d, 60, WORLD_W - 60),
      y: clamp(this.player.y + Math.sin(a) * d, 60, WORLD_H - 60),
    });
  }

  missionMarker() {
    const m = this.currentMission();
    if (!m) return null;
    if (m.id === 3) {
      if (this.player.inCar && this.player.car && this.player.car.gold) {
        return { x: m.target.x, y: m.target.y, label: m.label };
      }
      return { x: m.carTarget.x, y: m.carTarget.y, label: 'COMET GT' };
    }
    if (m.id === 4) return null;
    return { x: m.target.x, y: m.target.y, label: m.label };
  }

  completeMission() {
    const m = this.currentMission();
    if (!m) return;
    this.cash += m.reward;
    this.sound.blip(1320, 0.15);
    this.addFlash(`Mission complete: ${m.name}  +$${m.reward}`, 3.5);
    this.missionIndex += 1;
    if (this.missionIndex >= MISSIONS.length) {
      this.state = 'complete';
      this.saveGame();
      return;
    }
    const next = this.currentMission();
    this.missionTimer = next.timer || 0;
    if (next.id === 4 && this.wanted === 0) {
      this.wanted = 2;
      this.timeSinceCrime = 0;
      this.addFlash('The VCPD is all over you — lose them!', 3.5);
    }
    this.saveGame();
  }

  damagePlayer(amount, reason) {
    this.player.hp -= amount;
    this.sound.thud();
    if (this.player.hp <= 0) {
      this.busted(reason || 'Beaten down by the VCPD.');
    }
  }

  busted(reason) {
    this.state = 'busted';
    this.bustedReason = reason;
    this.cash = Math.max(0, this.cash - 100);
    this.wanted = 0;
    this.world.policeCars = [];
    this.world.footCops = [];
    if (this.player.inCar) {
      this.player.inCar = false;
      this.player.car = null;
    }
    this.player.hp = 100;
    this.player.x = PLAYER_START.x;
    this.player.y = PLAYER_START.y;
    this.sound.setSiren(false);
    this.sound.setEngine(0, false);
    this.saveGame();
  }

  snapshot() {
    const m = this.currentMission();
    return {
      state: this.state,
      x: Math.round(this.player.x),
      y: Math.round(this.player.y),
      inCar: this.player.inCar,
      hp: Math.round(this.player.hp),
      cash: this.cash,
      wanted: this.wanted,
      missionIndex: this.missionIndex,
      mission: m ? m.name : 'done',
      missionTimer: Math.round(this.missionTimer * 10) / 10,
      speed: this.player.car ? Math.round(this.player.car.speed) : 0,
      policeCars: this.world.policeCars.length,
      footCops: this.world.footCops.length,
      pedsDown: this.world.peds.filter((p) => p.down > 0).length,
    };
  }

  start() {
    const params = new URLSearchParams(location.search);
    const shot = params.get('shot');
    if (shot) applyShot(this, shot);
    let last = performance.now();
    let firstFrame = true;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try {
        this.frame(dt);
      } catch (e) {
        console.error('game frame error:', e);
      }
      if (firstFrame) {
        firstFrame = false;
        window.__shotReady = true;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  frame(dt) {
    this.time += dt;
    if (this.input.pressed.size > 0) {
      this.sound.ensure();
      this.sound.resume();
    }

    if (this.state === 'title' && this.input.wasPressed('Enter')) {
      this.state = 'playing';
      this.player.hp = 100;
      this.addFlash(`Mission ${this.missionIndex + 1}: ${this.currentMission().name}`, 3);
      this.centerCamera();
    } else if ((this.state === 'busted' || this.state === 'complete') && this.input.wasPressed('Enter')) {
      this.state = 'title';
      this.centerCamera();
    } else if (this.state === 'playing' && this.input.wasPressed('KeyP')) {
      this.state = 'paused';
      this.sound.setEngine(0, false);
    } else if (this.state === 'paused' && this.input.wasPressed('KeyP')) {
      this.state = 'playing';
    }

    if (this.state === 'playing') {
      this.updatePlaying(dt);
    } else if (this.state === 'title') {
      this.updateTraffic(dt);
      this.updatePeds(dt);
    }

    const driving = this.state === 'playing' && this.player.inCar && this.player.car;
    this.sound.setEngine(driving ? Math.abs(this.player.car.speed) / CAR_MAX_SPEED : 0, driving);
    this.sound.setSiren(this.state === 'playing' && this.wanted >= 1);
    this.sound.update(dt);

    drawGame(this.ctx, this);
    this.input.endFrame();
  }

  updatePlaying(dt) {
    this.timeSinceCrime += dt;
    if (this.crimeCd > 0) this.crimeCd -= dt;
    if (this.ramCd > 0) this.ramCd -= dt;
    if (this.player.punchCd > 0) this.player.punchCd -= dt;
    if (this.flash.ttl > 0) this.flash.ttl -= dt;

    this.updatePlayer(dt);
    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updatePolice(dt);
    if (this.state !== 'playing') return; // busted mid-update (ram / foot cop)
    this.updatePickups(dt);

    // Wanted slowly cools off when the player stays clean.
    if (this.wanted > 0 && this.timeSinceCrime > 14) {
      this.wanted -= 1;
      this.timeSinceCrime = 0;
      if (this.wanted === 0) {
        this.world.policeCars = [];
        this.world.footCops = [];
        this.addFlash('You lost the cops!', 3);
      } else {
        this.addFlash('Heat cooling off…', 2);
      }
    }
    if (this.wanted === 0 && this.player.hp < 100) {
      this.player.hp = Math.min(100, this.player.hp + 3 * dt);
    }

    // Mission timer + arrival checks.
    const m = this.currentMission();
    if (m) {
      if (m.timer > 0 && this.missionTimer > 0) {
        this.missionTimer -= dt;
        if (this.missionTimer <= 0) {
          this.missionTimer = m.timer;
          this.addFlash('Too slow — the buyer walked. Try again!', 3.5);
        }
      }
      if (m.id === 3) {
        if (
          this.player.inCar &&
          this.player.car &&
          this.player.car.gold &&
          dist(this.player.x, this.player.y, m.target.x, m.target.y) < 80
        ) {
          this.completeMission();
        }
      } else if (m.id === 4) {
        if (this.wanted === 0) this.completeMission();
      } else if (m.target && dist(this.player.x, this.player.y, m.target.x, m.target.y) < 75) {
        this.completeMission();
      }
    }

    this.centerCamera();
  }

  updatePlayer(dt) {
    const p = this.player;
    const inp = this.input;

    // Steal / exit car.
    if (inp.wasPressed('KeyE')) {
      if (p.inCar) {
        this.exitCar();
      } else {
        const car = this.nearestStealable();
        if (car) {
          this.enterCar(car);
          this.commitCrime(1);
          this.sound.blip(660, 0.12);
          this.addFlash(car.gold ? 'You stole the Comet GT — get it to Sunset Garage!' : 'You stole the car! Wanted +1', 3);
        }
      }
    }

    if (p.inCar && p.car) {
      const car = p.car;
      if (inp.isDown('KeyW', 'ArrowUp')) car.speed += CAR_ACCEL * dt;
      if (inp.isDown('KeyS', 'ArrowDown')) car.speed -= (car.speed > 0 ? 520 : 260) * dt;
      car.speed -= car.speed * 0.9 * dt;
      car.speed = clamp(car.speed, -CAR_REVERSE_MAX, CAR_MAX_SPEED);
      const steer = (inp.isDown('KeyA', 'ArrowLeft') ? -1 : 0) + (inp.isDown('KeyD', 'ArrowRight') ? 1 : 0);
      if (Math.abs(car.speed) > 8) {
        car.angle += steer * 2.4 * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 160);
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (!circleHitsBuildings(this.world.buildings, nx, ny, 20)) {
        car.x = nx;
        car.y = ny;
      } else {
        car.speed *= 0.35;
        if (Math.abs(car.speed) > 120) this.sound.thud();
      }
      car.x = clamp(car.x, 30, WORLD_W - 30);
      car.y = clamp(car.y, 30, WORLD_H - 30);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;

      // Smash into traffic.
      for (const t of this.world.traffic) {
        const tp = trafficPos(t);
        if (dist(car.x, car.y, tp.x, tp.y) < 38) {
          t.pos += t.dir * 46;
          car.speed *= 0.55;
          if (this.ramCd <= 0) {
            this.ramCd = 0.8;
            this.damagePlayer(4, 'Your ride was wrecked in a pile-up.');
            if (Math.abs(car.speed) > 200 && this.crimeCd <= 0) {
              this.crimeCd = 5;
              this.commitCrime(1);
              this.addFlash('Hit and run! Wanted +1', 2.5);
            }
          }
        }
      }
      // Run over a pedestrian at speed.
      for (const ped of this.world.peds) {
        if (ped.down <= 0 && Math.abs(car.speed) > 120 && dist(car.x, car.y, ped.x, ped.y) < 30) {
          ped.down = 4;
          ped.flee = 6;
          if (this.crimeCd <= 0) {
            this.crimeCd = 5;
            this.commitCrime(1);
            this.addFlash('You hit a pedestrian! Wanted +1', 2.5);
          }
        }
      }
      return;
    }

    // On foot.
    let mx = (inp.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (inp.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    let my = (inp.isDown('KeyS', 'ArrowDown') ? 1 : 0) - (inp.isDown('KeyW', 'ArrowUp') ? 1 : 0);
    const len = Math.hypot(mx, my);
    p.moving = len > 0;
    if (len > 0) {
      mx /= len;
      my /= len;
      const speed = inp.isDown('ShiftLeft', 'ShiftRight') ? RUN_SPEED : WALK_SPEED;
      const nx = p.x + mx * speed * dt;
      const ny = p.y + my * speed * dt;
      if (!circleHitsBuildings(this.world.buildings, nx, p.y, 13)) p.x = nx;
      if (!circleHitsBuildings(this.world.buildings, p.x, ny, 13)) p.y = ny;
      p.x = clamp(p.x, 20, WORLD_W - 20);
      p.y = clamp(p.y, 20, WORLD_H - 20);
      p.angle = Math.atan2(my, mx);
    }

    // Punch.
    if (inp.wasPressed('Space') && p.punchCd <= 0) {
      p.punchCd = 0.35;
      let best = null;
      let bestD = 62;
      for (const ped of this.world.peds) {
        if (ped.down > 0) continue;
        const d = dist(p.x, p.y, ped.x, ped.y);
        if (d < bestD) {
          bestD = d;
          best = ped;
        }
      }
      if (best) {
        best.down = 4;
        best.flee = 6;
        this.commitCrime(1);
        this.sound.thud();
        this.addFlash('You knocked someone down! Wanted +1', 2.5);
        if (this.rng() < 0.4) {
          this.world.pickups.push({
            x: best.x,
            y: best.y,
            amount: 10 + Math.floor(this.rng() * 30),
            ttl: 20,
          });
        }
      }
    }
  }

  updateTraffic(dt) {
    for (const t of this.world.traffic) {
      t.pos += t.dir * t.speed * dt;
      const limit = t.vertical ? WORLD_H : WORLD_W;
      if (t.pos > limit + 80) t.pos = -80;
      if (t.pos < -80) t.pos = limit + 80;
    }
  }

  pickPedTarget(ped) {
    const vertical = this.rng() < 0.5;
    if (vertical) {
      const road = ROADS_V[Math.floor(this.rng() * ROADS_V.length)];
      ped.tx = road + (this.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
      ped.ty = clamp(ped.y + (this.rng() * 600 - 300), 80, WORLD_H - 80);
    } else {
      const road = ROADS_H[Math.floor(this.rng() * ROADS_H.length)];
      ped.ty = road + (this.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
      ped.tx = clamp(ped.x + (this.rng() * 600 - 300), 80, WORLD_W - 80);
    }
  }

  updatePeds(dt) {
    for (const ped of this.world.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        continue;
      }
      let tx = ped.tx;
      let ty = ped.ty;
      let speed = ped.speed;
      if (ped.flee > 0) {
        ped.flee -= dt;
        const a = angleTo(this.player.x, this.player.y, ped.x, ped.y);
        tx = ped.x + Math.cos(a) * 100;
        ty = ped.y + Math.sin(a) * 100;
        speed *= 1.7;
      }
      const d = dist(ped.x, ped.y, tx, ty);
      if (d < 8) {
        if (ped.flee <= 0) this.pickPedTarget(ped);
        continue;
      }
      const step = Math.min(d, speed * dt);
      const nx = ped.x + ((tx - ped.x) / d) * step;
      const ny = ped.y + ((ty - ped.y) / d) * step;
      if (!circleHitsBuildings(this.world.buildings, nx, ny, 10)) {
        ped.x = nx;
        ped.y = ny;
      } else if (ped.flee <= 0) {
        this.pickPedTarget(ped);
      }
      ped.x = clamp(ped.x, 20, WORLD_W - 20);
      ped.y = clamp(ped.y, 20, WORLD_H - 20);
    }
  }

  updatePolice(dt) {
    // Police cars.
    const desiredCars = this.wanted > 0 ? Math.min(this.wanted, 4) : 0;
    if (this.world.policeCars.length < desiredCars) {
      this.policeSpawnT -= dt;
      if (this.policeSpawnT <= 0) {
        this.policeSpawnT = 1.2;
        this.spawnPoliceNear(1);
      }
    }
    for (const pc of this.world.policeCars) {
      const target = angleTo(pc.x, pc.y, this.player.x, this.player.y);
      pc.angle = turnToward(pc.angle, target, 2.6 * dt);
      const sp = 250 + this.wanted * 18;
      const nx = pc.x + Math.cos(pc.angle) * sp * dt;
      const ny = pc.y + Math.sin(pc.angle) * sp * dt;
      if (!circleHitsBuildings(this.world.buildings, nx, ny, 20)) {
        pc.x = nx;
        pc.y = ny;
      } else {
        pc.angle += 0.9;
      }
      if (pc.ramCd > 0) pc.ramCd -= dt;
      if (dist(pc.x, pc.y, this.player.x, this.player.y) < 50 && pc.ramCd <= 0) {
        pc.ramCd = 1.0;
        if (this.player.inCar && this.player.car) this.player.car.speed *= 0.45;
        this.damagePlayer(7, 'Your ride was wrecked by the VCPD.');
      }
    }

    // Foot cops chase the player on foot.
    const desiredCops = this.wanted >= 2 && !this.player.inCar ? Math.min(this.wanted - 1, 3) : 0;
    if (this.world.footCops.length < desiredCops) {
      this.copSpawnT -= dt;
      if (this.copSpawnT <= 0) {
        this.copSpawnT = 1.5;
        this.spawnFootCopNear();
      }
    }
    for (const fc of this.world.footCops) {
      const d = dist(fc.x, fc.y, this.player.x, this.player.y);
      if (d < 26) {
        this.busted('Caught by a VCPD officer on foot.');
        return;
      }
      if (d > 4) {
        const step = Math.min(d, 138 * dt);
        const nx = fc.x + ((this.player.x - fc.x) / d) * step;
        const ny = fc.y + ((this.player.y - fc.y) / d) * step;
        if (!circleHitsBuildings(this.world.buildings, nx, ny, 10)) {
          fc.x = nx;
          fc.y = ny;
        }
      }
    }
  }

  updatePickups(dt) {
    for (let i = this.world.pickups.length - 1; i >= 0; i--) {
      const p = this.world.pickups[i];
      p.ttl -= dt;
      if (p.ttl <= 0) {
        this.world.pickups.splice(i, 1);
        continue;
      }
      if (dist(this.player.x, this.player.y, p.x, p.y) < 42) {
        this.cash += p.amount;
        this.sound.blip(990, 0.1);
        this.addFlash(`Picked up $${p.amount}`, 2);
        this.world.pickups.splice(i, 1);
      }
    }
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.start();
