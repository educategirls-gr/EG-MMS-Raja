// MTG_fix_preview / MTG_fix_apply (5 Nov 2026): correcting a meeting already
// held, in the Plan row, the Conducted row and the MoM document. REAL Code.gs,
// the sheet and the document faked.
//   node scripts/tests/mtg-fix.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const noop = () => {}, logs = [], writes = [];
const ID = 'MTG-20261023-143932', NAME = 'Shiv lal dhakad', POST = 'Chief Block Education Officer/BEO';
const row = (n) => { const r = new Array(n).fill(''); Object.assign(r, { 0: ID, 1: 'JHALAWAR', 2: 'Lavina Rathore', 4: 'lavina@x', 9: NAME, 10: POST, 11: 'Introductory/Courtesy Meeting' }); return r; };
const plan = row(25), con = row(34), other = row(34);
Object.assign(other, { 0: 'MTG-OTHER', 9: 'CEO Zilla Parishad', 10: 'Chief Executive Officer, Zila Parishad', 15: 'Met the CEO.' });
con[15] = 'Discussed with the CEO, the CEO agreed. CBEOs and the CEOs office are not this word.';
con[17] = 'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit';
const sheets = {
  'Plan Meetings': [new Array(25).fill('h'), plan],
  'Conducted Meetings': [new Array(34).fill('').map((x, i) => i === 15 ? 'Key Points' : 'h' + i), con, other] };
const sheet = (rows) => ({ getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }),
  getRange: (r, c) => ({ setValue: (v) => { writes.push([r, c, v]); rows[r - 1][c - 1] = v; } }) });
let docText = 'MINUTES OF MEETING\n' + NAME + '   |   ' + POST + '\nDepartment: Education Department\n' +
              'Discussed with the CEO, the CEO agreed.\nWith ' + NAME + '   (' + POST + ')\n';
let docName = 'MoM | ' + ID + ' | ' + NAME + ' | 23 Oct 2026', docOpened = '', saved = 0, replaceCalls = 0;
const body = { getText: () => docText,
  replaceText: (pat, to) => { replaceCalls++; docText = docText.replace(new RegExp(pat, 'g'), to); } };
const cache = {};
const ctx = {
  console, Logger: { log: (s) => logs.push(String(s)) },
  SpreadsheetApp: { flush: noop, openById: () => ({ getSheetByName: (n) => sheets[n] ? sheet(sheets[n]) : null }) },
  DocumentApp: { openById: (id) => { docOpened = id; return { getBody: () => body, getName: () => docName, setName: (x) => { docName = x; }, saveAndClose: () => { saved++; } }; } },
  CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: noop, removeAll: noop }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: noop, getProperties: () => ({}), deleteProperty: noop }) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });
let cleared = 0; ctx.CACHE_clearAll = () => { cleared++; }; ctx.invalidateUser = noop;

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };

// preview
const n1 = ctx.MTG_fix_preview(), log = logs[0], docBefore = docText;
ok('preview writes nothing, to the sheet or the document', writes.length === 0 && replaceCalls === 0 && saved === 0 && cleared === 0);
ok('preview lists the name, the post and the notes', /Stakeholder Name: "Shiv lal dhakad" -> ""/.test(log) && /Stakeholder Post: ".*" -> "District Education Officer"/.test(log) && /Key Points/.test(log), log);
ok('preview lists the MoM line and the two CEOs', /MoM: "Shiv lal dhakad   \|/.test(log) && /MoM: 2 x CEO -> CDEO/.test(log), log);
ok('the MoM of this meeting is the one opened', docOpened === '1AbCdEfGhIjKlMnOpQrStUvWxYz', docOpened);

// apply
const n2 = ctx.MTG_fix_apply();
ok('Plan row: name removed, post changed', plan[9] === '' && plan[10] === 'District Education Officer', JSON.stringify([plan[9], plan[10]]));
ok('Conducted row: name removed, post changed', con[9] === '' && con[10] === 'District Education Officer');
ok('notes: CEO becomes CDEO as a whole word, CBEOs and CEOs left alone',
   con[15] === 'Discussed with the CDEO, the CDEO agreed. CBEOs and the CEOs office are not this word.', con[15]);
ok('MoM: the official line', docText.includes('-   |   District Education Officer\n') && !docText.includes(NAME), docText);
ok('MoM: the follow-up table shows the post alone', docText.includes('With District Education Officer\n'), docText);
ok('MoM: the notes', docText.includes('Discussed with the CDEO, the CDEO agreed.'), docText);
ok('MoM file name: the post in place of the name', docName === 'MoM | ' + ID + ' | District Education Officer | 23 Oct 2026', docName);
ok('document saved, caches cleared', saved === 1 && cleared === 1);
ok('another meeting of that day is untouched', other[9] === 'CEO Zilla Parishad' && other[15] === 'Met the CEO.');

// again
writes.length = 0; replaceCalls = 0;
ok('second run: nothing left', ctx.MTG_fix_apply() === 0 && writes.length === 0 && replaceCalls === 0);

// the sheet corrected first, the MoM saved as open?id= (as the live ones are)
con[17] = 'https://docs.google.com/open?id=1K58bIzds5Tp8I3myL2AMCLPzYjJ286AyxCz04_en_Fo';
docText = 'MINUTES OF MEETING\n' + NAME + '   |   ' + POST + '\nDiscussed: briefed the CEO on the programme.\n';
docName = 'MoM | ' + ID + ' | ' + NAME + ' | 23 Oct 2026'; saved = 0; writes.length = 0;
const n3 = ctx.MTG_fix_apply();
ok('an open?id= link opens the MoM', docOpened === '1K58bIzds5Tp8I3myL2AMCLPzYjJ286AyxCz04_en_Fo', docOpened);
ok('the old name comes from MTG_FIX once the sheet no longer has it',
   docText.includes('-   |   District Education Officer\n') && !docText.includes(NAME) && docText.includes('briefed the CDEO'), docText);
ok('MoM file name corrected too, nothing written to the sheet', docName.includes('District Education Officer') && !docName.includes(NAME) && writes.length === 0 && saved === 1, docName);

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
