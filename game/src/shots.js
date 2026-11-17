// The screenshot scenes behind ?shot=start|play|mission|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a waypoint autopilot that follows the roads, so the frame is
// what a short game really looks like and the same seed always gives the
// same frame.
import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 3;
const MISSION_SECONDS = 3;

/** Steer a car along waypoints (road intersections) toward the target. */
function waypointDrive(world, waypoints) {
  const car = world.state.player.car;
  if (!car) return { x: 0, y: 0, run: false };
  let wp = waypoints[0];
  for (let i = 0; i < waypoints.length; i += 1) {
    const d = Math.hypot(waypoints[i].x - car.x, waypoints[i].y - car.y);
    if (d > 70) { wp = waypoints[i]; break; }
    wp = waypoints[waypoints.length - 1];
  }
  const desired = Math.atan2(wp.y - car.y, wp.x - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return { x: Math.max(-1, Math.min(1, diff * 2.5)), y: -1, run: false };
}

/**
 * Set `world` to the named scene (start, play, mission or end; any other name
 * is start) and return the screen to draw over it and the best cash to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'mission' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0, run: false }, 0, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    world.forceBusted('Busted by the VCPD.');
    world.state.policeCars.push({
      kind: 'police', x: 1180, y: 1280, angle: Math.PI / 2, speed: 0,
      color: '#2f6fb2', hp: 100, ramCooldown: 0, copCooldown: 0,
    });
    world.state.cops.push({ x: 1150, y: 1330, angle: 0, speed: 0, color: '#1c3a5e', stagger: 0, punchTimer: 0 });
    world.state.cash = 450;
    return { screen: SCREEN_OVER, best: 450 };
  }
  if (name === 'mission') {
    world.setMission(1, 47);
    world.state.cash = 200;
    world.placePlayerInCar(700, 1900, -Math.PI / 2, '#3d7ad9');
    for (let index = 0; index < MISSION_SECONDS / STEP; index += 1) {
      world.step(STEP, waypointDrive(world, [{ x: 700, y: 300 }, { x: 300, y: 300 }]), 0, false);
    }
    return { screen: SCREEN_PLAY, best: 200 };
  }
  // play: driving east along 11th Street with a 1-star wanted level.
  world.state.wanted = 1;
  world.state.timeSinceCrime = 0;
  world.placePlayerInCar(1100, 1100, 0, '#d94f3d');
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    world.step(STEP, waypointDrive(world, [{ x: 2700, y: 1100 }]), 0, false);
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
