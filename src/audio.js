// All sound is synthesised with Web Audio; there are no sample files.
export class Sfx {
  constructor() {
    this.ac = null;
    this.muted = false;
    try {
      this.muted = localStorage.getItem('defender.muted') === '1';
    } catch {
      /* storage unavailable */
    }
  }

  // Browsers only allow audio after a user gesture.
  unlock() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.out = this.ac.createGain();
      this.out.gain.value = 0.22;
      this.out.connect(this.ac.destination);
      const len = this.ac.sampleRate * 2;
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ac.state === 'suspended') this.ac.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('defender.muted', this.muted ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  }

  get live() {
    return this.ac && !this.muted;
  }

  tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
    if (!this.live) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.5, f0 = 3000, f1 = 200, delay = 0) {
    if (!this.live) return;
    const t = this.ac.currentTime + delay;
    const src = this.ac.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = this.ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  laser() { this.tone('square', 2200, 300, 0.14, 0.14); }
  explode() { this.noise(0.45, 0.5, 2400, 150); }
  smartBomb() { this.noise(1.2, 0.9, 4000, 60); this.tone('sawtooth', 120, 30, 1.0, 0.35); }
  hyper() { this.tone('sine', 150, 2400, 0.45, 0.3); }
  grab() { for (let i = 0; i < 4; i++) this.tone('square', 500 + i * 120, 900 + i * 120, 0.1, 0.1, i * 0.12); }
  mutate() { this.tone('sawtooth', 900, 120, 0.4, 0.18); }
  rescue() { this.tone('square', 660, 660, 0.08, 0.14); this.tone('square', 990, 990, 0.12, 0.14, 0.08); }
  extra() { [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.1, 0.14, i * 0.09)); }
  spawn() { this.tone('sine', 80, 700, 0.5, 0.12); }
  enemyShot() { this.tone('square', 900, 400, 0.05, 0.05); }
  humanDie() { this.tone('triangle', 800, 100, 0.5, 0.22); }
  death() { this.noise(2.2, 0.9, 3000, 40); this.tone('sawtooth', 500, 30, 1.8, 0.3); }
  planet() { this.noise(3, 1, 1500, 30); this.tone('sawtooth', 200, 20, 2.5, 0.3); }
  waveStart() { this.tone('triangle', 220, 880, 0.6, 0.18); }
}
