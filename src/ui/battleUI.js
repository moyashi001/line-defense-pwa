// 戦闘画面のHUD(上部)とデッキ(下部ボタン)
import { ALLY_UNITS } from '../config/units.js';
import { formatTime } from '../core/loop.js';
import { drawUnitIcon } from '../render/sprites.js';

const $ = (id) => document.getElementById(id);

export class BattleUI {
  /**
   * @param {{ onSpawn:(i:number)=>void }} actions
   */
  constructor(actions) {
    this.actions = actions;
    this.el = {
      life: $('hud-life'),
      stage: $('hud-stage'),
      wave: $('hud-wave'),
      time: $('hud-time'),
      moneyFill: $('money-fill'),
      moneyText: $('hud-money'),
      costNow: $('cost-now'),
      banner: $('battle-banner'),
    };
    this.buttons = [];
    this.cache = {}; // DOM更新を最小限にするための前回値
    this.buildDeck();
  }

  buildDeck() {
    const wrap = $('unit-buttons');
    wrap.innerHTML = '';
    this.buttons = ALLY_UNITS.map((def, i) => {
      const btn = document.createElement('button');
      btn.className = 'unit-btn';
      btn.innerHTML = `<canvas></canvas><span class="name">${def.name}</span><span class="cost">${def.cost}</span><div class="cd"></div>`;
      // タップ反応を速くするため pointerdown を使う
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.actions.onSpawn(i);
      });
      wrap.appendChild(btn);
      return { btn, canvas: btn.querySelector('canvas'), cd: btn.querySelector('.cd'), def };
    });
  }

  /** 画面表示後(サイズ確定後)にアイコンを描く */
  drawIcons() {
    for (const b of this.buttons) drawUnitIcon(b.canvas, b.def);
  }

  reset() {
    this.cache = {};
    this.hideBanner();
  }

  setText(key, el, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el.textContent = value;
  }

  update(battle) {
    const { el } = this;
    this.setText('life', el.life, '♥'.repeat(battle.life) + '♡'.repeat(battle.maxLife - battle.life));
    this.setText('stage', el.stage, `STAGE ${battle.stage.id}`);
    this.setText('wave', el.wave, `WAVE ${Math.min(battle.waveIndex + 1, battle.totalWaves)}/${battle.totalWaves}`);
    this.setText('time', el.time, formatTime(battle.time));

    const money = Math.floor(battle.money);
    this.setText('money', el.moneyText, `${money} / ${battle.costMax}`);
    el.moneyFill.style.width = `${(battle.money / battle.costMax) * 100}%`;

    this.setText('costNow', el.costNow, String(money));

    this.buttons.forEach((b, i) => {
      const cd = battle.allyCooldowns[i];
      b.cd.style.height = `${(cd / b.def.cooldown) * 100}%`;
      b.btn.classList.toggle('disabled', !battle.canSpawnAlly(i));
    });
  }

  showBanner(text, color = '#fff', duration = 1500) {
    const { banner } = this.el;
    banner.textContent = text;
    banner.style.color = color;
    banner.classList.add('show');
    clearTimeout(this._bannerTimer);
    if (duration > 0) this._bannerTimer = setTimeout(() => this.hideBanner(), duration);
  }

  hideBanner() {
    clearTimeout(this._bannerTimer);
    this.el.banner.classList.remove('show');
  }
}
