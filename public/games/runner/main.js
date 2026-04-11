import { RunnerGame } from './Game.js';

function getEls() {
  return {
    hudEl: document.getElementById('runnerHUD'),
    stageEl: document.getElementById('runnerStage'),
    playerEl: document.getElementById('player'),
    obstacleLayerEl: document.getElementById('obstacleLayer'),
    messageEl: document.getElementById('overlayMessage'),
    statusLine: document.getElementById('statusLine'),
    btnStart: document.getElementById('btnStart'),
    btnJump: document.getElementById('btnJump'),
    btnSlide: document.getElementById('btnSlide'),
    quizModalEl: document.getElementById('quizModal'),
    quizTimerEl: document.getElementById('quizTimer'),
    quizQEl: document.getElementById('quizQuestionTitle'),
    quizChoicesEl: document.getElementById('quizChoices'),
    bgFar: document.querySelector('.bg-far'),
    bgNear: document.querySelector('.bg-near')
  };
}

async function init() {
  const dom = getEls();
  const params = window.EDUMOLE.getUrlParams();
  const sessionId = params.session;
  const studentName = decodeURIComponent(params.student || '학생');
  const isDev = params.dev === '1';

  // 개발 확인용: 세션 없이도 플레이 가능
  if (!sessionId && isDev) {
    const mockSession = {
      id: 'dev-session',
      teacherId: '',
      classId: '',
      className: 'DEV',
      quizSetId: 'dev-quiz',
      quizSetTitle: '개발용 샘플 퀴즈',
      status: window.EDUMOLE?.SESSION_STATUS?.PLAYING || 'playing',
      settings: {
        quizIntervalSec: 20,
        quizTimeLimitSec: 7,
        lives: 3
      },
      problems: [
        { question: '우리 게임 캐릭터 이름은?', answer: '모리', distractors: ['두리', '초코', '보리'] },
        { question: '러너 퀴즈 선택지는 몇 개?', answer: '4', distractors: ['2', '3', '5'] },
        { question: '점프 기본 키는?', answer: 'W/Space', distractors: ['A', 'D', 'Q'] }
      ]
    };

    dom.statusLine.textContent = `DEV 모드 · 세션 없이 테스트 중 (${studentName})`;
    const game = new RunnerGame({ session: mockSession, studentName, dom });
    dom.btnStart.disabled = false;
    dom.btnStart.addEventListener('click', () => {
      dom.btnStart.disabled = true;
      game.start();
    }, { once: true });
    return;
  }

  if (!sessionId) {
    dom.statusLine.textContent = '잘못된 접근입니다. session 파라미터가 필요합니다.';
    dom.btnStart.disabled = true;
    return;
  }

  try {
    const session = await window.QuizBridge.getSessionById(sessionId);
    if (!session) throw new Error('세션이 존재하지 않습니다.');
    if (session.status === window.EDUMOLE.SESSION_STATUS.ENDED) {
      throw new Error('이미 종료된 세션입니다.');
    }

    dom.statusLine.textContent = `${studentName} 학생 준비 완료 · 퀴즈 간격 ${Number(session.settings?.quizIntervalSec) || 20}s / 제한 ${Number(session.settings?.quizTimeLimitSec) || 7}s`;
    const game = new RunnerGame({ session, studentName, dom });

    dom.btnStart.addEventListener('click', () => {
      dom.btnStart.disabled = true;
      game.start();
    }, { once: true });
  } catch (e) {
    console.error(e);
    dom.statusLine.textContent = `세션 로드 실패: ${e.message}`;
    dom.btnStart.disabled = true;
  }
}

init();
