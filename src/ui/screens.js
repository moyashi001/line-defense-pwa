// 画面切り替えと、タイトル/ステージ選択/結果画面のDOM処理
import { STAGES } from '../config/stages.js';
import { Progress } from '../core/storage.js';
import { formatTime } from '../core/loop.js';

const $ = (id) => document.getElementById(id);

export class ScreenManager {
  constructor() {
    this.current = null;
    this.handlers = {}; // name -> { enter?, leave? }
  }

  register(name, handler) {
    this.handlers[name] = handler;
  }

  show(name, params) {
    if (this.current) {
      this.handlers[this.current]?.leave?.();
      $(`screen-${this.current}`).classList.remove('active');
    }
    this.current = name;
    $(`screen-${name}`).classList.add('active');
    this.handlers[name]?.enter?.(params);
  }
}

/** ステージ選択カードを描画 */
export function renderStageList(onSelect) {
  const list = $('stage-list');
  list.innerHTML = '';
  for (const stage of STAGES) {
    const unlocked = Progress.isUnlocked(stage.id);
    const cleared = Progress.isCleared(stage.id);
    const best = Progress.bestTime(stage.id);

    const card = document.createElement('button');
    card.className = `stage-card${unlocked ? '' : ' locked'}${cleared ? ' cleared' : ''}`;
    card.style.background = `linear-gradient(160deg, ${stage.theme.card}, ${stage.theme.groundDark})`;
    card.disabled = !unlocked;
    card.innerHTML = `
      <div>
        <div class="stage-no">STAGE ${stage.id}</div>
        <div class="stage-name">${stage.name}</div>
      </div>
      <div class="stage-desc">${stage.desc}</div>
      <div class="stage-status">${cleared ? `★ クリア済み (ベスト ${formatTime(best)})` : unlocked ? `ウェーブ数 ${stage.waves.length}` : ''}</div>
      ${unlocked ? '' : '<div class="lock">🔒</div>'}
    `;
    if (unlocked) card.addEventListener('click', () => onSelect(stage));
    list.appendChild(card);
  }
}

/** 結果画面の表示内容を設定 */
export function renderResult(result, stage, hasNext) {
  const title = $('result-title');
  title.textContent = result.win ? 'STAGE CLEAR!' : 'GAME OVER';
  title.className = `result-title ${result.win ? 'win' : 'lose'}`;
  $('result-stage').textContent = `${stage.id}. ${stage.name}`;
  $('result-time').textContent = result.win ? formatTime(result.time) : '--:--';
  $('result-kills').textContent = `${result.kills} 体`;
  $('btn-next').style.display = result.win && hasNext ? '' : 'none';
}
