// Snapshots the OPEN analytics endpoints to static JSON so the public portal
// (docs/report.html + derived pages) loads from the Pages CDN instead of a
// live ~2s Apps Script call. Run by .github/workflows/snapshot.yml every 30 min.
// Only the already-public endpoints are snapshotted — no per-user/private data.
const fs   = require('fs');
const path = require('path');

const GAS = 'https://script.google.com/macros/s/AKfycbxtYbZLg3IKvrlxRGY9An_L9qB6qi2NiVuuGdjFsxcsR65tPIffYeXvAWxqklgMwJG4/exec';
const OUT = path.join(__dirname, '..', 'docs', 'data');

const JOBS = [
  { file: 'report.json',    action: 'getReportData' },
  { file: 'employees.json', action: 'getEmployeeMaster' },
  { file: 'stats.json',     action: 'getDashboardStats&all=1' }
];

async function getJson(action) {
  for (let t = 0; t < 3; t++) {
    try {
      const r   = await fetch(GAS + '?action=' + action, { redirect: 'follow' });
      const txt = await r.text();
      const j   = JSON.parse(txt);           // throws on the HTML error page → retry
      if (j && j.success !== false) return j;
    } catch (e) { /* retry */ }
    await new Promise(res => setTimeout(res, 1500));
  }
  return null;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let ok = 0;
  for (const job of JOBS) {
    const j = await getJson(job.action);
    if (!j) { console.error('❌ failed (keeping previous file):', job.action); continue; }
    j._snapshotAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, job.file), JSON.stringify(j));
    console.log('✅ ' + job.file + '  (' + JSON.stringify(j).length + ' bytes)');
    ok++;
  }
  if (ok === 0) { console.error('All fetches failed — nothing written.'); process.exit(1); }
})();
