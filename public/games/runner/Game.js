import { RUNNER_DEFAULTS, ASSETS } from './config.js';
import { Player } from './Player.js';
import { ObstacleManager } from './ObstacleManager.js';
import { QuizOverlay } from './QuizOverlay.js';
import { HUD } from './HUD.js';

export class RunnerGame {
  constructor({ session, studentName, dom }) {
    this.session = session;
    this.studentName = studentName;
    this.dom = dom;
    this.settings = this._resolveSettings();

    this.state = 'ready';
    this.score = 0;
    this.distance = 0;
    this.survival = 0;
    this.lives = this.settings.lives;
    this.correct = 0;
    this.wrong = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.details = [];
    this.quizIndex = -1;
    this.quizCooldown = this.settings.quizIntervalSec;
    this.speed = RUNNER_DEFAULTS.baseSpeed;

    this.hud = new HUD(dom.hudEl);
    this.player = new Player(dom.playerEl, 66, RUNNER_DEFAULTS);
    this.obstacles = new ObstacleManager(dom.obstacleLayerEl, dom.stageEl.clientWidth, 72, RUNNER_DEFAULTS);
    this.quiz = new QuizOverlay({
      modalEl: dom.quizModalEl,
      timerEl: dom.quizTimerEl,
      questionEl: dom.quizQEl,
      choicesEl: dom.quizChoicesEl
    });

    this.lastTs = 0;
    this.rafId = null;
    this._paintBG();
    this._bind();
    this._renderHUD();
  }

  _resolveSettings() {
    // QuizBridge.resolveSettings를 사용해 통일된 스키마로 해석 (구버전 폴백 포함)
    const merged = (window.QuizBridge && window.QuizBridge.resolveSettings)
      ? window.QuizBridge.resolveSettings(this.session, 'runner')
      : (this.session.settings || {});
    return {
      quizIntervalSec: Math.max(8, Number(merged.quizIntervalSec) || RUNNER_DEFAULTS.quizIntervalSec),
      quizTimeLimitSec: Math.max(3, Number(merged.perQuestionTimeSec) || RUNNER_DEFAULTS.quizTimeLimitSec),
      totalTimeSec: Number(merged.totalTimeSec) > 0 ? Number(merged.totalTimeSec) : RUNNER_DEFAULTS.totalTimeSec,
      comboEnabled: merged.comboEnabled !== false,
      comboBonusPerLevel: Number(merged.comboBonusPerLevel) || RUNNER_DEFAULTS.comboBonusPerLevel,
      lives: Number(merged.lives) > 0 ? Number(merged.lives) : RUNNER_DEFAULTS.lives
    };
  }

  _paintBG() {
    const bg = ASSETS.bg[Math.floor(Math.random() * ASSETS.bg.length)];
    this.dom.bgFar.style.backgroundImage = `url(${bg})`;
    this.dom.bgNear.style.backgroundImage = `url(${bg})`;
  }

  _bind() {
    this.onKeyDown = (e) => {
      if (this.state !== 'playing') return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        e.preventDefault();
        this.player.jump();
      }
      if (e.code === 'ArrowDown' || e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.player.slide();
      }
    };
    window.addEventListener('keydown', this.onKeyDown);

    this.dom.btnJump.addEventListener('click', () => this.state === 'playing' && this.player.jump());
    this.dom.btnSlide.addEventListener('click', () => this.state === 'playing' && this.player.slide());
    window.addEventListener('resize', () => this.obstacles.reset(this.dom.stageEl.clientWidth));
  }

  start() {
    if (!this.session.problems?.length) {
      this.dom.statusLine.textContent = '세션에 문제가 없습니다.';
      return;
    }
    this.state = 'playing';
    this.dom.statusLine.textContent = `${this.studentName} 학생, 달리기를 시작하세요!`;
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame((ts) => this._loop(ts));
  }

  async _loop(ts) {
    if (this.state === 'ended') return;
    const dt = Math.min(0.034, (ts - this.lastTs) / 1000 || 0.016);
    this.lastTs = ts;

    if (this.state === 'playing') {
      this.speed = Math.min(RUNNER_DEFAULTS.maxSpeed, this.speed + RUNNER_DEFAULTS.speedRampPerSec * dt * 60);
      this.survival += dt;
      this.distance += this.speed * RUNNER_DEFAULTS.distancePerSpeed * dt;
      this.score += RUNNER_DEFAULTS.scorePerSec * dt;
      this.quizCooldown -= dt;

      // 전체 시간 초과 시 종료 (시간 or 목숨 중 먼저 도달하는 쪽)
      if (this.survival >= this.settings.totalTimeSec) {
        this._flash('시간 종료!');
        await this.finish();
        return;
      }

      this.player.update(dt);
      this.obstacles.update(dt, this.speed);

      if (this.obstacles.collides(this.player.getBounds())) {
        this.lives -= 1;
        this.player.hit();
        this.obstacles.reset(this.dom.stageEl.clientWidth);
        this._flash(this.lives > 0 ? '앗! 장애물 충돌' : '게임 오버');
        if (this.lives <= 0) {
          await this.finish();
          return;
        }
      }

      if (this.quizCooldown <= 0) {
        await this._openQuiz();
      }
      this._renderHUD();
    }

    this.rafId = requestAnimationFrame((next) => this._loop(next));
  }

  async _openQuiz() {
    this.state = 'paused';
    this.quizCooldown = this.settings.quizIntervalSec;
    this.quizIndex = (this.quizIndex + 1) % this.session.problems.length;
    const problem = this.session.problems[this.quizIndex];

    const res = await this.quiz.ask({ problem, timeLimitSec: this.settings.quizTimeLimitSec });
    this.details.push({
      questionIndex: this.quizIndex,
      selectedAnswer: res.answer,
      correctAnswer: problem.answer,
      // 하위 호환용 레거시 필드
      selected: res.answer,
      answer: problem.answer,
      isCorrect: res.isCorrect,
      timedOut: res.timedOut,
      elapsedMs: res.elapsedMs
    });

    if (res.isCorrect) {
      this.correct += 1;
      this.combo += 1;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      const comboBonus = this.settings.comboEnabled ? this.combo * this.settings.comboBonusPerLevel : 0;
      this.score += 120 + comboBonus;
      this.speed = Math.min(RUNNER_DEFAULTS.maxSpeed, this.speed * 1.12);
      this.player.cheer();
      this._flash(this.combo >= 2 ? `정답! 콤보 ×${this.combo}` : '정답! 속도 상승');
    } else {
      this.wrong += 1;
      this.combo = 0;
      this.speed = Math.max(180, this.speed * 0.9);
      this._flash(res.timedOut ? '시간 초과!' : '오답! 감속');
    }

    setTimeout(() => this.player.resetState(), 300);
    this.state = 'playing';
  }

  _flash(text) {
    this.dom.messageEl.textContent = text;
    this.dom.messageEl.classList.add('show');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.dom.messageEl.classList.remove('show'), 850);
  }

  _renderHUD() {
    const totalQuiz = this.correct + this.wrong;
    const acc = totalQuiz ? Math.round((this.correct / totalQuiz) * 100) : 0;
    const timeLeft = Math.max(0, this.settings.totalTimeSec - this.survival);
    this.hud.set({
      score: Math.floor(this.score),
      distance: this.distance.toFixed(1),
      survival: this.survival.toFixed(1),
      lives: this.lives,
      quiz: `${this.correct}/${totalQuiz}`,
      accuracy: `${acc}%`,
      combo: this.combo,
      timeLeft: timeLeft.toFixed(1),
      totalTimeSec: this.settings.totalTimeSec
    });
  }

  async finish() {
    this.state = 'ended';
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKeyDown);

    const totalQuiz = this.correct + this.wrong;
    const accuracy = totalQuiz ? this.correct / totalQuiz : 0;
    this.dom.statusLine.textContent = `종료! 점수 ${Math.floor(this.score)} / 거리 ${this.distance.toFixed(1)}m`;

    try {
      await window.QuizBridge.saveResult({
        teacherId: this.session.teacherId,
        sessionId: this.session.id,
        classId: this.session.classId || '',
        className: this.session.className || '',
        setId: this.session.quizSetId || '',
        quizSetTitle: this.session.quizSetTitle || '',
        studentName: this.studentName,
        gameType: 'runner',
        score: Math.floor(this.score),
        correctCount: this.correct,
        totalCount: totalQuiz,
        detailedAnswers: this.details,
        distance: Number(this.distance.toFixed(2)),
        survivalTime: Number(this.survival.toFixed(2)),
        accuracy: Number(accuracy.toFixed(4)),
        quizCorrect: this.correct,
        quizWrong: this.wrong,
        maxCombo: this.maxCombo
      });
      this.dom.statusLine.textContent += ' · 결과 저장 완료';
    } catch (e) {
      console.error('runner result save failed', e);
      this.dom.statusLine.textContent += ' · 결과 저장 실패(네트워크 확인)';
    }
  }
}
