# 근쌤의 퀴즈 게임 허브 - 구현 계획

## Context
기존 EduMole Pro(두더지 게임)를 **퀴즈 게임 허브**로 확장한다. 블루킷처럼 하나의 퀴즈 세트로 두더지, 달리기, 레이싱 등 다양한 게임을 플레이할 수 있는 플랫폼.

**핵심 결정사항:**
- 기존 `edumole-pro` Firebase 프로젝트에 통합 (새 프로젝트 X)
- Firestore의 기존 퀴즈 데이터를 모든 게임에서 공유
- 닌텐도/마리오 스타일 UI
- 첫 번째 추가 게임: 쿠키런 스타일 끝없는 달리기(Endless Runner)

---

## 기존 EduMole 분석

**프로젝트 경로**: `/Users/iwongeun/Desktop/개발_프로젝트/edumole-pro/`
**배포**: `edumole-pro.web.app` (Firebase Hosting)
**Firebase ID**: `edumole-pro`

**기존 Firestore 구조:**
```
artifacts/{appId}/public/data/
  ├── problemSets/{docId}     ← 퀴즈 세트 (공유 대상!)
  │   ├── title: "체육 상식"
  │   ├── problems: [{ question, answer, distractors[3] }]
  │   ├── moleCount: 6
  │   ├── timeLimit: 30
  │   └── createdAt, updatedAt
  ├── gameResults/{docId}     ← 게임 결과
  ├── roster/{docId}          ← 학생 명단
  └── classes/{docId}         ← 학급 정보
```
- `appId` = `edu-mole-pro-v6`
- 기술: React(CDN) + Babel + Tailwind + Firebase Compat SDK
- 보안: 누구나 읽기, 인증 사용자만 쓰기

---

## 변경 전략: 멀티 페이지 구조

기존 SPA를 **멀티 페이지**로 확장한다. Canvas 게임은 React와 분리하는 게 성능과 개발 편의에 유리.

### 변경된 프로젝트 구조
```
edumole-pro/
├── public/
│   ├── index.html              # [신규] 게임 허브 메인 (닌텐도 스타일)
│   ├── mole.html               # [이동] 기존 두더지 게임 (현재 index.html)
│   ├── runner.html             # [신규] 끝없는 달리기 게임
│   ├── quiz-editor.html        # [신규] 퀴즈 편집기 (독립 페이지)
│   │
│   ├── firebase-config.js      # [기존] Firebase 설정
│   │
│   ├── shared/                 # [신규] 모든 게임 공유 모듈
│   │   ├── QuizBridge.js       # Firestore 퀴즈 로드 + 출제/채점
│   │   ├── QuizModal.js        # 퀴즈 팝업 UI (DOM 오버레이)
│   │   ├── QuizModal.css       # 퀴즈 모달 스타일
│   │   ├── ScoreManager.js     # 점수 저장 (Firestore + localStorage)
│   │   ├── SoundManager.js     # 효과음 관리
│   │   ├── InputManager.js     # 키보드 + 터치 통합 입력
│   │   └── Utils.js            # 충돌 감지 등 공통 유틸
│   │
│   ├── games/                  # [신규] 개별 게임 로직
│   │   └── runner/
│   │       ├── Game.js         # 게임 루프 + 상태 머신
│   │       ├── Player.js       # 캐릭터 (점프/슬라이드/물리)
│   │       ├── ObstacleManager.js
│   │       ├── Background.js   # 패럴랙스 배경
│   │       ├── Collectible.js  # 코인/아이템
│   │       ├── PowerUp.js      # 파워업 효과
│   │       ├── HUD.js          # 점수/거리/HP 표시
│   │       └── config.js       # 게임 밸런스 상수
│   │
│   ├── css/
│   │   └── hub.css             # [신규] 게임 허브 스타일
│   │
│   └── assets/                 # [신규] 게임 에셋 (Phase 4)
│       ├── sprites/
│       ├── sounds/
│       └── hub/
│
├── firebase.json               # [수정] 멀티 페이지 라우팅
├── firestore.rules             # [수정] gameResults 확장
└── .firebaserc                 # [기존]
```

### firebase.json 수정
```json
{
  "hosting": {
    "public": "public",
    "rewrites": [
      { "source": "/mole", "destination": "/mole.html" },
      { "source": "/mole/**", "destination": "/mole.html" },
      { "source": "/runner", "destination": "/runner.html" },
      { "source": "/runner/**", "destination": "/runner.html" },
      { "source": "/quiz-editor", "destination": "/quiz-editor.html" },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

---

## Firestore 데이터 확장

### 기존 퀴즈 데이터 재활용
기존 `problemSets` 컬렉션을 그대로 사용. 모든 게임이 같은 퀴즈 세트를 로드.

```
artifacts/{appId}/public/data/
  ├── problemSets/{docId}       ← 모든 게임이 공유!
  │   ├── title: "체육 상식"
  │   ├── problems: [{ question, answer, distractors[3] }]
  │   ├── moleCount: 6          ← 두더지 전용 설정 (다른 게임은 무시)
  │   ├── timeLimit: 30
  │   └── createdAt, updatedAt
  │
  ├── gameResults/{docId}       ← 확장: 게임별 결과 저장
  │   ├── gameType: "mole" | "runner" | "racing" | ...
  │   ├── quizSetId: "abc123"
  │   ├── playerName: "홍길동"
  │   ├── className: "6-1"
  │   ├── score: 15400
  │   ├── distance: 2340        ← 달리기 전용
  │   ├── quizCorrect: 8
  │   ├── quizTotal: 10
  │   └── createdAt
  │
  ├── roster/{docId}            ← 기존 유지
  └── classes/{docId}           ← 기존 유지
```

### QuizBridge.js - Firestore 퀴즈 브릿지
기존 EduMole의 Firestore 접근 패턴을 재사용하는 공유 모듈:
```javascript
// shared/QuizBridge.js
class QuizBridge {
    constructor(db, appId) {
        this.db = db;
        this.appId = appId;
        this.basePath = `artifacts/${appId}/public/data`;
    }

    // 퀴즈 세트 목록 가져오기
    async getQuizSets() { ... }

    // 특정 퀴즈 세트 로드
    async loadQuizSet(setId) { ... }

    // 다음 문제 가져오기 (랜덤, 중복 없이)
    getNextQuestion() { ... }

    // 답변 확인
    checkAnswer(answer) { ... }

    // 게임 결과 저장
    async saveResult(gameType, resultData) { ... }
}
```

---

## 끝없는 달리기 게임 설계

### 게임 상태 머신
```
LOADING → MENU → READY(3-2-1) → PLAYING ⇄ QUIZ → GAME_OVER → MENU
                                  ↕
                                PAUSED
```

### 퀴즈 연동
- 500m 간격으로 퀴즈 팝업 (게임 일시정지)
- **정답 파워업** (연속 정답 수에 따라):
  - 1연속: 쉴드 (장애물 1회 방어)
  - 2연속: 코인 자석 (10초)
  - 3연속: 스피드 부스트 + 무적 (5초)
  - 4연속: 점수 2배 (15초)
  - 5연속+: 메가 부스트 (8초)
- **오답**: 속도 30% 감소 (3초)
- **시간초과**: 속도 20% 감소 (2초)

### 조작
- **데스크톱**: Space/위 = 점프, 아래 = 슬라이드, ESC = 일시정지
- **모바일**: 탭/위 스와이프 = 점프, 아래 스와이프 = 슬라이드
- 더블 점프 지원, 체력(하트) 3개

### 닌텐도/마리오 색상
```css
--hub-bg: #1a1a2e;         /* 진한 남색 배경 */
--mario-red: #E52521;       --mario-blue: #049CD8;
--mario-yellow: #FBD000;    --mario-green: #43B047;
```

---

## 단계별 구현 계획

### Phase 1: 프로젝트 재구성 + 달리기 프로토타입
> 기존 EduMole을 허브 구조로 재편하고, 사각형으로 달리기 게임 완성

**1-A. 구조 재편**
1. 기존 `public/index.html` → `public/mole.html`로 복사 (기존 두더지 보존)
2. `public/index.html`을 게임 허브 페이지로 교체
3. `firebase.json`의 rewrites 수정 (멀티 페이지)
4. `public/shared/` 폴더 생성
5. `public/games/runner/` 폴더 생성

**1-B. 달리기 게임 핵심**
6. `runner.html` - Canvas + Firebase SDK 로드
7. `games/runner/config.js` - 게임 상수
8. `games/runner/Game.js` - requestAnimationFrame 게임 루프 + 상태 머신
9. `shared/InputManager.js` - 키보드 입력
10. `games/runner/Player.js` - 초록 사각형 캐릭터, 중력/점프/슬라이드
11. `games/runner/Background.js` - CSS gradient 하늘 + 갈색 지면
12. `games/runner/ObstacleManager.js` - 빨간 사각형 장애물
13. `shared/Utils.js` - AABB 충돌 감지
14. `games/runner/HUD.js` - 점수/거리 표시

### Phase 2: 퀴즈 연동 (Firestore 공유)
1. `shared/QuizBridge.js` - Firestore에서 기존 퀴즈 세트 로드
2. `shared/QuizModal.js` + `shared/QuizModal.css` - 퀴즈 팝업 UI
3. 달리기 게임에 QUIZ 상태 + 거리 기반 트리거 추가
4. `games/runner/PowerUp.js` - 정답 파워업 / 오답 페널티
5. `shared/ScoreManager.js` - Firestore에 게임 결과 저장
6. 시각 피드백 (정답 초록/오답 빨강 번쩍임)

### Phase 3: 게임 허브 UI (닌텐도 스타일)
1. `index.html` - 허브 메인 페이지 (게임 카트리지 선택)
2. `css/hub.css` - 닌텐도 스타일링
3. 게임 카드: 두더지(기존) + 달리기(신규) + Coming Soon 슬롯
4. 퀴즈 세트 선택 (Firestore에서 목록 로드)
5. 학생 이름 입력
6. 리더보드 (게임별 최고 점수)
7. 게임 허브 → 게임 → 결과 → 허브 복귀 전체 플로우

### Phase 4: 비주얼 업그레이드
1. 픽셀 아트 스프라이트 (캐릭터, 장애물, 코인)
2. 스프라이트 애니메이션 (달리기 6프레임 등)
3. 패럴랙스 배경 이미지 (하늘/산/나무/지면)
4. `shared/SoundManager.js` + 효과음
5. 파워업 시각 효과

### Phase 5: 모바일 + 퀴즈 편집기 개선
1. 터치 입력 (스와이프 + 탭)
2. Canvas 반응형 리사이즈
3. `quiz-editor.html` - 독립 퀴즈 편집기 (기존 두더지 에디터에서 분리)
4. 퀴즈 편집기에서 게임별 설정 추가 (두더지 수, 달리기 난이도 등)

### Phase 6: 배포 + 다음 게임 준비
1. Firebase Hosting 배포
2. 기존 두더지 게임이 `/mole` 경로에서 정상 작동하는지 확인
3. 전체 테스트 (허브 → 게임 선택 → 플레이 → 결과 → 리더보드)
4. 다음 게임 (레이싱? 배틀로얄?) 구조 준비

---

## 핵심 파일 (구현 순서)

1. **`firebase.json`** - 멀티 페이지 라우팅 설정
2. **`public/shared/QuizBridge.js`** - Firestore 퀴즈 공유 (모든 게임의 핵심)
3. **`public/games/runner/Game.js`** - 게임 루프 + 상태 머신
4. **`public/games/runner/Player.js`** - 캐릭터 물리 + 조작감
5. **`public/games/runner/config.js`** - 밸런스 수치
6. **`public/shared/QuizModal.js`** - 퀴즈 UI (Canvas 위 DOM 오버레이)
7. **`public/index.html`** - 게임 허브 메인 페이지

---

## 검증 방법
1. **Phase 1**: `runner.html`을 브라우저에서 열어 사각형 캐릭터 점프/슬라이드로 장애물 피하기 확인
2. **Phase 2**: Firestore에서 기존 EduMole 퀴즈 세트 로드 → 게임 중 퀴즈 팝업 → 정답/오답 파워업 확인
3. **Phase 3**: `index.html` 허브에서 두더지/달리기 선택 → 각각 정상 플레이 확인
4. **기존 호환성**: `edumole-pro.web.app/mole`에서 기존 두더지 게임 100% 동작 확인
5. **최종**: Firebase 배포 후 실제 URL에서 모바일/데스크톱 테스트
