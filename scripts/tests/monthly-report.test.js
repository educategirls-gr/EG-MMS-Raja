// The REAL getMonthlyReport and buildReportEmailHtml out of Code.gs, with the
// meetings and the employee master faked as Rajasthan's. Rajasthan has no
// zones, so the State report must break down by district (2 Oct 2026), not a
// one-row "by zone" table plus a leaderboard repeating it.
//   node scripts/tests/monthly-report.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

const noop = () => {};
const cache = {};
const ctx = {
  console, Logger: { log: noop },
  Utilities: { sleep: noop, formatDate: (d) => String(d) }, Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
  CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: noop, removeAll: noop }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },   // no AI keys: the report uses its template
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 500, getContentText: () => '{}' }) },
};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'Code.gs' });

const M = (id, district, name, status, post) => ({ meetingId: id, district, employeeName: name, status, date: '2 Oct 2026',
  conductDate: status === 'Conducted' ? '2 Oct 2026' : '', stakeholderPost: post || 'Chief Block Education Officer/BEO',
  stakeholderName: 'Official ' + id, purpose: 'Enrollment', meetingType: 'One-on-One', govtMom: '' });
const meetings = [
  M('M1', 'BARAN', 'Seema Pankaj', 'Conducted'), M('M2', 'BARAN', 'Sanjay Goswami', 'Conducted'), M('M3', 'BARAN', 'Seema Pankaj', 'Planned'),
  M('M4', 'UDAIPUR', 'Summerveer Singh', 'Conducted'), M('M5', 'UDAIPUR', 'Dalpat Charan', 'Cancelled'),
  M('M6', 'BALOTARA', 'Kohla Ram', 'Planned'), M('M7', 'JAIPUR', 'Lavina Rathore', 'Conducted', 'Secretary')];
const employees = [
  { name: 'Seema Pankaj', designation: 'Program Coordinator', district: 'BARAN', block: 'ATRU, BARAN' },
  { name: 'Sanjay Goswami', designation: 'Program Coordinator', district: 'BARAN', block: 'KISHANGANJ, SHAHBAD' },
  { name: 'Summerveer Singh', designation: 'Program Coordinator', district: 'UDAIPUR', block: 'GIRWA' },
  { name: 'Dalpat Charan', designation: 'Program Coordinator', district: 'UDAIPUR', block: 'BADGAON' },
  { name: 'Kohla Ram', designation: 'Block Program Officer', district: 'BALOTARA', block: 'BALOTRA' },
  { name: 'Arvind Kumar', designation: 'Block Program Officer', district: 'JAISALMER', block: 'FATHEGARH' }];
ctx.getReportData = () => ({ success: true, meetings });
ctx.getEmployeeMaster = () => ({ success: true, employees });

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };

const rep = ctx.getMonthlyReport({ role: 'State', name: 'Brajesh Kumar Sinha', email: 'brajeshkumar.sinha@educategirls.ngo' }, 'Oct 2026');
const b = rep.breakdown || {};
ok('report builds for the state', rep.success !== false && rep.scope && rep.scope.label === 'Rajasthan', JSON.stringify(rep.scope || rep.message));
ok('State report breaks down by district', b.by === 'district', b.by);
ok('one row per district with meetings', JSON.stringify(b.rows.map(r => r.name).sort()) === JSON.stringify(['BALOTARA', 'BARAN', 'JAIPUR', 'UDAIPUR']), JSON.stringify(b.rows.map(r => r.name)));
const baran = b.rows.filter(r => r.name === 'BARAN')[0] || {};
ok('BARAN: 3 planned, 2 conducted, 67%, 2 active staff', baran.planned === 3 && baran.conducted === 2 && baran.pct === 67 && baran.activeStaff === 2, JSON.stringify(baran));
ok('no separate leaderboard repeating the table', (b.leaderboard || []).length === 0);
ok('no row called RAJASTHAN (the zone-list group)', b.rows.every(r => r.name !== 'RAJASTHAN'));
const att = (rep.attention || []).map(a => a.title);
ok('lowest performer named as a district, never a zone', att.some(t => /lowest-performing district/.test(t)) && !att.some(t => /zone/i.test(t)), JSON.stringify(att));
ok('JAISALMER (staff, no meetings) listed as no activity', att.some(t => /no activity/.test(t)), JSON.stringify(att));

const html = ctx.buildReportEmailHtml(rep, 'Brajesh Kumar Sinha');
ok('email: "Performance by District" table', /Performance by District/.test(html));
ok('email: no "Performance by Zone", no "District Leaderboard"', !/Performance by Zone/.test(html) && !/District Leaderboard/.test(html));
ok('email: names Rajasthan and raj.dataimpact.in', /Rajasthan/.test(html) && /raj\.dataimpact\.in\/report\.html/.test(html));

// A district lead's report is unchanged: by block
const drep = ctx.getMonthlyReport({ role: 'District', districts: ['UDAIPUR', 'BARAN', 'JHALAWAR'], district: 'UDAIPUR' }, 'Oct 2026');
ok('district lead report still breaks down by block', drep.breakdown && drep.breakdown.by === 'block', drep.breakdown && drep.breakdown.by);

ok('thisMonthKey_ gives "Mon YYYY"', /^[A-Z][a-z]{2} \d{4}$/.test(ctx.thisMonthKey_()), ctx.thisMonthKey_());

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
