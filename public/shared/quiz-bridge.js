/**
 * EduMole Pro - QuizBridge (핵심 데이터 모듈)
 * 퀴즈 세트 관리, 세션 관리, 결과 저장/조회
 *
 * 의존: constants.js (window.EDUMOLE), firebase-init.js (window.firebaseDB)
 */
(function () {
    'use strict';

    var db = window.firebaseDB;
    var EDUMOLE = window.EDUMOLE;
    var COLS = EDUMOLE.COLLECTIONS;

    // ─── 퀴즈 세트 관련 ───

    /**
     * 퀴즈 세트 목록 조회
     * @returns {Promise<Array>} [{id, title, problems, moleCount, timeLimit, ...}]
     */
    async function getQuizSets() {
        var snapshot = await EDUMOLE.getCollection(db, COLS.PROBLEM_SETS).get();
        return snapshot.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
    }

    /**
     * 특정 퀴즈 세트 로드
     * @param {string} setId - 퀴즈 세트 문서 ID
     * @returns {Promise<Object|null>}
     */
    async function loadQuizSet(setId) {
        var doc = await EDUMOLE.getCollection(db, COLS.PROBLEM_SETS).doc(setId).get();
        if (!doc.exists) return null;
        return Object.assign({ id: doc.id }, doc.data());
    }

    /**
     * 다음 문제 가져오기
     * @param {Array} problems - 문제 배열
     * @param {Object} options - { mode: 'sequential'|'random', currentIndex: number }
     * @returns {{ question: Object, index: number } | null}
     */
    function getNextQuestion(problems, options) {
        var opts = options || {};
        var mode = opts.mode || 'sequential';
        var currentIndex = opts.currentIndex != null ? opts.currentIndex : -1;

        if (!problems || problems.length === 0) return null;

        var nextIndex;
        if (mode === 'random') {
            nextIndex = Math.floor(Math.random() * problems.length);
        } else {
            nextIndex = currentIndex + 1;
            if (nextIndex >= problems.length) return null; // 모든 문제 소진
        }

        return {
            question: problems[nextIndex],
            index: nextIndex
        };
    }

    /**
     * 정답 확인
     * @param {Array} problems - 문제 배열
     * @param {number} questionIndex - 문제 인덱스
     * @param {string} answer - 학생이 선택한 답
     * @returns {boolean}
     */
    function checkAnswer(problems, questionIndex, answer) {
        if (!problems || !problems[questionIndex]) return false;
        return problems[questionIndex].answer === answer;
    }

    /**
     * 선택지 생성 (정답 + 오답 섞기)
     * @param {Array} problems - 문제 배열
     * @param {number} questionIndex - 문제 인덱스
     * @returns {Array<string>} 섞인 선택지 배열
     */
    function getChoices(problems, questionIndex) {
        if (!problems || !problems[questionIndex]) return [];
        var q = problems[questionIndex];
        var choices = [q.answer].concat(q.distractors || []);
        // Fisher-Yates 셔플
        for (var i = choices.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = choices[i];
            choices[i] = choices[j];
            choices[j] = temp;
        }
        return choices;
    }

    // ─── 세션 관련 ───

    /**
     * 게임 세션 생성
     * @param {Object} params
     * @param {string} params.pin - 4자리 방 코드
     * @param {string} params.gameType - 게임 타입 (GAME_TYPES)
     * @param {string} params.quizSetId - 퀴즈 세트 ID
     * @param {string} params.quizSetTitle - 퀴즈 세트 제목
     * @param {string} params.classId - 학급 ID
     * @param {string} params.className - 학급 이름
     * @param {Object} [params.settings] - 게임별 설정
     * @returns {Promise<string>} 생성된 세션 문서 ID
     */
    async function createSession(params) {
        var sessionData = {
            pin: params.pin,
            gameType: params.gameType,
            quizSetId: params.quizSetId,
            quizSetTitle: params.quizSetTitle || '',
            classId: params.classId,
            className: params.className || '',
            status: EDUMOLE.SESSION_STATUS.ACTIVE,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            settings: params.settings || {}
        };

        var docRef = await EDUMOLE.getCollection(db, COLS.GAME_SESSIONS).add(sessionData);
        return docRef.id;
    }

    /**
     * PIN으로 활성 세션 조회
     * @param {string} pin - 4자리 PIN
     * @returns {Promise<Object|null>} 세션 데이터 또는 null
     */
    async function findSessionByPin(pin) {
        var snapshot = await EDUMOLE.getCollection(db, COLS.GAME_SESSIONS)
            .where('pin', '==', pin)
            .where('status', '==', EDUMOLE.SESSION_STATUS.ACTIVE)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        var doc = snapshot.docs[0];
        return Object.assign({ id: doc.id }, doc.data());
    }

    /**
     * 세션 종료
     * @param {string} sessionId - 세션 문서 ID
     * @returns {Promise<void>}
     */
    async function endSession(sessionId) {
        await EDUMOLE.getCollection(db, COLS.GAME_SESSIONS)
            .doc(sessionId)
            .update({ status: EDUMOLE.SESSION_STATUS.ENDED });
    }

    /**
     * 활성 세션 목록 조회
     * @returns {Promise<Array>}
     */
    async function getActiveSessions() {
        var snapshot = await EDUMOLE.getCollection(db, COLS.GAME_SESSIONS)
            .where('status', '==', EDUMOLE.SESSION_STATUS.ACTIVE)
            .get();

        return snapshot.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
    }

    /**
     * 사용 가능한 유니크 PIN 생성
     * 활성 세션 중 중복되지 않는 PIN을 찾을 때까지 반복
     * @returns {Promise<string>} 유니크한 4자리 PIN
     */
    async function generateUniquePin() {
        var maxAttempts = 20;
        for (var i = 0; i < maxAttempts; i++) {
            var pin = EDUMOLE.generatePin();
            var existing = await findSessionByPin(pin);
            if (!existing) return pin;
        }
        // 극히 드문 경우: 20번 시도 후에도 중복이면 그냥 반환
        return EDUMOLE.generatePin();
    }

    // ─── 결과 관련 ───

    /**
     * 게임 결과 저장
     * @param {string} gameType - 게임 타입
     * @param {string} sessionId - 세션 ID
     * @param {Object} resultData - 결과 데이터 (score, correctCount, 등)
     * @returns {Promise<string>} 저장된 문서 ID
     */
    async function saveResult(gameType, sessionId, resultData) {
        var data = Object.assign({}, resultData, {
            gameType: gameType || EDUMOLE.GAME_TYPES.MOLE,
            sessionId: sessionId || '',
            timestamp: Date.now(),
            submittedAt: EDUMOLE.formatDateTime()
        });

        var docRef = await EDUMOLE.getCollection(db, COLS.GAME_RESULTS).add(data);
        return docRef.id;
    }

    /**
     * 결과 조회 (필터링 지원)
     * @param {Object} [filters] - { gameType, sessionId, classId, setId }
     * @returns {Promise<Array>}
     */
    async function getResults(filters) {
        var ref = EDUMOLE.getCollection(db, COLS.GAME_RESULTS);

        if (filters) {
            if (filters.gameType) ref = ref.where('gameType', '==', filters.gameType);
            if (filters.sessionId) ref = ref.where('sessionId', '==', filters.sessionId);
            if (filters.classId) ref = ref.where('classId', '==', filters.classId);
            if (filters.setId) ref = ref.where('setId', '==', filters.setId);
        }

        var snapshot = await ref.orderBy('timestamp', 'desc').get();
        return snapshot.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
    }

    // ─── 학급/명렬표 관련 ───

    /**
     * 학급 목록 조회
     * @returns {Promise<Array>}
     */
    async function getClasses() {
        var snapshot = await EDUMOLE.getCollection(db, COLS.CLASSES).get();
        return snapshot.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
    }

    /**
     * 특정 학급의 명렬표 조회
     * @param {string} classId - 학급 ID
     * @returns {Promise<Array>}
     */
    async function getRoster(classId) {
        var snapshot = await EDUMOLE.getCollection(db, COLS.ROSTER)
            .where('classId', '==', classId)
            .get();

        return snapshot.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
    }

    /**
     * 입장코드로 학생 검증
     * @param {string} classId - 학급 ID
     * @param {string} code - 입장코드 (예: "6102홍길동")
     * @returns {Promise<Object|null>} 학생 정보 또는 null
     */
    async function verifyStudentCode(classId, code) {
        var snapshot = await EDUMOLE.getCollection(db, COLS.ROSTER)
            .where('classId', '==', classId)
            .where('code', '==', code)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        var doc = snapshot.docs[0];
        return Object.assign({ id: doc.id }, doc.data());
    }

    // 전역 객체로 노출
    window.QuizBridge = {
        // 퀴즈
        getQuizSets: getQuizSets,
        loadQuizSet: loadQuizSet,
        getNextQuestion: getNextQuestion,
        checkAnswer: checkAnswer,
        getChoices: getChoices,
        // 세션
        createSession: createSession,
        findSessionByPin: findSessionByPin,
        endSession: endSession,
        getActiveSessions: getActiveSessions,
        generateUniquePin: generateUniquePin,
        // 결과
        saveResult: saveResult,
        getResults: getResults,
        // 학급/명렬표
        getClasses: getClasses,
        getRoster: getRoster,
        verifyStudentCode: verifyStudentCode
    };
})();
