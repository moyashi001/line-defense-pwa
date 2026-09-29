// 画面切り替えと、ステージ選択/編成・強化/結果画面のDOM処理
import { STAGES, WORLDS, stageIntro } from '../config/stages.js';
import { ALLY_UNITS, ENEMY_UNITS, DECK_SIZE } from '../config/units.js';
import { LEVEL } from '../config/constants.js';
import { Progress } from '../core/storage.js';
import { formatTime } from '../core/loop.js';
import { drawUnitIcon } from '../render/sprites.js';

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

// ---------- ワールド選択 ----------
const worldStages = (worldId) => STAGES.filter((s) => s.worldId === worldId);

function cardBackground(theme) {
  return theme.bg
    ? `linear-gradient(160deg, ${theme.card}cc, #000a), center / cover url(${theme.bg})`
    : `linear-gradient(160deg, ${theme.card}, ${theme.groundDark})`;
}

/** ワールド一覧を描画。onPick(worldId) */
export function renderWorldList(onPick) {
  $('xp-world').textContent = `EXP ${Progress.xp}`;
  const list = $('world-list');
  list.innerHTML = '';
  for (const world of WORLDS) {
    const stages = worldStages(world.id);
    const unlocked = Progress.isUnlocked(stages[0].id);
    const clearedCount = stages.filter((s) => Progress.isCleared(s.id)).length;
    const complete = clearedCount === stages.length;
    const card = document.createElement('button');
    card.className = `stage-card world-card${unlocked ? '' : ' locked'}${complete ? ' cleared' : ''}`;
    card.style.background = cardBackground(world.theme);
    card.disabled = !unlocked;
    const need = STAGES[stages[0].id - 2];
    card.innerHTML = `
      <div>
        <div class="stage-no">WORLD ${world.id}</div>
        <div class="stage-name">${world.name}</div>
      </div>
      <div class="stage-desc">ボス: ${ENEMY_UNITS[world.boss.type].name}</div>
      <div class="stage-status">${complete ? '★ ' : ''}クリア ${clearedCount} / ${stages.length}</div>
      ${unlocked ? '' : `<div class="lock">🔒<small>${need ? `${need.label} クリアで解放` : ''}</small></div>`}
    `;
    if (unlocked) card.addEventListener('click', () => onPick(world.id));
    list.appendChild(card);
  }
}

/** 一番先に進めるワールド */
export function latestWorldId() {
  return STAGES[Progress.latestUnlocked(STAGES.length) - 1].worldId;
}

// ---------- ステージ選択(ワールド内) ----------
/** ワールド内のステージカードを描画 */
export function renderStageList(worldId, onSelect) {
  const world = WORLDS.find((w) => w.id === worldId);
  $('select-title').textContent = `WORLD ${world.id}  ${world.name}`;
  $('xp-select').textContent = `EXP ${Progress.xp}`;

  const list = $('stage-list');
  list.innerHTML = '';
  for (const stage of worldStages(worldId)) {
    const unlocked = Progress.isUnlocked(stage.id);
    const cleared = Progress.isCleared(stage.id);
    const best = Progress.bestTime(stage.id);

    const card = document.createElement('button');
    card.className = `stage-card${unlocked ? '' : ' locked'}${cleared ? ' cleared' : ''}${stage.boss ? ' boss' : ''}`;
    card.style.background = cardBackground(stage.theme);
    card.disabled = !unlocked;
    card.innerHTML = `
      <div>
        <div class="stage-no">STAGE ${stage.label}${stage.boss ? ' 👑' : ''}</div>
        <div class="stage-name">${stage.name}</div>
      </div>
      <div class="stage-desc">${stageIntro(stage, ENEMY_UNITS)}</div>
      <div class="stage-status">${cleared ? `★ クリア ${formatTime(best)}` : unlocked ? '未クリア' : ''}</div>
      ${unlocked ? '' : '<div class="lock">🔒</div>'}
    `;
    if (unlocked) card.addEventListener('click', () => onSelect(stage));
    list.appendChild(card);
  }
}

// ---------- 編成・強化 ----------
/** 編成・強化画面を描画 */
export function renderTeam() {
  $('xp-team').textContent = `EXP ${Progress.xp}`;
  const deck = Progress.deck();
  $('deck-count').textContent = `編成 ${deck.length}/${DECK_SIZE}`;

  const grid = $('team-grid');
  grid.innerHTML = '';
  for (const def of ALLY_UNITS) {
    const unlocked = Progress.isUnitUnlocked(def.id);
    const inDeck = deck.includes(def.id);
    const lv = Progress.level(def.id);
    const cost = Progress.upgradeCost(def.id);
    const m = LEVEL.statMul(lv);

    const card = document.createElement('div');
    card.className = `team-card${inDeck ? ' in-deck' : ''}${unlocked ? '' : ' locked'}`;
    if (!unlocked) {
      const need = STAGES.find((s) => s.id === def.unlockAfter);
      card.innerHTML = `<div class="team-lock">🔒<br>${need.label} クリアで解放</div>`;
      grid.appendChild(card);
      continue;
    }
    card.innerHTML = `
      <div class="team-head">
        <canvas class="team-icon"></canvas>
        <div>
          <div class="team-name">${def.name} <span class="team-role">${def.role}</span></div>
          <div class="team-lv">Lv ${lv}${lv >= LEVEL.max ? ' (MAX)' : ''}</div>
        </div>
      </div>
      <div class="team-stats">
        <span>HP ${Math.round(def.hp * m)}</span><span>攻撃 ${Math.round(def.atk * m)}</span>
        <span>射程 ${def.range}</span><span>コスト ${def.cost}</span>
      </div>
      <div class="team-actions">
        <button class="btn btn-sm team-toggle">${inDeck ? '外す' : '編成する'}</button>
        <button class="btn btn-sm btn-primary team-up" ${cost == null || Progress.xp < cost ? 'disabled' : ''}>
          ${cost == null ? 'MAX' : `強化 ${cost}`}
        </button>
      </div>
    `;
    card.querySelector('.team-toggle').addEventListener('click', () => {
      if (!Progress.toggleDeck(def.id)) {
        flashMessage(inDeck ? '最低1体は編成してください' : `編成は${DECK_SIZE}体までです`);
      }
      renderTeam();
    });
    card.querySelector('.team-up').addEventListener('click', () => {
      if (Progress.upgrade(def.id)) renderTeam();
    });
    grid.appendChild(card);
    requestAnimationFrame(() => drawUnitIcon(card.querySelector('.team-icon'), def));
  }
}

function flashMessage(text) {
  const el = $('team-message');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(flashMessage.timer);
  flashMessage.timer = setTimeout(() => el.classList.remove('show'), 1600);
}

// ---------- 結果 ----------
/**
 * 結果画面の表示内容を設定
 * @param {{win:boolean,time:number,kills:number}} result
 * @param {object} stage
 * @param {{hasNext:boolean, xp:number, unlocked:object[]}} info
 */
export function renderResult(result, stage, info) {
  const title = $('result-title');
  title.textContent = result.win ? 'STAGE CLEAR!' : 'GAME OVER';
  title.className = `result-title ${result.win ? 'win' : 'lose'}`;
  $('result-stage').textContent = `${stage.label} ${stage.name}`;
  $('result-time').textContent = result.win ? formatTime(result.time) : '--:--';
  $('result-kills').textContent = `${result.kills} 体`;
  $('result-xp').textContent = `+${info.xp}`;
  const unlock = $('result-unlock');
  unlock.textContent = info.unlocked.length ? `新しい仲間: ${info.unlocked.map((d) => d.name).join('・')}！ (編成画面で追加できます)` : '';
  unlock.style.display = info.unlocked.length ? '' : 'none';
  $('btn-next').style.display = result.win && info.hasNext ? '' : 'none';
}

/** ステージクリアで新しく解放される味方 */
export function unitsUnlockedBy(stageId) {
  return ALLY_UNITS.filter((u) => u.unlockAfter === stageId);
}
