export class QuizOverlay {
  constructor({ modalEl, timerEl, questionEl, choicesEl }) {
    this.modalEl = modalEl;
    this.timerEl = timerEl;
    this.questionEl = questionEl;
    this.choicesEl = choicesEl;
    this.intervalId = null;
  }

  async ask({ problem, timeLimitSec }) {
    this.modalEl.classList.remove('hidden');
    this.questionEl.textContent = problem.question || '문제를 확인하세요.';

    const choices = this._shuffle([problem.answer].concat(problem.distractors || []).slice(0, 4));
    const startedAt = Date.now();

    return new Promise((resolve) => {
      let done = false;
      const finish = (answer, timedOut = false) => {
        if (done) return;
        done = true;
        clearInterval(this.intervalId);
        this.modalEl.classList.add('hidden');
        const isCorrect = answer === problem.answer;
        resolve({ answer, isCorrect, timedOut, elapsedMs: Date.now() - startedAt });
      };

      this.choicesEl.innerHTML = '';
      choices.forEach((choice) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-choice';
        btn.type = 'button';
        btn.textContent = choice;
        btn.addEventListener('click', () => finish(choice, false), { once: true });
        this.choicesEl.appendChild(btn);
      });

      let left = Math.max(1, Number(timeLimitSec) || 7);
      this.timerEl.textContent = String(left);
      this.intervalId = setInterval(() => {
        left -= 1;
        this.timerEl.textContent = String(Math.max(0, left));
        if (left <= 0) finish(null, true);
      }, 1000);
    });
  }

  _shuffle(arr) {
    const n = arr.slice();
    for (let i = n.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [n[i], n[j]] = [n[j], n[i]];
    }
    return n;
  }
}
