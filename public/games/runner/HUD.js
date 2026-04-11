export class HUD {
  constructor(rootEl) {
    this.rootEl = rootEl;
    this.values = {};
    this.rootEl.innerHTML = [
      ['점수', 'score'],
      ['거리(m)', 'distance'],
      ['생존(s)', 'survival'],
      ['목숨', 'lives'],
      ['퀴즈', 'quiz'],
      ['정확도', 'accuracy']
    ].map(([label, key]) => `<div class="hud-chip"><div class="hud-label">${label}</div><div class="hud-value" data-k="${key}">-</div></div>`).join('');
  }

  set(data) {
    Object.entries(data).forEach(([k, v]) => {
      const next = String(v);
      if (this.values[k] === next) return;
      const target = this.rootEl.querySelector(`[data-k="${k}"]`);
      if (target) target.textContent = next;
      this.values[k] = next;
    });
  }
}
