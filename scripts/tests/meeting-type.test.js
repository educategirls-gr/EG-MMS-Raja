// Three meeting types (6 Oct 2026, the team's feedback): One-on-One,
// Group/Joint Meeting and Field Visit, on the REAL Code.gs with Sheets faked.
// A page still open from before sends "Joint Visit" and it is saved under the
// new name; older rows are counted under it; the form has the three cards.
//   node scripts/tests/meeting-type.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const cache = {}, props = {};
const noop = () => {};
const S = 'seema.pankaj@educategirls.ngo';
props.EMP_MIRROR_N = '1';
props.EMP_MIRROR_0 = JSON.stringify({ [S]: { district: 'BARAN', districts: ['BARAN'], name: 'Seema Pankaj', designation: 'Program Coordinator', role: 'Field', email: S } });
const blankPlan = () => new Array(25).fill('');
const old = (id, type, status) => { const r = blankPlan(); r[0] = id; r[1] = 'BARAN'; r[2] = 'Seema Pankaj'; r[4] = S; r[8] = type; r[13] = status; return r; };
const sheets = {
  'Employee_DB': [['District','Block','Employee Name','Designation','Email','Role'], ['BARAN', '', 'Seema Pankaj', 'Program Coordinator', S, 'Field']],
  'Plan Meetings': [blankPlan().map((x, i) => i === 0 ? 'Meeting ID' : 'h' + i),
                    old('MTG-20261001-090000', 'Joint Visit', 'Conducted'), old('MTG-20261001-100000', 'Dept. Review', 'Planned')],
  'Conducted Meetings': [new Array(33).fill('').map((x, i) => i === 0 ? 'Meeting ID' : 'h' + i)],
  'Postponed Meetings': [['Meeting ID']], 'Cancelled Meetings': [['Meeting ID']] };
const con = new Array(33).fill(''); con[0] = 'MTG-20261001-090000'; con[1] = 'BARAN'; con[2] = 'Seema Pankaj'; con[4] = S; con[8] = 'Joint Visit';
sheets['Conducted Meetings'].push(con);
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
  CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; },
    removeAll: (ks) => ks.forEach(k => delete cache[k]), putAll: (o) => Object.assign(cache, o),
    getAll: (ks) => { const o = {}; ks.forEach(k => { if (k in cache) o[k] = cache[k]; }); return o; } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
    getProperties: () => Object.assign({}, props), deleteProperty: (k) => { delete props[k]; } }) },
  SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] ? sheet(sheets[n]) : null,
    getSheets: () => Object.keys(sheets).map(n => Object.assign(sheet(sheets[n]), { getName: () => n })) }) },
  CalendarApp: { getDefaultCalendar: () => ({}) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };

const iso = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
const plan = (type, name) => ({ email: S, employeeName: 'Seema Pankaj', district: 'BARAN', designation: 'Program Coordinator', meetingDate: iso,
  meetingTime: '11:00 AM', duration: '1 hr', meetingType: type, adhikariName: name, adhikariPost: 'Chief Block Education Officer/BEO',
  department: 'Education Department', purpose: 'Enrollment', agenda: 'Block-wise enrolment data for the coming session' });
const P = sheets['Plan Meetings'];

ok('a page from before sends "Joint Visit": saved as Group/Joint Meeting', ctx.saveMeeting(plan('Joint Visit', 'Official A')).success && P[P.length - 1][8] === 'Group/Joint Meeting', P[P.length - 1][8]);
ok('"Group/Joint Meeting" saved as it is', ctx.saveMeeting(plan('Group/Joint Meeting', 'Official B')).success && P[P.length - 1][8] === 'Group/Joint Meeting', P[P.length - 1][8]);
ok('"Field Visit" saved as it is', ctx.saveMeeting(plan('Field Visit', 'Official C')).success && P[P.length - 1][8] === 'Field Visit', P[P.length - 1][8]);
ok('"One-on-One" saved as it is', ctx.saveMeeting(plan('One-on-One', 'Official D')).success && P[P.length - 1][8] === 'One-on-One', P[P.length - 1][8]);

ctx.CACHE_clearAll();
const st = ctx.getDashboardStats(S, true, '');
const types = {}; (st.byType || []).forEach(t => { types[t.name] = t.count; });
ok('overview: old Joint Visit and Dept. Review rows counted under Group/Joint Meeting',
   JSON.stringify(types) === JSON.stringify({ 'Group/Joint Meeting': 4, 'Field Visit': 1, 'One-on-One': 1 }), JSON.stringify(st.byType));
ok('overview: the conducted old Joint Visit counts as a group session', st.dtfSessions === 1, st.dtfSessions);

const html = fs.readFileSync('docs/dashboard.html', 'utf8');
const cards = [...html.matchAll(/class="mtg-type-card" data-val="([^"]+)"/g)].map(m => m[1]);
ok('plan form: exactly the three cards', JSON.stringify(cards) === JSON.stringify(['One-on-One', 'Group/Joint Meeting', 'Field Visit']), JSON.stringify(cards));
ok('plan form: Hindi name for Group/Joint Meeting', /'Group\/Joint Meeting': 'सामूहिक \/ संयुक्त बैठक'/.test(html));
const rep = fs.readFileSync('docs/report.html', 'utf8');
ok('portal overview: icon and colour for Group/Joint Meeting', /'Group\/Joint Meeting':'👥'/.test(rep) && /'Group\/Joint Meeting':'#3B82F6'/.test(rep));

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
