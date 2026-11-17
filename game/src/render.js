// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 view is scaled to fit the window and centred; the camera
// follows the player across the city. Flat shapes and canvas text only.
import { CAR, FONT, PALETTE, PLAYER, ROADS_X, ROADS_Y, ROAD_W, VIEW, WATER_Y, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

/** The centred panel used by the title, pause, busted and complete screens. */
const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
/** The minimap's box, in view coordinates. */
const MINIMAP = { x: 1052, y: 16, w: 212, h: 160 };

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  /** Fit the 1280x720 view into the window, keeping its aspect ratio. */
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  /** One line of text, with a cached bold font per size. */
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    ctx.font = fonts.get(size);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'alphabetic';
    ctx.fillText(value, x, y);
  }

  /** The top-left corner of the world the camera shows, following the player. */
  function camera(state) {
    const p = state.player;
    return {
      x: clamp(p.x - VIEW.width / 2, 0, WORLD.width - VIEW.width),
      y: clamp(p.y - VIEW.height / 2, 0, WORLD.height - VIEW.height),
    };
  }

  // ---- shapes ----

  /** A car seen from above, nose pointing along `angle`. */
  function drawCar(x, y, angle, color, isPolice, flash) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Soft shadow, offset down-right.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    // Body.
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(20,28,38,0.9)';
    ctx.beginPath();
    ctx.roundRect(-8, -CAR.width / 2 + 5, 22, CAR.width - 10, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.55)';
    ctx.fillRect(10, -CAR.width / 2 + 6, 5, CAR.width - 12);
    // Headlights at the nose, taillights at the back.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 3, 3, 6);
    ctx.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 9, 3, 6);
    ctx.fillStyle = '#ff4b3e';
    ctx.fillRect(-CAR.length / 2, -CAR.width / 2 + 3, 3, 6);
    ctx.fillRect(-CAR.length / 2, CAR.width / 2 - 9, 3, 6);
    // A police car flashes its light bar red and blue.
    if (isPolice) {
      ctx.fillStyle = flash ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
      ctx.beginPath();
      ctx.arc(-2, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** A person seen from above: a shirt circle and a head, facing `angle`. */
  function drawPerson(x, y, angle, shirt, down) {
    ctx.save();
    ctx.translate(x, y);
    if (down > 0) {
      // Knocked flat: lying on their side.
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(7, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- the world ----

  function drawWorld(state, cam) {
    const flash = Math.floor(state.elapsed * 4) % 2 === 0;
    // Grass, then the harbour water and its pier.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(cam.x, cam.y, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(cam.x, Math.max(cam.y, WATER_Y), VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.waterDark;
    for (let y = WATER_Y + 24; y < WORLD.height; y += 48) {
      ctx.fillRect(cam.x, y, VIEW.width, 3);
    }
    ctx.fillStyle = PALETTE.pier;
    ctx.fillRect(1440, 2080, 120, 200);
    ctx.fillStyle = '#7a5f42';
    for (let y = 2096; y < 2280; y += 24) ctx.fillRect(1440, y, 120, 3);
    // Parks.
    for (const park of state.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Roads, with dashed centre lines.
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WATER_Y);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    ctx.fillStyle = PALETTE.lane;
    for (const rx of ROADS_X) {
      for (let y = 20; y < WATER_Y; y += 56) ctx.fillRect(rx - 2, y, 4, 26);
    }
    for (const ry of ROADS_Y) {
      for (let x = 20; x < WORLD.width; x += 56) ctx.fillRect(x, ry - 2, 26, 4);
    }
    // Buildings: a dark edge, a coloured roof, a lighter slab, lit windows.
    for (const b of state.buildings) {
      ctx.fillStyle = PALETTE.buildingEdge;
      ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = PALETTE.window;
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if (Math.sin(b.seed * 91 + i * 7.3 + j * 3.1) > 0.1) {
            ctx.fillRect(b.x + 14 + i * 34, b.y + 14 + j * 34, 10, 8);
          }
        }
      }
    }
    // Trees: a dark offset circle under a green one.
    for (const t of state.trees) {
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath();
      ctx.arc(t.x + 2, t.y + 3, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cash pickups: bobbing green coins with a $ on them.
    for (const pickup of state.pickups) {
      if (!pickup.active) continue;
      const bob = Math.sin(state.elapsed * 3 + pickup.x) * 3;
      ctx.fillStyle = PALETTE.cash;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y + bob, 11, 0, Math.PI * 2);
      ctx.fill();
      text('$', pickup.x, pickup.y + bob + 5, 15, '#12351a', 'center', 'middle');
    }
    // The mission marker: a pulsing yellow diamond where the job is.
    const mission = state.missionIndex < 4 ? state.missionTarget : null;
    if (mission && mission.x != null) {
      const pulse = 1 + 0.15 * Math.sin(state.elapsed * 5);
      ctx.save();
      ctx.translate(mission.x, mission.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(18, 0);
      ctx.lineTo(0, 26);
      ctx.lineTo(-18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5a4300';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Cars, police, people — the player's car last, on top, with a ring.
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      drawCar(car.x, car.y, car.angle, car.color, false, flash);
    }
    for (const cop of state.policeCars) drawCar(cop.x, cop.y, cop.angle, cop.color, true, flash);
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.down);
    for (const cop of state.cops) drawPerson(cop.x, cop.y, cop.angle, '#1c3a5e', 0);
    const p = state.player;
    if (p.car) {
      drawCar(p.car.x, p.car.y, p.car.angle, p.car.color, false, flash);
      ctx.strokeStyle = PALETTE.player;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.car.x, p.car.y, 42, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      drawPerson(p.x, p.y, p.angle, PALETTE.playerShirt, 0);
      ctx.strokeStyle = PALETTE.player;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---- the HUD ----

  /** An arrow at the screen edge pointing at an off-screen mission marker. */
  function drawMarkerArrow(state, cam) {
    const mission = state.missionIndex < 4 ? state.missionTarget : null;
    if (!mission || mission.x == null) return;
    const tx = mission.x;
    const ty = mission.y;
    if (tx > cam.x && tx < cam.x + VIEW.width && ty > cam.y && ty < cam.y + VIEW.height) return;
    const cx = clamp(tx, cam.x + 40, cam.x + VIEW.width - 40);
    const cy = clamp(ty, cam.y + 40, cam.y + VIEW.height - 40);
    const ang = Math.atan2(ty - (cam.y + VIEW.height / 2), tx - (cam.x + VIEW.width / 2));
    const d = Math.round(Math.hypot(tx - state.player.x, ty - state.player.y));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    text(`${d}m`, cx, cy + 30, 15, PALETTE.marker, 'center');
  }

  function drawMinimap(state) {
    const scaleX = MINIMAP.w / WORLD.width;
    const scaleY = MINIMAP.h / WORLD.height;
    ctx.fillStyle = 'rgba(8,10,14,0.85)';
    ctx.fillRect(MINIMAP.x - 4, MINIMAP.y - 4, MINIMAP.w + 8, MINIMAP.h + 8);
    ctx.fillStyle = '#1d2b1f';
    ctx.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(MINIMAP.x, MINIMAP.y + WATER_Y * scaleY, MINIMAP.w, MINIMAP.h - WATER_Y * scaleY);
    ctx.strokeStyle = '#8a8f98';
    ctx.lineWidth = 2;
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(MINIMAP.x + rx * scaleX, MINIMAP.y);
      ctx.lineTo(MINIMAP.x + rx * scaleX, MINIMAP.y + WATER_Y * scaleY);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(MINIMAP.x, MINIMAP.y + ry * scaleY);
      ctx.lineTo(MINIMAP.x + MINIMAP.w, MINIMAP.y + ry * scaleY);
      ctx.stroke();
    }
    const mission = state.missionIndex < 4 ? state.missionTarget : null;
    if (mission && mission.x != null) {
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(MINIMAP.x + mission.x * scaleX, MINIMAP.y + mission.y * scaleY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of state.policeCars) {
      ctx.fillStyle = PALETTE.policeLightBlue;
      ctx.beginPath();
      ctx.arc(MINIMAP.x + cop.x * scaleX, MINIMAP.y + cop.y * scaleY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(MINIMAP.x + p.x * scaleX, MINIMAP.y + p.y * scaleY, 4, 0, Math.PI * 2);
    ctx.fill();
    // The camera's viewport, as a white rectangle.
    const cam = camera(state);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      MINIMAP.x + cam.x * scaleX, MINIMAP.y + cam.y * scaleY,
      VIEW.width * scaleX, VIEW.height * scaleY,
    );
    text('VELVET BAY', MINIMAP.x + MINIMAP.w / 2, MINIMAP.y + MINIMAP.h + 18, 13, '#9aa0aa', 'center');
  }

  function drawHud(state, cam) {
    const p = state.player;
    // Top left: cash and a health bar.
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(16, 14, 250, 64);
    text(`Cash $${state.cash}`, 28, 40, 24, PALETTE.hudText, 'left');
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(28, 52, 180, 12);
    ctx.fillStyle = p.hp > 40 ? PALETTE.cash : PALETTE.danger;
    ctx.fillRect(28, 52, 180 * Math.max(0, p.hp / PLAYER.hp), 12);
    text('HP', 258, 64, 14, PALETTE.hudText, 'right');
    // Wanted stars, top centre.
    const starW = 30;
    const total = 5 * starW;
    const sx = (VIEW.width - total) / 2;
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(sx - 12, 14, total + 24, 40);
    for (let i = 0; i < 5; i += 1) {
      text('★', sx + i * starW + 15, 44, 26, i < state.wanted ? PALETTE.danger : '#555a63', 'center');
    }
    // Speed and car health, under the cash panel, while driving.
    if (p.car) {
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(16, 86, 250, 40);
      const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
      text(`${kmh} km/h  •  Car HP ${Math.max(0, Math.round(p.car.hp))}`, 28, 114, 20, PALETTE.hudText, 'left');
    }
    // The current job, bottom left — or the free-roam line when the story is done.
    const mission = state.missionIndex < 4 ? state.missionTarget : null;
    if (mission) {
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(16, VIEW.height - 96, 560, 80);
      text(mission.title, 28, VIEW.height - 66, 20, PALETTE.hudAccent, 'left');
      text(mission.text, 28, VIEW.height - 38, 16, PALETTE.hudText, 'left');
      if (state.missionIndex === 1) {
        text(`${Math.ceil(state.missionTimer)}s`, 560, VIEW.height - 66, 22, state.missionTimer < 20 ? PALETTE.danger : PALETTE.hudText, 'left');
      }
    } else if (state.storyComplete) {
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect(16, VIEW.height - 96, 560, 80);
      text('Story complete — Velvet Bay is yours.', 28, VIEW.height - 66, 20, PALETTE.hudAccent, 'left');
      text('Free roam: steal cars, dodge the VCPD, grab cash.', 28, VIEW.height - 38, 16, PALETTE.hudText, 'left');
    }
    // A toast message, centred near the top, while it lasts.
    if (state.toast && state.elapsed < state.toastUntil) {
      const w = ctx.measureText(state.toast).width + 32;
      ctx.fillStyle = PALETTE.hudBg;
      ctx.fillRect((VIEW.width - w) / 2, 66, w, 36);
      text(state.toast, VIEW.width / 2, 91, 19, PALETTE.hudText, 'center');
    }
    drawMarkerArrow(state, cam);
    drawMinimap(state);
  }

  // ---- full screens ----

  /** A centred panel: a big title, a few lines, and a prompt at the bottom. */
  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = 'rgba(12,14,20,0.92)';
    ctx.fillRect(x, y, PANEL.width, height);
    ctx.strokeStyle = accent || PALETTE.hudAccent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, PANEL.width, height);
    ctx.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 46, PALETTE.hudText, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, '#b9bec7', 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 22, accent || PALETTE.hudAccent, 'center');
  }

  /** Paint one frame: the city, then the HUD or a panel for the screen. */
  function draw(state, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cam = camera(state);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x - cam.x * view.scale, view.y - cam.y * view.scale);
    drawWorld(state, cam);
    // HUD and panels live in view space, not world space.
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Dax Mercer is back in Velvet Bay — broke, wanted, and out of options.',
        'Steal cars. Outrun the VCPD. Run four jobs for the Fixer.',
        'WASD / arrows — move & drive    E — steal car / interact',
        'Space — punch    Shift — run    P — pause    M — mute',
        best > 0 ? `Best cash $${best}` : 'Your save: cash and story progress are kept in this browser.',
      ];
      const panelHeight = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
      drawPanel('VELVET BAY', lines, best > 0 ? `Press Enter — Continue ($${best} banked)` : 'Press Enter or click to start', PALETTE.hudAccent);
      text('STREET HEAT', VIEW.width / 2, (VIEW.height - panelHeight) / 2 + 118, 20, PALETTE.hudAccent, 'center');
      return;
    }
    drawHud(state, cam);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The VCPD will wait for you. Probably.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('BUSTED', [state.bustReason || 'The VCPD caught up with you.', `Cash kept: $${state.cash}  •  Jobs done: ${state.missionIndex} of 4`], 'Press Enter to get back out there');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('STORY COMPLETE', ['All four jobs done. Velvet Bay is yours, Dax.', `Cash: $${state.cash}`], 'Press Enter to keep roaming free');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
