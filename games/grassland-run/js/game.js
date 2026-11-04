/* game.js — 主循环、物理、关卡生成、界面栈
   ────────────────────────────────────────────────────────────
   固定步长 1/120 秒：物理与弹簧都在固定步里跑，
   渲染和输入在外面，掉帧不会改变跳跃高度。            */
(function () {
  'use strict';
  const GR = window.GR;
  const { clamp, lerp, damp, rand, randInt, chance, pick, TAU } = GR;

  const stage = document.getElementById('stage');
  const ctx = stage.getContext('2d', { alpha: false });

  const V = { w: 1280, h: 720, groundY: 576, scale: 1, dpr: 1 };

  const CFG = {
    baseSpeed: 330,
    maxSpeed: 610,
    speedGain: 4.2,
    gravity: 2950,
    fallMul: 1.85,
    jumpVel: 1085,
    doubleJumpVel: 880,
    maxFall: 1750,
    standHeight: 84,
    slideHeight: 28,
    coyote: 0.1,
    buffer: 0.12,
    hearts: 3,
    traumaDecay: 1.5
  };

  const HEART_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.6C7.3 17.6 3.4 14.5 3.4 10.2 3.4 7.5 5.5 5.5 8 5.5c1.6 0 3 .8 4 2.1 1-1.3 2.4-2.1 4-2.1 2.5 0 4.6 2 4.6 4.7 0 4.3-3.9 7.4-8.6 10.4z" fill="#FF6F91" stroke="#2B3040" stroke-width="2.1" stroke-linejoin="round"/><path d="M7.4 8.2c.5-.7 1.2-1 1.9-1" stroke="#FFC0CF" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>';

  const G = {
    mode: 'title',
    time: 0,
    runTime: 0,
    dyingT: 0,
    hitstop: 0,
    speed: CFG.baseSpeed,
    score: 0,
    coins: 0,
    distance: 0,
    hearts: CFG.hearts,
    startX: 220,
    spawnX: 0,
    best: 0,
    shakeEnabled: true,
    rigDebug: false,
    cam: { x: 0, trauma: 0, shakeX: 0, shakeY: 0 },
    player: null,
    obstacles: [],
    coinsArr: [],
    floats: [],
    particles: new GR.Particles()
  };

  const character = new GR.Character();
  const world = new GR.World();

  /* ───────────── 存档 ───────────── */
  function loadBest() {
    try { G.best = parseInt(localStorage.getItem('grassland-dash-best') || '0', 10) || 0; }
    catch (e) { G.best = 0; }
  }
  function saveBest(v) {
    G.best = Math.max(G.best, v);
    try { localStorage.setItem('grassland-dash-best', String(G.best)); } catch (e) { /* 无痕模式忽略 */ }
  }

  /* ───────────── 尺寸 ───────────── */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(320, window.innerWidth);
    const ch = Math.max(320, window.innerHeight);
    let scale = ch / 720;
    if (cw / scale < 640) scale = cw / 640;   // 竖屏时保底横向视野
    V.dpr = dpr;
    V.scale = scale;
    V.w = cw / scale;
    V.h = ch / scale;
    V.groundY = Math.round(V.h * 0.79);
    stage.width = Math.round(cw * dpr);
    stage.height = Math.round(ch * dpr);
    stage.style.width = cw + 'px';
    stage.style.height = ch + 'px';
    if (G.player && G.mode === 'title') G.player.y = V.groundY - CFG.standHeight;
  }

  /* ───────────── 输入 ───────────── */
  let jumpQueued = false;
  let slideHeld = false;
  const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];

  function cutJump() {
    const p = G.player;
    if (p && p.vy < 0 && !p.onGround) p.vy *= 0.45;
  }

  function onKeyDown(e) {
    const k = e.code;
    if (JUMP_KEYS.includes(k) || k === 'ArrowDown' || k === 'KeyS') e.preventDefault();

    if (k === 'KeyR') { G.rigDebug = !G.rigDebug; return; }
    if (k === 'KeyM') { GR.Audio.muted = !GR.Audio.muted; return; }

    if (k === 'Escape' || k === 'KeyP') {
      if (G.mode === 'playing') { pauseGame(); return; }
      if (G.mode === 'paused') { resumeGame(); return; }
    }

    if (G.mode !== 'playing') {
      if (k === 'Enter' && G.mode !== 'paused') {
        const btn = document.querySelector('#screens .screen[data-active="true"] .btn.primary');
        if (btn) btn.click();
      }
      return;
    }

    if (JUMP_KEYS.includes(k)) {
      if (!e.repeat) jumpQueued = true;
    }
    if (k === 'ArrowDown' || k === 'KeyS') slideHeld = true;
  }

  function onKeyUp(e) {
    const k = e.code;
    if (JUMP_KEYS.includes(k)) cutJump();
    if (k === 'ArrowDown' || k === 'KeyS') slideHeld = false;
  }

  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);

  /* ───────────── 触屏 ───────────── */
  const btnJump = document.getElementById('btn-jump');
  const btnSlide = document.getElementById('btn-slide');

  function bindTouch(el, onDown, onUp) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); GR.Audio.init(); onDown(); });
    el.addEventListener('pointerup', (e) => { e.preventDefault(); if (onUp) onUp(); });
    el.addEventListener('pointercancel', () => { if (onUp) onUp(); });
    el.addEventListener('pointerleave', () => { if (onUp) onUp(); });
  }
  bindTouch(btnJump, () => {
    if (G.mode !== 'playing') return;
    jumpQueued = true;
  }, cutJump);
  bindTouch(btnSlide, () => { slideHeld = true; }, () => { slideHeld = false; });

  stage.addEventListener('pointerdown', () => {
    if (G.mode !== 'playing') return;
    GR.Audio.init();
    jumpQueued = true;
  });
  stage.addEventListener('pointerup', cutJump);

  /* ───────────── 界面栈 ───────────── */
  const screensRoot = document.getElementById('screens');
  const screens = {
    title: document.getElementById('screen-title'),
    pause: document.getElementById('screen-pause'),
    over: document.getElementById('screen-over')
  };
  const hud = document.getElementById('hud');

  function showScreen(name) {
    for (const key of Object.keys(screens)) {
      screens[key].dataset.active = String(key === name);
    }
    screensRoot.dataset.open = String(Boolean(name));
    hud.dataset.visible = String(G.mode === 'playing' || G.mode === 'paused' || G.mode === 'dying');
    if (name) {
      const btn = screens[name].querySelector('.btn');
      if (btn) setTimeout(() => { try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); } }, 40);
    }
  }

  function onAction(action) {
    GR.Audio.init();
    GR.Audio.ui();
    if (action === 'start' || action === 'restart') startGame();
    else if (action === 'resume') resumeGame();
    else if (action === 'title') goTitle();
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn) { onAction(btn.dataset.action); return; }
    const tg = e.target.closest('[data-toggle]');
    if (tg) {
      const kind = tg.dataset.toggle;
      if (kind === 'sound') {
        GR.Audio.muted = !GR.Audio.muted;
        tg.setAttribute('aria-pressed', String(!GR.Audio.muted));
      } else if (kind === 'shake') {
        G.shakeEnabled = !G.shakeEnabled;
        tg.setAttribute('aria-pressed', String(G.shakeEnabled));
      }
      GR.Audio.ui();
    }
  });

  /* ───────────── HUD ───────────── */
  const scoreEl = document.getElementById('score');
  const distEl = document.getElementById('dist');
  const bestEl = document.getElementById('best');
  const heartsEl = document.getElementById('hearts');
  const hudCache = { score: -1, dist: -1, best: -1, hearts: -1 };

  function buildHearts() {
    heartsEl.innerHTML = '';
    for (let i = 0; i < CFG.hearts; i++) {
      const d = document.createElement('div');
      d.className = 'heart';
      d.innerHTML = HEART_SVG;
      heartsEl.appendChild(d);
    }
  }

  function syncHearts(popIndex) {
    if (hudCache.hearts === G.hearts && popIndex == null) return;
    hudCache.hearts = G.hearts;
    [...heartsEl.children].forEach((el, i) => {
      el.classList.toggle('lost', i >= G.hearts);
      if (popIndex === i) {
        el.classList.remove('pop');
        void el.offsetWidth;
        el.classList.add('pop');
        setTimeout(() => el.classList.remove('pop'), 420);
      }
    });
  }

  function syncHUD() {
    const s = Math.floor(G.score);
    const d = Math.floor(G.distance);
    if (s !== hudCache.score) { scoreEl.textContent = String(s); hudCache.score = s; }
    if (d !== hudCache.dist) { distEl.textContent = String(d); hudCache.dist = d; }
    if (G.best !== hudCache.best) { bestEl.textContent = String(G.best); hudCache.best = G.best; }
    syncHearts();
  }

  /* ───────────── 流程 ───────────── */
  function makePlayer() {
    return {
      x: G.startX, y: V.groundY - CFG.standHeight, vy: 0,
      groundY: V.groundY,
      onGround: true, sliding: false,
      coyote: 0, buffer: 0, jumps: 0,
      lean: 0.04, hurtT: 0, invuln: 0, dead: false, mood: 'idle'
    };
  }

  function startGame() {
    GR.Audio.init();
    G.player = makePlayer();
    G.obstacles.length = 0;
    G.coinsArr.length = 0;
    G.floats.length = 0;
    G.particles.clear();
    G.hearts = CFG.hearts;
    G.score = 0; G.coins = 0; G.distance = 0; G.runTime = 0;
    G.speed = CFG.baseSpeed;
    G.cam.x = G.player.x - V.w * 0.32;
    G.cam.trauma = 0;
    G.hitstop = 0;
    G.dyingT = 0;
    G.spawnX = G.player.x + V.w * 0.62;
    G.mode = 'playing';
    character.reset();
    hudCache.hearts = -1;
    syncHearts();
    showScreen(null);
    populate();
  }

  function pauseGame() {
    if (G.mode !== 'playing') return;
    G.mode = 'paused';
    showScreen('pause');
  }

  function resumeGame() {
    if (G.mode !== 'paused') return;
    G.mode = 'playing';
    showScreen(null);
  }

  function goTitle() {
    G.mode = 'title';
    G.player = makePlayer();
    G.player.x = V.w * 0.17;
    G.player.y = V.groundY - CFG.standHeight;
    G.obstacles.length = 0;
    G.coinsArr.length = 0;
    G.floats.length = 0;
    G.particles.clear();
    G.cam.x = 0;
    G.cam.trauma = 0;
    character.reset();
    showScreen('title');
  }

  function die() {
    const p = G.player;
    if (p.dead) return;
    p.dead = true;
    p.mood = 'hurt';
    p.vy = -720;
    p.onGround = false;
    G.mode = 'dying';
    G.dyingT = 1.15;
    G.hitstop = 0.16;
    G.cam.trauma = 1;
    G.particles.burst(p.x, p.y - 40, 26, { color: '#FFFFFF', speedMin: 120, speedMax: 420, sizeMin: 4, sizeMax: 12 });
    G.particles.sparkle(p.x, p.y - 40, '#FF8FA3', 12);
    GR.Audio.gameOver();
  }

  function showOver() {
    G.mode = 'over';
    const finalScore = Math.floor(G.score);
    saveBest(finalScore);
    document.getElementById('final-score').textContent = String(finalScore);
    document.getElementById('final-dist').textContent = Math.floor(G.distance) + ' m';
    document.getElementById('final-coins').textContent = String(G.coins);
    document.getElementById('final-best').textContent = String(G.best);
    showScreen('over');
  }

  /* ───────────── 关卡生成 ───────────── */
  const GROUND_TYPES = ['rock', 'stump', 'bush', 'fence'];

  function addObstacle(type, x) {
    const o = { type, x, hit: false, t: rand(0, TAU) };
    if (type === 'bird') { o.y = V.groundY - rand(150, 178); o.w = 56; o.h = 36; }
    else if (type === 'fence') { o.y = V.groundY; o.w = 82; o.h = 62; }
    else if (type === 'bush') { o.y = V.groundY; o.w = 72; o.h = 50; }
    else if (type === 'stump') { o.y = V.groundY; o.w = 64; o.h = 48; }
    else { o.y = V.groundY; o.w = 58; o.h = 46; }
    G.obstacles.push(o);
    return o;
  }

  function spawnCoinArc(x, n) {
    const count = n || 5;
    const baseY = V.groundY - 84;
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      G.coinsArr.push({ x: x + i * 44, y: baseY - 64 * (1 - t * t), r: 15, phase: rand(0, TAU), taken: false });
    }
  }

  function spawnPattern(x, diff) {
    const r = Math.random();
    if (r < 0.16 + diff * 0.14) {
      addObstacle(pick(GROUND_TYPES), x);
      addObstacle('bird', x + rand(150, 230));
    } else if (r < 0.34) {
      addObstacle('bird', x);
    } else {
      addObstacle(pick(GROUND_TYPES), x);
    }
    if (chance(0.5)) spawnCoinArc(x + rand(40, 130), randInt(4, 6));
  }

  function populate() {
    const horizon = G.cam.x + V.w + 700;
    let guard = 0;
    while (G.spawnX < horizon && guard++ < 40) {
      const diff = clamp((G.speed - CFG.baseSpeed) / (CFG.maxSpeed - CFG.baseSpeed), 0, 1);
      const gap = lerp(560, 380, diff) + rand(-30, 80);
      G.spawnX += gap;
      spawnPattern(G.spawnX, diff);
    }
  }

  /* ───────────── 更新 ───────────── */
  function addFloat(x, y, text, color) {
    G.floats.push({ x, y, text, color, life: 0.9, max: 0.9, vy: -70 });
  }

  function updateFloats(dt) {
    for (let i = G.floats.length - 1; i >= 0; i--) {
      const f = G.floats[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.94;
      if (f.life <= 0) G.floats.splice(i, 1);
    }
  }

  function doJump(n) {
    const p = G.player;
    p.onGround = false;
    p.vy = n === 1 ? -CFG.jumpVel : -CFG.doubleJumpVel;
    p.jumps = n;
    p.buffer = 0;
    p.coyote = 0;
    character.impulse(n === 1 ? 1.25 : 1.0);
    G.particles.dust(p.x, V.groundY - 2, n === 1 ? 8 : 5, -1);
    if (n === 2) G.particles.ring(p.x, p.y + 14, '#FFFFFF', 18);
    G.cam.trauma = Math.min(1, G.cam.trauma + 0.1);
    if (n === 1) GR.Audio.jump(); else GR.Audio.doubleJump();
  }

  function land() {
    const p = G.player;
    p.onGround = true;
    p.y = V.groundY - (p.sliding ? CFG.slideHeight : CFG.standHeight);
    p.vy = 0;
    p.jumps = 0;
    character.impulse(-1.5);
    G.particles.dust(p.x, V.groundY - 2, 10, -1);
    G.particles.ring(p.x, V.groundY - 4, 'rgba(255,255,255,0.9)', 14);
    G.cam.trauma = Math.min(1, G.cam.trauma + 0.22);
    GR.Audio.land();
  }

  function playerBox(p) {
    if (p.sliding) return { x: p.x - 56, y: p.y - 40, w: 112, h: 42 };
    return { x: p.x - 48, y: p.y - 92, w: 96, h: 148 };
  }

  function obstacleBox(o) {
    if (o.type === 'bird') return { x: o.x - 26, y: o.y - 15, w: 52, h: 30 };
    return { x: o.x - o.w / 2 + 6, y: o.y - o.h + 5, w: o.w - 12, h: o.h - 5 };
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function hurt() {
    const p = G.player;
    if (p.invuln > 0 || p.dead) return;
    G.hearts = Math.max(0, G.hearts - 1);
    hudCache.hearts = -1;
    syncHearts(G.hearts);
    p.invuln = 1.6;
    p.hurtT = 0.5;
    G.hitstop = 0.085;
    G.cam.trauma = Math.min(1, G.cam.trauma + 0.62);
    character.impulse(-1.7);
    G.particles.burst(p.x, p.y - 46, 15, { color: '#FFFFFF', speedMin: 140, speedMax: 340, sizeMin: 4, sizeMax: 10 });
    G.particles.sparkle(p.x, p.y - 46, '#FF8FA3', 8);
    addFloat(p.x, p.y - 138, '-1 心', '#FF5C7A');
    GR.Audio.hit();
    p.vy = -430;
    p.onGround = false;
    if (G.hearts <= 0) die();
  }

  function updateRun(dt) {
    const p = G.player;
    const alive = G.mode === 'playing';
    p.groundY = V.groundY;

    if (alive) G.runTime += dt;
    G.speed = alive
      ? Math.min(CFG.baseSpeed + G.runTime * CFG.speedGain, CFG.maxSpeed)
      : damp(G.speed, 0, 4, dt);

    p.x += G.speed * dt;
    p.speed = G.speed;
    G.distance = Math.max(0, (p.x - G.startX) / 12);

    if (alive) {
      if (jumpQueued) { p.buffer = CFG.buffer; jumpQueued = false; }
    } else {
      jumpQueued = false;
    }
    p.buffer -= dt;
    if (p.onGround) p.coyote = CFG.coyote;
    else p.coyote -= dt;

    p.sliding = alive && slideHeld && p.onGround;
    const restY = V.groundY - (p.sliding ? CFG.slideHeight : CFG.standHeight);

    if (p.buffer > 0) {
      if (p.coyote > 0) doJump(1);
      else if (p.jumps < 2) doJump(2);
    }

    if (!p.onGround) {
      let g = p.vy > 0 ? CFG.gravity * CFG.fallMul : CFG.gravity;
      if (Math.abs(p.vy) < 130) g *= 0.74;          // 顶点小悬停，手感更软
      p.vy = Math.min(p.vy + g * dt, CFG.maxFall);
      p.y += p.vy * dt;
      if (p.y >= restY && p.vy > 0) land();
    } else {
      p.y = damp(p.y, restY, 30, dt);
      p.vy = 0;
    }

    const targetLean = p.sliding
      ? -0.12
      : clamp((G.speed - 240) / 2800, 0.035, 0.17) + (p.vy < 0 ? 0.055 : 0);
    p.lean = damp(p.lean, targetLean, 10, dt);

    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;

    p.mood = p.dead ? 'hurt'
      : !p.onGround ? (p.vy < 0 ? 'jump' : 'fall')
      : p.sliding ? 'slide'
      : p.hurtT > 0 ? 'hurt'
      : 'run';

    if (p.onGround && !p.sliding && Math.random() < dt * 12) {
      G.particles.dust(p.x - 22, V.groundY - 2, 1, -1);
    }

    character.update(dt, p);
    G.particles.update(dt);
    updateFloats(dt);

    const pb = playerBox(p);
    for (let i = G.obstacles.length - 1; i >= 0; i--) {
      const o = G.obstacles[i];
      o.t += dt;
      if (o.type === 'bird') o.x -= 22 * dt;
      if (o.x < G.cam.x - 260) { G.obstacles.splice(i, 1); continue; }
      if (!o.hit && alive && p.invuln <= 0 && overlap(pb, obstacleBox(o))) {
        o.hit = true;
        hurt();
      }
    }

    for (let i = G.coinsArr.length - 1; i >= 0; i--) {
      const c = G.coinsArr[i];
      if (c.taken) { G.coinsArr.splice(i, 1); continue; }
      if (c.x < G.cam.x - 200) { G.coinsArr.splice(i, 1); continue; }
      if (alive) {
        const dx = c.x - p.x;
        const dy = c.y - (p.y - 50);
        if (Math.hypot(dx, dy) < c.r + 42) {
          c.taken = true;
          G.coins++;
          G.score = Math.floor(G.distance) + G.coins * 10;
          G.particles.sparkle(c.x, c.y, '#FFD84D', 9);
          G.particles.ring(c.x, c.y, '#FFF0B0', 12);
          addFloat(c.x, c.y - 18, '+10', '#FFB020');
          G.cam.trauma = Math.min(1, G.cam.trauma + 0.05);
          GR.Audio.coin();
        }
      }
    }

    if (alive) G.score = Math.floor(G.distance) + G.coins * 10;

    if (G.mode === 'dying') {
      G.dyingT -= dt;
      if (G.dyingT <= 0) showOver();
    }

    if (alive) populate();
  }

  function updateTitle(dt) {
    const p = G.player;
    p.speed = 0;
    p.groundY = V.groundY;
    p.lean = damp(p.lean, 0.02, 6, dt);
    p.mood = 'idle';
    p.vy = 0;
    p.onGround = true;
    p.y = V.groundY - CFG.standHeight + Math.sin(G.time * 1.6) * 1.5;
    character.update(dt, p);
    G.particles.update(dt);
    updateFloats(dt);
  }

  function updateCamera(dt) {
    let target;
    const ratio = V.w < 800 ? 0.24 : 0.32;   // 窄屏时把人放左一点，多看一眼前方
    if (G.mode === 'title') target = 0;
    else if (G.mode === 'paused' || G.mode === 'over') target = G.player.x - V.w * 0.15;
    else target = G.player.x - V.w * ratio;

    const lambda = (G.mode === 'paused' || G.mode === 'over') ? 5 : 7;
    G.cam.x = damp(G.cam.x, target, lambda, dt);

    G.cam.trauma = Math.max(0, G.cam.trauma - CFG.traumaDecay * dt);
    const s = G.cam.trauma * G.cam.trauma * (G.shakeEnabled ? 1 : 0);
    G.cam.shakeX = (Math.sin(G.time * 37.1) * 9 + Math.sin(G.time * 21.7) * 4.2) * s;
    G.cam.shakeY = (Math.cos(G.time * 41.3) * 7 + Math.sin(G.time * 15.9) * 3.4) * s;
  }

  function step(dt) {
    G.time += dt;
    world.update(dt);
    if (G.mode === 'title') updateTitle(dt);
    else if (G.mode === 'playing' || G.mode === 'dying') updateRun(dt);
    updateCamera(dt);
  }

  /* ───────────── 绘制 ───────────── */
  function paint(fill, lw) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw || 4;
    ctx.strokeStyle = '#2B3040';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function drawCoin(c) {
    const bob = Math.sin(G.time * 3 + c.phase) * 4;
    const spin = Math.abs(Math.cos(G.time * 2.4 + c.phase));
    ctx.save();
    ctx.translate(c.x, c.y + bob);

    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
    glow.addColorStop(0, 'rgba(255, 236, 150, 0.55)');
    glow.addColorStop(1, 'rgba(255, 236, 150, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.scale(0.45 + spin * 0.55, 1);
    GR.drawStar(ctx, 0, 0, 17, 5, 0.46);
    paint('#FFD84D', 3.4);
    GR.drawStar(ctx, 0, 0, 8.5, 5, 0.46);
    ctx.fillStyle = '#FFF0A8';
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawObstacle(o) {
    ctx.save();
    ctx.translate(o.x, o.y);

    if (o.type === 'rock') {
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.quadraticCurveTo(-32, -20, -15, -29);
      ctx.quadraticCurveTo(-2, -38, 14, -28);
      ctx.quadraticCurveTo(30, -20, 27, 0);
      ctx.closePath();
      paint('#B9C2CF', 4.2);
      ctx.beginPath();
      ctx.moveTo(-19, -14);
      ctx.quadraticCurveTo(-12, -25, 0, -26);
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (o.type === 'stump') {
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.lineTo(-18, -30);
      ctx.quadraticCurveTo(0, -38, 18, -30);
      ctx.lineTo(22, 0);
      ctx.closePath();
      paint('#B9855A', 4.2);
      ctx.beginPath();
      ctx.ellipse(0, -32, 20, 8, 0, 0, TAU);
      paint('#E0B98C', 4);
      ctx.beginPath();
      ctx.ellipse(0, -32, 10, 4, 0, 0, TAU);
      ctx.strokeStyle = '#B9855A';
      ctx.lineWidth = 2.4;
      ctx.stroke();
    } else if (o.type === 'bush') {
      ctx.beginPath();
      ctx.arc(-18, -14, 20, 0, TAU);
      ctx.arc(4, -22, 24, 0, TAU);
      ctx.arc(26, -12, 18, 0, TAU);
      ctx.fillStyle = '#56AE57';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-18, -14, 20, Math.PI * 0.9, Math.PI * 1.9);
      ctx.arc(4, -22, 24, Math.PI * 1.05, Math.PI * 1.95);
      ctx.arc(26, -12, 18, Math.PI * 0.95, Math.PI * 1.9);
      ctx.strokeStyle = '#2B3040';
      ctx.lineWidth = 4.2;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.fillStyle = '#7ED47C';
      ctx.beginPath();
      ctx.arc(-12, -22, 8, 0, TAU);
      ctx.arc(10, -30, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#FF6F91';
      ctx.beginPath();
      ctx.arc(-6, -10, 3.6, 0, TAU);
      ctx.arc(17, -18, 3.2, 0, TAU);
      ctx.fill();
    } else if (o.type === 'fence') {
      for (const y of [-46, -26]) {
        ctx.beginPath();
        ctx.moveTo(-40, y);
        ctx.lineTo(40, y);
        ctx.strokeStyle = '#C99A63';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.strokeStyle = '#2B3040';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-40, y - 4);
        ctx.lineTo(40, y - 4);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
      for (const x of [-32, 32]) {
        ctx.beginPath();
        GR.roundRect(ctx, x - 8, -62, 16, 62, 5);
        paint('#D9AC77', 4);
      }
    } else if (o.type === 'bird') {
      const flap = Math.sin(o.t * 14) * 0.9;
      ctx.translate(0, Math.sin(o.t * 5) * 4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 13, 0, 0, TAU);
      paint('#3E4557', 3.8);

      ctx.save();
      ctx.translate(-2, -4);
      ctx.rotate(-0.5 + flap * 0.7);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-16, -14, -30, -4);
      ctx.quadraticCurveTo(-18, 6, 0, 6);
      ctx.closePath();
      paint('#525C72', 3.4);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(15, -6, 10, 0, TAU);
      paint('#3E4557', 3.4);

      ctx.beginPath();
      ctx.moveTo(23, -6);
      ctx.lineTo(34, -2);
      ctx.lineTo(23, 1);
      ctx.closePath();
      paint('#FFB84D', 3);

      ctx.beginPath();
      ctx.arc(18, -8, 3.4, 0, TAU);
      ctx.fillStyle = '#FFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(18.6, -8, 1.8, 0, TAU);
      ctx.fillStyle = '#171A22';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-19, -2);
      ctx.lineTo(-32, -10);
      ctx.lineTo(-30, 2);
      ctx.closePath();
      paint('#525C72', 3);
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = G.player;
    if (!p) return;

    const height = Math.max(0, V.groundY - (p.y + CFG.standHeight));
    const shadowScale = clamp(1 - height / 420, 0.42, 1);
    ctx.save();
    ctx.globalAlpha = 0.22 * shadowScale;
    ctx.fillStyle = '#2D5E33';
    ctx.beginPath();
    ctx.ellipse(p.x, V.groundY + 6, 74 * shadowScale, 16 * shadowScale, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (p.invuln > 0) {
      ctx.save();
      ctx.globalAlpha = 0.42 + 0.58 * Math.abs(Math.sin(G.time * 22));
      character.draw(ctx, p);
      ctx.restore();
    } else {
      character.draw(ctx, p);
    }

    if (G.rigDebug) character.drawRig(ctx);
  }

  function drawFloats() {
    for (const f of G.floats) {
      const t = clamp(f.life / f.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 2.2);
      ctx.translate(f.x, f.y);
      const s = 1 + (1 - t) * 0.25;
      ctx.scale(s, s);
      ctx.font = '900 22px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#2B3040';
      ctx.lineJoin = 'round';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  }

  function render() {
    const k = V.dpr * V.scale;
    ctx.setTransform(k, 0, 0, k, 0, 0);

    // 背景层：world 内部已经把世界坐标转成屏幕坐标
    ctx.save();
    ctx.translate(G.cam.shakeX, G.cam.shakeY);
    world.draw(ctx, V, G.cam);
    ctx.restore();

    // 实体层：世界坐标，需要减去相机位置
    ctx.save();
    ctx.translate(G.cam.shakeX - G.cam.x, G.cam.shakeY);
    for (const c of G.coinsArr) if (!c.taken) drawCoin(c);
    for (const o of G.obstacles) drawObstacle(o);
    drawPlayer();
    G.particles.draw(ctx);
    drawFloats();
    ctx.restore();

    world.drawForeground(ctx, V, G.cam);
  }

  /* ───────────── 主循环 ───────────── */
  const STEP = 1 / 120;
  let acc = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.25);

    if (G.hitstop > 0) {
      G.hitstop = Math.max(0, G.hitstop - dt);
    } else if (G.mode !== 'paused') {
      acc += dt;
      let guard = 0;
      while (acc >= STEP && guard++ < 12) {
        step(STEP);
        acc -= STEP;
      }
      if (guard >= 12) acc = 0;
    } else {
      acc = 0;
    }

    // 面板打开时也让镜头慢慢把人让出来
    if (G.mode === 'paused' || G.mode === 'over') updateCamera(dt);

    render();
    syncHUD();
  }

  /* ───────────── 启动 ───────────── */
  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.has('noanim')) document.documentElement.classList.add('no-anim');
    if (params.has('mute')) GR.Audio.muted = true;
    if (params.has('rig')) G.rigDebug = true;

    resize();
    loadBest();
    buildHearts();
    syncHearts();
    G.player = makePlayer();
    goTitle();
    syncHUD();

    if (params.has('demo')) {
      startGame();
      if (params.has('slide')) slideHeld = true;
      const t = clamp(parseFloat(params.get('t') || '2.5'), 0, 60);
      for (let i = 0; i < t * 120; i++) step(STEP);
      if (params.has('jump')) {
        jumpQueued = true;
        const air = clamp(parseFloat(params.get('jump') || '0.16'), 0, 2);
        for (let i = 0; i < air * 120; i++) step(STEP);
      }
    }

    // 调试/截图用：直接进入某个界面
    if (params.has('pause')) {
      startGame();
      for (let i = 0; i < 90; i++) step(STEP);
      pauseGame();
    }
    if (params.has('die')) {
      startGame();
      for (let i = 0; i < 120; i++) step(STEP);
      G.hearts = 0;
      hudCache.hearts = -1;
      syncHearts();
      die();
      for (let i = 0; i < 200; i++) step(STEP);
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => { resize(); render(); });
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.mode === 'playing') pauseGame();
  });
  window.addEventListener('blur', () => { if (G.mode === 'playing') pauseGame(); });

  window.__GR = { G, V, CFG, startGame, step, render, character, world };

  boot();
})();
