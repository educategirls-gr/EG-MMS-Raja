// The REAL conductMeeting out of Code.gs with Sheets, Drive, Docs and the cache
// faked. Since 2 Oct 2026: whatever is written is saved (no duplicate-note
// refusal), one save of a meeting at a time (IN_PROGRESS), and the guard is
// always released, even when the save fails.
//   node scripts/tests/conduct.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');
const RJ_ROOT_ID = /var DRIVE_ROOT_ID\s*=\s*'([^']+)'/.exec(src)[1];

function world(opts) {
  opts = opts || {};
  const cache = {};
  const sheets = {
    'Plan Meetings': [['Meeting ID'], ['MTG-T1', 'BARAN'], ['MTG-T2', 'BARAN'], ['MTG-T3', 'BARAN']],
    'Conducted Meetings': [['Meeting ID']] };
  function sheet(rows) {
    const range = (r, c) => ({ getValue: () => (rows[r - 1] || [])[c - 1] || '', setValue: (v) => { (rows[r - 1] = rows[r - 1] || [])[c - 1] = v; },
      getValues: () => rows.slice(r - 1).map(x => [x[c - 1]]), setNumberFormat: () => {} });
    return { getDataRange: () => ({ getValues: () => rows }), getLastRow: () => rows.length,
             getRange: range, appendRow: (a) => rows.push(a) };
  }
  function folder(name) {
    const f = { kids: {}, getFoldersByName: (n) => ({ hasNext: () => !!f.kids[n], next: () => f.kids[n] }),
      createFolder: (n) => (f.kids[n] = folder(n)), setSharing: () => {}, getUrl: () => 'https://drive/' + name,
      createFile: () => ({ setSharing: () => {} }), getName: () => name };
    return f;
  }
  const chain = new Proxy(function () {}, { get: (t, k) => k === 'getId' ? () => 'doc-1' : k === 'getUrl' ? () => 'https://docs/doc-1' : chain, apply: () => chain });
  const noop = () => {};
  const ctx = {
    console, Logger: { log: noop }, MailApp: { sendEmail: noop },
    Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
    Utilities: { base64Decode: (s) => s, newBlob: (b, type, name) => ({ name }), sleep: noop },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; },
      remove: (k) => { delete cache[k]; }, removeAll: (ks) => ks.forEach(k => delete cache[k]) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: noop }) },
    SpreadsheetApp: { openById: () => { if (opts.sheetDown) throw new Error('Service Spreadsheets timed out'); return { getSheetByName: (n) => sheets[n] ? sheet(sheets[n]) : null }; } },
    DocumentApp: chain,
    DriveApp: { Access: {}, Permission: {}, getFolderById: (id) => { if (id !== RJ_ROOT_ID) throw new Error('no folder'); return folder('RJ'); },
                getRootFolder: () => { throw new Error('Drive root must not be used'); }, getFileById: () => ({ setSharing: noop, moveTo: noop }) },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  return { ctx, cache, sheets };
}

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const P = (id, note) => ({ meetingId: id, district: 'BARAN', email: 'seema.pankaj@educategirls.ngo', employeeName: 'Seema Pankaj',
                           keyPoints: note, conductDate: '2026-10-02', outcome: 'Courtesy', photos: [], skipMom: false });
const conducted = (w) => w.sheets['Conducted Meetings'].length - 1;
const NOTE = 'Discussed: TEST the same long note written for two different meetings by one officer';

let w = world();
let r1 = w.ctx.conductMeeting(P('MTG-T1', NOTE));
let r2 = w.ctx.conductMeeting(P('MTG-T2', NOTE));
ok('the same note on two meetings is saved both times', r1.success && r2.success && conducted(w) === 2, JSON.stringify(r2));
ok('a very short note is saved as written', w.ctx.conductMeeting(P('MTG-T3', 'Discussed: ok')).success === true);
ok('plan rows are marked Conducted', w.sheets['Plan Meetings'].slice(1).every(r => r[13] === 'Conducted'));
ok('the guard is released after each save', Object.keys(w.cache).filter(k => /^conducting_/.test(k)).length === 0, Object.keys(w.cache).join());

w = world();
w.cache['conducting_MTG-T1'] = '1';                      // a save of this meeting is still running
let r = w.ctx.conductMeeting(P('MTG-T1', NOTE));
ok('a second save while the first runs gets IN_PROGRESS and writes nothing', r.success === false && r.message === 'IN_PROGRESS' && conducted(w) === 0, JSON.stringify(r));
ok('...and leaves the first save\'s guard in place', w.cache['conducting_MTG-T1'] === '1');
ok('another meeting is not held up by it', w.ctx.conductMeeting(P('MTG-T2', NOTE)).success === true);

w = world();
w.ctx.conductMeeting(P('MTG-T1', NOTE));
r = w.ctx.conductMeeting(P('MTG-T1', NOTE));
ok('the same meeting saved again is still refused (ALREADY_CONDUCTED)', r.message === 'ALREADY_CONDUCTED' && conducted(w) === 1, JSON.stringify(r));

w = world({ sheetDown: true });
r = w.ctx.conductMeeting(P('MTG-T1', NOTE));
ok('a failing save reports the failure', r.success === false && /timed out/.test(r.message || ''), JSON.stringify(r));
ok('...and still releases the guard', !('conducting_MTG-T1' in w.cache));

ok('no duplicate-note refusal left in Code.gs', src.indexOf('DUPLICATE_NOTE') < 0);
console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
