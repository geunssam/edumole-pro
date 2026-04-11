# EduMole Runner — SpecKit v1.0

> 위치: `public/games/runner/`
> 범위: 러너 게임 코어 + 퀴즈 연동 + 교사 운영 + 품질보증

---

## 1) 게임 정체성

- 장르: 퀴즈 연동 엔드리스 러너
- 톤: **마리오의 명확한 조작감 + 쿠키런의 속도감**
- 플레이 시간: 1판 2~4분 (수업 운영 최적화)
- 목적: 달리기 몰입 중 퀴즈를 반복 노출해 학습 고착화

---

## 2) 주인공 캐릭터(확정 제안)

## 캐릭터명: **모리 (MORI)**

- 모티프: 실제 반려견 느낌의 귀엽고 빠른 강아지 러너
- 실루엣: 작은 체구 + 큰 귀 + 풍성한 꼬리
- 성격 키워드: 용감함, 장난기, 집중력
- 왜 이 캐릭터?
  - 학생 친화도 높음 (거부감 낮고 즉시 호감)
  - 교육용 게임 톤과 잘 맞음 (과격함 없이 에너지 전달)
  - 브랜딩 확장 쉬움 (스티커/배지/학급 이벤트)

## 애니메이션 최소 세트 (MVP)
- Idle(대기)
- Run(기본 달리기)
- Jump(점프)
- Slide(슬라이드)
- Hit(피격)
- Cheer(정답 보상)

---

## 3) 핵심 루프

1. 자동 달리기 시작
2. 장애물 회피 (점프/슬라이드)
3. 교사 설정값에 따라 퀴즈 출제 (문항 간격/제한시간 커스텀)
4. 4지선다(2x2 그리드) 정답 선택
5. 정답/오답에 따른 즉시 피드백
6. 생존시간/거리/점수 누적
7. 게임오버 또는 목표 달성 후 결과 저장

---

## 4) 속도 설계 (핵심 밸런스)

- 목표 FPS: 60
- 시작 속도: **220 px/s**
- 구간별 속도 곡선:
  - 0~20초: 220 → 250
  - 20~60초: 250 → 290
  - 60초 이후: 290 → 330
- 최대 속도 캡: **330 px/s**

## 퀴즈 보정
- 정답: +15% 속도 버프 5초 (캡 적용)
- 오답: -12% 감속 3초 (하한 180 px/s)
- 중첩: 버프/디버프 각각 1중첩 제한

---

## 5) 장애물/난이도

- 스폰 간격(속도 연동):
  - 저속: 1.8~2.2s
  - 중속: 1.4~1.8s
  - 고속: 1.1~1.5s
- 금지 규칙:
  - 회피 불가능 패턴 금지
  - 반응시간 700ms 미만 패턴 금지
- 완충 구간:
  - 10초마다 1회 안전 구간

---

## 6) 퀴즈 연동 스펙

- 데이터 소스: 기존 `QuizBridge` + Firestore `problemSets`
- 출제 주기: **교사 커스텀 값** 적용
  - `quizIntervalSec` (예: 15/20/25/30초)
- 문항 제한시간: **교사 커스텀 값** 적용
  - `quizTimeLimitSec` (예: 5/7/10초)
- 문항 구성: **4지선다** (정답 1 + 오답 3)
- 표시 방식: 러너 오버레이 모달
  - 상단: 문제 텍스트 크게 표시
  - 하단: 선택지 **2x2 그리드 버튼 레이아웃**
- 결과 반영:
  - 정답: 점수/속도 보너스
  - 오답: 감속 또는 실드 감소

---

## 7) 점수/승패 규칙

- 기본 점수: 거리 기반 누적
- 추가 점수: 코인, 퀴즈 정답, 콤보
- 기본 목숨: 3
- 종료 조건:
  - 목숨 0
  - 또는 수업 모드 목표 시간/거리 도달

---

## 8) 저장 데이터 (gameResults)

저장 필드(필수):
- `gameType: "runner"`
- `sessionId`
- `studentName`
- `classId` / `className`
- `quizSetId` / `quizSetTitle`
- `score`
- `distance`
- `survivalTime`
- `quizCorrect`, `quizWrong`, `accuracy`
- `createdAt`

---

## 9) 파일 구조 (러너 폴더 기준)

```text
public/games/runner/
  ├─ RUNNER-SPECKIT.md
  ├─ index.html
  ├─ runner.css
  ├─ Game.js
  ├─ Player.js
  ├─ ObstacleManager.js
  ├─ QuizOverlay.js
  ├─ HUD.js
  ├─ config.js
  └─ assets/
      ├─ sprites/
      ├─ bg/
      └─ sfx/
```

---

## 10) 품질 보증(QA) 조건

## A. 기능 QA
- 세션 생성→학생 입장→플레이→결과 저장 전체 플로우 통과
- PIN 입장 실패/성공 케이스 정상 처리
- 퀴즈 모달 출제 주기 오차 ±2초 이내

## B. 밸런스 QA
- 보통 난이도 평균 생존시간 90~150초
- 회피 불가능 패턴 0건 (30판 기준)
- 정답/오답 보상 체감 명확

## C. 성능 QA
- iPhone Safari 평균 45fps 이상
- 입력지연 체감 <100ms
- 치명 오류(P0) 0건

## D. 릴리즈 게이트
- P0 버그 0건
- 결과 저장 성공률 99%+
- 실제 iPhone 10판 연속 플레이 통과

---

## 11) 실행 TODO (MVP) — Phase 기준

### Phase 1) 베이스 진입/레이아웃
- [x] `index.html` 생성 (러너 진입점)
- [x] `runner.css` 스테이지/HUD/컨트롤 기본 레이아웃

### Phase 2) 코어 러너 루프
- [x] `Game.js` 루프/상태머신 구현
- [x] `Player.js` 점프/슬라이드/충돌 박스
- [x] `ObstacleManager.js` 스폰 및 이동 규칙
- [x] HUD(점수/거리/생존/목숨)

### Phase 3) 퀴즈 오버레이/연동
- [x] 퀴즈 오버레이 + QuizBridge 연동
- [x] 4지선다 2x2 그리드 + 대형 문제 텍스트

### Phase 4) 세션 설정 반영
- [x] 교사 설정값 반영 (`quizIntervalSec`, `quizTimeLimitSec`)
- [x] 미설정 시 sensible default 적용(20s / 7s)

### Phase 5) 결과 저장
- [x] `QuizBridge.saveResult` 저장 연동
- [x] `score`, `distance`, `survivalTime`, `accuracy` + 기존 호환 필드 저장

### Phase 6) QA
- [x] 로컬 정적 검증 및 스모크 테스트
- [ ] iPhone 실기기 테스트 (현장 QA 남음)

> 상세 검증 로그: `RUNNER-QA-REPORT.md`

---

## 12) 향후 확장

- 모리 스킨 시스템(계절/이벤트)
- 학급 리그전(주간 거리 랭킹)
- 코스 테마(운동장/도서관/우주 체육관)
- 음성 피드백(정답 칭찬, 오답 격려)

---

## 13) 모리 캐릭터 8종 프롬프트 (모바일 복붙용)

> 규칙: 아래 각 항목은 **공통 프리셋 1줄 + 단계 프롬프트 1줄** 구조입니다.
> 그대로 두 줄 복붙해서 이미지 생성기에 넣으면 됩니다.

### 1. Idle

`small fluffy dog character named MORI, based on a real pet, white and caramel fur, caramel patches around ears and eyes, round dark eyes, short muzzle, fluffy tail, cute but athletic, Nintendo + CookieRun inspired 2D cartoon style, side-view game sprite, clean thick outline, high readability for mobile, transparent background, no text, no watermark`

`MORI standing idle, gentle breathing pose, slight tail wag, curious and friendly expression, feet planted, neutral balanced silhouette, sprite-ready`

### 2. Run 1

`small fluffy dog character named MORI, based on a real pet, white and caramel fur, caramel patches around ears and eyes, round dark eyes, short muzzle, fluffy tail, cute but athletic, Nintendo + CookieRun inspired 2D cartoon style, side-view game sprite, clean thick outline, high readability for mobile, transparent background, no text, no watermark`

`MORI running frame 1, front leg extended, rear leg pushing off, ears bouncing backward, focused happy face, strong forward motion`

### 3. Run 2

`small fluffy dog character named MORI, based on a real pet, white and caramel fur, caramel patches around ears and eyes, round dark eyes, short muzzle, fluffy tail, cute but athletic, Nintendo + CookieRun inspired 2D cartoon style, side-view game sprite, clean thick outline, high readability for mobile, transparent background, no text, no watermark`

`MORI running frame 2, opposite leg cycle from run frame 1, body slightly stretched, tail following motion arc, seamless loop-friendly pose`

### 4. Jump

`small fluffy dog character named MORI, based on a real pet, white and caramel fur, caramel patches around ears and eyes, round dark eyes, short muzzle, fluffy tail, cute but athletic, Nintendo + CookieRun inspired 2D cartoon style, side-view game sprite, clean thick outline, high readability for mobile, transparent background, no text, no watermark`

`MORI jump pose, mid-air, front paws tucked, hind legs folded, ears lifted by momentum, excited determined expression`

### 5. Slide

`small fluffy dog character named MORI, based on a real pet, white and caramel fur, caramel patches around ears and eyes, round dark eyes, short muzzle, fluffy tail, cute but athletic, Nintendo + CookieRun inspired 2D cartoon style, side-view game sprite, clean thick outline, high readability for mobile, transparent background, no text, no watermark`

`MORI slide pose, body lowered close to ground, front paws forward, hind legs tucked, ears swept back, determined expression, clear low-profile silhouette`

### 6. Hit

`small fluffy dog character named MORI, based on a real pet, white and caramel fur, caramel patches around ears and eyes, round dark eyes, short muzzle, fluffy tail, cute but athletic, Nintendo + CookieRun inspired 2D cartoon style, side-view game sprite, clean thick outline, high readability for mobile, transparent background, no text, no watermark`

`MORI hit reaction pose, slight backward knockback, surprised face, tiny cartoon impact stars, non-violent and kid-friendly, still cute`

### 7. Cheer

`small fluffy dog character named MORI, based on a real pet, white and caramel fur, caramel patches around ears and eyes, round dark eyes, short muzzle, fluffy tail, cute but athletic, Nintendo + CookieRun inspired 2D cartoon style, side-view game sprite, clean thick outline, high readability for mobile, transparent background, no text, no watermark`

`MORI cheer/victory pose, small hop with one paw up, sparkling eyes, big smile, celebratory energy, adorable hero moment`

### 8. Portrait (UI)

`small fluffy dog character named MORI, based on a real pet, white and caramel fur, caramel patches around ears and eyes, round dark eyes, short muzzle, fluffy tail, cute but athletic, Nintendo + CookieRun inspired 2D cartoon style, side-view game sprite, clean thick outline, high readability for mobile, transparent background, no text, no watermark`

`MORI portrait icon, front-facing bust, bright friendly smile, clean circular composition, high contrast, perfect for HUD/profile badge`

### Negative Prompt (공통)

`photorealistic, realistic fur rendering, 3D render, blurry, low resolution, extra limbs, distorted anatomy, text, logo, watermark, complex background`
