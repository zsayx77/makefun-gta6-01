// All canvas drawing: city, coast, cars, people, helicopters, HUD, minimap,
// day/night light, and full-screen states.
import {
  VIEW_W,
  VIEW_H,
  WORLD_W,
  WORLD_H,
  ROADS_V,
  ROADS_H,
  ROAD_W,
  PALETTE,
  SAND_X0,
  SAND_X1,
  WATER_RECTS,
} from './config.js';
import { clamp, dist } from './random.js';
import { trafficPos } from './world.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function drawCar(ctx, x, y, angle, color, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, -20, -8, 46, 24, 6);
  ctx.fill();
  ctx.fillStyle = color;
  rr(ctx, -23, -12, 46, 24, 7);
  ctx.fill();
  if (opts.police) {
    ctx.fillStyle = '#ecf0f1';
    ctx.fillRect(-6, -12, 14, 24);
    const blink = Math.floor(opts.time * 4) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2d2d' : '#2d7dff';
    ctx.beginPath();
    ctx.arc(-2, -8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#2d7dff' : '#ff2d2d';
    ctx.beginPath();
    ctx.arc(-2, 8, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (opts.gold) {
    ctx.strokeStyle = '#fff2b0';
    ctx.lineWidth = 2;
    rr(ctx, -23, -12, 46, 24, 7);
    ctx.stroke();
  }
  if (opts.aurora) {
    ctx.strokeStyle = '#ffb3d9';
    ctx.lineWidth = 2;
    rr(ctx, -23, -12, 46, 24, 7);
    ctx.stroke();
  }
  ctx.fillStyle = '#20242b';
  rr(ctx, -9, -10, 15, 20, 3);
  ctx.fill();
  ctx.fillStyle = '#9fc4e8';
  rr(ctx, 6, -9, 8, 18, 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(21, -10, 3, 5);
  ctx.fillRect(21, 5, 3, 5);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(-24, -10, 3, 5);
  ctx.fillRect(-24, 5, 3, 5);
  ctx.restore();
}

function drawPed(ctx, x, y, color, down, angle) {
  ctx.save();
  ctx.translate(x, y);
  if (down > 0) {
    ctx.rotate(1.2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.arc(1, 2, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(angle || 0) * 12, Math.sin(angle || 0) * 12);
  ctx.stroke();
  ctx.restore();
}

function drawHeli(ctx, x, y, h, time, px, py, nightF) {
  // Ground shadow, offset below the aircraft.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 30, 24, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Searchlight cone toward the player, stronger after dark.
  const d = Math.hypot(px - x, py - y);
  if (d > 10) {
    const a = Math.atan2(py - y, px - x);
    const perp = a + Math.PI / 2;
    const w = 26;
    ctx.fillStyle = `rgba(255,244,180,${0.1 + nightF * 0.16})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(px + Math.cos(perp) * w, py + Math.sin(perp) * w);
    ctx.lineTo(px - Math.cos(perp) * w, py - Math.sin(perp) * w);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,244,180,${0.25 + nightF * 0.3})`;
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  // Body + tail + spinning rotor + blinking beacon.
  ctx.save();
  ctx.translate(x, y + Math.sin(h.bob) * 3);
  ctx.fillStyle = '#2c4a7c';
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a2f52';
  ctx.fillRect(-44, -3, 22, 6);
  ctx.fillStyle = '#9fc4e8';
  ctx.beginPath();
  ctx.ellipse(8, -2, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,235,240,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(h.rotor) * 34, Math.sin(h.rotor) * 8);
  ctx.lineTo(-Math.cos(h.rotor) * 34, -Math.sin(h.rotor) * 8);
  ctx.stroke();
  ctx.fillStyle = Math.floor(time * 3) % 2 === 0 ? '#ff2d2d' : '#7a0d0d';
  ctx.beginPath();
  ctx.arc(-20, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VCPD', 0, 3);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawCity(ctx, g) {
  const w = g.world;
  const phase = g.dayPhase();
  const nightF = phase.name === 'NIGHT' ? 1 : phase.name === 'DUSK' ? 0.6 : phase.name === 'DAWN' ? 0.3 : 0;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.fillStyle = PALETTE.grassAlt;
  for (let gx = 0; gx < WORLD_W; gx += 320) {
    for (let gy = 0; gy < WORLD_H; gy += 320) {
      if (((gx + gy) / 320) % 2 === 0) ctx.fillRect(gx, gy, 320, 320);
    }
  }

  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const x of ROADS_V) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const y of ROADS_H) ctx.fillRect(0, y - ROAD_W / 2, WORLD_W, ROAD_W);
  ctx.fillStyle = PALETTE.sidewalk;
  for (const x of ROADS_V) {
    ctx.fillRect(x - ROAD_W / 2 - 8, 0, 8, WORLD_H);
    ctx.fillRect(x + ROAD_W / 2, 0, 8, WORLD_H);
  }
  for (const y of ROADS_H) {
    ctx.fillRect(0, y - ROAD_W / 2 - 8, WORLD_W, 8);
    ctx.fillRect(0, y + ROAD_W / 2, WORLD_W, 8);
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const x of ROADS_V) {
    for (let y = 24; y < WORLD_H; y += 92) ctx.fillRect(x - 2, y, 4, 40);
  }
  for (const y of ROADS_H) {
    for (let x = 24; x < WORLD_W; x += 92) ctx.fillRect(x, y - 2, 40, 4);
  }

  // The bay coast: sand, boardwalk, water with rolling waves, pier, palms.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(SAND_X0, 0, SAND_X1 - SAND_X0, WORLD_H);
  ctx.fillStyle = PALETTE.sandDark;
  for (let sy = 40; sy < WORLD_H; sy += 130) {
    ctx.fillRect(SAND_X0 + 12, sy, 8, 4);
    ctx.fillRect(SAND_X0 + 44, sy + 60, 8, 4);
  }
  // Boardwalk planks along the sand.
  ctx.fillStyle = '#8a6d3b';
  ctx.fillRect(SAND_X0 + 6, 0, 30, WORLD_H);
  ctx.fillStyle = '#6e562e';
  for (let by = 0; by < WORLD_H; by += 26) ctx.fillRect(SAND_X0 + 6, by, 30, 2);
  // Water + foam + waves.
  for (const wr of WATER_RECTS) {
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(wr.x, wr.y, wr.w, wr.h);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let wy = 30; wy < wr.h; wy += 90) ctx.fillRect(wr.x + 18, wy, wr.w - 36, 10);
  }
  ctx.strokeStyle = PALETTE.foam;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let wy = 0; wy <= WORLD_H; wy += 24) {
    const wx = SAND_X1 - 2 + Math.sin(wy / 90 + g.time * 1.4) * 4;
    if (wy === 0) ctx.moveTo(wx, wy);
    else ctx.lineTo(wx, wy);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(234,246,255,0.5)';
  ctx.lineWidth = 2;
  for (const wr of WATER_RECTS) {
    for (let wy = 60; wy < wr.h; wy += 120) {
      ctx.beginPath();
      for (let wx = wr.x + 8; wx <= wr.x + wr.w - 8; wx += 10) {
        const yy = wy + Math.sin(wx / 26 + g.time * 2 + wy) * 3;
        if (wx === wr.x + 8) ctx.moveTo(wx, yy);
        else ctx.lineTo(wx, yy);
      }
      ctx.stroke();
    }
  }
  // Palms and beach umbrellas.
  for (const palm of w.palms) {
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + palm.lean * 30, palm.y - 26 * palm.s);
    ctx.stroke();
    ctx.fillStyle = PALETTE.palm;
    for (let f = 0; f < 5; f++) {
      const fa = (f / 5) * Math.PI * 2 + palm.lean;
      ctx.beginPath();
      ctx.ellipse(
        palm.x + palm.lean * 30 + Math.cos(fa) * 12,
        palm.y - 26 * palm.s + Math.sin(fa) * 8,
        12,
        5,
        fa,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
  for (const um of w.umbrellas) {
    ctx.fillStyle = um.color;
    ctx.beginPath();
    ctx.arc(um.x, um.y, 16, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#5a4632';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(um.x, um.y);
    ctx.lineTo(um.x, um.y + 14);
    ctx.stroke();
  }

  // Parks.
  for (const p of w.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#3a7d3c';
    for (let i = 0; i < 5; i++) {
      const tx = p.x + 30 + ((i * 53) % Math.max(40, p.w - 60));
      const ty = p.y + 30 + ((i * 37) % Math.max(40, p.h - 60));
      ctx.beginPath();
      ctx.arc(tx, ty, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Buildings.
  for (const b of w.buildings) {
    ctx.fillStyle = shade(PALETTE.building, b.shade);
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = shade(PALETTE.building, b.shade * 1.18);
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = '#ffe9a8';
    const cols = Math.max(1, Math.floor(b.w / 46));
    const rows = Math.max(1, Math.floor(b.h / 46));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // After dark far more windows glow.
        const skipEvery = nightF > 0.5 ? 6 : 4;
        if ((c * 3 + r * 7 + b.windows) % skipEvery === 0) continue;
        ctx.fillRect(b.x + 14 + c * 46, b.y + 14 + r * 46, 12, 12);
      }
    }
  }

  // Streetlamps glow at every intersection after dark.
  if (nightF > 0) {
    for (const x of ROADS_V) {
      for (const y of ROADS_H) {
        ctx.fillStyle = `rgba(255,220,120,${0.35 * nightF})`;
        ctx.beginPath();
        ctx.arc(x + ROAD_W / 2 + 12, y - ROAD_W / 2 - 10, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,240,180,${0.8 * nightF})`;
        ctx.beginPath();
        ctx.arc(x + ROAD_W / 2 + 12, y - ROAD_W / 2 - 10, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Harbor Dock pier (runs out to the water's edge) + Sunset Garage + North Market.
  ctx.fillStyle = '#8a6d3b';
  ctx.fillRect(2900, 2100, 220, 16);
  ctx.fillRect(2900, 2124, 220, 16);
  ctx.fillStyle = '#a07d46';
  for (let x = 2904; x < 3120; x += 18) ctx.fillRect(x, 2100, 10, 40);
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HARBOR DOCK', 3010, 2090);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e67e22';
  ctx.fillRect(2600, 300, 100, 60);
  ctx.fillStyle = '#2c3e50';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GARAGE', 2650, 336);
  ctx.fillStyle = '#16a085';
  ctx.fillRect(450, 220, 100, 60);
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(450, 220, 100, 14);
  ctx.fillStyle = '#2c3e50';
  ctx.fillText('MARKET', 500, 262);
  ctx.textAlign = 'left';
}

function drawMinimap(ctx, g) {
  const mw = 224;
  const mh = 168;
  const mx = VIEW_W - mw - 16;
  const my = 16;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(8,12,18,0.85)';
  rr(ctx, mx, my, mw, mh, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  rr(ctx, mx, my, mw, mh, 8);
  ctx.stroke();
  ctx.strokeStyle = '#5a6270';
  ctx.lineWidth = 2;
  for (const x of ROADS_V) {
    ctx.beginPath();
    ctx.moveTo(mx + x * sx, my);
    ctx.lineTo(mx + x * sx, my + mh);
    ctx.stroke();
  }
  for (const y of ROADS_H) {
    ctx.beginPath();
    ctx.moveTo(mx, my + y * sy);
    ctx.lineTo(mx + mw, my + y * sy);
    ctx.stroke();
  }
  // The bay on the minimap: sand then water along the east edge.
  ctx.fillStyle = '#d9b380';
  ctx.fillRect(mx + SAND_X0 * sx, my, (SAND_X1 - SAND_X0) * sx, mh);
  ctx.fillStyle = '#1f6fb2';
  ctx.fillRect(mx + SAND_X1 * sx, my, mw - SAND_X1 * sx, mh);
  const marker = g.missionMarker();
  if (marker) {
    const pulse = 4 + Math.sin(g.time * 5) * 1.5;
    ctx.fillStyle = '#f5c518';
    ctx.beginPath();
    ctx.arc(mx + marker.x * sx, my + marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f5c518';
  ctx.beginPath();
  ctx.arc(mx + g.world.targetCar.x * sx, my + g.world.targetCar.y * sy, 3, 0, Math.PI * 2);
  ctx.fill();
  if (g.world.auroraCar.parked) {
    ctx.fillStyle = '#ff8fc7';
    ctx.beginPath();
    ctx.arc(mx + g.world.auroraCar.x * sx, my + g.world.auroraCar.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (g.world.courier) {
    ctx.fillStyle = '#b0b8c0';
    ctx.beginPath();
    ctx.arc(mx + g.world.courier.x * sx, my + g.world.courier.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pc of g.world.policeCars) {
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(mx + pc.x * sx, my + pc.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const h of g.world.helicopters) {
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath();
    ctx.arc(mx + h.x * sx, my + h.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + g.player.x * sx, my + g.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    mx + g.cam.x * sx,
    my + g.cam.y * sy,
    VIEW_W * sx,
    VIEW_H * sy
  );
}

function drawHUD(ctx, g) {
  ctx.fillStyle = 'rgba(8,12,18,0.78)';
  rr(ctx, 16, 16, 300, 96, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${g.cash}`, 30, 48);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#c8d0dc';
  const crewNames = g.crew().map((c) => c.name.toUpperCase());
  ctx.fillText(
    crewNames.length > 0 ? `DAX MERCER — VELVET BAY · CREW: ${crewNames.join(' · ')}` : 'DAX MERCER — VELVET BAY',
    30,
    68
  );
  // HP bar.
  ctx.fillStyle = '#333';
  rr(ctx, 30, 78, 150, 10, 5);
  ctx.fill();
  ctx.fillStyle = g.player.hp > 40 ? '#2ecc71' : '#e74c3c';
  rr(ctx, 30, 78, Math.max(0, 150 * (g.player.hp / 100)), 10, 5);
  ctx.fill();
  ctx.fillStyle = '#c8d0dc';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(g.player.hp)}`, 188, 87);
  // Wanted stars.
  ctx.font = '24px system-ui, sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < g.wanted ? '★' : '☆';
  ctx.fillStyle = '#f5c518';
  ctx.fillText(stars, 30, 106 - 0);
  ctx.fillStyle = '#c8d0dc';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(g.wanted === 0 ? 'CLEAN' : `WANTED LV ${g.wanted}`, 150, 100);

  drawMinimap(ctx, g);

  // Clock + time of day under the minimap.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`${g.dayClock()} · ${g.dayPhase().name}`, VIEW_W - 16, 208);
  ctx.fillStyle = '#c8d0dc';
  ctx.font = '12px system-ui, sans-serif';
  if (g.armed && !g.player.inCar) {
    ctx.fillText('PISTOL — AIM WITH MOUSE · CLICK TO FIRE', VIEW_W - 16, 226);
  } else if (g.armed) {
    ctx.fillText('PISTOL READY — GET OUT TO SHOOT', VIEW_W - 16, 226);
  }
  ctx.textAlign = 'left';

  // Mission panel.
  const m = g.currentMission();
  ctx.fillStyle = 'rgba(8,12,18,0.78)';
  rr(ctx, VIEW_W / 2 - 260, VIEW_H - 74, 520, 58, 10);
  ctx.fill();
  ctx.textAlign = 'center';
  if (m) {
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`MISSION ${m.id}: ${m.name}`, VIEW_W / 2, VIEW_H - 52);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    let extra = '';
    if (m.timer > 0 && g.missionTimer > 0) extra = `  —  ${Math.ceil(g.missionTimer)}s left`;
    if (m.stops) extra += `  —  stop ${g.stopIndex}/${m.stops.length}`;
    if (m.tail) extra += `  —  tail ${Math.floor(g.tailTime)}s / ${m.tailTime}s`;
    const mk = g.missionMarker();
    if (mk) {
      const d = Math.round(dist(g.player.x, g.player.y, mk.x, mk.y) / 10);
      extra += `  —  ${d}m`;
    }
    ctx.fillText(m.short + extra, VIEW_W / 2, VIEW_H - 32);
  } else {
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('ALL MISSIONS COMPLETE — VELVET BAY IS YOURS', VIEW_W / 2, VIEW_H - 40);
  }

  // Speed / on-foot readout.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(8,12,18,0.78)';
  rr(ctx, 16, VIEW_H - 74, 190, 58, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  if (g.player.inCar && g.player.car) {
    ctx.fillText(`${Math.round(Math.abs(g.player.car.speed) * 0.32)} mph`, 30, VIEW_H - 40);
  } else {
    ctx.fillText('ON FOOT', 30, VIEW_H - 40);
  }
  ctx.fillStyle = '#c8d0dc';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(g.player.inCar ? 'DRIVING' : 'WASD MOVE · SHIFT RUN', 30, VIEW_H - 24);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(200,208,220,0.85)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD move · E steal / exit car · SPACE punch · CLICK shoot · P pause', VIEW_W - 16, VIEW_H - 84);

  // Flash message.
  if (g.flash.ttl > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(8,12,18,0.7)';
    const tw = ctx.measureText(g.flash.text).width + 36;
    rr(ctx, VIEW_W / 2 - tw / 2, 120, tw, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(g.flash.text, VIEW_W / 2, 147);
  }
  ctx.textAlign = 'left';
}

function overlay(ctx, title, lines, accent, footer) {
  ctx.fillStyle = 'rgba(5,8,16,0.88)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(title, VIEW_W / 2, 220);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  let y = 280;
  for (const line of lines) {
    ctx.fillText(line, VIEW_W / 2, y);
    y += 34;
  }
  if (footer) {
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(footer, VIEW_W / 2, y + 30);
  }
  ctx.textAlign = 'left';
}

export function drawGame(ctx, g) {
  ctx.save();
  ctx.translate(-Math.round(g.cam.x), -Math.round(g.cam.y));
  drawCity(ctx, g);
  const w = g.world;

  // Mission marker beam.
  const marker = g.missionMarker();
  if (marker && g.state === 'playing') {
    const pulse = 26 + Math.sin(g.time * 5) * 6;
    ctx.fillStyle = 'rgba(245,197,24,0.25)';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, pulse + 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f5c518';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f5c518';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, marker.x, marker.y - pulse - 12);
    ctx.textAlign = 'left';
  }

  // Cash pickups.
  for (const p of w.pickups) {
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', p.x, p.y + 5);
    ctx.textAlign = 'left';
  }

  // Unvisited stash stops for the current multi-stop mission.
  const curM = g.currentMission();
  if (curM && curM.stops) {
    for (let i = g.stopIndex; i < curM.stops.length; i++) {
      const s = curM.stops[i];
      const pulse = 12 + Math.sin(g.time * 4 + i) * 2;
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath();
      ctx.arc(s.x, s.y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', s.x, s.y + 5);
      ctx.textAlign = 'left';
    }
  }

  // Parked cars + the gold target car.
  for (const c of w.parkedCars) drawCar(ctx, c.x, c.y, c.angle, c.color, {});
  if (w.targetCar.parked) {
    const pulse = 30 + Math.sin(g.time * 4) * 5;
    ctx.strokeStyle = 'rgba(245,197,24,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w.targetCar.x, w.targetCar.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    drawCar(ctx, w.targetCar.x, w.targetCar.y, w.targetCar.angle, w.targetCar.color, { gold: true });
  }
  if (w.auroraCar.parked) {
    const pulse = 30 + Math.sin(g.time * 4 + 2) * 5;
    ctx.strokeStyle = 'rgba(255,143,199,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w.auroraCar.x, w.auroraCar.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    drawCar(ctx, w.auroraCar.x, w.auroraCar.y, w.auroraCar.angle, w.auroraCar.color, { aurora: true });
  }

  // Traffic.
  for (const t of w.traffic) {
    const p = trafficPos(t);
    drawCar(ctx, p.x, p.y, p.angle, t.color, {});
  }

  // Pedestrians.
  for (const p of w.peds) {
    drawPed(ctx, p.x, p.y, p.color, p.down, p.down > 0 ? 0 : Math.atan2(p.ty - p.y, p.tx - p.x));
  }

  // Police.
  for (const pc of w.policeCars) drawCar(ctx, pc.x, pc.y, pc.angle, '#14181d', { police: true, time: g.time });
  for (const fc of w.footCops) drawPed(ctx, fc.x, fc.y, '#2c4a7c', fc.down || 0, Math.atan2(g.player.y - fc.y, g.player.x - fc.x));

  // The courier (mission 7) drives his loop, ringed so he is easy to tail.
  if (w.courier) {
    const c = w.courier;
    ctx.strokeStyle = 'rgba(176,184,192,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 32 + Math.sin(g.time * 3) * 3, 0, Math.PI * 2);
    ctx.stroke();
    drawCar(ctx, c.x, c.y, c.angle, c.color, {});
  }

  // Helicopters circle above the player, searchlights sweeping.
  const phase = g.dayPhase();
  const nightF = phase.name === 'NIGHT' ? 1 : phase.name === 'DUSK' ? 0.6 : phase.name === 'DAWN' ? 0.3 : 0;
  for (const h of w.helicopters) {
    drawHeli(ctx, h.x, h.y, h, g.time, g.player.x, g.player.y, nightF);
  }

  // Bullets + muzzle flash.
  for (const b of w.bullets) {
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  if (g.muzzle) {
    ctx.fillStyle = 'rgba(255,200,60,0.9)';
    ctx.beginPath();
    ctx.arc(g.muzzle.x, g.muzzle.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player.
  const pl = g.player;
  if (pl.inCar && pl.car) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pl.car.x, pl.car.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    drawCar(ctx, pl.car.x, pl.car.y, pl.car.angle, pl.car.color, { gold: !!pl.car.gold, aurora: !!pl.car.aurora });
    // Headlights after dark.
    if (nightF > 0.5) {
      const hx = pl.car.x + Math.cos(pl.car.angle) * 24;
      const hy = pl.car.y + Math.sin(pl.car.angle) * 24;
      const fa = pl.car.angle;
      ctx.fillStyle = 'rgba(255,244,180,0.18)';
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + Math.cos(fa - 0.35) * 150, hy + Math.sin(fa - 0.35) * 150);
      ctx.lineTo(hx + Math.cos(fa + 0.35) * 150, hy + Math.sin(fa + 0.35) * 150);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    drawPed(ctx, pl.x, pl.y, '#1abc9c', 0, pl.angle);
    // Pistol in hand: a short barrel toward the aim.
    if (g.armed) {
      ctx.strokeStyle = '#20242b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pl.x + Math.cos(g.aimAngle) * 8, pl.y + Math.sin(g.aimAngle) * 8);
      ctx.lineTo(pl.x + Math.cos(g.aimAngle) * 24, pl.y + Math.sin(g.aimAngle) * 24);
      ctx.stroke();
    }
    if (pl.punchCd > 0.22) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, 30, pl.angle - 0.7, pl.angle + 0.7);
      ctx.stroke();
    }
    // "E — steal" prompt near a parked car.
    const near = g.nearestStealable();
    if (near && g.state === 'playing') {
      ctx.fillStyle = 'rgba(8,12,18,0.85)';
      rr(ctx, pl.x - 62, pl.y - 52, 124, 28, 7);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(near.gold ? 'E — STEAL COMET GT' : 'E — STEAL CAR', pl.x, pl.y - 33);
      ctx.textAlign = 'left';
    }
  }
  ctx.restore();

  // Day / night light washes the whole scene (HUD stays crisp on top).
  const tint = g.dayPhase();
  ctx.fillStyle = tint.tint;
  ctx.globalAlpha = tint.alpha;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.globalAlpha = 1;

  drawHUD(ctx, g);

  if (g.state === 'title') {
    const saveLine = g.save
      ? `Save found: $${g.save.cash} · mission ${Math.min(g.save.missionIndex + 1, 9)} of 9 — press ENTER to continue`
      : 'No save yet — a fresh start in Velvet Bay';
    overlay(
      ctx,
      'VELVET BAY',
      [
        'S T R E E T   H E A T',
        '',
        'Dax Mercer just got out. The city owes him — and he plans to collect.',
        'Nine jobs across Velvet Bay — from the Harbor Dock to the Boardwalk,',
        'with Vex, Rook and Mara watching his back.',
        '',
        '1 The Pickup · 2 The Drop · 3 Hot Wheels · 4 Lose the Heat · 5 The Gun Runner',
        '6 Three Stashes · 7 The Tail · 8 The Getaway · 9 King of the Bay',
        '',
        'WASD / arrows — move & drive      SHIFT — run',
        'E — steal / exit a car      SPACE — punch      CLICK — shoot (after job 5)      P — pause',
        '',
        saveLine,
      ],
      '#f5c518',
      'PRESS ENTER TO START'
    );
  } else if (g.state === 'paused') {
    overlay(ctx, 'PAUSED', ['Take a breath, Dax. The city waits.', ''], '#c8d0dc', 'PRESS P TO RESUME');
  } else if (g.state === 'busted') {
    overlay(
      ctx,
      'BUSTED',
      [
        g.bustedReason || 'The VCPD caught up with you.',
        '',
        `Cash kept: $${g.cash}  ·  Missions done: ${g.missionIndex} of 9`,
        'The VCPD took a $100 cut for the trouble.',
      ],
      '#e74c3c',
      'PRESS ENTER TO CONTINUE'
    );
  } else if (g.state === 'complete') {
    const crewLine =
      g.crew().length > 0 ? `Crew: ${g.crew().map((c) => `${c.name} (${c.role})`).join(' · ')}` : 'Crew: just Dax.';
    overlay(
      ctx,
      'STORY COMPLETE',
      [
        'Nine jobs. Zero witnesses that matter. Velvet Bay is yours, Dax.',
        '',
        crewLine,
        `Final cash: $${g.cash}`,
      ],
      '#2ecc71',
      'PRESS ENTER TO KEEP PLAYING'
    );
  }
}
