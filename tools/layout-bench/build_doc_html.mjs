// Builds docs/ONTOLOGY-LAYOUT-ALGORITHMS.html: a single self-contained page (no external files) with the write-up and
// side-by-side drawings. Input: demo_drawings.json (recorded by contenders.html with window.KEEP_POS = true, seed 1).
// Run: node build_doc_html.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const rows = JSON.parse(fs.readFileSync(path.join(here, 'demo_drawings.json'), 'utf8')).filter((r) => !r.error);
const NAMES = { uni: 'University', hotel: 'Hotel booking', org: 'W3C ORG', brewery: 'Brewery IoT', trial: 'Clinical trial', prov: 'PROV-O', telecom: 'Telecom network', sosa: 'SOSA/SSN', crm: 'Customer 360 (one large hub)', schema: 'schema.org core', health: 'Clinical record (three super-hubs)', fibo: 'FIBO-like loans', pizza: 'Pizza (taxonomy)', bio: 'Biomedical taxonomy', big: 'Bank' };
const OURS = { 'Tidy Stress (ours)': 'Tidy Stress', 'Mycelium (ours)': 'Mycelium', 'Best Read (ours)': 'Best Read' };
const DATA = {};
for (const r of rows) {
  const m = (DATA[r.key] = DATA[r.key] || { name: NAMES[r.key] || r.key, labels: r.labels, box: r.box, edges: r.edges, ours: {}, pub: {} });
  if (r.algo === 'Best Read (ours)') continue; // the auto mode is presented apart from the two layouts
  const side = OURS[r.algo] ? m.ours : m.pub, name = OURS[r.algo] || r.algo;
  side[name] = { pos: r.pos, cross: r.cross, thru: r.thru, fill: Math.round(r.fill * 10) / 10, score: Math.round(r.score), ms: Math.round(r.ms) };
}
const order = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'].filter((k) => DATA[k]);
const data = JSON.stringify({ order, graphs: DATA });
const tpl = fs.readFileSync(path.join(here, 'doc_template.html'), 'utf8');
// The full implementation, as the library runs it, with comments using the public names.
execSync('node build_base.mjs', { cwd: here });
let code = fs.readFileSync(path.join(here, 'base_layout.js'), 'utf8').replace(/^\/\/ generated[^\n]*\n/, '').replace(/\nwindow\.OURS = [^\n]*\n?/, '\n');
code = code.split('\n').map((l) => l.replace(/^      /, '')).join('\n')
  .replace(/── OG: Layout geometry helpers \(Compact, Grouped and Auto layouts, below\) ──/, '── Geometry helpers used by the layouts below ──')
  .replace(/── OG: Compact, Grouped and Auto layouts ─*/, '── Tidy Stress, Mycelium and Best Read ──')
  .replace(/\bCompact\b/g, 'Tidy Stress').replace(/\bGrouped\b/g, 'Mycelium').replace(/\bAuto\b/g, 'Best Read')
  .replace(/Pure geometry, no Cytoscape:/g, 'Pure geometry, no dependencies:')
  .replace(/smaller models go to the force layout\./, 'it returns null for fewer than 8 classes.');
code = `// Tidy Stress, Mycelium and Best Read: reference implementation. Plain JavaScript, no dependencies.
// Entry points are collected in OntologyLayouts at the end. Internal names: compact = Tidy Stress, grouped = Mycelium, auto = Best Read.

` + code;
code = code.trimEnd() + `

// ── Public entry points ──
const OntologyLayouts = {
  tidyStress: _ogCompactLayout,  // (boxes, links, options) -> { pos: [{x, y}], crossings, algo: "compact" | "grouped", variant, scores }
  mycelium: _ogGroupedLayout,    // same, or null for fewer than 8 classes
  bestRead: _ogAutoLayout,       // the more readable of the two
  metrics: _ogPlacementMetrics,  // (pos, boxes, links as [{s, t}]) -> { cross, thru, near, ov, len, lout, area, fill }
  score: _ogPlacementScore       // (metrics) -> number, lower is more readable
};
`;
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const out = tpl.replace('/*__DATA__*/null', () => data).replace('<!--__CODE__-->', () => esc(code));
const dest = path.resolve(here, '..', '..', 'docs', 'ONTOLOGY-LAYOUT-ALGORITHMS.html');
fs.writeFileSync(dest, out);
console.log('wrote', dest, (out.length / 1024).toFixed(0), 'KB,', order.length, 'models');
