// Logical resolution. The canvas is scaled up with CSS (pixelated) to fit the window.
export const VIEW_W = 640;
export const VIEW_H = 480;

// Top band holds the score, reserve ships, smart bombs and the long-range scanner.
export const SCANNER_H = 64;
export const PLAY_TOP = SCANNER_H + 4;
export const GROUND_Y = VIEW_H - 14; // the line humanoids walk on

// The planet wraps around: eight screens wide.
export const WORLD_W = VIEW_W * 8;

// Sprite pixel scale.
export const PX = 2;

export const FONT = '"Press Start 2P", ui-monospace, monospace';

export const SHIP = {
  accel: 950, // px/s^2 while thrusting
  maxSpeed: 580, // px/s
  drag: 1.5, // velocity fraction lost per second
  vSpeed: 270, // vertical px/s
};

// Scoring follows the original arcade table.
export const POINTS = {
  lander: 150,
  mutant: 150,
  bomber: 250,
  pod: 1000,
  swarmer: 150,
  baiter: 200,
  catch: 500, // catch a falling humanoid
  returned: 500, // set a caught humanoid back on the ground
  landed: 250, // humanoid survives a short fall on its own
};

export const EXTRA_EVERY = 10000; // bonus ship + smart bomb
export const HUMANOIDS = 10;
export const LANDERS_PER_WAVE = 20;
export const START_LIVES = 3;
export const START_BOMBS = 3;
