// The analytics inside the app show the signed-in person's districts only
// (6 Oct 2026): District and Field their district plus additional ones, State
// everything. Through the REAL router (doGet) of Code.gs, Sheets and the cache
// faked. The open portal, without scoped=1, still answers for the whole state.
//   node scripts/tests/view-scope.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const cache = {}, props = {};
const noop = () => {};
const D  = 'jaswinder.singh@educategirls.ngo';   // District: UDAIPUR + BARAN, JHALAWAR
const F  = 'seema.pankaj@educategirls.ngo';      // Field: BARAN
const F2 = 'narayan.sarel@educategirls.ngo';     // Field: PALI
const S  = 'brajeshkumar.sinha@educategirls.ngo';// State
const emp = {
  [D]:  { district: 'UDAIPUR', districts: ['UDAIPUR', 'BARAN', 'JHALAWAR'], name: 'Jaswinder Singh', designation: 'District Operation Lead', role: 'District', email: D },
  [F]:  { district: 'BARAN', districts: ['BARAN'], name: 'Seema Pankaj', designation: 'Program Coordinator', role: 'Field', email: F },
  [F2]: { district: 'PALI', districts: ['PALI'], name: 'Narayan Lal Sarel', designation: 'Program Coordinator', role: 'Field', email: F2 },
  [S]:  { district: '', districts: [], name: 'Brajesh Kumar Sinha', designation: 'SoH', role: 'State', email: S } };
props.EMP_MIRROR_N = '1';
props.EMP_MIRROR_0 = JSON.stringify(emp);
// signed in: one session per person, as sessionFor_ writes them
const tok = { [D]: 'tD', [F]: 'tF', [F2]: 'tF2', [S]: 'tS' };
Object.keys(tok).forEach(e => { cache['SESSION_' + tok[e]] = JSON.stringify(Object.assign({}, emp[e])); });

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const plan = (id, dist, email, name, status) => { const r = new Array(25).fill(''); r[0] = id; r[1] = dist; r[2] = name; r[4] = email; r[5] = day(2);
  r[6] = '11:00 AM'; r[8] = 'One-on-One'; r[9] = 'Official ' + id; r[10] = 'BEO'; r[11] = 'Enrollment'; r[13] = status || 'Planned'; return r; };
const sheets = {
  'Employee_DB': [['District','Block','Employee Name','Designation','Email','Role','Zone','Additional Districts'],
    ['UDAIPUR', '', 'Jaswinder Singh', 'District Operation Lead', D, 'District', '', 'BARAN, JHALAWAR'],
    ['BARAN', 'ATRU', 'Seema Pankaj', 'Program Coordinator', F, 'Field', '', ''],
    ['PALI', 'SUMERPUR', 'Narayan Lal Sarel', 'Program Coordinator', F2, 'Field', '', ''],
    ['', '', 'Brajesh Kumar Sinha', 'SoH', S, 'State', '', '']],
  'Plan Meetings': [new Array(25).fill('h'),
    plan('M-BARAN', 'BARAN', F, 'Seema Pankaj'),
    plan('M-UDAIPUR', 'UDAIPUR', D, 'Jaswinder Singh'),
    plan('M-PALI', 'PALI', F2, 'Narayan Lal Sarel'),
    plan('M-JAIPUR-D', 'JAIPUR', D, 'Jaswinder Singh'),     // the lead's own meeting, filed state-level
    plan('M-JAIPUR-S', 'JAIPUR', S, 'Brajesh Kumar Sinha')],
  'Conducted Meetings': [new Array(33).fill('h')], 'Postponed Meetings': [['Meeting ID']], 'Cancelled Meetings': [['Meeting ID']] };
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
const all = ['M-BARAN', 'M-JAIPUR-D', 'M-JAIPUR-S', 'M-PALI', 'M-UDAIPUR'];

// 1. the open portal, unchanged
ok('open portal: every meeting', JSON.stringify(ids(get({ action: 'getReportData' }))) === JSON.stringify(all));
ok('open portal with a token but no scoped=1: still every meeting', JSON.stringify(ids(get({ action: 'getReportData', token: 'tF' }))) === JSON.stringify(all));

// 2. inside the app
const rD = get({ action: 'getReportData', scoped: '1', token: 'tD' });
ok('District lead: own district, additional districts, own state-level meeting; not PALI, not State\'s',
   JSON.stringify(ids(rD)) === JSON.stringify(['M-BARAN', 'M-JAIPUR-D', 'M-UDAIPUR']), JSON.stringify(ids(rD)));
ok('District lead: told which districts', JSON.stringify(rD.scope) === JSON.stringify(['UDAIPUR', 'BARAN', 'JHALAWAR']), JSON.stringify(rD.scope));
ok('PC in BARAN: the whole BARAN district, nothing else', JSON.stringify(ids(get({ action: 'getReportData', scoped: '1', token: 'tF' }))) === JSON.stringify(['M-BARAN']));
ok('PC in PALI: PALI only', JSON.stringify(ids(get({ action: 'getReportData', scoped: '1', token: 'tF2' }))) === JSON.stringify(['M-PALI']));
ok('State: the whole state', JSON.stringify(ids(get({ action: 'getReportData', scoped: '1', token: 'tS' }))) === JSON.stringify(all));
const bad = get({ action: 'getReportData', scoped: '1', token: 'expired' });
ok('scoped=1 with a lapsed sign-in: AUTH_REQUIRED, never the whole state', bad.success === false && bad.message === 'AUTH_REQUIRED' && !bad.meetings, JSON.stringify(bad));

// 3. employees
const eD = get({ action: 'getEmployeeMaster', scoped: '1', token: 'tD' });
ok('District lead: staff of their districts only', JSON.stringify((eD.employees || []).map(e => e.name).sort()) === JSON.stringify(['Jaswinder Singh', 'Seema Pankaj']), JSON.stringify(eD.employees));
ok('open portal: every employee', (get({ action: 'getEmployeeMaster' }).employees || []).length === 4);

// 4. overview numbers
const sD = get({ action: 'getDashboardStats', scoped: '1', token: 'tD' });
ok('District lead overview: 3 meetings, districts BARAN, JAIPUR (own), UDAIPUR', sD.success && sD.totals.total === 3 &&
   JSON.stringify(sD.districts.map(d => d.name).sort()) === JSON.stringify(['Baran', 'Jaipur', 'Udaipur']), JSON.stringify(sD.totals) + JSON.stringify(sD.districts));
const sAll = get({ action: 'getDashboardStats', all: '1' });
ok('open portal overview: all 5', sAll.totals.total === 5, JSON.stringify(sAll.totals));
ok('a scoped overview is never kept in the cache', !Object.keys(cache).some(k => /^stats_jaswinder/.test(k)), Object.keys(cache).filter(k => /^stats_/.test(k)).join(','));

// 5. a PC saves; the lead's overview shows it at once
const sv = ctx.saveMeeting({ email: F, employeeName: 'Seema Pankaj', district: 'BARAN', designation: 'Program Coordinator', meetingDate: day(4),
  meetingTime: '10:00 AM', duration: '1 hr', meetingType: 'One-on-One', adhikariName: 'New Official', adhikariPost: 'BEO',
  purpose: 'Enrollment', agenda: 'Block-wise enrolment data for the coming session' });
const sD2 = get({ action: 'getDashboardStats', scoped: '1', token: 'tD' });
ok('PC saves in BARAN: the lead\'s overview counts it at once', sv.success && sD2.totals.total === 4, JSON.stringify(sv) + ' ' + JSON.stringify(sD2.totals));
ok('...and the lead\'s meeting list has it', ids(get({ action: 'getReportData', scoped: '1', token: 'tD' })).length === 4);
ok('...and the PALI PC still does not see it', JSON.stringify(ids(get({ action: 'getReportData', scoped: '1', token: 'tF2' }))) === JSON.stringify(['M-PALI']));

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
