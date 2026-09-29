// 敵の城。Unit と同じインターフェース(x, half, alive, takeDamage)を持ち、攻撃対象になる
import { ENEMY_CASTLE } from '../config/constants.js';

export class Castle {
  constructor(hp) {
    this.side = 'enemy';
    this.dir = -1;
    this.isCastle = true;
    this.x = ENEMY_CASTLE.x;
    this.def = { id: 'castle', size: ENEMY_CASTLE.size };
    this.laneY = 0;
    this.maxHp = hp;
    this.hp = hp;
    this.hitFlash = 0;
    this.dead = false;
  }

  get half() { return this.def.size / 2; }
  get alive() { return !this.dead; }

  takeDamage(amount, battle) {
    if (this.dead) return;
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 0.1;
    battle.onCastleDamaged(this);
    if (this.hp <= 0) {
      this.dead = true;
      battle.onCastleDestroyed(this);
    }
  }

  update(dt) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
  }
}
