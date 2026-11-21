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
  CREW,
  PISTOL_UNLOCK_MISSIONS,
  HELI_REWARD,
  HELI_HP,
  SAND_X,
  WATER_X,
} from './config.js';
import { mulberry32, clamp, dist, angleTo, turnToward, range } from './random.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { createWorld, circleHitsBuildings, trafficPos, inWater } from './world.js';
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
    // Round-6 systems: day clock, multi-stop missions, tail + getaway state,
    // helicopters, pistol fire, and the crew.
    this.dayTime = 9.0;
    this.stopIndex = 0;
    this.tailTime = 0;
    this.tailSpookCd = 0;
    this.getawayT = 0;
    this.heliSpawnT = 0;
    this.fireCd = 0;
    this.muzzleT = 0;
    this.mouseWorld = { x: PLAYER_START.x, y: PLAYER_START.y };
    this.crew = CREW;
    this.save = this.loadSave();
    if (this.save) {
      this.cash = this.save.cash || 0;
      this.missionIndex = clamp(this.save.missionIndex || 0, 0, MISSIONS.length);
    }
    const m = this.currentMission();
    this.missionTimer = m ? m.timer || 0 : 0;
    this.startMission(m);
    this.centerCamera();
    window.__game = this;
  }

  currentMission() {
    return this.missionIndex < MISSIONS.length ? MISSIONS[this.missionIndex] : null;
  }

  // The crew rides with Dax from the start; each member's bonus is always on.
  hasCrew(name) {
    return this.crew.some((c) => c.name === name);
  }

  isArmed() {
    return this.missionIndex >= PISTOL_UNLOCK_MISSIONS;
  }

  // Clock phase for the day/night tint: name + darkness 0..1.
  dayPhase() {
    const h = this.dayTime;
    if (h >= 5 && h < 7) return { name: 'DAWN', night: 0.25 };
    if (h >= 7 && h < 17) return { name: 'DAY', night: 0 };
    if (h >= 17 && h < 19) return { name: 'GOLDEN HOUR', night: 0.15 };
    if (h >= 19 && h < 21) return { name: 'DUSK', night: 0.45 };
    return { name: 'NIGHT', night: 1 };
  }

  clockText() {
    const h = Math.floor(this.dayTime);
    const m = Math.floor((this.dayTime - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // A helicopter spotlight is on the player when a heli is close overhead.
  heliSpotlightOn() {
    for (const h of this.world.helicopters) {
      if (dist(h.x, h.y, this.player.x, this.player.y) < 900) return true;
    }
    return false;
  }

  // Set up the per-mission state when a mission begins.
  startMission(m) {
    if (!m) return;
    this.stopIndex = 0;
    this.tailTime = 0;
    this.tailSpookCd = 0;
    this.getawayT = 0;
    if (m.id === 7) this.resetCourier();
    if (m.id === 8) this.getawayT = 120;
  }

  resetCourier() {
    const c = this.world.courier;
    // Put the courier on the sidewalk of the vertical road nearest to a
    // point a short way east of the player.
    const wantX = this.player.x + 300;
    let road = ROADS_V[0];
    for (const r of ROADS_V) {
      if (Math.abs(r - wantX) < Math.abs(road - wantX)) road = r;
    }
    c.x = road + ROAD_W / 2 + 12;
    c.y = clamp(this.player.y, 120, WORLD_H - 120);
    c.tx = c.x;
    c.ty = c.y;
    c.angle = 0;
  }

  updateMouseWorld() {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / Math.max(1, rect.width);
    const sy = this.canvas.height / Math.max(1, rect.height);
    this.mouseWorld = {
      x: this.cam.x + (this.input.mouseX - rect.left) * sx,
      y: this.cam.y + (this.input.mouseY - rect.top) * sy,
    };
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
    if (car === this.world.auroraCar) {
      this.world.auroraCar.parked = false;
      this.commitCrime(5);
      this.addFlash('You stole the Aurora GT — the whole VCPD is coming!', 3.5);
    }
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
    if (car === this.world.auroraCar) {
      // The Aurora stays stealable where you left it.
      this.world.auroraCar.parked = true;
      return;
    }
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
    if (this.world.auroraCar.parked) consider(this.world.auroraCar);
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
    if (m.id === 7) {
      const c = this.world.courier;
      return { x: c.x, y: c.y, label: 'COURIER' };
    }
    if (m.id === 8) return null;
    if (m.id === 9) {
      if (this.player.inCar && this.player.car && this.player.car.aurora) {
        return { x: m.target.x, y: m.target.y, label: m.label };
      }
      const a = this.world.auroraCar;
      if (a.parked) return { x: a.x, y: a.y, label: 'AURORA GT' };
      return { x: m.target.x, y: m.target.y, label: m.label };
    }
    if (m.stops) {
      const stop = m.stops[this.stopIndex];
      if (!stop) return null;
      return { x: stop.x, y: stop.y, label: stop.label };
    }
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
    this.startMission(next);
    if (next.id === 4 && this.wanted === 0) {
      this.wanted = 2;
      this.timeSinceCrime = 0;
      this.addFlash('The VCPD is all over you — lose them!', 3.5);
    }
    if (next.id === 5) {
      this.addFlash('New hardware: the pistol is yours now — aim with the mouse', 3.5);
    }
    this.saveGame();
  }

  damagePlayer(amount, reason, isCrash) {
    // Mara patches Dax up: crash damage is halved while she rides along.
    if (isCrash && this.hasCrew('Mara')) amount *= 0.5;
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
      armed: this.isArmed(),
      stopIndex: this.stopIndex,
      dayTime: Math.round(this.dayTime * 100) / 100,
      helis: this.world.helicopters.length,
      bullets: this.world.bullets.length,
      tailTime: Math.round(this.tailTime * 10) / 10,
      getawayT: Math.round(this.getawayT * 10) / 10,
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
      const cm = this.currentMission();
      this.addFlash(
        cm ? `Mission ${this.missionIndex + 1}: ${cm.name}` : 'Story complete — free roam, Velvet Bay is yours',
        3
      );
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
    this.sound.setRotor(this.state === 'playing' && this.world.helicopters.length > 0);
    this.sound.setBass(this.state === 'playing');
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
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.muzzleT > 0) this.muzzleT -= dt;
    if (this.tailSpookCd > 0) this.tailSpookCd -= dt;

    this.updateDayNight(dt);
    this.updateMouseWorld();
    this.updatePlayer(dt);
    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updateBeachgoers(dt);
    this.updateCourier(dt);
    this.updateHelis(dt);
    this.updateBullets(dt);
    this.updatePolice(dt);
    if (this.state !== 'playing') return; // busted mid-update (ram / foot cop)
    this.updatePickups(dt);

    // Wanted slowly cools off when the player stays clean. Vex on the crew
    // makes the heat fade 40% faster; a helicopter spotlight freezes it.
    const coolAfter = 14 * (this.hasCrew('Vex') ? 0.6 : 1);
    if (this.wanted > 0 && this.timeSinceCrime > coolAfter && !this.heliSpotlightOn()) {
      this.wanted -= 1;
      this.timeSinceCrime = 0;
      if (this.wanted === 0) {
        this.world.policeCars = [];
        this.world.footCops = [];
        this.world.helicopters = [];
        this.addFlash('You lost the cops!', 3);
      } else {
        this.addFlash('Heat cooling off…', 2);
      }
    }
    // Mara patches Dax up three times as fast while the heat is off.
    if (this.wanted === 0 && this.player.hp < 100) {
      const healRate = this.hasCrew('Mara') ? 9 : 3;
      this.player.hp = Math.min(100, this.player.hp + healRate * dt);
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
      } else if (m.stops) {
        const stop = m.stops[this.stopIndex];
        if (stop && dist(this.player.x, this.player.y, stop.x, stop.y) < 75) {
          this.stopIndex += 1;
          this.sound.blip(990, 0.1);
          if (this.stopIndex >= m.stops.length) {
            this.completeMission();
          } else {
            this.addFlash(`Stop ${this.stopIndex} of ${m.stops.length} — next: ${m.stops[this.stopIndex].label}`, 2.5);
          }
        }
      } else if (m.id === 7) {
        // The tail: stay in the band behind the courier.
        const c = this.world.courier;
        const d = dist(this.player.x, this.player.y, c.x, c.y);
        if (d < 30) {
          if (this.tailSpookCd <= 0) {
            this.tailSpookCd = 3;
            this.tailTime = 0;
            this.addFlash('Too close — the courier spotted you!', 2.5);
            const a = angleTo(c.x, c.y, this.player.x, this.player.y);
            c.tx = clamp(c.x + Math.cos(a) * 300, 80, WORLD_W - 80);
            c.ty = clamp(c.y + Math.sin(a) * 300, 80, WORLD_H - 80);
          }
        } else if (d <= 280) {
          this.tailTime += dt;
          if (this.tailTime >= 20) this.completeMission();
        } else if (d > 320) {
          this.tailTime = Math.max(0, this.tailTime - dt * 0.5);
        }
      } else if (m.id === 8) {
        // The getaway: the clock only runs while the heat is at 3 stars.
        if (this.wanted >= 3) {
          this.getawayT -= dt;
          if (this.getawayT <= 0) this.completeMission();
        }
      } else if (m.id === 9) {
        if (
          this.player.inCar &&
          this.player.car &&
          this.player.car.aurora &&
          dist(this.player.x, this.player.y, m.target.x, m.target.y) < 80
        ) {
          this.completeMission();
        }
      } else if (m.target && dist(this.player.x, this.player.y, m.target.x, m.target.y) < 75) {
        this.completeMission();
      }
    }

    this.centerCamera();
  }

  updateDayNight(dt) {
    // One game-hour every 50 seconds, wrapping at midnight.
    this.dayTime = (this.dayTime + dt / 50) % 24;
  }

  updateHelis(dt) {
    const desired = this.wanted >= 5 ? 2 : this.wanted >= 4 ? 1 : 0;
    if (this.world.helicopters.length < desired) {
      this.heliSpawnT -= dt;
      if (this.heliSpawnT <= 0) {
        this.heliSpawnT = 1.0;
        const a = this.rng() * Math.PI * 2;
        this.world.helicopters.push({
          x: clamp(this.player.x + Math.cos(a) * 520, 80, WORLD_W - 80),
          y: clamp(this.player.y + Math.sin(a) * 520, 80, WORLD_H - 80),
          hp: HELI_HP,
          rotor: 0,
          bob: this.rng() * Math.PI * 2,
        });
        this.sound.blip(440, 0.15);
        this.addFlash('VCPD helicopter overhead!', 2.5);
      }
    }
    if (this.world.helicopters.length > desired) {
      this.world.helicopters.length = desired;
    }
    for (const h of this.world.helicopters) {
      h.rotor += dt * 40;
      h.bob += dt * 2;
      // Drift toward the player, holding about 260px off.
      const d = dist(h.x, h.y, this.player.x, this.player.y);
      const want = 260;
      const a = angleTo(h.x, h.y, this.player.x, this.player.y);
      const sp = d > want + 40 ? 150 : d < want - 40 ? -60 : 0;
      h.x = clamp(h.x + Math.cos(a) * sp * dt, 60, WORLD_W - 60);
      h.y = clamp(h.y + Math.sin(a) * sp * dt, 60, WORLD_H - 60);
    }
  }

  fireBullet() {
    if (this.fireCd > 0) return;
    const p = this.player;
    const a = angleTo(p.x, p.y, this.mouseWorld.x, this.mouseWorld.y);
    this.world.bullets.push({
      x: p.x + Math.cos(a) * 22,
      y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a) * 900,
      vy: Math.sin(a) * 900,
      life: 0.9,
    });
    this.fireCd = 0.22;
    this.muzzleT = 0.08;
    this.sound.shot();
  }

  updateBullets(dt) {
    const w = this.world;
    for (let i = w.bullets.length - 1; i >= 0; i--) {
      const b = w.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H;
      if (!dead) {
        for (let j = w.helicopters.length - 1; j >= 0; j--) {
          const h = w.helicopters[j];
          if (dist(b.x, b.y, h.x, h.y) < 34) {
            h.hp -= 1;
            dead = true;
            if (h.hp <= 0) {
              w.helicopters.splice(j, 1);
              this.cash += HELI_REWARD;
              this.sound.explosion();
              this.addFlash(`Helicopter down! +$${HELI_REWARD}`, 2.5);
            }
            break;
          }
        }
      }
      if (!dead) {
        for (const pc of w.policeCars) {
          if (dist(b.x, b.y, pc.x, pc.y) < 30) {
            pc.slowT = 1.5;
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (let j = w.footCops.length - 1; j >= 0; j--) {
          const fc = w.footCops[j];
          if (dist(b.x, b.y, fc.x, fc.y) < 26) {
            w.footCops.splice(j, 1);
            dead = true;
            this.addFlash('Cop down!', 2);
            break;
          }
        }
      }
      if (dead) w.bullets.splice(i, 1);
    }
  }

  updateCourier(dt) {
    const c = this.world.courier;
    if (!c) return;
    const d = dist(c.x, c.y, c.tx, c.ty);
    if (d < 10) {
      const vertical = this.rng() < 0.5;
      if (vertical) {
        const road = ROADS_V[Math.floor(this.rng() * ROADS_V.length)];
        c.tx = road + (this.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
        c.ty = clamp(c.y + (this.rng() * 500 - 250), 100, WORLD_H - 100);
      } else {
        const road = ROADS_H[Math.floor(this.rng() * ROADS_H.length)];
        c.ty = road + (this.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
        c.tx = clamp(c.x + (this.rng() * 500 - 250), 100, WORLD_W - 100);
      }
      return;
    }
    const step = Math.min(d, c.speed * dt);
    const nx = c.x + ((c.tx - c.x) / d) * step;
    const ny = c.y + ((c.ty - c.y) / d) * step;
    if (!circleHitsBuildings(this.world.buildings, nx, ny, 10)) {
      c.x = nx;
      c.y = ny;
    }
    c.angle = Math.atan2(c.ty - c.y, c.tx - c.x);
    c.x = clamp(c.x, 20, WORLD_W - 20);
    c.y = clamp(c.y, 20, WORLD_H - 20);
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
      // Rook at the wheel: +12% top speed and sharper steering.
      const topSpeed = CAR_MAX_SPEED * (this.hasCrew('Rook') ? 1.12 : 1);
      const steerRate = 2.4 * (this.hasCrew('Rook') ? 1.15 : 1);
      if (inp.isDown('KeyW', 'ArrowUp')) car.speed += CAR_ACCEL * dt;
      if (inp.isDown('KeyS', 'ArrowDown')) car.speed -= (car.speed > 0 ? 520 : 260) * dt;
      car.speed -= car.speed * 0.9 * dt;
      car.speed = clamp(car.speed, -CAR_REVERSE_MAX, topSpeed);
      const steer = (inp.isDown('KeyA', 'ArrowLeft') ? -1 : 0) + (inp.isDown('KeyD', 'ArrowRight') ? 1 : 0);
      if (Math.abs(car.speed) > 8) {
        car.angle += steer * steerRate * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 160);
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      // Buildings and the bay both stop a car dead.
      if (!circleHitsBuildings(this.world.buildings, nx, ny, 20) && !inWater(nx, ny, 20)) {
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
            this.damagePlayer(4, 'Your ride was wrecked in a pile-up.', true);
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
      // Buildings and the bay both block a walker.
      if (!circleHitsBuildings(this.world.buildings, nx, p.y, 13) && !inWater(nx, p.y, 13)) p.x = nx;
      if (!circleHitsBuildings(this.world.buildings, p.x, ny, 13) && !inWater(p.x, ny, 13)) p.y = ny;
      p.x = clamp(p.x, 20, WORLD_W - 20);
      p.y = clamp(p.y, 20, WORLD_H - 20);
      p.angle = Math.atan2(my, mx);
    }

    // Pistol: hold the mouse to fire once the piece is unlocked.
    if (this.isArmed() && (inp.mouseDown || inp.mouseClicked)) {
      this.fireBullet();
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

  // Beachgoers wander up and down the sand strip, never into the water.
  updateBeachgoers(dt) {
    for (const b of this.world.beachgoers) {
      if (b.down > 0) {
        b.down -= dt;
        continue;
      }
      const d = dist(b.x, b.y, b.tx, b.ty);
      if (d < 8) {
        b.tx = range(this.rng, SAND_X + 14, WATER_X - 16);
        b.ty = clamp(b.y + (this.rng() * 400 - 200), 100, WORLD_H - 100);
        continue;
      }
      const step = Math.min(d, b.speed * dt);
      b.x += ((b.tx - b.x) / d) * step;
      b.y += ((b.ty - b.y) / d) * step;
      b.x = clamp(b.x, SAND_X + 10, WATER_X - 14);
      b.y = clamp(b.y, 20, WORLD_H - 20);
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
      // A bullet hit slows the cruiser for a while.
      let sp = 250 + this.wanted * 18;
      if (pc.slowT > 0) {
        pc.slowT -= dt;
        sp *= 0.5;
      }
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
        this.damagePlayer(7, 'Your ride was wrecked by the VCPD.', true);
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
