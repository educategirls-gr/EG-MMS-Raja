// Staff Manage page (27 Nov 2026): only STAFF_ADMINS (and gr@) may list, add,
// transfer, change and remove staff; every action is checked on the server;
// nobody changes or removes their own row; every change is logged; a removed
// row is kept in Removed Staff; repeats with the same reqId change nothing;
// everyone else's app is untouched. REAL Code.gs, the sheet faked.
//   node scripts/tests/staff-manage.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const noop = () => {}, props = {}, cache = {};
const A = 'alok.mohan@educategirls.ngo', GR = 'gr@educategirls.ngo';
const S = 'sheetal.arya@educategirls.ngo', K = 'sakshi.jain@educategirls.ngo', B = 'brijlal.kushwaha@educategirls.ngo';
const HEAD = ['District', 'Block', 'Name', 'Designation', 'Email', 'Role', 'Zone', 'Additional Districts'];
const sheets = {
  Employee_DB: [HEAD,
    ['', '', 'Alok Mohan', 'Test User', A, 'State', '', ''],
    ['SIROHI', 'SIROHI', 'Sheetal Arya', 'Program Coordinator', S, 'Field', '', ''],
    ['JALORE', '', 'Sakshi Jain', 'District Operation Lead', K, 'District', '', 'RAJSAMAND, JODHPUR, PALI, SIROHI'],
    ['BALOTRA', 'BAITU', 'Brijlal Kushwaha', 'Block Program Officer', B, 'Field', '', '']] };
const sheet = (name) => { const rows = sheets[name]; return {
  getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }), getLastRow: () => rows.length,
  getRange: (r, c, nr, nc) => ({
    getValue: () => (rows[r - 1] || [])[c - 1],
    setValue: (v) => { rows[r - 1][c - 1] = v; },
    setValues: (vals) => { vals[0].forEach((v, j) => { rows[r - 1][c - 1 + j] = v; }); } }),
  appendRow: (a) => rows.push(a.slice()), deleteRow: (n) => rows.splice(n - 1, 1) }; };
let refreshed = 0, cleared = 0, deleted = [];
const ctx = {
  console, Logger: { log: noop },
  SpreadsheetApp: { flush: noop, openById: () => ({ getSheetByName: (n) => sheets[n] ? sheet(n) : null,
                                                    insertSheet: (n) => { sheets[n] = []; return sheet(n); } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: noop }) },
  Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
  Utilities: { formatDate: () => '2026-11-27 15:00', sleep: noop, getUuid: () => 'u' },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType() { return this; }, text: s }) },
  CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; },
    remove: (k) => { delete cache[k]; }, removeAll: (ks) => { ks.forEach(k => { deleted.push(k); delete cache[k]; }); } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
    getProperties: () => Object.assign({}, props), deleteProperty: (k) => { delete props[k]; } }) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });
ctx.EMP_refreshMirror = () => { refreshed++; return 1; };
ctx.CACHE_clearAll = () => { cleared++; };

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const login = (email, role, district) => { const t = 'tok-' + email; cache['SESSION_' + t] = JSON.stringify({ email, role, district: district || '', districts: [district || ''] }); return t; };
const call = (method, action, token, body) => JSON.parse(ctx.apiResponse({ parameter: { action, token },
  postData: body ? { contents: JSON.stringify(body) } : undefined }, method).text);
const emails = () => sheets.Employee_DB.slice(1).map(r => r[4]);
const rowOf = (e) => sheets.Employee_DB.find(r => r[4] === e);
const tA = login(A, 'State'), tS = login(S, 'Field', 'SIROHI'), tK = login(K, 'District', 'JALORE'), tG = login(GR, 'State');

// who may
ok('Alok (the default staff admin) may', ctx.isStaffAdmin_(A) && ctx.isStaffAdmin_('  ALOK.MOHAN@educategirls.ngo '));
ok('gr@ may', ctx.isStaffAdmin_(GR));
ok('a Field officer and a District lead may not', !ctx.isStaffAdmin_(S) && !ctx.isStaffAdmin_(K));
ok('Rajat Sharma may (given access 27 Nov 2026)', ctx.isStaffAdmin_('rajat.sharma@educategirls.ngo'));
ok('the default list is exactly Alok and Rajat', ctx.STAFF_ADMINS_DEFAULT.join() === 'alok.mohan@educategirls.ngo,rajat.sharma@educategirls.ngo');
props.STAFF_ADMINS = 'sakshi.jain@educategirls.ngo';
ok('Script Property STAFF_ADMINS replaces the default', ctx.isStaffAdmin_(K) && !ctx.isStaffAdmin_(A) && ctx.isStaffAdmin_(GR));
delete props.STAFF_ADMINS;

// the menu flag rides on getDropdownData (already asked on every page load)
const dd = (e) => { try { return ctx.getDropdownData(e); } catch (x) { return { thrown: x.message }; } };
ctx.getEmployeeByEmail = (e) => ({ email: e });   // the access check at the top of getDropdownData
const ddA = dd(A), ddS = dd(S);
ok('dropdown data says canManageStaff for Alok', ddA.canManageStaff === true, JSON.stringify(ddA).slice(0, 200));
ok('...and not for a Field officer', ddS.canManageStaff === false);
ok('...and still carries everything it carried before', 'stakeholders' in ddS && 'purposes' in ddS && 'departments' in ddS && 'blocksByDistrict' in ddS && 'metBefore' in ddS);

// the server refuses everyone else, whatever they send
const before = JSON.stringify(sheets.Employee_DB);
ok('Field officer: staffList FORBIDDEN', call('GET', 'staffList', tS).message === 'FORBIDDEN');
ok('District lead: staffSave FORBIDDEN', call('POST', 'staffSave', tK, { mode: 'add', rec: { name: 'X', email: 'x@educategirls.ngo', district: 'SIROHI', blocks: ['SIROHI'], designation: 'Program Coordinator', role: 'Field' } }).message === 'FORBIDDEN');
ok('Field officer: staffRemove FORBIDDEN', call('POST', 'staffRemove', tS, { email: K }).message === 'FORBIDDEN');
ok('no token: AUTH_REQUIRED', call('GET', 'staffList', '').message === 'AUTH_REQUIRED');
ok('a write sent as GET is refused (POST only)', call('GET', 'staffSave', tA).message === 'BODY_MISSING');
ok('...and the sheet is unchanged', JSON.stringify(sheets.Employee_DB) === before && !sheets['Staff Changes']);

// list
const L = call('GET', 'staffList', tA);
ok('Alok gets the list of 4 with roles and official districts', L.success && L.staff.length === 4 && L.me === A && L.districts.SIROHI && L.roles.join() === 'Field,District,State', JSON.stringify(L).slice(0, 200));
ok('gr@ gets it too', call('GET', 'staffList', tG).success);

// add: checks
const add = (rec, reqId) => call('POST', 'staffSave', tA, { mode: 'add', rec, reqId });
const M = { name: 'Mamta  Kumari Mali', email: ' Mamta.Mali@educategirls.ngo ', district: 'balotra', blocks: ['siwana'], designation: 'Program Coordinator', role: 'field' };
ok('add: other email domains refused', /must be an @educategirls.ngo/.test(add(Object.assign({}, M, { email: 'mamta@gmail.com' })).message));
ok('add: unofficial district refused', /not on the official list/.test(add(Object.assign({}, M, { district: 'BALOTARA' })).message));
ok('add: block of another district refused', /not an official block of BALOTRA/.test(add(Object.assign({}, M, { blocks: ['SHEOGANJ'] })).message));
ok('add: Field without a block refused', /at least one block/.test(add(Object.assign({}, M, { blocks: [] })).message));
ok('add: unknown role refused', /Role must be/.test(add(Object.assign({}, M, { role: 'Boss' })).message));
ok('add: empty role refused (not silently Field)', /Role must be/.test(add(Object.assign({}, M, { role: '' })).message));
ok('add: no name refused', /Name is required/.test(add(Object.assign({}, M, { name: ' ' })).message));
ok('...none of those wrote anything', JSON.stringify(sheets.Employee_DB) === before && refreshed === 0);

// add: works, tidied
const r1 = add(M, 'req-1');
ok('add works', r1.success && r1.changed, JSON.stringify(r1));
ok('row is tidied: capitals, single spaces, lower-case email, Role Field',
   JSON.stringify(rowOf('mamta.mali@educategirls.ngo')) === JSON.stringify(['BALOTRA', 'SIWANA', 'Mamta Kumari Mali', 'Program Coordinator', 'mamta.mali@educategirls.ngo', 'Field', '', '']), JSON.stringify(rowOf('mamta.mali@educategirls.ngo')));
ok('sign-in copy refreshed and caches cleared once', refreshed === 1 && cleared === 1);
ok('logged in Staff Changes', sheets['Staff Changes'].length === 2 && sheets['Staff Changes'][1][1] === A && sheets['Staff Changes'][1][2] === 'Add');
const r1b = add(M, 'req-1');
ok('same reqId again: first answer, nothing more', r1b.success && emails().length === 5 && sheets['Staff Changes'].length === 2 && refreshed === 1);
ok('same person again (new reqId): no duplicate', add(M, 'req-2').changed === false && emails().length === 5);
ok('different details for an existing email: refused, use Edit', /already in the staff list/.test(add(Object.assign({}, M, { blocks: ['PACHPADRA'] }), 'req-3').message));

// edit: transfer and post change
const edit = (origEmail, rec, reqId) => call('POST', 'staffSave', tA, { mode: 'edit', origEmail, rec, reqId });
const e1 = edit(S, { name: 'Sheetal Arya', district: 'SIROHI', blocks: ['PINDWARA', 'REODAR'], designation: 'Block Program Officer', role: 'Field', email: 'hacker@educategirls.ngo' }, 'req-4');
ok('edit: transfer + post change works', e1.success && e1.changed, JSON.stringify(e1));
ok('...block and designation changed, email kept', JSON.stringify(rowOf(S)) === JSON.stringify(['SIROHI', 'PINDWARA, REODAR', 'Sheetal Arya', 'Block Program Officer', S, 'Field', '', '']), JSON.stringify(rowOf(S)));
const lg = sheets['Staff Changes'][sheets['Staff Changes'].length - 1];
ok('...logged as Transfer with before and after', lg[2] === 'Transfer' && /SIROHI \| SIROHI/.test(lg[5]) && /PINDWARA, REODAR/.test(lg[6]) && /block, designation/.test(lg[7]), JSON.stringify(lg));
ok('edit: nothing changed says so and writes nothing', edit(S, { name: 'Sheetal Arya', district: 'SIROHI', blocks: 'PINDWARA, REODAR', designation: 'Block Program Officer', role: 'Field' }).changed === false);
const e2 = edit(B, { name: 'Brijlal Kushwaha', district: 'BALOTRA', blocks: ['BAITU'], designation: 'Program Coordinator', role: 'Field' });
ok('edit: an old unofficial block the person already has is kept (BAITU)', e2.success && rowOf(B)[1] === 'BAITU' && rowOf(B)[3] === 'Program Coordinator', JSON.stringify(e2));
ok('edit: a new unofficial block is still refused', /not an official block/.test(edit(B, { name: 'Brijlal Kushwaha', district: 'BALOTRA', blocks: ['BAITU', 'MANDORE'], designation: 'Program Coordinator', role: 'Field' }).message));
const e3 = edit(K, { name: 'Sakshi Jain', district: 'JALORE', blocks: [], designation: 'District Operation Lead', role: 'District', addl: ['RAJSAMAND', 'JODHPUR', 'PALI', 'SIROHI', 'JALORE'] });
ok('edit: additional districts kept for a District lead, own district dropped from them', e3.changed === false, JSON.stringify(e3));
ok('edit: own row refused', /own row/.test(edit(A, { name: 'Alok Mohan', district: '', designation: 'Test User', role: 'State' }).message));
ok('edit: someone no longer there', /not in the staff list any more/.test(edit('gone@educategirls.ngo', M).message));

// remove
const rm = (email, reqId, reason) => call('POST', 'staffRemove', tA, { email, reqId, reason });
ok('remove: yourself refused', /cannot remove yourself/.test(rm(A).message) && emails().indexOf(A) !== -1);
deleted = [];
const x1 = rm(B, 'req-9', 'Left the organisation');
ok('remove works', x1.success && x1.changed && emails().indexOf(B) === -1, JSON.stringify(x1));
const kept = sheets['Removed Staff'];
ok('...row kept in Removed Staff with when, who and why', kept.length === 2 && kept[1][4] === B && kept[1][2] === 'Brijlal Kushwaha' && kept[1][9] === A && kept[1][10] === 'Left the organisation', JSON.stringify(kept[1]));
ok('...their cached record dropped, so the next page load says access revoked', deleted.indexOf('emp_' + B) !== -1);
ok('...logged as Remove', sheets['Staff Changes'].slice(-1)[0][2] === 'Remove');
ok('remove: same reqId again changes nothing', rm(B, 'req-9').success && sheets['Removed Staff'].length === 2);
ok('remove: already gone says so', rm(B, 'req-10').changed === false && sheets['Removed Staff'].length === 2);
ok('everyone else still there', ['alok.mohan@educategirls.ngo', S, K, 'mamta.mali@educategirls.ngo'].every(e => emails().indexOf(e) !== -1) && emails().length === 4);

// list shows the history
const L2 = call('GET', 'staffList', tA);
ok('list carries recent changes (newest first) and removed staff', L2.log.length === 4 && L2.log[0][2] === 'Remove' && L2.removed.length === 1 && L2.removed[0][4] === B, JSON.stringify(L2.log.map(r => r[2])));

// existing actions untouched
ok('unknown actions still say so', /Unknown action/.test(call('GET', 'noSuchThing', tA).message));

console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
