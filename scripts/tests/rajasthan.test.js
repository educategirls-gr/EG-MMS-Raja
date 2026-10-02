// Rajasthan's own rules, on the REAL Code.gs with stub Google services:
// district lists without zones, escalation through Additional Districts,
// the Post dropdown from the Officials tab, and comma-separated blocks.
// People and districts as in the sheet on 1-2 Oct 2026.
//   node scripts/tests/rajasthan.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

function load(opts) {
  opts = opts || {};
  const props = Object.assign({}, opts.props || {}), cache = {};
  const ctx = {
    console, Logger: { log: () => {} },
    CacheService: { getScriptCache: () => ({
      get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; },
      remove: (k) => { delete cache[k]; }, removeAll: (ks) => ks.forEach(k => delete cache[k]),
      getAll: () => ({}), putAll: (o) => Object.assign(cache, o) }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
      getProperties: () => Object.assign({}, props), setProperties: (o) => Object.assign(props, o),
      deleteProperty: (k) => { delete props[k]; } }) },
    SpreadsheetApp: { openById: () => {
      if (!opts.sheets) throw new Error('Service Spreadsheets timed out');
      return { getSheetByName: (n) => opts.sheets[n] ? { getDataRange: () => ({ getValues: () => opts.sheets[n] }) } : null };
    } },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  ctx._props = props; ctx._cache = cache;
  return ctx;
}

let fails = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : '\n     got  ' + JSON.stringify(got) + '\n     want ' + JSON.stringify(want)));
  if (!ok) fails++;
}

// ── Districts: no zones, 13 staffed districts in one list, JAIPUR for everyone ──
const c = load();
const ALL = ['BALOTARA','BANSWARA','BARAN','JAIPUR','JAISALMER','JALOR','JHALAWAR','JODHPUR','NAGAUR','PALI','RAJSAMAND','SALUMBAR','SIROHI','UDAIPUR'];
eq('State plan dropdown: 13 districts + JAIPUR', c.getPlanDistricts('State', '', []), ALL);
eq('Field (BARAN): own + JAIPUR', c.getPlanDistricts('Field', '', ['BARAN']), ['BARAN', 'JAIPUR']);
eq('Field with two districts (Narayan, PALI + SIROHI)', c.getPlanDistricts('Field', '', ['PALI', 'SIROHI']), ['JAIPUR', 'PALI', 'SIROHI']);
eq('District lead with five (Sakshi)', c.getPlanDistricts('District', '', ['JALOR','RAJSAMAND','JODHPUR','PALI','SIROHI']),
   ['JAIPUR','JALOR','JODHPUR','PALI','RAJSAMAND','SIROHI']);
eq('BARAN is in the one group', c.districtToZone_('baran'), 'RAJASTHAN');
eq('JAIPUR is in no group (State in reports)', c.districtToZone_('JAIPUR'), '');
eq('allDistrictNames_ gives all 14', c.allDistrictNames_().slice().sort(), ALL);
const seema = { role: 'Field', district: 'BARAN', districts: ['BARAN'] };
eq('Field asking for a district not hers falls back to her own', c.resolveActiveDistrict_(seema, 'UDAIPUR'), 'BARAN');
eq('Field may file under JAIPUR', c.resolveActiveDistrict_(seema, 'JAIPUR'), 'JAIPUR');

// ── Escalation: shaped as getReportRecipients() builds it from the sheet ──
const recips = [
  { email: 'jaswinder.singh@educategirls.ngo', role: 'District', district: 'UDAIPUR',  districts: ['UDAIPUR', 'BARAN', 'JHALAWAR'] },
  { email: 'sakshi.jain@educategirls.ngo',     role: 'District', district: 'JALOR',    districts: ['JALOR', 'RAJSAMAND', 'JODHPUR', 'PALI', 'SIROHI'] },
  { email: 'hitendra.dave@educategirls.ngo',   role: 'District', district: 'BALOTARA', districts: ['BALOTARA'] },
  { email: 'rakesh.patidar@educategirls.ngo',  role: 'District', district: 'BALOTARA', districts: ['BALOTARA'] },
  { email: 'dheeraj.singh@educategirls.ngo',   role: 'District', district: 'NAGAUR',   districts: ['NAGAUR'] },
  { email: 'brajeshkumar.sinha@educategirls.ngo', role: 'State', district: '',       districts: [''] },
];
const F = (d) => ({ role: 'Field', email: 'x@educategirls.ngo', district: d[0], districts: d });
eq('Field in UDAIPUR -> Jaswinder (home district)', c.findSenior_(F(['UDAIPUR']), recips), ['jaswinder.singh@educategirls.ngo']);
eq('Field in BARAN -> Jaswinder (additional)', c.findSenior_(F(['BARAN']), recips), ['jaswinder.singh@educategirls.ngo']);
eq('Field in JHALAWAR -> Jaswinder (additional)', c.findSenior_(F(['JHALAWAR']), recips), ['jaswinder.singh@educategirls.ngo']);
eq('Field in RAJSAMAND -> Sakshi (additional)', c.findSenior_(F(['RAJSAMAND']), recips), ['sakshi.jain@educategirls.ngo']);
eq('Narayan, PALI + SIROHI -> Sakshi once', c.findSenior_(F(['PALI', 'SIROHI']), recips), ['sakshi.jain@educategirls.ngo']);
eq('Field in BALOTARA -> both BALOTARA leads', c.findSenior_(F(['BALOTARA']), recips), ['hitendra.dave@educategirls.ngo', 'rakesh.patidar@educategirls.ngo']);
eq('Field in BANSWARA: no senior yet (State Head CC only)', c.findSenior_(F(['BANSWARA']), recips), []);
eq('District lead -> State', c.findSenior_({ role: 'District', email: 'hitendra.dave@educategirls.ngo', district: 'BALOTARA' }, recips), ['brajeshkumar.sinha@educategirls.ngo']);
eq('admin is gr@ only', [c.isAdmin_('gr@educategirls.ngo'), c.isAdmin_('alok.mohan@educategirls.ngo')], [true, false]);
eq('escalation CC is the State Head', c.ESC_CC_STATE, 'brajeshkumar.sinha@educategirls.ngo');

// ── Post and Purpose dropdowns from the sheet, with a copy for outages ──
const sheets = {
  Officials: [['Post'], ['Chief Minister '], ['Director '], ['Chief Block Education Officer/BEO'], ['Other'], ['Chief Minister']],
  'Meeting Purpose': [['Meeting Purpose'], ['Enrollment'], ['Report Submission'], ['Report Submission'], ['Other']],
};
const p = load({ sheets });
const d1 = p.getDropdownData('');
eq('posts from Officials: header skipped, trimmed, repeats once', d1.stakeholders, ['Chief Minister', 'Director', 'Chief Block Education Officer/BEO', 'Other']);
eq('purposes: repeated Report Submission shown once', d1.purposes, ['Enrollment', 'Report Submission', 'Other']);
eq('post copy saved to Script Properties', JSON.parse(p._props.POSTS_MIRROR).length, 4);
const down = load({ props: p._props });            // Sheets refusing, cache empty
eq('Sheets down: posts still come from the copy', down.getDropdownData('').stakeholders.length, 4);
sheets.Officials.push(['PEEO']);
eq('POST_refresh picks up a new post', p.POST_refresh(), 5);

// ── Several blocks per officer, comma separated, each its own option ──
const mirror = {
  'seema.pankaj@educategirls.ngo':    { district: 'BARAN', block: 'ATRU, BARAN' },
  'sanjay.goswami@educategirls.ngo':  { district: 'BARAN', block: 'KISHANGANJ, SHAHBAD' },
  'sunil.prajapati@educategirls.ngo': { district: 'BARAN', block: 'MANGROL' },
  'jaswinder.singh@educategirls.ngo': { district: 'UDAIPUR', block: '' },
  'kohla.ram@educategirls.ngo':       { district: 'BALOTARA', block: 'BALOTRA' },
};
const b = load({ props: { EMP_MIRROR_N: '1', EMP_MIRROR_0: JSON.stringify(mirror), POSTS_MIRROR: '["Other"]', PURPOSES_MIRROR: '["Enrollment"]' } });
eq('blocks split per officer and sorted', b.getDropdownData('').blocksByDistrict,
   { BARAN: ['ATRU', 'BARAN', 'KISHANGANJ', 'MANGROL', 'SHAHBAD'], BALOTARA: ['BALOTRA'] });

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
