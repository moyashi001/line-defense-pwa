// エントリーポイント: 画面遷移と戦闘の組み立て
import { APP_VERSION } from './config/constants.js';
import { STAGES } from './config/stages.js';
import { ALLY_UNITS, ENEMY_UNITS } from './config/units.js';
import { Progress } from './core/storage.js';
import { GameLoop } from './core/loop.js';
import { Battle } from './game/Battle.js';
import { Renderer } from './render/Renderer.js';
import { preloadSprites } from './render/sprites.js';
import { ScreenManager, renderStageList, renderResult } from './ui/screens.js';
import { BattleUI } from './ui/battleUI.js';

const $ = (id) => document.getElementById(id);

preloadSprites([...ALLY_UNITS, ...Object.values(ENEMY_UNITS)]);

const screens = new ScreenManager();
const renderer = new Renderer($('battle-canvas'));

let battle = null;
let currentStage = null;
let paused = false;

const ui = new BattleUI({
  onSpawn: (i) => { if (battle && !paused) battle.spawnAlly(i); },
  onUpgrade: () => { if (battle && !paused) battle.upgradeWallet(); },
});

const loop = new GameLoop((dt) => {
  if (!battle) return;
  if (!paused) battle.update(dt);
  renderer.render(battle);
  ui.update(battle);
});

// ---------- 戦闘の開始/終了 ----------
function startBattle(stage) {
  currentStage = stage;
  screens.show('battle');
}

function onBattleEvent(type, payload) {
  switch (type) {
    case 'wave':
      ui.showBanner(payload.boss ? '⚠ BOSS WAVE ⚠' : `WAVE ${payload.index + 1}`, payload.boss ? '#ff6b6b' : '#fff');
      break;
    case 'end':
      ui.showBanner(payload.win ? 'CLEAR!' : 'DEFEAT...', payload.win ? '#ffcf3f' : '#ff6b6b', 0);
      break;
  }
}

function onBattleEnd(result) {
  if (result.win) Progress.markCleared(currentStage.id, result.time);
  const idx = STAGES.indexOf(currentStage);
  renderResult(result, currentStage, idx < STAGES.length - 1);
  screens.show('result');
}

function setPaused(value) {
  paused = value;
  $('pause-overlay').classList.toggle('show', paused);
}

// ---------- 画面ごとの処理 ----------
screens.register('title', {});

screens.register('select', {
  enter: () => renderStageList(startBattle),
});

screens.register('battle', {
  enter: () => {
    setPaused(false);
    ui.reset();
    battle = new Battle(currentStage, { onEvent: onBattleEvent, onEnd: onBattleEnd });
    // レイアウト確定後にサイズを取る
    requestAnimationFrame(() => {
      renderer.resize();
      ui.drawIcons();
    });
    loop.start();
  },
  leave: () => {
    loop.stop();
    battle = null;
    setPaused(false);
  },
});

screens.register('result', {});

// ---------- ボタン ----------
$('btn-start').addEventListener('click', async () => {
  await tryLandscapeFullscreen();
  screens.show('select');
});
$('btn-select-back').addEventListener('click', () => screens.show('title'));
$('btn-reset').addEventListener('click', () => {
  if (confirm('クリア状況をすべて消去しますか？')) {
    Progress.reset();
    renderStageList(startBattle);
  }
});
$('btn-pause').addEventListener('click', () => { if (battle && !battle.isOver) setPaused(true); });
$('btn-resume').addEventListener('click', () => setPaused(false));
$('btn-retire').addEventListener('click', () => screens.show('select'));
$('btn-retry').addEventListener('click', () => startBattle(currentStage));
$('btn-to-select').addEventListener('click', () => screens.show('select'));
$('btn-next').addEventListener('click', () => {
  const next = STAGES[STAGES.indexOf(currentStage) + 1];
  if (next) startBattle(next);
});

// タブ切り替え・アプリ離脱時は自動ポーズ
document.addEventListener('visibilitychange', () => {
  if (document.hidden && battle && !battle.isOver) setPaused(true);
});

// スマホではフルスクリーン+横向き固定を試みる(非対応環境は無視)
async function tryLandscapeFullscreen() {
  if (!matchMedia('(pointer: coarse)').matches) return;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    await screen.orientation?.lock?.('landscape');
  } catch {
    /* iOS Safari などは非対応 */
  }
}

// ---------- 開発用デバッグフック(localhostのみ) ----------
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.__debug = {
    get battle() { return battle; },
    step(sec, dt = 1 / 60) { for (let t = 0; t < sec && battle; t += dt) battle.update(dt); if (battle) { renderer.render(battle); ui.update(battle); } },
    renderer, ui, screens,
  };
}

// ---------- 起動 ----------
$('app-version').textContent = APP_VERSION;
screens.show('title');

// localhost では開発中のキャッシュ混乱を避けるため Service Worker を使わない
if ('serviceWorker' in navigator && window.__debug) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  caches?.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
