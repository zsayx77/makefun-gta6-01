// Keyboard and pointer input. Movement keys are read as a held set; the
// one-shot presses (confirm, pause, interact, punch, mute) are queued as
// bit flags and collected once per frame, so a press that lands between two
// frames is neither lost nor counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;

const KEY_UP = ['ArrowUp', 'KeyW'];
const KEY_DOWN = ['ArrowDown', 'KeyS'];
const KEY_LEFT = ['ArrowLeft', 'KeyA'];
const KEY_RIGHT = ['ArrowRight', 'KeyD'];
const KEY_RUN = ['ShiftLeft', 'ShiftRight'];
const KEY_CONFIRM = ['Enter'];
const KEY_PAUSE = ['KeyP', 'Escape'];
const KEY_INTERACT = ['KeyE'];
const KEY_PUNCH = ['Space'];
const KEY_MUTE = ['KeyM'];

/** True when any code of the list is currently held down. */
function anyHeld(held, codes) {
  for (const code of codes) if (held.has(code)) return true;
  return false;
}

export function createInput(target) {
  const held = new Set();
  let queued = 0;

  window.addEventListener('keydown', (event) => {
    const code = event.code;
    if (KEY_UP.includes(code) || KEY_DOWN.includes(code) || KEY_LEFT.includes(code)
      || KEY_RIGHT.includes(code) || KEY_RUN.includes(code)) {
      held.add(code);
    } else if (KEY_CONFIRM.includes(code)) {
      if (!event.repeat) queued |= ACTION_CONFIRM;
    } else if (KEY_PAUSE.includes(code)) {
      if (!event.repeat) queued |= ACTION_PAUSE;
    } else if (KEY_INTERACT.includes(code)) {
      if (!event.repeat) queued |= ACTION_INTERACT;
    } else if (KEY_PUNCH.includes(code)) {
      if (!event.repeat) queued |= ACTION_PUNCH;
    } else if (KEY_MUTE.includes(code)) {
      if (!event.repeat) queued |= ACTION_MUTE;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key let go while the tab is hidden never sends keyup: drop everything on blur.
  window.addEventListener('blur', () => held.clear());
  // A click or tap on the canvas counts as confirm (start the game).
  target.addEventListener('pointerdown', () => {
    queued |= ACTION_CONFIRM;
  });

  return {
    /** The move vector: x is left/right (or steering), y is up/down (or gas/brake). */
    move() {
      return {
        x: (anyHeld(held, KEY_RIGHT) ? 1 : 0) - (anyHeld(held, KEY_LEFT) ? 1 : 0),
        y: (anyHeld(held, KEY_DOWN) ? 1 : 0) - (anyHeld(held, KEY_UP) ? 1 : 0),
        run: anyHeld(held, KEY_RUN),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
