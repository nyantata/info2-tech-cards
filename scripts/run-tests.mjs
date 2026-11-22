import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const files = readdirSync('tests').filter(name => name.endsWith('.test.mjs')).sort();
const rowFix = process.argv.includes('--row-fix');
const result = spawnSync(process.execPath, ['--test', ...files.map(name => `tests/${name}`)], {
  stdio: 'inherit',
  env: { ...process.env, TZ: 'Asia/Tokyo',
    ...(rowFix ? { INFO2_GAS_SOURCE: process.env.INFO2_GAS_SOURCE || '.private/gas-v28.6.gs' } : {}),
    INFO2_EXPECT_ROW_FIXES: rowFix ? '1' : '',
    INFO2_STRICT_KNOWN_ISSUES: process.argv.includes('--strict') ? '1' : '' }
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
