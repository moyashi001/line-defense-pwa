// 味方・敵共通のユニット
import { WORLD, GAME } from '../config/constants.js';

let nextId = 1;

export class Unit {
  /**
   * @param {object} def   units.js の定義
   * @param {'ally'|'enemy'} side
   * @param {number} x     ワールド座標
   * @param {{hp:number, atk:number, speed:number}} mul 能力倍率
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
    this.speed = def.speed * mul.speed;

    this.cooldown = 0.2;
    this.state = 'walk'; // walk | attack | idle | knockback | dying
    this.dead = false;
    this.removeTimer = 0;

    // 見た目用タイマー
    this.animTime = Math.random() * 10;
    this.attackAnim = 0;
    this.hitFlash = 0;

    // HPがしきい値を下回るたびにノックバック
    const kb = def.knockbacks ?? 1;
    this.kbThresholds = Array.from({ length: kb }, (_, i) => this.maxHp * (1 - (i + 1) / (kb + 1)));
    this.kbTimer = 0;
  }

  get half() { return this.def.size / 2; }
  get alive() { return !this.dead; }
  get frontX() { return this.x + this.dir * this.half; }

  /** 相手との隙間(体の端どうしの距離) */
  gapTo(other) {
    return Math.abs(other.x - this.x) - this.half - other.half;
  }

  /** 相手が自分の前方(または重なっている)か */
  isInFront(other) {
    return (other.x - this.x) * this.dir > -(this.half + other.half);
  }

  takeDamage(amount, battle) {
    if (this.dead) return;
    this.hp -= amount;
    this.hitFlash = 0.12;
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
    }
  }

  die(battle) {
    this.dead = true;
    this.state = 'dying';
    this.removeTimer = 0.5;
    battle.onUnitDied(this);
  }

  update(dt, battle) {
    this.animTime += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt);

    if (this.dead) {
      this.removeTimer -= dt;
      return;
    }

    this.cooldown -= dt;

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
    this.x += this.dir * this.speed * dt;
    if (this.clampPosition()) this.state = 'idle';
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

  attack(target, battle) {
    this.attackAnim = 0.25;
    switch (this.def.attackType) {
      case 'melee':
        target.takeDamage(this.atk, battle);
        battle.addHitEffect(target.x, this, 'slash');
        break;
      case 'area': {
        const reach = this.def.range;
        for (const o of battle.opponentsOf(this)) {
          if (o.alive && this.isInFront(o) && this.gapTo(o) <= reach) o.takeDamage(this.atk, battle);
        }
        battle.addHitEffect(this.frontX + this.dir * reach * 0.5, this, 'area');
        break;
      }
      case 'ranged':
        battle.spawnProjectile(this, target);
        break;
    }
  }
}
