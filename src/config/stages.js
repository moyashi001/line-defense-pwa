// ステージ定義
//   enemyMul : 敵ステータス倍率(難易度調整)
//   waves    : spawns の各グループは wave 開始から at 秒後に interval 秒おきに count 体出現
//   timeout  : 全員出現後、敵が残っていてもこの秒数を過ぎたら次のウェーブへ

export const STAGES = [
  {
    id: 1,
    name: 'はじまりの草原',
    desc: 'スライムとゴブリンが攻めてくる。まずは基本を覚えよう。',
    theme: { sky: ['#7ec8f2', '#d9f3ff'], ground: '#6fbf4a', groundDark: '#4e9a33', card: '#3f8f3a' },
    life: 10,
    startMoney: 150,
    enemyMul: { hp: 1, atk: 1, speed: 1 },
    waves: [
      { timeout: 30, spawns: [{ type: 'slime', count: 5, interval: 3, at: 1 }] },
      { timeout: 30, spawns: [{ type: 'slime', count: 4, interval: 2.5, at: 0 }, { type: 'goblin', count: 3, interval: 4, at: 4 }] },
      { timeout: 40, spawns: [{ type: 'goblin', count: 6, interval: 2, at: 0 }, { type: 'slime', count: 6, interval: 1.5, at: 3 }] },
    ],
  },
  {
    id: 2,
    name: '灼熱の砂漠',
    desc: 'タフなオークと遠くから撃つホネ弓兵が登場。',
    theme: { sky: ['#f7b267', '#fde2b8'], ground: '#e0b35a', groundDark: '#b8893a', card: '#b8742a' },
    life: 8,
    startMoney: 200,
    enemyMul: { hp: 1.6, atk: 1.4, speed: 1.15 },
    waves: [
      { timeout: 30, spawns: [{ type: 'goblin', count: 5, interval: 2, at: 1 }, { type: 'slime', count: 4, interval: 2, at: 2 }] },
      { timeout: 35, spawns: [{ type: 'orc', count: 1, interval: 1, at: 0 }, { type: 'slime', count: 6, interval: 1.5, at: 2 }] },
      { timeout: 40, spawns: [{ type: 'skeletonArcher', count: 3, interval: 4, at: 0 }, { type: 'goblin', count: 6, interval: 1.8, at: 1 }] },
      { timeout: 45, spawns: [{ type: 'orc', count: 2, interval: 8, at: 0 }, { type: 'skeletonArcher', count: 4, interval: 3, at: 3 }, { type: 'goblin', count: 8, interval: 1.2, at: 5 }] },
    ],
  },
  {
    id: 3,
    name: '魔王城',
    desc: '最後の戦い。ドラゴンが待ち受ける。',
    theme: { sky: ['#2a1a3d', '#6a3d6e'], ground: '#4a4458', groundDark: '#332d40', card: '#5a2d6e' },
    life: 6,
    startMoney: 250,
    enemyMul: { hp: 2.0, atk: 1.6, speed: 1.25 },
    waves: [
      { timeout: 30, spawns: [{ type: 'goblin', count: 8, interval: 1.2, at: 1 }] },
      { timeout: 40, spawns: [{ type: 'orc', count: 2, interval: 5, at: 0 }, { type: 'skeletonArcher', count: 4, interval: 2.5, at: 2 }] },
      { timeout: 40, spawns: [{ type: 'slime', count: 12, interval: 0.8, at: 0 }, { type: 'orc', count: 2, interval: 6, at: 3 }] },
      { timeout: 45, spawns: [{ type: 'skeletonArcher', count: 6, interval: 2, at: 0 }, { type: 'goblin', count: 10, interval: 1, at: 2 }, { type: 'orc', count: 3, interval: 5, at: 4 }] },
      { timeout: 90, boss: true, spawns: [{ type: 'dragon', count: 1, interval: 1, at: 2 }, { type: 'goblin', count: 8, interval: 3, at: 0 }, { type: 'skeletonArcher', count: 4, interval: 5, at: 6 }] },
    ],
  },
];
