// Builds docs/_staff_test.html: the real dashboard with a stub in front that
// answers every server call with canned data, as a staff admin (canManageStaff),
// with staffList / staffSave / staffRemove kept in memory so a save shows up on
// reload. The real stored session on this origin is not read, replaced or
// removed, and nothing reaches the real server. docs/_*.html is git-ignored;
// delete it after use.
//   node scripts/tests/make-staff-harness.js   then open http://localhost:8765/_staff_test.html
//   ...?admin=0 shows the page as an ordinary officer (no menu item).
//   ...?owner=0 shows it as Rajat (has the access, not the owner).
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('docs/dashboard.html', 'utf8');
const code = fs.readFileSync('Code.gs', 'utf8');
const m = /var RJ_DISTRICT_BLOCKS = (\{[\s\S]*?\n\});/.exec(code);
if (!m) throw new Error('RJ_DISTRICT_BLOCKS not found in Code.gs');
const DISTRICTS = vm.runInNewContext('(' + m[1] + ')');

const STUB = `<script>
(function(){
  var ADMIN = !/[?&]admin=0/.test(location.search), OWNER = !/[?&]owner=0/.test(location.search);
  var FAKE = OWNER ? { name:'Alok Mohan', email:'alok.mohan@educategirls.ngo', role:'State', designation:'Test User',
               district:'', districts:[''], token:'fake' }
             : { name:'Rajat Sharma', email:'rajat.sharma@educategirls.ngo', role:'State', designation:'State Program Manager',
               district:'', districts:[''], token:'fake' };
  var ADMINS = ['rajat.sharma@educategirls.ngo'];
  var gi = Storage.prototype.getItem, ri = Storage.prototype.removeItem, cl = Storage.prototype.clear;
  Storage.prototype.getItem = function(k){ return k === 'eg_grm_session' ? JSON.stringify(FAKE) : gi.call(this, k); };
  Storage.prototype.removeItem = function(k){ if (/^eg_grm_/.test(k)) return; return ri.call(this, k); };
  Storage.prototype.clear = function(){ if (this === window.sessionStorage) return; return cl.call(this); };
  var STAFF = [
    { district:'', block:'', name:'Alok Mohan', designation:'Test User', email:'alok.mohan@educategirls.ngo', role:'State', zone:'', addl:'' },
    { district:'', block:'', name:'Rajat Sharma', designation:'State Program Manager', email:'rajat.sharma@educategirls.ngo', role:'State', zone:'', addl:'' },
    { district:'SIROHI', block:'SHEOGANJ, PINDWARA', name:'Bheraram Meghwal', designation:'Program Coordinator', email:'bheraram.meghwal@educategirls.ngo', role:'Field', zone:'', addl:'' },
    { district:'SIROHI', block:'SIROHI', name:'Sheetal Arya', designation:'Program Coordinator', email:'sheetal.arya@educategirls.ngo', role:'Field', zone:'', addl:'' },
    { district:'JALORE', block:'', name:'Sakshi Jain', designation:'District Operation Lead', email:'sakshi.jain@educategirls.ngo', role:'District', zone:'', addl:'RAJSAMAND, JODHPUR, PALI, SIROHI' },
    { district:'BALOTRA', block:'BAITU', name:'Brijlal Kushwaha', designation:'Block Program Officer', email:'brijlal.kushwaha@educategirls.ngo', role:'Field', zone:'', addl:'' },
    { district:'BALOTRA', block:'SIWANA', name:'Mamta Kumari Mali', designation:'Program Coordinator', email:'mamta.mali@educategirls.ngo', role:'Field', zone:'', addl:'' }
  ];
  var LOG = [['2026-11-27 12:35', 'gr@educategirls.ngo', 'Add', 'mamta.mali@educategirls.ngo', 'Mamta Kumari Mali', '', 'BALOTRA | SIWANA | Program Coordinator | Field', '']];
  var DISTRICTS = ${JSON.stringify(DISTRICTS)};
  function txt(r) { return [r.district || '-', r.block || '-', r.designation || '-', r.role || '-'].join(' | ') + (r.addl ? ' | + ' + r.addl : ''); }
  function answer(a, body) {
    if (a === 'getPlanDistricts') return ['BARAN','JAIPUR','UDAIPUR'];
    if (a === 'getDropdownData') return { stakeholders:['Chief Block Education Officer/BEO','Other'], purposes:['Enrollment'], blocksByDistrict:{}, metBefore:[], canManageStaff: ADMIN };
    if (a === 'getMyMeetings' || a === 'getAllMyMeetings' || a === 'getStateAllMeetings') return [];
    if (!ADMIN && /^staff/.test(a)) return { success:false, message:'FORBIDDEN' };
    if (a === 'staffList') return { success:true, me:FAKE.email, staff:STAFF, districts:DISTRICTS, roles:['Field','District','State'], log:LOG.slice().reverse(), removed:[],
                                         owner: OWNER, owners:['alok.mohan@educategirls.ngo','gr@educategirls.ngo'], admins: ADMINS.slice() };
    if (a === 'staffSetAccess') {
      if (!OWNER) return { success:false, message:'FORBIDDEN' };
      var w = STAFF.find(function(s){ return s.email === body.email; }), has = ADMINS.indexOf(body.email) !== -1;
      if (body.on === has) return { success:true, changed:false, message: w.name + (has ? ' already has' : ' does not have') + ' Staff Manage access.' };
      if (body.on) ADMINS.push(body.email); else ADMINS.splice(ADMINS.indexOf(body.email), 1);
      LOG.push(['2026-11-27 15:10', FAKE.email, body.on ? 'Access given' : 'Access taken', w.email, w.name, body.on ? '' : 'Staff Manage access', body.on ? 'Staff Manage access' : '', '']);
      return { success:true, changed:true, message: body.on ? w.name + ' can now use Staff Manage (after a page refresh).' : w.name + ' can no longer use Staff Manage.' };
    }
    if (a === 'staffSave') {
      var r = body.rec, now = '2026-11-27 15:00';
      var rec = { district:(r.district||'').toUpperCase(), block:(r.blocks||[]).join(', '), name:r.name, designation:r.designation, email:r.email, role:r.role, zone:'', addl:(r.addl||[]).join(', ') };
      if (body.mode === 'add') {
        if (STAFF.some(function(s){ return s.email === rec.email; })) return { success:false, message: rec.email + ' is already in the staff list. Use Edit to change it.' };
        STAFF.push(rec); LOG.push([now, FAKE.email, 'Add', rec.email, rec.name, '', txt(rec), '']);
        return { success:true, changed:true, email:rec.email, message: rec.name + ' added. They can sign in now with "Get a code".' };
      }
      var i = STAFF.findIndex(function(s){ return s.email === body.origEmail; }), old = STAFF[i];
      rec.email = old.email; STAFF[i] = rec;
      LOG.push([now, FAKE.email, old.district !== rec.district || old.block !== rec.block ? 'Transfer' : 'Edit', rec.email, rec.name, txt(old), txt(rec), '']);
      return { success:true, changed:true, email:rec.email, message: rec.name + ' updated. It applies from their next sign-in.' };
    }
    if (a === 'staffRemove') {
      var j = STAFF.findIndex(function(s){ return s.email === body.email; }), o = STAFF[j];
      STAFF.splice(j, 1); LOG.push(['2026-11-27 15:05', FAKE.email, 'Remove', o.email, o.name, txt(o), '', body.reason || '']);
      return { success:true, changed:true, email:o.email, message: o.name + ' removed. Their row is kept in the Removed Staff tab.' };
    }
    return { success:true };
  }
  window.fetch = function(url, opts) {
    var a = (/[?&]action=([^&]+)/.exec(url) || [])[1] || '';
    var body = {}; try { body = opts && opts.body ? JSON.parse(opts.body) : {}; } catch (e) {}
    var out = answer(a, body);
    return new Promise(function(res){ setTimeout(function(){ res(new Response(JSON.stringify(out))); }, 120); });
  };
})();
</script>`;

const out = src.replace('<head>', '<head>\n' + STUB);
if (out === src) throw new Error('no <head> found');
fs.writeFileSync('docs/_staff_test.html', out);
console.log('docs/_staff_test.html written');
