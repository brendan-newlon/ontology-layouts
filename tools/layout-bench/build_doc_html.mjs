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
// Curved links: our drawings again with the library's link routing (arcs for parallel links, bends round classes in the way;
// the routing may push a class off a link). Stored as the paths of the links that are not straight, and the counts with the
// change the routing makes, on the same 3 px margin as the straight counts.
execSync('node build_base.mjs', { cwd: here }); execSync('node mkbundle.mjs', { cwd: here });
const { OURS: OL } = await import('./_bundle.mjs');
const r1 = (v) => Math.round(v * 10) / 10;
for (const m of Object.values(DATA)) for (const L of Object.values(m.ours)) {
  const D = m.box.map((w) => ({ w, h: 20 })), E = m.edges.map(([s, t, sub]) => [s, t, sub ? 2 : 1]), P = L.pos.map(([x, y]) => ({ x, y }));
  const rr = OL.route(P, D, E), st = OL.routeMetrics(P, D, E, E.map(() => null), 3), cv = OL.routeMetrics(rr.pos, D, E, rr.routes, 3);
  const paths = OL.routePaths(rr.pos, D, E, rr.routes, { samples: 4 }), bent = {};
  rr.routes.forEach((r, k) => { if (r && paths[k].points.length > 2) bent[k] = paths[k].points.map((q) => [Math.round(q.x), Math.round(q.y)]); }); // straight links are drawn from the positions
  const moved = []; rr.pos.forEach((q, i) => { if (Math.hypot(q.x - P[i].x, q.y - P[i].y) > 0.5) moved.push([i, r1(q.x), r1(q.y)]); });
  L.cv = { bent, moved, cross: Math.max(0, L.cross + cv.cross - st.cross), thru: Math.max(0, L.thru + cv.thru - st.thru), hidden: st.hidden || 0 };
}
const dev = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'].filter((k) => DATA[k]);
// an unseen graph is shown only when ours and every general-settings open-source layout are recorded for it
const complete = (k) => Object.keys(DATA[k].ours).length === 2 && Object.keys(DATA[k].pub).length >= 11;
const unseen = Object.keys(DATA).filter((k) => isUnseen(k) && complete(k)).sort((a, b) => DATA[a].labels.length - DATA[b].labels.length || a.localeCompare(b));
for (const k of Object.keys(DATA)) if (isUnseen(k) && !unseen.includes(k)) delete DATA[k];
const order = dev.concat(unseen);
for (const k of Object.keys(DATA)) if (!order.includes(k)) delete DATA[k]; // only the graphs the page shows
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
// Entry points are collected in OntologyLayouts at the end; OntologyLayouts.draw runs the whole pipeline. Internal names: compact = Tidy Stress, grouped = Mycelium, auto = Best Read.

` + code;
code = code.trimEnd() + '\n';
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// tables from tables.mjs, the worked example from gen_example.mjs (the clean-up) and gen_finish.mjs (the finishing passes)
execSync('node tables.mjs', { cwd: here });
const tables = JSON.parse(fs.readFileSync(path.join(here, 'tables.json'), 'utf8'));
const example = fs.readFileSync(path.join(here, 'example.json'), 'utf8');
let out = tpl.replace('/*__DATA__*/null', () => data).replace('/*__EXAMPLE__*/null', () => example).replace('/*__FINISH__*/null', () => fs.readFileSync(path.join(here, 'finish_bio.json'), 'utf8')).replace('/*__FINISH2__*/null', () => fs.readFileSync(path.join(here, 'finish_hubs.json'), 'utf8')).replace('<!--__CODE__-->', () => esc(code));
for (const [k, v] of Object.entries(tables)) { if (!out.includes('<!--__' + k + '__-->')) throw new Error('no place for ' + k); out = out.replace('<!--__' + k + '__-->', () => v); }
if (/<!--__[A-Z_]+__-->/.test(out)) throw new Error('unfilled placeholder: ' + out.match(/<!--__[A-Z_]+__-->/)[0]);
// Two editions: the write-up, and the same page with the Layout Lab built in (the library, to run the clean-up on a drawing
// made by hand, and the teaching sessions). Blocks between <!--LAB--> and <!--/LAB--> are in the lab edition only,
// blocks between <!--NOLAB--> and <!--/NOLAB--> in the write-up only.
const dest = path.resolve(here, '..', '..', 'docs', 'ONTOLOGY-LAYOUT-ALGORITHMS.html'), destLab = dest.replace(/\.html$/, '-LAB.html');
const plain = out.replace(/<!--LAB-->[\s\S]*?<!--\/LAB-->\n?/g, '').replace(/<!--\/?NOLAB-->/g, '');
const lib = code.replace(/<\/script/gi, '<\\/script'), teach = fs.existsSync(path.join(here, 'teaching_sessions.json')) ? fs.readFileSync(path.join(here, 'teaching_sessions.json'), 'utf8') : 'null';
const labEd = out.replace(/<!--NOLAB-->[\s\S]*?<!--\/NOLAB-->\n?/g, '').replace(/<!--\/?LAB-->\n?/g, '').replace('/*__LIBRARY__*/', () => lib).replace('/*__TEACH__*/null', () => teach)
  .replace('<title>', '<title>Lab edition: ');
// The development story is its own page (docs/STORY.html): how the layouts work, how the clean-up was taught (with the lab
// and the teaching sessions of the lab edition), the work it builds on, and what did not work. The benchmarks page keeps the rest.
// Links between the two pages go through the one-page site (index.html#page:anchor), which shows the other page there.
const STORY = ['how', 'learned', 'prior', 'tried'];
const cut = (html) => { const parts = {}; let rest = html;
  for (const id of STORY) { const a = rest.indexOf(`<h2 id="${id}"`), b = rest.indexOf('\n<h2 ', a + 5); if (a < 0 || b < 0) throw new Error('story section not found: ' + id); parts[id] = rest.slice(a, b + 1); rest = rest.slice(0, a) + rest.slice(b + 1); }
  return { rest, parts }; };
const idsIn = (html) => new Set([...html.matchAll(/\sid="([\w-]+)"/g)].map((m) => m[1]));
const relink = (html, here, there) => html.replace(/href="#([\w-]+)"/g, (m, id) => (here.has(id) ? m : `href="../index.html#${there}:${id}" target="_top"`));
const cutPlain = cut(plain), storyIds = idsIn(Object.values(cutPlain.parts).join(''));
const bench = relink(cutPlain.rest, idsIn(cutPlain.rest), 'story')
  .replace(/<a href="[^"]*#story:learned"[^>]*>How it was learned<\/a>/, '').replace(/<a href="[^"]*#story:how"[^>]*>How the layouts work<\/a>/, '')
  .replace('<nav class="toc" aria-label="Contents"><b>On this page</b>', '<nav class="toc" aria-label="Contents"><b>On this page</b><a href="../index.html#story" target="_top">How it was built (its own page) →</a>');
const lc = cut(labEd), parts = Object.fromEntries(Object.entries(lc.parts).map(([k, v]) => [k, relink(v, storyIds, 'benchmarks')]));
const b0 = labEd.indexOf('<!--BODY-->'), b1 = labEd.indexOf('<!--/BODY-->'); if (b0 < 0 || b1 < 0) throw new Error('BODY markers not found');
const storyHead = `<div class="kicker">The development story</div>
<h1>How it was built</h1>
<p class="sub">How the layouts work, how a person taught the clean-up to an AI assistant, the published work it builds on, and what was tried and dropped on the way. The results are on the <a href="../index.html#benchmarks" target="_top">Benchmarks</a> page.</p>
<nav class="toc" aria-label="Contents"><b>On this page</b><a href="#how">How the layouts work</a><a href="#learned">How the clean-up was taught</a><a href="#lab">Try the lab here</a><a href="#prior">What it builds on</a><a href="#tried">What did not work</a></nav>
`;
const story = labEd.slice(0, b0) + storyHead + STORY.map((k) => parts[k]).join('\n') + labEd.slice(b1);
const storyPage = story.replace(/<title>[^<]*<\/title>/, '<title>How it was built · Ontology Layouts</title>').replace('data-page="benchmarks"', 'data-page="story"')
  .replace('<header class="sitebar"><h1>Benchmarks</h1>', '<header class="sitebar"><h1>How it was built</h1>');
fs.writeFileSync(dest, bench); fs.writeFileSync(destLab, labEd); fs.writeFileSync(path.join(path.dirname(dest), 'STORY.html'), storyPage);
console.log('wrote', path.join(path.dirname(dest), 'STORY.html'), (storyPage.length / 1024).toFixed(0), 'KB');
console.log('wrote', destLab, (labEd.length / 1024).toFixed(0), 'KB');
console.log('wrote', dest, (out.length / 1024).toFixed(0), 'KB,', dev.length, 'development graphs,', unseen.length, 'unseen graphs in the explorer');
