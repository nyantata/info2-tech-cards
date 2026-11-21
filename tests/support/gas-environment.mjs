import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import nodeTest from 'node:test';
import { students } from '../fixtures/classroom.mjs';

const sourcePath = process.env.INFO2_GAS_SOURCE || new URL('../../.private/gas-v28.5.gs', import.meta.url);
if (process.env.INFO2_GAS_SOURCE && !existsSync(sourcePath)) throw new Error('Explicit private GAS source path does not exist');
export const gasSource = existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : null;
export function gasTest(name, optionsOrFn, maybeFn) {
  const options = typeof optionsOrFn === 'function' ? {} : optionsOrFn;
  const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn;
  return nodeTest(name, { ...options, ...(!gasSource ? { todo: false, skip: 'Private GAS source not supplied; no production access' } : {}) }, fn);
}

class Sheet {
  constructor(book, name) { this.book = book; this.name = name; this.rows = []; this.writes = 0; }
  getName() { return this.name; }
  getParent() { return this.book; }
  getLastRow() { return this.rows.reduce((last, row, i) => row.some(v => v !== '' && v != null) ? i + 1 : last, 0); }
  getLastColumn() { return Math.max(0, ...this.rows.map(row => row.length)); }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  getRange(r, c, height = 1, width = 1) {
    const sheet = this;
    const values = () => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => sheet.rows[r + y - 1]?.[c + x - 1] ?? ''));
    const range = {
      getValues: values,
      getDisplayValues: () => values().map(row => row.map(String)),
      getValue: () => values()[0][0],
      setValues(data) {
        sheet.writes++;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          sheet.rows[r + y - 1] ??= []; sheet.rows[r + y - 1][c + x - 1] = data[y][x];
        }
        return range;
      },
      setValue: value => range.setValues([[value]]),
      clearContent: () => range.setValues(Array.from({ length: height }, () => Array(width).fill(''))),
      setNumberFormat: () => range,
      createTextFinder(text) {
        return { matchEntireCell() { return this; }, findNext() {
          const index = values().findIndex(row => row.some(v => String(v) === text));
          return index < 0 ? null : { getRow: () => r + index };
        } };
      }
    };
    return range;
  }
  insertColumnAfter(column) { this.rows.forEach(row => row.splice(column, 0, '')); this.writes++; }
  insertColumnBefore(column) { this.insertColumnAfter(column - 1); }
  setFrozenRows() {}
  appendRow(row) { this.getRange(this.getLastRow() + 1, 1, 1, row.length).setValues([row]); }
}

export function gasEnvironment() {
  if (!gasSource) throw new Error('Private GAS source required for local regression tests');
  const props = new Map([
    ['SPREADSHEET_ID', 'synthetic-spreadsheet'], ['GOOGLE_CLIENT_ID', 'synthetic-client'],
    ['ALLOWED_DOMAIN_SUFFIX', '@school.example.invalid']
  ]);
  const sheets = new Map(), files = new Map(), folders = new Map(), tokens = new Map();
  const effects = { network: [], folders: 0, trashed: 0, locks: 0 };
  const failures = { shareNext: false };
  let uuid = 0;
  const iterator = items => { let i = 0; return { hasNext: () => i < items.length, next: () => items[i++] }; };
  function folder(name) {
    const children = [], ownFiles = [];
    const id = `synthetic-folder-${folders.size + 1}`;
    const result = {
      getId: () => id, getFoldersByName: n => iterator(children.filter(x => x.name === n)),
      createFolder(n) { const child = folder(n); children.push(child); return child; },
      getFilesByName: n => iterator(ownFiles.filter(x => x.name === n)),
      setTrashed() { effects.trashed++; },
      createFile(blob) {
        const fileId = `synthetic-file-${files.size + 1}`;
        const viewers = new Set();
        const file = { name: blob.name, viewers, getId: () => fileId,
          getUrl: () => `https://drive.example.invalid/file/${fileId}`, setDescription() {},
          addViewer(email) { if (failures.shareNext) { failures.shareNext = false; throw new Error('synthetic sharing failure'); } viewers.add(email); }
        };
        ownFiles.push(file); files.set(fileId, file); return file;
      }, name
    };
    effects.folders++; folders.set(id, result); return result;
  }
  const book = {
    getSheetByName: name => sheets.get(name),
    insertSheet(name) { const sh = new Sheet(book, name); sheets.set(name, sh); return sh; },
    getSheets: () => [...sheets.values()], getId: () => 'synthetic-spreadsheet',
    getName: () => 'Synthetic classroom', getUrl: () => 'https://sheets.example.invalid/synthetic'
  };
  const html = value => ({ html: value, setTitle() { return this; }, setXFrameOptionsMode() { return this; } });
  const c = vm.createContext({ Date,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key) ?? null, setProperty: (key, val) => props.set(key, val) }) },
    SpreadsheetApp: { openById(id) { if (id !== 'synthetic-spreadsheet') throw new Error('Non-synthetic spreadsheet blocked'); return book; }, flush() {} },
    LockService: { getScriptLock: () => ({ waitLock() { effects.locks++; }, releaseLock() { effects.locks--; } }) },
    DriveApp: { createFolder: folder, getFolderById(id) { if (!folders.has(id)) throw new Error('Unknown folder'); return folders.get(id); },
      getFileById(id) { if (!files.has(id)) throw new Error('Unknown file'); return files.get(id); } },
    UrlFetchApp: { fetch(url) {
      const parsed = new URL(url);
      if (parsed.origin !== 'https://oauth2.googleapis.com' || parsed.pathname !== '/tokeninfo') throw new Error('Unexpected external request blocked');
      effects.network.push('mock-tokeninfo');
      const info = tokens.get(parsed.searchParams.get('id_token'));
      return { getResponseCode: () => info ? 200 : 400, getContentText: () => JSON.stringify(info ?? {}) };
    } },
    Utilities: {
      getUuid: () => `synthetic-uuid-${++uuid}`,
      base64Decode: text => { if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new Error('Invalid Base64'); return [...Buffer.from(text, 'base64')]; },
      newBlob: (bytes, mime, name) => ({ bytes, mime, name, setName(value) { this.name = value; } }),
      formatDate(value, zone, pattern) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(value).map(x => [x.type, x.value]));
        return pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, key => parts[{ yyyy: 'year', MM: 'month', dd: 'day', HH: 'hour', mm: 'minute', ss: 'second' }[key]]);
      }
    },
    HtmlService: { createHtmlOutput: html, XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' } },
    ScriptApp: { AuthMode: { FULL: 'FULL' }, getAuthorizationInfo: () => ({ getAuthorizationStatus: () => 'NOT_REQUIRED' }) },
    Logger: { log() {} }
  });
  vm.runInContext(gasSource, c, { filename: 'gas-v28.5.gs' });
  function tokenFor(student = students[0], patch = {}) {
    const token = `synthetic-token-${tokens.size + 1}`;
    tokens.set(token, { aud: 'synthetic-client', email_verified: 'true', email: student.email, sub: student.sub, exp: Math.floor(Date.now() / 1000) + 3600, ...patch });
    return token;
  }
  function result(page) { return JSON.parse(page.html.match(/var data=(.*?);try/)[1]); }
  function post(action, payload, token = tokenFor()) {
    return c.doPost({ parameter: { action, idToken: token, payload: JSON.stringify(payload), submissionUrl: 'https://site.example.invalid/submission.html' } });
  }
  return { c, book, sheets, files, props, effects, failures, tokenFor, post, result };
}
