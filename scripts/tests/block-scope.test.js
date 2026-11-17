// Analytics inside the app for a block officer (17 Nov 2026): a Field login
// sees its own block(s) only, by the Block Meetings rule (the official's
// Stakeholder Block, or the block of the officer who holds the meeting), plus
// its own meetings. A District lead still sees every block of its districts,
// a Field row with no block keeps the district view, the open portal is
// unchanged. Through the REAL router (doGet) of Code.gs, Sheets and the cache
// faked.
//   node scripts/tests/block-scope.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const cache = {}, props = {};
const noop = () => {};
const D  = 'jaswinder.singh@educategirls.ngo';   // District: UDAIPUR + BARAN, JHALAWAR
const F  = 'seema.pankaj@educategirls.ngo';      // Field: BARAN, block ATRU
const F3 = 'ravi.kumar@educategirls.ngo';        // Field: BARAN, blocks KISHANGANJ, SHAHBAD
const F4 = 'noblock@educategirls.ngo';           // Field: BARAN, no block in the sheet
const S  = 'brajeshkumar.sinha@educategirls.ngo';// State
const emp = {
  [D]:  { district: 'UDAIPUR', districts: ['UDAIPUR', 'BARAN', 'JHALAWAR'], block: '', name: 'Jaswinder Singh', designation: 'District Operation Lead', role: 'District', email: D },
  [F]:  { district: 'BARAN', districts: ['BARAN'], block: 'ATRU', name: 'Seema Pankaj', designation: 'Program Coordinator', role: 'Field', email: F },
  [F3]: { district: 'BARAN', districts: ['BARAN'], block: 'KISHANGANJ, SHAHBAD', name: 'Ravi Kumar', designation: 'Program Coordinator', role: 'Field', email: F3 },
  [F4]: { district: 'BARAN', districts: ['BARAN'], block: '', name: 'No Block', designation: 'Program Coordinator', role: 'Field', email: F4 },
  [S]:  { district: '', districts: [], block: '', name: 'Brajesh Kumar Sinha', designation: 'SoH', role: 'State', email: S } };
props.EMP_MIRROR_N = '1';
props.EMP_MIRROR_0 = JSON.stringify(emp);
const tok = { [D]: 'tD', [F]: 'tF', [F3]: 'tF3', [F4]: 'tF4', [S]: 'tS' };
Object.keys(tok).forEach(e => { cache['SESSION_' + tok[e]] = JSON.stringify(Object.assign({}, emp[e])); });

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const plan = (id, dist, email, skBlock) => { const r = new Array(25).fill(''); r[0] = id; r[1] = dist; r[2] = emp[email].name; r[4] = email; r[5] = day(2);
  r[6] = '11:00 AM'; r[8] = 'One-on-One'; r[9] = 'Official ' + id; r[10] = 'BEO'; r[11] = 'Enrollment'; r[13] = 'Planned'; r[23] = skBlock || ''; return r; };
const con = (id, dist, email, skBlock) => { const r = new Array(34).fill(''); r[0] = id; r[1] = dist; r[2] = emp[email].name; r[4] = email; r[5] = day(-3);
  r[8] = 'One-on-One'; r[9] = 'Official ' + id; r[10] = 'CBEO'; r[11] = 'Enrollment'; r[13] = day(-3); r[15] = 'Discussed enrolment.'; r[30] = skBlock || ''; return r; };
const sheets = {
  'Employee_DB': [['District','Block','Employee Name','Designation','Email','Role','Zone','Additional Districts'],
    ['UDAIPUR', '', 'Jaswinder Singh', 'District Operation Lead', D, 'District', '', 'BARAN, JHALAWAR'],
    ['BARAN', 'ATRU', 'Seema Pankaj', 'Program Coordinator', F, 'Field', '', ''],
    ['BARAN', 'KISHANGANJ, SHAHBAD', 'Ravi Kumar', 'Program Coordinator', F3, 'Field', '', ''],
    ['BARAN', '', 'No Block', 'Program Coordinator', F4, 'Field', '', ''],
    ['', '', 'Brajesh Kumar Sinha', 'SoH', S, 'State', '', '']],
  'Plan Meetings': [new Array(25).fill('h'),
    plan('M-SEEMA', 'BARAN', F, ''),                 // her own, no official's block
    plan('M-RAVI-KG', 'BARAN', F3, 'KISHANGANJ'),
    plan('M-LEAD-ATRU', 'BARAN', D, 'ATRU'),         // the lead met an ATRU official
    plan('M-LEAD-SHAHBAD', 'BARAN', D, 'SHAHBAD'),
    plan('M-RAVI-ATRU', 'BARAN', F3, ' Atru '),      // Ravi met an ATRU official (spacing, case)
    plan('M-UDAIPUR', 'UDAIPUR', D, '')],
  'Conducted Meetings': [new Array(34).fill('h'),
    con('C-RAVI-ATRU', 'BARAN', F3, 'ATRU'),
    con('C-LEAD-SHAHBAD', 'BARAN', D, 'SHAHBAD')],
  'Postponed Meetings': [['Meeting ID']], 'Cancelled Meetings': [['Meeting ID']] };
function sheet(rows) {
  const cell = (r, c) => ({ getValue: () => (rows[r - 1] || [])[c - 1] === undefined ? '' : rows[r - 1][c - 1],
    setValue: (v) => { while (rows.length < r) rows.push([]); rows[r - 1][c - 1] = v; },
    getValues: () => rows.slice(r - 1).map(x => [x[c - 1]]), setNumberFormat: noop });
  return { getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }), getLastRow: () => rows.length,
           getRange: cell, appendRow: (a) => rows.push(a.slice()) };
}
const ctx = {
  console, Logger: { log: noop }, MailApp: { sendEmail: noop },
  Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
  Utilities: { formatDate: (d) => String(d), sleep: noop },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: noop }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType() { return this; }, text: s }) },
  CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; },
    removeAll: (ks) => ks.forEach(k => delete cache[k]), putAll: (o) => Object.assign(cache, o),
    getAll: (ks) => { const o = {}; ks.forEach(k => { if (k in cache) o[k] = cache[k]; }); return o; } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
    getProperties: () => Object.assign({}, props), deleteProperty: (k) => { delete props[k]; } }) },
  SpreadsheetApp: { flush: noop, openById: () => ({ getSheetByName: (n) => sheets[n] ? sheet(sheets[n]) : null }) },
  CalendarApp: { getDefaultCalendar: () => ({}) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const get = (p) => JSON.parse(ctx.doGet({ parameter: p }).text);
const ids = (r) => (r.meetings || []).map(m => m.meetingId).sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b.slice().sort());
const BARAN = ['C-LEAD-SHAHBAD', 'C-RAVI-ATRU', 'M-LEAD-ATRU', 'M-LEAD-SHAHBAD', 'M-RAVI-ATRU', 'M-RAVI-KG', 'M-SEEMA'];

// 1. meeting list
const rF = get({ action: 'getReportData', scoped: '1', token: 'tF' });
ok('PC in ATRU: her own, and every meeting with an ATRU official; nothing else of BARAN',
   same(ids(rF), ['M-SEEMA', 'M-LEAD-ATRU', 'M-RAVI-ATRU', 'C-RAVI-ATRU']), JSON.stringify(ids(rF)));
ok('PC in ATRU: told which block', JSON.stringify(rF.scopeBlocks) === JSON.stringify(['ATRU']), JSON.stringify(rF.scopeBlocks));
const rF3 = get({ action: 'getReportData', scoped: '1', token: 'tF3' });
ok('PC with two blocks: meetings in either, and all his own (an ATRU official too)',
   same(ids(rF3), ['M-RAVI-KG', 'M-RAVI-ATRU', 'M-LEAD-SHAHBAD', 'C-RAVI-ATRU', 'C-LEAD-SHAHBAD']), JSON.stringify(ids(rF3)));
ok('Field with no block in the sheet: the district, as before', same(ids(get({ action: 'getReportData', scoped: '1', token: 'tF4' })), BARAN));
const rD = get({ action: 'getReportData', scoped: '1', token: 'tD' });
ok('District lead: every block of the district, and UDAIPUR', same(ids(rD), BARAN.concat(['M-UDAIPUR'])), JSON.stringify(ids(rD)));
ok('District lead: no block limit given', rD.scopeBlocks === undefined);
ok('State: everything', ids(get({ action: 'getReportData', scoped: '1', token: 'tS' })).length === 8);
ok('open portal: everything', ids(get({ action: 'getReportData' })).length === 8);

// 2. staff
const names = (r) => (r.employees || []).map(e => e.name).sort();
ok('PC in ATRU: the staff of ATRU only', same(names(get({ action: 'getEmployeeMaster', scoped: '1', token: 'tF' })), ['Seema Pankaj']));
ok('District lead: the staff of all its districts',
   same(names(get({ action: 'getEmployeeMaster', scoped: '1', token: 'tD' })), ['Jaswinder Singh', 'No Block', 'Ravi Kumar', 'Seema Pankaj']));

// 3. overview numbers
const sF = get({ action: 'getDashboardStats', scoped: '1', token: 'tF' });
ok('PC in ATRU overview: 3 planned meetings', sF.success && sF.totals.total === 3, JSON.stringify(sF.totals));
ok('PC in ATRU recent conducted: only the ATRU one',
   same((sF.recentConducted || []).map(m => m.meetingId), ['C-RAVI-ATRU']), JSON.stringify(sF.recentConducted));
ok('PC in ATRU overview: told which block', JSON.stringify(sF.scopeBlocks) === JSON.stringify(['ATRU']));
const sD = get({ action: 'getDashboardStats', scoped: '1', token: 'tD' });
ok('District lead overview: all 6 planned, both conducted', sD.totals.total === 6 && (sD.recentConducted || []).length === 2, JSON.stringify(sD.totals));

// 4. the block comes from the sheet, not from the sign-in
const m2 = JSON.parse(props.EMP_MIRROR_0); m2[F].block = 'SHAHBAD'; props.EMP_MIRROR_0 = JSON.stringify(m2);
Object.keys(cache).filter(k => /^emp_/.test(k)).forEach(k => delete cache[k]);
// SHAHBAD is also Ravi's block, so his meetings come in, and the ATRU one of the lead goes
const rMoved = get({ action: 'getReportData', scoped: '1', token: 'tF' });
ok('block changed in Employee_DB: the next view follows it',
   same(ids(rMoved), ['M-SEEMA', 'M-LEAD-SHAHBAD', 'C-LEAD-SHAHBAD', 'M-RAVI-KG', 'M-RAVI-ATRU', 'C-RAVI-ATRU']), JSON.stringify(ids(rMoved)));

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
