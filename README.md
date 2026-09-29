# ライン・ディフェンス (Line Defense PWA)

スマホ横画面向けの2Dラインディフェンスゲーム。ビルド不要の素の ES Modules + Canvas 構成。

## ローカル実行
```
python -m http.server 8759
```
http://localhost:8759 を開く（localhost では Service Worker を無効化し、`window.__debug` を公開）。

## 構成
| パス | 役割 |
|---|---|
| `src/config/units.js` | 味方・敵キャラの能力/見た目定義 |
| `src/config/stages.js` | 4ワールド×5ステージ。ワールドの敵プールからウェーブを自動生成、難易度はステージ番号から計算 |
| `src/config/constants.js` | ワールド座標・コスト・レベル/経験値・バージョン |
| `src/game/` | 戦闘ロジック（Battle / Unit / Projectile / Castle）。DOM非依存 |
| `src/render/Renderer.js` | 背景・拠点・エフェクトの Canvas 描画 |
| `src/render/sprites.js` | **キャラ描画（画像差し替えはここ）** |
| `src/ui/` | 画面遷移・HUD・出撃ボタン |
| `src/core/storage.js` | LocalStorage（クリア状況・経験値・キャラレベル・編成） |
| `src/ui/screens.js` | ステージ選択(ワールドタブ)・編成/強化・結果画面 |

## キャラ画像の差し替え
1. `assets/sprites/` に PNG を置く（右向き・足元が画像下端）
2. `units.js` の該当キャラに `sprite: 'assets/sprites/xxx.png'` を設定
3. `service-worker.js` の `ASSETS` に追加し、`VERSION` を上げる

未設定・読込失敗時は自動で図形プレースホルダーを描画します。

## 更新時の注意
アプリを更新したら `service-worker.js` の `VERSION` を必ず上げる。

## ステージの追加・調整
- ワールドを増やす: `stages.js` の `WORLDS` に追加（`pool` に出現する敵、`boss` にボス）
- 特定ステージだけ変える: ワールドの `overrides` にワールド内番号で上書き
- 難易度カーブ: `stages.js` の `difficulty(n)`

## デバッグモード
URL の末尾に `?debug=1` を付けて開く（公開版でも可）。例: `https://line-defense-pwa.vercel.app/?debug=1`
- 進行データは別枠に保存されるので、通常のセーブは変わらない
- 常にON: 全ステージ・キャラ・図鑑を解放 / EXP 10000以上 / 全キャラ Lv MAX / コスト常に1000・出撃の待ち時間なし
- 戦闘画面左上の 🐞: 自陣無敵・当たり判定表示・速度 x1〜x8・任意の味方/敵を出す・必殺技満タン・敵全滅・ボス出現・城HP-50%・即勝利/即敗北
