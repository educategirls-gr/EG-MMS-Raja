// All 41 official districts (12 Oct 2026) with the official spelling final:
// BALOTRA and JALORE, where the sheet had BALOTARA and JALOR. REAL Code.gs,
// Sheets and the cache faked. New rows get the official name; rows and
// sign-ins from before still match it everywhere.
//   node scripts/tests/districts.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const cache = {}, props = {};
const noop = () => {};
const K = 'kohla.ram@educategirls.ngo', H = 'hitendra.dave@educategirls.ngo', S = 'brajeshkumar.sinha@educategirls.ngo';
props.EMP_MIRROR_N = '1';
props.EMP_MIRROR_0 = JSON.stringify({
  [K]: { district: 'BALOTARA', districts: ['BALOTARA'], name: 'Kohla Ram', designation: 'Block Program Officer', role: 'Field', email: K },
  [H]: { district: 'BALOTARA', districts: ['BALOTARA'], name: 'Hitendra Dave', designation: 'Lead Ops. Vidya', role: 'District', email: H },
  [S]: { district: '', districts: [], name: 'Brajesh Kumar Sinha', designation: 'SoH', role: 'State', email: S } });
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const old = new Array(25).fill(''); Object.assign(old, { 0: 'MTG-OLD', 1: 'BALOTARA', 2: 'Kohla Ram', 4: K, 5: day(2), 6: '11:00 AM', 8: 'One-on-One',
  9: 'Official Old', 10: 'BEO', 11: 'Enrollment', 13: 'Planned' });
const sheets = {
  'Employee_DB': [['District','Block','Employee Name','Designation','Email','Role'],
    ['BALOTARA', 'BALOTRA', 'Kohla Ram', 'Block Program Officer', K, 'Field'],
    ['BALOTARA', '', 'Hitendra Dave', 'Lead Ops. Vidya', H, 'District'],
    ['', '', 'Brajesh Kumar Sinha', 'SoH', S, 'State']],
  'Plan Meetings': [new Array(25).fill('h'), old],
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
const P = sheets['Plan Meetings'];

// 1. names
ok('official name from any spelling', ['BALOTARA', 'balotra', ' Balotra '].every(x => ctx.officialDistrict_(x) === 'BALOTRA') &&
   ctx.officialDistrict_('Jalor') === 'JALORE' && ctx.officialDistrict_('sawai madhopur') === 'SAWAI MADHOPUR');
ok('an unknown name is left as it is', ctx.officialDistrict_('LUCKNOW') === 'LUCKNOW');

// 2. a Field user whose sign-in still says BALOTARA plans a meeting
const plan = (who, name, district, mname) => ({ email: who, employeeName: name, district, designation: 'x', meetingDate: day(3), meetingTime: '10:00 AM',
  duration: '1 hr', meetingType: 'One-on-One', adhikariName: mname, adhikariPost: 'BEO', purpose: 'Enrollment',
  agenda: 'Block-wise enrolment data for the coming session' });
ok('Field user: dropdown shows BALOTRA, not BALOTARA', JSON.stringify(ctx.getPlanDistricts('Field', '', ['BALOTARA'])) === JSON.stringify(['BALOTRA', 'JAIPUR']));
ctx.saveMeeting(plan(K, 'Kohla Ram', 'BALOTARA', 'Official New'));
ok('saved under the official name BALOTRA', P[P.length - 1][1] === 'BALOTRA', P[P.length - 1][1]);
// 3. a State user plans in a district with no EG staff
ctx.saveMeeting(plan(S, 'Brajesh Kumar Sinha', 'Sawai Madhopur', 'Official SWM'));
ok('State user: a district with no staff, saved as SAWAI MADHOPUR', P[P.length - 1][1] === 'SAWAI MADHOPUR', P[P.length - 1][1]);

// 4. the lead's District Meetings: the old row and the new one, whichever spelling the lead's sign-in has
const ids = (l) => l.map(m => m.meetingId).sort();
const viaOld = ctx.getDistrictAllMeetings('BALOTARA'), viaNew = ctx.getDistrictAllMeetings('BALOTRA');
ok('District Meetings for BALOTARA: old and new rows', viaOld.length === 2 && viaOld.some(m => m.meetingId === 'MTG-OLD'), JSON.stringify(ids(viaOld)));
ok('...and the same asked as BALOTRA', JSON.stringify(ids(viaNew)) === JSON.stringify(ids(viaOld)));
ok('lead signed in as BALOTARA asking for BALOTRA is allowed', ctx.resolveActiveDistrict_({ role: 'District', district: 'BALOTARA', districts: ['BALOTARA'] }, 'BALOTRA') === 'BALOTARA');
// a new save clears the lead's cached list, under either spelling
ctx.saveMeeting(plan(K, 'Kohla Ram', 'BALOTRA', 'Official Third'));
ok('a new save shows in the lead\'s cached list at once', ctx.getDistrictAllMeetings('BALOTARA').length === 3);
ok('colleague list for BALOTRA finds staff written BALOTARA', ctx.getDistrictEmployees('BALOTRA', S).length === 2);

// 5. portal and overview: one district, official name
ctx.CACHE_clearAll();
const rep = ctx.getReportData();
ok('portal data: the old BALOTARA row is shown as BALOTRA', rep.meetings.filter(m => m.meetingId === 'MTG-OLD')[0].district === 'BALOTRA');
ok('portal data: no meeting left under BALOTARA', !rep.meetings.some(m => m.district === 'BALOTARA'));
ok('staff list: BALOTARA staff shown under BALOTRA', ctx.getEmployeeMaster().employees.filter(e => e.name === 'Kohla Ram')[0].district === 'BALOTRA');
const st = ctx.getDashboardStats(S, true, '');
ok('overview: one Balotra row with all 3, not two rows', JSON.stringify(st.districts.map(d => d.name + ':' + d.total)) === JSON.stringify(['Balotra:3', 'Sawai madhopur:1']), JSON.stringify(st.districts));

// 6. blocks
const dd = ctx.getDropdownData(K);
ok('blocks of BALOTRA from the official record, also under BALOTARA', dd.blocksByDistrict.BALOTRA.length === 9 && dd.blocksByDistrict.BALOTRA.includes('PACHPADRA') &&
   JSON.stringify(dd.blocksByDistrict.BALOTARA) === JSON.stringify(dd.blocksByDistrict.BALOTRA));

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
