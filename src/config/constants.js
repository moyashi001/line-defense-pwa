// ゲーム全体の定数
export const APP_VERSION = 'v0.3.0';

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
  x: 972,
  size: 56,
};

export const GAME = {
  maxDt: 0.05,          // 1フレームの最大経過時間(タブ復帰時の暴走防止)
  nextWaveDelay: 2.5,   // ウェーブ間のインターバル(秒)
  endDelay: 1.6,        // 勝敗決定から結果画面への遷移待ち(秒)
  knockbackSpeed: 150,
  knockbackTime: 0.35,
  allyCap: 15,          // 同時に出撃できる味方の上限
  bossWarningTime: 2.5, // ボス出現前の警告時間(秒)
};

// コスト: 時間経過で自動回復し、出撃時に消費する
export const COST = {
  max: 1000,   // 上限
  rate: 20,    // 1秒あたりの回復量
};
