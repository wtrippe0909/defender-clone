import { Game } from './game.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { FONT } from './config.js';

const canvas = document.getElementById('screen');
const input = new Input();
input.bindTouch(document.getElementById('touch'));
const sfx = new Sfx();
const game = new Game(canvas, input, sfx);
window.__defender = game; // handy for debugging from the console

for (const ev of ['keydown', 'pointerdown']) window.addEventListener(ev, () => sfx.unlock());
canvas.addEventListener('pointerdown', () => input.press('start'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.pauseIfPlaying();
});

// Fixed 60 Hz simulation, rendered once per animation frame.
const STEP = 1 / 60;
let acc = 0;
let last = performance.now();

function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    game.update(STEP);
    input.endFrame();
    acc -= STEP;
  }
  game.render();
  requestAnimationFrame(frame);
}

// Wait briefly for the pixel font so the first frames don't flash a fallback face.
const fontReady = document.fonts ? document.fonts.load(`16px ${FONT}`).catch(() => {}) : Promise.resolve();
Promise.race([fontReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
  last = performance.now();
  requestAnimationFrame(frame);
});
