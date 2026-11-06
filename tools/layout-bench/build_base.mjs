// Extracts the library's layout functions into base_layout.js (next to this script) so the bench and pages always run the library's current code.
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), root = path.resolve(here, '..', '..');
const s = fs.readFileSync(path.join(root, 'src/ontology-layouts.js'), 'utf8');
const a = s.indexOf('function _ogClRng(');
const b = s.indexOf('// ── end of the layouts ──');
if (a < 0 || b < 0 || b < a) throw new Error('anchors not found');
let body = s.slice(a, b).replace(/\r\n/g, '\n');
body += `\nwindow.OURS = { layout: _ogGroupedLayout, louvain: _ogClLouvain, merge: _ogClMergeSmall, separate: _ogClSeparate, crossings: _ogClCrossings, segX: _ogClSegX, dps: _ogClDPS, dss: _ogClDSS, segBox: _ogClSegBox, rng: _ogClRng, compact: _ogCompactLayout, grouped2: _ogGroupedLayout, stressLayout: _ogStressLayout, auto: _ogAutoLayout, pmetrics: _ogPlacementMetrics, pscore: _ogPlacementScore, sep: _ogClSeparate };\n`;
fs.writeFileSync(path.join(here, 'base_layout.js'), '// generated from src/ontology-layouts.js by build_base.mjs\n' + body);
console.log('base_layout.js', body.length, 'chars');
