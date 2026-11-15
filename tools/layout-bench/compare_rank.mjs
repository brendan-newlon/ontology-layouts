// Builds compare_best.json, which the comparison page (compare.html) reads to choose its left side's default: for each graph,
// the open-source layouts at their general settings, ranked by crossed links plus links through classes (fewer is better; a
// tie goes to the smaller drawing, "fill": its area over the room the boxes take). The first of the ranking is the default.
//
// Sources, in this order of preference:
//   results_tuned.json (the development graphs; only the rows of the open-source layouts at their general settings: no
//   "(tuned)", "(ours)", "top-down" or "no clean-up"), results_heldout.json (hx_*) and results_public.json (pb_*): the
//   recorded benchmark results;
//   compare_measured.json: the Lab's graphs that have no recorded results, measured in a browser with the Lab's own code.
//   To measure them again, serve the repository (for example `python -m http.server 8614` in its root), open
//   http://localhost:8614/tools/layout-bench/compare.html?measure=1 and wait: every graph without recorded results is laid
//   out by each open-source layout (seed 1, straight links) and counted; the page then saves compare_measured.json. Put
//   that file next to this script.
//
// Run: node tools/layout-bench/compare_rank.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(here, f), 'utf8'));
// the recorded names are the Lab's own names for its open-source layouts (its #algo list and ENGINES)
const ENGINE = { 'd3-force': 'x:d3', WebCola: 'x:cola', 'Cytoscape cose': 'x:cose', 'Cytoscape fcose': 'x:fcose', 'ELK stress': 'x:elk-stress', 'ELK force': 'x:elk-force',
  'ELK layered': 'x:elk-layered', 'Graphviz neato': 'x:neato', 'Graphviz fdp': 'x:fdp', 'Graphviz sfdp': 'x:sfdp', 'dagre (layered)': 'x:dagre' };
const general = (a) => !/\(tuned\)|\(ours|top-down|no clean-up|\(constrained\)/.test(a);
const rank = (rows) => rows.slice().sort((a, b) => (a.cross + a.thru) - (b.cross + b.thru) || a.fill - b.fill);
const r1 = (x) => Math.round(x * 100) / 100;

const out = {};
for (const [file, keep] of [['results_tuned.json', () => true], ['results_heldout.json', (k) => k.startsWith('hx_')], ['results_public.json', (k) => k.startsWith('pb_')]]) {
  const by = {};
  read(file).forEach((r) => { if (!keep(r.key) || !general(r.algo) || r.seed !== 1) return; const a = ENGINE[r.algo]; if (!a) throw new Error(`${file}: no Lab layout for "${r.algo}"`);
    (by[r.key] = by[r.key] || []).push({ algo: a, cross: r.cross, thru: r.thru, fill: r.fill }); });
  Object.entries(by).forEach(([k, rows]) => { out[k] = { from: 'benchmark', ranking: rank(rows).map((x) => [x.algo, x.cross, x.thru, r1(x.fill)]) }; });
}
let measured = 0;
if (existsSync(join(here, 'compare_measured.json'))) {
  const M = read('compare_measured.json');
  Object.entries(M.graphs || {}).forEach(([k, rows]) => { if (out[k]) return; const ok = rows.filter((x) => !x.error && x.cross != null);
    if (!ok.length) return; measured++; out[k] = { from: 'browser', ranking: rank(ok.map((x) => ({ ...x, fill: x.fill == null ? 1e9 : x.fill }))).map((x) => [x.algo, x.cross, x.thru, r1(x.fill)]) }; });
}
const graphs = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, { best: v.ranking[0][0], ...v }]));
writeFileSync(join(here, 'compare_best.json'), JSON.stringify({ made: new Date().toISOString().slice(0, 10),
  about: 'Per graph, the open-source layouts at their general settings ranked by crossed links + links through classes (ties: smaller fill). ranking: [layout, crossings, through classes, fill]. Built by compare_rank.mjs.',
  graphs }, null, 0).replace(/\},"/g, '},\n"'));
const wins = {}; Object.values(graphs).forEach((g) => (wins[g.best] = (wins[g.best] || 0) + 1));
console.log(`${Object.keys(graphs).length} graphs (${measured} measured in a browser); best most often:`, Object.entries(wins).sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a} ${n}`).join(', '));
