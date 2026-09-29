// ゲーム全体の定数
export const APP_VERSION = 'v0.15.1';

// ワールド座標系: x は 0(自陣) 〜 WORLD.length(敵の城)。
// サイズや射程もこの単位。描画時に Renderer が画面サイズへ変換する。
export const WORLD = {
  length: 1000,
  refHeight: 240,     // この高さを基準にキャラサイズをスケール
  allyBaseX: 40,      // 自陣ライン(敵がここに到達するとライフ減少)
  enemyGateX: 980,    // 味方が進める右端
};

// 敵の城(これを壊すとステージクリア)
export const ENEMY_CASTLE = {
  x: 935,
  size: 100,  // 当たり判定の幅。前面(x - size/2)で味方が止まって攻撃する
};

export const GAME = {
  maxDt: 0.05,          // 1フレームの最大経過時間(タブ復帰時の暴走防止)
  nextWaveDelay: 2.5,   // ウェーブ間のインターバル(秒)
  endDelay: 2.6,        // 勝敗決定から結果画面への遷移待ち(秒)。城の崩壊・紙吹雪を見せる
  slowmoTime: 1.2,      // 城を壊した直後のスローモーション(秒)
  knockbackSpeed: 150,
  knockbackTime: 0.35,
  allyCap: 15,          // 同時に出撃できる味方の上限
  waveHoldEnemies: 6,   // 敵がこの数より多く残っている間は、時間切れでも次のウェーブを出さない
  bossWarningTime: 2.5, // ボス出現前の警告時間(秒)
};

// コスト: 時間経過で自動回復し、出撃時に消費する
// 試合の経過時間でレベルが自動で上がり、上限と回復速度が段階的に増える(最終的に上限1000)
// 子ども向けなので回復は早め
//   time: このレベルになる経過秒数 / max: 上限 / rate: 1秒あたりの回復量
export const COST = {
  levels: [
    { time: 0, max: 400, rate: 18 },
    { time: 20, max: 480, rate: 21 },
    { time: 40, max: 560, rate: 24 },
    { time: 60, max: 640, rate: 27 },
    { time: 85, max: 720, rate: 30 },
    { time: 110, max: 800, rate: 34 },
    { time: 140, max: 900, rate: 38 },
    { time: 170, max: 1000, rate: 42 },
  ],
  // 敵撃破時の報酬(units.js の reward)に掛ける倍率。全体の稼ぎやすさをまとめて調整する
  killRewardMul: 1,
};

/** 経過時間からコストレベル(0始まり)を求める */
export function costLevelAt(time) {
  let lv = 0;
  while (lv + 1 < COST.levels.length && time >= COST.levels[lv + 1].time) lv++;
  return lv;
}

// キャラのレベル(経験値で強化)
export const LEVEL = {
  max: 10,
  statMul: (lv) => 1 + 0.15 * (lv - 1),                         // HP・攻撃力の倍率
  upgradeCost: (def, lv) => Math.round((60 + def.cost * 0.4) * lv), // lv → lv+1 に必要な経験値
};

// ステージ報酬(経験値)
export const REWARD = {
  clear: (stageId) => 80 + 25 * stageId,
  firstClearMul: 2,   // 初クリアは倍
  loseRate: 0.25,     // 負けても城に与えたダメージ割合 × この率 の経験値
};
