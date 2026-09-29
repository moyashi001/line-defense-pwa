// 味方・敵共通のユニット
import { WORLD, GAME } from '../config/constants.js';

let nextId = 1;

export class Unit {
  /**
   * @param {object} def   units.js の定義
   * @param {'ally'|'enemy'} side
   * @param {number} x     ワールド座標
   * @param {{hp:number, atk:number, speed:number}} mul 能力倍率(ステージ難易度・キャラレベル)
   */
  constructor(def, side, x, mul = { hp: 1, atk: 1, speed: 1 }) {
    this.id = nextId++;
    this.def = def;
    this.side = side;
    this.dir = side === 'ally' ? 1 : -1; // 進行方向
    this.x = x;
    this.laneY = (Math.random() - 0.5) * 16; // 奥行きのばらつき(見た目用)

    this.maxHp = Math.round(def.hp * mul.hp);
    this.hp = this.maxHp;
    this.atk = Math.round(def.atk * mul.atk);
    this.speed = def.speed * (mul.speed ?? 1);

    this.cooldown = 0.2;
    this.healTimer = def.heal?.interval ?? 0;
    this.summonTimer = def.summon?.interval ?? 0;
    this.slowTimer = 0;
    this.slowFactor = 1;

    this.state = 'walk'; // walk | attack | idle | knockback | dying
    this.dead = false;
    this.removeTimer = 0;

    // 見た目用タイマー
    this.animTime = Math.random() * 10;
    this.attackAnim = 0;
    this.hitFlash = 0;
    this.healFlash = 0;
    this.age = 0; // 出現からの経過時間(登場演出用)

    // HPがしきい値を下回るたびにノックバック
    const kb = def.knockbacks ?? 1;
    this.kbThresholds = Array.from({ length: kb }, (_, i) => this.maxHp * (1 - (i + 1) / (kb + 1)));
    this.kbTimer = 0;
  }

  get half() { return this.def.size / 2; }
  get alive() { return !this.dead; }
  get frontX() { return this.x + this.dir * this.half; }
  get flying() { return !!this.def.flying; }
  get slowed() { return this.slowTimer > 0; }

  /** 相手との隙間(体の端どうしの距離) */
  gapTo(other) {
    return Math.abs(other.x - this.x) - this.half - other.half;
  }

  /** 相手が自分の前方(または重なっている)か */
  isInFront(other) {
    return (other.x - this.x) * this.dir > -(this.half + other.half);
  }

  /** 飛行している相手は、飛び道具か飛行ユニットでしか攻撃できない */
  canHit(other) {
    return !other.def.flying || this.def.attackType === 'ranged' || this.flying;
  }

  /**
   * @param {number} amount
   * @param {object} battle
   * @param {{pierce?:boolean, slow?:{factor:number,duration:number}}} [opts]
   */
  takeDamage(amount, battle, opts = {}) {
    if (this.dead) return;
    const armor = opts.pierce ? 0 : (this.def.armor ?? 0);
    const dmg = Math.max(1, amount - armor);
    this.hp -= dmg;
    this.hitFlash = 0.12;
    battle.fx('hit', { x: this.x, laneY: this.laneY, flying: this.flying, side: this.side, dmg, slow: !!opts.slow, color: opts.color });
    if (opts.slow) this.applySlow(opts.slow);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(battle);
      return;
    }
    let knocked = false;
    while (this.kbThresholds.length && this.hp <= this.kbThresholds[0]) {
      this.kbThresholds.shift();
      knocked = true;
    }
    if (knocked) {
      this.state = 'knockback';
      this.kbTimer = GAME.knockbackTime;
      battle.fx('knockback', { x: this.x, laneY: this.laneY, dir: this.dir });
    }
  }

  /** 必殺技などで強制的に吹き飛ばす */
  forceKnockback(power = 1) {
    if (this.dead) return;
    this.state = 'knockback';
    this.kbTimer = GAME.knockbackTime * power;
  }

  applySlow({ factor, duration }) {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  heal(amount) {
    if (this.dead || this.hp >= this.maxHp) return false;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.healFlash = 0.4;
    return true;
  }

  die(battle) {
    this.dead = true;
    this.state = 'dying';
    this.removeTimer = 0.5;
    battle.fx('death', { x: this.x, laneY: this.laneY, flying: this.flying, side: this.side, size: this.def.size });
    battle.onUnitDied(this);
  }

  update(dt, battle) {
    this.animTime += dt;
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.healFlash = Math.max(0, this.healFlash - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt);

    if (this.dead) {
      this.removeTimer -= dt;
      return;
    }

    // 鈍足中は移動も攻撃間隔も遅くなる
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }
    const tdt = dt * this.slowFactor;

    this.cooldown -= tdt;
    this.updateSupport(tdt, battle);

    if (this.state === 'knockback') {
      this.kbTimer -= dt;
      this.x -= this.dir * GAME.knockbackSpeed * dt;
      this.clampPosition();
      if (this.kbTimer <= 0) this.state = 'walk';
      return;
    }

    const target = battle.findTarget(this);
    if (target && this.gapTo(target) <= this.def.range) {
      this.state = 'attack';
      if (this.cooldown <= 0) {
        this.attack(target, battle);
        this.cooldown = this.def.attackInterval;
      }
      return;
    }

    // 前進
    this.state = 'walk';
    this.x += this.dir * this.speed * tdt;
    if (this.clampPosition()) this.state = 'idle';
  }

  /** 回復・召喚など、攻撃とは別に定期的に行う行動 */
  updateSupport(dt, battle) {
    const { heal, summon } = this.def;
    if (heal) {
      this.healTimer -= dt;
      if (this.healTimer <= 0) {
        this.healTimer = heal.interval;
        const amount = Math.round(heal.amount * (this.atk / this.def.atk || 1));
        let healed = false;
        for (const f of battle.units) {
          if (f.side === this.side && Math.abs(f.x - this.x) <= heal.radius && f.heal(amount)) {
            healed = true;
            battle.fx('healed', { x: f.x, laneY: f.laneY, flying: f.flying });
          }
        }
        if (healed) battle.addHealEffect(this.x, heal.radius, this.side);
      }
    }
    if (summon && this.side === 'enemy') {
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        this.summonTimer = summon.interval;
        for (let i = 0; i < summon.count; i++) battle.spawnEnemy(summon.type, this.x + 20 + i * 12);
      }
    }
  }

  /** 移動範囲の制限。止められたら true */
  clampPosition() {
    if (this.side === 'ally') {
      const maxX = WORLD.enemyGateX - this.half;
      const minX = WORLD.allyBaseX + this.half;
      if (this.x > maxX) { this.x = maxX; return true; }
      if (this.x < minX) this.x = minX;
    } else {
      const maxX = WORLD.length - this.half;
      if (this.x > maxX) this.x = maxX;
    }
    return false;
  }

  get hitOpts() {
    return { pierce: !!this.def.pierce, slow: this.def.slowOnHit, color: this.def.pierce ? '#d1a8ff' : undefined };
  }

  attack(target, battle) {
    this.attackAnim = 0.25;
    if (this.def.boss) battle.emit('bossAttack', this);
    switch (this.def.attackType) {
      case 'melee':
        target.takeDamage(this.atk, battle, this.hitOpts);
        battle.addHitEffect(target.x, this, 'slash');
        break;
      case 'area': {
        const reach = this.def.range;
        for (const o of battle.opponentsOf(this)) {
          if (o.alive && this.canHit(o) && this.isInFront(o) && this.gapTo(o) <= reach) o.takeDamage(this.atk, battle, this.hitOpts);
        }
        if (this.def.attackFx) {
          battle.fx('swing', { x: this.frontX, laneY: this.laneY, flying: this.flying, dir: this.dir, reach, style: this.def.attackFx, size: this.def.size, color: this.def.color });
        } else {
          battle.addHitEffect(this.frontX + this.dir * reach * 0.5, this, 'area');
        }
        break;
      }
      case 'ranged':
        battle.spawnProjectile(this, target);
        break;
    }
  }
}
