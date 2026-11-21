import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gasEnvironment, gasSource, gasTest } from './support/gas-environment.mjs';
import { students, submission, image } from './fixtures/classroom.mjs';

gasTest('受領したGAS v28.5の私有コピーが変更されていない', () => {
  assert.equal(createHash('sha256').update(gasSource).digest('hex'), '3c5884197898a1cbb703255dbb08bf6430d6e971f7f85b306908da988019b439');
});

test('架空36名のID・sub・メールが一意で、本番接続情報を使わない', () => {
  assert.equal(students.length, 36);
  assert.deepEqual(students.map(x => x.studentId), Array.from({ length: 36 }, (_, i) => `3K${String(i + 1).padStart(2, '0')}`));
  for (const key of ['studentId', 'email', 'sub']) assert.equal(new Set(students.map(x => x[key])).size, 36);
  assert.ok(students.every(x => x.email.endsWith('.invalid')));
});

gasTest('36名が個別に提出し、メール入力の偽装は保存先本人に影響しない', () => {
  const e = gasEnvironment();
  for (const [i, student] of students.entries()) {
    const answer = e.result(e.post('submit', submission({ clientSubmissionId: `synthetic-submission-${String(i).padStart(4, '0')}`, submittedBy: students[(i + 1) % 36].email }), e.tokenFor(student)));
    assert.equal(answer.ok, true);
  }
  const sheet = e.sheets.get('提出ログ'), headers = sheet.rows[0];
  assert.equal(sheet.getLastRow(), 37);
  assert.deepEqual(sheet.rows.slice(1).map(row => row[headers.indexOf('提出者メール')]), students.map(x => x.email));
  assert.equal(e.effects.locks, 0);
});

for (const [name, patch] of Object.entries({ audience: { aud: 'synthetic-wrong-client' }, unverified: { email_verified: 'false' }, domain: { email: 'learner@outside.example.invalid' }, expired: { exp: 1 } })) {
  gasTest(`トークンを拒否する: ${name}`, () => {
    const e = gasEnvironment();
    assert.equal(e.result(e.post('submit', submission(), e.tokenFor(students[0], patch))).ok, false);
    assert.equal(e.sheets.size, 0);
  });
}

gasTest('未認証・未知の操作は保存しない', () => {
  const e = gasEnvironment();
  assert.equal(e.result(e.post('submit', submission(), 'synthetic-unknown-token')).ok, false);
  assert.equal(e.result(e.post('teacher', {}, e.tokenFor())).ok, false);
  assert.equal(e.sheets.size, 0);
});

gasTest('本文・画像・先生回答は同一再送で失われず、ファイルも増えない', () => {
  const e = gasEnvironment(), token = e.tokenFor(), payload = submission({ attachments: [image()] });
  const first = e.result(e.post('submit', payload, token));
  assert.equal(first.ok, true); assert.equal(first.imageCount, 1);
  const sheet = e.sheets.get('提出ログ'), row = 2;
  e.c.setCellByHeader_(sheet, row, '先生からの回答', '架空の先生回答 <確認>');
  const before = structuredClone(sheet.rows);
  const second = e.result(e.post('submit', payload, token));
  assert.equal(second.ok, true); assert.equal(second.duplicate, true); assert.equal(second.submissionId, first.submissionId);
  assert.equal(e.files.size, 1); assert.equal(e.sheets.get('添付画像').getLastRow(), 2);
  assert.deepEqual(sheet.rows, before);
  const audit = e.c.getCellByHeader_(sheet, row, '元データ(JSON)');
  assert.ok(!audit.includes('dataBase64') && !audit.includes(image().dataBase64));
  assert.ok([...e.files.values()][0].viewers.has(students[0].email));
});

gasTest('共有処理が途中失敗しても、再送でログ・Driveファイルを重複させず回復する', () => {
  const e = gasEnvironment(), token = e.tokenFor(), payload = submission({ attachments: [image()] });
  e.failures.shareNext = true;
  assert.equal(e.result(e.post('submit', payload, token)).ok, false);
  assert.equal(e.files.size, 1); assert.equal(e.sheets.get('提出ログ').getLastRow(), 2);
  assert.equal(e.c.getCellByHeader_(e.sheets.get('提出ログ'), 2, '画像アップロード状態'), '再試行が必要');
  assert.equal(e.effects.locks, 0);
  const retried = e.result(e.post('submit', payload, token));
  assert.equal(retried.ok, true); assert.equal(retried.imageCount, 1); assert.equal(e.files.size, 1);
});

gasTest('別生徒の同一送信IDを拒否し、履歴に他人の本文・画像・先生回答を含めない', () => {
  const e = gasEnvironment(), a = e.tokenFor(students[0]), b = e.tokenFor(students[1]);
  assert.equal(e.result(e.post('submit', submission({ attachments: [image()] }), a)).ok, true);
  const sheet = e.sheets.get('提出ログ');
  e.c.setCellByHeader_(sheet, 2, '先生からの回答', '<script>synthetic-reply-A</script>');
  assert.equal(e.result(e.post('submit', submission(), b)).ok, false);
  e.post('submit', submission({ clientSubmissionId: 'synthetic-other-submission', result: 'synthetic-result-B', attachments: [image(2)] }), b);
  const aPage = e.post('history', {}, a).html, bPage = e.post('history', {}, b).html;
  assert.ok(aPage.includes('&lt;script&gt;synthetic-reply-A&lt;/script&gt;'));
  assert.ok(!aPage.includes('synthetic-result-B'));
  assert.ok(!bPage.includes('synthetic-reply-A'));
  const map = e.c.attachmentMapForUser_(e.book, students[0].email);
  assert.equal(Object.keys(map).length, 1); assert.equal(Object.values(map)[0].length, 1);
});

gasTest('不正な日付・画像形式・枚数は保存前に拒否する', () => {
  for (const invalid of [submission({ recordDate: '2026/02/30' }), submission({ recordDate: '2999/01/01' }), submission({ attachments: [image(1), image(2), image(3), image(4)] }), submission({ attachments: [{ ...image(), mimeType: 'image/jpeg' }] })]) {
    const e = gasEnvironment();
    assert.equal(e.result(e.post('submit', invalid)).ok, false);
    assert.equal(e.sheets.size, 0); assert.equal(e.files.size, 0);
  }
});

gasTest('数式開始文字を無効化して本文を保存する', () => {
  const e = gasEnvironment();
  for (const prefix of ['=', '+', '-', '@']) assert.equal(e.c.safeCell_(`${prefix}synthetic`), `'${prefix}synthetic`);
});
