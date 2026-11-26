// Adding staff without the editor (26 Nov 2026): everyone in EMP_ADD is
// appended to Employee_DB by the hourly jobs, once, never twice, after which
// the sign-in copy is refreshed and the caches cleared. Every queued person is
// checked against the official district/block list first, so a misspelt block
// fails here instead of landing in the sheet. REAL Code.gs, the sheet faked.
//   node scripts/tests/emp-add.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const noop = () => {}, props = {}, cache = {};
const HEAD = ['District', 'Block', 'Name', 'Designation', 'Email', 'Role', 'Zone', 'Additional Districts'];
const rows = [HEAD,
  ['SIROHI', 'SIROHI', 'Sheetal Arya', 'Program Coordinator', 'sheetal.arya@educategirls.ngo', 'Field', '', ''],
  ['JALORE', 'JALORE', 'Sakshi Jain', 'District Operation Lead', 'sakshi.jain@educategirls.ngo', 'District', '', 'RAJSAMAND, JODHPUR, PALI, SIROHI']];
const START = rows.length;
const sheet = {
  getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }), getLastRow: () => rows.length,
  appendRow: (a) => rows.push(a.slice()) };
let refreshed = 0, cleared = 0;
const ctx = {
  console, Logger: { log: noop },
  SpreadsheetApp: { flush: noop, openById: () => ({ getSheetByName: (n) => n === 'Employee_DB' ? sheet : null }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: noop }) },
  Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
  Utilities: { formatDate: (d) => String(d), sleep: noop },
  CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: noop, removeAll: noop }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
    getProperties: () => Object.assign({}, props), deleteProperty: (k) => { delete props[k]; } }) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });
ctx.EMP_refreshMirror = () => { refreshed++; return rows.length - 1; };
ctx.CACHE_clearAll = () => { cleared++; };

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const Q = ctx.EMP_ADD, emailOf = (p) => (p.email || '').trim().toLowerCase();
const ROLES = ['State', 'District', 'Field', 'Zone'];

// designations the team already uses (a new one is allowed, just reported)
let knownDesig = [];
try { knownDesig = JSON.parse(fs.readFileSync('docs/data/employees.json', 'utf8')).employees.map(e => (e.designation || '').trim()); } catch (e) {}

// every queued person, checked against the official lists
ok('the queue is not empty', Q.length > 0);
Q.forEach(p => {
  const who = (p.name || '?') + ': ';
  const blocks = (p.block || '').split(',').map(b => b.trim()).filter(Boolean);
  ok(who + 'name filled', !!(p.name || '').trim());
  ok(who + 'district ' + p.district + ' is an official Rajasthan district', !!ctx.RJ_DISTRICT_BLOCKS[p.district]);
  ok(who + 'blocks ' + p.block + ' are official blocks of ' + p.district,
     p.role !== 'Field' && !blocks.length || blocks.length && ctx.RJ_DISTRICT_BLOCKS[p.district] &&
     blocks.every(b => ctx.RJ_DISTRICT_BLOCKS[p.district].indexOf(b) !== -1), p.block);
  ok(who + 'role ' + p.role + ' is one the app knows', ROLES.indexOf(ctx.normalizeRole_(p.role)) !== -1 && p.role === ctx.normalizeRole_(p.role));
  ok(who + 'email ' + p.email + ' is on the allowed domain', /^[^@\s]+@[^@\s]+$/.test(p.email) && p.email.split('@')[1].toLowerCase() === ctx.ALLOWED_DOMAIN);
  ok(who + 'designation filled', !!(p.designation || '').trim());
  if (knownDesig.length && knownDesig.indexOf(p.designation) === -1) console.log('note ' + who + 'designation "' + p.designation + '" is new to the sheet');
});
ok('no email queued twice', new Set(Q.map(emailOf)).size === Q.length);

// first run appends every queued person, columns A-F
const n1 = ctx.empAddPending_();
ok('first run adds everyone queued', n1 === Q.length && rows.length === START + Q.length, 'n=' + n1 + ' rows=' + rows.length);
Q.forEach((p, i) => ok('row for ' + p.name + ' is District, Block, Name, Designation, Email, Role',
  JSON.stringify(rows[START + i]) === JSON.stringify([p.district, p.block, p.name, p.designation, p.email.trim(), p.role]), JSON.stringify(rows[START + i])));
ok('sign-in copy refreshed and caches cleared', refreshed === 1 && cleared === 1);
const done = JSON.parse(props.EMP_ADDED || '{}');
ok('each marked done with its row number', Q.every((p, i) => done[emailOf(p)] && done[emailOf(p)].row === START + i + 1), props.EMP_ADDED);

// the code reads the new rows the way sign-in does
const map = ctx.empReadFromSheet_();
Q.forEach(p => { const e = map && map[emailOf(p)];
  ok('sign-in sees ' + p.name, e && e.role === ctx.normalizeRole_(p.role) && e.district === p.district && e.block === p.block && e.name === p.name, JSON.stringify(e)); });

// second run does nothing
const n2 = ctx.empAddPending_();
ok('second run adds nothing and touches nothing', n2 === 0 && rows.length === START + Q.length && refreshed === 1 && cleared === 1);

// already in the sheet (say, added by hand) and not yet marked: never added twice
delete props.EMP_ADDED;
const n3 = ctx.empAddPending_();
ok('an email already in the sheet is not added again', n3 === 0 && rows.length === START + Q.length);
ok('...but is marked done', Q.every(p => JSON.parse(props.EMP_ADDED)[emailOf(p)].already === true));

// one new person queued later: only that one is added
Q.push({ district: 'SIROHI', block: 'REODAR', name: 'Test Later', designation: 'Program Coordinator', email: 'test.later@educategirls.ngo', role: 'Field' });
const n4 = ctx.empAddPending_();
ok('a person queued later is added on the next run, alone', n4 === 1 && rows.length === START + Q.length && rows[rows.length - 1][2] === 'Test Later');
Q.pop();

// sheet missing: nothing marked, tried again next run
delete props.EMP_ADDED;
const keep = ctx.SpreadsheetApp.openById;
ctx.SpreadsheetApp.openById = () => ({ getSheetByName: () => null });
ok('sheet not found: nothing marked', ctx.empAddPending_() === 0 && !props.EMP_ADDED);
ctx.SpreadsheetApp.openById = keep;

// EMP_refreshNow: fresh copy first, then every cache; nothing cleared when the sheet does not answer
const seq = [], keepRefresh = ctx.EMP_refreshMirror, keepClear = ctx.CACHE_clearAll;
ctx.CACHE_clearAll = () => { seq.push('clear'); };
ctx.EMP_refreshMirror = () => { seq.push('refresh'); return 42; };
ok('EMP_refreshNow refreshes the copy, then clears the caches', ctx.EMP_refreshNow() === 42 && seq.join() === 'refresh,clear', seq.join());
seq.length = 0;
ctx.EMP_refreshMirror = () => { seq.push('refresh'); return 0; };
ok('EMP_refreshNow clears nothing when the sheet does not answer', ctx.EMP_refreshNow() === 0 && seq.join() === 'refresh', seq.join());
ctx.EMP_refreshMirror = keepRefresh; ctx.CACHE_clearAll = keepClear;

// all three hourly jobs run it
['calendarJob', 'taggingJob', 'escalationJob'].forEach(j => {
  const body = src.slice(src.indexOf('function ' + j + '('), src.indexOf('function ' + j + '(') + 600);
  ok(j + ' runs empAddPending_', body.indexOf('empAddPending_()') !== -1);
});

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
