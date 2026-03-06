/**
 * EduMole Pro - QuizBridge (핵심 데이터 모듈)
 * 퀴즈 세트 관리, 세션 관리, 결과 저장/조회, 학급/명렬표
 *
 * v2: 교사 중심 데이터 모델
 *   - 퀴즈/학급/학생 → teachers/{uid}/ 하위 컬렉션
 *   - 세션/결과 → 최상위 컬렉션
 *
 * 의존: constants.js (window.EDUMOLE), firebase-init.js (window.firebaseDB),
 *       auth.js (window.EduAuth)
 */
(function () {
    'use strict';

    var db = window.firebaseDB;
    var EDUMOLE = window.EDUMOLE;
    var TCOLS = EDUMOLE.TEACHER_SUBCOLLECTIONS;
    var TOP = EDUMOLE.TOP_COLLECTIONS;

    /**
     * 현재 교사 UID를 반환 (없으면 에러)
     * @private
     */
    function _requireTeacherUid() {
        var uid = window.EduAuth.getTeacherUid();
        if (!uid) throw new Error('QuizBridge: 교사 로그인이 필요합니다.');
        return uid;
    }

    // ═══════════════════════════════════════
    //  퀴즈 세트 (teachers/{uid}/quizSets)
    // ═══════════════════════════════════════

    /**
     * 퀴즈 세트 목록 조회
     * @returns {Promise<Array>}
     */
    async function getQuizSets() {
        var uid = _requireTeacherUid();
        var snapshot = await EDUMOLE.getTeacherCollection(db, uid, TCOLS.QUIZ_SETS).get();
        return snapshot.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
    }

    /**
     * 특정 퀴즈 세트 로드
     * @param {string} setId
     * @returns {Promise<Object|null>}
     */
    async function loadQuizSet(setId) {
        var uid = _requireTeacherUid();
        var doc = await EDUMOLE.getTeacherCollection(db, uid, TCOLS.QUIZ_SETS).doc(setId).get();
        if (!doc.exists) return null;
        return Object.assign({ id: doc.id }, doc.data());
    }

    /**
     * 퀴즈 세트 생성
     * @param {Object} data - { title, problems, timeLimit }
     * @returns {Promise<string>} 생성된 문서 ID
     */
    async function createQuizSet(data) {
        var uid = _requireTeacherUid();
        var setData = {
            title: data.title || '',
            problems: data.problems || [],
            problemCount: (data.problems || []).length,
            timeLimit: data.timeLimit || 30,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        var docRef = await EDUMOLE.getTeacherCollection(db, uid, TCOLS.QUIZ_SETS).add(setData);
        return docRef.id;
    }

    /**
     * 퀴즈 세트 수정
     * @param {string} setId
     * @param {Object} data - 수정할 필드
     * @returns {Promise<void>}
     */
    async function updateQuizSet(setId, data) {
        var uid = _requireTeacherUid();
        var updateData = Object.assign({}, data, {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        if (data.problems) {
            updateData.problemCount = data.problems.length;
        }
        await EDUMOLE.getTeacherCollection(db, uid, TCOLS.QUIZ_SETS).doc(setId).update(updateData);
    }

    /**
     * 퀴즈 세트 삭제
     * @param {string} setId
     * @returns {Promise<void>}
     */
    async function deleteQuizSet(setId) {
        var uid = _requireTeacherUid();
        await EDUMOLE.getTeacherCollection(db, uid, TCOLS.QUIZ_SETS).doc(setId).delete();
    }

    // ─── 퀴즈 유틸리티 (순수 함수, DB 무관) ───

    /**
     * 다음 문제 가져오기
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
            if (nextIndex >= problems.length) return null;
        }

        return { question: problems[nextIndex], index: nextIndex };
    }

    /**
     * 정답 확인
     */
    function checkAnswer(problems, questionIndex, answer) {
        if (!problems || !problems[questionIndex]) return false;
        return problems[questionIndex].answer === answer;
    }

    /**
     * 선택지 생성 (정답 + 오답 섞기)
     */
    function getChoices(problems, questionIndex) {
        if (!problems || !problems[questionIndex]) return [];
        var q = problems[questionIndex];
        var choices = [q.answer].concat(q.distractors || []);
        for (var i = choices.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = choices[i];
            choices[i] = choices[j];
            choices[j] = temp;
        }
        return choices;
    }

    // ═══════════════════════════════════════
    //  세션 (sessions/ 최상위)
    // ═══════════════════════════════════════

    /**
     * 게임 세션 생성
     * @param {Object} params
     * @returns {Promise<string>} 생성된 세션 ID
     */
    async function createSession(params) {
        var uid = _requireTeacherUid();

        // 퀴즈 데이터를 세션에 복사 (학생은 이 문서만 읽으면 됨)
        var quizSet = null;
        if (params.quizSetId) {
            quizSet = await loadQuizSet(params.quizSetId);
        }

        var sessionData = {
            teacherId: uid,
            pin: params.pin,
            gameType: params.gameType || EDUMOLE.GAME_TYPES.MOLE,
            status: EDUMOLE.SESSION_STATUS.WAITING,
            quizSetId: params.quizSetId || '',
            quizSetTitle: params.quizSetTitle || (quizSet ? quizSet.title : ''),
            problems: quizSet ? quizSet.problems : (params.problems || []),
            classId: params.classId || '',
            className: params.className || '',
            dateStr: EDUMOLE.formatDateStr(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            settings: params.settings || EDUMOLE.GAME_DEFAULTS[params.gameType || 'mole'] || {}
        };

        var docRef = await EDUMOLE.getTopCollection(db, TOP.SESSIONS).add(sessionData);
        return docRef.id;
    }

    /**
     * PIN으로 활성 세션 조회 (학생용 - 인증 불필요)
     * @param {string} pin
     * @returns {Promise<Object|null>}
     */
    async function findSessionByPin(pin) {
        var snapshot = await EDUMOLE.getTopCollection(db, TOP.SESSIONS)
            .where('pin', '==', pin)
            .where('status', 'in', [EDUMOLE.SESSION_STATUS.WAITING, EDUMOLE.SESSION_STATUS.PLAYING])
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        var doc = snapshot.docs[0];
        return Object.assign({ id: doc.id }, doc.data());
    }

    /**
     * 세션 ID로 직접 조회 (학생용 - 인증 불필요)
     * 게임 페이지에서 URL 파라미터의 sessionId로 세션을 로드할 때 사용
     * @param {string} sessionId
     * @returns {Promise<Object|null>}
     */
    async function getSessionById(sessionId) {
        var doc = await EDUMOLE.getTopCollection(db, TOP.SESSIONS).doc(sessionId).get();
        if (!doc.exists) return null;
        return Object.assign({ id: doc.id }, doc.data());
    }

    /**
     * 세션 상태 업데이트
     * @param {string} sessionId
     * @param {string} status - SESSION_STATUS 값
     * @returns {Promise<void>}
     */
    async function updateSessionStatus(sessionId, status) {
        await EDUMOLE.getTopCollection(db, TOP.SESSIONS).doc(sessionId).update({
            status: status
        });
    }

    /**
     * 세션 종료
     * @param {string} sessionId
     * @returns {Promise<void>}
     */
    async function endSession(sessionId) {
        await updateSessionStatus(sessionId, EDUMOLE.SESSION_STATUS.ENDED);
    }

    /**
     * 교사의 세션 히스토리 조회
     * @param {Object} [filters] - { dateFrom, dateTo }
     * @returns {Promise<Array>}
     */
    async function getSessionHistory(filters) {
        var uid = _requireTeacherUid();
        var ref = EDUMOLE.getTopCollection(db, TOP.SESSIONS)
            .where('teacherId', '==', uid);

        if (filters && filters.dateFrom) {
            ref = ref.where('dateStr', '>=', filters.dateFrom);
        }
        if (filters && filters.dateTo) {
            ref = ref.where('dateStr', '<=', filters.dateTo);
        }

        var snapshot = await ref.orderBy('dateStr', 'desc').get();
        return snapshot.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
    }

    /**
     * 사용 가능한 유니크 PIN 생성
     * @returns {Promise<string>}
     */
    async function generateUniquePin() {
        var maxAttempts = 20;
        for (var i = 0; i < maxAttempts; i++) {
            var pin = EDUMOLE.generatePin();
            var existing = await findSessionByPin(pin);
            if (!existing) return pin;
        }
        return EDUMOLE.generatePin();
    }

    // ═══════════════════════════════════════
    //  결과 (results/ 최상위)
    // ═══════════════════════════════════════

    /**
     * 게임 결과 저장 (학생이 호출 - 인증 불필요)
     * @param {Object} resultData
     * @returns {Promise<string>}
     */
    async function saveResult(resultData) {
        var data = {
            teacherId: resultData.teacherId || '',
            sessionId: resultData.sessionId || '',
            classId: resultData.classId || '',
            setId: resultData.setId || '',
            studentName: resultData.studentName || '',
            studentCode: resultData.studentCode || '',
            gameType: resultData.gameType || EDUMOLE.GAME_TYPES.MOLE,
            className: resultData.className || '',
            quizSetTitle: resultData.quizSetTitle || '',
            score: resultData.score || 0,
            correctCount: resultData.correctCount || 0,
            totalCount: resultData.totalCount || 0,
            detailedAnswers: resultData.detailedAnswers || [],
            dateStr: EDUMOLE.formatDateStr(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        var docRef = await EDUMOLE.getTopCollection(db, TOP.RESULTS).add(data);
        return docRef.id;
    }

    /**
     * 결과 조회 (교사용 - 복합 필터 지원)
     * @param {Object} [filters] - { sessionId, classId, setId, studentCode, dateFrom, dateTo }
     * @returns {Promise<Array>}
     */
    async function getResults(filters) {
        var uid = _requireTeacherUid();
        var ref = EDUMOLE.getTopCollection(db, TOP.RESULTS)
            .where('teacherId', '==', uid);

        if (filters) {
            if (filters.sessionId) ref = ref.where('sessionId', '==', filters.sessionId);
            if (filters.classId) ref = ref.where('classId', '==', filters.classId);
            if (filters.setId) ref = ref.where('setId', '==', filters.setId);
            if (filters.studentCode) ref = ref.where('studentCode', '==', filters.studentCode);
            if (filters.dateFrom) ref = ref.where('dateStr', '>=', filters.dateFrom);
            if (filters.dateTo) ref = ref.where('dateStr', '<=', filters.dateTo);
        }

        // studentCode 필터 시 timestamp 정렬, 나머지는 dateStr 정렬
        var snapshot;
        if (filters && filters.studentCode) {
            snapshot = await ref.orderBy('timestamp', 'desc').get();
        } else {
            snapshot = await ref.orderBy('dateStr', 'desc').get();
        }

        return snapshot.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
    }

    // ═══════════════════════════════════════
    //  학급 (teachers/{uid}/classes)
    // ═══════════════════════════════════════

    /**
     * 학급 목록 조회
     * @returns {Promise<Array>}
     */
    async function getClasses() {
        var uid = _requireTeacherUid();
        var snapshot = await EDUMOLE.getTeacherCollection(db, uid, TCOLS.CLASSES).get();
        return snapshot.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
    }

    /**
     * 학급 생성
     * @param {Object} data - { name, grade, classNum, year }
     * @returns {Promise<string>}
     */
    async function createClass(data) {
        var uid = _requireTeacherUid();
        var classData = {
            name: data.name || '',
            grade: Number(data.grade) || 0,
            classNum: Number(data.classNum) || 0,
            year: data.year || new Date().getFullYear(),
            studentCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        var docRef = await EDUMOLE.getTeacherCollection(db, uid, TCOLS.CLASSES).add(classData);
        return docRef.id;
    }

    /**
     * 학급 수정
     * @param {string} classId
     * @param {Object} data
     * @returns {Promise<void>}
     */
    async function updateClass(classId, data) {
        var uid = _requireTeacherUid();
        await EDUMOLE.getTeacherCollection(db, uid, TCOLS.CLASSES).doc(classId).update(data);
    }

    /**
     * 학급 삭제
     * @param {string} classId
     * @returns {Promise<void>}
     */
    async function deleteClass(classId) {
        var uid = _requireTeacherUid();
        await EDUMOLE.getTeacherCollection(db, uid, TCOLS.CLASSES).doc(classId).delete();
    }

    // ═══════════════════════════════════════
    //  학생 명렬표 (teachers/{uid}/students)
    // ═══════════════════════════════════════

    /**
     * 특정 학급의 학생 목록 조회
     * @param {string} classId
     * @returns {Promise<Array>}
     */
    async function getStudents(classId) {
        var uid = _requireTeacherUid();
        var snapshot = await EDUMOLE.getTeacherCollection(db, uid, TCOLS.STUDENTS)
            .where('classId', '==', classId)
            .get();

        return snapshot.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });
    }

    /**
     * 학생 추가
     * @param {Object} data - { name, number, classId, code }
     * @returns {Promise<string>}
     */
    async function addStudent(data) {
        var uid = _requireTeacherUid();
        var studentData = {
            name: data.name || '',
            number: Number(data.number) || 0,
            classId: data.classId || '',
            code: data.code || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        var docRef = await EDUMOLE.getTeacherCollection(db, uid, TCOLS.STUDENTS).add(studentData);

        // 학급의 studentCount 업데이트
        if (data.classId) {
            await _updateStudentCount(uid, data.classId);
        }

        return docRef.id;
    }

    /**
     * 학생 삭제
     * @param {string} studentId
     * @param {string} classId - 학급 ID (studentCount 갱신용)
     * @returns {Promise<void>}
     */
    async function removeStudent(studentId, classId) {
        var uid = _requireTeacherUid();
        await EDUMOLE.getTeacherCollection(db, uid, TCOLS.STUDENTS).doc(studentId).delete();

        if (classId) {
            await _updateStudentCount(uid, classId);
        }
    }

    /**
     * 학급의 학생 수 갱신 (비정규화 캐시)
     * @private
     */
    async function _updateStudentCount(uid, classId) {
        var snapshot = await EDUMOLE.getTeacherCollection(db, uid, TCOLS.STUDENTS)
            .where('classId', '==', classId)
            .get();

        await EDUMOLE.getTeacherCollection(db, uid, TCOLS.CLASSES).doc(classId).update({
            studentCount: snapshot.size
        });
    }

    /**
     * 입장코드로 학생 검증 (학생 입장 시 사용)
     * 세션 정보로 교사 UID를 얻어 검증
     * @param {string} teacherUid - 세션의 teacherId
     * @param {string} classId
     * @param {string} code - 입장코드
     * @returns {Promise<Object|null>}
     */
    async function verifyStudentCode(teacherUid, classId, code) {
        var snapshot = await EDUMOLE.getTeacherCollection(db, teacherUid, TCOLS.STUDENTS)
            .where('classId', '==', classId)
            .where('code', '==', code)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        var doc = snapshot.docs[0];
        return Object.assign({ id: doc.id }, doc.data());
    }

    // ─── 하위 호환 래퍼 ───

    /** @deprecated getRoster → getStudents */
    var getRoster = getStudents;

    // 전역 객체로 노출
    window.QuizBridge = {
        // 퀴즈
        getQuizSets: getQuizSets,
        loadQuizSet: loadQuizSet,
        createQuizSet: createQuizSet,
        updateQuizSet: updateQuizSet,
        deleteQuizSet: deleteQuizSet,
        getNextQuestion: getNextQuestion,
        checkAnswer: checkAnswer,
        getChoices: getChoices,
        // 세션
        createSession: createSession,
        findSessionByPin: findSessionByPin,
        getSessionById: getSessionById,
        updateSessionStatus: updateSessionStatus,
        endSession: endSession,
        getSessionHistory: getSessionHistory,
        generateUniquePin: generateUniquePin,
        // 결과
        saveResult: saveResult,
        getResults: getResults,
        // 학급
        getClasses: getClasses,
        createClass: createClass,
        updateClass: updateClass,
        deleteClass: deleteClass,
        // 학생
        getStudents: getStudents,
        addStudent: addStudent,
        removeStudent: removeStudent,
        verifyStudentCode: verifyStudentCode,
        // 하위 호환
        getRoster: getRoster
    };
})();
