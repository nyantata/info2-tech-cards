import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { gasEnvironment, gasTest } from './support/gas-environment.mjs';

test('教材のJavaScriptとHTML内の実行スクリプト・JSONが構文正常', () => {
  for (const name of readdirSync('assets').filter(x => x.endsWith('.js'))) new vm.Script(readFileSync(join('assets', name), 'utf8'), { filename: name });
  for (const name of readdirSync('.').filter(x => x.endsWith('.html'))) {
    const html = readFileSync(name, 'utf8');
    for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=/.test(attrs)) continue;
      if (/type=["']application\/json["']/.test(attrs)) JSON.parse(body);
      else new vm.Script(body, { filename: name });
    }
  }
});

test('15教材があり、ローカルの参照先に欠落がない', () => {
  const c = vm.createContext({ window: {} }); vm.runInContext(readFileSync('assets/card-data.js', 'utf8'), c);
  const cards = Object.keys(c.window.CARD_META);
  assert.equal(cards.length, 15);
  for (const id of cards) assert.ok(existsSync(c.window.CARD_META[id].file));
  for (const name of readdirSync('.').filter(x => x.endsWith('.html'))) {
    const html = readFileSync(name, 'utf8');
    for (const [, path] of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
      if (/^(?:[a-z][\w+.-]*:|#|\/\/)/i.test(path)) continue;
      const local = path.split(/[?#]/)[0];
      if (local) assert.ok(existsSync(local), `${name}: missing ${local}`);
    }
  }
});

gasTest('15教材のIDは私有GASソースと一致する', () => {
  const c = vm.createContext({ window: {} }); vm.runInContext(readFileSync('assets/card-data.js', 'utf8'), c);
  const serverCards = JSON.parse(vm.runInContext('JSON.stringify(Object.keys(CARD_TITLES))', gasEnvironment().c));
  assert.deepEqual(Object.keys(c.window.CARD_META).sort(), serverCards.sort());
});
