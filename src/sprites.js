import { PX } from './config.js';

export const PALETTE = {
  W: '#ffffff',
  R: '#ff3030',
  Y: '#ffff40',
  G: '#30ff30',
  g: '#10a010',
  P: '#c040ff',
  M: '#ff40ff',
  B: '#4060ff',
  C: '#40ffff',
  O: '#ff9020',
  S: '#a0a0a0',
};

// Each sprite is either one bitmap (array of rows) or a list of animation frames.
// '.' is transparent; every other character is a PALETTE key.
const MAPS = {
  ship: [
    '..W.............',
    '..WW............',
    '..WWWWWWWW......',
    'CSWWWWWWWWWWWW..',
    '..MMMMWWWWWWWWWW',
    '...MMMMMMM......',
  ],
  life: ['WW......', 'WWWWWWW.', '.MMMWWWW'],
  bomb: ['.RR.', 'RYYR', '.RR.'],
  lander: [
    [
      '...GGG...',
      '.GGYYYGG.',
      'GGYGYGYGG',
      'GGGGGGGGG',
      '.G.G.G.G.',
      'G..G.G..G',
      'G...G...G',
    ],
    [
      '...GGG...',
      '.GGYYYGG.',
      'GGGYGYGGG',
      'GGGGGGGGG',
      '.G.G.G.G.',
      '.G.G.G.G.',
      'G..G.G..G',
    ],
  ],
  mutant: [
    [
      '...PPP...',
      '.PPGGGPP.',
      'PPGPGPGPP',
      'PPPPPPPPP',
      '.P.G.G.P.',
      'P..G.G..P',
      'G...P...G',
    ],
    [
      '...GGG...',
      '.GGPPPGG.',
      'GGPGPGPGG',
      'GGGGGGGGG',
      '.G.P.P.G.',
      'G..P.P..G',
      'P...G...P',
    ],
  ],
  bomber: [
    ['BBBBBBB', 'BMMMMMB', 'BM...MB', 'BM.Y.MB', 'BM...MB', 'BMMMMMB', 'BBBBBBB'],
    ['BBBBBBB', 'BMMMMMB', 'BMYYYMB', 'BMY.YMB', 'BMYYYMB', 'BMMMMMB', 'BBBBBBB'],
  ],
  pod: [
    [
      '...PPP...',
      '.PPRRRPP.',
      '.PRPPPRP.',
      'PRPYYYPRP',
      'PRPYRYPRP',
      'PRPYYYPRP',
      '.PRPPPRP.',
      '.PPRRRPP.',
      '...PPP...',
    ],
    [
      '...RRR...',
      '.RRPPPRR.',
      '.RPRRRPR.',
      'RPRYYYRPR',
      'RPRYPYRPR',
      'RPRYYYRPR',
      '.RPRRRPR.',
      '.RRPPPRR.',
      '...RRR...',
    ],
  ],
  swarmer: [
    ['.RRR.', 'RYRYR', 'RRRRR', 'R.R.R'],
    ['.RRR.', 'RRYRR', 'RRRRR', '.R.R.'],
  ],
  baiter: [
    [
      '....GGGGG....',
      '..GGWWWWWGG..',
      'GGGGGGGGGGGGG',
      '..GGGGGGGGG..',
      '....G...G....',
    ],
    [
      '....GGGGG....',
      '..GGWGWGWGG..',
      'GGGGGGGGGGGGG',
      '..GGGGGGGGG..',
      '....G...G....',
    ],
  ],
  human: [
    ['.W.', 'PPP', 'PPP', '.P.', 'PPP', 'P.P', 'P.P', 'P.P'],
    ['.W.', 'PPP', 'PPP', '.P.', 'PPP', '.P.', '.P.', 'P.P'],
  ],
};

// Colours each enemy explodes into.
export const SPRITE_COLORS = {
  lander: ['#30ff30', '#ffff40', '#10a010'],
  mutant: ['#c040ff', '#30ff30', '#ff40ff'],
  bomber: ['#4060ff', '#ff40ff', '#ffff40'],
  pod: ['#c040ff', '#ff3030', '#ffff40'],
  swarmer: ['#ff3030', '#ffff40'],
  baiter: ['#30ff30', '#ffffff', '#a0ff60'],
  human: ['#c040ff', '#ffffff'],
};

const framesOf = (name) => {
  const m = MAPS[name];
  return Array.isArray(m[0]) ? m : [m];
};

const cache = new Map();

function build(rows, flip) {
  const h = rows.length;
  const w = rows[0].length;
  const c = document.createElement('canvas');
  c.width = w * PX;
  c.height = h * PX;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const col = PALETTE[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect((flip ? w - 1 - x : x) * PX, y * PX, PX, PX);
    }
  });
  return c;
}

export function frameCount(name) {
  return framesOf(name).length;
}

export function spriteSize(name) {
  const rows = framesOf(name)[0];
  return [rows[0].length * PX, rows.length * PX];
}

export function drawSprite(ctx, name, x, y, frame = 0, flip = false) {
  const frames = framesOf(name);
  const f = frame % frames.length;
  const key = `${name}:${f}:${flip ? 1 : 0}`;
  let c = cache.get(key);
  if (!c) {
    c = build(frames[f], flip);
    cache.set(key, c);
  }
  ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2));
}

export const SPRITE_NAMES = Object.keys(MAPS);
export const _maps = MAPS; // exposed for the sprite sanity test
