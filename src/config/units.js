// キャラクター定義
//   shape / color / label : 画像がないときのプレースホルダー描画用
//   sprite                : 画像パス(例 'assets/sprites/soldier.png')。設定すると自動で画像描画に切り替わる
//   role                  : ボタンに表示する役割
//   attackType            : 'melee'(単体近接) | 'area'(範囲近接) | 'ranged'(飛び道具)
//   range                 : 相手との隙間がこの値以下なら攻撃
//   armor                 : 受けるダメージをこの値だけ軽減(最低1)。手数の多い弱攻撃が効きにくい
//   knockbacks            : HPが減る過程で何回ノックバックするか
//
// 相性の目安:
//   スライムの群れ   → ランサー(範囲) / キャノン(爆風)
//   ゴブリン(速い)   → ガードで止めてソルジャーで削る
//   オーク(装甲)     → ランサー / アーチャー / キャノン (ソルジャー・ガードはほぼ効かない)
//   ホネ弓兵(遠隔)   → 射程で勝るアーチャー、またはガードで受ける
//   ドラゴン(ボス)   → 壁役を並べてキャノン・アーチャーで削る

export const ALLY_UNITS = [
  {
    id: 'soldier', name: 'ソルジャー', role: '近接', label: '剣', shape: 'circle', color: '#4fc3f7',
    sprite: null,
    size: 24, hp: 110, atk: 16, range: 8, speed: 50, attackInterval: 0.9,
    attackType: 'melee', cost: 50, cooldown: 3,
  },
  {
    id: 'guard', name: 'ガード', role: '壁', label: '盾', shape: 'square', color: '#81c784',
    sprite: null,
    size: 30, hp: 600, atk: 5, range: 6, speed: 30, attackInterval: 1.4, armor: 6,
    attackType: 'melee', cost: 100, cooldown: 6, knockbacks: 3,
  },
  {
    id: 'archer', name: 'アーチャー', role: '遠距離', label: '弓', shape: 'triangle', color: '#ffb74d',
    sprite: null,
    size: 24, hp: 70, atk: 26, range: 170, speed: 40, attackInterval: 1.3,
    attackType: 'ranged', projectileSpeed: 420, projectileColor: '#fff3b0',
    cost: 150, cooldown: 4,
  },
  {
    id: 'lancer', name: 'ランサー', role: '範囲', label: '槍', shape: 'diamond', color: '#ba68c8',
    sprite: null,
    size: 28, hp: 220, atk: 34, range: 45, speed: 42, attackInterval: 1.6,
    attackType: 'area', cost: 220, cooldown: 7,
  },
  {
    id: 'cannon', name: 'キャノン', role: '砲撃', label: '砲', shape: 'hex', color: '#e57373',
    sprite: null,
    size: 34, hp: 260, atk: 100, range: 280, speed: 22, attackInterval: 3.2,
    attackType: 'ranged', projectileSpeed: 320, projectileColor: '#333', splash: 60,
    cost: 450, cooldown: 15,
  },
];

// 敵定義 (baseDamage: 自陣到達時のライフ減少量 / reward: 撃破時に得るコスト / boss: ボス演出対象)
export const ENEMY_UNITS = {
  slime: {
    name: 'スライム', label: 'ス', shape: 'blob', color: '#9ccc65',
    size: 22, hp: 60, atk: 8, range: 6, speed: 34, attackInterval: 1.0,
    attackType: 'melee', baseDamage: 1, reward: 15,
  },
  goblin: {
    name: 'ゴブリン', label: 'ゴ', shape: 'triangle', color: '#8d6e63',
    size: 22, hp: 55, atk: 11, range: 6, speed: 72, attackInterval: 0.8,
    attackType: 'melee', baseDamage: 1, reward: 20,
  },
  orc: {
    name: 'オーク', label: 'オ', shape: 'square', color: '#607d8b',
    size: 34, hp: 380, atk: 26, range: 8, speed: 24, attackInterval: 1.5, armor: 12,
    attackType: 'melee', baseDamage: 2, reward: 60, knockbacks: 2,
  },
  skeletonArcher: {
    name: 'ホネ弓兵', label: '骨', shape: 'diamond', color: '#e0e0e0',
    size: 24, hp: 80, atk: 15, range: 150, speed: 32, attackInterval: 1.5,
    attackType: 'ranged', projectileSpeed: 380, projectileColor: '#ddd',
    baseDamage: 1, reward: 40,
  },
  dragon: {
    name: 'ドラゴン', label: '竜', shape: 'hex', color: '#d32f2f', boss: true,
    size: 64, hp: 2600, atk: 55, range: 55, speed: 16, attackInterval: 2.2, armor: 8,
    attackType: 'area', baseDamage: 5, reward: 400, knockbacks: 4,
  },
};

// id を定義に埋め込んでおく(画像キャッシュのキーに使う)
for (const [id, def] of Object.entries(ENEMY_UNITS)) def.id = id;
