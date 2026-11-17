// Who may use the chatbot (17 Nov 2026): State and District leads only. A
// block officer (Field) is refused by the server before any AI call, and the
// role is read from Employee_DB, not from the sign-in. The page hides the
// button for them too. Through the REAL router (doPost) of Code.gs, Sheets,
// the cache and the AI faked.
//   node scripts/tests/chat-access.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const cache = {}, props = {};
const noop = () => {};
const D = 'jaswinder.singh@educategirls.ngo', F = 'seema.pankaj@educategirls.ngo', S = 'brajeshkumar.sinha@educategirls.ngo';
const emp = {
  [D]: { district: 'UDAIPUR', districts: ['UDAIPUR', 'BARAN'], block: '', name: 'Jaswinder Singh', designation: 'District Operation Lead', role: 'District', email: D },
  [F]: { district: 'BARAN', districts: ['BARAN'], block: 'ATRU', name: 'Seema Pankaj', designation: 'Program Coordinator', role: 'Field', email: F },
  [S]: { district: '', districts: [], block: '', name: 'Brajesh Kumar Sinha', designation: 'SoH', role: 'State', email: S } };
props.EMP_MIRROR_N = '1';
props.EMP_MIRROR_0 = JSON.stringify(emp);
const tok = { [D]: 'tD', [F]: 'tF', [S]: 'tS' };
Object.keys(tok).forEach(e => { cache['SESSION_' + tok[e]] = JSON.stringify(Object.assign({}, emp[e])); });

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const con = (id, dist, email) => { const r = new Array(34).fill(''); r[0] = id; r[1] = dist; r[2] = emp[email].name; r[4] = email; r[5] = day(-3);
  r[8] = 'One-on-One'; r[9] = 'Official ' + id; r[10] = 'CBEO'; r[11] = 'Enrollment'; r[13] = day(-3); r[15] = 'Discussed enrolment.'; return r; };
const sheets = {
  'Employee_DB': [['District','Block','Employee Name','Designation','Email','Role','Zone','Additional Districts']],
  'Plan Meetings': [new Array(25).fill('h')],
  'Conducted Meetings': [new Array(34).fill('h'), con('C-BARAN', 'BARAN', F), con('C-UDAIPUR', 'UDAIPUR', D)],
  'Postponed Meetings': [['Meeting ID']], 'Cancelled Meetings': [['Meeting ID']] };
const sheet = (rows) => ({ getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }), getLastRow: () => rows.length,
  getRange: () => ({ getValue: () => '', setValue: noop, getValues: () => [], setNumberFormat: noop }), appendRow: (a) => rows.push(a.slice()) });
const ctx = {
  console, Logger: { log: noop }, MailApp: { sendEmail: noop },
  Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
  Utilities: { formatDate: (d) => String(d), sleep: noop, getUuid: () => 'u',
    DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (a, s) => Array.from(require('crypto').createHash('md5').update(String(s)).digest()),
    base64EncodeWebSafe: (b) => Buffer.from(b.map(x => x & 255)).toString('base64url') },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: noop, releaseLock: noop }) },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType() { return this; }, text: s }) },
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
let llmCalls = 0;
ctx.callLLM = () => { llmCalls++; return 'There were 2 meetings.'; };

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const ask = (t, q) => JSON.parse(ctx.doPost({ parameter: { action: 'askMeetings', token: t },
  postData: { contents: JSON.stringify({ question: q || 'How many meetings this month?' }) } }).text);

const rF = ask('tF');
ok('block officer: refused', rF.success === false && rF.message === 'FORBIDDEN', JSON.stringify(rF));
ok('block officer: no AI call spent', llmCalls === 0, llmCalls);
const rD = ask('tD', 'How many meetings in my districts?');
ok('District lead: answered', rD.success === true && llmCalls === 1, JSON.stringify(rD));
const rS = ask('tS', 'How many meetings in the state?');
ok('State: answered', rS.success === true && llmCalls === 2, JSON.stringify(rS));

// the role comes from Employee_DB: promoted or moved, it counts at once
const m = JSON.parse(props.EMP_MIRROR_0); m[F].role = 'District'; m[D].role = 'Field'; props.EMP_MIRROR_0 = JSON.stringify(m);
Object.keys(cache).filter(k => /^emp_/.test(k)).forEach(k => delete cache[k]);
ok('made District in the sheet: answered', ask('tF', 'And in BARAN this month?').success === true);
ok('made Field in the sheet: refused, though the sign-in still says District', ask('tD', 'Anything else today?').message === 'FORBIDDEN');

// the page: the button stays hidden for a block officer
const html = fs.readFileSync('docs/report.html', 'utf8');
ok('page: the chatbot starts only for State, District, Zone',
   /if \(!ME \|\| \['State', 'District', 'Zone'\]\.indexOf\(ME\.role\) < 0\) return;/.test(html));
ok('page: no UP post in the sample questions', !/BSA ke saath/.test(html));

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
