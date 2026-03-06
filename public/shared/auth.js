/**
 * EduMole Pro - 인증 모듈
 * Google OAuth 교사 로그인 + 익명 인증 (학생)
 *
 * v2: Google OAuth 추가, 교사 프로필 자동 생성
 *
 * 의존: firebase-init.js (window.firebaseAuth, window.firebaseDB)
 *       constants.js (window.EDUMOLE)
 */
(function () {
    'use strict';

    var auth = window.firebaseAuth;
    var db = window.firebaseDB;
    var EDUMOLE = window.EDUMOLE;

    // Google 프로바이더 (팝업 로그인용)
    var googleProvider = new firebase.auth.GoogleAuthProvider();

    // ─── 인증 상태 초기화 Promise ───
    // onAuthStateChanged의 첫 콜백을 Promise로 래핑하여
    // 다른 페이지에서 auth 상태가 완전히 복원된 후에 판단할 수 있게 함
    var _authReadyResolve;
    var authReady = new Promise(function (resolve) { _authReadyResolve = resolve; });
    var _authReadyFired = false;
    auth.onAuthStateChanged(function (user) {
        if (!_authReadyFired) {
            _authReadyFired = true;
            _authReadyResolve(user);
        }
    });

    // ─── 교사 인증 (Google OAuth) ───

    /**
     * Google 팝업 로그인 — 팝업에서 인증 완료 후 결과 직접 반환
     * 크로스 오리진 iframe 이슈 없이 안정적으로 동작
     * @returns {Promise<firebase.User>}
     */
    async function signInWithGoogle() {
        var result = await auth.signInWithPopup(googleProvider);
        if (result.user) {
            await _upsertTeacherProfile(result.user);
            console.log('EduAuth: Google 팝업 로그인 성공 -', result.user.displayName);
        }
        return result.user;
    }

    /**
     * 리다이렉트 로그인 결과 처리
     * hub.html 등 리다이렉트 대상 페이지에서만 호출
     * @returns {Promise<firebase.User|null>}
     */
    async function processRedirect() {
        try {
            var result = await auth.getRedirectResult();
            if (result.user) {
                await _upsertTeacherProfile(result.user);
                console.log('EduAuth: Google 리다이렉트 로그인 성공 -', result.user.displayName);
            }
            return result.user || null;
        } catch (error) {
            console.error('EduAuth: 리다이렉트 결과 처리 실패', error);
            return null;
        }
    }

    /**
     * 교사 프로필 생성 또는 갱신 (merge: true)
     * @param {firebase.User} user
     * @private
     */
    async function _upsertTeacherProfile(user) {
        var teacherRef = EDUMOLE.getTeacherDoc(db, user.uid);
        await teacherRef.set({
            email: user.email || '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 최초 가입 시 createdAt 추가 (merge로 기존 값 유지)
        var doc = await teacherRef.get();
        if (!doc.data().createdAt) {
            await teacherRef.update({
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    }

    /**
     * 현재 로그인한 교사의 프로필 조회
     * @returns {Promise<Object|null>}
     */
    async function getTeacherProfile() {
        var user = auth.currentUser;
        if (!user) return null;

        var doc = await EDUMOLE.getTeacherDoc(db, user.uid).get();
        if (!doc.exists) return null;
        return Object.assign({ uid: doc.id }, doc.data());
    }

    /**
     * 현재 사용자가 교사인지 확인 (Google 계정 로그인 여부)
     * @returns {boolean}
     */
    function isTeacher() {
        var user = auth.currentUser;
        return user != null && !user.isAnonymous;
    }

    // ─── 학생 인증 (익명) ───

    /**
     * 익명 로그인 수행 (학생용)
     * @returns {Promise<firebase.User>}
     */
    async function signInAnonymous() {
        try {
            var result = await auth.signInAnonymously();
            console.log('EduAuth: 익명 인증 성공');
            return result.user;
        } catch (error) {
            console.error('EduAuth: 익명 인증 실패', error);
            throw error;
        }
    }

    // ─── 공통 ───

    /**
     * 로그아웃
     * @returns {Promise<void>}
     */
    async function signOut() {
        try {
            await auth.signOut();
            console.log('EduAuth: 로그아웃 완료');
        } catch (error) {
            console.error('EduAuth: 로그아웃 실패', error);
            throw error;
        }
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

    /**
     * 현재 교사 UID 반환 (비로그인 시 null)
     * @returns {string|null}
     */
    function getTeacherUid() {
        var user = auth.currentUser;
        if (!user || user.isAnonymous) return null;
        return user.uid;
    }

    // 전역 객체로 노출
    window.EduAuth = {
        // 교사
        signInWithGoogle: signInWithGoogle,
        processRedirect: processRedirect,
        getTeacherProfile: getTeacherProfile,
        isTeacher: isTeacher,
        getTeacherUid: getTeacherUid,
        // 학생
        signInAnonymous: signInAnonymous,
        // 공통
        signOut: signOut,
        onAuthChanged: onAuthChanged,
        onAuthReady: authReady,
        getCurrentUser: getCurrentUser
    };
})();
