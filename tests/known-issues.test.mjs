import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { gasEnvironment, gasTest } from './support/gas-environment.mjs';
import { submission, image } from './fixtures/classroom.mjs';

// Assertions describe the desired safe behavior. TODO is quarantine, NOT a pass.
const known = id => process.env.INFO2_STRICT_KNOWN_ISSUES ? {} : { todo: id };

gasTest('KI-01: 診断GETは教員認可前にDriveを変更しない', known('KI-01'), () => {
  const e = gasEnvironment(); e.c.doGet({ parameter: { action: 'diagnose' } });
  assert.equal(e.effects.folders, 0); assert.equal(e.effects.trashed, 0);
});

gasTest('KI-02: 主要3列が空でも先生回答のある行を新規提出が消さない', known('KI-02'), () => {
  const e = gasEnvironment(), sheet = e.c.getSheet_();
  e.c.setCellByHeader_(sheet, 2, '先生からの回答', 'synthetic-preserve-reply');
  assert.equal(e.result(e.post('submit', submission())).ok, true);
  assert.equal(e.c.getCellByHeader_(sheet, 2, '先生からの回答'), 'synthetic-preserve-reply');
});

gasTest('KI-03: 行整理は主要3列が空でも先生回答を保持する', known('KI-03'), () => {
  const e = gasEnvironment(), sheet = e.c.getSheet_();
  e.c.setCellByHeader_(sheet, 2, '先生からの回答', 'synthetic-preserve-reply');
  e.c.compactSubmissionLog();
  assert.ok(sheet.rows.some(row => row.includes('synthetic-preserve-reply')));
});

gasTest('KI-04: 同じ送信IDで本文を変えた場合は黙って成功にしない', known('KI-04'), () => {
  const e = gasEnvironment(), token = e.tokenFor();
  e.post('submit', submission(), token);
  assert.equal(e.result(e.post('submit', submission({ result: 'synthetic-changed-result' }), token)).ok, false);
});

gasTest('KI-05: 別画像IDで再送しても同一提出の累計は3枚以下', known('KI-05'), () => {
  const e = gasEnvironment(), token = e.tokenFor();
  e.post('submit', submission({ attachments: [image(1), image(2), image(3)] }), token);
  e.post('submit', submission({ attachments: [image(4)] }), token);
  assert.ok(e.files.size <= 3);
});

gasTest('KI-06: 履歴表示は不足列の自動追加やシート作成をしない', known('KI-06'), () => {
  const e = gasEnvironment(), sheet = e.book.insertSheet('提出ログ');
  sheet.rows = [['提出日時', '提出番号', '提出者メール']];
  const before = structuredClone(sheet.rows);
  e.post('history', {});
  assert.deepEqual(sheet.rows, before);
});

test('KI-07: 無関係な送信元の成功通知は下書きを削除しない', known('KI-07'), () => {
  const listeners = new Map(), removed = [], values = new Map();
  const els = new Map();
  function element(id) {
    if (!els.has(id)) els.set(id, { classList: { add() {}, remove() {} }, style: {}, value: '', innerHTML: '', textContent: '' });
    return els.get(id);
  }
  const form = element('submission-form'); form.elements = Object.fromEntries(['group', 'representative', 'members', 'project', 'problem'].map(k => [k, element(k)]));
  const window = { crypto: { randomUUID: () => 'synthetic-submission-0001' }, addEventListener: (type, fn) => listeners.set(type, fn) };
  const c = vm.createContext({ window, document: { getElementById: element, addEventListener() {} }, localStorage: {
    getItem: key => values.get(key) ?? null, setItem: (key, val) => values.set(key, val), removeItem: key => removed.push(key)
  }, setTimeout() {}, clearTimeout() {} });
  vm.runInContext(readFileSync(new URL('../assets/submission.js', import.meta.url), 'utf8'), c);
  listeners.get('message')({ origin: 'https://unrelated.example.invalid', source: {}, data: { source: 'info2-tech-cards-gas', ok: true, submissionId: 'synthetic-forged' } });
  assert.equal(removed.length, 0);
});
