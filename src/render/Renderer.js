// 戦闘画面の Canvas 描画(背景・拠点・ユニット・エフェクト)
import { WORLD } from '../config/constants.js';

// 城の画像(読み込めない場合は図形で描く)
const ALLY_BASE_IMG = 'assets/castle/ally.png';
const ENEMY_CASTLE_IMG = 'assets/castle/enemy.png';
import { drawUnit, visualHeight, getImage } from './sprites.js';
import { Effects } from './effects.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
    this.shakeTime = 0;
    this.shakePower = 0;
    this.fx = new Effects(this);
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

  /** 画面を揺らす(power: 最大ずれ幅px, duration: 秒) */
  shake(power, duration) {
    if (power >= this.shakePower || this.shakeTime <= 0) this.shakePower = power;
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  toScreenX(x) { return x * this.sx; }
  toScreenY(laneY) { return this.groundY + laneY * this.k; }
  /** 飛行ユニットの浮き上がり量(px) */
  flyOffset(u) { return u.def?.flying ? (46 + Math.sin(u.animTime * 3) * 5) * this.k : 0; }

  render(battle, dt = 0) {
    if (!this.w) this.resize();
    const { ctx } = this;
    const theme = battle.stage.theme;

    // 画面揺れ
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    ctx.save();
    if (this.shakeTime > 0) {
      const p = this.shakePower * Math.min(1, this.shakeTime * 3);
      ctx.translate((Math.random() - 0.5) * 2 * p, (Math.random() - 0.5) * 2 * p);
    }

    this.fx.update(dt);

    this.drawBackground(theme);
    this.fx.drawBack(ctx);
    this.drawCastle(battle.castle);
    this.drawBase(battle);

    // 奥(laneY小)→手前の順に描画
    const units = [...battle.units].sort((a, b) => a.laneY - b.laneY);
    for (const u of units) {
      const x = this.toScreenX(u.x);
      const y = this.toScreenY(u.laneY);
      this.drawShadow(x, y, u.def.size * this.k * (u.flying ? 0.6 : 1));
      drawUnit(ctx, u, x, y - this.flyOffset(u), this.k);
    }
    for (const u of units) if (u.alive && u.hp < u.maxHp) this.drawHpBar(u);

    for (const p of battle.projectiles) {
      this.fx.trail(p, dt);
      this.drawProjectile(p);
    }
    for (const e of battle.effects) this.drawEffect(e);
    this.fx.drawFront(ctx);
    for (const p of battle.popups) this.drawPopup(p);
    ctx.restore();

    this.drawBossOverlay(battle);
    this.fx.drawOverlay(ctx);
    this.drawTopBars(battle);
  }

  drawBackground(theme) {
    const { ctx, w, h, groundY } = this;
    const bg = getImage(theme.bg);
    if (bg) {
      // 画面を覆うように拡大し、下端(地面側)を合わせる
      const scale = Math.max(w / bg.naturalWidth, h / bg.naturalHeight);
      const dw = bg.naturalWidth * scale;
      const dh = bg.naturalHeight * scale;
      ctx.drawImage(bg, (w - dw) / 2, h - dh, dw, dh);
      return;
    }
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
    const img = getImage(ALLY_BASE_IMG);
    if (img) {
      // 味方はこの塔から出撃する。左端に一部はみ出させて置く
      const h = 150 * k;
      const w = (img.naturalWidth / img.naturalHeight) * h;
      ctx.drawImage(img, x1 * 0.7 - w * 0.5, groundY + 12 * k - h, w, h);
      return;
    }
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

  drawCastle(castle) {
    const { ctx, k, groundY } = this;
    const x0 = this.toScreenX(castle.x - castle.half);
    const ratio = castle.hp / castle.maxHp;
    const img = getImage(ENEMY_CASTLE_IMG);
    if (img) {
      this.drawCastleImage(img, castle, x0, ratio);
      return;
    }
    const w = this.w - x0 + 20;
    // 壊れるほど低くなる
    const hgt = (castle.alive ? 70 + 60 * ratio : 30) * k;
    const top = groundY - hgt;

    ctx.fillStyle = castle.hitFlash > 0 ? '#8a6a8f' : '#3b2a3f';
    ctx.fillRect(x0, top, w, hgt + 16 * k);
    // 胸壁
    ctx.fillStyle = '#4e3a55';
    const m = w / 5;
    for (let i = 0; i < 5; i += 2) ctx.fillRect(x0 + i * m, top - 10 * k, m, 10 * k);
    // 門
    ctx.fillStyle = '#12091a';
    ctx.beginPath();
    ctx.ellipse(x0 + w * 0.42, groundY - 18 * k, w * 0.26, 26 * k, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x0 + w * 0.16, groundY - 18 * k, w * 0.52, 18 * k + 16 * k);
    // 旗
    if (castle.alive) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.4, top - 10 * k);
      ctx.lineTo(x0 + w * 0.4, top - 40 * k);
      ctx.stroke();
      ctx.fillStyle = '#e53935';
      ctx.fillRect(x0 + w * 0.4 - 18 * k, top - 40 * k, 18 * k, 12 * k);
    }
    // ヒビ
    if (ratio < 0.66) {
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.2, top + 8 * k);
      ctx.lineTo(x0 + w * 0.3, top + 30 * k);
      ctx.lineTo(x0 + w * 0.22, top + 50 * k);
      if (ratio < 0.33) {
        ctx.moveTo(x0 + w * 0.7, top + 4 * k);
        ctx.lineTo(x0 + w * 0.6, top + 26 * k);
        ctx.lineTo(x0 + w * 0.72, top + 44 * k);
      }
      ctx.stroke();
    }
  }

  /** 敵の城(画像版)。HPが減るほど沈み、ヒビが入る。攻撃を受けると揺れる */
  drawCastleImage(img, castle, frontX, ratio) {
    const { ctx, k, groundY } = this;
    const h = (castle.alive ? 0.8 + 0.2 * ratio : 0.8) * 160 * k;
    const w = (img.naturalWidth / img.naturalHeight) * h;
    const shake = castle.hitFlash > 0 ? (Math.random() - 0.5) * 5 : 0;
    const x = Math.min(frontX - w * 0.1, this.w - w * 0.8) + shake;
    const ground = groundY + 12 * k;
    const sink = castle.alive ? 0 : Math.min(1, castle.deadTime / 1.4);
    const top = ground - h + sink * h * 0.7 + (castle.alive ? 0 : (Math.random() - 0.5) * 4 * (1 - sink));
    ctx.save();
    if (!castle.alive) {
      ctx.globalAlpha = 1 - sink * 0.6;
      ctx.beginPath();
      ctx.rect(x - 20, 0, w + 40, ground); // 地面より下は描かない(沈んでいく)
      ctx.clip();
    }
    ctx.drawImage(img, x, top, w, h);
    ctx.restore();
    if (ratio < 0.66 && castle.alive) {
      ctx.strokeStyle = 'rgba(20,0,0,.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, top + h * 0.3);
      ctx.lineTo(x + w * 0.4, top + h * 0.45);
      ctx.lineTo(x + w * 0.33, top + h * 0.6);
      if (ratio < 0.33) {
        ctx.moveTo(x + w * 0.68, top + h * 0.28);
        ctx.lineTo(x + w * 0.58, top + h * 0.42);
        ctx.lineTo(x + w * 0.7, top + h * 0.56);
      }
      ctx.stroke();
    }
  }

  /** ボス警告中・ボス存在中の赤い点滅 */
  drawBossOverlay(battle) {
    const { ctx, w, h } = this;
    let a = 0;
    if (battle.bossWarning > 0) a = 0.25 + 0.2 * Math.sin(battle.bossWarning * 14);
    else if (battle.boss) a = 0.08 + 0.05 * Math.sin(battle.time * 4);
    if (a <= 0) return;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, `rgba(255,0,0,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /** 画面上部の 敵城HP / ボスHP バー */
  drawTopBars(battle) {
    const castle = battle.castle;
    const barW = Math.min(220, this.w * 0.3);
    this.drawBar(this.w - barW - 10, 8, barW, '敵の城', castle.hp, castle.maxHp, '#e57373');
    const boss = battle.boss;
    if (boss) {
      const bw = Math.min(360, this.w * 0.42);
      this.drawBar(Math.max(60, this.w * 0.62 - 20 - bw), 8, bw, boss.def.name, boss.hp, boss.maxHp, '#ff3d3d');
    }
  }

  drawBar(x, y, w, label, hp, max, color) {
    const { ctx } = this;
    const h = 10;
    ctx.save();
    ctx.font = '700 11px sans-serif';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.fillStyle = '#fff';
    const text = `${label}  ${Math.ceil(hp)} / ${max}`;
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x, y + 15, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y + 15, w * Math.max(0, hp / max), h);
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 15.5, w - 1, h - 1);
    ctx.restore();
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
    const y = this.toScreenY(u.laneY) - this.flyOffset(u) - visualHeight(u.def) * k - 6 * k;
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
    const pr = p.progress;
    const fly = ((p.fromFly ? 1 - pr : 0) + (p.toFly ? pr : 0)) * 46 * k;
    const y = this.toScreenY(p.laneY) - 16 * k - arc - fly;
    ctx.fillStyle = p.color;
    if (p.magic) {
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, 5 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
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
      case 'heal': {
        ctx.strokeStyle = '#7cff9a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, this.groundY, e.radius * this.sx * (0.3 + p * 0.7), 10 * k, 0, 0, Math.PI * 2);
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
