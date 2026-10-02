// The REAL sendMeetingFeedback out of Code.gs with the sheet, cache and mail
// faked. Since 2 Oct 2026 a feedback carries a request id: sent once, answered
// again without a second email, IN_PROGRESS while it is being sent, and free to
// be sent again if the email failed.
//   node scripts/tests/feedback.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

function world(opts) {
  opts = opts || {};
  const cache = {}, mail = [];
  const row = []; row[0] = 'MTG-F1'; row[1] = 'BARAN'; row[2] = 'Seema Pankaj'; row[4] = 'seema.pankaj@educategirls.ngo';
  row[9] = 'Ramesh Meena'; row[10] = 'Chief Block Education Officer/BEO'; row[11] = 'Enrollment'; row[13] = '2026-10-02'; row[15] = 'Discussed: x';
  const rows = [['Meeting ID'], row];
  const c = { get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; },
              removeAll: (ks) => ks.forEach(k => delete cache[k]), putAll: (o) => Object.assign(cache, o),
              getAll: (ks) => { const o = {}; ks.forEach(k => { if (k in cache) o[k] = cache[k]; }); return o; } };
  const ctx = {
    console, Logger: { log: () => {} },
    CacheService: { getScriptCache: () => c },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({ getDataRange: () => ({ getValues: () => rows }) }) }) },
    MailApp: { sendEmail: (o) => { if (opts.mailFails) throw new Error('Service invoked too many times'); mail.push(o); } },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  return { ctx, cache, mail };
}

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const STATE = { role: 'State', name: 'Brajesh Kumar Sinha', email: 'brajeshkumar.sinha@educategirls.ngo' };

let w = world();
let r1 = w.ctx.sendMeetingFeedback(STATE, 'MTG-F1', 'Please share the block list', 'fb123abc');
ok('first send: one email, to the officer, State Head copied', r1.success && w.mail.length === 1 && w.mail[0].to === 'seema.pankaj@educategirls.ngo' && w.mail[0].cc === STATE.email, JSON.stringify(r1));
ok('sender names the state', w.mail[0].name === 'EG-MMS Rajasthan', w.mail[0].name);
let r2 = w.ctx.sendMeetingFeedback(STATE, 'MTG-F1', 'Please share the block list', 'fb123abc');
ok('same id again (reply was lost): success, no second email', r2.success && r2.repeat === true && w.mail.length === 1 && r2.sentTo === 'Seema Pankaj', JSON.stringify(r2));
let r3 = w.ctx.sendMeetingFeedback(STATE, 'MTG-F1', 'A different note', 'fb999xyz');
ok('a new feedback (new id) is sent', r3.success && !r3.repeat && w.mail.length === 2);

w = world();
w.cache['fbsent_fbBUSY'] = 'pending';
let r = w.ctx.sendMeetingFeedback(STATE, 'MTG-F1', 'Please share the block list', 'fbBUSY');
ok('while the first is still sending: IN_PROGRESS, no email', r.success === false && r.message === 'IN_PROGRESS' && w.mail.length === 0, JSON.stringify(r));

w = world({ mailFails: true });
r = w.ctx.sendMeetingFeedback(STATE, 'MTG-F1', 'Please share the block list', 'fbFAIL');
ok('mail fails: error reported', r.success === false && /could not be sent/.test(r.message), JSON.stringify(r));
ok('...and the id is forgotten, so sending again really sends', !('fbsent_fbFAIL' in w.cache));

w = world();
w.ctx.sendMeetingFeedback(STATE, 'MTG-F1', 'Old page, no id', undefined);
w.ctx.sendMeetingFeedback(STATE, 'MTG-F1', 'Old page, no id', undefined);
ok('a page without ids (cached old version) still sends', w.mail.length === 2);

w = world();
r = w.ctx.sendMeetingFeedback({ role: 'Field', email: 'x@educategirls.ngo' }, 'MTG-F1', 'Please share the block list', 'fbFIELD');
ok('Field role still refused, nothing sent, nothing remembered', r.message === 'FORBIDDEN' && w.mail.length === 0 && !('fbsent_fbFIELD' in w.cache));

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
