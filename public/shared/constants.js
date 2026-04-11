/**
 * EduMole Pro - 공유 상수 및 유틸리티
 * 모든 게임과 페이지에서 공통으로 사용하는 상수, 경로 빌더, 유틸 함수
 *
 * v2: 교사 중심 데이터 모델 (Google OAuth)
 */
(function () {
    'use strict';

    // ─── 컬렉션 이름 ───

    // 교사 하위 컬렉션 (teachers/{uid}/...)
    var TEACHER_SUBCOLLECTIONS = {
        CLASSES: 'classes',
        STUDENTS: 'students',
        QUIZ_SETS: 'quizSets'
    };

    // 최상위 컬렉션
    var TOP_COLLECTIONS = {
        TEACHERS: 'teachers',
        SESSIONS: 'sessions',
        RESULTS: 'results'
    };

    // 하위 호환용 (기존 코드가 COLLECTIONS 참조)
    var COLLECTIONS = {
        PROBLEM_SETS: 'quizSets',
        GAME_RESULTS: 'results',
        GAME_SESSIONS: 'sessions',
        ROSTER: 'students',
        CLASSES: 'classes'
    };

    // 게임 세션 상태
    var SESSION_STATUS = {
        WAITING: 'waiting',
        PLAYING: 'playing',
        ENDED: 'ended'
    };

    // 게임 타입
    var GAME_TYPES = {
        MOLE: 'mole',
        RUNNER: 'runner'
    };

    // 게임별 기본 설정값 (v3: 통일 스키마)
    // 공통: totalTimeSec, perQuestionTimeSec, comboEnabled, comboBonusPerLevel
    // 게임별: moleCount(두더지), lives/quizIntervalSec(러너)
    var GAME_DEFAULTS = {
        mole: {
            totalTimeSec: 60,
            perQuestionTimeSec: 8,
            comboEnabled: true,
            comboBonusPerLevel: 10,
            moleCount: 6
        },
        runner: {
            totalTimeSec: 180,
            perQuestionTimeSec: 7,
            comboEnabled: true,
            comboBonusPerLevel: 10,
            lives: 3,
            quizIntervalSec: 20
        }
    };

    // 기존 경로 (마이그레이션용)
    var LEGACY_APP_ID = 'edu-mole-pro-v6';

    // ─── 경로 빌더 ───

    /**
     * 교사 프로필 문서 참조
     * @param {firebase.firestore.Firestore} db
     * @param {string} uid - 교사 UID
     * @returns {firebase.firestore.DocumentReference}
     */
    function getTeacherDoc(db, uid) {
        return db.collection('teachers').doc(uid);
    }

    /**
     * 교사 하위 컬렉션 참조
     * 경로: teachers/{uid}/{subcollection}
     * @param {firebase.firestore.Firestore} db
     * @param {string} uid - 교사 UID
     * @param {string} subcollection - 하위 컬렉션 이름 (TEACHER_SUBCOLLECTIONS)
     * @returns {firebase.firestore.CollectionReference}
     */
    function getTeacherCollection(db, uid, subcollection) {
        return db.collection('teachers').doc(uid).collection(subcollection);
    }

    /**
     * 최상위 컬렉션 참조 (sessions, results)
     * @param {firebase.firestore.Firestore} db
     * @param {string} collectionName - 컬렉션 이름 (TOP_COLLECTIONS)
     * @returns {firebase.firestore.CollectionReference}
     */
    function getTopCollection(db, collectionName) {
        return db.collection(collectionName);
    }

    /**
     * [하위 호환] 기존 Firestore 경로 참조
     * 경로: artifacts/{appId}/public/data/{collectionName}
     * @param {firebase.firestore.Firestore} db
     * @param {string} collectionName
     * @returns {firebase.firestore.CollectionReference}
     */
    function getLegacyCollection(db, collectionName) {
        return db.collection('artifacts')
            .doc(LEGACY_APP_ID)
            .collection('public')
            .doc('data')
            .collection(collectionName);
    }

    // ─── 유틸리티 ───

    /**
     * 날짜를 'YYYY-MM-DD' 형식으로 포맷 (필터링용)
     * @param {Date|number|string} date - 날짜 (기본: 현재)
     * @returns {string}
     */
    function formatDateStr(date) {
        var d = date ? new Date(date) : new Date();
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    /**
     * 날짜를 'YYYY-MM-DD HH:mm:ss' 형식으로 포맷
     * @param {Date|number|string} date - 날짜 (기본: 현재 시각)
     * @returns {string}
     */
    function formatDateTime(date) {
        var d = date ? new Date(date) : new Date();
        return formatDateStr(d) + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0') + ':' +
            String(d.getSeconds()).padStart(2, '0');
    }

    /**
     * 학생 입장코드 생성
     * 형식: 연도2자리 + 학년 + 반2자리 + 번호2자리 + 이름
     * 예: "26060201홍길동" (2026년 6학년 2반 1번 홍길동)
     * @param {number} year - 학년도 (예: 2026)
     * @param {number} grade - 학년
     * @param {number} classNum - 반
     * @param {number} number - 번호
     * @param {string} name - 이름
     * @returns {string}
     */
    function generateStudentCode(year, grade, classNum, number, name) {
        var y = String(year).slice(-2);
        var g = String(grade);
        var c = String(classNum).padStart(2, '0');
        var n = String(number).padStart(2, '0');
        return y + g + c + n + name;
    }

    /**
     * 4자리 랜덤 PIN 생성 (0000~9999)
     * @returns {string}
     */
    function generatePin() {
        return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    }

    /**
     * URL 파라미터를 객체로 파싱
     * @returns {Object}
     */
    function getUrlParams() {
        var params = new URLSearchParams(window.location.search);
        var result = {};
        params.forEach(function (value, key) {
            result[key] = value;
        });
        return result;
    }

    // 전역 객체로 노출
    window.EDUMOLE = {
        // 컬렉션 상수
        TEACHER_SUBCOLLECTIONS: TEACHER_SUBCOLLECTIONS,
        TOP_COLLECTIONS: TOP_COLLECTIONS,
        COLLECTIONS: COLLECTIONS,
        SESSION_STATUS: SESSION_STATUS,
        GAME_TYPES: GAME_TYPES,
        GAME_DEFAULTS: GAME_DEFAULTS,
        LEGACY_APP_ID: LEGACY_APP_ID,

        // 경로 빌더
        getTeacherDoc: getTeacherDoc,
        getTeacherCollection: getTeacherCollection,
        getTopCollection: getTopCollection,
        getLegacyCollection: getLegacyCollection,

        // 유틸리티
        formatDateStr: formatDateStr,
        formatDateTime: formatDateTime,
        generateStudentCode: generateStudentCode,
        generatePin: generatePin,
        getUrlParams: getUrlParams
    };
})();
