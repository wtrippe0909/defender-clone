import { WORLD_W, GROUND_Y, VIEW_W } from './config.js';
import { randInt, chance, pick, wrapX } from './util.js';

const STEP = 8; // horizontal sample spacing
const MIN_Y = GROUND_Y - 110; // highest peak
const MAX_Y = GROUND_Y - 6; // lowest valley
export const TERRAIN_COLOR = '#c86a1e';

// Jagged wrap-around mountain range drawn as a single outline, as in the arcade game.
export class Terrain {
  constructor() {
    this.n = WORLD_W / STEP;
    this.h = new Float32Array(this.n);
    this.generate();
  }

  generate() {
    let y = MAX_Y - 20;
    let dir = -1;
    let run = 0;
    let slope = STEP;
    for (let i = 0; i < this.n; i++) {
      if (run <= 0) {
        const high = y < (MIN_Y + MAX_Y) / 2;
        dir = high ? (chance(0.65) ? 1 : -1) : chance(0.65) ? -1 : 1;
        run = randInt(2, 12);
        slope = pick([0.4, 0.8, 1.2]) * STEP;
      }
      y += dir * slope;
      if (y < MIN_Y) {
        y = MIN_Y;
        dir = 1;
      } else if (y > MAX_Y) {
        y = MAX_Y;
        dir = -1;
      }
      run--;
      this.h[i] = y;
    }
    // Blend the tail into the head so the seam is invisible when the world wraps.
    const blend = 48;
    const from = this.h[this.n - blend];
    const to = this.h[0];
    for (let k = 0; k < blend; k++) {
      this.h[this.n - blend + k] = from + (to - from) * (k / blend);
    }
  }

  heightAt(x) {
    const fx = wrapX(x) / STEP;
    const i = Math.floor(fx);
    const t = fx - i;
    const a = this.h[i % this.n];
    const b = this.h[(i + 1) % this.n];
    return a + (b - a) * t;
  }

  draw(ctx, camX) {
    ctx.strokeStyle = TERRAIN_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const off = wrapX(camX) % STEP; // keep samples locked to the world grid while scrolling
    for (let sx = -off; sx <= VIEW_W + STEP; sx += STEP) {
      const y = this.heightAt(camX + sx);
      if (sx === -off) ctx.moveTo(sx, y);
      else ctx.lineTo(sx, y);
    }
    ctx.stroke();
  }
}
