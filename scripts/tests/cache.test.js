// The REAL cache code of Code.gs on faked sheets. Dashboard stats are cached
// per view as 'stats_<email>_<all>_<district>'; a save must clear the writer's
// views and the portal's, and CACHE_clearAll (after a hand edit of the sheet)
// must clear everything, every person's views included (3 Oct 2026).
//   node scripts/tests/cache.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const cache = {};
const noop = () => {};
const c = { get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; },
            removeAll: (ks) => ks.forEach(k => delete cache[k]), putAll: (o) => Object.assign(cache, o),
            getAll: (ks) => { const o = {}; ks.forEach(k => { if (k in cache) o[k] = cache[k]; }); return o; } };
const people = {
  'seema.pankaj@educategirls.ngo':      { district: 'BARAN', districts: ['BARAN'], name: 'Seema Pankaj', designation: 'Program Coordinator', role: 'Field', email: 'seema.pankaj@educategirls.ngo' },
  'jaswinder.singh@educategirls.ngo':   { district: 'UDAIPUR', districts: ['UDAIPUR', 'BARAN', 'JHALAWAR'], name: 'Jaswinder Singh', designation: 'District Operation Lead', role: 'District', email: 'jaswinder.singh@educategirls.ngo' },
  'brajeshkumar.sinha@educategirls.ngo': { district: '', districts: [''], name: 'Brajesh Kumar Sinha', designation: 'SoH', role: 'State', email: 'brajeshkumar.sinha@educategirls.ngo' } };
const props = { EMP_MIRROR_N: '1', EMP_MIRROR_0: JSON.stringify(people) };
const ctx = {
  console, Logger: { log: noop }, Session: { getScriptTimeZone: () => 'Asia/Kolkata' }, Utilities: { formatDate: (d) => String(d), sleep: noop },
  CacheService: { getScriptCache: () => c },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, getProperties: () => props, setProperties: noop, setProperty: noop }) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });
const D = vm.runInContext('new Date(2026, 9, 2)', ctx);
const plan = (id, dist, name, email, status) => { const r = new Array(24).fill(''); r[0] = id; r[1] = dist; r[2] = name; r[4] = email; r[5] = D; r[13] = status; return r; };
const sheets = {
  'Employee_DB': [['District','Block','Employee Name','Designation','Email','Role'], ['BARAN', '', 'Seema Pankaj', 'Program Coordinator', 'seema.pankaj@educategirls.ngo', 'Field']],
  'Plan Meetings': [['Meeting ID'], plan('MTG-S1', 'BARAN', 'Seema Pankaj', 'seema.pankaj@educategirls.ngo', 'Planned')],
  'Conducted Meetings': [['Meeting ID']], 'Postponed Meetings': [['Meeting ID']], 'Cancelled Meetings': [['Meeting ID']] };
const sheet = (rows) => ({ getDataRange: () => ({ getValues: () => rows }), getLastRow: () => rows.length });
ctx.SpreadsheetApp = { openById: () => ({ getSheetByName: (n) => sheets[n] ? sheet(sheets[n]) : null }) };

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const has = (k) => k in cache;

ctx.getDashboardStats('seema.pankaj@educategirls.ngo', false, '');
ctx.getDashboardStats('seema.pankaj@educategirls.ngo', false, 'BARAN');
ctx.getDashboardStats('', true, '');                                   // the open portal
ctx.getDashboardStats('jaswinder.singh@educategirls.ngo', false, 'BARAN');
ok('stats are cached per view', has('stats_seema.pankaj@educategirls.ngo_0_') && has('stats_seema.pankaj@educategirls.ngo_0_baran') && has('stats__1_') && has('stats_jaswinder.singh@educategirls.ngo_0_baran'),
   Object.keys(cache).filter(k => /^stats_/.test(k)).join());

ctx.invalidateUser('seema.pankaj@educategirls.ngo', 'BARAN');          // what every save does
ok('a save clears the writer\'s own dashboard views', !has('stats_seema.pankaj@educategirls.ngo_0_') && !has('stats_seema.pankaj@educategirls.ngo_0_baran'));
ok('a save clears the open portal\'s totals', !has('stats__1_'));

ctx.getDashboardStats('', true, ''); ctx.getReportData(); ctx.getEmployeeMaster(); ctx.getMyMeetings('seema.pankaj@educategirls.ngo');
const rowsKey = ctx.sheetRowsKey_('Plan Meetings') + '_n';
ok('before: portal, lists and the shared sheet copy are cached', has('stats__1_') && has('reportData') && has('empMaster') && has('planmtg_seema.pankaj@educategirls.ngo') && has(rowsKey));
const n = ctx.CACHE_clearAll();
ok('CACHE_clearAll clears another person\'s view too (Jaswinder, BARAN)', !has('stats_jaswinder.singh@educategirls.ngo_0_baran'));
ok('CACHE_clearAll clears portal data, lists and the shared sheet copy', !has('stats__1_') && !has('reportData') && !has('empMaster') && !has('planmtg_seema.pankaj@educategirls.ngo') && !has(rowsKey),
   Object.keys(cache).join());
ok('CACHE_clearAll reports how many entries it cleared', n > 100, String(n));

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
