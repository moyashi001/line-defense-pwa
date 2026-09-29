// 飛び道具(弓矢・砲弾など)
export class Projectile {
  constructor(owner, target) {
    this.side = owner.side;
    this.dir = owner.dir;
    this.x = owner.frontX;
    this.startX = this.x;
    this.laneY = owner.laneY;
    this.target = target;
    this.targetX = target.x;
    this.damage = owner.atk;
    this.splash = owner.def.splash || 0;
    this.speed = owner.def.projectileSpeed || 400;
    this.color = owner.def.projectileColor || '#fff';
    this.heavy = this.splash > 0;
    this.hitOpts = owner.hitOpts;
    this.magic = !!owner.def.pierce || owner.def.projectileStyle === 'orb';
    this.big = !!owner.def.boss;
    this.fromFly = owner.flying;
    this.toFly = !!target.def.flying;
    this.done = false;
  }

  /** 0〜1 の進行度(放物線描画用) */
  get progress() {
    const total = Math.abs(this.targetX - this.startX) || 1;
    return Math.min(1, Math.abs(this.x - this.startX) / total);
  }

  update(dt, battle) {
    if (this.target.alive) this.targetX = this.target.x;
    this.x += this.dir * this.speed * dt;
    if ((this.targetX - this.x) * this.dir <= 0) this.hit(battle);
  }

  hit(battle) {
    this.done = true;
    const foes = battle.unitsOfSide(this.side === 'ally' ? 'enemy' : 'ally');
    if (this.splash) {
      for (const o of foes) {
        if (o.alive && Math.abs(o.x - this.x) <= this.splash + o.half) o.takeDamage(this.damage, battle, this.hitOpts);
      }
      battle.addExplosion(this.x, this.splash);
      return;
    }
    let victim = this.target.alive ? this.target : null;
    if (!victim) {
      // 標的が先に倒れていたら着弾点の近くの敵に当てる
      victim = foes.find((o) => o.alive && Math.abs(o.x - this.x) <= o.half + 10) || null;
    }
    if (victim) {
      victim.takeDamage(this.damage, battle, this.hitOpts);
      battle.addHitEffect(victim.x, { side: this.side, dir: this.dir }, 'hit');
    }
  }
}
