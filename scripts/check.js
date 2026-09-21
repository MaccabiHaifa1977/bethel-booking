'use strict';
// Syntax check for every JS file (server and browser). Run: npm run check
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name === 'node_modules' || f.name.startsWith('.')) continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith('.js')) files.push(p);
  }
})(root);

let failed = 0;
for (const f of files) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log('OK  ', path.relative(root, f));
  } catch (e) {
    failed++;
    console.log('FAIL', path.relative(root, f));
    console.log(String(e.stderr || e.message));
  }
}
console.log(failed ? `\n${failed} file(s) failed` : `\nAll ${files.length} files OK`);
process.exit(failed ? 1 : 0);
