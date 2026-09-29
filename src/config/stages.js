// ステージ定義
//   castleHp : 敵の城のHP。城を壊すとクリア
//   enemyMul : 敵ステータス倍率(難易度調整)
//   waves    : spawns の各グループは wave 開始から at 秒後に interval 秒おきに count 体出現
//   timeout  : 全員出現後、敵が残っていてもこの秒数を過ぎたら次のウェーブへ
//   loopFrom : 最終ウェーブの後はこの番号(0始まり)のウェーブから繰り返す
//   boss     : 城のHPが castleHpRatio 以下になると警告のあと spawns が出現

export const STAGES = [
  {
    id: 1,
    name: 'はじまりの草原',
    desc: '敵の城を壊せばクリア。スライムとゴブリンが攻めてくる。',
    theme: { sky: ['#7ec8f2', '#d9f3ff'], ground: '#6fbf4a', groundDark: '#4e9a33', card: '#3f8f3a' },
    life: 10,
    castleHp: 2500,
    startMoney: 150,
    enemyMul: { hp: 1, atk: 1, speed: 1 },
    loopFrom: 1,
    waves: [
      { timeout: 25, spawns: [{ type: 'slime', count: 5, interval: 3, at: 1 }] },
      { timeout: 25, spawns: [{ type: 'slime', count: 5, interval: 2, at: 0 }, { type: 'goblin', count: 3, interval: 3, at: 3 }] },
      { timeout: 30, spawns: [{ type: 'goblin', count: 6, interval: 1.5, at: 0 }, { type: 'slime', count: 8, interval: 1.2, at: 2 }] },
    ],
  },
  {
    id: 2,
    name: '灼熱の砂漠',
    desc: '装甲の固いオークには範囲・遠距離攻撃が有効。ホネ弓兵は遠くから撃ってくる。',
    theme: { sky: ['#f7b267', '#fde2b8'], ground: '#e0b35a', groundDark: '#b8893a', card: '#b8742a' },
    life: 8,
    castleHp: 5000,
    startMoney: 200,
    enemyMul: { hp: 1.4, atk: 1.3, speed: 1.1 },
    loopFrom: 1,
    waves: [
      { timeout: 25, spawns: [{ type: 'goblin', count: 5, interval: 2, at: 1 }, { type: 'slime', count: 5, interval: 1.6, at: 2 }] },
      { timeout: 30, spawns: [{ type: 'orc', count: 2, interval: 6, at: 0 }, { type: 'slime', count: 8, interval: 1.2, at: 2 }] },
      { timeout: 30, spawns: [{ type: 'skeletonArcher', count: 4, interval: 3, at: 0 }, { type: 'goblin', count: 8, interval: 1.4, at: 1 }] },
      { timeout: 35, spawns: [{ type: 'orc', count: 3, interval: 6, at: 0 }, { type: 'skeletonArcher', count: 4, interval: 3, at: 3 }, { type: 'goblin', count: 8, interval: 1.2, at: 5 }] },
    ],
  },
  {
    id: 3,
    name: '魔王城',
    desc: '城にダメージを与えるとドラゴンが現れる。壁役と火力をそろえて挑もう。',
    theme: { sky: ['#2a1a3d', '#6a3d6e'], ground: '#4a4458', groundDark: '#332d40', card: '#5a2d6e' },
    life: 6,
    castleHp: 8000,
    startMoney: 300,
    enemyMul: { hp: 1.6, atk: 1.3, speed: 1.2 },
    loopFrom: 1,
    waves: [
      { timeout: 25, spawns: [{ type: 'goblin', count: 8, interval: 1.2, at: 1 }] },
      { timeout: 30, spawns: [{ type: 'orc', count: 2, interval: 5, at: 0 }, { type: 'skeletonArcher', count: 4, interval: 2.5, at: 2 }] },
      { timeout: 30, spawns: [{ type: 'slime', count: 12, interval: 0.8, at: 0 }, { type: 'orc', count: 2, interval: 6, at: 3 }] },
      { timeout: 35, spawns: [{ type: 'skeletonArcher', count: 5, interval: 2, at: 0 }, { type: 'goblin', count: 10, interval: 1, at: 2 }, { type: 'orc', count: 3, interval: 5, at: 4 }] },
    ],
    boss: {
      castleHpRatio: 0.6,
      spawns: [{ type: 'dragon', count: 1, interval: 1, at: 0 }, { type: 'goblin', count: 4, interval: 1.5, at: 1 }],
    },
  },
];
