// 戦闘画面のHUD(上部)とデッキ(下部ボタン)
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
      costLevel: $('cost-level'),
      costLvFill: $('cost-lv-fill'),
      allyCount: $('ally-count'),
      banner: $('battle-banner'),
    };
    this.buttons = [];
    this.cache = {}; // DOM更新を最小限にするための前回値
  }

  /** 出撃ボタンを編成に合わせて作り直す */
  buildDeck(deck) {
    const wrap = $('unit-buttons');
    wrap.innerHTML = '';
    this.buttons = deck.map((def, i) => {
      const btn = document.createElement('button');
      btn.className = 'unit-btn';
      btn.innerHTML = `<span class="role">${def.role}</span><canvas></canvas><span class="name">${def.name}</span><span class="cost">${def.cost}</span><div class="cd"></div>`;
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
    this.setText('stage', el.stage, `STAGE ${battle.stage.label}`);
    this.setText('wave', el.wave, `WAVE ${battle.waveCount}`);
    this.setText('time', el.time, formatTime(battle.time));

    const money = Math.floor(battle.money);
    this.setText('money', el.moneyText, `${money} / ${battle.costMax}`);
    el.moneyFill.style.width = `${(battle.money / battle.costMax) * 100}%`;

    this.setText('costNow', el.costNow, String(money));
    const lvText = battle.costLevel + 1 >= battle.costMaxLevel ? 'MAX' : `Lv${battle.costLevel + 1}`;
    if (this.cache.lv !== undefined && this.cache.lv !== lvText) this.pulse(el.costNow.parentElement, 'lvup');
    this.setText('lv', el.costLevel, lvText);
    el.costLvFill.style.width = `${battle.costLevelProgress * 100}%`;
    this.setText('allyCount', el.allyCount, `出撃 ${battle.allyCount}/${battle.allyCap}`);
    el.allyCount.classList.toggle('full', battle.allyCount >= battle.allyCap);

    const full = battle.money >= battle.costMax;
    if (this.cache.full !== full) {
      this.cache.full = full;
      el.costNow.parentElement.classList.toggle('full', full);
      el.moneyFill.classList.toggle('full', full);
    }

    this.buttons.forEach((b, i) => {
      const cd = battle.allyCooldowns[i];
      b.cd.style.height = `${(cd / b.def.cooldown) * 100}%`;
      const ready = battle.canSpawnAlly(i);
      b.btn.classList.toggle('disabled', !ready);
      // 出撃できるようになった瞬間に光らせる
      if (ready && b.ready === false) {
        b.btn.classList.remove('ready');
        void b.btn.offsetWidth; // アニメーションを最初から再生させる
        b.btn.classList.add('ready');
      }
      b.ready = ready;
    });
  }

  /** 要素に一度だけアニメーション用クラスを付ける */
  pulse(elm, cls) {
    elm.classList.remove(cls);
    void elm.offsetWidth;
    elm.classList.add(cls);
  }

  showBanner(text, color = '#fff', duration = 1500, alert = false) {
    const { banner } = this.el;
    banner.textContent = text;
    banner.style.color = color;
    banner.classList.toggle('alert', alert);
    banner.classList.add('show');
    clearTimeout(this._bannerTimer);
    if (duration > 0) this._bannerTimer = setTimeout(() => this.hideBanner(), duration);
  }

  hideBanner() {
    clearTimeout(this._bannerTimer);
    this.el.banner.classList.remove('show');
  }
}
