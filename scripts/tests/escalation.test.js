// The REAL sendEscalations out of Code.gs with the sheets, cache, sign-in copy
// and mail faked. Who gets an escalation in Rajasthan, and that the developer's
// test profile ("Test ..." designation) never reaches the State Head live.
//   node scripts/tests/escalation.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

function world() {
  const mail = [], cache = {};
  const emp = [['District','Block','Employee Name','Designation','Email','Role','Zone','Additional Districts'],
    ['', '', 'Brajesh Kumar Sinha', 'SoH', 'brajeshkumar.sinha@educategirls.ngo', 'State', '', ''],
    ['', '', 'Alok Mohan', 'Test User', 'alok.mohan@educategirls.ngo', 'State', '', ''],
    ['UDAIPUR', '', 'Jaswinder Singh', 'District Operation Lead', 'jaswinder.singh@educategirls.ngo', 'District', '', 'BARAN, JHALAWAR'],
    ['BALOTARA', '', 'Hitendra Dave', 'Lead Ops. Vidya', 'hitendra.dave@educategirls.ngo', 'District', '', ''],
    ['BARAN', 'ATRU, BARAN', 'Seema Pankaj', 'Program Coordinator', 'seema.pankaj@educategirls.ngo', 'Field', '', ''],
    ['BALOTARA', 'BALOTRA', 'Kohla Ram', 'Block Program Officer', 'kohla.ram@educategirls.ngo', 'Field', '', '']];
  const mirror = {};
  emp.slice(1).forEach(r => { mirror[r[4]] = { district: r[0], districts: [r[0]].concat((r[7] || '').split(',').map(s => s.trim()).filter(Boolean)),
    block: r[1], name: r[2], designation: r[3], email: r[4], role: r[5], zone: r[6] }; });
  function conducted(id, district, name, email, prio, flag, esc, tagged) {
    const r = new Array(32).fill(''); r[0] = id; r[1] = district; r[2] = name; r[4] = email; r[9] = 'Ramesh Meena'; r[11] = 'Enrollment';
    r[13] = '2026-10-02'; r[15] = 'Discussed: TEST'; r[22] = prio; r[23] = flag; r[25] = esc; r[26] = 'Resource needed'; r[28] = tagged ? '2026-10-02 15:00' : '';
    return r;
  }
  const con = [['Meeting ID'],
    conducted('MTG-A', 'JAIPUR',   'Alok Mohan',   'alok.mohan@educategirls.ngo',   'High', 'Open',     'Yes', true),
    conducted('MTG-B', 'BARAN',    'Seema Pankaj', 'seema.pankaj@educategirls.ngo', 'Medium', 'Blocked', 'No', true),
    conducted('MTG-C', 'BALOTARA', 'Kohla Ram',    'kohla.ram@educategirls.ngo',    'High', 'Resolved', 'Yes', true),
    conducted('MTG-D', 'BALOTARA', 'Kohla Ram',    'kohla.ram@educategirls.ngo',    'High', 'Open',     'Yes', false)];
  const sheets = { 'Employee_DB': emp, 'Conducted Meetings': con };
  function sheet(rows) { return { getDataRange: () => ({ getValues: () => rows }), getLastRow: () => rows.length,
    getRange: (r, c) => ({ setValue: (v) => { rows[r - 1][c - 1] = v; }, getValue: () => rows[r - 1][c - 1] }) }; }
  const props = { EMP_MIRROR_N: '1', EMP_MIRROR_0: JSON.stringify(mirror) };
  const ctx = {
    console, Logger: { log: () => {} }, Utilities: { formatDate: (d) => String(d) }, Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: () => {}, removeAll: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, getProperties: () => props, setProperties: () => {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] ? sheet(sheets[n]) : null }) },
    MailApp: { sendEmail: (o) => mail.push(o) },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  return { ctx, mail, con };
}

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };

// Live
let w = world();
let r = w.ctx.sendEscalations('live', 40);
ok('live: exactly one escalation (Seema, Blocked)', w.mail.length === 1 && w.mail[0].to === 'seema.pankaj@educategirls.ngo', JSON.stringify(w.mail.map(m => m.to)));
const cc = (w.mail[0] && w.mail[0].cc || '').split(',');
ok('live: CC her district lead through Additional Districts (Jaswinder, BARAN)', cc.indexOf('jaswinder.singh@educategirls.ngo') >= 0, cc.join());
ok('live: CC the State Head', cc.indexOf('brajeshkumar.sinha@educategirls.ngo') >= 0, cc.join());
ok('live: the test profile\'s High meeting is not sent', w.mail.every(m => m.to !== 'alok.mohan@educategirls.ngo' && (m.cc || '').indexOf('alok.mohan') < 0));
ok('live: the State Head is never written to about a test meeting', w.mail.filter(m => /brajesh/.test(m.cc || '')).length === 1);
ok('live: Resolved and untagged meetings are skipped', w.mail.length === 1);
ok('live: Seema\'s row marked as sent, the test row left unmarked', Object.prototype.toString.call(w.con[2][29]) === '[object Date]' && !w.con[1][29], 'B=' + w.con[2][29] + ' A=' + w.con[1][29]);
ok('live: sender names the state', w.mail[0].name === 'EG-MMS Rajasthan Alerts', w.mail[0].name);
ok('live: run again sends nothing more (sent once)', (w.ctx.sendEscalations('live', 40), w.mail.length === 1));

// Test mode
w = world();
w.ctx.sendEscalations('test', 25);
ok('test: both open escalations, the test one included', w.mail.length === 2, JSON.stringify(w.mail.map(m => m.subject)));
ok('test: all to gr@ only, no CC to anyone', w.mail.every(m => m.to === 'gr@educategirls.ngo' && !m.cc));
ok('test: subject says who would get it live', w.mail.some(m => /officer:seema\.pankaj@educategirls\.ngo/.test(m.subject) && /jaswinder\.singh/.test(m.subject)));
ok('test: nothing is marked as sent', !w.con[1][29] && !w.con[2][29]);

// Preview: what the live run would send, the test profile counted apart
w = world();
const pv = w.ctx.ESC_preview();
ok('preview: would send 1 (Seema), test profile counted apart, nothing sent',
   pv.wouldSendNow === 1 && pv.rows[0].id === 'MTG-B' && pv.skipped.testProfile === 1 && pv.skipped.resolved === 1 &&
   pv.skipped.notTagged === 1 && w.mail.length === 0, JSON.stringify(pv.skipped));

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
