// Deleting a meeting (follow-ups included), not holding it, or moving it keeps
// every list and the calendar in step (team feedback, 6 Oct 2026). REAL
// Code.gs; Sheets, Calendar, cache and lock faked. Before the fix a deleted
// follow-up stayed in the cached lists for up to fifteen minutes and on the
// officer's calendar for good.
//   node scripts/tests/delete-sync.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const cache = {}, props = {};
const noop = () => {};
const D = 'jaswinder.singh@educategirls.ngo', F = 'seema.pankaj@educategirls.ngo', S = 'brajeshkumar.sinha@educategirls.ngo';
props.EMP_MIRROR_N = '1';
props.EMP_MIRROR_0 = JSON.stringify({
  [D]: { district: 'BARAN', districts: ['BARAN'], name: 'Jaswinder Singh', designation: 'District Operation Lead', role: 'District', email: D },
  [F]: { district: 'BARAN', districts: ['BARAN'], name: 'Seema Pankaj', designation: 'Program Coordinator', role: 'Field', email: F },
  [S]: { district: '', districts: [], name: 'Brajesh Kumar Sinha', designation: 'SoH', role: 'State', email: S } });

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const row = (id, email, name, status, eventId, date) => { const r = new Array(25).fill(''); r[0] = id; r[1] = 'BARAN'; r[2] = name; r[4] = email;
  r[5] = date || day(3); r[6] = '11:00 AM'; r[7] = '1 hr'; r[8] = 'One-on-One'; r[9] = 'Official ' + id; r[10] = 'Chief Block Education Officer/BEO';
  r[11] = 'Enrollment'; r[13] = status; r[22] = eventId || ''; return r; };
const sheets = {
  'Employee_DB': [['District','Block','Employee Name','Designation','Email','Role']],
  'Plan Meetings': [new Array(25).fill('h'),
    row('MTG-A', D, 'Jaswinder Singh', 'Follow-up', 'ev-A'),
    row('MTG-B', F, 'Seema Pankaj', 'Planned', 'ev-B'),
    row('MTG-C', D, 'Jaswinder Singh', 'Planned', 'ev-C'),
    row('MTG-E', D, 'Jaswinder Singh', 'Planned', 'ev-E'),
    row('MTG-G', D, 'Jaswinder Singh', 'Planned', ''),
    row('MTG-H', D, 'Jaswinder Singh', 'Planned', 'ev-broken')],
  'Conducted Meetings': [['Meeting ID']], 'Postponed Meetings': [['Meeting ID']], 'Cancelled Meetings': [['Meeting ID']] };
function sheet(rows) {
  const cell = (r, c) => ({ getValue: () => (rows[r - 1] || [])[c - 1] === undefined ? '' : rows[r - 1][c - 1],
    setValue: (v) => { while (rows.length < r) rows.push([]); rows[r - 1][c - 1] = v; }, setNumberFormat: noop });
  return { getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }), getLastRow: () => rows.length,
           getRange: cell, appendRow: (a) => rows.push(a.slice()), deleteRow: (r) => rows.splice(r - 1, 1) };
}
// The calendar: events by id, with what happened to each.
const events = {}, made = [];
const mkEvent = (id, allDay) => (events[id] = { id, allDay, deleted: false, start: null, end: null,
  getId() { return id; }, isAllDayEvent() { return this.allDay; }, deleteEvent() { this.deleted = true; },
  setTime(s, e) { this.start = s; this.end = e; }, setAllDayDate(d) { this.start = d; } });
['ev-A', 'ev-B', 'ev-C', 'ev-E'].forEach(id => mkEvent(id, false));
let calBroken = false;
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
  CalendarApp: { getDefaultCalendar: () => ({
    getEventById: (id) => { if (id === 'ev-broken' || calBroken) throw new Error('Calendar is not answering'); return events[id] || null; },
    createEvent: (title, s, e, o) => { const id = 'ev-new-' + made.length; made.push({ title, s, e, o }); return mkEvent(id, false); },
    createAllDayEvent: (title, s, o) => { const id = 'ev-new-' + made.length; made.push({ title, s, o }); return mkEvent(id, true); } }) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const P = sheets['Plan Meetings'];
const ids = () => P.slice(1).map(r => r[0]);

// 1. the lists are read once, so they sit in the cache, as on the live site
const before = ctx.getMyMeetings(D).map(m => m.meetingId);
const distBefore = ctx.getDistrictAllMeetings('BARAN').map(m => m.meetingId);
ok('setup: the follow-up is in Manage Meetings and the district list', before.includes('MTG-A') && distBefore.includes('MTG-A'), JSON.stringify([before, distBefore]));

// 2. the DOL deletes their own follow-up
const r1 = ctx.deleteMeeting('MTG-A', D);
ok('own follow-up deleted', r1.success === true && !ids().includes('MTG-A'), JSON.stringify(r1));
ok('gone from Manage Meetings at once, no cache clearing by hand', !ctx.getMyMeetings(D).map(m => m.meetingId).includes('MTG-A'));
ok('gone from the district list at once', !ctx.getDistrictAllMeetings('BARAN').map(m => m.meetingId).includes('MTG-A'));
ok('its calendar event deleted', events['ev-A'].deleted === true);

// 3. who may delete what
const r2 = ctx.deleteMeeting('MTG-B', F);
ok('Field still cannot delete, not even their own', r2.success === false && /Field/.test(r2.message) && ids().includes('MTG-B'), JSON.stringify(r2));
const r3 = ctx.deleteMeeting('MTG-B', D);
ok('District cannot delete someone else\'s meeting', r3.success === false && /only your own/.test(r3.message) && ids().includes('MTG-B') && !events['ev-B'].deleted, JSON.stringify(r3));
const r4 = ctx.deleteMeeting('MTG-B', 'stranger@example.org');
ok('someone not in the employee list cannot delete', r4.success === false && r4.message === 'ACCESS_REVOKED' && ids().includes('MTG-B'), JSON.stringify(r4));
ctx.getMyMeetings(F);   // in the cache again
const r5 = ctx.deleteMeeting('MTG-B', S);
ok('State can delete anyone\'s meeting, and its event goes', r5.success === true && !ids().includes('MTG-B') && events['ev-B'].deleted, JSON.stringify(r5));
ok('the owner\'s list is cleared too, not only the deleter\'s', !ctx.getMyMeetings(F).map(m => m.meetingId).includes('MTG-B'));
ok('a meeting that is not there: says so', ctx.deleteMeeting('MTG-ZZZ', S).message === 'Meeting not found.');

// 4. a calendar error never stops the delete
const r6 = ctx.deleteMeeting('MTG-H', D);
ok('calendar not answering: the meeting is still deleted', r6.success === true && !ids().includes('MTG-H'), JSON.stringify(r6));

// 5. not held: the event goes
const c1 = ctx.cancelMeeting({ meetingId: 'MTG-C', email: D, reason: 'Official on leave' });
ok('cancelled meeting: off the calendar', c1.success === true && events['ev-C'].deleted === true, JSON.stringify(c1));

// 6. postponed: the event moves to the new day, same time and length
const nd = day(10);
const p1 = ctx.postponeMeeting({ meetingId: 'MTG-E', email: D, newDate: nd, originalDate: day(3), reason: 'Clash', district: 'BARAN',
  employeeName: 'Jaswinder Singh', adhikariName: 'Official MTG-E', adhikariPost: 'BEO', purpose: 'Enrollment' });
const ev = events['ev-E'];
const want = new Date(nd + 'T11:00:00');
ok('postponed meeting: event moved to the new day at 11:00 for an hour',
   p1.success === true && ev.start && ev.start.getFullYear() === want.getFullYear() && ev.start.getMonth() === want.getMonth() &&
   ev.start.getDate() === want.getDate() && ev.start.getHours() === 11 && (ev.end - ev.start) === 3600000,
   JSON.stringify({ p1, start: ev.start && ev.start.toString(), end: ev.end && ev.end.toString() }));
ok('postponing the same meeting to the same day again changes nothing', ctx.postponeMeeting({ meetingId: 'MTG-E', email: D, newDate: nd, originalDate: day(3) }).already === true);

// 7. postponed before it ever had an event: the hourly sync makes one at the new day
ctx.postponeMeeting({ meetingId: 'MTG-G', email: D, newDate: nd, originalDate: day(3), district: 'BARAN' });
const s1 = ctx.syncCalendarEvents('live', 20);
const g = P.filter(r => r[0] === 'MTG-G')[0];
ok('sync: the postponed meeting gets an event at its new day', made.length === 1 && made[0].s.getDate() === want.getDate() && /^ev-new-/.test(g[22]),
   JSON.stringify({ made: made.map(m => m.title + ' ' + m.s), details: s1.details }));

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
