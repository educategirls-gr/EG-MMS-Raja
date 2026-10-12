// 12 Oct 2026 batch: plan a day back, edit a meeting not yet held, Block
// Meetings for block staff, feedback from a district lead. REAL Code.gs
// (doGet included), Sheets, mail, calendar, cache and lock faked.
//   node scripts/tests/plan-edit.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const cache = {}, props = {}, mails = [], dropped = [];
const noop = () => {};
const D = 'jaswinder.singh@educategirls.ngo', F = 'seema.pankaj@educategirls.ngo', F2 = 'sanjay.goswami@educategirls.ngo',
      C = 'sunil.prajapati@educategirls.ngo', P = 'narayan.sarel@educategirls.ngo', S = 'brajeshkumar.sinha@educategirls.ngo';
const emp = {
  [D]:  { district: 'UDAIPUR', districts: ['UDAIPUR', 'BARAN'], name: 'Jaswinder Singh', designation: 'District Operation Lead', role: 'District', email: D, block: '' },
  [F]:  { district: 'BARAN', districts: ['BARAN'], name: 'Seema Pankaj', designation: 'Program Coordinator', role: 'Field', email: F, block: 'ATRU, BARAN' },
  [F2]: { district: 'BARAN', districts: ['BARAN'], name: 'Sanjay Goswami', designation: 'Program Coordinator', role: 'Field', email: F2, block: 'KISHANGANJ, SHAHBAD' },
  [C]:  { district: 'BARAN', districts: ['BARAN'], name: 'Sunil Prajapati', designation: 'Program Coordinator', role: 'Field', email: C, block: 'MANGROL' },
  [P]:  { district: 'PALI', districts: ['PALI'], name: 'Narayan Lal Sarel', designation: 'Program Coordinator', role: 'Field', email: P, block: 'SUMERPUR' },
  [S]:  { district: '', districts: [], name: 'Brajesh Kumar Sinha', designation: 'SoH', role: 'State', email: S, block: '' } };
props.EMP_MIRROR_N = '1';
props.EMP_MIRROR_0 = JSON.stringify(emp);
const tok = { [D]: 'tD', [F]: 'tF', [S]: 'tS' };
Object.keys(tok).forEach(e => { cache['SESSION_' + tok[e]] = JSON.stringify(emp[e]); });

const day = (n) => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const plan = (id, email, name, dist, status, extra) => { const r = new Array(25).fill(''); Object.assign(r, { 0: id, 1: dist, 2: name, 3: emp[email].designation, 4: email,
  5: day(3), 6: '11:00 AM', 7: '1 hr', 8: 'One-on-One', 9: 'Official ' + id, 10: 'Chief Block Education Officer/BEO', 11: 'Enrollment',
  12: 'Agenda for ' + id, 13: status || 'Planned' }, extra || {}); return r; };
const sheets = {
  'Employee_DB': [['District','Block','Employee Name','Designation','Email','Role'],
    ...Object.values(emp).map(e => [e.district, e.block, e.name, e.designation, e.email, e.role])],
  'Plan Meetings': [new Array(25).fill('h'),
    plan('M-OWN', F, 'Seema Pankaj', 'BARAN', 'Planned', { 17: 'Sanjay Goswami', 18: 'Program Coordinator', 22: 'ev-own' }),
    plan('M-HELD', F, 'Seema Pankaj', 'BARAN', 'Conducted'),
    plan('M-DOL', D, 'Jaswinder Singh', 'UDAIPUR', 'Planned'),
    plan('M-OLD', F, 'Seema Pankaj', 'BARAN', 'Planned', { 5: day(-5) }),
    plan('M-ATRU', D, 'Jaswinder Singh', 'BARAN', 'Planned', { 23: 'ATRU' }),       // the lead's meeting with an official in ATRU block
    plan('M-SHAHBAD', F2, 'Sanjay Goswami', 'BARAN', 'Planned', { 23: 'SHAHBAD' }),
    plan('M-PALI', P, 'Narayan Lal Sarel', 'PALI', 'Planned')],
  'Conducted Meetings': [new Array(34).fill('h'), Object.assign(new Array(34).fill(''), { 0: 'M-HELD', 1: 'BARAN', 2: 'Seema Pankaj', 4: F, 9: 'Official M-HELD',
    10: 'BEO', 11: 'Enrollment', 13: day(-1) }),
    Object.assign(new Array(34).fill(''), { 0: 'M-PALI-HELD', 1: 'PALI', 2: 'Narayan Lal Sarel', 4: P, 9: 'Official P', 10: 'BEO', 11: 'Enrollment', 13: day(-1) })],
  'Postponed Meetings': [['Meeting ID']], 'Cancelled Meetings': [['Meeting ID']] };
function sheet(rows) {
  const cell = (r, c) => ({ getValue: () => (rows[r - 1] || [])[c - 1] === undefined ? '' : rows[r - 1][c - 1],
    setValue: (v) => { while (rows.length < r) rows.push([]); rows[r - 1][c - 1] = v; },
    getValues: () => rows.slice(r - 1).map(x => [x[c - 1]]), setNumberFormat: noop });
  return { getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }), getLastRow: () => rows.length,
           getRange: cell, appendRow: (a) => rows.push(a.slice()) };
}
const ctx = {
  console, Logger: { log: noop },
  MailApp: { sendEmail: (o) => mails.push(o) },
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
  CalendarApp: { getDefaultCalendar: () => ({ getEventById: (id) => ({ deleteEvent: () => dropped.push(id) }) }) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const PL = sheets['Plan Meetings'];
const row = (id) => PL.filter(r => r[0] === id)[0];
const get = (p) => JSON.parse(ctx.doGet({ parameter: p }).text);

// 1. a day back
const base = { email: F, employeeName: 'Seema Pankaj', district: 'BARAN', designation: 'Program Coordinator', meetingTime: '10:00 AM', duration: '1 hr',
  meetingType: 'One-on-One', adhikariPost: 'BEO', purpose: 'Enrollment', agenda: 'Block-wise enrolment data for the coming session' };
const y = ctx.saveMeeting(Object.assign({}, base, { meetingDate: day(-1), adhikariName: 'Called In Official' }));
ok('a meeting held yesterday can be planned', y.success === true, JSON.stringify(y));
const tooOld = ctx.saveMeeting(Object.assign({}, base, { meetingDate: day(-2), adhikariName: 'Too Old' }));
ok('two days back is refused', tooOld.success === false && /one day back/.test(tooOld.message), JSON.stringify(tooOld));

// 2. edit
ctx.getMyMeetings(F);   // the list sits in the cache, as on the live site
const ed = ctx.updateMeeting(emp[F], { meetingId: 'M-OWN', district: 'BARAN', meetingDate: day(5), meetingTime: '3:30 PM', duration: '2 hr',
  meetingType: 'Joint Visit', adhikariName: 'New Official', adhikariPost: 'Child Development Project Officer', purpose: 'Training',
  agenda: 'A changed agenda for the meeting', colleagueName: 'Sanjay Goswami, Sunil Prajapati', colleaguePost: 'Program Coordinator, Program Coordinator',
  adhikariBlock: 'ANTA', department: 'Women & Child Development' });
const r = row('M-OWN');
ok('own planned meeting edited', ed.success === true, JSON.stringify(ed));
ok('every field written to its column', r[5] === day(5) && r[6] === '3:30 PM' && r[7] === '2 hr' && r[8] === 'Group/Joint Meeting' && r[9] === 'New Official' &&
   r[10] === 'Child Development Project Officer' && r[11] === 'Training' && r[12] === 'A changed agenda for the meeting' &&
   r[17] === 'Sanjay Goswami, Sunil Prajapati' && r[23] === 'ANTA' && r[24] === 'Women & Child Development', JSON.stringify(r));
ok('id, officer and status unchanged', r[0] === 'M-OWN' && r[4] === F && r[13] === 'Planned');
ok('old calendar event taken down, its id cleared for the sync', dropped.includes('ev-own') && r[22] === '');
ok('only the newly added colleague is invited', mails.length === 1 && mails[0].to === C, JSON.stringify(mails.map(m => m.to)));
ok('Manage Meetings shows the change at once', ctx.getMyMeetings(F).filter(m => m.meetingId === 'M-OWN')[0].adhikariName === 'New Official');
ok('someone else\'s meeting: refused', /only your own/.test(ctx.updateMeeting(emp[F], { meetingId: 'M-DOL', meetingDate: day(5), adhikariName: 'x', adhikariPost: 'x', purpose: 'x' }).message));
ok('State may edit anyone\'s', ctx.updateMeeting(emp[S], { meetingId: 'M-DOL', district: 'UDAIPUR', meetingDate: day(6), meetingTime: '10:00 AM', adhikariName: 'By State',
   adhikariPost: 'BEO', purpose: 'Enrollment', agenda: 'x' }).success === true && row('M-DOL')[9] === 'By State');
ok('a meeting already held: refused', /not been held/.test(ctx.updateMeeting(emp[F], { meetingId: 'M-HELD', meetingDate: day(5), adhikariName: 'x', adhikariPost: 'x', purpose: 'x' }).message));
const oldKeep = ctx.updateMeeting(emp[F], { meetingId: 'M-OLD', district: 'BARAN', meetingDate: day(-5), meetingTime: '11:00 AM', adhikariName: 'Fixed Name',
  adhikariPost: 'BEO', purpose: 'Enrollment', agenda: 'only the name is corrected' });
ok('an overdue meeting keeps its old date while its details are corrected', oldKeep.success === true && row('M-OLD')[9] === 'Fixed Name', JSON.stringify(oldKeep));
const oldMove = ctx.updateMeeting(emp[F], { meetingId: 'M-OLD', meetingDate: day(-3), adhikariName: 'x', adhikariPost: 'x', purpose: 'x' });
ok('...but cannot be moved to a new date further back than a day', /one day back/.test(oldMove.message), JSON.stringify(oldMove));
// through the router, as the page sends it
const viaRouter = JSON.parse(ctx.doPost({ parameter: { action: 'updateMeeting', token: 'tF' }, postData: { contents: JSON.stringify({ meetingId: 'M-OWN',
  district: 'BARAN', meetingDate: day(5), meetingTime: '3:30 PM', adhikariName: 'Via Router', adhikariPost: 'BEO', purpose: 'Training', agenda: 'x' }) } }).text);
ok('router: updateMeeting as a POST with the session', viaRouter.success === true && row('M-OWN')[9] === 'Via Router', JSON.stringify(viaRouter));
ok('router: updateMeeting as a GET is refused (body lost on a redirect)', get({ action: 'updateMeeting', token: 'tF' }).message === 'BODY_MISSING');

// 3. Block Meetings
const blk = get({ action: 'getBlockAllMeetings', token: 'tF' });
const ids = (l) => (Array.isArray(l) ? l : []).map(m => m.meetingId).sort();
ok('PC in ATRU, BARAN: own meetings and the lead\'s ATRU meeting, not SHAHBAD, not PALI',
   ids(blk).includes('M-OWN') && ids(blk).includes('M-ATRU') && ids(blk).includes('M-HELD') && !ids(blk).includes('M-SHAHBAD') && !ids(blk).includes('M-PALI'), JSON.stringify(ids(blk)));
ok('every status: the conducted one is there too', (blk || []).some(m => m.meetingId === 'M-HELD' && m.status === 'Conducted'));
ok('block staff may no longer pull the whole district list', get({ action: 'getDistrictAllMeetings', token: 'tF' }).message === 'FORBIDDEN');
const dl = get({ action: 'getDistrictAllMeetings', token: 'tD', district: 'BARAN' });
ok('the district list carries block and officer block for the filter',
   dl.some(m => m.meetingId === 'M-ATRU' && m.block === 'ATRU') && dl.some(m => m.meetingId === 'M-SHAHBAD' && /SHAHBAD/.test(m.officerBlock)));

// 4. feedback from a district lead
mails.length = 0;
const fb = ctx.sendMeetingFeedback(emp[D], 'M-HELD', 'Good meeting, please share the data sheet too.', 'req-1');
ok('district lead: feedback on a meeting in their district is sent', fb.success === true && mails.length === 1 && mails[0].to === F, JSON.stringify(fb));
const fb2 = ctx.sendMeetingFeedback(emp[D], 'M-PALI-HELD', 'Not my district.', 'req-2');
ok('district lead: a meeting in another district is refused', fb2.success === false && fb2.message === 'FORBIDDEN', JSON.stringify(fb2));
ok('block staff still cannot send feedback', ctx.sendMeetingFeedback(emp[F], 'M-HELD', 'Trying anyway.', 'req-3').message === 'FORBIDDEN');

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
