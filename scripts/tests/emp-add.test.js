// Adding staff without the editor (26 Nov 2026): a person in EMP_ADD is
// appended to Employee_DB by the hourly jobs, once, never twice, after which
// the sign-in copy is refreshed and the caches cleared. REAL Code.gs, the
// sheet faked.
//   node scripts/tests/emp-add.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const noop = () => {}, props = {}, cache = {};
const HEAD = ['District', 'Block', 'Name', 'Designation', 'Email', 'Role', 'Zone', 'Additional Districts'];
const rows = [HEAD,
  ['SIROHI', 'SIROHI', 'Sheetal Arya', 'Program Coordinator', 'sheetal.arya@educategirls.ngo', 'Field', '', ''],
  ['JALORE', 'JALORE', 'Sakshi Jain', 'District Operation Lead', 'sakshi.jain@educategirls.ngo', 'District', '', 'RAJSAMAND, JODHPUR, PALI, SIROHI']];
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
const B = 'bheraram.meghwal@educategirls.ngo';

// the queued person, checked against the official lists
const p = ctx.EMP_ADD[0];
ok('one person queued: Bheraram Meghwal', ctx.EMP_ADD.length === 1 && p.name === 'Bheraram Meghwal' && p.email === B);
ok('district is an official Rajasthan district', !!ctx.RJ_DISTRICT_BLOCKS[p.district]);
ok('every block is an official block of that district (SHEOGANJ, PINDWARA)',
   p.block.split(',').map(b => b.trim()).every(b => ctx.RJ_DISTRICT_BLOCKS[p.district].indexOf(b) !== -1), p.block);
ok('role reads as Field', ctx.normalizeRole_(p.role) === 'Field');
ok('email is on the allowed domain', p.email.split('@')[1] === ctx.ALLOWED_DOMAIN);
ok('designation is one the sheet already uses', p.designation === rows[1][3]);

// first run appends exactly one row, columns A-F
const n1 = ctx.empAddPending_();
ok('first run adds one row', n1 === 1 && rows.length === 4, 'n=' + n1 + ' rows=' + rows.length);
ok('row is District, Block, Name, Designation, Email, Role',
   JSON.stringify(rows[3]) === JSON.stringify(['SIROHI', 'SHEOGANJ, PINDWARA', 'Bheraram Meghwal', 'Program Coordinator', B, 'Field']), JSON.stringify(rows[3]));
ok('sign-in copy refreshed and caches cleared', refreshed === 1 && cleared === 1);
const done = JSON.parse(props.EMP_ADDED || '{}');
ok('marked done with its row number', done[B] && done[B].row === 4, props.EMP_ADDED);

// the code reads the new row the way sign-in does
const map = ctx.empReadFromSheet_();
ok('sign-in sees him: Field, SIROHI, both blocks', map && map[B] && map[B].role === 'Field' && map[B].district === 'SIROHI' &&
   map[B].block === 'SHEOGANJ, PINDWARA' && map[B].name === 'Bheraram Meghwal', JSON.stringify(map && map[B]));

// second run does nothing
const n2 = ctx.empAddPending_();
ok('second run adds nothing and touches nothing', n2 === 0 && rows.length === 4 && refreshed === 1 && cleared === 1);

// already in the sheet (say, added by hand) and not yet marked: never added twice
delete props.EMP_ADDED;
const n3 = ctx.empAddPending_();
ok('an email already in the sheet is not added again', n3 === 0 && rows.length === 4);
ok('...but is marked done', JSON.parse(props.EMP_ADDED)[B].already === true);

// sheet missing: nothing marked, tried again next run
delete props.EMP_ADDED;
const keep = ctx.SpreadsheetApp.openById;
ctx.SpreadsheetApp.openById = () => ({ getSheetByName: () => null });
ok('sheet not found: nothing marked', ctx.empAddPending_() === 0 && !props.EMP_ADDED);
ctx.SpreadsheetApp.openById = keep;

// all three hourly jobs run it
['calendarJob', 'taggingJob', 'escalationJob'].forEach(j => {
  const body = src.slice(src.indexOf('function ' + j + '('), src.indexOf('function ' + j + '(') + 600);
  ok(j + ' runs empAddPending_', body.indexOf('empAddPending_()') !== -1);
});

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
