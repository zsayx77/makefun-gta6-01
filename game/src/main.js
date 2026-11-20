// Velvet Bay — Street Heat: game loop, driving, wanted system, police AI,
// helicopters, gun combat, day/night, and the nine-mission story. No network,
// no build step.
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
  DAY_START,
  DAY_HOURS_PER_SEC,
  DAY_PHASES,
  GUN_ARMED_INDEX,
  BULLET_SPEED,
  FIRE_CD,
  HELI_SPEED,
  HELI_HP,
  HELI_BOUNTY,
  SAND_X0,
  SAND_X1,
} from './config.js';
import { mulberry32, clamp, clamp01, dist, angleTo, turnToward, range } from './random.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { createWorld, circleHitsBuildings, circleHitsWater, trafficPos } from './world.js';
import { drawGame } from './render.js';
import { applyShot } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.rng = mulberry32(SEED);
    this.world = createWorld(this.rng);
    this.time = 0;
    this.dayTime = DAY_START;
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
    this.stopIndex = 0;
    this.tailTime = 0;
    this.fireCd = 0;
    this.heliSpawnT = 0;
    this.spookCd = 0;
    this.muzzle = null;
    this.aimAngle = -Math.PI / 2;
    this.flash = { text: '', ttl: 0 };
    this.bustedReason = '';
    this.policeSpawnT = 0;
    this.copSpawnT = 0;
    this.ramCd = 0;
    this.save = this.loadSave();
    if (this.save) {
      this.cash = this.save.cash || 0;
      // missionIndex may equal MISSIONS.length (story done) — keep it.
      this.missionIndex = clamp(this.save.missionIndex || 0, 0, MISSIONS.length);
    }
    this.startMission(this.currentMission());
    this.centerCamera();
    window.__game = this;
  }

  currentMission() {
    return this.missionIndex < MISSIONS.length ? MISSIONS[this.missionIndex] : null;
  }

  // Crew members who have joined so far (joinAfter = missions completed).
  crew() {
    return CREW.filter((c) => this.missionIndex >= c.joinAfter);
  }

  hasCrew(id) {
    return this.crew().some((c) => c.id === id);
  }

  // The pistol unlocks once mission 5 (The Gun Runner) is done.
  get armed() {
    return this.missionIndex >= GUN_ARMED_INDEX;
  }

  dayPhase() {
    let h = this.dayTime;
    if (h < 6) h += 24;
    for (const p of DAY_PHASES) {
      if (h >= p.from && h < p.to) return p;
    }
    return DAY_PHASES[1];
  }

  dayClock() {
    const h = Math.floor(this.dayTime) % 24;
    const m = Math.floor((this.dayTime % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // (Re)starts the current mission: timer, stops, courier, opening wanted.
  startMission(m) {
    if (!m) return;
    this.missionTimer = m.timer || 0;
    this.stopIndex = 0;
    this.tailTime = 0;
    if (m.wantedOnStart) {
      this.wanted = m.wantedOnStart;
      this.timeSinceCrime = 0;
    }
    if (m.tail) this.spawnCourier();
    else this.world.courier = null;
  }

  spawnCourier() {
    const route = [
      { x: 1400, y: 840 },
      { x: 2200, y: 840 },
      { x: 2200, y: 1480 },
      { x: 1400, y: 1480 },
    ];
    this.world.courier = { x: 1400, y: 840, angle: 0, seg: 1, route, speed: 150, color: '#7f8c8d' };
  }

  spawnHeliNear() {
    const a = this.rng() * Math.PI * 2;
    const d = 420 + this.rng() * 120;
    this.world.helicopters.push({
      x: clamp(this.player.x + Math.cos(a) * d, 80, WORLD_W - 80),
      y: clamp(this.player.y + Math.sin(a) * d, 80, WORLD_H - 80),
      hp: HELI_HP,
      rotor: this.rng() * Math.PI * 2,
      bob: this.rng() * Math.PI * 2,
    });
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
    if (car === this.world.auroraCar) this.world.auroraCar.parked = false;
    car.parked = false;
    car.speed = 0; // parked cars carry no speed field until they are driven
    this.player.car = car;
    this.player.inCar = true;
    this.player.x = car.x;
    this.player.y = car.y;
    this.player.angle = car.angle;
    // Stealing the Aurora GT pulls the whole VCPD down on you.
    if (car.aurora) {
      this.wanted = 5;
      this.timeSinceCrime = 0;
      this.addFlash('FIVE STARS! The whole VCPD is coming — helicopters and all!', 4);
      this.sound.setSiren(true);
    }
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
        slow: 0,
      });
    }
  }

  spawnFootCopNear() {
    const a = this.rng() * Math.PI * 2;
    const d = 420 + this.rng() * 80;
    this.world.footCops.push({
      x: clamp(this.player.x + Math.cos(a) * d, 60, WORLD_W - 60),
      y: clamp(this.player.y + Math.sin(a) * d, 60, WORLD_H - 60),
      down: 0,
    });
  }

  missionMarker() {
    const m = this.currentMission();
    if (!m) return null;
    if (m.stops) {
      const s = m.stops[this.stopIndex];
      return s ? { x: s.x, y: s.y, label: s.label } : null;
    }
    if (m.tail) {
      const c = this.world.courier;
      return c ? { x: c.x, y: c.y, label: 'COURIER' } : null;
    }
    if (m.carTarget) {
      const special = m.aurora ? this.world.auroraCar : this.world.targetCar;
      if (this.player.inCar && this.player.car === special) {
        return { x: m.target.x, y: m.target.y, label: m.label };
      }
      return { x: special.x, y: special.y, label: m.aurora ? 'AURORA GT' : 'COMET GT' };
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
    if (m.givesGun) {
      this.addFlash('Pistol unlocked — aim with the mouse, click to fire!', 4);
    }
    this.missionIndex += 1;
    const joined = CREW.find((c) => c.joinAfter === this.missionIndex);
    if (joined) {
      this.addFlash(`${joined.name} joined the crew — ${joined.role}: ${joined.bonus}`, 4);
    }
    if (this.missionIndex >= MISSIONS.length) {
      this.world.courier = null;
      this.state = 'complete';
      this.saveGame();
      return;
    }
    this.startMission(this.currentMission());
    this.saveGame();
  }

  damagePlayer(amount, reason) {
    // Mara the mechanic halves crash damage once she has joined.
    this.player.hp -= this.hasCrew('mara') ? amount * 0.5 : amount;
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
    this.world.helicopters = [];
    this.world.bullets = [];
    this.world.courier = null;
    if (this.player.inCar) {
      this.player.inCar = false;
      this.player.car = null;
    }
    this.player.hp = 100;
    this.player.x = PLAYER_START.x;
    this.player.y = PLAYER_START.y;
    this.sound.setSiren(false);
    this.sound.setRotor(false);
    this.sound.setMusic(false);
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
      helicopters: this.world.helicopters.length,
      bullets: this.world.bullets.length,
      armed: this.armed,
      crew: this.crew().map((c) => c.name),
      dayTime: Math.round(this.dayTime * 100) / 100,
      phase: this.dayPhase().name,
      stopIndex: this.stopIndex,
      tailTime: Math.round(this.tailTime * 10) / 10,
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
    this.sound.setRotor(this.state === 'playing' && this.world.helicopters.length > 0);
    this.sound.setMusic(this.state === 'playing');
    this.sound.update(dt);

    drawGame(this.ctx, this);
    this.input.endFrame();
  }

  updatePlaying(dt) {
    this.timeSinceCrime += dt;
    this.dayTime += DAY_HOURS_PER_SEC * dt;
    if (this.dayTime >= 24) this.dayTime -= 24;
    if (this.crimeCd > 0) this.crimeCd -= dt;
    if (this.ramCd > 0) this.ramCd -= dt;
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.spookCd > 0) this.spookCd -= dt;
    if (this.player.punchCd > 0) this.player.punchCd -= dt;
    if (this.flash.ttl > 0) this.flash.ttl -= dt;
    if (this.muzzle) {
      this.muzzle.ttl -= dt;
      if (this.muzzle.ttl <= 0) this.muzzle = null;
    }

    this.updatePlayer(dt);
    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updatePolice(dt);
    this.updateHelis(dt);
    this.updateBullets(dt);
    this.updateCourier(dt);
    if (this.state !== 'playing') return; // busted mid-update (ram / foot cop)
    this.updatePickups(dt);

    // A helicopter overhead keeps the spotlight on you: the heat cannot
    // cool while one is within 350m. Outrun the spotlight, then lay low.
    const heliNear = this.world.helicopters.some(
      (h) => dist(h.x, h.y, this.player.x, this.player.y) < 350
    );
    if (heliNear) this.timeSinceCrime = Math.min(this.timeSinceCrime, 2);

    // Wanted slowly cools off when the player stays clean; Vex's radios
    // make it cool 40% faster.
    const coolAfter = 14 * (this.hasCrew('vex') ? 0.6 : 1);
    if (this.wanted > 0 && this.timeSinceCrime > coolAfter && !heliNear) {
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
      // Mara the mechanic triples healing once she has joined.
      this.player.hp = Math.min(100, this.player.hp + (this.hasCrew('mara') ? 9 : 3) * dt);
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
      if (m.stops) {
        const stop = m.stops[this.stopIndex];
        if (stop && dist(this.player.x, this.player.y, stop.x, stop.y) < 75) {
          this.stopIndex += 1;
          this.sound.blip(990, 0.1);
          if (this.stopIndex >= m.stops.length) {
            this.completeMission();
          } else {
            this.addFlash(
              `Stop ${this.stopIndex}/${m.stops.length} — next: ${m.stops[this.stopIndex].label}`,
              2.5
            );
          }
        }
      } else if (m.tail) {
        const c = this.world.courier;
        if (c) {
          const d = dist(this.player.x, this.player.y, c.x, c.y);
          if (d < 35) {
            this.tailTime = 0;
            if (this.spookCd <= 0) {
              this.spookCd = 3;
              this.addFlash('Too close — the courier spooked! Back off.', 3);
            }
          } else if (d < m.tailRange) {
            this.tailTime += dt;
            if (this.tailTime >= m.tailTime) this.completeMission();
          } else if (d > 420) {
            this.tailTime = Math.max(0, this.tailTime - dt * 2);
          }
        }
      } else if (m.carTarget) {
        const special = m.aurora ? this.world.auroraCar : this.world.targetCar;
        if (
          this.player.inCar &&
          this.player.car === special &&
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

  updateCourier(dt) {
    const c = this.world.courier;
    if (!c) return;
    const wp = c.route[c.seg];
    const d = dist(c.x, c.y, wp.x, wp.y);
    if (d < 20) {
      c.seg = (c.seg + 1) % c.route.length;
      return;
    }
    c.angle = angleTo(c.x, c.y, wp.x, wp.y);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
  }

  updateHelis(dt) {
    const desired = this.wanted >= 5 ? 2 : this.wanted >= 4 ? 1 : 0;
    if (this.world.helicopters.length > desired) {
      this.world.helicopters.length = desired;
    }
    if (this.world.helicopters.length < desired) {
      this.heliSpawnT -= dt;
      if (this.heliSpawnT <= 0) {
        this.heliSpawnT = 2.5;
        this.spawnHeliNear();
      }
    }
    for (const h of this.world.helicopters) {
      h.rotor += dt * 22;
      h.bob += dt * 2;
      const d = dist(h.x, h.y, this.player.x, this.player.y);
      if (d > 4) {
        const step = Math.min(d, HELI_SPEED * dt);
        h.x += ((this.player.x - h.x) / d) * step;
        h.y += ((this.player.y - h.y) / d) * step;
      }
    }
  }

  fireBullet() {
    const p = this.player;
    const wx = this.input.mouse.x + this.cam.x;
    const wy = this.input.mouse.y + this.cam.y;
    const a = angleTo(p.x, p.y, wx, wy);
    this.aimAngle = a;
    this.world.bullets.push({
      x: p.x + Math.cos(a) * 20,
      y: p.y + Math.sin(a) * 20,
      vx: Math.cos(a) * BULLET_SPEED,
      vy: Math.sin(a) * BULLET_SPEED,
      life: 0.9,
    });
    this.muzzle = { x: p.x + Math.cos(a) * 26, y: p.y + Math.sin(a) * 26, ttl: 0.07 };
    this.fireCd = FIRE_CD;
    this.sound.shoot();
    p.angle = a;
  }

  updateBullets(dt) {
    const bullets = this.world.bullets;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || circleHitsBuildings(this.world.buildings, b.x, b.y, 2);
      if (!dead) {
        for (const h of this.world.helicopters) {
          if (dist(b.x, b.y, h.x, h.y) < 42) {
            h.hp -= 1;
            dead = true;
            if (h.hp <= 0) {
              this.world.helicopters.splice(this.world.helicopters.indexOf(h), 1);
              this.cash += HELI_BOUNTY;
              this.sound.explosion();
              this.addFlash(`Helicopter down! +$${HELI_BOUNTY}`, 3);
            }
            break;
          }
        }
      }
      if (!dead) {
        for (const pc of this.world.policeCars) {
          if (dist(b.x, b.y, pc.x, pc.y) < 34) {
            pc.slow = 1.5;
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const fc of this.world.footCops) {
          if (fc.down <= 0 && dist(b.x, b.y, fc.x, fc.y) < 26) {
            fc.down = 5;
            dead = true;
            if (this.crimeCd <= 0) {
              this.crimeCd = 5;
              this.commitCrime(1);
            }
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of this.world.peds) {
          if (ped.down <= 0 && dist(b.x, b.y, ped.x, ped.y) < 22) {
            ped.down = 4;
            ped.flee = 6;
            dead = true;
            if (this.crimeCd <= 0) {
              this.crimeCd = 5;
              this.commitCrime(1);
              this.addFlash('You shot a pedestrian! Wanted +1', 2.5);
            }
            break;
          }
        }
      }
      if (dead) bullets.splice(i, 1);
    }
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
      // Rook the getaway driver: +12% top speed, sharper steering.
      const topSpeed = CAR_MAX_SPEED * (this.hasCrew('rook') ? 1.12 : 1);
      const steerRate = 2.4 * (this.hasCrew('rook') ? 1.15 : 1);
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
      if (!circleHitsBuildings(this.world.buildings, nx, ny, 20) && !circleHitsWater(nx, ny, 20)) {
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
      const blocked = (x, y) =>
        circleHitsBuildings(this.world.buildings, x, y, 13) || circleHitsWater(x, y, 13);
      if (!blocked(nx, p.y)) p.x = nx;
      if (!blocked(p.x, ny)) p.y = ny;
      p.x = clamp(p.x, 20, WORLD_W - 20);
      p.y = clamp(p.y, 20, WORLD_H - 20);
      p.angle = Math.atan2(my, mx);
    }

    // Pistol: aim with the mouse, click (or hold) to fire.
    if (this.armed && this.fireCd <= 0 && (inp.wasClicked() || inp.mouse.down)) {
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
    // Beachgoers never leave the sand.
    if (ped.beach) {
      ped.tx = range(this.rng, SAND_X0 + 16, SAND_X1 - 12);
      ped.ty = clamp(ped.y + (this.rng() * 500 - 250), 120, WORLD_H - 120);
      return;
    }
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
      const blocked =
        circleHitsBuildings(this.world.buildings, nx, ny, 10) || circleHitsWater(nx, ny, 10);
      if (!blocked) {
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
      // A bullet slows a cruiser down for a while.
      if (pc.slow > 0) pc.slow -= dt;
      const sp = (250 + this.wanted * 18) * (pc.slow > 0 ? 0.45 : 1);
      const nx = pc.x + Math.cos(pc.angle) * sp * dt;
      const ny = pc.y + Math.sin(pc.angle) * sp * dt;
      if (!circleHitsBuildings(this.world.buildings, nx, ny, 20) && !circleHitsWater(nx, ny, 20)) {
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
      // A shot officer stays down for a while, then gets back up.
      if (fc.down > 0) {
        fc.down -= dt;
        continue;
      }
      const d = dist(fc.x, fc.y, this.player.x, this.player.y);
      if (d < 26) {
        this.busted('Caught by a VCPD officer on foot.');
        return;
      }
      if (d > 4) {
        const step = Math.min(d, 138 * dt);
        const nx = fc.x + ((this.player.x - fc.x) / d) * step;
        const ny = fc.y + ((this.player.y - fc.y) / d) * step;
        if (!circleHitsBuildings(this.world.buildings, nx, ny, 10) && !circleHitsWater(nx, ny, 10)) {
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
