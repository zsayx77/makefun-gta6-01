// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 view is scaled to fit the window and centred; the camera pans
// over the city and follows the player. Flat shapes and canvas text only.
import { CAR, FONT, PALETTE, PLAYER, ROADS_X, ROADS_Y, ROAD_W, VIEW, WATER_Y, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const MINIMAP = { x: 1052, y: 16, w: 212, h: 160 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const cashLabel = cachedLabel('Cash $');
  const speedLabel = cachedLabel('');
  const missionLabel = cachedLabel('');
  const timerLabel = cachedLabel('');
  const bestLabel = cachedLabel('Best cash $');

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

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function camera(state) {
    const p = state.player;
    return {
      x: Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2)),
      y: Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2)),
    };
  }

  function drawCar(x, y, angle, color, isPolice, flash) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    // Body.
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    context.fill();
    // Cabin + windshield.
    context.fillStyle = 'rgba(20,28,38,0.9)';
    context.beginPath();
    context.roundRect(-8, -CAR.width / 2 + 5, 22, CAR.width - 10, 5);
    context.fill();
    context.fillStyle = 'rgba(180,220,255,0.55)';
    context.fillRect(10, -CAR.width / 2 + 6, 5, CAR.width - 12);
    // Headlights / taillights.
    context.fillStyle = '#fff6c9';
    context.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 3, 3, 6);
    context.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 9, 3, 6);
    context.fillStyle = '#ff4b3e';
    context.fillRect(-CAR.length / 2, -CAR.width / 2 + 3, 3, 6);
    context.fillRect(-CAR.length / 2, CAR.width / 2 - 9, 3, 6);
    if (isPolice) {
      context.fillStyle = flash ? PALETTE.policeLightRed : PALETTE.policeLightBlue;
      context.beginPath();
      context.arc(-2, 0, 6, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawPerson(x, y, angle, shirt, down) {
    context.save();
    context.translate(x, y);
    if (down > 0) {
      context.rotate(Math.PI / 2);
      context.fillStyle = shirt;
      context.beginPath();
      context.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.rotate(angle);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(2, 3, 12, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f2c9a0';
    context.beginPath();
    context.arc(7, 0, 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawWorld(state, cam) {
    const flash = Math.floor(state.elapsed * 4) % 2 === 0;
    // Ground.
    context.fillStyle = PALETTE.grass;
    context.fillRect(cam.x, cam.y, VIEW.width, VIEW.height);
    // Water + pier.
    context.fillStyle = PALETTE.water;
    context.fillRect(cam.x, Math.max(cam.y, WATER_Y), VIEW.width, VIEW.height);
    context.fillStyle = PALETTE.waterDark;
    for (let y = WATER_Y + 24; y < WORLD.height; y += 48) {
      context.fillRect(cam.x, y, VIEW.width, 3);
    }
    context.fillStyle = '#8a6f4d';
    context.fillRect(1440, 2080, 120, 200);
    context.fillStyle = '#7a5f42';
    for (let y = 2096; y < 2280; y += 24) context.fillRect(1440, y, 120, 3);
    // Parks.
    for (const park of state.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
    }
    // Roads.
    context.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) context.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WATER_Y);
    for (const ry of ROADS_Y) context.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    // Lane dashes.
    context.fillStyle = PALETTE.lane;
    for (const rx of ROADS_X) {
      for (let y = 20; y < WATER_Y; y += 56) context.fillRect(rx - 2, y, 4, 26);
    }
    for (const ry of ROADS_Y) {
      for (let x = 20; x < WORLD.width; x += 56) context.fillRect(x, ry - 2, 26, 4);
    }
    // Buildings.
    for (const b of state.buildings) {
      context.fillStyle = PALETTE.buildingEdge;
      context.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      // Roof detail: a lighter inner slab + a few lit windows.
      context.fillStyle = 'rgba(255,255,255,0.08)';
      context.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      context.fillStyle = PALETTE.window;
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          const on = Math.sin(b.seed * 91 + i * 7.3 + j * 3.1) > 0.1;
          if (on) context.fillRect(b.x + 14 + i * 34, b.y + 14 + j * 34, 10, 8);
        }
      }
    }
    // Trees.
    for (const t of state.trees) {
      context.fillStyle = PALETTE.treeDark;
      context.beginPath();
      context.arc(t.x + 2, t.y + 3, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.tree;
      context.beginPath();
      context.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      context.fill();
    }
    // Cash pickups.
    for (const pickup of state.pickups) {
      if (!pickup.active) continue;
      const bob = Math.sin(state.elapsed * 3 + pickup.x) * 3;
      context.fillStyle = PALETTE.cash;
      context.beginPath();
      context.arc(pickup.x, pickup.y + bob, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#12351a';
      text('$', pickup.x, pickup.y + bob + 5, 15, '#12351a', 'center', 'middle');
    }
    // Mission marker.
    const mission = state.missionIndex < 4 ? state.missionTarget : null;
    if (mission && mission.x != null) {
      const pulse = 1 + 0.15 * Math.sin(state.elapsed * 5);
      context.save();
      context.translate(mission.x, mission.y);
      context.scale(pulse, pulse);
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.moveTo(0, -26);
      context.lineTo(18, 0);
      context.lineTo(0, 26);
      context.lineTo(-18, 0);
      context.closePath();
      context.fill();
      context.fillStyle = '#5a4300';
      context.beginPath();
      context.arc(0, 0, 7, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    // Parked + traffic cars.
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      drawCar(car.x, car.y, car.angle, car.color, false, flash);
    }
    // Police cars.
    for (const cop of state.policeCars) drawCar(cop.x, cop.y, cop.angle, cop.color, true, flash);
    // Pedestrians.
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.color, ped.down);
    // Foot cops.
    for (const cop of state.cops) drawPerson(cop.x, cop.y, cop.angle, '#1c3a5e', 0);
    // Player.
    const p = state.player;
    if (p.car) {
      drawCar(p.car.x, p.car.y, p.car.angle, p.car.color, false, flash);
      // Driver marker ring.
      context.strokeStyle = PALETTE.player;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(p.car.x, p.car.y, 42, 0, Math.PI * 2);
      context.stroke();
    } else {
      drawPerson(p.x, p.y, p.angle, PALETTE.playerShirt, 0);
      context.strokeStyle = PALETTE.player;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(p.x, p.y, 20, 0, Math.PI * 2);
      context.stroke();
    }
  }

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
    context.save();
    context.translate(cx, cy);
    context.rotate(ang);
    context.fillStyle = PALETTE.marker;
    context.beginPath();
    context.moveTo(18, 0);
    context.lineTo(-10, -12);
    context.lineTo(-10, 12);
    context.closePath();
    context.fill();
    context.restore();
    text(`${d}m`, cx, cy + 30, 15, PALETTE.marker, 'center');
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function drawHud(state, cam) {
    const p = state.player;
    // Top-left panel: cash + health.
    context.fillStyle = PALETTE.hudBg;
    context.fillRect(16, 14, 250, 64);
    text(cashLabel(state.cash), 28, 40, 24, PALETTE.hudText, 'left');
    context.fillStyle = '#3a3f47';
    context.fillRect(28, 52, 180, 12);
    context.fillStyle = p.hp > 40 ? PALETTE.cash : PALETTE.danger;
    context.fillRect(28, 52, 180 * Math.max(0, p.hp / PLAYER.hp), 12);
    text('HP', 258, 64, 14, PALETTE.hudText, 'right');
    // Wanted stars, top centre.
    const starW = 30;
    const total = 5 * starW;
    const sx = (VIEW.width - total) / 2;
    context.fillStyle = PALETTE.hudBg;
    context.fillRect(sx - 12, 14, total + 24, 40);
    for (let i = 0; i < 5; i += 1) {
      text('★', sx + i * starW + 15, 44, 26, i < state.wanted ? PALETTE.danger : '#555a63', 'center');
    }
    if (p.car) {
      context.fillStyle = PALETTE.hudBg;
      context.fillRect(16, 86, 250, 40);
      const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
      text(speedLabel(`${kmh} km/h  •  Car HP ${Math.max(0, Math.round(p.car.hp))}`), 28, 114, 20, PALETTE.hudText, 'left');
    }
    // Mission objective, bottom left.
    const mission = state.missionIndex < 4 ? state.missionTarget : null;
    if (mission) {
      context.fillStyle = PALETTE.hudBg;
      const lines = [mission.title, mission.text];
      context.fillRect(16, VIEW.height - 96, 560, 80);
      text(mission.title, 28, VIEW.height - 66, 20, PALETTE.hudAccent, 'left');
      text(mission.text, 28, VIEW.height - 38, 16, PALETTE.hudText, 'left');
      if (state.missionIndex === 1) {
        text(timerLabel(`${Math.ceil(state.missionTimer)}s`), 560, VIEW.height - 66, 22, state.missionTimer < 20 ? PALETTE.danger : PALETTE.hudText, 'left');
      }
    } else if (state.storyComplete) {
      context.fillStyle = PALETTE.hudBg;
      context.fillRect(16, VIEW.height - 96, 560, 80);
      text('Story complete — Velvet Bay is yours.', 28, VIEW.height - 66, 20, PALETTE.hudAccent, 'left');
      text('Free roam: steal cars, dodge the VCPD, grab cash.', 28, VIEW.height - 38, 16, PALETTE.hudText, 'left');
    }
    // Toast.
    if (state.toast && state.elapsed < state.toastUntil) {
      context.fillStyle = PALETTE.hudBg;
      const w = context.measureText(state.toast).width + 32;
      context.fillRect((VIEW.width - w) / 2, 66, w, 36);
      text(state.toast, VIEW.width / 2, 91, 19, PALETTE.hudText, 'center');
    }
    drawMarkerArrow(state, cam);
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const scaleX = MINIMAP.w / WORLD.width;
    const scaleY = MINIMAP.h / WORLD.height;
    context.fillStyle = 'rgba(8,10,14,0.85)';
    context.fillRect(MINIMAP.x - 4, MINIMAP.y - 4, MINIMAP.w + 8, MINIMAP.h + 8);
    context.fillStyle = '#1d2b1f';
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    context.fillStyle = PALETTE.water;
    context.fillRect(MINIMAP.x, MINIMAP.y + WATER_Y * scaleY, MINIMAP.w, MINIMAP.h - WATER_Y * scaleY);
    context.strokeStyle = '#8a8f98';
    context.lineWidth = 2;
    for (const rx of ROADS_X) {
      context.beginPath();
      context.moveTo(MINIMAP.x + rx * scaleX, MINIMAP.y);
      context.lineTo(MINIMAP.x + rx * scaleX, MINIMAP.y + WATER_Y * scaleY);
      context.stroke();
    }
    for (const ry of ROADS_Y) {
      context.beginPath();
      context.moveTo(MINIMAP.x, MINIMAP.y + ry * scaleY);
      context.lineTo(MINIMAP.x + MINIMAP.w, MINIMAP.y + ry * scaleY);
      context.stroke();
    }
    const mission = state.missionIndex < 4 ? state.missionTarget : null;
    if (mission && mission.x != null) {
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.arc(MINIMAP.x + mission.x * scaleX, MINIMAP.y + mission.y * scaleY, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const cop of state.policeCars) {
      context.fillStyle = PALETTE.policeLightBlue;
      context.beginPath();
      context.arc(MINIMAP.x + cop.x * scaleX, MINIMAP.y + cop.y * scaleY, 3, 0, Math.PI * 2);
      context.fill();
    }
    const p = state.player;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(MINIMAP.x + p.x * scaleX, MINIMAP.y + p.y * scaleY, 4, 0, Math.PI * 2);
    context.fill();
    // Viewport rectangle.
    const cam = camera(state);
    context.strokeStyle = 'rgba(255,255,255,0.6)';
    context.lineWidth = 1;
    context.strokeRect(
      MINIMAP.x + cam.x * scaleX, MINIMAP.y + cam.y * scaleY,
      VIEW.width * scaleX, VIEW.height * scaleY,
    );
    text('VELVET BAY', MINIMAP.x + MINIMAP.w / 2, MINIMAP.y + MINIMAP.h + 18, 13, '#9aa0aa', 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = 'rgba(12,14,20,0.92)';
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || PALETTE.hudAccent;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 46, PALETTE.hudText, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, '#b9bec7', 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 22, accent || PALETTE.hudAccent, 'center');
  }

  /** Paint one frame: the city, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b0d12';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const cam = camera(state);
    context.setTransform(view.scale, 0, 0, view.scale, view.x - cam.x * view.scale, view.y - cam.y * view.scale);
    drawWorld(state, cam);
    // HUD and panels live in view space, not world space.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Dax Mercer is back in Velvet Bay — broke, wanted, and out of options.',
        'Steal cars. Outrun the VCPD. Run four jobs for the Fixer.',
        'WASD / arrows — move & drive    E — steal car / interact',
        'Space — punch    Shift — run    P — pause    M — mute',
        '',
      ];
      lines[4] = best > 0 ? bestLabel(best) : 'Your save: cash and story progress are kept in this browser.';
      drawPanel('VELVET BAY', lines, state.hasSave ? 'Press Enter — Continue ($' + best + ' banked)' : 'Press Enter or click to start', PALETTE.hudAccent);
      text('STREET HEAT', VIEW.width / 2, (VIEW.height - (PANEL.top + lines.length * PANEL.line + PANEL.bottom)) / 2 + 118, 20, PALETTE.hudAccent, 'center');
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
