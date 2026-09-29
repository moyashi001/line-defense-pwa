// デバッグ機能(URL に ?debug=1 を付けたときだけ有効)
//   常にON: 全ステージ・全キャラ・図鑑を解放 / EXP 10000以上 / 全キャラLv最大 / コスト常に1000・出撃の待ち時間なし
//   戦闘画面: 🐞 ボタンからパネルを開く(無敵・倍速・好きなキャラを出す・勝敗の即決など)
// デバッグ中の進行データは別の保存枠(storage.js)なので、本来のデータは変わらない。
import { STAGES } from '../config/stages.js';
import { ALLY_UNITS, ENEMY_UNITS } from '../config/units.js';
import { Progress } from '../core/storage.js';

const $ = (id) => document.getElementById(id);

// 戦闘をまたいで保持する設定
export const debugState = {
  speed: 1,
  infiniteCost: true, // 常にON(コスト1000・レベル最大)
  noCooldown: true,   // 常にON
  invincible: false,
  hitbox: false,
};

/**
 * @param {{ getBattle: () => any, renderer: any }} ctx
 */
export function setupDebug(ctx) {
  const badge = document.createElement('div');
  badge.className = 'debug-badge';
  badge.textContent = 'DEBUG';
  document.body.appendChild(badge);

  applyDebugProgress();
  setupBattlePanel(ctx);
}

/** 新しい戦闘が始まったら設定を反映 */
export function applyDebugToBattle(battle, renderer) {
  battle.debug.infiniteCost = debugState.infiniteCost;
  battle.debug.noCooldown = debugState.noCooldown;
  battle.debug.invincible = debugState.invincible;
  renderer.showHitbox = debugState.hitbox;
}

// ---------- 進行データ(常にON) ----------
/** 全解放・EXP・全キャラLv最大をデバッグ用の保存枠に反映する(起動時・画面遷移時に呼ぶ) */
export function applyDebugProgress() {
  Progress.debugUnlockAll(STAGES.length, Object.keys(ENEMY_UNITS));
  Progress.debugMaxLevels();
  Progress.debugEnsureXp(10000);
}

// ---------- 戦闘中のデバッグパネル ----------
function setupBattlePanel({ getBattle, renderer }) {
  const field = document.querySelector('#screen-battle .field');
  const fab = document.createElement('button');
  fab.className = 'debug-fab';
  fab.textContent = '🐞';
  const panel = document.createElement('div');
  panel.className = 'debug-panel';
  field.append(fab, panel);
  fab.addEventListener('click', () => panel.classList.toggle('show'));

  const section = (title) => {
    const h = document.createElement('h4');
    h.textContent = title;
    const row = document.createElement('div');
    row.className = 'row';
    panel.append(h, row);
    return row;
  };
  const button = (row, label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', () => { const bt = getBattle(); if (bt) fn(bt, b); });
    row.appendChild(b);
    return b;
  };
  const toggle = (row, label, key, apply) => {
    const b = button(row, label, (bt) => {
      debugState[key] = !debugState[key];
      b.classList.toggle('on', debugState[key]);
      apply(bt);
    });
    b.classList.toggle('on', debugState[key]);
  };

  // 切り替え
  const r1 = section('チート');
  toggle(r1, '自陣無敵', 'invincible', (bt) => { bt.debug.invincible = debugState.invincible; });
  toggle(r1, '当たり判定表示', 'hitbox', () => { renderer.showHitbox = debugState.hitbox; });

  // 速度
  const r2 = section('ゲーム速度');
  const speedButtons = [1, 2, 4, 8].map((s) => button(r2, `x${s}`, () => {
    debugState.speed = s;
    speedButtons.forEach((sb, i) => sb.classList.toggle('on', [1, 2, 4, 8][i] === s));
  }));
  speedButtons[0].classList.add('on');

  // キャラを出す
  const r3 = section('キャラを出す(コスト・編成無視)');
  const allySel = document.createElement('select');
  ALLY_UNITS.forEach((d) => allySel.add(new Option(d.name, d.id)));
  r3.appendChild(allySel);
  button(r3, '味方を出す', (bt) => bt.debugSpawnAlly(ALLY_UNITS.find((d) => d.id === allySel.value)));
  const r3b = section('');
  const enemySel = document.createElement('select');
  Object.values(ENEMY_UNITS).forEach((d) => enemySel.add(new Option(`${d.boss ? '★' : ''}${d.name}`, d.id)));
  r3b.appendChild(enemySel);
  button(r3b, '敵を出す', (bt) => bt.spawnEnemy(enemySel.value));

  // 状況を操作
  const r4 = section('状況');
  button(r4, '必殺技を満タン', (bt) => { bt.special = 1; });
  button(r4, '敵を全滅', (bt) => bt.debugKillEnemies());
  button(r4, 'ボスを出す', (bt, b) => { if (!bt.debugTriggerBoss()) b.textContent = 'ボスなし/出現済み'; });
  button(r4, '城HP -50%', (bt) => { bt.castle.takeDamage(bt.castle.maxHp * 0.5, bt); });
  const r5 = section('勝敗');
  button(r5, '勝利', (bt) => bt.castle.takeDamage(1e9, bt));
  button(r5, '敗北', (bt) => { bt.debug.invincible = false; bt.life = 0; });
}
