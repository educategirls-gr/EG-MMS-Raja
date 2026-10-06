// The REAL email builders out of Code.gs, run with stub services. Checks that
// every email names the state and the site from STATE_NAME / SITE_HOST, that
// changing those two lines is enough for another state, and that the pages take
// the name from docs/state.js. Ported from UP's commit 6232b2b.
//   node scripts/tests/state-name.test.js
const fs = require('fs');
const src = fs.readFileSync('Code.gs', 'utf8');
function fnSrc(name) {
  const a = src.indexOf('function ' + name + '(');
  if (a < 0) throw new Error('missing ' + name);
  return src.slice(a, src.indexOf('\n}', a) + 2);
}
function varVal(name) {
  const m = new RegExp('var ' + name + '\\s*=\\s*\'([^\']*)\'').exec(src);
  if (!m) throw new Error('missing var ' + name);
  return m[1];
}

const FNS = ['_emailEsc', 'sendOTP', 'colleagueNames_', 'sendColleagueNotification', 'sendColleagueNotificationTo_',
             'sendMOMNotification', 'sendMOMNotificationTo_', 'buildEscalationEmail_', 'buildWeeklyReminder_'];

function load(state, host) {
  const mail = [];
  const E = {
    STATE_NAME: state, SITE_HOST: host, ALLOWED_DOMAIN: 'educategirls.ngo', OTP_EXPIRY_SEC: 600,
    MailApp: { sendEmail: (o) => mail.push(o) },
    CacheService: { getScriptCache: () => ({ put: () => {}, get: () => null }) },
    getEmployeeByEmail: (e) => (e === 'known@educategirls.ngo' ? { name: 'Known Person' } : null),
    getEmployeeByName: () => ({ email: 'colleague@educategirls.ngo', name: 'Colleague' }),
    Logger: { log: () => {} }, Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
    Utilities: { formatDate: (d) => String(d) }
  };
  const names = Object.keys(E);
  const api = new Function(...names, FNS.map(fnSrc).join('\n') + '\nreturn {' + FNS.join(',') + '};')(...names.map(k => E[k]));
  api.mail = mail;
  return api;
}

const fails = [];
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails.push(label); };

const STATE = varVal('STATE_NAME'), HOST = varVal('SITE_HOST');
ok('Code.gs sets STATE_NAME and SITE_HOST', STATE === 'Rajasthan' && HOST === 'raj.dataimpact.in', STATE + ' / ' + HOST);

const meeting = { colleagueName: 'Colleague', adhikariName: 'Ramesh Meena', adhikariPost: 'Chief Block Education Officer/BEO',
                  district: 'BARAN', meetingDate: '2026-10-05', meetingTime: '11:00 AM', purpose: 'Enrollment', agenda: 'Agenda',
                  employeeName: 'Officer', meetingId: 'MTG-1', keyPoints: 'Discussed: x\nOfficial said: y',
                  conductDate: '2026-10-05', duration: '1 hr', meetingType: 'One-on-One' };

function checkAll(state, host, tag) {
  const api = load(state, host);

  // Sign-in code: only the words changed; who may sign in did not.
  const r = api.sendOTP('Known@educategirls.ngo ');
  const otp = api.mail[0] || {};
  ok(tag + 'OTP still sent and still succeeds', r.success === true && api.mail.length === 1, JSON.stringify(r));
  ok(tag + 'OTP sender names the state', otp.name === 'EG-MMS ' + state, otp.name);
  ok(tag + 'OTP subject names the state', otp.subject === 'EG Meeting Management System (' + state + ') - Login OTP', otp.subject);
  ok(tag + 'OTP text names state and site', (otp.body || '').indexOf(state + ' (' + host + ') is: ') > 0 && /is: \d{6}\n/.test(otp.body || ''), (otp.body || '').split('\n')[2]);
  ok(tag + 'OTP still refused for another domain', api.sendOTP('x@gmail.com').success === false);
  ok(tag + 'OTP still refused for someone not in the sheet', api.sendOTP('nobody@educategirls.ngo').success === false && api.mail.length === 1);

  api.sendColleagueNotification(meeting, 'MTG-1');
  api.sendMOMNotification(meeting, 'https://docs.google.com/x', 'https://drive.google.com/y', '');
  [['colleague invitation', api.mail[1]], ['MoM email', api.mail[2]]].forEach(([what, m]) => {
    m = m || { htmlBody: '' };
    ok(tag + what + ': sender names the state', m.name === 'EG-MMS ' + state, m.name);
    ok(tag + what + ': header and sign-off name the state',
       m.htmlBody.indexOf('Government Relations, ' + state + '</p>') > 0 && m.htmlBody.indexOf('Government Relations Team, ' + state) > 0);
    ok(tag + what + ': logo from our own site', m.htmlBody.indexOf('src="https://' + host + '/eg-logo.png"') > 0 && m.htmlBody.indexOf('educategirls.ngo/wp-content') < 0);
    ok(tag + what + ': no "undefined" in it', m.htmlBody.indexOf('undefined') < 0);
  });

  const esc = api.buildEscalationEmail_({ priority: 'High', category: 'Resource needed', district: 'BARAN', conductDate: '5 Oct',
                                          officerName: 'Officer', stakeholder: 'CBEO', purpose: 'x', flag: 'Blocked', nextAction: 'y', keyPoints: 'z' });
  ok(tag + 'escalation footer names the site', esc.indexOf(host + '</div>') > 0);

  const wk = api.buildWeeklyReminder_({ name: 'Seema Pankaj', meetings: [] }, '5 Oct to 11 Oct');
  ok(tag + 'weekly reminder footer names the site', wk.indexOf('https://' + host + '</div>') > 0);
}

checkAll(STATE, HOST, '');
// The point of the constants: another state is two lines, and nothing of Rajasthan leaks.
checkAll('Uttar Pradesh', 'dataimpact.in', '[UP] ');

// Nothing outside the constants spells a state or the site out. Comments may.
const code = src.split(/\r?\n/)
  .filter(l => !/^\s*(\/\/|var STATE_NAME|var SITE_HOST)/.test(l))
  .map(l => l.replace(/\s\/\/\s.*$/, ''));
const spelled = code.filter(l => /Rajasthan|Uttar Pradesh|dataimpact\.in/.test(l));
ok('no other code line of Code.gs spells out a state or the site', spelled.length === 0, spelled.map(l => l.trim().slice(0, 80)).join(' | '));
ok('no em dash in Code.gs', src.indexOf('\u2014') < 0);

// The site: one line in docs/state.js, every page loads it, none spells the name out.
const stateJs = fs.readFileSync('docs/state.js', 'utf8');
ok('docs/state.js says Rajasthan', /var STATE_NAME = 'Rajasthan';/.test(stateJs));
['index', 'dashboard', 'report', 'monthly-report', 'districtreports', 'teamperformance', 'stakeholders'].forEach(p => {
  const h = fs.readFileSync('docs/' + p + '.html', 'utf8');
  const lines = h.split('\n').filter(l => /Rajasthan/.test(l) && !/^\s*\/\//.test(l) && !/'Rajasthan': 'राजस्थान'/.test(l));
  ok(p + '.html loads state.js and does not spell the name out',
     (h.match(/<script src="state\.js"><\/script>/g) || []).length === 1 && /data-state-title="[^"]*\{STATE\}/.test(h) && lines.length === 0,
     lines.map(l => l.trim().slice(0, 70)).join(' | '));
});

// state.js itself, against a tiny stand-in for the page.
function runStateJs(titleAttr) {
  const spans = [{ textContent: '' }, { textContent: 'State' }];
  const title = { getAttribute: () => titleAttr };
  const doc = { title: 'fallback', readyState: 'complete',
                querySelector: () => title, querySelectorAll: () => spans, addEventListener: () => {} };
  new Function('document', 'window', stateJs)(doc, {});
  return { title: doc.title, spans: spans.map(s => s.textContent) };
}
const sj = runStateJs('EG MMS | {STATE} Analytics Portal');
ok('state.js sets the tab title', sj.title === 'EG MMS | Rajasthan Analytics Portal', sj.title);
ok('state.js fills every state-name span', sj.spans.every(s => s === 'Rajasthan'), sj.spans.join(','));

console.log('\n' + (fails.length ? fails.length + ' FAILED' : 'all checks pass'));
process.exit(fails.length ? 1 : 0);
