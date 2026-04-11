export class HUD {
  constructor(rootEl) {
    this.rootEl = rootEl;
    this.values = {};
    this.rootEl.innerHTML = [
      ['점수', 'score'],
      ['시간(s)', 'timeLeft'],
      ['거리(m)', 'distance'],
      ['목숨', 'lives'],
      ['퀴즈', 'quiz'],
      ['정확도', 'accuracy'],
      ['콤보', 'combo']
    ].map(([label, key]) => `<div class="hud-chip" data-chip="${key}"><div class="hud-label">${label}</div><div class="hud-value" data-k="${key}">-</div></div>`).join('');
  }

  set(data) {
    Object.entries(data).forEach(([k, v]) => {
      const next = String(v);
      if (this.values[k] === next) return;
      const target = this.rootEl.querySelector(`[data-k="${k}"]`);
      if (target) target.textContent = next;
      this.values[k] = next;
    });
    // 콤보 칩은 combo>=2일 때만 강조 (낮을 때는 숫자만 담백하게)
    if (data.combo !== undefined) {
      const chip = this.rootEl.querySelector('[data-chip="combo"]');
      if (chip) {
        chip.classList.toggle('combo-on', Number(data.combo) >= 2);
        const valueEl = chip.querySelector('[data-k="combo"]');
        if (valueEl) valueEl.textContent = Number(data.combo) >= 2 ? `×${data.combo}` : '-';
      }
    }
  }
}
