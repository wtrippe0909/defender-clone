import { WORLD_W } from './config.js';

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const chance = (p) => Math.random() < p;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Normalise a world x coordinate into [0, WORLD_W).
export const wrapX = (x) => ((x % WORLD_W) + WORLD_W) % WORLD_W;

// Shortest signed horizontal distance from b to a on the wrapping planet.
export function dxWrap(a, b) {
  const d = wrapX(a - b);
  return d >= WORLD_W / 2 ? d - WORLD_W : d;
}
