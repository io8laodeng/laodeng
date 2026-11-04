/* character.js — 粉色 puffball（卡比风格）
   ────────────────────────────────────────────────────────────
   一颗圆滚滚的粉色球，两只大眼睛，一双大红鞋。
   结构：身体球 + 两只脚 + 两只小短手。
   脚和手都用弹簧跟随目标位置，落地/起跳给身体一记冲量，
   所以跑起来是「一颠一颠」的软弹感。                      */
(function (GR) {
  'use strict';
  const TAU = Math.PI * 2;
  const { clamp, lerp, damp, rand, Spring } = GR;

  const INK = '#3A2735';
  const PINK = '#FFB3D4';
  const PINK_LIGHT = '#FFD8E9';
  const PINK_DEEP = '#F58CB8';
  const RED = '#E8442D';
  const RED_DEEP = '#C93420';
  const EYE = '#181021';

  const R = 68;                 // 身体半径
  const FOOT_W = 56;
  const FOOT_H = 36;
  const ARM_LEN = 30;

  function ellipsePath(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  }

  GR.Character = class Character {
    constructor() { this.reset(); }

    reset() {
      this.t = 0;
      this.phase = rand(0, TAU);
      this.air = 0;
      this.slideAmt = 0;
      this.blinkTimer = rand(2, 5);
      this.blinkAnim = 0;

      this.squash = new Spring(1, 210, 15);
      this.tilt = new Spring(0, 130, 12);
      this.armSwing = new Spring(0, 110, 11);

      this.foot = [
        { x: 0, y: 0, px: 0, py: 0 },
        { x: 0, y: 0, px: 0, py: 0 }
      ];
      this.init = false;
      this.rig = null;
    }

    impulse(strength) {
      this.squash.kick(strength * 3.4);
      this.tilt.kick(strength * 2.2);
    }

    /* p: { x, y, vy, speed, onGround, sliding, lean, groundY, mood } */
    update(dt, p) {
      this.t += dt;

      const stepRate = clamp(p.speed / 150, 1.8, 4.6);
      if (p.onGround && !p.sliding) this.phase += stepRate * TAU * dt;

      this.air = damp(this.air, p.onGround ? 0 : 1, 14, dt);
      this.slideAmt = damp(this.slideAmt, p.sliding ? 1 : 0, 20, dt);

      // 身体：跑动时上下颠，滑铲时压扁，起跳拉长
      this.squash.target = 1 - 0.25 * this.slideAmt;
      this.tilt.target = p.lean * 0.66;
      this.armSwing.target = Math.cos(this.phase + Math.PI) * 0.55;

      this.squash.step(dt);
      this.tilt.step(dt);
      this.armSwing.step(dt);

      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkTimer = rand(2.2, 5.5);
        this.blinkAnim = 0.16;
      }
      this.blinkAnim = Math.max(0, this.blinkAnim - dt);

      this.buildRig(dt, p);
    }

    buildRig(dt, p) {
      const lean = p.lean;
      const cosL = Math.cos(lean);
      const sinL = Math.sin(lean);

      const sy = clamp(this.squash.value, 0.45, 1.35);
      const sx = 1 / sy;

      // 身体球心：站立时跟着髋部，滑铲时贴地
      const standX = p.x;
      const standY = p.y - 20;
      const flatY = p.groundY - R * sy - 8;
      const bc = {
        x: standX,
        y: lerp(standY, flatY, this.slideAmt)
      };

      // 跑步时的上下颠
      const bob = p.onGround && !p.sliding ? Math.sin(this.phase * 2) * 4 : 0;
      bc.y += bob;

      const ph = this.phase;
      const stride = 8 + Math.min(p.speed, 620) * 0.022;
      const lift = 22;
      const footY = p.groundY - FOOT_H / 2 - 2;

      const runFeet = [
        { x: p.x + 30 + Math.cos(ph) * stride, y: footY - Math.max(0, Math.sin(ph)) * lift },
        { x: p.x - 30 - Math.cos(ph) * stride, y: footY - Math.max(0, Math.sin(ph + Math.PI)) * lift }
      ];
      const airFeet = [
        { x: p.x + 40, y: p.y + 54 },
        { x: p.x - 30, y: p.y + 62 }
      ];
      const slideFeet = [
        { x: p.x + 58, y: p.groundY - FOOT_H / 2 - 2 },
        { x: p.x + 30, y: p.groundY - FOOT_H / 2 - 2 }
      ];

      if (!this.init) {
        for (let i = 0; i < 2; i++) {
          this.foot[i].x = runFeet[i].x;
          this.foot[i].y = runFeet[i].y;
          this.foot[i].px = this.foot[i].x;
          this.foot[i].py = this.foot[i].y;
        }
        this.init = true;
      }

      const feet = [0, 1].map((i) => {
        let tx = lerp(runFeet[i].x, airFeet[i].x, this.air);
        let ty = lerp(runFeet[i].y, airFeet[i].y, this.air);
        tx = lerp(tx, slideFeet[i].x, this.slideAmt);
        ty = lerp(ty, slideFeet[i].y, this.slideAmt);

        const f = this.foot[i];
        f.px = f.x;
        f.py = f.y;
        f.x = damp(f.x, tx, 30, dt);
        f.y = damp(f.y, ty, 34, dt);

        const vx = (f.x - f.px) * 5;
        const vy = (f.y - f.py) * 5;
        return {
          x: f.x,
          y: f.y,
          rot: clamp(vx * 0.004 + (this.air * -0.25), -0.4, 0.4) + (i === 0 ? 0.12 : -0.12),
          lift: clamp((footY - f.y) / 30, 0, 1)
        };
      });

      // 小短手：从身体两侧伸出来，跟着步态前后摆
      const swing = this.armSwing.value;
      const arms = [0, 1].map((i) => {
        const s = i === 0 ? 1 : -1;
        const ax = bc.x + s * (R - 12);
        const ay = bc.y + 16;
        const angle = Math.PI / 2 + swing * s * 0.9 + this.air * (i === 0 ? -1.1 : 0.9);
        return {
          x: ax,
          y: ay,
          hx: ax + Math.cos(angle) * ARM_LEN * s * (s > 0 ? 1 : -1),
          hy: ay + Math.sin(angle) * ARM_LEN
        };
      });

      this.rig = {
        bc, lean, sx, sy, feet, arms, phase: this.phase,
        mood: p.mood || 'run',
        open: this.blinkAnim > 0
          ? Math.abs(Math.cos((this.blinkAnim / 0.16) * Math.PI))
          : 1
      };
    }

    draw(ctx, p) {
      const Rg = this.rig;
      if (!Rg) return;

      // 卡比的脚永远在身体前面，手臂从两侧伸出来
      this.drawBody(ctx, Rg);
      this.drawArms(ctx, Rg);
      this.drawFoot(ctx, Rg, 1, true);      // 后面那只脚
      this.drawFoot(ctx, Rg, 0, false);     // 前面那只脚
    }

    drawArms(ctx, Rg) {
      const { bc, sy } = Rg;
      for (const a of Rg.arms) {
        const dx = a.hx - a.x;
        const dy = a.hy - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const w = 17;

        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.hx, a.hy);
        ctx.lineWidth = w + 10;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.lineWidth = w;
        ctx.strokeStyle = PINK_DEEP;
        ctx.stroke();

        // 手尖的小圆
        ellipsePath(ctx, a.hx, a.hy, w / 2 + 4, w / 2 + 4, 0);
        ctx.fillStyle = PINK_DEEP;
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
    }

    drawFoot(ctx, Rg, i, back) {
      const f = Rg.feet[i];
      const rx = FOOT_W / 2;
      const ry = FOOT_H / 2;

      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);

      // 阴影
      ellipsePath(ctx, 0, ry * 0.7, rx * 0.95, ry * 0.42, 0);
      ctx.fillStyle = 'rgba(70, 30, 50, 0.16)';
      ctx.fill();

      // 鞋
      ellipsePath(ctx, 0, 0, rx, ry, 0);
      ctx.fillStyle = back ? RED_DEEP : RED;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = INK;
      ctx.stroke();

      // 高光
      ellipsePath(ctx, -rx * 0.26, -ry * 0.34, rx * 0.34, ry * 0.24, -0.2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();

      // 鞋底
      ctx.beginPath();
      ctx.ellipse(0, ry * 0.55, rx * 0.72, ry * 0.22, 0, 0, Math.PI);
      ctx.fillStyle = 'rgba(60,20,30,0.22)';
      ctx.fill();

      ctx.restore();
    }

    drawBody(ctx, Rg) {
      const { bc, lean, sx, sy } = Rg;

      ctx.save();
      ctx.translate(bc.x, bc.y);
      ctx.rotate(lean);
      ctx.scale(sx, sy);

      // 球体
      ellipsePath(ctx, 0, 0, R, R, 0);
      const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.15);
      g.addColorStop(0, PINK_LIGHT);
      g.addColorStop(0.45, PINK);
      g.addColorStop(1, PINK_DEEP);
      ctx.fillStyle = g;
      ctx.fill();

      // 底部阴影
      ctx.save();
      ellipsePath(ctx, 0, 0, R, R, 0);
      ctx.clip();
      ellipsePath(ctx, 0, R * 0.62, R * 0.95, R * 0.5, 0);
      ctx.fillStyle = 'rgba(190, 80, 130, 0.28)';
      ctx.fill();
      ctx.restore();

      // 高光
      ellipsePath(ctx, -R * 0.38, -R * 0.45, R * 0.22, R * 0.15, -0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();

      // 轮廓
      ellipsePath(ctx, 0, 0, R, R, 0);
      ctx.lineWidth = 5.5;
      ctx.strokeStyle = INK;
      ctx.stroke();

      ctx.restore();

      // 五官单独变换：身体压扁时眼睛不要跟着拉成横条
      ctx.save();
      ctx.translate(bc.x, bc.y);
      ctx.rotate(lean);
      ctx.scale(1, clamp(sy, 0.82, 1.1));
      this.drawFace(ctx, Rg);
      ctx.restore();
    }

    drawFace(ctx, Rg) {
      const mood = Rg.mood;
      const open = Rg.open;
      const squint = mood === 'hurt';
      const eyeX = 27;
      const eyeY = -8;

      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * eyeX, eyeY);

        if (squint) {
          ctx.beginPath();
          ctx.lineWidth = 5.5;
          ctx.strokeStyle = EYE;
          ctx.lineCap = 'round';
          ctx.moveTo(-10 * s, -8);
          ctx.lineTo(7 * s, 0);
          ctx.lineTo(-10 * s, 8);
          ctx.stroke();
        } else {
          ctx.scale(1, clamp(open, 0.12, 1));

          // 眼白（一点点）
          ellipsePath(ctx, 0, 0, 19, 27, 0);
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();

          // 瞳孔
          ellipsePath(ctx, 0, 1, 15.5, 23, 0);
          const eg = ctx.createLinearGradient(0, -22, 0, 22);
          eg.addColorStop(0, '#2A2038');
          eg.addColorStop(1, '#0E0A14');
          ctx.fillStyle = eg;
          ctx.fill();

          // 高光
          ellipsePath(ctx, -5, -11, 5.6, 7.4, -0.3);
          ctx.fillStyle = 'rgba(255,255,255,0.96)';
          ctx.fill();
          ellipsePath(ctx, 5, 10, 3.4, 4.2, 0);
          ctx.fillStyle = 'rgba(150, 200, 255, 0.75)';
          ctx.fill();
        }
        ctx.restore();
      }

      // 腮红
      for (const s of [-1, 1]) {
        ellipsePath(ctx, s * 45, 22, 12, 8, 0);
        ctx.fillStyle = 'rgba(255, 90, 140, 0.35)';
        ctx.fill();
      }

      // 嘴
      ctx.save();
      ctx.translate(0, 30);
      ctx.strokeStyle = EYE;
      ctx.fillStyle = '#B3244A';
      ctx.lineWidth = 4.4;
      ctx.lineCap = 'round';

      if (mood === 'jump' || mood === 'fall') {
        // 张嘴「哦」
        ellipsePath(ctx, 0, 2, 8, 10, 0);
        ctx.fillStyle = '#7A1230';
        ctx.fill();
        ellipsePath(ctx, 0, 7, 4.6, 4, 0);
        ctx.fillStyle = '#FF6F8E';
        ctx.fill();
      } else if (mood === 'slide') {
        ctx.beginPath();
        ctx.moveTo(-13, 0);
        ctx.quadraticCurveTo(0, 10, 13, 0);
        ctx.stroke();
      } else {
        // 招牌微笑
        ctx.beginPath();
        ctx.moveTo(-11, -2);
        ctx.quadraticCurveTo(0, 11, 11, -2);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawRig(ctx) {
      const Rg = this.rig;
      if (!Rg) return;
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 64, 96, 0.9)';
      ctx.fillStyle = 'rgba(64, 220, 255, 0.95)';
      const dot = (x, y, r) => {
        ctx.beginPath();
        ctx.arc(x, y, r || 4, 0, TAU);
        ctx.fill();
      };
      dot(Rg.bc.x, Rg.bc.y, 6);
      for (const f of Rg.feet) {
        ctx.beginPath();
        ctx.moveTo(Rg.bc.x, Rg.bc.y);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();
        dot(f.x, f.y, 4.5);
      }
      for (const a of Rg.arms) {
        ctx.beginPath();
        ctx.moveTo(Rg.bc.x, Rg.bc.y);
        ctx.lineTo(a.x, a.y);
        ctx.lineTo(a.hx, a.hy);
        ctx.stroke();
        dot(a.x, a.y, 4);
        dot(a.hx, a.hy, 4);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = '600 12px ui-monospace, monospace';
      ctx.fillText('squash ' + this.squash.value.toFixed(2) + '  tilt ' + this.tilt.value.toFixed(2), Rg.bc.x + 74, Rg.bc.y - 64);
      ctx.restore();
    }
  };
})(window.GR);
