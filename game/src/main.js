// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, busted and story complete. Cash and story progress are saved
// to localStorage after every mission and every bust.
//
// ?seed=N fixes the city layout. ?shot=start|play|mission|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice, and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { mulberry32 } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_COMPLETE, EVENT_CRASH, EVENT_MISSION, EVENT_PICKUP, EVENT_PUNCH } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(mulberry32(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
// Debug handle for automated play-testing (read-only state inspection).
let screenNow = () => SCREEN_TITLE;
window.__velvet = { world, get screen() { return screenNow(); } };

/** The saved game, or null when there is none or it does not parse. */
function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.cash !== 'number' || typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

/** Write the world's cash and story progress to localStorage. */
function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData()));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

let save = readSave();
if (save) {
  world.applySave(save);
  world.state.hasSave = true;
}

/** Stage one screenshot scene and paint it twice, then signal readiness. */
function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  screenNow = () => screen;
  let accumulator = 0;
  let last = performance.now();
  // Interact/punch presses wait here until a fixed step runs: a frame
  // shorter than one step must never swallow a press.
  let pendingWorld = 0;

  /** The line a screen reader announces. */
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    if (save) world.applySave(save);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    const mission = world.currentMission();
    announce(mission ? `Playing. Job: ${mission.title}.` : 'Playing. Free roam.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    save = world.saveData();
    saveGame();
    audio.busted();
    announce(`Busted. ${world.state.bustReason} Cash $${world.state.cash}.`);
  }

  /** The one-shot presses: mute anywhere, start/resume on the menu screens, pause in play. */
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_COMPLETE)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  /** One fixed step on the current screen, with sounds and saves on events. */
  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, run: false }, 0, true);
      return;
    }
    const worldActions = (actions & ACTION_INTERACT ? 4 : 0) | (actions & ACTION_PUNCH ? 8 : 0);
    const events = world.step(STEP, input.move(), worldActions, false);
    if (events & EVENT_BUSTED) endGame();
    else if (events & EVENT_COMPLETE) {
      screen = SCREEN_COMPLETE;
      save = world.saveData();
      saveGame();
      audio.mission();
      announce('Story complete. Velvet Bay is yours.');
    } else if (events & EVENT_MISSION) {
      save = world.saveData();
      saveGame();
      audio.mission();
      announce(world.state.toast);
    }
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_CRASH) audio.crash();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    pendingWorld |= actions & (ACTION_INTERACT | ACTION_PUNCH);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      // One-shot presses act on the first fixed step only, so a slow frame
      // never double-uses one press (enter a car, then instantly step out).
      let stepActions = pendingWorld;
      let stepped = false;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(stepActions);
        stepActions = 0;
        stepped = true;
        accumulator -= STEP;
      }
      if (stepped) pendingWorld = 0;
    } else {
      accumulator = 0;
      pendingWorld = 0;
    }
    const p = world.state.player;
    const speed01 = p.car ? Math.abs(p.car.speed) / 560 : p.speed > 0 ? 0.15 : 0;
    audio.update(STEP, screen === SCREEN_PLAY ? speed01 : 0, world.state.wanted);
    renderer.draw(world.state, screen, save ? save.cash : 0);
  }

  // Leaving the tab pauses a running game rather than letting the VCPD close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Velvet Bay, Street Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
