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
     * @param {Object} data - { title, problems, defaultGameType, settings, timeLimit, moleCount }
     * @returns {Promise<string>} 생성된 문서 ID
     */
    async function createQuizSet(data) {
        var uid = _requireTeacherUid();
        var defaultGameType = data.defaultGameType || EDUMOLE.GAME_TYPES.MOLE;
        var settings = _normalizeSettings(data.settings, defaultGameType);
        var setData = {
            title: data.title || '',
            problems: data.problems || [],
            problemCount: (data.problems || []).length,
            defaultGameType: defaultGameType,
            settings: settings,
            // 하위 호환 top-level 미러링
            timeLimit: settings.totalTimeSec,
            moleCount: settings.moleCount,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        var docRef = await EDUMOLE.getTeacherCollection(db, uid, TCOLS.QUIZ_SETS).add(setData);
        return docRef.id;
    }

    /**
     * 퀴즈 세트 수정
     * @param {string} setId
     * @param {Object} data - 수정할 필드 (defaultGameType, settings 지원)
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
        // settings가 전달되면 정규화하고 top-level 미러링 동기화
        if (data.settings) {
            var gameType = data.defaultGameType || updateData.defaultGameType || EDUMOLE.GAME_TYPES.MOLE;
            var normalized = _normalizeSettings(data.settings, gameType);
            updateData.settings = normalized;
            updateData.timeLimit = normalized.totalTimeSec;
            updateData.moleCount = normalized.moleCount;
        }
        await EDUMOLE.getTeacherCollection(db, uid, TCOLS.QUIZ_SETS).doc(setId).update(updateData);
    }

    // ─── 내부 유틸: settings 정규화/합성 ───

    /**
     * settings 입력을 게임 타입의 DEFAULT와 병합해 완전한 settings 객체를 반환
     * 구버전 키(timeLimit, quizTimeLimitSec) 폴백 포함
     * @private
     */
    function _normalizeSettings(input, gameType) {
        var gt = gameType || EDUMOLE.GAME_TYPES.MOLE;
        var defaults = EDUMOLE.GAME_DEFAULTS[gt] || EDUMOLE.GAME_DEFAULTS.mole;
        var src = input || {};

        // 구버전 키 폴백: totalTimeSec ← timeLimit, perQuestionTimeSec ← quizTimeLimitSec
        var totalTimeSec = Number(src.totalTimeSec);
        if (!(totalTimeSec > 0) && Number(src.timeLimit) > 0) totalTimeSec = Number(src.timeLimit);
        if (!(totalTimeSec > 0)) totalTimeSec = defaults.totalTimeSec;

        var perQTime = Number(src.perQuestionTimeSec);
        if (!(perQTime > 0) && Number(src.quizTimeLimitSec) > 0) perQTime = Number(src.quizTimeLimitSec);
        if (!(perQTime > 0)) perQTime = defaults.perQuestionTimeSec;

        var merged = {
            totalTimeSec: totalTimeSec,
            perQuestionTimeSec: perQTime,
            comboEnabled: (src.comboEnabled !== undefined) ? !!src.comboEnabled : (defaults.comboEnabled !== false),
            comboBonusPerLevel: Number(src.comboBonusPerLevel) || defaults.comboBonusPerLevel || 10
        };

        // 게임별 필드
        merged.moleCount = Number(src.moleCount) || defaults.moleCount || 6;
        merged.lives = Number(src.lives) || defaults.lives || 3;
        merged.quizIntervalSec = Number(src.quizIntervalSec) || defaults.quizIntervalSec || 20;

        return merged;
    }

    /**
     * 세션 또는 퀴즈 문서에서 settings를 로드해 완전한 객체 반환.
     * 게임 엔트리 포인트(mole/runner)가 호출하는 단일 폴백 지점.
     * @param {Object} sessionOrQuiz - session 문서 또는 quiz set 문서
     * @param {string} [gameType] - 명시하지 않으면 문서의 gameType/defaultGameType 사용
     * @returns {Object}
     */
    function resolveSettings(sessionOrQuiz, gameType) {
        var doc = sessionOrQuiz || {};
        var gt = gameType || doc.gameType || doc.defaultGameType || EDUMOLE.GAME_TYPES.MOLE;
        // 세션/퀴즈 doc의 settings 객체가 우선. 없으면 doc의 top-level(timeLimit 등)에서 합성
        var source = doc.settings || {
            totalTimeSec: doc.timeLimit,
            moleCount: doc.moleCount,
            quizIntervalSec: doc.quizIntervalSec,
            perQuestionTimeSec: doc.quizTimeLimitSec,
            lives: doc.lives
        };
        return _normalizeSettings(source, gt);
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

        var gameType = params.gameType || (quizSet && quizSet.defaultGameType) || EDUMOLE.GAME_TYPES.MOLE;

        // settings 우선순위: 호출자 params.settings > 퀴즈 문서 settings > 퀴즈 top-level(구버전) > GAME_DEFAULTS
        var rawSettings = params.settings
            || (quizSet && quizSet.settings)
            || (quizSet ? { totalTimeSec: quizSet.timeLimit, moleCount: quizSet.moleCount } : null);
        var settings = _normalizeSettings(rawSettings, gameType);

        var sessionData = {
            teacherId: uid,
            pin: params.pin,
            gameType: gameType,
            status: EDUMOLE.SESSION_STATUS.WAITING,
            quizSetId: params.quizSetId || '',
            quizSetTitle: params.quizSetTitle || (quizSet ? quizSet.title : ''),
            problems: quizSet ? quizSet.problems : (params.problems || []),
            classId: params.classId || '',
            className: params.className || '',
            dateStr: EDUMOLE.formatDateStr(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            settings: settings
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
     * detailedAnswers 각 항목을 공통 구조로 정규화
     * @private
     */
    function _normalizeDetailedAnswers(answers) {
        if (!answers || !answers.length) return [];
        return answers.map(function (a, idx) {
            return {
                questionIndex: (typeof a.questionIndex === 'number') ? a.questionIndex : idx,
                selectedAnswer: a.selectedAnswer || a.selected || null,
                correctAnswer: a.correctAnswer || a.answerKey || a.answer || null,
                isCorrect: !!a.isCorrect,
                timedOut: !!a.timedOut,
                elapsedMs: (typeof a.elapsedMs === 'number') ? a.elapsedMs : null
            };
        });
    }

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
            detailedAnswers: _normalizeDetailedAnswers(resultData.detailedAnswers),
            // 러너/확장 게임용 선택 필드 (하위 호환 유지)
            distance: Number(resultData.distance) || 0,
            survivalTime: Number(resultData.survivalTime) || 0,
            accuracy: Number(resultData.accuracy) || 0,
            quizCorrect: Number(resultData.quizCorrect) || (resultData.correctCount || 0),
            quizWrong: Number(resultData.quizWrong) || Math.max(0, (resultData.totalCount || 0) - (resultData.correctCount || 0)),
            maxCombo: Number(resultData.maxCombo) || 0,
            dateStr: EDUMOLE.formatDateStr(),
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        var docRef = await EDUMOLE.getTopCollection(db, TOP.RESULTS).add(data);
        return docRef.id;
    }

    /**
     * 결과 조회 (교사용 - 복합 필터 지원)
     * @param {Object} [filters] - { sessionId, classId, setId, gameType, studentCode, dateFrom, dateTo }
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
            if (filters.gameType) ref = ref.where('gameType', '==', filters.gameType);
            if (filters.studentCode) ref = ref.where('studentCode', '==', filters.studentCode);
            if (filters.dateFrom) ref = ref.where('dateStr', '>=', filters.dateFrom);
            if (filters.dateTo) ref = ref.where('dateStr', '<=', filters.dateTo);
        }

        // 복합 인덱스 의존도를 낮추기 위해 서버 orderBy 없이 조회 후 클라이언트 정렬
        var snapshot = await ref.get();
        var rows = snapshot.docs.map(function (doc) {
            return Object.assign({ id: doc.id }, doc.data());
        });

        rows.sort(function (a, b) {
            var ta = a && a.timestamp && a.timestamp.seconds ? a.timestamp.seconds : 0;
            var tb = b && b.timestamp && b.timestamp.seconds ? b.timestamp.seconds : 0;
            if (tb !== ta) return tb - ta;

            var da = a && a.dateStr ? String(a.dateStr) : '';
            var dbs = b && b.dateStr ? String(b.dateStr) : '';
            return dbs.localeCompare(da);
        });

        return rows;
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
     * 학생 추가 (중복 방지: 같은 classId + number는 upsert)
     * @param {Object} data - { name, number, classId, code }
     * @returns {Promise<string>}
     */
    async function addStudent(data) {
        var uid = _requireTeacherUid();
        var classId = data.classId || '';
        var number = Number(data.number) || 0;
        var studentData = {
            name: data.name || '',
            number: number,
            classId: classId,
            code: data.code || '',
            gender: data.gender || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        var studentsRef = EDUMOLE.getTeacherCollection(db, uid, TCOLS.STUDENTS);

        // 동일 반+번호 학생이 이미 있으면 신규 생성 대신 업데이트
        if (classId && number > 0) {
            var existing = await studentsRef
                .where('classId', '==', classId)
                .where('number', '==', number)
                .limit(1)
                .get();

            if (!existing.empty) {
                var existingDoc = existing.docs[0];
                await studentsRef.doc(existingDoc.id).update({
                    name: studentData.name,
                    code: studentData.code,
                    gender: studentData.gender
                });
                await _updateStudentCount(uid, classId);
                return existingDoc.id;
            }
        }

        var docRef = await studentsRef.add(studentData);

        // 학급의 studentCount 업데이트
        if (classId) {
            await _updateStudentCount(uid, classId);
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
        resolveSettings: resolveSettings,
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
