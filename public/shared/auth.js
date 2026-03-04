/**
 * EduMole Pro - 인증 모듈
 * 익명 로그인 + 교사 비밀번호 인증
 *
 * 의존: firebase-init.js (window.firebaseAuth)
 */
(function () {
    'use strict';

    var auth = window.firebaseAuth;
    var DEFAULT_TEACHER_PASSWORD = '0000';

    /**
     * 익명 로그인 수행
     * @returns {Promise<firebase.User>}
     */
    async function signInAnonymous() {
        try {
            var result = await auth.signInAnonymously();
            console.log('EduAuth: 익명 인증 성공');
            return result.user;
        } catch (error) {
            console.error('EduAuth: 인증 실패', error);
            throw error;
        }
    }

    /**
     * 교사 비밀번호 확인
     * @param {string} password - 입력한 비밀번호
     * @returns {boolean}
     */
    function verifyTeacher(password) {
        return password === DEFAULT_TEACHER_PASSWORD;
    }

    /**
     * 인증 상태 변경 리스너 등록
     * @param {function} callback - (user) => void
     * @returns {function} unsubscribe 함수
     */
    function onAuthChanged(callback) {
        return auth.onAuthStateChanged(callback);
    }

    /**
     * 현재 인증된 사용자 반환
     * @returns {firebase.User|null}
     */
    function getCurrentUser() {
        return auth.currentUser;
    }

    // 전역 객체로 노출
    window.EduAuth = {
        signInAnonymous: signInAnonymous,
        verifyTeacher: verifyTeacher,
        onAuthChanged: onAuthChanged,
        getCurrentUser: getCurrentUser
    };
})();
