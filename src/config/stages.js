// ステージ定義: 4ワールド × 5ステージ = 20ステージ
//
// ステージのデータは WORLDS から自動生成する。
//   pool     : そのワールドで出る敵。from = ワールド内の何面目(0始まり)から出るか
//              base = 1グループの基本数, interval = 出現間隔(秒)
//   boss     : 5面目で城のHPが 60% 以下になると出現
//   overrides: 特定ステージだけ値を上書きしたいとき { [ワールド内番号]: {...} }
//
// 生成後のステージの形:
//   castleHp / life / startMoney / enemyMul / waves / loopFrom / boss / castleSpawn
//   waves の各グループは wave 開始から at 秒後に interval 秒おきに count 体出現

export const STAGES_PER_WORLD = 5;

export const WORLDS = [
  {
    id: 1,
    name: '草原',
    theme: { bg: 'assets/bg/world1.jpg', sky: ['#7ec8f2', '#d9f3ff'], ground: '#6fbf4a', groundDark: '#4e9a33', card: '#3f8f3a' },
    life: 10,
    names: ['はじまりの草原', '風の丘', 'スライム沼', '小川の橋', '草原の主'],
    pool: [
      { type: 'slime', base: 4, interval: 2.2, from: 0 },
      { type: 'goblin', base: 3, interval: 2, from: 1 },
      { type: 'bigSlime', base: 1, interval: 5, from: 2 },
    ],
    boss: { type: 'giantSlime', escort: 'slime' },
  },
  {
    id: 2,
    name: '砂漠',
    theme: { bg: 'assets/bg/world2.jpg', ambient: 'sand', sky: ['#f7b267', '#fde2b8'], ground: '#e0b35a', groundDark: '#b8893a', card: '#b8742a' },
    life: 8,
    names: ['砂の入口', '灼熱の砂丘', 'オアシス', '骨の谷', 'オーク王の砦'],
    pool: [
      { type: 'goblin', base: 4, interval: 1.6, from: 0 },
      { type: 'orc', base: 1, interval: 6, from: 0 },
      { type: 'skeletonArcher', base: 2, interval: 3, from: 1 },
      { type: 'shieldbearer', base: 1, interval: 5, from: 2 },
    ],
    boss: { type: 'orcKing', escort: 'goblin' },
  },
  {
    id: 3,
    name: '水晶洞窟',
    theme: { bg: 'assets/bg/world3.jpg', ambient: 'sparkle', sky: ['#1d3b3a', '#2e5a55'], ground: '#3b4a4f', groundDark: '#263238', card: '#2e6b62' },
    life: 7,
    names: ['洞窟の入口', '水晶の回廊', '光る地底湖', 'コウモリの巣', '氷の巨人'],
    pool: [
      { type: 'bat', base: 3, interval: 2, from: 0 },
      { type: 'goblin', base: 4, interval: 1.4, from: 0 },
      { type: 'iceSprite', base: 2, interval: 3, from: 1 },
      { type: 'orc', base: 1, interval: 6, from: 2 },
      { type: 'skeletonArcher', base: 2, interval: 3, from: 3 },
    ],
    boss: { type: 'iceGiant', escort: 'bat' },
  },
  {
    id: 4,
    name: '魔王城',
    theme: { bg: 'assets/bg/world4.jpg', ambient: 'embers', sky: ['#2a1a3d', '#6a3d6e'], ground: '#4a4458', groundDark: '#332d40', card: '#5a2d6e' },
    life: 6,
    names: ['魔界の門', '闇の回廊', '呪いの広間', '竜の間', '魔王の玉座'],
    pool: [
      { type: 'shaman', base: 1, interval: 5, from: 0 },
      { type: 'shieldbearer', base: 2, interval: 4, from: 0 },
      { type: 'bat', base: 3, interval: 1.8, from: 0 },
      { type: 'bigSlime', base: 2, interval: 4, from: 1 },
      { type: 'iceSprite', base: 2, interval: 3, from: 2 },
      { type: 'orc', base: 2, interval: 5, from: 2 },
    ],
    castleSpawn: { type: 'goblin', interval: 10 }, // 城から定期的に増援
    boss: { type: 'demonLord', escort: 'shaman' },
    overrides: {
      3: { boss: { castleHpRatio: 0.6, spawns: [{ type: 'dragon', count: 1, interval: 1, at: 0 }, { type: 'goblin', count: 4, interval: 1.5, at: 1 }] } },
      4: { boss: { castleHpRatio: 0.6, spawns: [{ type: 'demonLord', count: 1, interval: 1, at: 0 }, { type: 'dragon', count: 1, interval: 1, at: 8 }, { type: 'shaman', count: 2, interval: 3, at: 2 }] } },
    },
  },
];

/** 通しステージ番号 n (1〜20) から難易度倍率を計算 */
function difficulty(n) {
  return {
    hp: 1 + 0.08 * (n - 1),
    atk: 1 + 0.05 * (n - 1),
    speed: 1 + 0.012 * (n - 1),
  };
}

/** ワールドの敵プールからウェーブを組み立てる(毎回同じ内容になる決定的な生成) */
function buildWaves(world, local) {
  const pool = world.pool.filter((p) => p.from <= local);
  const newest = pool.filter((p) => p.from === local);
  const waveCount = 3 + Math.floor(local / 2);
  const waves = [];
  for (let w = 0; w < waveCount; w++) {
    // メイン: プールを順番に使う。サブ: 新顔がいれば優先、いなければずらして選ぶ
    const len = pool.length;
    const main = pool[w % len];
    let sub = newest.length && w > 0 ? newest[w % newest.length] : null;
    if (!sub || sub === main) sub = len > 1 ? pool[(w % len + 1 + (local % (len - 1))) % len] : main;
    // 後半のウェーブほど数が増える。少数精鋭の敵(base が小さい)は増え方もゆるやか
    const grow = Math.floor((w + local) / 2);
    const count = (p, g) => p.base + Math.round(g * Math.max(0.35, p.base / 4));
    const spawns = [{ type: main.type, count: count(main, grow), interval: main.interval, at: 0 }];
    if (sub !== main) spawns.push({ type: sub.type, count: count(sub, grow / 2), interval: sub.interval, at: 3 });
    waves.push({ timeout: 26 + w * 2, spawns });
  }
  return waves;
}

function buildStage(world, local) {
  const n = (world.id - 1) * STAGES_PER_WORLD + local + 1;
  const isBossStage = local === STAGES_PER_WORLD - 1;
  const stage = {
    id: n,
    worldId: world.id,
    local,
    label: `${world.id}-${local + 1}`,
    name: world.names[local],
    theme: world.theme,
    life: world.life,
    castleHp: 2000 + 350 * (n - 1) + (isBossStage ? 1500 : 0),
    startMoney: 150 + 10 * n,
    enemyMul: difficulty(n),
    loopFrom: 1,
    waves: buildWaves(world, local),
    castleSpawn: world.castleSpawn ?? null,
    boss: isBossStage
      ? {
        castleHpRatio: 0.6,
        spawns: [
          { type: world.boss.type, count: 1, interval: 1, at: 0 },
          { type: world.boss.escort, count: 4, interval: 2, at: 1 },
        ],
      }
      : null,
  };
  return { ...stage, ...(world.overrides?.[local] ?? {}) };
}

export const STAGES = WORLDS.flatMap((world) =>
  Array.from({ length: STAGES_PER_WORLD }, (_, local) => buildStage(world, local)));

/** ステージの説明文(選択画面用): 新しく出てくる敵やボスを紹介 */
export function stageIntro(stage, enemyDefs) {
  const world = WORLDS.find((w) => w.id === stage.worldId);
  const fresh = world.pool.filter((p) => p.from === stage.local).map((p) => enemyDefs[p.type].name);
  const parts = [];
  if (fresh.length) parts.push(`新たな敵: ${fresh.join('・')}`);
  if (stage.boss) parts.push(`ボス: ${enemyDefs[stage.boss.spawns[0].type].name}`);
  if (stage.castleSpawn && stage.local === 0) parts.push('城から増援が出てくる');
  return parts.join(' / ') || '敵の城を壊せばクリア';
}
