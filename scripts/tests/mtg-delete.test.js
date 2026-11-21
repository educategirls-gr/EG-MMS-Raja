// Removing a held meeting altogether (21 Nov 2026): the id in MTG_DELETE is
// removed by the hourly jobs, with its follow-up, after a copy of every row is
// kept in Deleted Meetings; its MoM and Drive folder go to the trash, the
// calendar event goes, caches are cleared, and it is done once. REAL Code.gs,
// the sheets, Drive and Calendar faked.
//   node scripts/tests/mtg-delete.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const noop = () => {}, props = {}, cache = {};
const ID = 'MTG-20261116-113044', FU = 'MTG-20261116-113050', OTHER = 'MTG-20261116-114544';
const R = 'rajat.sharma@educategirls.ngo';
const planRow = (id, status, parent, ev) => { const r = new Array(25).fill(''); Object.assign(r, { 0: id, 1: 'PALI', 2: 'Rajat Sharma', 4: R, 5: '2026-11-16',
  6: '11:30 AM', 8: 'One-on-One', 9: 'Arvind choudhary', 10: 'Chief Block Education Officer/BEO', 11: 'Networking and Liaisoning', 13: status, 20: parent || '', 22: ev || '' }); return r; };
const conRow = (id) => { const r = new Array(34).fill(''); Object.assign(r, { 0: id, 1: 'PALI', 2: 'Rajat Sharma', 4: R, 5: '2026-11-16', 8: 'One-on-One',
  9: 'Arvind choudhary', 10: 'Chief Block Education Officer/BEO', 11: 'Networking and Liaisoning', 13: '2026-11-16', 15: 'Orientation.',
  17: 'https://docs.google.com/open?id=1MoMdocIdAbCdEfGhIjKlMnOpQr', 21: 'https://drive.google.com/file/d/1GovtPdfAbCdEfGhIjKlMnOpQrS/view' }); return r; };
const other = planRow(OTHER, 'Planned'); other[1] = 'ALWAR'; other[9] = 'Someone Else';
const sheets = {
  'Plan Meetings': [new Array(25).fill('h'), planRow(ID, 'Conducted', '', 'ev-main'), other, planRow(FU, 'Follow-up', ID, 'ev-fu')],
  'Conducted Meetings': [new Array(34).fill('h'), conRow(ID)],
  'Postponed Meetings': [['Meeting ID']], 'Cancelled Meetings': [['Meeting ID']],
  'Deleted Meetings': [['Meeting ID','District','Employee Name','Email','Meeting Date','Meeting Time','Meeting Type','Stakeholder Name','Stakeholder Post','Meeting Purpose','Status','Deleted By','Deleted At']] };
const sheet = (rows) => ({
  getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }), getLastRow: () => rows.length,
  getRange: (r, c) => ({ getValue: () => (rows[r - 1] || [])[c - 1] || '', setValue: (v) => { rows[r - 1][c - 1] = v; } }),
  appendRow: (a) => rows.push(a.slice()), deleteRow: (n) => rows.splice(n - 1, 1) });
const trashed = [], dropped = [];
const iter = (list) => { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; };
const meetingFolder = (name) => ({ getName: () => name, setTrashed: () => trashed.push('folder:' + name), getFoldersByName: () => iter([]) });
const pali = { getName: () => 'PALI', getFoldersByName: (n) => iter(n === ID || n === FU ? [meetingFolder(n)] : []) };
let cleared = 0;
const ctx = {
  console, Logger: { log: noop },
  SpreadsheetApp: { flush: noop, openById: () => ({ getSheetByName: (n) => sheets[n] ? sheet(sheets[n]) : null, insertSheet: (n) => { sheets[n] = []; return sheet(sheets[n]); } }) },
  DriveApp: { getFolderById: () => ({ getFoldersByName: (n) => iter(n === 'PALI' ? [pali] : []) }),
              getFileById: (id) => ({ setTrashed: () => trashed.push('file:' + id) }) },
  CalendarApp: { getDefaultCalendar: () => ({ getEventById: (id) => ({ deleteEvent: () => dropped.push(id) }) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: noop }) },
  Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
  Utilities: { formatDate: (d) => String(d), sleep: noop },
  CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: noop, removeAll: noop }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
    getProperties: () => Object.assign({}, props), deleteProperty: (k) => { delete props[k]; } }) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });
ctx.CACHE_clearAll = () => { cleared++; }; ctx.invalidateUser = noop;

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const idsOf = (tab) => sheets[tab].slice(1).map(r => r[0]);

ok('the meeting asked for is the one queued', ctx.MTG_DELETE.length === 1 && ctx.MTG_DELETE[0].id === ID);

// preview
const pv = ctx.MTG_delete_preview()[0];
ok('preview changes nothing', idsOf('Plan Meetings').length === 3 && idsOf('Conducted Meetings').length === 1 &&
   sheets['Deleted Meetings'].length === 1 && !trashed.length && !dropped.length && !cleared);
ok('preview lists the meeting, its follow-up, the MoM, the Govt MoM and the folders',
   /follow-up MTG-20261116-113050/.test(pv.log) && /MoM document 1MoMdoc/.test(pv.log) && /Govt MoM PDF 1GovtPdf/.test(pv.log) &&
   /Drive folder "MTG-20261116-113044"/.test(pv.log) && pv.rows === 3, pv.log);

// the hourly job
ok('the three hourly jobs run the queue first',
   /function taggingJob\(\) \{ try \{ mtgDeletePending_\(\); \}/.test(src) && /function escalationJob\(\) \{ try \{ mtgDeletePending_\(\); \}/.test(src) &&
   /function calendarJob\(\) \{[\s\S]{0,400}mtgDeletePending_\(\)/.test(src));
const n = ctx.mtgDeletePending_();
ok('one meeting removed', n === 1);
ok('Plan: the meeting and its follow-up gone, the other meeting kept', JSON.stringify(idsOf('Plan Meetings')) === JSON.stringify([OTHER]), JSON.stringify(idsOf('Plan Meetings')));
ok('Conducted: gone', idsOf('Conducted Meetings').length === 0);
const del = sheets['Deleted Meetings'];
ok('Deleted Meetings keeps all three rows, with source tab and the whole row',
   del.length === 4 && del[0][13] === 'Source Tab' && del[0][14] === 'Full Row (JSON)' &&
   del.slice(1).every(r => /Orientation meeting/.test(r[11]) && JSON.parse(r[14])[0] === r[0]) &&
   del.slice(1).some(r => r[13] === 'Conducted Meetings' && /Orientation\./.test(r[14])), JSON.stringify(del.slice(1).map(r => [r[0], r[10], r[13]])));
ok('MoM, Govt MoM and both meeting folders in the Drive trash',
   ['file:1MoMdocIdAbCdEfGhIjKlMnOpQr', 'file:1GovtPdfAbCdEfGhIjKlMnOpQrS', 'folder:' + ID, 'folder:' + FU].every(x => trashed.includes(x)), JSON.stringify(trashed));
ok('calendar events of the meeting and the follow-up taken down', dropped.includes('ev-main') && dropped.includes('ev-fu') && dropped.length === 2, JSON.stringify(dropped));
ok('caches cleared', cleared === 1);
ok('recorded as done', JSON.parse(props.MTG_DELETED || '{}')[ID].rows === 3);

// next hour: nothing more
trashed.length = 0;
ok('next run does nothing', ctx.mtgDeletePending_() === 0 && del.length === 4 && !trashed.length && idsOf('Plan Meetings').length === 1);

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
