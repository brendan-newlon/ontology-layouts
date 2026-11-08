// Extracts the library's layout functions into base_layout.js (next to this script) so the bench and pages always run the library's current code.
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), root = path.resolve(here, '..', '..');
const s = fs.readFileSync(path.join(root, 'src/ontology-layouts.js'), 'utf8');
const a = s.indexOf('function _ogClRng(');
const b = s.indexOf('// ── end of the layouts ──');
if (a < 0 || b < 0 || b < a) throw new Error('anchors not found');
let body = s.slice(a, b).replace(/\r\n/g, '\n');
// The clean-up after a layout (_ogHandTidy) also lives in the library; handtidy.js is generated from it for the lab and handbench.mjs
const t0 = body.indexOf('// ── Clean-up after a layout ──'), t1 = body.indexOf('// ── end of the clean-up ──');
if (t0 < 0 || t1 < 0) throw new Error('clean-up anchors not found');
// handtidy.js runs on its own (lab, handbench.mjs), so it gets its own copy of the work clock
const c0 = body.indexOf('// ── Work clock ──'), c1 = body.indexOf('// ── end of the work clock ──');
if (c0 < 0 || c1 < 0) throw new Error('work clock anchors not found');
const tidy = (body.slice(c0, c1) + body.slice(t0, t1)).split('\n').map((l) => l.replace(/^      /, '')).join('\n');
fs.writeFileSync(path.join(here, 'handtidy.js'), '// generated from src/ontology-layouts.js by build_base.mjs: edit the library, then run node build_base.mjs\n(function (root) {\n' + tidy + 'root.HandTidy = _ogHandTidy; root.HandTidy.cleanUp = _ogLayoutCleanUp;\n})(typeof window !== \'undefined\' ? window : globalThis);\n');
body += `\nwindow.OURS = { tune: _OG_TUNE, tidy: _ogHandTidy, cleanUp: _ogLayoutCleanUp, layout: _ogGroupedLayout, louvain: _ogClLouvain, merge: _ogClMergeSmall, separate: _ogClSeparate, crossings: _ogClCrossings, segX: _ogClSegX, dps: _ogClDPS, dss: _ogClDSS, segBox: _ogClSegBox, rng: _ogClRng, compact: _ogCompactLayout, grouped2: _ogGroupedLayout, stressLayout: _ogStressLayout, auto: _ogAutoLayout, pmetrics: _ogPlacementMetrics, pscore: _ogPlacementScore, sep: _ogClSeparate, now: _ogNow, work: _ogWorkN, clocked: _ogClocked, workNs: _OG_WORK_NS, traced: _ogTraced, route: _ogRouteLinks, routeMetrics: _ogRouteMetrics, routePoly: _ogRoutePoly, ROUTE: _OG_ROUTE, setTimeLimit: _ogSetTimeLimit, leafSwap: _ogLeafSwap, pullIn: _ogPullIn, PULL: _OG_PULL, api: OntologyLayouts, draw: _ogDraw, routePaths: _ogRoutePaths, groups: _ogGroups, placeNew: _ogPlaceNew, inline: _ogInline };\n`;
fs.writeFileSync(path.join(here, 'base_layout.js'), '// generated from src/ontology-layouts.js by build_base.mjs\n' + body);
console.log('base_layout.js', body.length, 'chars');
