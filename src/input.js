const KEYS = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'fire',
  KeyJ: 'fire',
  ShiftLeft: 'bomb',
  ShiftRight: 'bomb',
  KeyB: 'bomb',
  KeyH: 'hyper',
  Enter: 'start',
  KeyP: 'pause',
  Escape: 'pause',
  KeyM: 'mute',
};

// Tracks held actions plus one-shot presses that are cleared after each fixed update.
export class Input {
  constructor() {
    this.down = new Set();
    this.hits = new Set();
    window.addEventListener('keydown', (e) => {
      const a = KEYS[e.code];
      if (!a) return;
      e.preventDefault();
      if (!e.repeat) this.hits.add(a);
      this.down.add(a);
    });
    window.addEventListener('keyup', (e) => {
      const a = KEYS[e.code];
      if (!a) return;
      e.preventDefault();
      this.down.delete(a);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  held(a) {
    return this.down.has(a);
  }

  pressed(a) {
    return this.hits.has(a);
  }

  press(a) {
    this.hits.add(a);
  }

  endFrame() {
    this.hits.clear();
  }

  // On-screen buttons for touch devices: <button data-action="fire"> etc.
  bindTouch(root) {
    if (!root) return;
    for (const btn of root.querySelectorAll('[data-action]')) {
      const a = btn.dataset.action;
      const release = () => this.down.delete(a);
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture?.(e.pointerId);
        this.down.add(a);
        this.hits.add(a);
      });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }
}
