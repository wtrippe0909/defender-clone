import {
  VIEW_W,
  VIEW_H,
  SCANNER_H,
  PLAY_TOP,
  GROUND_Y,
  WORLD_W,
  SHIP,
  POINTS,
  EXTRA_EVERY,
  HUMANOIDS,
  LANDERS_PER_WAVE,
  START_LIVES,
  START_BOMBS,
  FONT,
} from './config.js';
import { rand, chance, pick, clamp, wrapX, dxWrap } from './util.js';
import { drawSprite, spriteSize, frameCount, SPRITE_COLORS } from './sprites.js';
import { Terrain, TERRAIN_COLOR } from './terrain.js';

const HUMAN_Y = GROUND_Y - 8; // humanoid sprite centre when standing
const TOP_LIMIT = PLAY_TOP + 8;
const SCAN = { x: 160, y: 4, w: 320, h: SCANNER_H - 8 };

const LASER_SPEED = 2600;
const LASER_LIFE = 0.32;
const LASER_COLORS = ['#ff3030', '#ffff40', '#30ff30', '#40ffff', '#ff40ff'];
const MAX_LASERS = 5;

const SAFE_FALL = 140; // humanoids survive drops shorter than this many pixels
const HYPER_DEATH_CHANCE = 0.18;
const SPAWN_TIME = 0.7; // materialise effect before an enemy becomes active

// Seconds between shots (scaled down by difficulty); 0 = never shoots.
const FIRE_RATE = { lander: 2.6, mutant: 1.3, baiter: 0.8, swarmer: 2.2, bomber: 0, pod: 0 };

const SCAN_COLORS = {
  lander: '#30ff30',
  mutant: '#c040ff',
  bomber: '#4060ff',
  pod: '#ff40ff',
  swarmer: '#ff3030',
  baiter: '#a0ff60',
};
const STAR_COLORS = ['#ffffff', '#ff4040', '#40ffff', '#ffff40', '#c040ff'];
const SCORE_TABLE = [
  ['lander', 'LANDER'],
  ['mutant', 'MUTANT'],
  ['bomber', 'BOMBER'],
  ['pod', 'POD'],
  ['swarmer', 'SWARMER'],
  ['baiter', 'BAITER'],
];

const isLanderish = (e) => !e.dead && (e.type === 'lander' || e.type === 'mutant');

function loadHi() {
  try {
    return Number(localStorage.getItem('defender.hiscore')) || 0;
  } catch {
    return 0;
  }
}

function saveHi(v) {
  try {
    localStorage.setItem('defender.hiscore', String(v));
  } catch {
    /* storage unavailable */
  }
}

export class Game {
  constructor(canvas, input, sfx) {
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sfx = sfx;
    this.hiScore = loadHi();
    this.stars = Array.from({ length: 60 }, () => ({
      x: rand(0, VIEW_W),
      y: rand(PLAY_TOP + 4, GROUND_Y - 60),
      c: pick(STAR_COLORS),
      p: rand(0, 6),
    }));
    this.time = 0;
    this.flash = 0;
    this.paused = false;
    this.bannerText = '';
    this.bannerT = 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.bombs = START_BOMBS;
    this.wave = 0;
    this.planetAlive = true;
    this.terrain = new Terrain();
    this.camX = 0;
    this.resetEntities();
    this.ship = this.makeShip();
    this.setState('title');
  }

  // ---------------------------------------------------------------- setup

  resetEntities() {
    this.enemies = [];
    this.humans = [];
    this.lasers = [];
    this.bullets = [];
    this.mines = [];
    this.particles = [];
    this.popups = [];
  }

  makeShip() {
    return {
      x: WORLD_W / 2,
      y: (TOP_LIMIT + GROUND_Y) / 2,
      vx: 0,
      facing: 1,
      screenX: VIEW_W * 0.22,
      fireT: 0,
      hyperT: 0,
      thrusting: false,
    };
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  newGame() {
    this.score = 0;
    this.lives = START_LIVES;
    this.bombs = START_BOMBS;
    this.nextBonus = EXTRA_EVERY;
    this.terrain = new Terrain();
    this.planetAlive = true;
    this.resetEntities();
    this.ship = this.makeShip();
    this.spawnHumans();
    this.startWave(1);
  }

  spawnHumans() {
    this.humans = [];
    const gap = WORLD_W / HUMANOIDS;
    for (let i = 0; i < HUMANOIDS; i++) {
      this.humans.push({
        x: wrapX(i * gap + rand(0, gap * 0.6)),
        y: HUMAN_Y,
        vx: chance(0.5) ? 8 : -8,
        vy: 0,
        state: 'walk',
        carrier: null,
        fallStartY: 0,
        dead: false,
        t: rand(0, 5),
      });
    }
  }

  startWave(n) {
    this.wave = n;
    // The planet and its humanoids are restored after every fifth wave.
    if (n > 1 && (n - 1) % 5 === 0) {
      if (!this.planetAlive) {
        this.planetAlive = true;
        this.terrain = new Terrain();
      }
      this.spawnHumans();
    }
    this.enemies = [];
    this.bullets = [];
    this.mines = [];
    this.lasers = [];
    this.diff = Math.min(1 + (n - 1) * 0.15, 2.2);
    this.landersLeft = LANDERS_PER_WAVE;
    this.spawnTimer = 0.1;
    this.baiterTimer = Math.max(30, 60 - n * 4);
    const bombers = Math.min(n + 1, 6);
    const pods = Math.min(Math.ceil(n / 2), 4);
    for (let i = 0; i < bombers; i++) this.makeEnemy('bomber', this.farX(), rand(PLAY_TOP + 40, GROUND_Y - 120));
    for (let i = 0; i < pods; i++) this.makeEnemy('pod', this.farX(), rand(PLAY_TOP + 30, GROUND_Y - 120));
    this.ship.vx = 0;
    this.readyText = `ATTACK WAVE ${n}`;
    this.setState('waveStart');
    this.sfx.waveStart();
  }

  // A random world x at least `min` pixels from the ship.
  farX(min = VIEW_W) {
    return wrapX(this.ship.x + (chance(0.5) ? 1 : -1) * rand(min, WORLD_W / 2));
  }

  makeEnemy(type, x, y) {
    const [w, h] = spriteSize(type);
    const e = {
      type,
      x: wrapX(x),
      y,
      vx: 0,
      vy: 0,
      w,
      h,
      t: rand(0, 10),
      fireT: rand(1, 3),
      spawnT: SPAWN_TIME,
      dead: false,
      state: 'hunt',
      target: null,
      dir: chance(0.5) ? 1 : -1,
    };
    if (type === 'bomber') {
      e.baseY = y;
      e.vx = e.dir * rand(40, 70);
      e.mineT = rand(0.5, 1.5);
    } else if (type === 'pod') {
      e.vx = rand(-30, 30);
      e.vy = chance(0.5) ? 20 : -20;
    } else if (type === 'swarmer') {
      e.spawnT = 0;
      e.vx = rand(-160, 160);
      e.vy = rand(-110, 110);
      e.fireT = rand(0.8, 2);
    } else if (type === 'baiter') {
      e.spawnT = 0.4;
    }
    this.enemies.push(e);
    return e;
  }

  // ---------------------------------------------------------------- update

  update(dt) {
    const inp = this.input;
    if (inp.pressed('mute')) this.sfx.toggleMute();
    if (inp.pressed('pause') && this.state !== 'title' && this.state !== 'gameover') this.paused = !this.paused;
    if (this.paused) return;

    this.time += dt;
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.bannerT = Math.max(0, this.bannerT - dt);

    switch (this.state) {
      case 'title':
        this.camX = wrapX(this.camX + 70 * dt);
        if (inp.pressed('start') || inp.pressed('fire')) this.newGame();
        break;
      case 'waveStart':
        this.updateShip(dt, false);
        this.updateHumans(dt);
        if (this.stateT > 2) this.setState('play');
        break;
      case 'play':
        this.updatePlay(dt);
        break;
      case 'dying':
        if (this.stateT > 2.6) this.afterDeath();
        break;
      case 'waveEnd':
        if (this.stateT > 3.5) this.startWave(this.wave + 1);
        break;
      case 'gameover':
        if (this.stateT > 2 && (inp.pressed('start') || inp.pressed('fire'))) this.setState('title');
        break;
    }
    this.updateParticles(dt);
  }

  pauseIfPlaying() {
    if (this.state !== 'title' && this.state !== 'gameover') this.paused = true;
  }

  updatePlay(dt) {
    // Landers arrive in groups of five; hurry the next group if the screen is clear.
    if (this.landersLeft > 0) {
      if (!this.enemies.some(isLanderish)) this.spawnTimer = Math.min(this.spawnTimer, 1);
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const n = Math.min(5, this.landersLeft);
        this.landersLeft -= n;
        this.spawnTimer = 10;
        const type = this.planetAlive ? 'lander' : 'mutant';
        for (let i = 0; i < n; i++) this.makeEnemy(type, this.farX(150), rand(PLAY_TOP + 16, PLAY_TOP + 90));
        this.sfx.spawn();
      }
    }
    // Baiters hound players who take too long to finish a wave.
    this.baiterTimer -= dt;
    if (this.baiterTimer <= 0) {
      this.baiterTimer = Math.max(6, 15 - this.wave);
      const side = chance(0.5) ? 1 : -1;
      this.makeEnemy('baiter', this.ship.x + side * VIEW_W * 0.6, rand(PLAY_TOP + 20, GROUND_Y - 60));
    }

    this.updateShip(dt, true);
    this.updateLasers(dt);
    this.updateEnemies(dt);
    this.updateHumans(dt);
    this.updateShots(dt);
    this.checkShipHits();

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.humans = this.humans.filter((h) => !h.dead);

    if (this.state === 'play' && this.landersLeft === 0 && !this.enemies.some(isLanderish)) this.endWave();
  }

  updateShip(dt, canFire) {
    const s = this.ship;
    const inp = this.input;
    let thrust = 0;
    if (inp.held('left')) thrust = -1;
    else if (inp.held('right')) thrust = 1;
    if (thrust) s.facing = thrust;
    s.thrusting = thrust !== 0;
    s.vx += thrust * SHIP.accel * dt;
    s.vx -= s.vx * SHIP.drag * dt;
    s.vx = clamp(s.vx, -SHIP.maxSpeed, SHIP.maxSpeed);
    s.x = wrapX(s.x + s.vx * dt);
    if (inp.held('up')) s.y -= SHIP.vSpeed * dt;
    if (inp.held('down')) s.y += SHIP.vSpeed * dt;
    s.y = clamp(s.y, TOP_LIMIT, GROUND_Y - 6);

    // Reversing slides the ship across the screen so there is always room ahead.
    const target = s.facing > 0 ? VIEW_W * 0.22 : VIEW_W * 0.78;
    s.screenX += (target - s.screenX) * Math.min(1, dt * 2.5);
    this.camX = wrapX(s.x - s.screenX);

    if (!canFire) return;
    s.fireT -= dt;
    s.hyperT -= dt;
    if ((inp.pressed('fire') && s.fireT < 0.1) || (inp.held('fire') && s.fireT <= 0)) this.fireLaser();
    if (inp.pressed('bomb')) this.smartBomb();
    if (inp.pressed('hyper') && s.hyperT <= 0) this.hyperspace();
  }

  fireLaser() {
    const s = this.ship;
    if (this.lasers.length >= MAX_LASERS) return;
    s.fireT = 0.16;
    this.lasers.push({ x: wrapX(s.x + s.facing * 14), y: s.y + 2, dir: s.facing, len: 0, t: 0, hue: Math.floor(rand(0, 5)) });
    this.sfx.laser();
  }

  updateLasers(dt) {
    for (const l of this.lasers) {
      l.t += dt;
      const ox = this.toScreenX(l.x);
      const edge = l.dir > 0 ? VIEW_W - ox : ox; // beams stop at the screen edge
      l.len = Math.min(edge, l.len + LASER_SPEED * dt);
      const tail = Math.max(0, (l.t - 0.1) * LASER_SPEED);

      let hit = null;
      let best = Infinity;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0 || Math.abs(e.y - l.y) > e.h / 2 + 2) continue;
        const d = dxWrap(e.x, l.x) * l.dir;
        if (d + e.w / 2 >= tail && d - e.w / 2 <= l.len && d < best) {
          best = d;
          hit = e;
        }
      }
      // Careless shots can kill humanoids too, just like the original.
      for (const h of this.humans) {
        if (h.dead || h.state === 'caught' || Math.abs(h.y - l.y) > 9) continue;
        const d = dxWrap(h.x, l.x) * l.dir;
        if (d + 3 >= tail && d - 3 <= l.len && d < best) {
          best = d;
          hit = h;
        }
      }
      if (hit) {
        l.dead = true;
        if (hit.type) this.killEnemy(hit, true);
        else this.killHuman(hit);
      }
    }
    this.lasers = this.lasers.filter((l) => !l.dead && l.t < LASER_LIFE);
  }

  smartBomb() {
    if (this.bombs <= 0) return;
    this.bombs--;
    this.flash = 0.25;
    this.sfx.smartBomb();
    for (const e of this.enemies) {
      if (!e.dead && e.spawnT <= 0 && this.onScreen(e.x, 8)) this.killEnemy(e, false);
    }
    this.bullets = this.bullets.filter((b) => !this.onScreen(b.x, 8));
    this.mines = this.mines.filter((m) => !this.onScreen(m.x, 8));
  }

  hyperspace() {
    const s = this.ship;
    s.hyperT = 1;
    this.sfx.hyper();
    this.burst(s.x, s.y, ['#ffffff', '#40ffff'], 18, 140, 0.6);
    s.x = rand(0, WORLD_W);
    s.y = rand(TOP_LIMIT + 20, GROUND_Y - 40);
    s.vx = 0;
    s.facing = chance(0.5) ? 1 : -1;
    s.screenX = s.facing > 0 ? VIEW_W * 0.22 : VIEW_W * 0.78;
    this.camX = wrapX(s.x - s.screenX);
    if (chance(HYPER_DEATH_CHANCE)) this.killShip();
  }

  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += dt;
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        continue;
      }
      switch (e.type) {
        case 'lander':
          this.updateLander(e);
          break;
        case 'mutant':
          this.updateMutant(e);
          break;
        case 'bomber':
          this.updateBomber(e, dt);
          break;
        case 'pod':
          if ((e.y < TOP_LIMIT + 10 && e.vy < 0) || (e.y > GROUND_Y - 60 && e.vy > 0)) e.vy = -e.vy;
          break;
        case 'swarmer':
          this.updateSwarmer(e, dt);
          break;
        case 'baiter':
          this.updateBaiter(e, dt);
          break;
      }
      e.x = wrapX(e.x + e.vx * dt);
      e.y = clamp(e.y + e.vy * dt, TOP_LIMIT - 4, GROUND_Y - e.h / 2);

      e.fireT -= dt;
      if (e.fireT <= 0) {
        const rate = FIRE_RATE[e.type];
        e.fireT = rate ? (rate * rand(0.6, 1.4)) / this.diff : 999;
        if (rate) this.enemyFire(e);
      }
    }
  }

  updateLander(e) {
    const spd = 55 * this.diff;
    if (e.state === 'hunt') {
      const tgt = e.target;
      if (!tgt || tgt.dead || tgt.state !== 'walk') e.target = this.pickHuman(e);
      const cruise = GROUND_Y - 150 + Math.sin(e.t * 1.3) * 25;
      e.vy = clamp((cruise - e.y) * 1.5, -60, 60);
      if (e.target) {
        const dx = dxWrap(e.target.x, e.x);
        e.vx = clamp(dx * 3, -spd, spd);
        if (Math.abs(dx) < 3) e.state = 'descend';
      } else {
        e.vx = e.dir * spd;
      }
    } else if (e.state === 'descend') {
      const h = e.target;
      if (!h || h.dead || h.state !== 'walk') {
        e.state = 'hunt';
        e.target = null;
        return;
      }
      e.vx = clamp(dxWrap(h.x, e.x) * 6, -spd, spd);
      e.vy = 45 * this.diff;
      if (e.y + e.h / 2 >= h.y - 8) {
        h.state = 'carried';
        h.carrier = e;
        e.state = 'ascend';
        this.sfx.grab();
      }
    } else if (e.state === 'ascend') {
      e.vx = 0;
      e.vy = -26 * Math.sqrt(this.diff);
      if (e.y <= TOP_LIMIT) this.mutate(e);
    }
  }

  // Nearest walking humanoid that no other lander has claimed.
  pickHuman(lander) {
    const taken = new Set();
    for (const o of this.enemies) if (o !== lander && o.type === 'lander' && o.target) taken.add(o.target);
    let best = null;
    let bestD = Infinity;
    for (const h of this.humans) {
      if (h.dead || h.state !== 'walk' || taken.has(h)) continue;
      const d = Math.abs(dxWrap(h.x, lander.x));
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  mutate(e) {
    const h = e.target;
    if (h && h.carrier === e) {
      h.dead = true;
      this.burst(h.x, h.y, SPRITE_COLORS.human, 10, 60);
      this.checkPlanet();
    }
    e.type = 'mutant';
    [e.w, e.h] = spriteSize('mutant');
    e.target = null;
    e.state = 'hunt';
    this.sfx.mutate();
  }

  updateMutant(e) {
    const s = this.ship;
    const dx = dxWrap(s.x, e.x);
    const dy = s.y - e.y;
    const spd = 150 * this.diff;
    if (Math.abs(dx) > VIEW_W) {
      e.vx = Math.sign(dx) * spd * 0.7;
      e.vy = clamp(dy, -60, 60);
    } else {
      // Erratic, jittery homing.
      e.vx = Math.sign(dx) * spd * rand(0.4, 1.2);
      e.vy = clamp(dy * 2, -spd, spd) + rand(-140, 140);
    }
  }

  updateBomber(e, dt) {
    e.vy = (e.baseY + Math.sin(e.t * 1.2) * 50 - e.y) * 2;
    e.mineT -= dt;
    if (e.mineT <= 0) {
      e.mineT = rand(0.7, 1.5);
      if (this.mines.length < 40) this.mines.push({ x: e.x, y: e.y, t: 0 });
    }
  }

  updateSwarmer(e, dt) {
    const s = this.ship;
    const top = 220 * this.diff;
    e.vx = clamp(e.vx + Math.sign(dxWrap(s.x, e.x)) * 260 * this.diff * dt, -top, top);
    e.vy = clamp(e.vy + Math.sign(s.y - e.y) * 200 * dt, -120, 120);
  }

  updateBaiter(e, dt) {
    const s = this.ship;
    const dx = dxWrap(s.x, e.x);
    const spd = Math.max(260, Math.abs(s.vx) + 80);
    e.vx += (Math.sign(dx) * spd - e.vx) * Math.min(1, dt * 2);
    e.vy += (clamp((s.y - e.y) * 2, -150, 150) - e.vy) * Math.min(1, dt * 3);
  }

  enemyFire(e) {
    if (!this.onScreen(e.x, -10)) return;
    const s = this.ship;
    const speed = 170 * Math.sqrt(this.diff);
    const dx = dxWrap(s.x, e.x);
    const dy = s.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 50) return;
    // Lead the target a little.
    const tx = dx + s.vx * (dist / speed) * 0.5;
    const d = Math.hypot(tx, dy) || 1;
    this.bullets.push({ x: e.x, y: e.y, vx: (tx / d) * speed, vy: (dy / d) * speed, t: 0 });
    this.sfx.enemyShot();
  }

  updateShots(dt) {
    for (const b of this.bullets) {
      b.t += dt;
      b.x = wrapX(b.x + b.vx * dt);
      b.y += b.vy * dt;
    }
    this.bullets = this.bullets.filter((b) => b.t < 2.5 && b.y > PLAY_TOP && b.y < VIEW_H && this.onScreen(b.x, 60));
    for (const m of this.mines) m.t += dt;
    this.mines = this.mines.filter((m) => m.t < 5);
  }

  checkShipHits() {
    if (this.state !== 'play') return;
    const s = this.ship;
    const hw = 14;
    const hh = 5;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      if (Math.abs(dxWrap(e.x, s.x)) < hw + e.w / 2 - 2 && Math.abs(e.y - s.y) < hh + e.h / 2 - 2) {
        this.killEnemy(e, true);
        this.killShip();
        return;
      }
    }
    for (const b of this.bullets) {
      if (Math.abs(dxWrap(b.x, s.x)) < hw && Math.abs(b.y - s.y) < hh + 2) {
        this.killShip();
        return;
      }
    }
    for (const m of this.mines) {
      if (Math.abs(dxWrap(m.x, s.x)) < hw + 2 && Math.abs(m.y - s.y) < hh + 2) {
        this.killShip();
        return;
      }
    }
  }

  updateHumans(dt) {
    const s = this.ship;
    for (const h of this.humans) {
      if (h.dead) continue;
      h.t += dt;
      switch (h.state) {
        case 'walk':
          if (chance(dt * 0.3)) h.vx = -h.vx;
          h.x = wrapX(h.x + h.vx * dt);
          h.y = HUMAN_Y;
          break;
        case 'carried': {
          const c = h.carrier;
          if (!c || c.dead) {
            this.dropHuman(h);
            break;
          }
          h.x = c.x;
          h.y = c.y + c.h / 2 + 8;
          break;
        }
        case 'falling':
          h.vy = Math.min(h.vy + 90 * dt, 120);
          h.y += h.vy * dt;
          if (this.state === 'play' && Math.abs(dxWrap(h.x, s.x)) < 18 && Math.abs(h.y - s.y) < 14) {
            h.state = 'caught';
            this.addScore(POINTS.catch, h.x, h.y);
            this.sfx.rescue();
            break;
          }
          if (h.y >= HUMAN_Y) {
            h.y = HUMAN_Y;
            if (HUMAN_Y - h.fallStartY > SAFE_FALL) {
              this.killHuman(h);
            } else {
              h.state = 'walk';
              this.addScore(POINTS.landed, h.x, h.y - 12);
            }
          }
          break;
        case 'caught':
          h.x = s.x;
          h.y = s.y + 14;
          if (h.y >= HUMAN_Y - 6) {
            h.state = 'walk';
            h.y = HUMAN_Y;
            this.addScore(POINTS.returned, h.x, h.y - 12);
            this.sfx.rescue();
          }
          break;
      }
    }
  }

  dropHuman(h) {
    h.state = 'falling';
    h.carrier = null;
    h.vy = 0;
    h.fallStartY = h.y;
  }

  killHuman(h) {
    if (h.dead) return;
    h.dead = true;
    this.burst(h.x, h.y, SPRITE_COLORS.human, 12, 80);
    this.sfx.humanDie();
    this.checkPlanet();
  }

  // With every humanoid gone the planet explodes and all landers turn mutant.
  checkPlanet() {
    if (!this.planetAlive || this.humans.some((h) => !h.dead)) return;
    this.planetAlive = false;
    this.flash = 0.6;
    this.sfx.planet();
    for (let i = 0; i < 14; i++) {
      this.burst(wrapX(this.camX + rand(0, VIEW_W)), GROUND_Y - rand(0, 90), [TERRAIN_COLOR, '#ff9020', '#ffffff'], 16, 180, 1.4);
    }
    for (const e of this.enemies) {
      if (e.type === 'lander' && !e.dead) {
        e.target = null;
        this.mutate(e);
      }
    }
    this.banner('PLANET DESTROYED');
  }

  killEnemy(e, byLaser) {
    if (e.dead) return;
    e.dead = true;
    this.addScore(POINTS[e.type]);
    this.explode(e.x, e.y, SPRITE_COLORS[e.type]);
    this.sfx.explode();
    if (e.type === 'lander' && e.target && e.target.carrier === e) this.dropHuman(e.target);
    // A pod shot with the laser bursts into swarmers.
    if (e.type === 'pod' && byLaser) {
      const n = 4 + Math.floor(rand(0, 3));
      for (let i = 0; i < n; i++) this.makeEnemy('swarmer', e.x + rand(-6, 6), e.y + rand(-6, 6));
    }
  }

  killShip() {
    if (this.state !== 'play') return;
    const s = this.ship;
    this.sfx.death();
    this.burst(s.x, s.y, ['#ffffff', '#ff3030', '#ffff40', '#40ffff', '#ff40ff'], 80, 280, 1.8);
    for (const h of this.humans) if (h.state === 'caught') this.dropHuman(h);
    this.lasers = [];
    this.setState('dying');
  }

  afterDeath() {
    this.lives--;
    if (this.lives <= 0) {
      saveHi(this.hiScore);
      this.setState('gameover');
      return;
    }
    this.bullets = [];
    this.mines = [];
    const s = this.ship;
    s.vx = 0;
    s.y = (TOP_LIMIT + GROUND_Y) / 2;
    // Enemies near the respawn point warp away and rematerialise.
    for (const e of this.enemies) {
      if (Math.abs(dxWrap(e.x, s.x)) < VIEW_W) {
        e.x = this.farX(VIEW_W);
        e.spawnT = SPAWN_TIME;
      }
    }
    this.readyText = 'GET READY';
    this.setState('waveStart');
  }

  endWave() {
    const alive = this.humans.filter((h) => !h.dead);
    this.waveAlive = alive.length;
    this.waveBonus = alive.length * Math.min(this.wave, 5) * 100;
    this.addScore(this.waveBonus);
    for (const h of alive) {
      if (h.state !== 'walk') {
        h.state = 'walk';
        h.carrier = null;
        h.y = HUMAN_Y;
      }
    }
    this.bullets = [];
    this.mines = [];
    this.lasers = [];
    this.setState('waveEnd');
  }

  addScore(pts, x, y) {
    if (!pts) return;
    this.score += pts;
    if (x !== undefined) this.popups.push({ x, y, text: String(pts), t: 0 });
    if (this.score > this.hiScore) this.hiScore = this.score;
    while (this.score >= this.nextBonus) {
      this.nextBonus += EXTRA_EVERY;
      this.lives++;
      this.bombs++;
      this.sfx.extra();
      this.banner('BONUS SHIP');
    }
  }

  banner(text) {
    this.bannerText = text;
    this.bannerT = 2.5;
  }

  // Classic square-pattern pixel explosion.
  explode(x, y, colors) {
    for (let ix = -3; ix <= 3; ix++) {
      for (let iy = -2; iy <= 2; iy++) {
        if (!ix && !iy) continue;
        this.particles.push({ x, y, vx: ix * 45, vy: iy * 45, t: 0, life: 0.8, c: pick(colors), s: 2 });
      }
    }
  }

  burst(x, y, colors, n, speed, life = 0.9) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(0.25, 1) * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: life * rand(0.6, 1), c: pick(colors), s: chance(0.3) ? 3 : 2 });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.t += dt;
      p.x = wrapX(p.x + p.vx * dt);
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
    for (const p of this.popups) {
      p.t += dt;
      p.y -= 20 * dt;
    }
    this.popups = this.popups.filter((p) => p.t < 1.2);
  }

  // ---------------------------------------------------------------- helpers

  toScreenX(x) {
    return dxWrap(x, this.camX + VIEW_W / 2) + VIEW_W / 2;
  }

  onScreen(x, margin = 0) {
    return Math.abs(dxWrap(x, this.camX + VIEW_W / 2)) < VIEW_W / 2 + margin;
  }

  // ---------------------------------------------------------------- render

  render() {
    const g = this.ctx;
    const whiteout = this.flash > 0 && Math.floor(this.flash * 30) % 2 === 0;
    g.fillStyle = whiteout ? '#ffffff' : '#000000';
    g.fillRect(0, 0, VIEW_W, VIEW_H);

    this.drawStars(g);
    if (this.planetAlive || this.state === 'title') this.terrain.draw(g, this.camX);

    if (this.state === 'title') {
      this.drawTitle(g);
      return;
    }

    this.drawHumans(g);
    this.drawMines(g);
    this.drawEnemies(g);
    this.drawBullets(g);
    this.drawLasers(g);
    if (this.state !== 'dying' && this.state !== 'gameover') this.drawShip(g);
    this.drawParticles(g);
    this.drawPopups(g);
    this.drawHud(g);
    this.drawOverlay(g);
  }

  drawStars(g) {
    for (const s of this.stars) {
      if (Math.sin(this.time * 3 + s.p * 5) > 0.85) continue; // twinkle
      const x = (((s.x - this.camX * 0.25) % VIEW_W) + VIEW_W) % VIEW_W;
      g.fillStyle = s.c;
      g.fillRect(Math.round(x), Math.round(s.y), 2, 2);
    }
  }

  drawHumans(g) {
    for (const h of this.humans) {
      const sx = this.toScreenX(h.x);
      if (sx < -10 || sx > VIEW_W + 10) continue;
      const frame = h.state === 'walk' ? Math.floor(h.t * 4) : 0;
      drawSprite(g, 'human', sx, h.y, frame);
    }
  }

  drawMines(g) {
    for (const m of this.mines) {
      const sx = this.toScreenX(m.x);
      if (sx < -4 || sx > VIEW_W + 4) continue;
      g.fillStyle = Math.floor(m.t * 8) % 2 ? '#ff40ff' : '#ffffff';
      g.fillRect(Math.round(sx) - 2, Math.round(m.y) - 2, 4, 4);
    }
  }

  drawEnemies(g) {
    for (const e of this.enemies) {
      const sx = this.toScreenX(e.x);
      if (sx < -40 || sx > VIEW_W + 40) continue;
      if (e.spawnT > 0) {
        // Materialise: pixels converge on the spawn point.
        const k = e.spawnT / SPAWN_TIME;
        const cols = SPRITE_COLORS[e.type];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + e.t;
          g.fillStyle = cols[i % cols.length];
          g.fillRect(Math.round(sx + Math.cos(a) * k * 36), Math.round(e.y + Math.sin(a) * k * 24), 2, 2);
        }
        continue;
      }
      drawSprite(g, e.type, sx, e.y, Math.floor(e.t * 6) % frameCount(e.type));
    }
  }

  drawBullets(g) {
    for (const b of this.bullets) {
      const sx = this.toScreenX(b.x);
      g.fillStyle = Math.floor(b.t * 20) % 2 ? '#ffffff' : '#ffff40';
      g.fillRect(Math.round(sx) - 1, Math.round(b.y) - 1, 3, 3);
    }
  }

  drawLasers(g) {
    for (const l of this.lasers) {
      const ox = this.toScreenX(l.x);
      const tail = Math.max(0, (l.t - 0.1) * LASER_SPEED);
      for (let d = tail; d < l.len; d += 10) {
        // Ragged gaps give the beam its broken, flickering look.
        if ((Math.floor(d / 10) * 7 + l.hue * 3) % 11 < 2) continue;
        g.fillStyle = d > l.len - 40 ? '#ffffff' : LASER_COLORS[(l.hue + Math.floor(d / 60)) % LASER_COLORS.length];
        const seg = Math.min(9, l.len - d);
        g.fillRect(Math.round(l.dir > 0 ? ox + d : ox - d - seg), Math.round(l.y) - 1, seg, 2);
      }
    }
  }

  drawShip(g) {
    const s = this.ship;
    drawSprite(g, 'ship', s.screenX, s.y, 0, s.facing < 0);
    if (s.thrusting) {
      for (let i = 0; i < 5; i++) {
        g.fillStyle = pick(['#ff3030', '#ff9020', '#ffff40']);
        g.fillRect(Math.round(s.screenX - s.facing * (18 + rand(0, 12))), Math.round(s.y + rand(-2, 3)), 2, 2);
      }
    }
  }

  drawParticles(g) {
    for (const p of this.particles) {
      if (p.t > p.life * 0.7 && Math.floor(p.t * 30) % 2) continue; // flicker out
      g.fillStyle = p.c;
      g.fillRect(Math.round(this.toScreenX(p.x)), Math.round(p.y), p.s, p.s);
    }
  }

  drawPopups(g) {
    for (const p of this.popups) this.text(g, p.text, this.toScreenX(p.x), p.y, '#ffffff', 8, 'center');
  }

  drawHud(g) {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, VIEW_W, SCANNER_H);
    g.fillStyle = '#3040ff';
    g.fillRect(0, SCANNER_H, VIEW_W, 2);
    g.strokeStyle = '#3040ff';
    g.lineWidth = 2;
    g.strokeRect(SCAN.x - 1, SCAN.y - 1, SCAN.w + 2, SCAN.h + 2);
    this.drawScanner(g);

    this.text(g, String(this.score), 148, 10, '#40ffff', 16, 'right');
    for (let i = 0; i < Math.min(this.lives - 1, 6); i++) drawSprite(g, 'life', 18 + i * 20, 38);
    for (let i = 0; i < Math.min(this.bombs, 8); i++) drawSprite(g, 'bomb', 16 + i * 12, 52);

    this.text(g, 'HI', 496, 10, '#ff40ff', 8);
    this.text(g, String(this.hiScore), 628, 10, '#ffffff', 8, 'right');
    this.text(g, 'WAVE', 496, 26, '#ff40ff', 8);
    this.text(g, String(this.wave), 628, 26, '#ffffff', 8, 'right');
    this.text(g, 'HUMANS', 496, 42, '#ff40ff', 8);
    this.text(g, String(this.humans.length), 628, 42, '#ffffff', 8, 'right');
    if (this.sfx.muted) this.text(g, 'MUTED', 628, 54, '#a0a0a0', 8, 'right');
  }

  drawScanner(g) {
    const cx = this.camX + VIEW_W / 2;
    const k = SCAN.w / WORLD_W;
    const mx = (x) => Math.round(SCAN.x + SCAN.w / 2 + dxWrap(x, cx) * k);
    const my = (y) => Math.round(SCAN.y + 2 + ((y - PLAY_TOP) / (GROUND_Y - PLAY_TOP)) * (SCAN.h - 4));

    if (this.planetAlive) {
      g.strokeStyle = TERRAIN_COLOR;
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 0; i <= SCAN.w; i += 2) {
        const y = my(this.terrain.heightAt(cx + (i - SCAN.w / 2) / k));
        if (i === 0) g.moveTo(SCAN.x + i, y);
        else g.lineTo(SCAN.x + i, y);
      }
      g.stroke();
    }
    g.fillStyle = '#c080ff';
    for (const h of this.humans) g.fillRect(mx(h.x), my(h.y) - 1, 2, 2);
    for (const e of this.enemies) {
      if (e.spawnT > 0) continue;
      g.fillStyle = SCAN_COLORS[e.type];
      g.fillRect(mx(e.x) - 1, my(e.y) - 1, 3, 2);
    }
    if (this.state !== 'dying' && this.state !== 'gameover') {
      g.fillStyle = '#ffffff';
      g.fillRect(mx(this.ship.x) - 1, my(this.ship.y) - 1, 3, 2);
    }

    // Bracket marking the visible screen.
    const vw = VIEW_W * k;
    const bx = Math.round(SCAN.x + SCAN.w / 2 - vw / 2);
    const top = SCAN.y;
    const bot = SCAN.y + SCAN.h - 1;
    g.fillStyle = '#ffffff';
    for (const [x, dir] of [[bx, 1], [bx + vw, -1]]) {
      g.fillRect(x, top, 1, 4);
      g.fillRect(x, bot - 3, 1, 4);
      g.fillRect(dir > 0 ? x : x - 5, top, 6, 1);
      g.fillRect(dir > 0 ? x : x - 5, bot, 6, 1);
    }
  }

  drawOverlay(g) {
    const cx = VIEW_W / 2;
    if (this.state === 'waveStart') {
      this.text(g, this.readyText, cx, 180, '#ffffff', 16, 'center');
    } else if (this.state === 'waveEnd') {
      this.text(g, `ATTACK WAVE ${this.wave}`, cx, 150, '#ffffff', 16, 'center');
      this.text(g, 'COMPLETED', cx, 176, '#ffffff', 16, 'center');
      this.text(g, `BONUS X ${Math.min(this.wave, 5) * 100}`, cx, 216, '#ff40ff', 8, 'center');
      const shown = Math.min(this.waveAlive, Math.floor(this.stateT * 4));
      const start = cx - (this.waveAlive * 12) / 2 + 6;
      for (let i = 0; i < shown; i++) drawSprite(g, 'human', start + i * 12, 246);
      if (this.stateT > 1.5) this.text(g, String(this.waveBonus), cx, 270, '#ffff40', 8, 'center');
    } else if (this.state === 'gameover') {
      this.text(g, 'GAME OVER', cx, 190, '#ff3030', 24, 'center');
      if (this.score > 0 && this.score >= this.hiScore) this.text(g, 'NEW HIGH SCORE', cx, 230, '#ffff40', 8, 'center');
      if (this.stateT > 2 && Math.floor(this.time * 2) % 2) this.text(g, 'PRESS ENTER', cx, 260, '#ffffff', 8, 'center');
    }
    if (this.bannerT > 0 && Math.floor(this.bannerT * 4) % 2) this.text(g, this.bannerText, cx, 120, '#ffff40', 16, 'center');
    if (this.paused) {
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(0, SCANNER_H + 2, VIEW_W, VIEW_H - SCANNER_H - 2);
      this.text(g, 'PAUSED', cx, 200, '#ffffff', 16, 'center');
      this.text(g, 'P TO RESUME', cx, 230, '#a0a0a0', 8, 'center');
    }
  }

  drawTitle(g) {
    const cx = VIEW_W / 2;
    this.text(g, 'HI', 16, 12, '#ff40ff', 8);
    this.text(g, String(this.hiScore), 40, 12, '#ffffff', 8);

    // Title with a colour-cycling drop shadow.
    const shadow = LASER_COLORS[Math.floor(this.time * 6) % LASER_COLORS.length];
    this.text(g, 'DEFENDER', cx + 4, 52, shadow, 48, 'center');
    this.text(g, 'DEFENDER', cx, 48, '#ffffff', 48, 'center');
    this.text(g, 'A TRIBUTE TO THE 1981 ARCADE CLASSIC', cx, 110, '#a0a0a0', 8, 'center');

    this.text(g, 'SCORING', cx, 138, '#ff40ff', 8, 'center');
    SCORE_TABLE.forEach(([type, name], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col ? 360 : 120;
      const y = 166 + row * 28;
      drawSprite(g, type, x, y, Math.floor(this.time * 6) % frameCount(type));
      this.text(g, name, x + 24, y - 4, '#ffffff', 8);
      this.text(g, String(POINTS[type]), x + 160, y - 4, '#ffff40', 8, 'right');
    });
    drawSprite(g, 'human', 120, 250);
    this.text(g, 'RESCUE HUMANOIDS  500 + 500', 144, 246, '#40ffff', 8);

    const lines = [
      'ARROWS / WASD  FLY AND REVERSE',
      'SPACE  FIRE      SHIFT / B  SMART BOMB',
      'H  HYPERSPACE    P  PAUSE    M  MUTE',
    ];
    lines.forEach((l, i) => this.text(g, l, cx, 290 + i * 16, '#a0a0a0', 8, 'center'));
    if (Math.floor(this.time * 2) % 2) this.text(g, 'PRESS ENTER OR TAP TO START', cx, 352, '#ffffff', 8, 'center');
  }

  text(g, str, x, y, color, size = 8, align = 'left') {
    g.font = `${size}px ${FONT}`;
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'top';
    g.fillText(str, Math.round(x), Math.round(y));
  }
}
