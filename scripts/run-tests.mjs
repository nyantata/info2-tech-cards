import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = readdirSync('tests').filter(name => name.endsWith('.test.mjs')).sort();
const result = spawnSync(process.execPath, ['--test', ...files.map(name => `tests/${name}`)], {
  stdio: 'inherit',
  env: { ...process.env, TZ: 'Asia/Tokyo', INFO2_STRICT_KNOWN_ISSUES: process.argv.includes('--strict') ? '1' : '' }
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
