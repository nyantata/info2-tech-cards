import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { publicFileProblems } from '../scripts/check-public-files.mjs';

test('秘密ファイル名・Unicode分解されたパスワード一覧を検出', () => {
  for (const path of ['demo-credentials.js', '生徒ID・パスワード一覧.csv', '生徒ID・パスワード一覧.csv'.normalize('NFD'), '.private/import.csv', '.env.local']) {
    assert.ok(publicFileProblems(path, '').length > 0);
  }
});

test('ファイルを改名しても生徒認証表・秘密値を検出', () => {
  const field = ['pass', 'word'].join('');
  const content = 'const ' + ['DEMO', 'CREDENTIALS'].join('_') + '=' + JSON.stringify({ ['3K' + '01']: 'synthetic-only' }) + ';';
  assert.ok(publicFileProblems('renamed.js', content).includes('student-password-map'));
  const header = ['生徒ID', ['初期', 'パスワード'].join('')].join(',');
  assert.ok(publicFileProblems('renamed.csv', header + '\n3K01,synthetic-only').includes('student-password-csv'));
  assert.ok(publicFileProblems('renamed.js', `${field}: 'synthetic-only'`).includes('literal-secret'));
  const roleDemo = ['const creden', 'tials = {student: ', "'synthetic-only'}"].join('');
  assert.ok(publicFileProblems('renamed.html', roleDemo).includes('demo-role-credentials'));
  const source = ['function ', 'doPost(e){}; function ', 'verifyIdToken_(token){}'].join('');
  assert.ok(publicFileProblems('renamed.txt', source).includes('private-gas-source'));
});

test('OAuth公開クライアントID・GAS URL・架空生徒IDだけではブロックしない', () => {
  assert.deepEqual(publicFileProblems('config.js', "webAppUrl: 'https://script.google.com/macros/s/SYNTHETIC/exec', googleClientId: 'synthetic.apps.googleusercontent.com', studentId: '3K01'"), []);
});

test('ステージ済みの秘密値を検出し、後から作業ファイルを消しても検査を回避できない', () => {
  const dir = mkdtempSync(join(tmpdir(), 'info2-public-guard-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    const sensitive = `${['pass', 'word'].join('')}: 'synthetic-only-value'`;
    writeFileSync(join(dir, 'renamed.js'), sensitive);
    execFileSync('git', ['add', 'renamed.js'], { cwd: dir });
    writeFileSync(join(dir, 'renamed.js'), '// sanitized working copy');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/check-public-files.mjs', import.meta.url)), '--staged'], { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.ok(!`${result.stdout}${result.stderr}`.includes('synthetic-only-value'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
