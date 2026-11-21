// All canvas drawing: city, cars, people, HUD, minimap, and full-screen states.
import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROADS_V, ROADS_H, ROAD_W, PALETTE, SAND_X, WATER_X, BOARDWALK_X } from './config.js';
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

function drawHeli(ctx, h, px, py) {
  // Searchlight cone sweeping down toward the player.
  const a = Math.atan2(py - h.y, px - h.x);
  const bobY = Math.sin(h.bob) * 6;
  const grad = ctx.createLinearGradient(h.x, h.y + bobY, px, py);
  grad.addColorStop(0, 'rgba(255,240,170,0.30)');
  grad.addColorStop(1, 'rgba(255,240,170,0.02)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(h.x, h.y + bobY);
  const spread = 0.22;
  ctx.lineTo(px + Math.cos(a + spread) * 60, py + Math.sin(a + spread) * 60);
  ctx.lineTo(px + Math.cos(a - spread) * 60, py + Math.sin(a - spread) * 60);
  ctx.closePath();
  ctx.fill();
  // Body, tail, and spinning rotor.
  ctx.save();
  ctx.translate(h.x, h.y + bobY);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 26, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d2b3a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9fc4e8';
  ctx.beginPath();
  ctx.ellipse(10, -2, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d2b3a';
  ctx.fillRect(-34, -3, 14, 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3;
  const ra = h.rotor;
  ctx.beginPath();
  ctx.moveTo(Math.cos(ra) * 34, Math.sin(ra) * 34);
  ctx.lineTo(-Math.cos(ra) * 34, -Math.sin(ra) * 34);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(Math.cos(ra + Math.PI / 2) * 34, Math.sin(ra + Math.PI / 2) * 34);
  ctx.lineTo(-Math.cos(ra + Math.PI / 2) * 34, -Math.sin(ra + Math.PI / 2) * 34);
  ctx.stroke();
  // HP pips.
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < h.hp ? '#e74c3c' : '#555';
    ctx.fillRect(-14 + i * 10, -22, 8, 4);
  }
  ctx.restore();
}

function drawHeadlights(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(255,230,150,0.10)';
  ctx.beginPath();
  ctx.moveTo(24, -8);
  ctx.lineTo(190, -52);
  ctx.lineTo(190, 52);
  ctx.lineTo(24, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCity(ctx, g) {
  const w = g.world;
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

  // The bay: sand strip, boardwalk, open water with animated foam, a pier,
  // palms and umbrellas along the east edge.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(SAND_X, 0, WATER_X - SAND_X, WORLD_H);
  ctx.fillStyle = PALETTE.boardwalk;
  ctx.fillRect(BOARDWALK_X - 14, 0, 28, WORLD_H);
  ctx.fillStyle = '#a07d46';
  for (let y = 0; y < WORLD_H; y += 46) ctx.fillRect(BOARDWALK_X - 14, y, 28, 3);
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(WATER_X, 0, WORLD_W - WATER_X, WORLD_H);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(WATER_X, 0, 26, WORLD_H);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let y = 0; y < WORLD_H; y += 26) {
    const wob = Math.sin(y * 0.02 + g.time * 1.6) * 7;
    ctx.fillRect(WATER_X - 4 + wob, y, 10, 5);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    const wx = WATER_X + 34 + k * 14 + Math.sin(g.time * 0.9 + k * 1.7) * 5;
    ctx.beginPath();
    for (let y = 0; y <= WORLD_H; y += 48) {
      const xx = wx + Math.sin(y * 0.03 + g.time * 1.2 + k) * 6;
      if (y === 0) ctx.moveTo(xx, y);
      else ctx.lineTo(xx, y);
    }
    ctx.stroke();
  }
  // Beach pier at the harbor end of the bay.
  ctx.fillStyle = PALETTE.boardwalk;
  ctx.fillRect(BOARDWALK_X - 14, 1900, WATER_X - BOARDWALK_X + 14, 40);
  ctx.fillStyle = '#a07d46';
  for (let x = BOARDWALK_X - 10; x < WATER_X; x += 18) ctx.fillRect(x, 1900, 10, 40);
  // Palms and umbrellas dotted along the sand.
  for (let i = 0; i < 9; i++) {
    const px = SAND_X + 18 + ((i * 37) % 56);
    const py = 180 + i * 240 + ((i * 53) % 90);
    ctx.strokeStyle = '#7a5a2e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 6, py - 26);
    ctx.stroke();
    ctx.fillStyle = '#2f7d32';
    for (let f = 0; f < 5; f++) {
      const fa = (f / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(px + 6 + Math.cos(fa) * 12, py - 26 + Math.sin(fa) * 7, 13, 5, fa, 0, Math.PI * 2);
      ctx.fill();
    }
    const ux = px + 34;
    const uy = py + 40;
    ctx.fillStyle = ['#ff6b9d', '#ffd93d', '#6bcbff'][i % 3];
    ctx.beginPath();
    ctx.arc(ux, uy, 15, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#5a4a2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ux, uy);
    ctx.lineTo(ux, uy - 16);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.sidewalk;
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
        if ((c * 3 + r * 7 + b.windows) % 4 === 0) continue;
        ctx.fillRect(b.x + 14 + c * 46, b.y + 14 + r * 46, 12, 12);
      }
    }
  }

  // After dark, more windows glow and the streetlamps come on.
  const phase = g.dayPhase();
  if (phase.night > 0.15) {
    for (const b of w.buildings) {
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 46));
      ctx.fillStyle = `rgba(255,214,120,${0.55 * phase.night})`;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if ((c * 5 + r * 3 + b.windows) % 3 !== 0) continue;
          ctx.fillRect(b.x + 14 + c * 46, b.y + 14 + r * 46, 12, 12);
        }
      }
    }
    ctx.fillStyle = `rgba(255,220,140,${0.1 * phase.night})`;
    for (const x of ROADS_V) {
      for (const y of ROADS_H) {
        ctx.beginPath();
        ctx.arc(x + 40, y - 40, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,230,160,${0.85 * phase.night})`;
        ctx.beginPath();
        ctx.arc(x + 40, y - 40, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,220,140,${0.1 * phase.night})`;
      }
    }
  }

  // Harbor Dock pier + Sunset Garage + North Market landmarks.
  ctx.fillStyle = '#8a6d3b';
  ctx.fillRect(2900, 2100, 110, 16);
  ctx.fillRect(2900, 2124, 110, 16);
  ctx.fillStyle = '#a07d46';
  for (let x = 2904; x < 3010; x += 18) ctx.fillRect(x, 2100, 10, 40);
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
  // The bay on the minimap.
  ctx.fillStyle = '#c2a878';
  ctx.fillRect(mx + SAND_X * sx, my, (WATER_X - SAND_X) * sx, mh);
  ctx.fillStyle = '#1b5f7a';
  ctx.fillRect(mx + WATER_X * sx, my, (WORLD_W - WATER_X) * sx, mh);
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
  for (const pc of g.world.policeCars) {
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(mx + pc.x * sx, my + pc.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const h of g.world.helicopters) {
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(mx + h.x * sx, my + h.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const cour = g.world.courier;
  ctx.fillStyle = '#e67e22';
  ctx.beginPath();
  ctx.arc(mx + cour.x * sx, my + cour.y * sy, 3, 0, Math.PI * 2);
  ctx.fill();
  if (g.world.auroraCar.parked) {
    ctx.fillStyle = '#00d5e8';
    ctx.beginPath();
    ctx.arc(mx + g.world.auroraCar.x * sx, my + g.world.auroraCar.y * sy, 3, 0, Math.PI * 2);
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
  ctx.fillText('DAX MERCER — VELVET BAY', 30, 68);
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

  // Clock + crew strip.
  const phase = g.dayPhase();
  ctx.fillStyle = 'rgba(8,12,18,0.78)';
  rr(ctx, 16, 124, 320, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${g.clockText()} · ${phase.name}`, 28, 144);
  ctx.fillStyle = '#c8d0dc';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('CREW  VEX · ROOK · MARA', 158, 144);

  drawMinimap(ctx, g);

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
    if (m.id === 2 && g.missionTimer > 0) extra = `  —  ${Math.ceil(g.missionTimer)}s left`;
    if (m.id === 7) extra = `  —  ${Math.floor(g.tailTime)}s / 20s tailed`;
    if (m.id === 8) {
      extra = g.wanted >= 3 ? `  —  survive ${Math.ceil(g.getawayT)}s` : '  —  get to 3 stars to start the clock';
    }
    if (m.stops) extra = `  —  stop ${Math.min(g.stopIndex + 1, m.stops.length)} of ${m.stops.length}`;
    const marker = g.missionMarker();
    if (marker) {
      const d = Math.round(dist(g.player.x, g.player.y, marker.x, marker.y) / 10);
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
  ctx.fillText(g.player.inCar ? 'DRIVING' : g.isArmed() ? 'ON FOOT · MOUSE TO AIM' : 'WASD MOVE · SHIFT RUN', 30, VIEW_H - 24);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(200,208,220,0.85)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(
    g.isArmed()
      ? 'WASD move · E steal / exit car · SPACE punch · MOUSE aim + fire · P pause'
      : 'WASD move · E steal / exit car · SPACE punch · P pause',
    VIEW_W - 16,
    VIEW_H - 84
  );

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
  for (const fc of w.footCops) drawPed(ctx, fc.x, fc.y, '#2c4a7c', 0, Math.atan2(g.player.y - fc.y, g.player.x - fc.x));

  // The Aurora GT, parked and waiting for the finale.
  if (w.auroraCar.parked) {
    const pulse = 30 + Math.sin(g.time * 4) * 5;
    ctx.strokeStyle = 'rgba(0,213,232,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w.auroraCar.x, w.auroraCar.y, pulse, 0, Math.PI * 2);
    ctx.stroke();
    drawCar(ctx, w.auroraCar.x, w.auroraCar.y, w.auroraCar.angle, w.auroraCar.color, {});
  }

  // The courier for the tail job, briefcase in hand.
  const cour = w.courier;
  drawPed(ctx, cour.x, cour.y, '#e67e22', 0, cour.angle);
  ctx.fillStyle = '#7a4a12';
  ctx.fillRect(cour.x - 4, cour.y - 14, 8, 6);

  // Beachgoers on the sand.
  for (const b of w.beachgoers) {
    drawPed(ctx, b.x, b.y, b.color, b.down, Math.atan2(b.ty - b.y, b.tx - b.x));
  }

  // Helicopters with their searchlights.
  for (const h of w.helicopters) drawHeli(ctx, h, g.player.x, g.player.y);

  // Bullets: bright tracers.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  for (const b of w.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Current stop crate for multi-stop missions.
  const mm = g.currentMission();
  if (mm && mm.stops) {
    const stop = mm.stops[g.stopIndex];
    if (stop) {
      ctx.fillStyle = '#f5c518';
      ctx.fillRect(stop.x - 10, stop.y - 10, 20, 20);
      ctx.fillStyle = '#7a5a00';
      ctx.fillRect(stop.x - 10, stop.y - 2, 20, 4);
    }
  }

  // Player.
  const pl = g.player;
  if (pl.inCar && pl.car) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pl.car.x, pl.car.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    drawCar(ctx, pl.car.x, pl.car.y, pl.car.angle, pl.car.color, { gold: !!pl.car.gold });
  } else {
    drawPed(ctx, pl.x, pl.y, '#1abc9c', 0, pl.angle);
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
      ctx.fillText(near.gold ? 'E — STEAL COMET GT' : near.aurora ? 'E — STEAL AURORA GT' : 'E — STEAL CAR', pl.x, pl.y - 33);
      ctx.textAlign = 'left';
    }
    // Muzzle flash toward the aim point.
    if (g.muzzleT > 0) {
      const aim = Math.atan2(g.mouseWorld.y - pl.y, g.mouseWorld.x - pl.x);
      ctx.fillStyle = 'rgba(255,240,170,0.9)';
      ctx.beginPath();
      ctx.arc(pl.x + Math.cos(aim) * 26, pl.y + Math.sin(aim) * 26, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    // Aim reticle at the mouse while the pistol is out.
    if (g.isArmed() && g.state === 'playing') {
      const mx = g.mouseWorld.x;
      const my = g.mouseWorld.y;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 14, my);
      ctx.lineTo(mx - 6, my);
      ctx.moveTo(mx + 6, my);
      ctx.lineTo(mx + 14, my);
      ctx.moveTo(mx, my - 14);
      ctx.lineTo(mx, my - 6);
      ctx.moveTo(mx, my + 6);
      ctx.lineTo(mx, my + 14);
      ctx.stroke();
    }
  }

  // Headlight cones after dark.
  const nightNow = g.dayPhase().night;
  if (nightNow > 0.15) {
    if (pl.inCar && pl.car) drawHeadlights(ctx, pl.car.x, pl.car.y, pl.car.angle);
    for (const t of w.traffic) {
      const tp = trafficPos(t);
      drawHeadlights(ctx, tp.x, tp.y, tp.angle);
    }
    for (const pc of w.policeCars) drawHeadlights(ctx, pc.x, pc.y, pc.angle);
  }
  ctx.restore();

  // Day/night tint over the whole view.
  const phase = g.dayPhase();
  let tint = null;
  if (phase.name === 'DAWN') tint = 'rgba(255,170,90,0.08)';
  else if (phase.name === 'GOLDEN HOUR') tint = 'rgba(255,140,60,0.14)';
  else if (phase.name === 'DUSK') tint = 'rgba(80,60,140,0.18)';
  else if (phase.name === 'NIGHT') tint = 'rgba(8,10,40,0.38)';
  if (tint) {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

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
        'Steal cars, dodge the VCPD, and run nine jobs across Velvet Bay.',
        'Jobs: The Pickup · The Drop · Hot Wheels · Lose the Heat · The Gun Runner',
        'Three Stashes · The Tail · The Getaway · King of the Bay',
        'Crew: Vex (heat fades faster) · Rook (faster car) · Mara (tougher Dax)',
        '',
        'WASD / arrows — move & drive      SHIFT — run      MOUSE — aim & fire',
        'E — steal / exit a car      SPACE — punch      P — pause',
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
    overlay(
      ctx,
      'STORY COMPLETE',
      [
        'Nine jobs. Zero witnesses that matter. Velvet Bay is yours, Dax.',
        'Vex · Rook · Mara — the crew that made it happen.',
        '',
        `Final cash: $${g.cash}`,
      ],
      '#2ecc71',
      'PRESS ENTER TO KEEP PLAYING'
    );
  }
}
