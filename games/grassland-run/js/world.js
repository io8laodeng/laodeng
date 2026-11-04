/* world.js — 草地背景：天空 / 云 / 远山 / 丘陵 / 地面 / 前景草
   全部程序化绘制，多层视差，无限滚动。 */
(function (GR) {
  'use strict';
  const { TAU, clamp, rand, hash } = GR;

  GR.World = class World {
    constructor() {
      this.t = 0;
      this.clouds = [];
      for (let i = 0; i < 12; i++) {
        this.clouds.push({
          x: rand(-200, 1700),
          y: rand(24, 210),
          s: rand(0.55, 1.3),
          v: rand(5, 14)
        });
      }
    }

    reset() { this.t = 0; }

    update(dt) {
      this.t += dt;
      for (const c of this.clouds) {
        c.x += c.v * dt;
        if (c.x > 2100) { c.x = -350; c.y = rand(20, 210); }
      }
    }

    /* ── 天空 ── */
    drawSky(ctx, V) {
      const { w, groundY } = V;
      const g = ctx.createLinearGradient(0, 0, 0, groundY);
      g.addColorStop(0, '#8FD8FF');
      g.addColorStop(0.5, '#BEECFF');
      g.addColorStop(1, '#E8F9FF');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, groundY + 4);

      // 太阳
      const sx = w * 0.8;
      const sy = groundY * 0.24;
      const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 190);
      glow.addColorStop(0, 'rgba(255, 244, 194, 0.85)');
      glow.addColorStop(0.35, 'rgba(255, 240, 180, 0.35)');
      glow.addColorStop(1, 'rgba(255, 240, 180, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sx, sy, 190, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#FFF3B8';
      ctx.beginPath();
      ctx.arc(sx, sy, 52, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#FFFDF0';
      ctx.beginPath();
      ctx.arc(sx - 8, sy - 9, 36, 0, TAU);
      ctx.fill();
    }

    /* ── 云 ── */
    drawClouds(ctx, V, cam) {
      const { w } = V;
      for (const c of this.clouds) {
        let sx = (c.x - cam.x * 0.05) % 2100;
        if (sx < -400) sx += 2100;
        if (sx > w + 500) continue;
        const s = c.s;
        const bob = Math.sin(this.t * 0.6 + c.x * 0.01) * 4;

        ctx.save();
        ctx.translate(sx, c.y + bob);
        ctx.scale(s, s);
        ctx.globalAlpha = 0.94;

        // 云影
        ctx.fillStyle = 'rgba(160, 205, 235, 0.35)';
        ctx.beginPath();
        ctx.ellipse(6, 18, 78, 26, 0, 0, TAU);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        const puffs = [
          [-58, 8, 30], [-26, -6, 40], [16, -14, 44], [56, 0, 32], [30, 12, 26]
        ];
        for (const [px, py, pr] of puffs) {
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, TAU);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.ellipse(0, 14, 84, 26, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    /* ── 远山（两层剪影）── */
    drawMountains(ctx, V, cam) {
      const { w, groundY } = V;

      // 最远：淡青
      ctx.fillStyle = '#AFDCCB';
      ctx.beginPath();
      ctx.moveTo(-10, groundY - 40);
      for (let x = -10; x <= w + 20; x += 20) {
        const wx = x + cam.x * 0.1;
        const y = groundY - 120 - Math.sin(wx * 0.0016) * 46 - Math.sin(wx * 0.0043 + 1.3) * 24;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 20, groundY + 10);
      ctx.lineTo(-10, groundY + 10);
      ctx.closePath();
      ctx.fill();

      // 中景：青绿丘陵
      ctx.fillStyle = '#8FCFA4';
      ctx.beginPath();
      ctx.moveTo(-10, groundY);
      for (let x = -10; x <= w + 20; x += 18) {
        const wx = x + cam.x * 0.2;
        const y = groundY - 60 - Math.sin(wx * 0.0026 + 2.1) * 38 - Math.sin(wx * 0.0071) * 14;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 20, groundY + 10);
      ctx.lineTo(-10, groundY + 10);
      ctx.closePath();
      ctx.fill();
    }

    /* ── 近景丘陵 + 树 + 灌木 ── */
    drawHills(ctx, V, cam) {
      const { w, groundY } = V;
      const par = 0.42;

      // 丘陵主体
      ctx.fillStyle = '#79C77B';
      ctx.beginPath();
      ctx.moveTo(-10, groundY + 10);
      for (let x = -10; x <= w + 20; x += 16) {
        const wx = x + cam.x * par;
        const y = groundY - 26 - Math.sin(wx * 0.0034 + 0.7) * 26 - Math.sin(wx * 0.0092) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w + 20, groundY + 10);
      ctx.closePath();
      ctx.fill();

      // 树：按世界坐标分格，稳定生成
      const cell = 190;
      const startCell = Math.floor((cam.x * par - 200) / cell);
      const endCell = Math.floor((cam.x * par + w + 200) / cell);
      for (let i = startCell; i <= endCell; i++) {
        const h = hash(i * 3.17);
        if (h > 0.8) continue;
        const wx = i * cell + hash(i * 7.3) * cell * 0.7;
        const sx = wx - cam.x * par;
        const baseY = groundY - 30 - Math.sin((wx) * 0.0034 + 0.7) * 26;
        this.drawTree(ctx, sx, baseY, 0.7 + h * 0.6, h);
      }

      // 丘陵上的小灌木
      for (let i = startCell; i <= endCell; i++) {
        const h = hash(i * 11.7 + 4.2);
        if (h < 0.55) continue;
        const wx = i * cell + hash(i * 5.1) * cell;
        const sx = wx - cam.x * par;
        const baseY = groundY - 28 - Math.sin((wx) * 0.0034 + 0.7) * 26;
        ctx.fillStyle = '#5FB469';
        ctx.beginPath();
        ctx.arc(sx, baseY, 11 + h * 6, Math.PI, 0);
        ctx.fill();
      }
    }

    drawTree(ctx, x, baseY, s, seed) {
      ctx.save();
      ctx.translate(x, baseY);
      ctx.scale(s, s);

      // 树干
      ctx.fillStyle = '#9A7550';
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(-3, -30);
      ctx.lineTo(3, -30);
      ctx.lineTo(5, 0);
      ctx.closePath();
      ctx.fill();

      // 树冠（三层圆）
      const sway = Math.sin(this.t * 0.8 + seed * 9) * 2.4;
      ctx.fillStyle = '#57AB60';
      ctx.beginPath();
      ctx.arc(-13 + sway, -36, 17, 0, TAU);
      ctx.arc(13 + sway, -38, 18, 0, TAU);
      ctx.arc(0 + sway, -54, 21, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#6CC273';
      ctx.beginPath();
      ctx.arc(-9 + sway, -44, 12, 0, TAU);
      ctx.arc(6 + sway, -50, 11, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    /* ── 地面 ── */
    drawGround(ctx, V, cam) {
      const { w, h, groundY } = V;

      // 草皮底色
      const grass = ctx.createLinearGradient(0, groundY - 4, 0, h);
      grass.addColorStop(0, '#93DC7A');
      grass.addColorStop(0.15, '#72CC61');
      grass.addColorStop(0.55, '#5DB94F');
      grass.addColorStop(1, '#3E8B44');
      ctx.fillStyle = grass;
      ctx.fillRect(0, groundY - 6, w, h - groundY + 6);

      const step = 38;
      const start = Math.floor(cam.x / step) * step - step;

      // 草皮边缘的暗部（让地平线有厚度）
      ctx.beginPath();
      ctx.moveTo(-30, groundY + 16);
      for (let wx = start; wx < cam.x + w + step; wx += step) {
        const sx = wx - cam.x;
        ctx.quadraticCurveTo(sx + step / 2, groundY - 4, sx + step, groundY + 12);
      }
      ctx.lineTo(w + 40, groundY + 16);
      ctx.closePath();
      ctx.fillStyle = 'rgba(62, 139, 68, 0.45)';
      ctx.fill();

      // 亮色草边
      ctx.beginPath();
      for (let wx = start; wx < cam.x + w + step; wx += step) {
        const sx = wx - cam.x;
        if (wx === start) ctx.moveTo(sx, groundY + 10);
        ctx.quadraticCurveTo(sx + step / 2, groundY - 6, sx + step, groundY + 9);
      }
      ctx.strokeStyle = '#A9E68F';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 草面上的纹理：细草、石子、小花
      const cell = 46;
      const gStart = Math.floor(cam.x / cell) * cell;
      for (let wx = gStart; wx < cam.x + w + cell; wx += cell) {
        const sx = wx - cam.x;
        const h1 = hash(wx * 0.21);
        const h2 = hash(wx * 0.53 + 3.3);
        const h3 = hash(wx * 1.17 + 7.1);
        const y = groundY + 20 + h2 * (h - groundY - 40);

        ctx.save();
        ctx.translate(sx, y);

        if (h1 < 0.55) {
          // 一小撮草
          ctx.strokeStyle = h3 > 0.5 ? '#4FA34D' : '#7FD46F';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          for (let b = -1; b <= 1; b++) {
            ctx.beginPath();
            ctx.moveTo(b * 3, 0);
            ctx.quadraticCurveTo(b * 4 + h3 * 4, -6, b * 5 + h3 * 6, -12 - h1 * 6);
            ctx.stroke();
          }
        } else if (h1 < 0.78) {
          // 石子
          ctx.fillStyle = 'rgba(126, 174, 108, 0.55)';
          ctx.beginPath();
          ctx.ellipse(0, 0, 5 + h3 * 4, 3 + h3 * 2, 0, 0, TAU);
          ctx.fill();
        } else {
          // 小花
          ctx.fillStyle = h3 > 0.5 ? 'rgba(255, 212, 94, 0.85)' : 'rgba(255, 255, 255, 0.85)';
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * TAU;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * 3.4, Math.sin(a) * 3.4, 2.4, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = '#FFC44D';
          ctx.beginPath();
          ctx.arc(0, 0, 1.8, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }

      // 底部压暗，把视线压回角色
      const shade = ctx.createLinearGradient(0, h - 120, 0, h);
      shade.addColorStop(0, 'rgba(40, 96, 48, 0)');
      shade.addColorStop(1, 'rgba(40, 96, 48, 0.42)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, h - 120, w, 120);
    }

    /* ── 地面装饰（花 / 石头 / 草丛 / 蘑菇）── */
    drawProps(ctx, V, cam) {
      const { w, groundY } = V;
      const cell = 150;
      const start = Math.floor((cam.x - 120) / cell);
      const end = Math.floor((cam.x + w + 120) / cell);

      for (let i = start; i <= end; i++) {
        const h1 = hash(i * 1.71);
        const h2 = hash(i * 9.13 + 2.7);
        const h3 = hash(i * 4.37 + 8.1);
        const wx = i * cell + h1 * cell;
        const sx = wx - cam.x;
        const kind = h2;
        const s = 0.75 + h3 * 0.5;

        ctx.save();
        ctx.translate(sx, groundY + 4);
        ctx.scale(s, s);

        if (kind < 0.34) {
          // 草丛
          const sway = Math.sin(this.t * 1.6 + i) * 2.2;
          ctx.strokeStyle = '#4FA34D';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          for (let b = -2; b <= 2; b++) {
            ctx.beginPath();
            ctx.moveTo(b * 4, 0);
            ctx.quadraticCurveTo(b * 6 + sway, -12, b * 8 + sway * 1.6, -22 + Math.abs(b) * 4);
            ctx.stroke();
          }
          ctx.strokeStyle = '#7FD46F';
          ctx.lineWidth = 2;
          for (let b = -1; b <= 1; b++) {
            ctx.beginPath();
            ctx.moveTo(b * 5, 0);
            ctx.quadraticCurveTo(b * 6 + sway, -10, b * 7 + sway * 1.4, -18 - Math.abs(b) * 2);
            ctx.stroke();
          }
        } else if (kind < 0.58) {
          // 小花
          const sway = Math.sin(this.t * 1.2 + i * 2) * 1.6;
          ctx.strokeStyle = '#4FA34D';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(sway, -10, sway * 1.4, -22);
          ctx.stroke();
          const colors = ['#FFD45E', '#FF9FB4', '#FFFFFF', '#C7A6FF'];
          ctx.fillStyle = colors[(i % colors.length + colors.length) % colors.length];
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * TAU;
            ctx.beginPath();
            ctx.arc(sway * 1.4 + Math.cos(a) * 5, -24 + Math.sin(a) * 5, 4, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = '#FFC44D';
          ctx.beginPath();
          ctx.arc(sway * 1.4, -24, 3.2, 0, TAU);
          ctx.fill();
        } else if (kind < 0.74) {
          // 小石头
          ctx.fillStyle = '#B9C2CF';
          ctx.beginPath();
          ctx.ellipse(0, -4, 9, 6, 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = '#DDE4EE';
          ctx.beginPath();
          ctx.ellipse(-2, -6, 5, 3, 0, 0, TAU);
          ctx.fill();
        } else if (kind < 0.86) {
          // 蘑菇
          ctx.fillStyle = '#FFF3E2';
          ctx.fillRect(-3, -12, 6, 12);
          ctx.fillStyle = '#FF7C7C';
          ctx.beginPath();
          ctx.arc(0, -12, 11, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = '#FFF3E2';
          ctx.beginPath();
          ctx.arc(-4, -15, 2.2, 0, TAU);
          ctx.arc(4, -16, 1.8, 0, TAU);
          ctx.fill();
        } else {
          // 三叶草
          ctx.fillStyle = '#5CB95C';
          for (let p = 0; p < 3; p++) {
            const a = (p / 3) * TAU - Math.PI / 2;
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * 5, -8 + Math.sin(a) * 4, 5, 3.4, a, 0, TAU);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    /* ── 前景草（画在角色之上，制造纵深）── */
    drawForeground(ctx, V, cam) {
      const { w, h, groundY } = V;
      const par = 1.28;
      const cell = 44;
      const start = Math.floor((cam.x * par - 100) / cell);
      const end = Math.floor((cam.x * par + w + 100) / cell);

      ctx.save();
      ctx.globalAlpha = 0.92;
      for (let i = start; i <= end; i++) {
        const h1 = hash(i * 2.13);
        if (h1 > 0.72) continue;
        const wx = i * cell + hash(i * 6.7) * cell;
        const sx = wx - cam.x * par;
        const baseY = h + 18;
        const height = 60 + hash(i * 3.9) * 90;
        const sway = Math.sin(this.t * 1.1 + i * 0.7) * (5 + height * 0.05);
        const lean = (h1 - 0.36) * 40;

        ctx.beginPath();
        ctx.moveTo(sx - 12, baseY);
        ctx.quadraticCurveTo(sx + lean * 0.4 + sway, baseY - height * 0.55, sx + lean + sway * 1.5, baseY - height);
        ctx.quadraticCurveTo(sx + lean * 0.5 + sway + 6, baseY - height * 0.5, sx + 12, baseY);
        ctx.closePath();
        ctx.fillStyle = i % 3 === 0 ? '#3F8F52' : '#4AA05C';
        ctx.fill();
      }
      ctx.restore();

      // 底部一条深色压边
      const g = ctx.createLinearGradient(0, h - 26, 0, h);
      g.addColorStop(0, 'rgba(38, 92, 48, 0)');
      g.addColorStop(1, 'rgba(38, 92, 48, 0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(0, h - 26, w, 26);
    }

    draw(ctx, V, cam) {
      this.drawSky(ctx, V);
      this.drawClouds(ctx, V, cam);
      this.drawMountains(ctx, V, cam);
      this.drawHills(ctx, V, cam);
      this.drawGround(ctx, V, cam);
      this.drawProps(ctx, V, cam);
    }
  };
})(window.GR);
