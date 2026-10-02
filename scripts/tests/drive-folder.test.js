// The REAL conductMeeting and createMoMDoc out of Code.gs, with Drive, Docs and
// Sheets faked. Checks that photos and the MoM land in Rajasthan's own folder
// (DRIVE_ROOT_ID), never in the owner's Drive root where UP's EG-GR-Meetings
// lives, and that the MoM is filed in the meeting folder with or without photos.
//   node scripts/tests/drive-folder.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');
const RJ_ROOT_ID = /var DRIVE_ROOT_ID\s*=\s*'([^']+)'/.exec(src)[1];

function world() {
  const log = { rootTouched: 0, rootSharingSet: 0, files: [], moved: [] };
  function folder(name, parent) {
    const f = { name, parent, kids: {}, files: [],
      path: () => (parent ? parent.path() + '/' : '') + name,
      getFoldersByName: (n) => { const k = f.kids[n]; return { hasNext: () => !!k, next: () => k }; },
      createFolder: (n) => (f.kids[n] = folder(n, f)),
      setSharing: () => { if (f === rjRoot) log.rootSharingSet++; },
      getUrl: () => 'https://drive/' + f.path(), getId: () => 'id:' + f.path(), getName: () => name,
      createFile: (blob) => { const file = { name: blob.name, setSharing: () => {} }; f.files.push(file); log.files.push(f.path() + '/' + blob.name); return file; },
      addFile: () => {} };
    return f;
  }
  const rjRoot = folder('RJ-root', null);
  const upDriveRoot = folder('gr-drive-root', null);
  upDriveRoot.kids['EG-GR-Meetings'] = folder('EG-GR-Meetings', upDriveRoot);

  // Any chain of Docs calls returns itself; only ids and urls matter here.
  const chain = new Proxy(function () {}, {
    get: (t, k) => k === 'getId' ? () => 'doc-1' : k === 'getUrl' ? () => 'https://docs/doc-1'
             : k === Symbol.toPrimitive ? () => '' : chain,
    apply: () => chain });

  const sheets = {
    'Plan Meetings': [['Meeting ID'], ['MTG-T1', 'BARAN'], ['MTG-T2', 'BARAN']],
    'Conducted Meetings': [['Meeting ID']] };
  function sheet(rows) {
    const range = (r, c) => ({ getValue: () => (rows[r - 1] || [])[c - 1] || '', setValue: (v) => { (rows[r - 1] = rows[r - 1] || [])[c - 1] = v; },
      getValues: () => rows.slice(r - 1).map(x => [x[c - 1]]), setNumberFormat: () => {}, setBackground: () => ({ setFontColor: () => ({ setFontWeight: () => {} }) }) });
    return { getDataRange: () => ({ getValues: () => rows }), getLastRow: () => rows.length,
             getRange: range, appendRow: (a) => rows.push(a), setFrozenRows: () => {} };
  }
  const noop = () => {};
  const ctx = {
    console, Logger: { log: noop },
    Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
    Utilities: { base64Decode: (s) => s, newBlob: (b, type, name) => ({ name, type }), sleep: noop, formatDate: (d) => String(d) },
    CacheService: { getScriptCache: () => ({ get: () => null, put: noop, remove: noop, removeAll: noop }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: noop }) },
    MailApp: { sendEmail: noop },
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] ? sheet(sheets[n]) : null, insertSheet: noop }) },
    DocumentApp: chain,
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'link' }, Permission: { VIEW: 'view' },
      getFolderById: (id) => { if (id !== RJ_ROOT_ID) throw new Error('no folder ' + id); return rjRoot; },
      getRootFolder: () => { log.rootTouched++; return upDriveRoot; },
      getFileById: () => ({ setSharing: noop, moveTo: (f) => log.moved.push(f.path()) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  return { ctx, log, sheets };
}

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const base = { district: 'BARAN', employeeName: 'Seema Pankaj', email: 'seema.pankaj@educategirls.ngo',
               adhikariName: 'Ramesh Meena', adhikariPost: 'Chief Block Education Officer/BEO', purpose: 'Enrollment',
               conductDate: '2026-10-02', conductTime: '11:00 AM', keyPoints: 'Discussed: TEST enrolment data for the block',
               outcome: 'Commitment' };

// With photos and the MoM ticked
let w = world();
let r = w.ctx.conductMeeting(Object.assign({ meetingId: 'MTG-T1', photos: [{ type: 'image/jpeg', data: 'AAAA' }], skipMom: false }, base));
ok('conduct succeeds', r.success === true, JSON.stringify(r));
ok('photo goes to Rajasthan folder / BARAN / MTG-T1', w.log.files[0] === 'RJ-root/BARAN/MTG-T1/MTG-T1_1.jpeg', w.log.files.join(','));
ok('photo folder link is the Rajasthan one', r.photoFolderUrl === 'https://drive/RJ-root/BARAN/MTG-T1', r.photoFolderUrl);
ok('MoM filed in the same meeting folder', w.log.moved.join() === 'RJ-root/BARAN/MTG-T1', w.log.moved.join());
ok('MoM link returned and written to the sheet', r.momUrl === 'https://docs/doc-1' && w.sheets['Conducted Meetings'][1][17] === 'https://docs/doc-1');
ok("owner's Drive root (UP's EG-GR-Meetings) never touched", w.log.rootTouched === 0, 'getRootFolder called ' + w.log.rootTouched + 'x');
ok("Rajasthan folder's own sharing left alone", w.log.rootSharingSet === 0);

// MoM ticked, no photos: the MoM used to stay loose in the Drive root
w = world();
r = w.ctx.conductMeeting(Object.assign({ meetingId: 'MTG-T2', photos: [], skipMom: false }, base));
ok('no photos: conduct succeeds, no photo folder link', r.success === true && r.photoFolderUrl === '', JSON.stringify(r));
ok('no photos: MoM still filed in Rajasthan folder / BARAN / MTG-T2', w.log.moved.join() === 'RJ-root/BARAN/MTG-T2', w.log.moved.join());
ok("no photos: owner's Drive root never touched", w.log.rootTouched === 0);

// MoM not ticked: no document at all
w = world();
r = w.ctx.conductMeeting(Object.assign({ meetingId: 'MTG-T2', photos: [], skipMom: true }, base));
ok('MoM not ticked: no document, nothing moved', r.success === true && r.momUrl === '' && w.log.moved.length === 0);

ok('getRootMeetingsFolder opens DRIVE_ROOT_ID', world().ctx.getRootMeetingsFolder().getName() === 'RJ-root');

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
