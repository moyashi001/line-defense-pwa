// 戦闘の状態とルール(描画・DOMには依存しない)
import { WORLD, GAME, COST, LEVEL, SPECIAL, costLevelAt } from '../config/constants.js';
import { ALLY_UNITS, ENEMY_UNITS } from '../config/units.js';
import { Unit } from './Unit.js';
import { Projectile } from './Projectile.js';
import { Castle } from './Castle.js';

export class Battle {
  /**
   * @param {object} stage stages.js の定義
   * @param {{ onEvent?: (type:string, payload?:any)=>void, onEnd?: (result:object)=>void }} hooks
   * @param {{ deck?: object[], levels?: Record<string, number> }} [options] 出撃編成とキャラレベル
   */
  constructor(stage, hooks = {}, options = {}) {
    this.stage = stage;
    this.hooks = hooks;
    this.deck = options.deck ?? ALLY_UNITS.slice(0, 5);
    this.levels = options.levels ?? {};

    this.time = 0;
    this.life = stage.life;
    this.maxLife = stage.life;
    this.costLevel = 0; // 経過時間で自動的に上がる(COST.levels)
    this.money = Math.min(stage.startMoney, COST.levels[0].max);
    this.kills = 0;

    this.castle = new Castle(stage.castleHp);
    this.units = [];
    this.projectiles = [];
    this.effects = [];   // 斬撃・爆発などの一時エフェクト
    this.popups = [];    // "+15" などの浮き文字

    this.allyCooldowns = this.deck.map(() => 0);
    this.castleSpawnTimer = stage.castleSpawn?.interval ?? 0;

    this.waveIndex = -1;
    this.waveCount = 0;  // 通算ウェーブ数(最終ウェーブ後はループする)
    this.looping = false;
    this.waveTime = 0;
    this.spawnQueue = [];
    this.nextWaveTimer = 0;

    this.bossTriggered = false;
    this.bossWarning = 0; // 警告演出の残り時間

    this.special = SPECIAL.startCharge; // 必殺技ゲージ(0〜1)

    // 図鑑用の記録
    this.seenTypes = new Set();
    this.killCounts = {};

    // デバッグ用フラグ(デバッグパネルから切り替える)
    this.debug = { infiniteCost: false, noCooldown: false, invincible: false };

    this.result = null;  // { win, time, kills }
    this.endTimer = 0;

    this.startWave(0);
  }

  // ---------- 参照系 ----------
  get costMax() { return COST.levels[this.costLevel].max; }
  get costRate() { return COST.levels[this.costLevel].rate; }
  get costMaxLevel() { return COST.levels.length; }
  /** 次のコストレベルまでの進み具合(0〜1)。最大なら 1 */
  get costLevelProgress() {
    const next = COST.levels[this.costLevel + 1];
    if (!next) return 1;
    const cur = COST.levels[this.costLevel];
    return (this.time - cur.time) / (next.time - cur.time);
  }
  get totalWaves() { return this.stage.waves.length; }
  get isOver() { return this.result !== null; }
  get allyCount() { return this.units.filter((u) => u.side === 'ally' && u.alive).length; }
  get allyCap() { return GAME.allyCap; }
  get boss() { return this.units.find((u) => u.def.boss && u.alive) || null; }

  /** 指定陣営の攻撃対象(敵側には城も含む) */
  unitsOfSide(side) {
    const list = this.units.filter((u) => u.side === side);
    if (side === 'enemy' && this.castle.alive) list.push(this.castle);
    return list;
  }
  opponentsOf(unit) { return this.unitsOfSide(unit.side === 'ally' ? 'enemy' : 'ally'); }
  aliveEnemies() { return this.units.filter((u) => u.side === 'enemy' && u.alive); }

  /** 前方で最も近い生存中の敵(城を含む)を返す */
  findTarget(unit) {
    let best = null;
    let bestGap = Infinity;
    for (const o of this.opponentsOf(unit)) {
      if (!o.alive || !unit.canHit(o) || !unit.isInFront(o)) continue;
      const gap = unit.gapTo(o);
      if (gap < bestGap) { bestGap = gap; best = o; }
    }
    return best;
  }

  get specialReady() { return this.special >= 1 && !this.isOver; }

  /** 必殺技: 画面上の敵全員にダメージを与えて吹き飛ばす(城には当たらない) */
  useSpecial() {
    if (!this.specialReady) return false;
    this.special = 0;
    const dmg = Math.round(SPECIAL.baseDamage * this.stage.enemyMul.hp);
    for (const e of this.aliveEnemies()) {
      e.takeDamage(dmg, this, { pierce: true });
      e.forceKnockback(e.def.boss ? 1 : 2.2);
    }
    this.fx('special', { x0: WORLD.allyBaseX, x1: WORLD.length });
    this.emit('special');
    return true;
  }

  canSpawnAlly(index) {
    const def = this.deck[index];
    return !!def && !this.isOver && this.allyCooldowns[index] <= 0 && this.money >= def.cost
      && this.allyCount < this.allyCap;
  }

  // ---------- プレイヤー操作 ----------
  spawnAlly(index) {
    if (!this.canSpawnAlly(index)) return false;
    const def = this.deck[index];
    this.money -= def.cost;
    this.allyCooldowns[index] = def.cooldown;
    const m = LEVEL.statMul(this.levels[def.id] ?? 1);
    const unit = new Unit(def, 'ally', WORLD.allyBaseX + def.size / 2, { hp: m, atk: m, speed: 1 });
    this.units.push(unit);
    this.fx('spawn', { side: 'ally', x: unit.x, laneY: unit.laneY, flying: unit.flying, baseX: WORLD.allyBaseX * 0.7 });
    return true;
  }

  // ---------- ウェーブ ----------
  startWave(i) {
    this.waveIndex = i;
    this.waveCount += 1;
    this.waveTime = 0;
    this.spawnQueue = this.buildQueue(this.stage.waves[i].spawns, 0);
    this.emit('wave', { count: this.waveCount });
  }

  buildQueue(spawns, offset) {
    return spawns
      .flatMap((g) => Array.from({ length: g.count }, (_, k) => ({ t: offset + g.at + k * g.interval, type: g.type })))
      .sort((a, b) => a.t - b.t);
  }

  /** 次のウェーブへ。最終ウェーブの後は loopFrom から繰り返す(城を壊すまで敵は途切れない) */
  advanceWave() {
    let i = this.waveIndex + 1;
    if (i >= this.totalWaves) {
      this.looping = true;
      i = this.stage.loopFrom ?? 0;
    }
    this.startWave(i);
  }

  spawnEnemy(type, x = null) {
    const def = ENEMY_UNITS[type];
    if (!def) return;
    const px = x == null ? WORLD.length - def.size / 2 : Math.min(x, WORLD.length - def.size / 2);
    const unit = new Unit(def, 'enemy', px, this.stage.enemyMul);
    this.units.push(unit);
    this.seenTypes.add(type);
    this.fx('spawn', { side: 'enemy', x: unit.x, laneY: unit.laneY, flying: unit.flying, boss: !!def.boss });
    if (def.boss) this.emit('bossSpawn', unit);
  }

  updateWaves(dt) {
    this.waveTime += dt;
    while (this.spawnQueue.length && this.spawnQueue[0].t <= this.waveTime) {
      this.spawnEnemy(this.spawnQueue.shift().type);
    }

    if (this.nextWaveTimer > 0) {
      this.nextWaveTimer -= dt;
      if (this.nextWaveTimer <= 0) this.advanceWave();
      return;
    }
    if (this.spawnQueue.length) return;

    const alive = this.aliveEnemies().length;
    const timedOut = this.waveTime > this.stage.waves[this.waveIndex].timeout && alive <= GAME.waveHoldEnemies;
    if (alive === 0 || timedOut) {
      this.nextWaveTimer = GAME.nextWaveDelay;
    }
  }

  /** 経過時間に応じてコストレベルを自動で上げる */
  updateCostLevel() {
    const lv = costLevelAt(this.time);
    if (lv === this.costLevel) return;
    this.costLevel = lv;
    this.addPopup(WORLD.allyBaseX + 70, `コスト Lv${lv + 1}！`, '#ffd84d', 70);
    this.emit('costLevelUp', { level: lv + 1, max: this.costMax, rate: this.costRate });
  }

  /** 城からの定期増援(ステージに castleSpawn があるとき) */
  updateCastleSpawn(dt) {
    const cs = this.stage.castleSpawn;
    if (!cs) return;
    this.castleSpawnTimer -= dt;
    if (this.castleSpawnTimer <= 0) {
      this.castleSpawnTimer = cs.interval;
      this.spawnEnemy(cs.type);
    }
  }

  /** 城のHPが一定以下になったらボス出現(警告→出現) */
  checkBossTrigger() {
    const boss = this.stage.boss;
    if (!boss || this.bossTriggered) return;
    if (this.castle.hp / this.castle.maxHp > boss.castleHpRatio) return;
    this.bossTriggered = true;
    this.bossWarning = GAME.bossWarningTime;
    this.spawnQueue.push(...this.buildQueue(boss.spawns, this.waveTime + GAME.bossWarningTime));
    this.spawnQueue.sort((a, b) => a.t - b.t);
    this.emit('bossWarning');
  }

  // ---------- 更新 ----------
  update(dt) {
    this.bossWarning = Math.max(0, this.bossWarning - dt);

    if (this.isOver) {
      // 勝敗決定後もしばらく演出を流してから結果画面へ。勝ったときは最初だけスローモーション
      const slow = this.result.win && GAME.endDelay - this.endTimer < GAME.slowmoTime;
      this.updateEntities(slow ? dt * 0.35 : dt);
      this.endTimer -= dt;
      if (this.endTimer <= 0 && !this._endNotified) {
        this._endNotified = true;
        this.hooks.onEnd?.(this.result);
      }
      return;
    }

    this.time += dt;
    this.updateCostLevel();
    this.money = Math.min(this.costMax, this.money + this.costRate * dt);
    this.special = Math.min(1, this.special + dt / SPECIAL.chargeTime);
    if (this.debug.infiniteCost) this.money = this.costMax;
    if (this.debug.noCooldown) this.allyCooldowns = this.allyCooldowns.map(() => 0);
    this.allyCooldowns = this.allyCooldowns.map((c) => Math.max(0, c - dt));

    this.updateWaves(dt);
    this.updateCastleSpawn(dt);
    this.updateEntities(dt);
    this.checkBreach();
    this.checkBossTrigger();

    if (this.debug.invincible) this.life = this.maxLife;
    if (this.life <= 0) this.finish(false);
  }

  updateEntities(dt) {
    this.castle.update(dt);
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
    if (this.isOver) return;
    this.result = {
      win, time: this.time, kills: this.kills, stageId: this.stage.id,
      castleDamage: 1 - this.castle.hp / this.castle.maxHp, // 城に与えたダメージ割合(0〜1)
    };
    this.endTimer = GAME.endDelay;
    this.emit('end', this.result);
  }

  // ---------- コールバック(Unit / Projectile / Castle から呼ばれる) ----------
  onUnitDied(unit) {
    const split = unit.def.splitInto;
    if (split && unit.side === 'enemy') {
      for (let i = 0; i < split.count; i++) this.spawnEnemy(split.type, unit.x + (i - (split.count - 1) / 2) * 18);
    }
    if (unit.side === 'enemy') {
      this.kills += 1;
      this.killCounts[unit.def.id] = (this.killCounts[unit.def.id] ?? 0) + 1;
      this.special = Math.min(1, this.special + SPECIAL.killCharge);
      // 撃破報酬: 敵の種類ごとの reward(雑魚は少なく、ボスは多い)
      const reward = Math.round((unit.def.reward ?? 0) * COST.killRewardMul);
      if (reward) {
        this.money = Math.min(this.costMax, this.money + reward);
        this.addPopup(unit.x, `+${reward}`, '#ffd84d');
      }
    }
  }

  onCastleDamaged() {}

  onCastleDestroyed(castle) {
    // 城が落ちたら残りの敵も消える(撃破数・報酬には数えない)
    for (const u of this.units) {
      if (u.side !== 'enemy' || !u.alive) continue;
      u.dead = true;
      u.state = 'dying';
      u.removeTimer = 0.5;
    }
    this.spawnQueue = [];
    this.addExplosion(castle.x, 90);
    this.emit('castleDestroyed', { x: castle.x });
    this.finish(true);
  }

  // ---------- デバッグ用 ----------
  /** 編成・コストに関係なく味方を出す */
  debugSpawnAlly(def) {
    const m = LEVEL.statMul(this.levels[def.id] ?? 1);
    const unit = new Unit(def, 'ally', WORLD.allyBaseX + def.size / 2, { hp: m, atk: m, speed: 1 });
    this.units.push(unit);
    this.fx('spawn', { side: 'ally', x: unit.x, laneY: unit.laneY, flying: unit.flying, baseX: WORLD.allyBaseX * 0.7 });
  }
  debugKillEnemies() {
    for (const e of this.aliveEnemies()) e.takeDamage(1e9, this, { pierce: true });
  }
  debugTriggerBoss() {
    if (!this.stage.boss || this.bossTriggered) return false;
    this.castle.hp = Math.min(this.castle.hp, this.castle.maxHp * this.stage.boss.castleHpRatio);
    return true;
  }

  spawnProjectile(owner, target) {
    const style = owner.def.projectileStyle;
    if (style === 'laser') {
      // 光線は一瞬で届く
      target.takeDamage(owner.atk, this, owner.hitOpts);
      this.fx('beam', { x0: owner.frontX, x1: target.x, laneY: owner.laneY, fromFly: owner.flying, toFly: !!target.def.flying, color: owner.def.projectileColor });
      return;
    }
    if (style === 'shell') this.fx('shot', { style, x: owner.frontX, laneY: owner.laneY, flying: owner.flying, dir: owner.dir });
    this.projectiles.push(new Projectile(owner, target));
  }

  addHitEffect(x, source, kind) {
    this.effects.push({ type: kind, x, dir: source.dir, side: source.side, laneY: source.laneY ?? 0, t: 0, life: 0.2 });
  }

  addHealEffect(x, radius, side) {
    this.effects.push({ type: 'heal', x, radius, side, t: 0, life: 0.6 });
  }

  addExplosion(x, radius) {
    this.effects.push({ type: 'explosion', x, radius, t: 0, life: 0.35 });
    this.fx('explosion', { x, radius });
  }

  addPopup(x, text, color, rise = 40) {
    this.popups.push({ x, text, color, rise, t: 0, life: 0.9 });
  }

  emit(type, payload) {
    this.hooks.onEvent?.(type, payload);
  }

  /** 演出用の通知(描画側で火花・煙などにする)。ゲームの結果には影響しない */
  fx(kind, data) {
    this.hooks.onEvent?.('fx', { kind, ...data });
  }
}
