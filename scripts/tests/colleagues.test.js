// Several accompanying colleagues on one meeting (6 Oct 2026), on the REAL
// sendColleagueNotification, sendMOMNotification and createMoMDoc out of
// Code.gs with the sheet, mail and Docs faked. Names and designations are
// comma separated in the existing columns; each colleague found in
// Employee_DB gets an email of their own.
//   node scripts/tests/colleagues.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

function world(opts) {
  opts = opts || {};
  const mail = [], paras = [];
  const emp = [['District','Block','Employee Name','Designation','Email','Role'],
    ['BARAN', 'ATRU, BARAN', 'Seema Pankaj', 'Program Coordinator', 'seema.pankaj@educategirls.ngo', 'Field'],
    ['BALOTARA', 'BALOTRA', 'Kohla Ram', 'Block Program Officer', 'kohla.ram@educategirls.ngo', 'Field']];
  // Docs: every call returns itself; appendParagraph also records its text.
  const chain = new Proxy(function () {}, {
    get: (t, k) => k === 'appendParagraph' ? (s) => { paras.push(String(s)); return chain; }
             : k === 'getId' ? () => 'doc-1' : k === 'getUrl' ? () => 'https://docs/doc-1' : chain,
    apply: () => chain });
  const noop = () => {};
  const ctx = {
    console, Logger: { log: noop }, Session: { getScriptTimeZone: () => 'Asia/Kolkata' }, Utilities: { formatDate: (d) => String(d) },
    CacheService: { getScriptCache: () => ({ get: () => null, put: noop }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => emp }) }) }) },
    MailApp: { sendEmail: (o) => { if (opts.failFor && o.to === opts.failFor) throw new Error('mail refused'); mail.push(o); } },
    DocumentApp: chain,
    DriveApp: { Access: {}, Permission: {}, getFileById: () => ({ setSharing: noop, moveTo: noop }), getFolderById: () => ({ getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => ({}) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  return { ctx, mail, paras };
}

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const meeting = (names, posts) => ({ colleagueName: names, colleaguePost: posts, adhikariName: 'Ramesh Meena', adhikariPost: 'Chief Block Education Officer/BEO',
  district: 'BARAN', meetingDate: '2026-10-08', meetingTime: '11:00 AM', purpose: 'Enrollment', agenda: 'Agenda', employeeName: 'Officer',
  meetingId: 'MTG-1', keyPoints: 'Discussed: x', conductDate: '2026-10-08', duration: '1 hr', meetingType: 'One-on-One', designation: 'Program Coordinator' });

let w = world();
w.ctx.sendColleagueNotification(meeting('Seema Pankaj, Kohla Ram, Unknown Person', 'Program Coordinator, Block Program Officer, -'), 'MTG-1');
ok('invitation: one email to each colleague found in Employee_DB', w.mail.map(m => m.to).join() === 'seema.pankaj@educategirls.ngo,kohla.ram@educategirls.ngo', w.mail.map(m => m.to).join());
ok('invitation: each greets its own colleague', /Dear <strong>Seema Pankaj<\/strong>/.test(w.mail[0].htmlBody) && /Dear <strong>Kohla Ram<\/strong>/.test(w.mail[1].htmlBody));
ok('invitation: a name not in Employee_DB is skipped quietly', w.mail.length === 2);

w = world();
w.ctx.sendMOMNotification(meeting('Seema Pankaj, Kohla Ram', 'Program Coordinator, Block Program Officer'), 'https://docs/x', '', '');
ok('MoM: one email to each colleague', w.mail.map(m => m.to).join() === 'seema.pankaj@educategirls.ngo,kohla.ram@educategirls.ngo', w.mail.map(m => m.to).join());

w = world({ failFor: 'seema.pankaj@educategirls.ngo' });
w.ctx.sendColleagueNotification(meeting('Seema Pankaj, Kohla Ram', ''), 'MTG-1');
ok('one refused address does not stop the next colleague', w.mail.map(m => m.to).join() === 'kohla.ram@educategirls.ngo');

w = world();
w.ctx.sendColleagueNotification(meeting('Seema Pankaj', 'Program Coordinator'), 'MTG-1');
ok('a single colleague (the old format) still gets one email', w.mail.length === 1 && w.mail[0].to === 'seema.pankaj@educategirls.ngo');
w = world();
w.ctx.sendColleagueNotification(meeting('Seema Pankaj, seema pankaj ,', ''), 'MTG-1');
ok('the same name twice, or a stray comma: one email', w.mail.length === 1);
w = world();
w.ctx.sendColleagueNotification(meeting('', ''), 'MTG-1');
ok('no colleague: no email', w.mail.length === 0);

w = world();
w.ctx.createMoMDoc(meeting('Seema Pankaj, Kohla Ram, Unknown Person', 'Program Coordinator, Block Program Officer, -'), '');
const att = w.paras.filter(p => /Seema|Kohla|Unknown/.test(p));
ok('MoM document lists each colleague with their designation', att.join(' | ') === 'Seema Pankaj   (Program Coordinator) | Kohla Ram   (Block Program Officer) | Unknown Person', att.join(' | '));
w = world();
w.ctx.createMoMDoc(meeting('Seema Pankaj', 'Program Coordinator'), '');
ok('MoM document, one colleague: as before', w.paras.filter(p => /Seema/.test(p)).join() === 'Seema Pankaj   (Program Coordinator)');

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
