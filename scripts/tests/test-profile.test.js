// The REAL getEmployeeMaster, getReportData, getDashboardStats and
// askAllMeetings_ out of Code.gs on faked sheets. The developer's test profile
// (designation starting "Test") and its meetings must stay out of the open
// portal, the monthly report and the chatbot (3 Oct 2026); real people and
// meetings must not be touched.
//   node scripts/tests/test-profile.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

function world(aloksDesignation) {
  const cache = {};
  const noop = () => {};
  const c = { get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; },
              removeAll: (ks) => ks.forEach(k => delete cache[k]), putAll: (o) => Object.assign(cache, o),
              getAll: (ks) => { const o = {}; ks.forEach(k => { if (k in cache) o[k] = cache[k]; }); return o; } };
  const ctx = {
    console, Logger: { log: noop }, Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
    Utilities: { formatDate: (d) => String(d), sleep: noop },
    CacheService: { getScriptCache: () => c },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, getProperties: () => ({}), setProperties: noop, setProperty: noop }) },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  const D = vm.runInContext('new Date(2026, 9, 2)', ctx);
  const plan = (id, dist, name, email, status) => { const r = new Array(24).fill(''); r[0] = id; r[1] = dist; r[2] = name; r[3] = 'x'; r[4] = email;
    r[5] = D; r[6] = '11:00 AM'; r[8] = 'One-on-One'; r[9] = 'Official ' + id; r[10] = 'Secretary'; r[11] = 'Enrollment'; r[13] = status; return r; };
  const con = (id, dist, name, email) => { const r = new Array(32).fill(''); r[0] = id; r[1] = dist; r[2] = name; r[4] = email; r[8] = 'One-on-One';
    r[9] = 'Official ' + id; r[10] = 'Secretary'; r[11] = 'Enrollment'; r[13] = D; r[15] = 'Discussed: x'; return r; };
  const A = 'alok.mohan@educategirls.ngo', S = 'seema.pankaj@educategirls.ngo';
  const sheets = {
    'Employee_DB': [['District','Block','Employee Name','Designation','Email','Role','Zone','Additional Districts'],
      ['', '', 'Alok Mohan', aloksDesignation, A, 'State', '', ''],
      ['', '', 'Brajesh Kumar Sinha', 'SoH', 'brajeshkumar.sinha@educategirls.ngo', 'State', '', ''],
      ['BARAN', 'ATRU, BARAN', 'Seema Pankaj', 'Program Coordinator', S, 'Field', '', '']],
    'Plan Meetings': [['Meeting ID'], plan('MTG-A1', 'JAIPUR', 'Alok Mohan', A, 'Conducted'), plan('MTG-A2', 'JAIPUR', 'Alok Mohan', A, 'Planned'),
                      plan('MTG-S1', 'BARAN', 'Seema Pankaj', S, 'Conducted'), plan('MTG-S2', 'BARAN', 'Seema Pankaj', S, 'Planned')],
    'Conducted Meetings': [['Meeting ID'], con('MTG-A1', 'JAIPUR', 'Alok Mohan', A), con('MTG-S1', 'BARAN', 'Seema Pankaj', S)],
    'Postponed Meetings': [['Meeting ID']], 'Cancelled Meetings': [['Meeting ID']] };
  const sheet = (rows) => ({ getDataRange: () => ({ getValues: () => rows }), getLastRow: () => rows.length });
  ctx.SpreadsheetApp = { openById: () => ({ getSheetByName: (n) => sheets[n] ? sheet(sheets[n]) : null }) };
  return ctx;
}

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const ids = (list) => list.map(m => m.meetingId || m.id).sort().join(',');

let w = world('Test User');
const emps = w.getEmployeeMaster().employees.map(e => e.name);
ok('employee list (portal): no test profile, real people kept', emps.indexOf('Alok Mohan') < 0 && emps.indexOf('Seema Pankaj') >= 0 && emps.indexOf('Brajesh Kumar Sinha') >= 0, emps.join());
const rep = w.getReportData();
ok('report data (portal, monthly report): only real meetings', ids(rep.meetings) === 'MTG-S1,MTG-S2', ids(rep.meetings));
const st = w.getDashboardStats('brajeshkumar.sinha@educategirls.ngo', true, '');
ok('dashboard stats (portal totals): test meetings not counted', st.totals && st.totals.total === 2 && st.totals.conducted === 1 && st.totals.planned === 1, JSON.stringify(st.totals));
ok('recent conducted (portal): no test meeting', ids(st.recentConducted || []) === 'MTG-S1', ids(st.recentConducted || []));
ok('chatbot data: only real meetings', ids(w.askAllMeetings_()) === 'MTG-S1,MTG-S2', ids(w.askAllMeetings_()));

w = world('Testing Head');
ok('"Testing Head" is a test profile too', ids(w.getReportData().meetings) === 'MTG-S1,MTG-S2');

w = world('State Lead');   // not a test profile: nothing may be hidden
ok('a real designation: every meeting kept in report data', ids(w.getReportData().meetings) === 'MTG-A1,MTG-A2,MTG-S1,MTG-S2', ids(w.getReportData().meetings));
ok('a real designation: kept in the employee list and the stats', w.getEmployeeMaster().employees.length === 3 &&
   w.getDashboardStats('brajeshkumar.sinha@educategirls.ngo', true, '').totals.total === 4);
ok('a real designation: kept in the chatbot', ids(w.askAllMeetings_()) === 'MTG-A1,MTG-A2,MTG-S1,MTG-S2');

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
