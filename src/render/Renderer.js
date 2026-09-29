// 戦闘画面の Canvas 描画(背景・拠点・ユニット・エフェクト)
import { WORLD } from '../config/constants.js';
import { drawUnit } from './sprites.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
    this.sx = this.w / WORLD.length;              // 位置のスケール
    this.k = Math.min(this.h / WORLD.refHeight, this.sx * 1.4); // サイズのスケール
    this.groundY = this.h * 0.8;
  }

  toScreenX(x) { return x * this.sx; }
  toScreenY(laneY) { return this.groundY + laneY * this.k; }

  render(battle) {
    if (!this.w) this.resize();
    const { ctx } = this;
    const theme = battle.stage.theme;

    this.drawBackground(theme);
    this.drawGate();
    this.drawBase(battle);

    // 奥(laneY小)→手前の順に描画
    const units = [...battle.units].sort((a, b) => a.laneY - b.laneY);
    for (const u of units) {
      const x = this.toScreenX(u.x);
      const y = this.toScreenY(u.laneY);
      this.drawShadow(x, y, u.def.size * this.k);
      drawUnit(ctx, u, x, y, this.k);
    }
    for (const u of units) if (u.alive && u.hp < u.maxHp) this.drawHpBar(u);

    for (const p of battle.projectiles) this.drawProjectile(p);
    for (const e of battle.effects) this.drawEffect(e);
    for (const p of battle.popups) this.drawPopup(p);
  }

  drawBackground(theme) {
    const { ctx, w, h, groundY } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, theme.sky[0]);
    sky.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, groundY);

    // 遠景の丘
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    ctx.beginPath();
    ctx.moveTo(0, groundY - 20 * this.k);
    for (let x = 0; x <= w; x += 40) {
      ctx.lineTo(x, groundY - (26 + Math.sin(x * 0.012) * 18) * this.k);
    }
    ctx.lineTo(w, groundY);
    ctx.lineTo(0, groundY);
    ctx.fill();

    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, groundY - 14 * this.k, w, h - groundY + 14 * this.k);
    ctx.fillStyle = theme.groundDark;
    ctx.fillRect(0, groundY + 16 * this.k, w, h);
  }

  drawBase(battle) {
    const { ctx, k, groundY } = this;
    const x1 = this.toScreenX(WORLD.allyBaseX);
    const hgt = 120 * k;
    // 城壁
    ctx.fillStyle = '#5d6d94';
    ctx.fillRect(0, groundY - hgt, x1, hgt + 16 * k);
    ctx.fillStyle = '#7b8bb5';
    const merlon = x1 / 3;
    for (let i = 0; i < 3; i += 2) ctx.fillRect(i * merlon, groundY - hgt - 12 * k, merlon, 12 * k);
    // 旗
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1 * 0.5, groundY - hgt - 12 * k);
    ctx.lineTo(x1 * 0.5, groundY - hgt - 44 * k);
    ctx.stroke();
    ctx.fillStyle = '#4fc3f7';
    ctx.fillRect(x1 * 0.5, groundY - hgt - 44 * k, 20 * k, 13 * k);

    // ライフ残量で城に赤み
    const danger = 1 - battle.life / battle.maxLife;
    if (danger > 0) {
      ctx.fillStyle = `rgba(255,60,60,${danger * 0.35})`;
      ctx.fillRect(0, groundY - hgt, x1, hgt);
    }
  }

  drawGate() {
    const { ctx, k, groundY } = this;
    const x0 = this.toScreenX(WORLD.enemyGateX);
    const hgt = 90 * k;
    ctx.fillStyle = '#3b2a3f';
    ctx.fillRect(x0, groundY - hgt, this.w - x0, hgt + 16 * k);
    ctx.fillStyle = '#12091a';
    ctx.beginPath();
    ctx.ellipse(x0 + (this.w - x0) / 2, groundY - hgt * 0.35, (this.w - x0) * 0.35, hgt * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawShadow(x, y, size) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0,0,0,.2)';
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.45, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHpBar(u) {
    const { ctx, k } = this;
    const w = Math.max(18, u.def.size * k);
    const x = this.toScreenX(u.x) - w / 2;
    const y = this.toScreenY(u.laneY) - u.def.size * k - 8 * k;
    const ratio = u.hp / u.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = u.side === 'ally' ? '#4ade80' : '#f87171';
    ctx.fillRect(x, y, w * ratio, 4);
  }

  drawProjectile(p) {
    const { ctx, k } = this;
    const arc = Math.sin(p.progress * Math.PI) * (p.heavy ? 60 : 24) * k;
    const x = this.toScreenX(p.x);
    const y = this.toScreenY(p.laneY) - 16 * k - arc;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (p.heavy) {
      ctx.arc(x, y, 6 * k, 0, Math.PI * 2);
    } else {
      ctx.ellipse(x, y, 7 * k, 2 * k, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }

  drawEffect(e) {
    const { ctx, k } = this;
    const p = e.t / e.life;
    const x = this.toScreenX(e.x);
    ctx.save();
    ctx.globalAlpha = 1 - p;
    switch (e.type) {
      case 'explosion': {
        const r = e.radius * this.sx * (0.4 + p * 0.8);
        ctx.fillStyle = '#ffb347';
        ctx.beginPath();
        ctx.arc(x, this.groundY - r * 0.4, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'area': {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, this.toScreenY(e.laneY) - 16 * k, (12 + p * 24) * k, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'breach': {
        ctx.fillStyle = 'rgba(255,60,60,.5)';
        ctx.fillRect(0, 0, x + 30 * k, this.h);
        break;
      }
      default: { // slash / hit
        ctx.strokeStyle = e.side === 'ally' ? '#fff' : '#ffd0d0';
        ctx.lineWidth = 2.5;
        const y = this.toScreenY(e.laneY) - 14 * k;
        const s = 10 * k * (0.6 + p);
        ctx.beginPath();
        ctx.moveTo(x - s, y - s);
        ctx.lineTo(x + s, y + s);
        ctx.moveTo(x + s, y - s);
        ctx.lineTo(x - s, y + s);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawPopup(p) {
    const { ctx, k } = this;
    const prog = p.t / p.life;
    ctx.save();
    ctx.globalAlpha = 1 - prog * prog;
    ctx.font = `900 ${Math.round(16 * Math.max(k, 0.8))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.fillStyle = p.color;
    const x = Math.max(20, this.toScreenX(p.x));
    const y = this.groundY - 50 * k - prog * p.rise * k;
    ctx.strokeText(p.text, x, y);
    ctx.fillText(p.text, x, y);
    ctx.restore();
  }
}
