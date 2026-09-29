// キャラクター定義
//   shape / color / label : 画像がないときのプレースホルダー描画用
//   sprite                : 画像パス(例 'assets/sprites/soldier.png')。設定すると自動で画像描画に切り替わる
//                           右向き・足元が画像の下端・背景透過の PNG
//   spriteScale           : 画像の表示高さ = size × この倍率(当たり判定より大きく見せる。既定 1.6)
//   spriteFacing          : 画像の向き 'right'(既定) | 'left'。進行方向に合わせて自動で反転する
//   role                  : ボタン・編成画面に表示する役割
//   attackType            : 'melee'(単体近接) | 'area'(範囲近接) | 'ranged'(飛び道具)
//   range                 : 相手との隙間がこの値以下なら攻撃
//   armor                 : 受けるダメージをこの値だけ軽減(最低1)
//   pierce                : 攻撃が装甲を無視する
//   slowOnHit             : 攻撃した相手を遅くする { factor, duration }
//   flying                : 飛行。近接攻撃(飛行ユニット以外)では狙えない
//   heal                  : 周囲の味方を定期回復 { amount, radius, interval }
//   splitInto             : 倒されると分裂 { type, count }
//   summon                : 定期的に仲間を呼ぶ { type, count, interval }
//   projectileStyle       : 飛び道具の見た目 'laser'(即着弾の光線) | 'shell'(砲弾: 発射時に砲口が光る)
//   attackFx              : 範囲攻撃の見た目 'swing'(振り回す弧) | 'thrust'(突き)。未指定は衝撃の輪
//   knockbacks            : HPが減る過程で何回ノックバックするか
//   unlockAfter           : このステージIDをクリアすると解放(味方のみ。未指定は最初から)
//
// 相性の目安:
//   スライムの群れ / 分裂 → ランサー(範囲) / キャノン(爆風)
//   ビースト・盾兵(装甲)  → メイジ(装甲無視) / キャノン / ランサー
//   コウモリ(飛行)        → レーザー / メイジ / キャノン / ウィング
//   エイリアン兵・シャーマン → 射程で勝るレーザー・メイジ・キャノン、ガードで受ける
//   ボス                  → 壁役を並べて遠距離で削る。ヒーラーで壁を長持ちさせる

export const ALLY_UNITS = [
  {
    id: 'soldier', name: 'ソルジャー', role: '近接', label: '剣', shape: 'circle', color: '#4fc3f7',
    sprite: 'assets/sprites/soldier.png', spriteScale: 1.9,
    size: 24, hp: 110, atk: 16, range: 8, speed: 50, attackInterval: 0.9,
    attackType: 'melee', cost: 50, cooldown: 3,
  },
  {
    id: 'guard', name: 'ガード', role: '壁', label: '盾', shape: 'square', color: '#81c784',
    sprite: 'assets/sprites/guard.png', spriteScale: 1.5,
    size: 30, hp: 600, atk: 5, range: 6, speed: 30, attackInterval: 1.4, armor: 6,
    attackType: 'melee', cost: 100, cooldown: 6, knockbacks: 3,
  },
  {
    id: 'archer', name: 'レーザー', role: '遠距離', label: '光', shape: 'triangle', color: '#ffb74d',
    sprite: 'assets/sprites/archer.png', spriteScale: 1.9,
    size: 24, hp: 70, atk: 26, range: 170, speed: 40, attackInterval: 1.3,
    attackType: 'ranged', projectileStyle: 'laser', projectileColor: '#7dffb0',
    cost: 150, cooldown: 4,
  },
  {
    id: 'lancer', name: 'ランサー', role: '範囲', label: '槍', shape: 'diamond', color: '#ba68c8',
    sprite: 'assets/sprites/lancer.png', spriteScale: 1.7,
    size: 28, hp: 220, atk: 34, range: 45, speed: 42, attackInterval: 1.6,
    attackType: 'area', attackFx: 'thrust', cost: 220, cooldown: 7,
  },
  {
    id: 'cannon', name: 'キャノン', role: '砲撃', label: '砲', shape: 'hex', color: '#e57373',
    sprite: 'assets/sprites/cannon.png', spriteScale: 1.6,
    size: 34, hp: 260, atk: 100, range: 280, speed: 22, attackInterval: 3.2,
    attackType: 'ranged', projectileStyle: 'shell', projectileSpeed: 320, projectileColor: '#333', splash: 60,
    cost: 450, cooldown: 15,
  },
  {
    id: 'mage', name: 'メイジ', role: '魔法', label: '魔', shape: 'star', color: '#9575cd',
    sprite: 'assets/sprites/mage.png', spriteScale: 1.8,
    size: 26, hp: 90, atk: 30, range: 200, speed: 36, attackInterval: 1.8,
    attackType: 'ranged', projectileSpeed: 360, projectileColor: '#b388ff',
    pierce: true, slowOnHit: { factor: 0.5, duration: 2 },
    cost: 250, cooldown: 8, unlockAfter: 5,
  },
  {
    id: 'healer', name: 'ヒーラー', role: '回復', label: '癒', shape: 'circle', color: '#f8bbd0',
    sprite: 'assets/sprites/healer.png', spriteScale: 1.9,
    size: 24, hp: 120, atk: 6, range: 130, speed: 36, attackInterval: 1.5,
    attackType: 'ranged', projectileSpeed: 380, projectileColor: '#fff',
    heal: { amount: 45, radius: 150, interval: 3 },
    cost: 200, cooldown: 12, unlockAfter: 8,
  },
  {
    id: 'wing', name: 'ウィング', role: '飛行', label: '翼', shape: 'triangle', color: '#4dd0e1',
    sprite: 'assets/sprites/wing.png', spriteScale: 1.9,
    size: 24, hp: 160, atk: 24, range: 10, speed: 70, attackInterval: 0.9,
    attackType: 'melee', flying: true,
    cost: 180, cooldown: 6, unlockAfter: 10,
  },
  {
    id: 'knight', name: 'ナイト', role: '重装', label: '騎', shape: 'square', color: '#ffd54f',
    sprite: 'assets/sprites/knight.png', spriteScale: 1.5,
    size: 38, hp: 1400, atk: 60, range: 14, speed: 28, attackInterval: 1.5, armor: 12,
    attackType: 'area', attackFx: 'swing', knockbacks: 2,
    cost: 600, cooldown: 25, unlockAfter: 15,
  },
];

export const DEFAULT_DECK = ['soldier', 'guard', 'archer', 'lancer', 'cannon'];
export const DECK_SIZE = 5;

// 敵定義 (baseDamage: 自陣到達時のライフ減少量 / reward: 撃破時に得るコスト / boss: ボス演出対象)
export const ENEMY_UNITS = {
  slime: {
    name: 'スライム', label: 'ス', shape: 'blob', color: '#9ccc65',
    sprite: 'assets/sprites/slime.png', spriteFacing: 'left', spriteScale: 1.5,
    size: 22, hp: 60, atk: 8, range: 6, speed: 34, attackInterval: 1.0,
    attackType: 'melee', baseDamage: 1, reward: 15,
  },
  bigSlime: {
    name: 'デカスライム', label: 'デ', shape: 'blob', color: '#7cb342',
    sprite: 'assets/sprites/slime.png', spriteFacing: 'left', spriteScale: 1.5,
    size: 34, hp: 220, atk: 14, range: 6, speed: 26, attackInterval: 1.2,
    attackType: 'melee', baseDamage: 2, reward: 30, splitInto: { type: 'slime', count: 2 },
  },
  goblin: {
    name: 'ゴブリン', label: 'ゴ', shape: 'triangle', color: '#8d6e63',
    sprite: 'assets/sprites/goblin.png', spriteFacing: 'left', spriteScale: 1.9,
    size: 22, hp: 55, atk: 11, range: 6, speed: 72, attackInterval: 0.8,
    attackType: 'melee', baseDamage: 1, reward: 20,
  },
  orc: {
    name: 'ビースト', label: 'ビ', shape: 'square', color: '#607d8b',
    sprite: 'assets/sprites/orc.png', spriteScale: 1.5,
    size: 34, hp: 380, atk: 26, range: 8, speed: 24, attackInterval: 1.5, armor: 12,
    attackType: 'melee', baseDamage: 2, reward: 60, knockbacks: 2,
  },
  shieldbearer: {
    name: '盾兵', label: '盾', shape: 'square', color: '#90a4ae',
    sprite: 'assets/sprites/shieldbearer.png', spriteFacing: 'left', spriteScale: 1.7,
    size: 30, hp: 260, atk: 14, range: 6, speed: 26, attackInterval: 1.3, armor: 22,
    attackType: 'melee', baseDamage: 2, reward: 50,
  },
  skeletonArcher: {
    name: 'エイリアン兵', label: '銃', shape: 'diamond', color: '#e0e0e0',
    sprite: 'assets/sprites/skeletonArcher.png', spriteScale: 1.9,
    size: 24, hp: 80, atk: 15, range: 150, speed: 32, attackInterval: 1.5,
    attackType: 'ranged', projectileSpeed: 380, projectileColor: '#e040fb',
    baseDamage: 1, reward: 40,
  },
  bat: {
    name: 'コウモリ', label: '蝠', shape: 'triangle', color: '#5e35b1',
    sprite: 'assets/sprites/bat.png', spriteScale: 1.6,
    size: 22, hp: 70, atk: 12, range: 6, speed: 62, attackInterval: 0.9, flying: true,
    attackType: 'melee', baseDamage: 1, reward: 30,
  },
  iceSprite: {
    name: 'アイス精', label: '氷', shape: 'diamond', color: '#81d4fa',
    sprite: 'assets/sprites/iceSprite.png', spriteScale: 1.8,
    size: 24, hp: 120, atk: 12, range: 110, speed: 34, attackInterval: 1.6,
    attackType: 'ranged', projectileSpeed: 340, projectileColor: '#e1f5fe',
    slowOnHit: { factor: 0.5, duration: 2.5 },
    baseDamage: 1, reward: 40,
  },
  shaman: {
    name: 'シャーマン', label: '呪', shape: 'star', color: '#ab47bc',
    sprite: 'assets/sprites/shaman.png', spriteScale: 1.9,
    size: 26, hp: 150, atk: 8, range: 120, speed: 30, attackInterval: 1.6,
    attackType: 'ranged', projectileSpeed: 340, projectileColor: '#ce93d8',
    heal: { amount: 30, radius: 120, interval: 4 },
    baseDamage: 1, reward: 60,
  },

  // ---------- ボス ----------
  giantSlime: {
    name: 'キングスライム', label: '王', shape: 'blob', color: '#558b2f', boss: true,
    sprite: 'assets/sprites/giantSlime.png', spriteScale: 1.2,
    size: 72, hp: 1800, atk: 30, range: 30, speed: 16, attackInterval: 2,
    attackType: 'area', baseDamage: 5, reward: 300, knockbacks: 3,
    splitInto: { type: 'bigSlime', count: 3 },
  },
  orcKing: {
    name: 'オーク王', label: '王', shape: 'square', color: '#37474f', boss: true,
    sprite: 'assets/sprites/orcKing.png', spriteFacing: 'left', spriteScale: 1.4,
    size: 64, hp: 3000, atk: 60, range: 14, speed: 18, attackInterval: 1.8, armor: 20,
    attackType: 'area', baseDamage: 5, reward: 350, knockbacks: 3,
  },
  iceGiant: {
    name: '氷の巨人', label: '巨', shape: 'hex', color: '#4fc3f7', boss: true,
    sprite: 'assets/sprites/iceGiant.png', spriteScale: 1.35,
    size: 70, hp: 3600, atk: 50, range: 40, speed: 15, attackInterval: 2.2, armor: 10,
    attackType: 'area', slowOnHit: { factor: 0.5, duration: 3 },
    baseDamage: 5, reward: 400, knockbacks: 4,
  },
  dragon: {
    name: 'ドラゴン', label: '竜', shape: 'hex', color: '#d32f2f', boss: true,
    sprite: 'assets/sprites/dragon.png', spriteScale: 1.4,
    size: 64, hp: 2600, atk: 55, range: 55, speed: 16, attackInterval: 2.2, armor: 8,
    attackType: 'area', baseDamage: 5, reward: 400, knockbacks: 4,
  },
  demonLord: {
    name: '魔王', label: '魔', shape: 'star', color: '#6a1b9a', boss: true,
    sprite: 'assets/sprites/demonLord.png', spriteScale: 1.35,
    size: 70, hp: 5000, atk: 70, range: 220, speed: 12, attackInterval: 2.6, armor: 15,
    attackType: 'ranged', projectileSpeed: 300, projectileColor: '#e040fb', splash: 60,
    summon: { type: 'bat', count: 2, interval: 12 },
    baseDamage: 10, reward: 800, knockbacks: 4,
  },
};

// id を定義に埋め込んでおく(画像キャッシュのキーに使う)
for (const [id, def] of Object.entries(ENEMY_UNITS)) def.id = id;

export const allyById = (id) => ALLY_UNITS.find((u) => u.id === id);
