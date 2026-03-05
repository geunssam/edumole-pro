/**
 * 마이그레이션 스크립트: 기존 gameResults에 gameType, sessionId 필드 추가
 *
 * 사용법:
 *   1. Firebase Admin SDK 설치: npm install firebase-admin
 *   2. 서비스 계정 키 다운로드:
 *      Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
 *   3. 환경변수 설정 후 실행:
 *      GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/migrate-game-type.js
 *
 * 안전장치:
 *   - gameType 필드가 이미 있는 문서는 건너뜀 (중복 실행 안전)
 *   - Firestore batch write 500개 단위 분할
 *   - dry-run 모드로 먼저 확인 가능: node scripts/migrate-game-type.js --dry-run
 */

const admin = require('firebase-admin');

// --- 설정 ---
const APP_ID = 'edu-mole-pro-v6';
const COLLECTION_PATH = `artifacts/${APP_ID}/public/data/gameResults`;
const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes('--dry-run');

// --- 초기화 ---
admin.initializeApp({
    credential: admin.credential.applicationDefault()
});
const db = admin.firestore();

async function migrate() {
    console.log(`\n=== gameResults 마이그레이션 ===`);
    console.log(`경로: ${COLLECTION_PATH}`);
    console.log(`모드: ${DRY_RUN ? 'DRY-RUN (변경 없음)' : '실제 실행'}\n`);

    const colRef = db.collection(COLLECTION_PATH);
    const snapshot = await colRef.get();

    if (snapshot.empty) {
        console.log('gameResults 컬렉션이 비어 있습니다. 종료.');
        return;
    }

    // gameType이 없는 문서만 필터링
    const docsToUpdate = snapshot.docs.filter(doc => {
        const data = doc.data();
        return !data.gameType;
    });

    console.log(`전체 문서: ${snapshot.size}개`);
    console.log(`업데이트 대상 (gameType 없음): ${docsToUpdate.length}개`);
    console.log(`건너뜀 (gameType 있음): ${snapshot.size - docsToUpdate.length}개\n`);

    if (docsToUpdate.length === 0) {
        console.log('업데이트할 문서가 없습니다. 종료.');
        return;
    }

    if (DRY_RUN) {
        console.log('[DRY-RUN] 실제 변경 없이 종료합니다.');
        console.log('실제 실행하려면 --dry-run 플래그를 제거하세요.');
        return;
    }

    // 500개 단위로 batch write
    let updated = 0;
    for (let i = 0; i < docsToUpdate.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = docsToUpdate.slice(i, i + BATCH_SIZE);

        chunk.forEach(doc => {
            batch.update(doc.ref, {
                gameType: 'mole',
                sessionId: ''
            });
        });

        await batch.commit();
        updated += chunk.length;
        console.log(`진행: ${updated}/${docsToUpdate.length} 문서 업데이트 완료`);
    }

    console.log(`\n=== 마이그레이션 완료: ${updated}개 문서에 gameType: "mole", sessionId: "" 추가 ===\n`);
}

migrate()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('마이그레이션 실패:', err);
        process.exit(1);
    });
