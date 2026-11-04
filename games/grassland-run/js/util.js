/* util.js — 数学 / 弹簧 / 粒子 / 音效
   没有任何外部依赖：整个游戏在 file:// 下双击即可运行。 */
window.GR = window.GR || {};
(function (GR) {
  'use strict';

  const TAU = Math.PI * 2;
  GR.TAU = TAU;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  // 帧率无关的指数趋近：dt 越大越靠拢目标
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const chance = (p) => Math.random() < p;
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  // 稳定的伪随机：给每个世界坐标格子一个固定值，避免背景闪烁
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  Object.assign(GR, { clamp, lerp, damp, rand, randInt, chance, pick, hash, easeOutCubic, easeOutBack, easeInOutQuad });

  /* ───────────────────────── 弹簧 ─────────────────────────
     半隐式欧拉 + 固定子步。给「关节」用：目标角度一变，
     关节先冲过头再弹回来，这就是「灵活」的手感来源。      */
  class Spring {
    constructor(value = 0, stiffness = 160, damping = 14) {
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.stiffness = stiffness;
      this.damping = damping;
    }
    step(dt) {
      const a = (this.target - this.value) * this.stiffness - this.velocity * this.damping;
      this.velocity += a * dt;
      this.value += this.velocity * dt;
      return this.value;
    }
    // 直接给一记冲量（落地、起跳、受击）
    kick(v) { this.velocity += v; }
    snap(v) { this.value = v; this.target = v; this.velocity = 0; }
  }
  GR.Spring = Spring;

  /* ───────────────────────── 音效 ─────────────────────────
     全部用 WebAudio 现场合成，不加载任何音频文件。          */
  const Audio = {
    ctx: null,
    muted: false,
    _master: null,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._master = this.ctx.createGain();
      this._master.gain.value = 0.5;
      this._master.connect(this.ctx.destination);
    },
    tone({ freq = 440, to = null, dur = 0.12, type = 'sine', gain = 0.16, delay = 0 }) {
      if (this.muted || !this.ctx) return;
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this._master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    },
    noise({ dur = 0.2, gain = 0.14, freq = 900, q = 1 }) {
      if (this.muted || !this.ctx) return;
      const t0 = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      src.connect(bp).connect(g).connect(this._master);
      src.start(t0);
    },
    jump() { this.tone({ freq: 520, to: 880, dur: 0.16, type: 'triangle', gain: 0.14 }); },
    doubleJump() {
      this.tone({ freq: 660, to: 1180, dur: 0.15, type: 'triangle', gain: 0.12 });
      this.tone({ freq: 990, to: 1560, dur: 0.12, type: 'sine', gain: 0.07, delay: 0.05 });
    },
    land() { this.noise({ dur: 0.14, gain: 0.1, freq: 420, q: 0.8 }); },
    step() { this.noise({ dur: 0.06, gain: 0.035, freq: 700, q: 1.4 }); },
    coin() {
      this.tone({ freq: 1050, dur: 0.09, type: 'square', gain: 0.06 });
      this.tone({ freq: 1560, dur: 0.13, type: 'square', gain: 0.05, delay: 0.07 });
    },
    hit() {
      this.tone({ freq: 220, to: 90, dur: 0.28, type: 'sawtooth', gain: 0.16 });
      this.noise({ dur: 0.22, gain: 0.16, freq: 260, q: 0.7 });
    },
    gameOver() {
      [440, 370, 294, 220].forEach((f, i) =>
        this.tone({ freq: f, dur: 0.26, type: 'triangle', gain: 0.12, delay: i * 0.13 }));
    },
    ui() { this.tone({ freq: 720, dur: 0.06, type: 'sine', gain: 0.07 }); }
  };
  GR.Audio = Audio;

  /* ───────────────────────── 粒子 ───────────────────────── */
  class Particles {
    constructor() { this.items = []; this.max = 460; }
    clear() { this.items.length = 0; }

    add(p) {
      if (this.items.length > this.max) this.items.shift();
      this.items.push(Object.assign({
        x: 0, y: 0, vx: 0, vy: 0, grav: 1400, drag: 0.86,
        life: 0.6, max: 0.6, size: 5, color: '#fff', type: 'dot',
        rot: 0, vr: 0, alpha: 1, shrink: 1
      }, p));
    }

    burst(x, y, n, opts = {}) {
      for (let i = 0; i < n; i++) {
        const a = opts.angle != null ? opts.angle + rand(-0.9, 0.9) : rand(0, TAU);
        const sp = rand(opts.speedMin != null ? opts.speedMin : 80, opts.speedMax != null ? opts.speedMax : 260);
        const life = rand(opts.lifeMin != null ? opts.lifeMin : 0.3, opts.lifeMax != null ? opts.lifeMax : 0.7);
        this.add({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          grav: opts.grav != null ? opts.grav : 1400,
          drag: opts.drag != null ? opts.drag : 0.86,
          size: rand(opts.sizeMin != null ? opts.sizeMin : 3, opts.sizeMax != null ? opts.sizeMax : 8),
          life, max: life,
          color: opts.color || '#FFFFFF',
          type: opts.type || 'dot'
        });
      }
    }

    dust(x, y, n = 6, dir = 1) {
      for (let i = 0; i < n; i++) {
        const life = rand(0.28, 0.55);
        this.add({
          x: x + rand(-10, 10), y: y + rand(-4, 4),
          vx: dir * rand(20, 110) + rand(-40, 40), vy: rand(-90, -20),
          grav: 220, drag: 0.8, size: rand(4, 11), life, max: life,
          color: chance(0.5) ? '#F4ECD8' : '#FFFFFF', type: 'dot'
        });
      }
    }

    sparkle(x, y, color = '#FFD84D', n = 10) {
      for (let i = 0; i < n; i++) {
        const life = rand(0.35, 0.75);
        this.add({
          x: x + rand(-8, 8), y: y + rand(-8, 8),
          vx: rand(-190, 190), vy: rand(-260, -40),
          grav: 620, drag: 0.9, size: rand(4, 9), life, max: life,
          color, type: 'star', rot: rand(0, TAU), vr: rand(-8, 8)
        });
      }
    }

    ring(x, y, color = '#FFFFFF', size = 16) {
      this.add({ x, y, vx: 0, vy: 0, grav: 0, life: 0.36, max: 0.36, size, color, type: 'ring', drag: 1 });
    }

    leaves(x, y, n = 5) {
      for (let i = 0; i < n; i++) {
        const life = rand(0.9, 1.6);
        this.add({
          x: x + rand(-20, 20), y: y + rand(-10, 10),
          vx: rand(-70, 40), vy: rand(-140, -40),
          grav: 240, drag: 0.93, size: rand(5, 10), life, max: life,
          color: pick(['#8FD97B', '#6FC95F', '#B7E7A2']), type: 'leaf',
          rot: rand(0, TAU), vr: rand(-5, 5)
        });
      }
    }

    update(dt) {
      const items = this.items;
      for (let i = items.length - 1; i >= 0; i--) {
        const p = items[i];
        p.life -= dt;
        if (p.life <= 0) { items.splice(i, 1); continue; }
        p.vy += p.grav * dt;
        const d = Math.pow(p.drag, dt * 60);
        p.vx *= d;
        p.vy *= d;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
    }

    draw(ctx) {
      for (const p of this.items) {
        const t = clamp(p.life / p.max, 0, 1);
        ctx.save();
        ctx.globalAlpha = t * p.alpha;
        ctx.translate(p.x, p.y);
        if (p.type === 'star') {
          ctx.rotate(p.rot);
          GR.drawStar(ctx, 0, 0, p.size * (0.4 + t * 0.8), 5, 0.44);
          ctx.fillStyle = p.color;
          ctx.fill();
        } else if (p.type === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3.5 * t + 0.6;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (1.6 - t * 1.1) + 4, 0, TAU);
          ctx.stroke();
        } else if (p.type === 'leaf') {
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU);
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (0.35 + t * 0.65), 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }
  GR.Particles = Particles;

  /* ───────────────────────── 绘图小工具 ───────────────────────── */
  GR.drawStar = function (ctx, x, y, r, points = 5, inner = 0.45) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * TAU - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * inner;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  };

  GR.roundRect = function (ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };
})(window.GR);
