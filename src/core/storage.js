// 進行状況の保存 (LocalStorage)
//   cleared : { [stageId]: { bestTime } }
//   xp      : 所持経験値
//   levels  : { [unitId]: level }
//   deck    : 出撃編成(unitId の配列)
import { ALLY_UNITS, DEFAULT_DECK, DECK_SIZE, allyById } from '../config/units.js';
import { LEVEL } from '../config/constants.js';

const KEY = 'line-defense:progress:v1';

const DEFAULT = () => ({ cleared: {}, xp: 0, levels: {}, deck: [...DEFAULT_DECK] });

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT();
    return { ...DEFAULT(), ...JSON.parse(raw) };
  } catch {
    return DEFAULT();
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // プライベートモード等で保存できない場合は無視
  }
}

export const Progress = {
  // ---------- ステージ ----------
  isCleared(stageId) {
    return !!read().cleared[stageId];
  },
  bestTime(stageId) {
    return read().cleared[stageId]?.bestTime ?? null;
  },
  // ステージ1は常に解放。以降は前のステージをクリアすると解放
  isUnlocked(stageId) {
    return stageId === 1 || this.isCleared(stageId - 1);
  },
  /** 解放済みで一番先のステージID */
  latestUnlocked(total) {
    let id = 1;
    while (id < total && this.isCleared(id)) id++;
    return id;
  },
  markCleared(stageId, time) {
    const data = read();
    const prev = data.cleared[stageId]?.bestTime;
    const t = Math.round(time * 10) / 10;
    data.cleared[stageId] = { bestTime: prev == null ? t : Math.min(prev, t) };
    write(data);
  },

  // ---------- 経験値・レベル ----------
  get xp() { return read().xp; },
  addXp(amount) {
    const data = read();
    data.xp += Math.max(0, Math.round(amount));
    write(data);
  },
  level(unitId) {
    return read().levels[unitId] ?? 1;
  },
  levels() {
    return Object.fromEntries(ALLY_UNITS.map((u) => [u.id, this.level(u.id)]));
  },
  /** 次のレベルに必要な経験値。最大なら null */
  upgradeCost(unitId) {
    const lv = this.level(unitId);
    return lv >= LEVEL.max ? null : LEVEL.upgradeCost(allyById(unitId), lv);
  },
  upgrade(unitId) {
    const cost = this.upgradeCost(unitId);
    const data = read();
    if (cost == null || data.xp < cost) return false;
    data.xp -= cost;
    data.levels[unitId] = (data.levels[unitId] ?? 1) + 1;
    write(data);
    return true;
  },

  // ---------- キャラ解放・編成 ----------
  isUnitUnlocked(unitId) {
    const def = allyById(unitId);
    return !!def && (!def.unlockAfter || this.isCleared(def.unlockAfter));
  },
  deck() {
    const deck = read().deck.filter((id) => this.isUnitUnlocked(id));
    return deck.length ? deck : [...DEFAULT_DECK];
  },
  /** 編成への出し入れ。成功したら true */
  toggleDeck(unitId) {
    const data = read();
    const deck = this.deck();
    const i = deck.indexOf(unitId);
    if (i >= 0) {
      if (deck.length <= 1) return false; // 最低1体
      deck.splice(i, 1);
    } else {
      if (deck.length >= DECK_SIZE || !this.isUnitUnlocked(unitId)) return false;
      deck.push(unitId);
    }
    // 並び順は図鑑順にそろえる
    data.deck = ALLY_UNITS.map((u) => u.id).filter((id) => deck.includes(id));
    write(data);
    return true;
  },

  reset() {
    write(DEFAULT());
  },
};
