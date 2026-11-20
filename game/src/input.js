// Keyboard state: held keys plus edge-triggered presses, cleared once per frame.
// Mouse: position in canvas pixels plus an edge-triggered click.
export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouse.down = false;
    });
    if (canvas) {
      const toGame = (e) => {
        const r = canvas.getBoundingClientRect();
        // Scale CSS pixels onto the canvas backing store (1280x720).
        return {
          x: ((e.clientX - r.left) * canvas.width) / r.width,
          y: ((e.clientY - r.top) * canvas.height) / r.height,
        };
      };
      canvas.addEventListener('mousemove', (e) => {
        const p = toGame(e);
        this.mouse.x = p.x;
        this.mouse.y = p.y;
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const p = toGame(e);
        this.mouse.x = p.x;
        this.mouse.y = p.y;
        if (!this.mouse.down) this.mouse.clicked = true;
        this.mouse.down = true;
      });
      window.addEventListener('mouseup', () => {
        this.mouse.down = false;
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  isDown(...codes) {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  wasClicked() {
    return this.mouse.clicked;
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
