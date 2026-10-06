// Stakeholder Type (department) on a meeting (6 Oct 2026), end to end on the
// REAL Code.gs with Sheets, Docs, Calendar and the cache faked: the list from
// the "Stakeholder Type" tab, saved in Plan Meetings Y, shown to Manage
// Meetings, carried to Conducted Meetings AG, to a follow-up, the MoM, the
// calendar invite and the portal data.
//   node scripts/tests/department.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const cache = {}, props = {}, paras = [], events = [];
const noop = () => {};
const S = 'seema.pankaj@educategirls.ngo';
props.EMP_MIRROR_N = '1';
props.EMP_MIRROR_0 = JSON.stringify({ [S]: { district: 'BARAN', districts: ['BARAN'], name: 'Seema Pankaj', designation: 'Program Coordinator', role: 'Field', email: S } });
const sheets = {
  'Stakeholder Type': [['Departments'], ['Education Department'], ['Panchayati Raj Department'], ['Education Department'], ['Others']],
  'Employee_DB': [['District','Block','Employee Name','Designation','Email','Role'], ['BARAN', '', 'Seema Pankaj', 'Program Coordinator', S, 'Field']],
  'Plan Meetings': [new Array(24).fill('').map((x, i) => i === 0 ? 'Meeting ID' : 'h' + i)],
  'Conducted Meetings': [new Array(32).fill('').map((x, i) => i === 0 ? 'Meeting ID' : 'h' + i)],
  'Postponed Meetings': [['Meeting ID']], 'Cancelled Meetings': [['Meeting ID']] };
function sheet(rows) {
  const cell = (r, c) => ({ getValue: () => (rows[r - 1] || [])[c - 1] === undefined ? '' : rows[r - 1][c - 1],
    setValue: (v) => { while (rows.length < r) rows.push([]); rows[r - 1][c - 1] = v; },
    getValues: () => rows.slice(r - 1).map(x => [x[c - 1]]), setNumberFormat: noop });
  return { getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }), getLastRow: () => rows.length,
           getRange: cell, appendRow: (a) => rows.push(a.slice()) };
}
const chain = new Proxy(function () {}, {
  get: (t, k) => k === 'appendParagraph' ? (s) => { paras.push(String(s)); return chain; }
           : k === 'getId' ? () => 'doc-1' : k === 'getUrl' ? () => 'https://docs/doc-1' : chain,
  apply: () => chain });
const ctx = {
  console, Logger: { log: noop }, MailApp: { sendEmail: noop },
  Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
  Utilities: { formatDate: (d) => String(d), sleep: noop, base64Decode: (s) => s, newBlob: () => ({}) },
  CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; },
    removeAll: (ks) => ks.forEach(k => delete cache[k]), putAll: (o) => Object.assign(cache, o),
    getAll: (ks) => { const o = {}; ks.forEach(k => { if (k in cache) o[k] = cache[k]; }); return o; } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
    getProperties: () => Object.assign({}, props), setProperties: (o) => Object.assign(props, o), deleteProperty: (k) => { delete props[k]; } }) },
  SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] ? sheet(sheets[n]) : null,
    getSheets: () => Object.keys(sheets).map(n => Object.assign(sheet(sheets[n]), { getName: () => n })) }) },
  DocumentApp: chain,
  DriveApp: { Access: {}, Permission: {}, getFileById: () => ({ setSharing: noop, moveTo: noop }),
              getFolderById: () => ({ getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => ({ getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => ({}) }) }) },
  CalendarApp: { getDefaultCalendar: () => ({ createEvent: (title, s, e, o) => { events.push(o); return { getId: () => 'ev-1' }; },
                                             createAllDayEvent: (title, s, o) => { events.push(o); return { getId: () => 'ev-1' }; } }) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };

// 1. the list
const dd = ctx.getDropdownData('');
ok('departments from the Stakeholder Type tab: header skipped, repeat shown once', JSON.stringify(dd.departments) === JSON.stringify(['Education Department', 'Panchayati Raj Department', 'Others']), JSON.stringify(dd.departments));
ok('department copy kept in Script Properties', JSON.parse(props.DEPTS_MIRROR || '[]').length === 3);

// 2. plan
const future = new Date(Date.now() + 3 * 864e5), iso = future.toISOString().slice(0, 10);
const plan = { email: S, employeeName: 'Seema Pankaj', district: 'BARAN', designation: 'Program Coordinator', meetingDate: iso, meetingTime: '11:00 AM',
  duration: '1 hr', meetingType: 'One-on-One', adhikariName: 'Ramesh Meena', adhikariPost: 'Chief Block Education Officer/BEO',
  department: 'Education Department', purpose: 'Enrollment', agenda: 'Block-wise enrolment data for the coming session', colleagueName: '', colleaguePost: '' };
const sv = ctx.saveMeeting(plan);
const P = sheets['Plan Meetings'];
ok('plan saved', sv.success === true && P.length === 2, JSON.stringify(sv));
ok('department in Plan Meetings column Y, header written', P[1][24] === 'Education Department' && P[0][24] === 'Stakeholder Type', 'Y=' + P[1][24] + ' header=' + P[0][24]);
const mine = ctx.getMyMeetings(S);
ok('Manage Meetings list carries the department', mine.length === 1 && mine[0].department === 'Education Department', JSON.stringify(mine[0] && mine[0].department));

// 3. calendar invite
P[1][5] = vm.runInContext('new Date(' + future.getTime() + ')', ctx);   // a real date in the date column, as Sheets returns it
ctx.syncCalendarEvents('test', 5);
ok('calendar invite description names the department', events.length === 1 && /Department: Education Department/.test(events[0].description), events[0] && events[0].description);

// 4. conduct, with a follow-up and the MoM, the client sending no department.
// Ids are made from the time to the second, and here plan and conduct run in
// the same second, so the plan is given an earlier id, as it would have.
P[1][0] = 'MTG-20261001-090000';
ctx.CACHE_clearAll();
const id = P[1][0];
const cr = ctx.conductMeeting({ meetingId: id, district: 'BARAN', email: S, employeeName: 'Seema Pankaj', adhikariName: 'Ramesh Meena',
  adhikariPost: 'Chief Block Education Officer/BEO', purpose: 'Enrollment', keyPoints: 'Discussed: x', conductDate: '2026-10-06',
  photos: [], skipMom: false, followUp: { date: iso, time: '10:00 AM' } });
const C = sheets['Conducted Meetings'];
ok('conducted', cr.success === true, JSON.stringify(cr));
ok('department carried from the plan row to Conducted Meetings column AG', C[1][32] === 'Education Department' && C[0][32] === 'Stakeholder Type', 'AG=' + C[1][32]);
ok('follow-up plan row carries it too', P[2] && P[2][24] === 'Education Department', P[2] && P[2][24]);
ok('MoM document names the department', paras.indexOf('Department: Education Department') >= 0, paras.filter(p => /Department/.test(p)).join('|'));

// 5. portal data
ctx.CACHE_clearAll();
const rep = ctx.getReportData();
ok('portal data: every meeting has its department', rep.meetings.length === 2 && rep.meetings.every(m => m.department === 'Education Department'), JSON.stringify(rep.meetings.map(m => m.meetingId + ':' + m.department)));

// 6. a plan without one (older page) still saves
const old = Object.assign({}, plan, { adhikariName: 'Another Official', department: undefined });
ok('a plan without a department still saves, column Y left empty', ctx.saveMeeting(old).success === true && !P[P.length - 1][24]);

// 7. the tab once had a space at the end of its name; it is still found
sheets['Stakeholder Type '] = sheets['Stakeholder Type'];
delete sheets['Stakeholder Type'];
ok('tab named "Stakeholder Type " (space at the end) is still read', ctx.DEPT_refresh() === 3);
delete sheets['Stakeholder Type '];
ok('no such tab: nothing read, the stored copy is kept', ctx.DEPT_refresh() === 0 && JSON.parse(props.DEPTS_MIRROR).length === 3);

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
