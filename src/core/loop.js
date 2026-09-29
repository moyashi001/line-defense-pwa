// requestAnimationFrame ベースのゲームループ
import { GAME } from '../config/constants.js';

export class GameLoop {
  constructor(tick) {
    this.tick = tick; // (dt) => void
    this.running = false;
    this.last = 0;
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
  }

  _frame(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, GAME.maxDt);
    this.last = now;
    this.tick(dt);
    requestAnimationFrame(this._frame);
  }
}

export const formatTime = (sec) => {
  const s = Math.floor(sec);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
