// Runs every *.test.js in this folder inside this one node process (each test
// builds its own sandbox, so they do not touch each other) and prints one line
// per suite. One process on purpose: some shells here stop a command once it
// starts a third node process. Run from the repo root before every clasp push:
//   node scripts/tests/run-all.js
const fs = require('fs'), path = require('path');
const dir = __dirname, realExit = process.exit, realLog = console.log, realErr = console.error;
let bad = 0;
fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort().forEach(f => {
  const lines = [];
  let code = 0;
  console.log = console.error = function () { lines.push(Array.prototype.join.call(arguments, ' ')); };
  process.exit = function (c) { code = c || 0; throw { __exit: true }; };
  try { require(path.join(dir, f)); }
  catch (e) { if (!e || !e.__exit) { code = 1; lines.push(String((e && e.stack) || e)); } }
  finally { console.log = realLog; console.error = realErr; process.exit = realExit; }
  if (code !== 0) bad++;
  const last = (lines.filter(l => /checks pass|FAILED/.test(l)).pop() || lines[lines.length - 1] || '').trim();
  realLog(f.replace('.test.js', '').padEnd(16) + last + (code !== 0 ? '   <-- exit ' + code : ''));
  if (code !== 0) lines.filter(l => /^FAIL|Error/.test(l)).slice(0, 5).forEach(l => realLog('    ' + l.slice(0, 160)));
});
realLog(bad ? '\n' + bad + ' suite(s) FAILED' : '\nall suites pass');
realExit(bad ? 1 : 0);
