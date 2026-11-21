import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Never print matched content: a rejected file may contain real credentials.
export function publicFileProblems(path, content) {
  const name = path.normalize('NFC').replaceAll('\\', '/');
  const problems = [];
  if (/(^|\/)(?:\.private|attachments|work)(\/|$)/.test(name) ||
      /(^|\/)\.env(?:\.|$)/.test(name) && !name.endsWith('.example') ||
      /(^|\/)demo-credentials\.js$/i.test(name) ||
      /(?:パスワード|password|credential).*(?:一覧|list).*\.csv$/i.test(name) ||
      /info2_tech_cards_v30_prototype.*\.html$/i.test(name)) problems.push('private-file-name');
  if (/\b(?:const|let|var)\s+DEMO_CREDENTIALS\s*=\s*\{/.test(content) ||
      /["']3K\d{2}["']\s*:\s*["'][^"'\r\n]+["']/.test(content)) problems.push('student-password-map');
  if (/\b(?:const|let|var)\s+credentials\s*=\s*\{[\s\S]{0,400}?\b(?:student|teacher)\s*:\s*["']/.test(content)) problems.push('demo-role-credentials');
  if (/\bfunction\s+doPost\s*\(/.test(content) && /\bfunction\s+verifyIdToken_\s*\(/.test(content)) problems.push('private-gas-source');
  if (/生徒ID\s*[,\t][^\r\n]*(?:初期)?パスワード/.test(content.normalize('NFC'))) problems.push('student-password-csv');
  if (/["']?(?:password|client_secret|private_key)["']?\s*[:=]\s*["'][^"'\r\n]{4,}["']/i.test(content) ||
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) problems.push('literal-secret');
  return [...new Set(problems)];
}

export function checkTrackedFiles({ staged = false } = {}) {
  const paths = execFileSync('git', ['ls-files', '-z', ...(staged ? ['--cached'] : [])]).toString().split('\0').filter(Boolean);
  const rejected = [];
  for (const path of paths) {
    const bytes = staged ? execFileSync('git', ['show', `:${path}`], { maxBuffer: 32 * 1024 * 1024 }) : readFileSync(path);
    const content = bytes.includes(0) ? '' : bytes.toString('utf8');
    const problems = publicFileProblems(path, content);
    if (problems.length) rejected.push({ path, rules: problems });
  }
  return { checked: paths.length, rejected };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkTrackedFiles({ staged: process.argv.includes('--staged') });
  for (const item of result.rejected) console.error(`BLOCKED ${item.path}: ${item.rules.join(', ')}`);
  console.log(`Public-file check: ${result.checked} files, ${result.rejected.length} blocked. Values are never printed.`);
  process.exitCode = result.rejected.length ? 1 : 0;
}
