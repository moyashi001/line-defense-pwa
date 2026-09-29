// 進行状況の保存 (LocalStorage)
const KEY = 'line-defense:progress:v1';

const DEFAULT = () => ({ cleared: {} }); // cleared: { [stageId]: { bestTime } }

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT();
    const data = JSON.parse(raw);
    return { ...DEFAULT(), ...data };
  } catch {
    return DEFAULT();
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // プライベートモード等で保存できない場合は無視
  }
}

export const Progress = {
  isCleared(stageId) {
    return !!read().cleared[stageId];
  },
  bestTime(stageId) {
    return read().cleared[stageId]?.bestTime ?? null;
  },
  // ステージ1は常に解放。以降は前のステージをクリアすると解放
  isUnlocked(stageId) {
    return stageId === 1 || this.isCleared(stageId - 1);
  },
  markCleared(stageId, time) {
    const data = read();
    const prev = data.cleared[stageId]?.bestTime;
    const t = Math.round(time * 10) / 10;
    data.cleared[stageId] = { bestTime: prev == null ? t : Math.min(prev, t) };
    write(data);
  },
  reset() {
    write(DEFAULT());
  },
};
