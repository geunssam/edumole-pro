/**
 * EduMole Pro - 공유 상수 및 유틸리티
 * 모든 게임과 페이지에서 공통으로 사용하는 상수, 경로 빌더, 유틸 함수
 */
(function () {
    'use strict';

    const APP_ID = window.APP_ID || 'edu-mole-pro-v6';

    // Firestore 컬렉션 이름
    const COLLECTIONS = {
        PROBLEM_SETS: 'problemSets',
        GAME_RESULTS: 'gameResults',
        GAME_SESSIONS: 'gameSessions',
        ROSTER: 'roster',
        CLASSES: 'classes'
    };

    // 게임 세션 상태
    const SESSION_STATUS = {
        ACTIVE: 'active',
        ENDED: 'ended'
    };

    // 게임 타입
    const GAME_TYPES = {
        MOLE: 'mole',
        RUNNER: 'runner'
    };

    /**
     * Firestore 컬렉션 참조를 반환
     * 경로: artifacts/{appId}/public/data/{collectionName}
     * @param {firebase.firestore.Firestore} db - Firestore 인스턴스
     * @param {string} collectionName - 컬렉션 이름 (COLLECTIONS 상수 사용)
     * @returns {firebase.firestore.CollectionReference}
     */
    function getCollection(db, collectionName) {
        return db.collection('artifacts')
            .doc(APP_ID)
            .collection('public')
            .doc('data')
            .collection(collectionName);
    }

    /**
     * 날짜를 'YYYY-MM-DD HH:mm:ss' 형식으로 포맷
     * @param {Date|number|string} date - 날짜 (기본: 현재 시각)
     * @returns {string}
     */
    function formatDateTime(date) {
        var d = date ? new Date(date) : new Date();
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        var hours = String(d.getHours()).padStart(2, '0');
        var minutes = String(d.getMinutes()).padStart(2, '0');
        var seconds = String(d.getSeconds()).padStart(2, '0');
        return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
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
        APP_ID: APP_ID,
        COLLECTIONS: COLLECTIONS,
        SESSION_STATUS: SESSION_STATUS,
        GAME_TYPES: GAME_TYPES,
        getCollection: getCollection,
        formatDateTime: formatDateTime,
        generatePin: generatePin,
        getUrlParams: getUrlParams
    };
})();
