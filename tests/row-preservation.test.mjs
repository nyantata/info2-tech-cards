import assert from 'node:assert/strict';
import { gasEnvironment, gasTest } from './support/gas-environment.mjs';
import { submission, image } from './fixtures/classroom.mjs';

const rowTest = (name, fn) => gasTest(name, { skip: !process.env.INFO2_EXPECT_ROW_FIXES && 'Run npm run test:row-fix with private candidate source' }, fn);

rowTest('新規提出と行整理はスキーマ確認より前に共通ロックを取得する', () => {
  const e = gasEnvironment(), original = e.c.getSheet_;
  e.c.getSheet_ = () => { assert.equal(e.effects.locks, 1); return original(); };
  assert.equal(e.result(e.post('submit', submission())).ok, true);
  e.c.compactSubmissionLog();
  assert.equal(e.effects.locks, 0);
});

rowTest('追記は途中の空行・先生回答・追加列・既存の提出番号を変えない', () => {
  const e = gasEnvironment(), token = e.tokenFor();
  e.post('submit', submission({ attachments: [image()] }), token);
  const sheet = e.sheets.get('提出ログ');
  e.c.setCellByHeader_(sheet, 2, '先生からの回答', 'synthetic-existing-reply');
  e.c.setCellByHeader_(sheet, 4, '先生からの回答', 'synthetic-orphan-reply');
  sheet.getRange(5, 36).setValue('synthetic-extra-column');
  const before = structuredClone(sheet.rows), attachments = structuredClone(e.sheets.get('添付画像').rows);
  const result = e.result(e.post('submit', submission({ clientSubmissionId: 'synthetic-new-submission' }), token));
  assert.equal(result.ok, true);
  assert.deepEqual(sheet.rows.slice(0, 5), before);
  assert.deepEqual(e.sheets.get('添付画像').rows, attachments);
  assert.equal(sheet.getLastRow(), 6);
});

rowTest('行整理は値・数式・最右列のメモを残し、完全な空行だけ下から削除する', () => {
  const e = gasEnvironment(), sheet = e.c.getSheet_();
  const a = ['synthetic-A', 0, false, ' '], b = ['synthetic-B'];
  sheet.getRange(2, 1, 1, a.length).setValues([a]);
  sheet.getRange(4, 40).setNote('synthetic-rightmost-note');
  sheet.getRange(5, 2).setFormula('=""');
  e.c.setCellByHeader_(sheet, 6, '先生からの回答', 'synthetic-orphan-reply');
  sheet.getRange(8, 1, 1, b.length).setValues([b]);
  const deletions = [], originalDelete = sheet.deleteRow.bind(sheet);
  sheet.deleteRow = row => { assert.equal(e.effects.locks, 1); deletions.push(row); originalDelete(row); };
  const result = e.c.compactSubmissionLog();
  assert.deepEqual(deletions, [7, 3]);
  assert.equal(result.clearedBlankRows, 2); assert.equal(result.remaining, 5);
  assert.deepEqual(sheet.rows[1], a); assert.deepEqual(sheet.rows[5], b);
  assert.equal(sheet.getRange(3, 40).getNotes()[0][0], 'synthetic-rightmost-note');
  assert.equal(sheet.getRange(4, 2).getFormulas()[0][0], '=""');
  assert.equal(e.c.getCellByHeader_(sheet, 5, '先生からの回答'), 'synthetic-orphan-reply');
  assert.equal(e.effects.locks, 0);
});

rowTest('行整理でシート操作が途中失敗しても、データのある行を消さずロックを解放する', () => {
  const e = gasEnvironment(), sheet = e.c.getSheet_();
  sheet.getRange(2, 1).setValue('synthetic-A'); sheet.getRange(6, 1).setValue('synthetic-B');
  const originalDelete = sheet.deleteRow.bind(sheet); let calls = 0;
  sheet.deleteRow = row => { if (++calls === 2) throw new Error('synthetic-delete-failure'); originalDelete(row); };
  assert.throws(() => e.c.compactSubmissionLog(), /synthetic-delete-failure/);
  assert.ok(sheet.rows.some(row => row.includes('synthetic-A')));
  assert.ok(sheet.rows.some(row => row.includes('synthetic-B')));
  assert.equal(e.effects.locks, 0);
});

rowTest('行整理後の本人履歴・画像・先生回答は整理前と一致し、再整理は変更しない', () => {
  const e = gasEnvironment(), token = e.tokenFor(), sheet = e.c.getSheet_();
  // 途中の空行を含む既存ログを用意する。
  sheet.getRange(5, 1).setValue('synthetic-marker');
  const payload = submission({ attachments: [image()] });
  e.post('submit', payload, token);
  e.c.setCellByHeader_(sheet, 6, '先生からの回答', 'synthetic-reply');
  const beforeHtml = e.post('history', {}, token).html;
  const beforeAttachments = structuredClone(e.sheets.get('添付画像').rows);
  const beforeFileIds = [...e.files.keys()];
  e.c.compactSubmissionLog();
  assert.equal(e.post('history', {}, token).html, beforeHtml);
  assert.deepEqual(e.sheets.get('添付画像').rows, beforeAttachments);
  assert.deepEqual([...e.files.keys()], beforeFileIds);
  const beforeRows = structuredClone(sheet.rows);
  assert.equal(e.c.compactSubmissionLog().clearedBlankRows, 0);
  assert.deepEqual(sheet.rows, beforeRows);
  assert.equal(e.result(e.post('submit', payload, token)).duplicate, true);
  assert.equal(e.files.size, 1);
});

rowTest('空のログシートの整理は安全に終了する', () => {
  const e = gasEnvironment();
  assert.equal(e.c.compactSubmissionLog().remaining, 0);
  assert.equal(e.effects.locks, 0);
});
