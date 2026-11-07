// Keyboard fallback + merging with phone input.
const KEYMAP = [
  { left: ['KeyA'], right: ['KeyD'], jump: ['KeyW', 'Space'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], jump: ['ArrowUp'] },
  { left: ['KeyJ'], right: ['KeyL'], jump: ['KeyI'] },
  { left: ['Numpad4'], right: ['Numpad6'], jump: ['Numpad8'] }
];

export class InputManager {
  constructor(network) {
    this.network = network;
    this.keys = new Set();
    this.jumpQueued = [false, false, false, false];
    this.onShortcut = null;
    this.enabled = true;

    window.addEventListener('keydown', (event) => this.handleKeyDown(event));
    window.addEventListener('keyup', (event) => this.handleKeyUp(event));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
  }

  handleKeyDown(event) {
    const code = event.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    this.keys.add(code);

    for (let i = 0; i < 4; i++) {
      if (KEYMAP[i].jump.includes(code)) this.jumpQueued[i] = true;
    }
    if (this.onShortcut) this.onShortcut(code, event);
  }

  handleKeyUp(event) {
    this.keys.delete(event.code);
  }

  clear() {
    this.keys.clear();
    this.jumpQueued = [false, false, false, false];
    for (const input of this.network.inputs) input.jumpQueued = false;
  }

  isDown(codes) {
    return codes.some((code) => this.keys.has(code));
  }

  keyboardInput(index) {
    const map = KEYMAP[index];
    return {
      left: this.isDown(map.left),
      right: this.isDown(map.right),
      jump: this.isDown(map.jump)
    };
  }

  poll(index) {
    const pad = this.network.poll(index, performance.now());
    const keys = this.keyboardInput(index);
    const jumpPressed = this.jumpQueued[index] || this.network.consumeJump(index);
    this.jumpQueued[index] = false;
    return {
      left: keys.left || pad.left,
      right: keys.right || pad.right,
      jump: keys.jump || pad.jump,
      jumpPressed
    };
  }
}
