// 戦闘の状態とルール(描画・DOMには依存しない)
import { WORLD, GAME, WALLET } from '../config/constants.js';
import { ALLY_UNITS, ENEMY_UNITS } from '../config/units.js';
import { Unit } from './Unit.js';
import { Projectile } from './Projectile.js';

export class Battle {
  /**
   * @param {object} stage stages.js の定義
   * @param {{ onEvent?: (type:string, payload?:any)=>void, onEnd?: (result:object)=>void }} hooks
   */
  constructor(stage, hooks = {}) {
    this.stage = stage;
    this.hooks = hooks;

    this.time = 0;
    this.life = stage.life;
    this.maxLife = stage.life;
    this.walletLevel = 1;
    this.money = stage.startMoney;
    this.kills = 0;

    this.units = [];
    this.projectiles = [];
    this.effects = [];   // 斬撃・爆発などの一時エフェクト
    this.popups = [];    // "+15" などの浮き文字

    this.allyCooldowns = ALLY_UNITS.map(() => 0);

    this.waveIndex = -1;
    this.waveTime = 0;
    this.spawnQueue = [];
    this.nextWaveTimer = 0;

    this.result = null;  // { win, time, kills }
    this.endTimer = 0;

    this.startWave(0);
  }

  // ---------- 参照系 ----------
  get walletMax() { return WALLET.max(this.walletLevel); }
  get walletRate() { return WALLET.rate(this.walletLevel); }
  get walletUpgradeCost() {
    return this.walletLevel >= WALLET.maxLevel ? null : WALLET.upgradeCost(this.walletLevel);
  }
  get totalWaves() { return this.stage.waves.length; }
  get isOver() { return this.result !== null; }

  unitsOfSide(side) { return this.units.filter((u) => u.side === side); }
  opponentsOf(unit) { return this.unitsOfSide(unit.side === 'ally' ? 'enemy' : 'ally'); }
  aliveEnemies() { return this.units.filter((u) => u.side === 'enemy' && u.alive); }

  /** 前方で最も近い生存中の敵を返す */
  findTarget(unit) {
    let best = null;
    let bestGap = Infinity;
    for (const o of this.units) {
      if (o.side === unit.side || !o.alive || !unit.isInFront(o)) continue;
      const gap = unit.gapTo(o);
      if (gap < bestGap) { bestGap = gap; best = o; }
    }
    return best;
  }

  canSpawnAlly(index) {
    const def = ALLY_UNITS[index];
    return !!def && !this.isOver && this.allyCooldowns[index] <= 0 && this.money >= def.cost;
  }

  // ---------- プレイヤー操作 ----------
  spawnAlly(index) {
    if (!this.canSpawnAlly(index)) return false;
    const def = ALLY_UNITS[index];
    this.money -= def.cost;
    this.allyCooldowns[index] = def.cooldown;
    this.units.push(new Unit(def, 'ally', WORLD.allyBaseX + def.size / 2));
    return true;
  }

  upgradeWallet() {
    const cost = this.walletUpgradeCost;
    if (cost == null || this.money < cost || this.isOver) return false;
    this.money -= cost;
    this.walletLevel += 1;
    return true;
  }

  // ---------- ウェーブ ----------
  startWave(i) {
    this.waveIndex = i;
    this.waveTime = 0;
    const wave = this.stage.waves[i];
    this.spawnQueue = wave.spawns
      .flatMap((g) => Array.from({ length: g.count }, (_, k) => ({ t: g.at + k * g.interval, type: g.type })))
      .sort((a, b) => a.t - b.t);
    this.emit('wave', { index: i, total: this.totalWaves, boss: !!wave.boss });
  }

  spawnEnemy(type) {
    const def = ENEMY_UNITS[type];
    if (!def) return;
    this.units.push(new Unit(def, 'enemy', WORLD.length - def.size / 2, this.stage.enemyMul));
  }

  updateWaves(dt) {
    if (this.nextWaveTimer > 0) {
      this.nextWaveTimer -= dt;
      if (this.nextWaveTimer <= 0) this.startWave(this.waveIndex + 1);
      return;
    }

    this.waveTime += dt;
    while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveTime) {
      this.spawnEnemy(this.spawnQueue.shift().type);
    }
    if (this.spawnQueue.length) return;

    const cleared = this.aliveEnemies().length === 0;
    const isLast = this.waveIndex >= this.totalWaves - 1;
    if (isLast) {
      if (cleared) this.finish(true);
    } else if (cleared || this.waveTime > this.stage.waves[this.waveIndex].timeout) {
      this.nextWaveTimer = GAME.nextWaveDelay;
    }
  }

  // ---------- 更新 ----------
  update(dt) {
    if (this.isOver) {
      // 勝敗決定後もしばらく演出を流してから結果画面へ
      this.updateEntities(dt);
      this.endTimer -= dt;
      if (this.endTimer <= 0 && !this._endNotified) {
        this._endNotified = true;
        this.hooks.onEnd?.(this.result);
      }
      return;
    }

    this.time += dt;
    this.money = Math.min(this.walletMax, this.money + this.walletRate * dt);
    this.allyCooldowns = this.allyCooldowns.map((c) => Math.max(0, c - dt));

    this.updateWaves(dt);
    this.updateEntities(dt);
    this.checkBreach();

    if (this.life <= 0) this.finish(false);
  }

  updateEntities(dt) {
    for (const u of this.units) u.update(dt, this);
    for (const p of this.projectiles) p.update(dt, this);

    this.units = this.units.filter((u) => !(u.dead && u.removeTimer <= 0));
    this.projectiles = this.projectiles.filter((p) => !p.done);

    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.life);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.life);
  }

  /** 自陣に到達した敵を処理 */
  checkBreach() {
    for (const u of this.units) {
      if (u.side !== 'enemy' || !u.alive) continue;
      if (u.x - u.half <= WORLD.allyBaseX) {
        const dmg = u.def.baseDamage ?? 1;
        this.life = Math.max(0, this.life - dmg);
        u.dead = true;
        u.state = 'dying';
        u.removeTimer = 0.3;
        this.addPopup(WORLD.allyBaseX, `-${dmg}`, '#ff6b6b', 60);
        this.effects.push({ type: 'breach', x: WORLD.allyBaseX, t: 0, life: 0.4 });
        this.emit('breach', { life: this.life });
      }
    }
  }

  finish(win) {
    this.result = { win, time: this.time, kills: this.kills, stageId: this.stage.id };
    this.endTimer = GAME.endDelay;
    this.emit('end', this.result);
  }

  // ---------- コールバック(Unit / Projectile から呼ばれる) ----------
  onUnitDied(unit) {
    if (unit.side === 'enemy') {
      this.kills += 1;
      const reward = unit.def.reward ?? 0;
      if (reward) {
        this.money = Math.min(this.walletMax, this.money + reward);
        this.addPopup(unit.x, `+${reward}`, '#ffd84d');
      }
    }
  }

  spawnProjectile(owner, target) {
    this.projectiles.push(new Projectile(owner, target));
  }

  addHitEffect(x, source, kind) {
    this.effects.push({ type: kind, x, dir: source.dir, side: source.side, laneY: source.laneY ?? 0, t: 0, life: 0.2 });
  }

  addExplosion(x, radius) {
    this.effects.push({ type: 'explosion', x, radius, t: 0, life: 0.35 });
  }

  addPopup(x, text, color, rise = 40) {
    this.popups.push({ x, text, color, rise, t: 0, life: 0.9 });
  }

  emit(type, payload) {
    this.hooks.onEvent?.(type, payload);
  }
}
