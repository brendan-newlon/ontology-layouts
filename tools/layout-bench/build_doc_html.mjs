// Builds docs/ONTOLOGY-LAYOUT-ALGORITHMS.html: a single self-contained page (no external files) with the write-up and
// side-by-side drawings. Input: demo_drawings.json (recorded by contenders.html with window.KEEP_POS = true, seed 1).
// Run: node build_doc_html.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const readRows = (f) => (fs.existsSync(path.join(here, f)) ? JSON.parse(fs.readFileSync(path.join(here, f), 'utf8')).filter((r) => !r.error && r.pos) : []);
// The 15 development graphs, then the graphs never seen during development (held-out and public), at general settings
const isUnseen = (k) => /^(hx|pb)_/.test(k), GENERAL = (a) => !/\(tuned\)|top-down|no clean-up/.test(a);
const latestOurs = new Map(); readRows('results_ours.json').forEach((r) => latestOurs.set(r.key + '|' + r.algo, r));
const rows = readRows('demo_drawings.json').concat([...readRows('results_heldout.json'), ...readRows('results_public.json')].filter((r) => isUnseen(r.key) && !/\(ours\)/.test(r.algo) && GENERAL(r.algo)),
  [...latestOurs.values()].filter((r) => isUnseen(r.key) && GENERAL(r.algo)));
const NAMES = { uni: 'University', hotel: 'Hotel booking', org: 'W3C ORG', brewery: 'Brewery IoT', trial: 'Clinical trial', prov: 'PROV-O', telecom: 'Telecom network', sosa: 'SOSA/SSN', crm: 'Customer 360 (one large hub)', schema: 'schema.org core', health: 'Clinical record (three super-hubs)', fibo: 'FIBO-like loans', pizza: 'Pizza (taxonomy)', bio: 'Biomedical taxonomy', big: 'Bank',
  hx_small: 'Held-out: small mixed model', hx_mesh: 'Held-out: dense links', hx_rome40: 'Held-out: sparse, Rome style', hx_rings: 'Held-out: process loops', hx_hubs: 'Held-out: two big hubs', hx_md70: 'Held-out: multi-domain', hx_rome90: 'Held-out: sparse, Rome style', hx_tax: 'Held-out: deep taxonomy', hx_md160: 'Held-out: multi-domain', hx_md300: 'Held-out: multi-domain',
  pb_foaf: 'FOAF', pb_dcterms: 'Dublin Core terms', pb_time: 'OWL-Time', pb_dcat: 'DCAT 3', pb_bfo: 'BFO 2020', pb_dul: 'DOLCE+DnS Ultralite', pb_saref: 'SAREF core', pb_gr: 'GoodRelations' };
const nameOf = (k) => NAMES[k] || (k.startsWith('pb_rome') ? 'Rome graph ' + k.slice(7) : k);
const OURS = { 'Tidy Stress (ours)': 'Tidy Stress', 'Mycelium (ours)': 'Mycelium', 'Best Read (ours)': 'Best Read' };
const DATA = {};
for (const r of rows) {
  if (isUnseen(r.key) && r.n > 120) continue; // the explorer keeps to graphs a page can draw quickly
  const m = (DATA[r.key] = DATA[r.key] || { name: nameOf(r.key), unseen: isUnseen(r.key), labels: r.labels, box: r.box, edges: r.edges, ours: {}, pub: {} });
  if (r.algo === 'Best Read (ours)') continue; // the auto mode is presented apart from the two layouts
  const side = OURS[r.algo] ? m.ours : m.pub, name = OURS[r.algo] || r.algo;
  side[name] = { pos: r.pos, cross: r.cross, thru: r.thru, fill: Math.round(r.fill * 10) / 10, score: Math.round(r.score), ms: Math.round(r.ms) };
}
const dev = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'].filter((k) => DATA[k]);
// an unseen graph is shown only when ours and every general-settings open-source layout are recorded for it
const complete = (k) => Object.keys(DATA[k].ours).length === 2 && Object.keys(DATA[k].pub).length >= 11;
const unseen = Object.keys(DATA).filter((k) => isUnseen(k) && complete(k)).sort((a, b) => DATA[a].labels.length - DATA[b].labels.length || a.localeCompare(b));
for (const k of Object.keys(DATA)) if (isUnseen(k) && !unseen.includes(k)) delete DATA[k];
const order = dev.concat(unseen);
const data = JSON.stringify({ order, groups: [['The 15 development graphs', dev], ['Never seen during development', unseen]], graphs: DATA });
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
  cleanUp: _ogLayoutCleanUp,     // (pos, boxes, links, startedAt) -> [{x, y}]: the clean-up after a layout
  now: _ogNow,                   // () -> ms on the work clock: pass a reading taken before the layout to cleanUp as startedAt
  metrics: _ogPlacementMetrics,  // (pos, boxes, links as [{s, t}]) -> { cross, thru, near, ov, len, lout, area, fill }
  score: _ogPlacementScore       // (metrics) -> number, lower is more readable
};
`;
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// tables from tables.mjs, the worked example from gen_example.mjs
execSync('node tables.mjs', { cwd: here });
const tables = JSON.parse(fs.readFileSync(path.join(here, 'tables.json'), 'utf8'));
const example = fs.readFileSync(path.join(here, 'example.json'), 'utf8');
let out = tpl.replace('/*__DATA__*/null', () => data).replace('/*__EXAMPLE__*/null', () => example).replace('<!--__CODE__-->', () => esc(code));
for (const [k, v] of Object.entries(tables)) { if (!out.includes('<!--__' + k + '__-->')) throw new Error('no place for ' + k); out = out.replace('<!--__' + k + '__-->', () => v); }
if (/<!--__[A-Z_]+__-->/.test(out)) throw new Error('unfilled placeholder: ' + out.match(/<!--__[A-Z_]+__-->/)[0]);
const dest = path.resolve(here, '..', '..', 'docs', 'ONTOLOGY-LAYOUT-ALGORITHMS.html');
fs.writeFileSync(dest, out);
console.log('wrote', dest, (out.length / 1024).toFixed(0), 'KB,', dev.length, 'development graphs,', unseen.length, 'unseen graphs in the explorer');
