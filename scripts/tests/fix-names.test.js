// EMP_fixNames_preview / EMP_fixNames_apply (12 Oct 2026): Employee_DB
// district and block names to the official record. REAL Code.gs, the sheet
// faked with rows shaped like the live ones.
//   node scripts/tests/fix-names.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const noop = () => {}, logs = [], writes = [];
const rows = [
  ['District','Block','Employee Name','Designation','Email','Role','Zone','Additional Districts'],
  ['JALOR', '', 'Sakshi Jain', 'District Operation Lead', 's@x', 'District', '', 'RAJSAMAND, JODHPUR, PALI, SIROHI'],
  ['JALOR', 'SAYALA', 'Suresh Kumar', 'Program Coordinator', 'su@x', 'Field', '', ''],
  ['BALOTARA', 'BALOTRA', 'Kohla Ram', 'Block Program Officer', 'k@x', 'Field', '', ''],
  ['BALOTARA', 'BAITU', 'Brijlal Kushwaha', 'Block Program Officer', 'b@x', 'Field', '', ''],
  ['JHALAWAR', 'MANOHARTHANA, JHALARAPATAN', 'Chhavi Saxena', 'Program Coordinator', 'c@x', 'Field', '', ''],
  ['PALI', 'SUMERPUR, SHEOGANJ', 'Narayan Lal Sarel', 'Program Coordinator', 'n@x', 'Field', '', 'SIROHI'],
  ['UDAIPUR', 'BADGAON', 'Dalpat Charan', 'Program Coordinator', 'd@x', 'Field', '', ''],
  ['UDAIPUR', '', 'Jaswinder Singh', 'District Operation Lead', 'j@x', 'District', '', 'BARAN, JHALAWAR'],
  ['JAISALMER', 'KURABAD', 'Someone Else', 'Program Coordinator', 'e@x', 'Field', '', ''],   // a Udaipur fix, not for Jaisalmer
  ['JODHPUR', 'MANDORE', 'Kamlesh Lalar', 'Program Coordinator', 'kl@x', 'Field', '', '']];
const sheet = {
  getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }),
  getRange: (r, c) => ({ setValue: (v) => { writes.push([r, c, v]); rows[r - 1][c - 1] = v; } }) };
const ctx = {
  console, Logger: { log: (s) => logs.push(String(s)) },
  SpreadsheetApp: { flush: noop, openById: () => ({ getSheetByName: (n) => n === 'Employee_DB' ? sheet : null }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: noop, remove: noop, removeAll: noop }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: noop, getProperties: () => ({}), deleteProperty: noop }) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });
let refreshed = 0, cleared = 0;
ctx.EMP_refreshMirror = () => { refreshed++; return 10; };
ctx.CACHE_clearAll = () => { cleared++; };

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const cell = (who, col) => rows.filter(r => r[2] === who)[0][col];

// preview: a list, nothing written
const n1 = ctx.EMP_fixNames_preview();
ok('preview: 6 cells to change, nothing written', n1 === 6 && writes.length === 0 && refreshed === 0, n1 + ' / ' + writes.length);
ok('preview log names each change and the leftovers', /WOULD CHANGE 6/.test(logs[0]) && /Kohla Ram \| BALOTRA \| block BALOTRA/.test(logs[0]) &&
   /Brijlal Kushwaha \| BALOTRA \| block BAITU/.test(logs[0]) && /Kamlesh Lalar \| JODHPUR \| block MANDORE/.test(logs[0]), logs[0]);

// apply
const n2 = ctx.EMP_fixNames_apply();
ok('apply: the 6 cells written, sign-in copy refreshed, caches cleared', n2 === 6 && writes.length === 6 && refreshed === 1 && cleared === 1);
ok('JALOR -> JALORE (Sakshi, Suresh)', cell('Sakshi Jain', 0) === 'JALORE' && cell('Suresh Kumar', 0) === 'JALORE');
ok('BALOTARA -> BALOTRA (Kohla, Brijlal)', cell('Kohla Ram', 0) === 'BALOTRA' && cell('Brijlal Kushwaha', 0) === 'BALOTRA');
ok('SAYALA -> SAYLA', cell('Suresh Kumar', 1) === 'SAYLA');
ok('two blocks in one cell both fixed', cell('Chhavi Saxena', 1) === 'MANOHAR THANA, JHALRAPATAN', cell('Chhavi Saxena', 1));
ok('Sakshi\'s additional districts unchanged (already official)', cell('Sakshi Jain', 7) === 'RAJSAMAND, JODHPUR, PALI, SIROHI');
ok('Narayan\'s SHEOGANJ is right for his additional SIROHI: untouched', cell('Narayan Lal Sarel', 1) === 'SUMERPUR, SHEOGANJ');
ok('a Udaipur spelling fix is not applied in Jaisalmer', cell('Someone Else', 1) === 'KURABAD');
ok('not guessed: BALOTRA block, BAITU, MANDORE left as they are', cell('Kohla Ram', 1) === 'BALOTRA' && cell('Brijlal Kushwaha', 1) === 'BAITU' && cell('Kamlesh Lalar', 1) === 'MANDORE');
ok('correct rows untouched', cell('Dalpat Charan', 1) === 'BADGAON' && cell('Jaswinder Singh', 0) === 'UDAIPUR');

// again: nothing left
writes.length = 0;
ok('second run: nothing to change', ctx.EMP_fixNames_apply() === 0 && writes.length === 0);

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
