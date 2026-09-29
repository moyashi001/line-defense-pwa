// キャラクター描画モジュール
// 画像差し替え手順:
//   1. assets/sprites/ に PNG を置く(右向き・足元が画像の下端になる絵を推奨)
//   2. src/config/units.js の該当キャラに sprite: 'assets/sprites/xxx.png' を設定
// 画像が読み込めない/未設定の場合は自動でプレースホルダー図形を描画する。

const images = new Map(); // def.id -> HTMLImageElement
const backgrounds = new Map(); // src -> HTMLImageElement

/** 背景などの画像を読み込み(キャッシュ)。読み込み済みなら画像、まだなら null */
export function getImage(src) {
  if (!src) return null;
  let img = backgrounds.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    backgrounds.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function preloadSprites(defs) {
  for (const def of defs) {
    if (!def.sprite || images.has(def.id)) continue;
    const img = new Image();
    img.src = def.sprite;
    images.set(def.id, img);
  }
}

function spriteFor(def) {
  const img = images.get(def.id);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

// 被弾時などに使う「色を塗った画像」のキャッシュ(画像の形だけを色で塗りつぶしたもの)
const tintCache = new Map();
function tinted(img, color) {
  const key = img.src + color;
  let c = tintCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    tintCache.set(key, c);
  }
  return c;
}

export const DEATH_TIME = 0.9; // やられ演出の長さ(Unit.die と合わせる)

/** 見た目の高さ(ワールド単位)。HPバーの位置合わせ用 */
export function visualHeight(def) {
  if (!spriteFor(def)) return def.size;
  return def.drawHeight ?? def.size * (def.spriteScale ?? 1.6);
}

/**
 * ユニットを1体描画する
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../game/Unit.js').Unit} unit
 * @param {number} x 画面上の中心x
 * @param {number} y 画面上の足元y
 * @param {number} scale ワールド→画面のサイズ倍率
 */
export function drawUnit(ctx, unit, x, y, scale) {
  const def = unit.def;
  const s = def.size * scale;
  const dir = unit.dir;
  const t = unit.animTime;

  ctx.save();
  ctx.translate(x, y);

  // ---- やられ演出 ----
  if (unit.dead) {
    const dt = 1 - Math.max(0, unit.removeTimer) / (unit.deathStyle === 'fade' ? 0.3 : DEATH_TIME);
    if (unit.deathStyle === 'fade') {
      ctx.globalAlpha = 1 - dt;
      ctx.translate(0, -dt * s * 0.6);
    } else {
      // 回転しながら奥へ吹っ飛んで小さくなる
      const big = def.boss ? 0.35 : 1;
      ctx.translate(-dir * 110 * scale * dt * big, -(160 * dt - 60 * dt * dt) * scale * big);
      ctx.rotate(-dir * dt * 9 * big);
      const sc = 1 - 0.75 * dt;
      ctx.scale(sc, sc);
      ctx.globalAlpha = dt < 0.75 ? 1 : 1 - (dt - 0.75) / 0.25;
    }
  } else {
    // ---- 生きているときの動き ----
    if (unit.state === 'walk') {
      // 前傾して、跳ねるように歩く
      const step = Math.sin(t * 10);
      ctx.translate(0, -Math.abs(step) * s * 0.08);
      ctx.rotate(dir * (0.06 + step * 0.04));
    } else if (unit.state === 'knockback') {
      ctx.rotate(-dir * 0.25);
    } else {
      // 待機・攻撃待ち: 呼吸するように伸び縮み
      const br = Math.sin(t * 3) * 0.03;
      ctx.scale(1 - br, 1 + br);
    }
    if (unit.state === 'attack' && unit.cooldown > 0 && unit.cooldown < 0.2 && unit.attackAnim <= 0) {
      // 攻撃直前: 後ろにためる
      const w = 1 - unit.cooldown / 0.2;
      ctx.translate(-dir * s * 0.15 * w, 0);
      ctx.rotate(-dir * 0.12 * w);
      ctx.scale(1 + 0.08 * w, 1 - 0.08 * w);
    }
    if (unit.attackAnim > 0) {
      // 攻撃: 前へ突き出して伸びる
      const a = Math.sin((unit.attackAnim / 0.25) * Math.PI);
      ctx.translate(dir * s * 0.3 * a, 0);
      ctx.rotate(dir * 0.1 * a);
      ctx.scale(1 + 0.1 * a, 1 - 0.06 * a);
    }
    // 出現直後はふわっと現れる
    if (unit.age < 0.3) {
      const a = unit.age / 0.3;
      ctx.globalAlpha = a;
      ctx.scale(0.6 + 0.4 * a, 0.6 + 0.4 * a);
    }
  }

  const img = spriteFor(def);
  if (img) {
    const facing = def.spriteFacing === 'left' ? -1 : 1;
    if (unit.dir !== facing) ctx.scale(-1, 1);
    const h = visualHeight(def) * scale;
    const w = (img.naturalWidth / img.naturalHeight) * h;
    ctx.drawImage(img, -w / 2, -h, w, h);
    // 被弾で赤く、回復で緑に光る(絵の形だけを塗る)
    if (unit.hitFlash > 0 || unit.healFlash > 0) {
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * (unit.hitFlash > 0 ? 0.65 : 0.35);
      ctx.drawImage(tinted(img, unit.hitFlash > 0 ? '#ff2a2a' : '#7cff9a'), -w / 2, -h, w, h);
      ctx.globalAlpha = a;
    }
  } else {
    const fill = unit.hitFlash > 0 ? '#ffffff' : unit.healFlash > 0 ? '#b9ffc8' : null;
    drawPlaceholder(ctx, def, s, unit.dir, fill, unit.animTime);
  }
  // 鈍足中は青いもやと、周りを回る氷の結晶
  if (unit.slowed && !unit.dead) {
    ctx.fillStyle = 'rgba(120,200,255,.25)';
    ctx.beginPath();
    ctx.arc(0, -s / 2, s * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9f4ff';
    ctx.strokeStyle = 'rgba(40,120,180,.8)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const a = unit.animTime * 2.5 + (i * Math.PI * 2) / 3;
      const cx = Math.cos(a) * s * 0.55;
      const cy = -s / 2 + Math.sin(a) * s * 0.2;
      const r = Math.max(2, s * 0.09);
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 1.6); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r * 1.6); ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** ボタン用アイコン(静止画)を canvas に描く */
export function drawUnitIcon(canvas, def, dir = 1) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = canvas.clientWidth || 36;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const s = size * 0.8;
  const img0 = spriteFor(def);
  ctx.save();
  if (img0) {
    const ratio = img0.naturalWidth / img0.naturalHeight;
    ctx.translate(size / 2, size / 2 + (ratio > 1 ? size / ratio : size) / 2);
  } else {
    ctx.translate(size / 2, size / 2 + s / 2);
  }
  const img = spriteFor(def);
  if (img) {
    if (dir < 0) ctx.scale(-1, 1);
    // 縦横比を保ったままアイコン枠に収める
    const ratio = img.naturalWidth / img.naturalHeight;
    const h = ratio > 1 ? size / ratio : size;
    const w = h * ratio;
    ctx.drawImage(img, -w / 2, -h, w, h);
  } else {
    drawPlaceholder(ctx, def, s, dir, null, 0);
  }
  ctx.restore();
}

// ---------- プレースホルダー図形 ----------
// 原点 = 足元中央。上方向がマイナス。
function drawPlaceholder(ctx, def, s, dir, fillOverride, t) {
  const r = s / 2;
  if (def.flying) drawWings(ctx, s, t);
  ctx.beginPath();
  switch (def.shape) {
    case 'square':
      roundRect(ctx, -r, -s, s, s, s * 0.15);
      break;
    case 'triangle':
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.lineTo(dir * r * 0.3, -s);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(0, 0);
      ctx.lineTo(r, -r);
      ctx.lineTo(0, -s);
      ctx.lineTo(-r, -r);
      ctx.closePath();
      break;
    case 'hex':
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = Math.cos(a) * r;
        const py = -r + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    case 'blob':
      ctx.moveTo(-r, 0);
      ctx.bezierCurveTo(-r, -s * 1.1, r, -s * 1.1, r, 0);
      ctx.closePath();
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (Math.PI / 5) * i;
        const rr = i % 2 === 0 ? r : r * 0.5;
        const px = Math.cos(a) * rr;
        const py = -r + Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    case 'circle':
    default:
      ctx.arc(0, -r, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = fillOverride ?? def.color;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, s * 0.07);
  ctx.strokeStyle = 'rgba(0,0,0,.55)';
  ctx.stroke();

  // 目(進行方向側)
  const eyeX = dir * r * 0.42;
  const eyeY = -s * 0.68;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(eyeX + dir * s * 0.035, eyeY, s * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // 識別用の文字
  if (def.label) {
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    ctx.font = `900 ${Math.round(s * 0.38)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.label, -dir * r * 0.1, -s * 0.34);
  }
}

/** 飛行ユニットの羽(羽ばたき) */
function drawWings(ctx, s, t) {
  const flap = Math.sin(t * 14) * 0.5 + 0.5;
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.strokeStyle = 'rgba(0,0,0,.4)';
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * s * 0.15, -s * 0.6);
    ctx.quadraticCurveTo(side * s * 0.8, -s * (0.9 + flap * 0.4), side * s * 0.7, -s * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
