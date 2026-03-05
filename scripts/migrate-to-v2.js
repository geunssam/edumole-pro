/**
 * EduMole Pro - v1 → v2 데이터 마이그레이션 스크립트
 *
 * 기존 경로: artifacts/edu-mole-pro-v6/public/data/{collection}
 * 새 경로:   teachers/{uid}/...  +  results/  +  sessions/
 *
 * 사용법:
 *   1. Firebase Admin SDK 설치: npm install firebase-admin
 *   2. 서비스 계정 키 다운로드 → serviceAccountKey.json
 *   3. 실행: node scripts/migrate-to-v2.js <teacherUid>
 *
 * 또는 브라우저에서 교사 로그인 후 마이그레이션 함수 호출
 */

// ─── Node.js 환경 감지 ───
var isNode = typeof window === 'undefined';

if (isNode) {
    // Node.js에서 실행 (Admin SDK)
    runNodeMigration();
} else {
    // 브라우저에서 실행 (클라이언트 SDK)
    window.MigrateV2 = {
        run: runBrowserMigration,
        dryRun: function (uid) { return runBrowserMigration(uid, true); }
    };
}

// ═══════════════════════════════════════════
//  Node.js Admin SDK 마이그레이션
// ═══════════════════════════════════════════

async function runNodeMigration() {
    var admin = require('firebase-admin');
    var path = require('path');

    // 서비스 계정 키 경로
    var keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    try {
        var serviceAccount = require(keyPath);
    } catch (e) {
        console.error('serviceAccountKey.json을 찾을 수 없습니다.');
        console.error('Firebase 콘솔 → 프로젝트 설정 → 서비스 계정에서 다운로드하세요.');
        process.exit(1);
    }

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    var db = admin.firestore();
    var teacherUid = process.argv[2];

    if (!teacherUid) {
        console.error('사용법: node scripts/migrate-to-v2.js <teacherUid>');
        process.exit(1);
    }

    console.log('=== EduMole Pro v1 → v2 마이그레이션 시작 ===');
    console.log('교사 UID:', teacherUid);

    var legacyBase = db.collection('artifacts').doc('edu-mole-pro-v6')
        .collection('public').doc('data');

    var stats = { classes: 0, students: 0, quizSets: 0, results: 0 };

    // 1. classes → teachers/{uid}/classes
    console.log('\n[1/4] 학급 마이그레이션...');
    var classesSnap = await legacyBase.collection('classes').get();
    var classIdMap = {}; // 기존 ID → 새 ID 매핑

    for (var i = 0; i < classesSnap.docs.length; i++) {
        var doc = classesSnap.docs[i];
        var data = doc.data();
        var newData = {
            name: data.name || '',
            grade: Number(data.grade) || 0,
            classNum: Number(data.classNum) || 0,
            year: data.year || 2026,
            studentCount: 0,
            createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp()
        };

        // 같은 ID로 생성 (참조 유지)
        await db.collection('teachers').doc(teacherUid)
            .collection('classes').doc(doc.id).set(newData);
        classIdMap[doc.id] = doc.id;
        stats.classes++;
        console.log('  ✓', newData.name);
    }

    // 2. roster → teachers/{uid}/students
    console.log('\n[2/4] 학생 명렬표 마이그레이션...');
    var rosterSnap = await legacyBase.collection('roster').get();

    for (var i = 0; i < rosterSnap.docs.length; i++) {
        var doc = rosterSnap.docs[i];
        var data = doc.data();
        var newData = {
            name: data.name || '',
            number: Number(data.number) || 0,
            classId: data.classId || '',
            code: data.code || '',
            createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('teachers').doc(teacherUid)
            .collection('students').doc(doc.id).set(newData);
        stats.students++;
    }
    console.log('  ✓', stats.students, '명 완료');

    // 학급별 studentCount 갱신
    for (var classId in classIdMap) {
        var countSnap = await db.collection('teachers').doc(teacherUid)
            .collection('students').where('classId', '==', classId).get();
        await db.collection('teachers').doc(teacherUid)
            .collection('classes').doc(classId).update({
                studentCount: countSnap.size
            });
    }

    // 3. problemSets → teachers/{uid}/quizSets
    console.log('\n[3/4] 퀴즈 세트 마이그레이션...');
    var setsSnap = await legacyBase.collection('problemSets').get();

    for (var i = 0; i < setsSnap.docs.length; i++) {
        var doc = setsSnap.docs[i];
        var data = doc.data();
        var problems = data.problems || [];
        var newData = {
            title: data.title || '',
            problems: problems,
            problemCount: problems.length,
            timeLimit: data.timeLimit || 30,
            createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('teachers').doc(teacherUid)
            .collection('quizSets').doc(doc.id).set(newData);
        stats.quizSets++;
        console.log('  ✓', newData.title, '(' + newData.problemCount + '문항)');
    }

    // 4. gameResults → results (최상위)
    console.log('\n[4/4] 게임 결과 마이그레이션...');
    var resultsSnap = await legacyBase.collection('gameResults').get();

    for (var i = 0; i < resultsSnap.docs.length; i++) {
        var doc = resultsSnap.docs[i];
        var data = doc.data();

        // dateStr 생성 (timestamp에서 추출)
        var dateStr = '';
        if (data.timestamp) {
            var ts = typeof data.timestamp === 'number'
                ? new Date(data.timestamp)
                : data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
            var y = ts.getFullYear();
            var m = String(ts.getMonth() + 1).padStart(2, '0');
            var d = String(ts.getDate()).padStart(2, '0');
            dateStr = y + '-' + m + '-' + d;
        }

        var newData = {
            teacherId: teacherUid,
            sessionId: data.sessionId || '',
            classId: data.classId || '',
            setId: data.setId || '',
            studentName: data.studentName || data.name || '',
            studentCode: data.studentCode || data.code || '',
            gameType: data.gameType || 'mole',
            className: data.className || '',
            quizSetTitle: data.quizSetTitle || data.setTitle || '',
            score: data.score || 0,
            correctCount: data.correctCount || 0,
            totalCount: data.totalCount || 0,
            detailedAnswers: data.detailedAnswers || [],
            dateStr: dateStr,
            timestamp: data.timestamp || admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('results').doc(doc.id).set(newData);
        stats.results++;
    }
    console.log('  ✓', stats.results, '건 완료');

    // 결과 요약
    console.log('\n=== 마이그레이션 완료 ===');
    console.log('학급:', stats.classes);
    console.log('학생:', stats.students);
    console.log('퀴즈 세트:', stats.quizSets);
    console.log('게임 결과:', stats.results);

    process.exit(0);
}

// ═══════════════════════════════════════════
//  브라우저 클라이언트 SDK 마이그레이션
// ═══════════════════════════════════════════

/**
 * 브라우저에서 마이그레이션 실행
 * @param {string} teacherUid - 교사 UID
 * @param {boolean} [dryRun=false] - true면 실제 쓰기 없이 카운트만
 * @returns {Promise<Object>} 마이그레이션 결과 통계
 */
async function runBrowserMigration(teacherUid, dryRun) {
    if (!teacherUid) throw new Error('teacherUid가 필요합니다.');

    var db = window.firebaseDB;
    var EDUMOLE = window.EDUMOLE;
    var legacyBase = EDUMOLE.getLegacyCollection;

    var stats = { classes: 0, students: 0, quizSets: 0, results: 0, errors: [] };

    console.log('[MigrateV2]', dryRun ? 'DRY RUN' : '실행', '시작...');

    try {
        // 1. classes
        var classesSnap = await legacyBase(db, 'classes').get();
        for (var i = 0; i < classesSnap.docs.length; i++) {
            var doc = classesSnap.docs[i];
            var data = doc.data();
            if (!dryRun) {
                await EDUMOLE.getTeacherCollection(db, teacherUid, 'classes')
                    .doc(doc.id).set({
                        name: data.name || '',
                        grade: Number(data.grade) || 0,
                        classNum: Number(data.classNum) || 0,
                        year: data.year || 2026,
                        studentCount: 0,
                        createdAt: data.createdAt || firebase.firestore.FieldValue.serverTimestamp()
                    });
            }
            stats.classes++;
        }

        // 2. roster → students
        var rosterSnap = await legacyBase(db, 'roster').get();
        for (var i = 0; i < rosterSnap.docs.length; i++) {
            var doc = rosterSnap.docs[i];
            var data = doc.data();
            if (!dryRun) {
                await EDUMOLE.getTeacherCollection(db, teacherUid, 'students')
                    .doc(doc.id).set({
                        name: data.name || '',
                        number: Number(data.number) || 0,
                        classId: data.classId || '',
                        code: data.code || '',
                        createdAt: data.createdAt || firebase.firestore.FieldValue.serverTimestamp()
                    });
            }
            stats.students++;
        }

        // studentCount 갱신
        if (!dryRun) {
            for (var i = 0; i < classesSnap.docs.length; i++) {
                var classId = classesSnap.docs[i].id;
                var countSnap = await EDUMOLE.getTeacherCollection(db, teacherUid, 'students')
                    .where('classId', '==', classId).get();
                await EDUMOLE.getTeacherCollection(db, teacherUid, 'classes')
                    .doc(classId).update({ studentCount: countSnap.size });
            }
        }

        // 3. problemSets → quizSets
        var setsSnap = await legacyBase(db, 'problemSets').get();
        for (var i = 0; i < setsSnap.docs.length; i++) {
            var doc = setsSnap.docs[i];
            var data = doc.data();
            var problems = data.problems || [];
            if (!dryRun) {
                await EDUMOLE.getTeacherCollection(db, teacherUid, 'quizSets')
                    .doc(doc.id).set({
                        title: data.title || '',
                        problems: problems,
                        problemCount: problems.length,
                        timeLimit: data.timeLimit || 30,
                        createdAt: data.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
            }
            stats.quizSets++;
        }

        // 4. gameResults → results
        var resultsSnap = await legacyBase(db, 'gameResults').get();
        for (var i = 0; i < resultsSnap.docs.length; i++) {
            var doc = resultsSnap.docs[i];
            var data = doc.data();

            var dateStr = '';
            if (data.timestamp) {
                var ts = typeof data.timestamp === 'number'
                    ? new Date(data.timestamp)
                    : data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                dateStr = ts.getFullYear() + '-' +
                    String(ts.getMonth() + 1).padStart(2, '0') + '-' +
                    String(ts.getDate()).padStart(2, '0');
            }

            if (!dryRun) {
                await db.collection('results').doc(doc.id).set({
                    teacherId: teacherUid,
                    sessionId: data.sessionId || '',
                    classId: data.classId || '',
                    setId: data.setId || '',
                    studentName: data.studentName || data.name || '',
                    studentCode: data.studentCode || data.code || '',
                    gameType: data.gameType || 'mole',
                    className: data.className || '',
                    quizSetTitle: data.quizSetTitle || data.setTitle || '',
                    score: data.score || 0,
                    correctCount: data.correctCount || 0,
                    totalCount: data.totalCount || 0,
                    detailedAnswers: data.detailedAnswers || [],
                    dateStr: dateStr,
                    timestamp: data.timestamp || firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            stats.results++;
        }
    } catch (error) {
        stats.errors.push(error.message);
        console.error('[MigrateV2] 오류:', error);
    }

    console.log('[MigrateV2] 완료:', stats);
    return stats;
}
