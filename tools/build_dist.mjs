// Builds the files an app uses from src/ontology-layouts.js (the library's code from _ogClRng to the end-of-layouts marker):
//   dist/ontology-layouts.js   a script tag gives window.OntologyLayouts; require() and AMD get the same object
//   dist/ontology-layouts.mjs  an ES module: import OntologyLayouts, { draw } from '.../ontology-layouts.mjs'
// dist/ontology-layouts.d.ts (types) is written by hand. Run: node tools/build_dist.mjs  (--check: exit 1 if dist is stale)
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const NAMES = ['draw', 'placeNew', 'inline', 'bestRead', 'tidyStress', 'mycelium', 'cleanUp', 'routeLinks', 'routePaths', 'groups', 'routeMetrics', 'metrics', 'score', 'setTimeLimit', 'now'];
export function build() {
  const s = fs.readFileSync(path.join(root, 'src/ontology-layouts.js'), 'utf8').replace(/\r\n/g, '\n');
  const a = s.indexOf('// ── OG: Layout geometry helpers'), b = s.indexOf('// ── end of the layouts ──');
  if (a < 0 || b < 0 || b < a) throw new Error('anchors not found in src/ontology-layouts.js');
  const body = s.slice(a, b).split('\n').map((l) => l.replace(/^      /, '')).join('\n');
  const head = '/*! Ontology Layouts: readable automatic layouts for ontology diagrams. Apache License 2.0. https://github.com/brendan-newlon/ontology-layouts\n'
    + ' * Generated from src/ontology-layouts.js by tools/build_dist.mjs: edit the source, then rebuild. Guide: docs/DEVELOPER-GUIDE.md */\n';
  const factory = 'function () {\n' + body + 'return OntologyLayouts;\n}';
  const umd = head + "(function (root, factory) {\n  if (typeof module === 'object' && module.exports) module.exports = factory();\n"
    + "  else if (typeof define === 'function' && define.amd) define([], factory);\n  else root.OntologyLayouts = factory();\n"
    + "})(typeof globalThis !== 'undefined' ? globalThis : this, " + factory + ');\n';
  const esm = head + 'const OntologyLayouts = (' + factory + ')();\nexport default OntologyLayouts;\n'
    + `export const { ${NAMES.join(', ')} } = OntologyLayouts;\n`;
  return { 'dist/ontology-layouts.js': umd, 'dist/ontology-layouts.mjs': esm };
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const out = build(), check = process.argv.includes('--check'); let stale = 0;
  for (const [f, text] of Object.entries(out)) {
    const p = path.join(root, f), cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (cur === text) continue; stale++;
    if (check) console.log(f + ' is out of date: run node tools/build_dist.mjs'); else { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); console.log('wrote ' + f); }
  }
  if (check && stale) process.exit(1); if (!stale) console.log('dist up to date');
}
