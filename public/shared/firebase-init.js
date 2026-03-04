/**
 * EduMole Pro - Firebase 초기화
 * Firebase 앱, 인증, Firestore 인스턴스를 초기화하고 전역으로 노출
 *
 * 의존: firebase-config.js (window.firebaseConfig), Firebase SDK CDN
 */
(function () {
    'use strict';

    // Firebase 설정이 없으면 에러
    if (!window.firebaseConfig) {
        console.error('firebase-config.js가 로드되지 않았습니다.');
        return;
    }

    // 중복 초기화 방지
    var app = firebase.apps.length
        ? firebase.app()
        : firebase.initializeApp(window.firebaseConfig);

    var firebaseAuth = firebase.auth();
    var firebaseDB = firebase.firestore();

    // 전역 변수로 노출 (각 게임에서 바로 사용)
    window.firebaseApp = app;
    window.firebaseAuth = firebaseAuth;
    window.firebaseDB = firebaseDB;
})();
