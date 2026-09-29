// 演出用パーティクル・エフェクト
// Battle は描画に依存しないので、出来事を 'fx' イベント({ kind, ... })で通知するだけ。
// ここでそれを火花・煙・破片・光線などの見た目に変換する。
//
// 座標: ワールド系のパーティクルは x(ワールド座標) / laneY / h(地面からの高さ, 基準px)で持ち、
//       描画時に Renderer の変換を使う(画面サイズが変わってもずれない)。
//       画面系(紙吹雪・漂う粒子)は sx / sy(px)で持つ。

const MAX_PARTICLES = 500;
const FLY_H = 46; // 飛行ユニットの高さ(Renderer.flyOffset と同じ基準)

// ワールドごとの漂う粒子
const AMBIENT = {
  spores: { colors: ['#e7ffb0', '#ffc6f0', '#c9f7ff'], rate: 10, vy: [-14, -4], vx: [-6, 6], size: [1.5, 3.2], glow: true },
  sand: { colors: ['#f3c98b', '#d9a066', '#fff0c9'], rate: 22, vy: [-3, 3], vx: [-60, -25], size: [1, 2.2], glow: false },
  sparkle: { colors: ['#c9a7ff', '#8ff3ff', '#ffffff'], rate: 12, vy: [-6, 6], vx: [-4, 4], size: [1.2, 2.6], glow: true, twinkle: true },
  embers: { colors: ['#ff7b3a', '#ffb347', '#ff3d3d'], rate: 16, vy: [-40, -15], vx: [-10, 10], size: [1.2, 2.6], glow: true },
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Effects {
  /** @param {import('./Renderer.js').Renderer} renderer */
  constructor(renderer) {
    this.r = renderer;
    this.reset(null);
  }

  /** 戦闘開始時に呼ぶ */
  reset(theme) {
    this.parts = [];      // ワールド系パーティクル
    this.screen = [];     // 画面系パーティクル(漂う粒子・紙吹雪)
    this.beams = [];
    this.flashes = [];    // 画面全体のフラッシュ
    this.special = null;  // 必殺技ビーム
    this.ambient = theme ? AMBIENT[theme.ambient] ?? null : null;
    this.ambientAcc = 0;
    this.darken = 0;      // 敗北時の暗転(0〜1)
    this.darkenTarget = 0;
    // 開始時点で画面に粒子を散らしておく
    if (this.ambient && this.r.w) for (let i = 0; i < this.ambient.rate * 3; i++) this.spawnAmbient(true);
  }

  add(p) {
    if (this.parts.length >= MAX_PARTICLES) this.parts.shift();
    this.parts.push({ t: 0, rot: 0, vr: 0, g: 0, vx: 0, vh: 0, h: 0, laneY: 0, ...p });
  }

  // ---------- イベント → 見た目 ----------
  emit(ev) {
    const h0 = (ev.flying ? FLY_H : 0) + (ev.h ?? 14);
    switch (ev.kind) {
      case 'hit': this.onHit(ev, h0); break;
      case 'death': this.onDeath(ev, h0); break;
      case 'knockback':
        for (let i = 0; i < 6; i++) {
          this.add({ kind: 'smoke', x: ev.x, laneY: ev.laneY, h: 2, vx: -ev.dir * rand(10, 50), vh: rand(5, 25), life: rand(0.4, 0.7), size: rand(4, 7), color: '#c8b89a' });
        }
        break;
      case 'spawn': this.onSpawn(ev, h0); break;
      case 'shot':
        if (ev.style === 'shell') {
          // 砲口の光と煙
          this.add({ kind: 'flash', x: ev.x, laneY: ev.laneY, h: h0 + 6, life: 0.14, size: 16, color: '#ffd27a' });
          for (let i = 0; i < 4; i++) this.add({ kind: 'smoke', x: ev.x, laneY: ev.laneY, h: h0 + 6, vx: ev.dir * rand(10, 40), vh: rand(5, 20), life: rand(0.4, 0.7), size: rand(3, 6), color: '#9e9e9e' });
        }
        break;
      case 'beam':
        this.beams.push({ ...ev, t: 0, life: 0.18 });
        this.add({ kind: 'flash', x: ev.x1, laneY: ev.laneY, h: (ev.toFly ? FLY_H : 0) + 16, life: 0.16, size: 14, color: ev.color });
        break;
      case 'explosion': this.onExplosion(ev); break;
      case 'swing':
        this.add({ kind: ev.style === 'thrust' ? 'thrust' : 'swing', x: ev.x, laneY: ev.laneY, h: h0 + 4, dir: ev.dir, reach: ev.reach, life: 0.22, size: ev.size, color: ev.color ?? '#ffffff' });
        break;
      case 'healed':
        for (let i = 0; i < 5; i++) {
          this.add({ kind: 'dot', glow: true, x: ev.x + rand(-10, 10), laneY: ev.laneY, h: h0 + rand(-6, 10), vh: rand(20, 45), vx: rand(-4, 4), life: rand(0.6, 1), size: rand(1.5, 3), color: pick(['#7cff9a', '#c6ffd3', '#b9f6ca']) });
        }
        this.add({ kind: 'text', x: ev.x, laneY: ev.laneY, h: h0 + 20, vh: 22, life: 0.8, text: '+', size: 13, color: '#7cff9a' });
        break;
      case 'castleHit':
        for (let i = 0; i < 3; i++) this.add({ kind: 'debris', x: ev.x + rand(-10, 10), laneY: 0, h: rand(40, 110), vx: rand(10, 60), vh: rand(20, 80), g: 260, vr: rand(-8, 8), life: rand(0.5, 0.9), size: rand(2, 4), color: pick(['#5a1f24', '#2e1216', '#8b2e36']) });
        if (ev.dmg >= 25) this.damageText(ev.x - 10, 0, 90, ev.dmg);
        break;
      case 'castleDestroyed':
        this.castleX = ev.x;
        this.castleBoom = 1.6; // この秒数のあいだ連続爆発
        this.flash('#ffffff', 0.5, 0.35);
        break;
      case 'bossSpawn':
        this.flash('#000000', 0.55, 0.9);
        for (let i = 0; i < 14; i++) this.add({ kind: 'smoke', x: ev.x + rand(-40, 40), laneY: ev.laneY, h: 2, vx: rand(-40, 40), vh: rand(5, 30), life: rand(0.6, 1.1), size: rand(6, 11), color: '#6d5a5a' });
        break;
      case 'special':
        // 自陣から敵の城まで届く極太ビーム
        this.special = { x0: ev.x0, x1: ev.x1, t: 0, life: 1.1 };
        this.flash('#bff8ff', 0.6, 0.5);
        for (let i = 0; i < 60; i++) {
          const x = rand(ev.x0, ev.x1);
          this.add({ kind: 'spark', x, laneY: rand(-8, 8), h: rand(10, 60), vx: rand(20, 120), vh: rand(-60, 120), g: 120, life: rand(0.3, 0.8), size: rand(1.5, 3), color: pick(['#8ff3ff', '#ffffff', '#b388ff']) });
        }
        break;
      case 'end':
        if (ev.win) this.confetti();
        else this.darkenTarget = 0.6;
        break;
    }
  }

  onHit(ev, h0) {
    const color = ev.color ?? (ev.side === 'enemy' ? '#fff3b0' : '#ffb4b4');
    const n = ev.dmg >= 60 ? 9 : ev.dmg >= 25 ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(60, 150);
      this.add({ kind: 'spark', x: ev.x, laneY: ev.laneY, h: h0, vx: Math.cos(a) * sp * 0.5, vh: Math.sin(a) * sp, g: 200, life: rand(0.15, 0.3), size: rand(1.2, 2.2), color });
    }
    if (ev.slow) {
      // 氷の結晶が飛び散る
      for (let i = 0; i < 4; i++) this.add({ kind: 'shard', x: ev.x + rand(-8, 8), laneY: ev.laneY, h: h0 + rand(-8, 8), vx: rand(-25, 25), vh: rand(10, 40), g: 60, vr: rand(-6, 6), life: rand(0.4, 0.7), size: rand(2.5, 4), color: '#bfe9ff' });
    }
    // 味方の攻撃で大きなダメージのときだけ数字を出す(数が多いと見づらいため)
    if (ev.side === 'enemy' && ev.dmg >= 25) this.damageText(ev.x, ev.laneY, h0 + 18, ev.dmg);
  }

  damageText(x, laneY, h, dmg) {
    this.add({ kind: 'text', x: x + rand(-6, 6), laneY, h, vh: 38, g: 40, life: 0.7, text: String(Math.round(dmg)), size: dmg >= 80 ? 16 : 12, color: dmg >= 80 ? '#ffd84d' : '#ffffff' });
  }

  onDeath(ev, h0) {
    const big = ev.size >= 50;
    const n = big ? 22 : 9;
    for (let i = 0; i < n; i++) {
      this.add({ kind: 'smoke', x: ev.x + rand(-ev.size / 3, ev.size / 3), laneY: ev.laneY, h: h0 + rand(-6, 10), vx: rand(-25, 25), vh: rand(10, 45), life: rand(0.45, 0.8), size: rand(4, 8) * (big ? 1.6 : 1), color: ev.side === 'enemy' ? '#d9d2e9' : '#cfe8ff' });
    }
    if (ev.side === 'enemy') {
      for (let i = 0; i < 5; i++) this.add({ kind: 'dot', glow: true, x: ev.x, laneY: ev.laneY, h: h0, vx: rand(-40, 40), vh: rand(40, 110), g: 220, life: rand(0.4, 0.7), size: rand(1.5, 2.5), color: '#ffd84d' });
    }
    if (big) this.flash('#ffffff', 0.25, 0.25);
  }

  onSpawn(ev, h0) {
    if (ev.side === 'ally') {
      // 塔が光り、ワープの輪から出てくる
      this.add({ kind: 'ring', x: ev.x, laneY: ev.laneY, h: 2, life: 0.4, size: 22, color: '#8ff3ff' });
      this.add({ kind: 'flash', x: ev.baseX, laneY: 0, h: 70, life: 0.35, size: 34, color: '#9dffdf' });
      for (let i = 0; i < 8; i++) this.add({ kind: 'dot', glow: true, x: ev.x + rand(-10, 10), laneY: ev.laneY, h: rand(0, 30), vh: rand(30, 70), life: rand(0.35, 0.6), size: rand(1.2, 2.4), color: pick(['#8ff3ff', '#d6fffb', '#b388ff']) });
    } else {
      // 城の門から黒いもやと共に現れる
      this.add({ kind: 'ring', x: ev.x, laneY: ev.laneY, h: 2, life: 0.45, size: ev.boss ? 60 : 22, color: '#ff3d5a' });
      for (let i = 0; i < (ev.boss ? 16 : 6); i++) this.add({ kind: 'smoke', x: ev.x + rand(-12, 12), laneY: ev.laneY, h: h0 + rand(-10, 10), vx: rand(-30, 10), vh: rand(0, 25), life: rand(0.4, 0.7), size: rand(4, 8), color: '#3a1a28' });
    }
  }

  onExplosion(ev) {
    const big = ev.radius >= 80;
    this.add({ kind: 'flash', x: ev.x, laneY: 0, h: 14, life: 0.2, size: ev.radius * 0.9, color: '#ffcf6b' });
    this.add({ kind: 'ring', x: ev.x, laneY: 0, h: 2, life: 0.35, size: ev.radius * 1.1, color: '#ffe0a0' });
    const n = big ? 26 : 14;
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 0.1, Math.PI * 0.9);
      const sp = rand(60, big ? 240 : 170);
      this.add({ kind: 'debris', x: ev.x, laneY: rand(-6, 6), h: 10, vx: Math.cos(a) * sp * 0.6, vh: Math.sin(a) * sp, g: 320, vr: rand(-10, 10), life: rand(0.5, 0.9), size: rand(1.5, 3.5), color: pick(['#4e342e', '#6d4c41', '#ffb347', '#3e2723']) });
    }
    for (let i = 0; i < (big ? 10 : 5); i++) this.add({ kind: 'smoke', x: ev.x + rand(-15, 15), laneY: 0, h: rand(4, 20), vx: rand(-20, 20), vh: rand(15, 40), life: rand(0.6, 1.1), size: rand(6, 11), color: '#7a6a6a' });
  }

  flash(color, alpha, life) {
    this.flashes.push({ color, alpha, life, t: 0 });
  }

  confetti() {
    const { w } = this.r;
    const colors = ['#ffcf3f', '#ff6b6b', '#4fc3f7', '#7cff9a', '#b388ff', '#ffffff'];
    for (let i = 0; i < 120; i++) {
      this.screen.push({ kind: 'confetti', sx: rand(0, w), sy: rand(-120, -10), vx: rand(-30, 30), vy: rand(60, 140), rot: rand(0, 6), vr: rand(-8, 8), t: 0, life: rand(2.5, 4), size: rand(4, 8), color: pick(colors) });
    }
  }

  /** 弾の軌跡(魔法弾など)。Renderer から毎フレーム呼ばれる */
  trail(p, dt) {
    if (!p.magic || Math.random() > dt * 40) return;
    const fly = ((p.fromFly ? 1 - p.progress : 0) + (p.toFly ? p.progress : 0)) * FLY_H;
    this.add({ kind: 'dot', glow: true, x: p.x, laneY: p.laneY, h: 16 + fly + Math.sin(p.progress * Math.PI) * 24, vh: rand(-5, 5), life: 0.35, size: rand(1.5, 3), color: pick(['#b388ff', '#e1bee7', '#8ff3ff']) });
  }

  spawnAmbient(anywhere = false) {
    const a = this.ambient;
    const { w, h } = this.r;
    const vx = rand(...a.vx);
    this.screen.push({
      kind: 'ambient', glow: a.glow, twinkle: a.twinkle,
      sx: anywhere ? rand(0, w) : vx < -15 ? w + 5 : rand(0, w),
      sy: anywhere ? rand(0, h) : a.vy[1] < 0 ? h + 5 : rand(0, h),
      vx, vy: rand(...a.vy), t: 0, life: rand(4, 8), size: rand(...a.size), color: pick(a.colors), phase: rand(0, 6),
    });
  }

  // ---------- 更新 ----------
  update(dt) {
    if (!dt) return;
    for (const p of this.parts) {
      p.t += dt;
      p.x += p.vx * dt;
      p.h += p.vh * dt;
      p.vh -= p.g * dt;
      p.rot += p.vr * dt;
      if (p.h < 0 && p.g) { p.h = 0; p.vh *= -0.3; p.vx *= 0.6; }
    }
    this.parts = this.parts.filter((p) => p.t < p.life);

    for (const p of this.screen) {
      p.t += dt;
      p.sx += p.vx * dt;
      p.sy += p.vy * dt;
      p.rot = (p.rot ?? 0) + (p.vr ?? 0) * dt;
    }
    this.screen = this.screen.filter((p) => p.t < p.life);

    for (const b of this.beams) b.t += dt;
    this.beams = this.beams.filter((b) => b.t < b.life);
    if (this.special) {
      this.special.t += dt;
      if (this.special.t >= this.special.life) this.special = null;
    }
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.life);

    if (this.ambient) {
      this.ambientAcc += dt * this.ambient.rate;
      while (this.ambientAcc >= 1) { this.ambientAcc -= 1; this.spawnAmbient(); }
    }

    // 城の崩壊中は連続爆発
    if (this.castleBoom > 0) {
      this.castleBoom -= dt;
      if (Math.random() < dt * 9) {
        this.onExplosion({ x: this.castleX + rand(-40, 50), radius: rand(40, 80) });
        this.r.shake(5, 0.2);
      }
    }
    this.darken += (this.darkenTarget - this.darken) * Math.min(1, dt * 2);
  }

  // ---------- 描画 ----------
  pos(p) {
    const { r } = this;
    return [r.toScreenX(p.x), r.toScreenY(p.laneY) - p.h * r.k];
  }

  /** 背景の上・ユニットの下に描く(漂う粒子) */
  drawBack(ctx) {
    ctx.save();
    for (const p of this.screen) {
      if (p.kind !== 'ambient') continue;
      const fade = Math.min(1, p.t / 0.6, (p.life - p.t) / 0.8);
      const tw = p.twinkle ? 0.4 + 0.6 * Math.abs(Math.sin(p.t * 3 + p.phase)) : 1;
      ctx.globalAlpha = Math.max(0, fade * tw * 0.8);
      if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 6; } else ctx.shadowBlur = 0;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy + Math.sin(p.t * 2 + p.phase) * 3, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** ユニットの上に描く */
  drawFront(ctx) {
    const { k } = this.r;
    ctx.save();
    if (this.special) this.drawSpecial(ctx, this.special);
    for (const b of this.beams) this.drawBeam(ctx, b);
    for (const p of this.parts) {
      const [x, y] = this.pos(p);
      const prog = p.t / p.life;
      const alpha = 1 - prog;
      const s = p.size * k;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.globalCompositeOperation = p.kind === 'spark' || p.kind === 'flash' || p.glow ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.kind) {
        case 'spark': {
          ctx.lineWidth = s;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - p.vx * 0.04 * this.r.sx, y + p.vh * 0.04 * k);
          ctx.stroke();
          break;
        }
        case 'dot':
          ctx.beginPath();
          ctx.arc(x, y, s, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'smoke':
          ctx.globalAlpha = Math.max(0, alpha * 0.55);
          ctx.beginPath();
          ctx.arc(x, y, s * (1 + prog * 1.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'shard':
        case 'debris':
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.rot);
          if (p.kind === 'shard') {
            ctx.beginPath();
            ctx.moveTo(0, -s * 1.4); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s * 1.4); ctx.lineTo(-s * 0.6, 0);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.fillRect(-s / 2, -s / 2, s, s);
          }
          ctx.restore();
          break;
        case 'flash': {
          const g = ctx.createRadialGradient(x, y, 0, x, y, s);
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, s, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'ring':
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(x, y, s * (0.3 + prog), s * (0.3 + prog) * 0.3, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'swing': {
          // 武器を振った弧
          const r = (p.reach + 20) * this.r.sx;
          const start = p.dir > 0 ? -Math.PI * 0.75 : -Math.PI * 0.25;
          const sweep = Math.PI * 0.55 * (0.4 + prog * 0.6) * p.dir;
          ctx.lineWidth = 5 * k * (1 - prog * 0.6);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(x, y + r * 0.5, r, start, start + sweep, p.dir < 0);
          ctx.stroke();
          break;
        }
        case 'thrust': {
          // 槍の突き
          const len = (p.reach + 10) * this.r.sx;
          ctx.lineWidth = 3 * k;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + p.dir * len * (0.4 + prog * 0.6), y);
          ctx.stroke();
          break;
        }
        case 'text':
          ctx.globalCompositeOperation = 'source-over';
          ctx.font = `900 ${Math.round(p.size * Math.max(k, 0.8))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,.75)';
          ctx.strokeText(p.text, x, y);
          ctx.fillText(p.text, x, y);
          break;
      }
    }
    ctx.restore();
  }

  drawSpecial(ctx, s) {
    const { r } = this;
    const p = s.t / s.life;
    // 伸びる→太くなる→細くなって消える
    const reach = Math.min(1, p / 0.18);
    const width = (p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75) * 70 * r.k;
    const x0 = r.toScreenX(s.x0);
    const x1 = x0 + (r.toScreenX(s.x1) - x0) * reach;
    const y = r.groundY - 34 * r.k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y - width, 0, y + width);
    g.addColorStop(0, 'rgba(120,80,255,0)');
    g.addColorStop(0.35, 'rgba(120,230,255,.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.65, 'rgba(120,230,255,.9)');
    g.addColorStop(1, 'rgba(120,80,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y - width, x1 - x0, width * 2);
    // 先端の光
    const head = ctx.createRadialGradient(x1, y, 0, x1, y, width * 1.4 + 10);
    head.addColorStop(0, 'rgba(255,255,255,1)');
    head.addColorStop(1, 'rgba(120,230,255,0)');
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.arc(x1, y, width * 1.4 + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawBeam(ctx, b) {
    const { r } = this;
    const prog = b.t / b.life;
    const y0 = r.toScreenY(b.laneY) - ((b.fromFly ? FLY_H : 0) + 16) * r.k;
    const y1 = r.toScreenY(b.laneY) - ((b.toFly ? FLY_H : 0) + 16) * r.k;
    const x0 = r.toScreenX(b.x0);
    const x1 = r.toScreenX(b.x1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1 - prog;
    ctx.strokeStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 6 * r.k * (1 - prog);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * r.k * (1 - prog);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();
  }

  /** 画面全体に重ねる(フラッシュ・敗北時の暗転・紙吹雪) */
  drawOverlay(ctx) {
    const { w, h } = this.r;
    ctx.save();
    if (this.darken > 0.01) {
      ctx.fillStyle = `rgba(10,0,10,${this.darken})`;
      ctx.fillRect(0, 0, w, h);
    }
    for (const f of this.flashes) {
      ctx.globalAlpha = f.alpha * (1 - f.t / f.life);
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, w, h);
    }
    for (const p of this.screen) {
      if (p.kind !== 'confetti') continue;
      ctx.globalAlpha = Math.min(1, (p.life - p.t) / 0.6);
      ctx.save();
      ctx.translate(p.sx + Math.sin(p.t * 4) * 8, p.sy);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.abs(Math.cos(p.t * 5)));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    ctx.restore();
  }
}
