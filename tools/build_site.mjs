// Builds the site's two short pages: docs/INTRO.html (the introduction, with a drawing of one graph by a widely used
// layout and by ours, from tools/layout-bench/demo_drawings.json) and docs/DEVELOPER-GUIDE.html (from DEVELOPER-GUIDE.md).
// The one-page site (index.html) shows them with the Playback, the Lab and the Benchmarks. Run: node tools/build_site.mjs
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const REPO = 'https://github.com/brendan-newlon/ontology-layouts';

// ---------- the page around the content ----------
function page({ title, description, pageKey, barTitle, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<style>
:root { --bg: #f7f6f2; --paper: #fff; --ink: #1d232b; --muted: #5b6573; --rule: #dcdad2; --accent: #2f6b4f; --accent-soft: #e3efe8; --code-bg: #f0eee7;
  --box: #eef3fb; --box-line: #6d86b0; --sub: #6f9a54; --rel: #8b97a8; --bad: #c43d32; --warn: #c98a12; --pub: #5a5f8a; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #15181c; --paper: #1c2026; --ink: #e6e8eb; --muted: #9aa4b1; --rule: #30353d; --accent: #7cc39e; --accent-soft: #1f3329; --code-bg: #232830;
  --box: #233041; --box-line: #6f8db8; --sub: #8fbf6f; --rel: #6f7b8c; --bad: #ff6f61; --warn: #f0b44a; --pub: #a7acd9; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #15181c; --paper: #1c2026; --ink: #e6e8eb; --muted: #9aa4b1; --rule: #30353d; --accent: #7cc39e; --accent-soft: #1f3329; --code-bg: #232830;
  --box: #233041; --box-line: #6f8db8; --sub: #8fbf6f; --rel: #6f7b8c; --bad: #ff6f61; --warn: #f0b44a; --pub: #a7acd9; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif; }
.sitebar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 12px; padding: 6px 14px; background: color-mix(in srgb, var(--paper) 92%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid var(--rule); font-size: 14px; }
.sitebar h1 { font-size: 15px; margin: 0; } .sitebar .sp { flex: 1; } .sitebar a { color: var(--muted); }
.wrap { max-width: 1040px; margin: 0 auto; padding: 36px 16px 80px; }
.prose { max-width: 74ch; }
h1.big { font-size: clamp(2rem, 4.5vw, 2.9rem); line-height: 1.12; margin: 0 0 .6rem; letter-spacing: -0.01em; text-wrap: balance; }
h2 { font-size: 1.45rem; margin: 2.6rem 0 .8rem; padding-top: 1.1rem; border-top: 1px solid var(--rule); text-wrap: balance; }
h3 { font-size: 1.1rem; margin: 1.8rem 0 .5rem; }
.kicker { text-transform: uppercase; letter-spacing: .12em; font-size: .78rem; color: var(--accent); font-weight: 600; margin-bottom: .5rem; }
.lede { font-size: 1.18rem; color: var(--muted); max-width: 64ch; margin: 0 0 1.6rem; }
a { color: var(--accent); }
p, ul, ol { margin: 0 0 1rem; } li { margin: .25rem 0; }
code { font: .88em/1.4 ui-monospace, Consolas, "Cascadia Mono", monospace; background: var(--code-bg); padding: .1em .35em; border-radius: 4px; }
pre { background: var(--code-bg); border: 1px solid var(--rule); border-radius: 8px; padding: 12px 14px; overflow-x: auto; margin: 0 0 1.1rem; }
pre code { background: none; padding: 0; font-size: .85rem; }
.tbl { overflow-x: auto; margin: 0 0 1.2rem; }
table { border-collapse: collapse; font-size: .92rem; min-width: 100%; }
th, td { text-align: left; vertical-align: top; padding: 7px 10px; border-bottom: 1px solid var(--rule); }
th { font-weight: 600; background: var(--paper); }
.paths { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin: 0 0 1.4rem; }
a.path { display: block; background: var(--paper); border: 1px solid var(--rule); border-radius: 12px; padding: 16px 16px 14px; color: inherit; text-decoration: none; transition: border-color .15s, transform .15s; }
a.path:hover { border-color: var(--accent); transform: translateY(-1px); }
a.path b { display: block; color: var(--accent); font-size: 1.04rem; margin-bottom: 4px; } a.path span { color: var(--muted); font-size: .92rem; }
a.path i { display: block; font-style: normal; font-size: .75rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin-bottom: 6px; }
.cmp { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0 0 .6rem; }
@media (max-width: 720px) { .cmp { grid-template-columns: 1fr; } }
.cmp figure { margin: 0; background: var(--paper); border: 1px solid var(--rule); border-radius: 12px; padding: 10px 10px 6px; }
.cmp figcaption { font-size: .92rem; margin: 0 4px 6px; } .cmp figcaption b { display: block; }
.cmp figcaption .n { color: var(--muted); } .cmp figcaption .n em { font-style: normal; color: var(--bad); font-weight: 600; }
.cmp svg { width: 100%; height: auto; display: block; }
.cmp .lk { fill: none; stroke: var(--rel); stroke-width: 1.3; } .cmp .lk.sub { stroke: var(--sub); stroke-width: 1.6; } .cmp .lk.thru { stroke: var(--bad); stroke-width: 2; }
.cmp .bx { fill: var(--box); stroke: var(--box-line); stroke-width: 1; } .cmp text { font-size: 11px; fill: var(--ink); }
.cmp .x { fill: var(--warn); }
.note { font-size: .9rem; color: var(--muted); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin: 0 0 1.4rem; }
.stat { background: var(--paper); border: 1px solid var(--rule); border-radius: 12px; padding: 14px 16px; }
.stat b { display: block; font-size: 1.12rem; margin-bottom: 4px; } .stat span { color: var(--muted); font-size: .92rem; }
.steps { counter-reset: s; list-style: none; padding: 0; display: grid; gap: 8px; max-width: 74ch; }
.steps li { counter-increment: s; position: relative; padding: 2px 0 2px 38px; margin: 0; }
.steps li::before { content: counter(s); position: absolute; left: 0; top: 2px; width: 26px; height: 26px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); font-weight: 700; display: grid; place-items: center; font-size: .85rem; }
.foot { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--rule); color: var(--muted); font-size: .9rem; }
</style>
<script src="../site-nav.js" data-page="${pageKey}" defer></script>
</head>
<body>
<header class="sitebar"><h1>${esc(barTitle)}</h1><span class="sp"></span><a href="${REPO}">Source on GitHub</a></header>
<div class="wrap">
${body}
<p class="foot">Ontology Layouts · Apache License 2.0 · <a href="${REPO}">${REPO.replace('https://', '')}</a></p>
</div>
</body>
</html>
`;
}
// a link to another page of the site: switches the page inside the one-page site, opens the site otherwise
const site = (p, hash) => `href="../index.html#${p}${hash || ''}" target="_top"`;

// ---------- Markdown, the subset the guide uses ----------
const slug = (t) => t.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9 -]/g, '').trim().replace(/ +/g, '-');
function inline(t) {
  const codes = []; t = t.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  t = esc(t).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, href) => `<a href="${/^(https?:|#)/.test(href) ? href : REPO + '/blob/main/' + href.replace(/^\.\.\//, '')}">${txt}</a>`);
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}
function markdown(md) {
  const L = md.replace(/\r\n/g, '\n').split('\n'), out = []; let i = 0;
  const cells = (row) => row.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => inline(c.trim()));
  while (i < L.length) {
    const l = L[i];
    if (/^```/.test(l)) { const buf = []; i++; while (i < L.length && !/^```/.test(L[i])) buf.push(L[i++]); i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
    const h = /^(#{1,3}) (.*)$/.exec(l); if (h) { const lvl = h[1].length; out.push(lvl === 1 ? '' : `<h${lvl} id="${slug(h[2])}">${inline(h[2])}</h${lvl}>`); i++; continue; }
    if (/^\|/.test(l)) { const rows = []; while (i < L.length && /^\|/.test(L[i])) rows.push(L[i++]);
      const head = cells(rows[0]), body = rows.slice(2).map(cells);
      out.push(`<div class="tbl"><table><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue; }
    if (/^(\s*)([-*]|\d+\.) /.test(l)) { const ordered = /^\s*\d+\./.test(l), items = [];
      while (i < L.length && /^(\s*)([-*]|\d+\.) /.test(L[i])) { let it = L[i++].replace(/^\s*([-*]|\d+\.) /, ''); while (i < L.length && /^\s{2,}\S/.test(L[i]) && !/^\s*([-*]|\d+\.) /.test(L[i])) it += ' ' + L[i++].trim(); items.push(it); }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); continue; }
    if (!l.trim()) { i++; continue; }
    const buf = []; while (i < L.length && L[i].trim() && !/^(```|#|\||\s*([-*]|\d+\.) )/.test(L[i])) buf.push(L[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

// ---------- a drawing of one graph, straight links, problems marked ----------
function segX(a, b, c, d) { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
  if (d1 * d2 >= 0 || d3 * d4 >= 0) return null; const t = d3 / (d3 - d4); return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; }
function segBox(a, b, c, hw, hh) { let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1], p = [-dx, dx, -dy, dy], q = [a[0] - (c[0] - hw), c[0] + hw - a[0], a[1] - (c[1] - hh), c[1] + hh - a[1]];
  for (let i = 0; i < 4; i++) { if (p[i] === 0) { if (q[i] < 0) return false; continue; } const r = q[i] / p[i]; if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } } return true; }
function drawing(row) {
  const P = row.pos, E = row.edges, W = row.box, H = 20, n = P.length;
  let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9; P.forEach((p, i) => { x1 = Math.min(x1, p[0] - W[i] / 2); x2 = Math.max(x2, p[0] + W[i] / 2); y1 = Math.min(y1, p[1] - H / 2); y2 = Math.max(y2, p[1] + H / 2); });
  const thru = new Set(), X = [];
  E.forEach(([s, t], k) => { for (let v = 0; v < n; v++) if (v !== s && v !== t && segBox(P[s], P[t], P[v], W[v] / 2 + 3, H / 2 + 3)) { thru.add(k); break; } });
  for (let a = 0; a < E.length; a++) for (let b = a + 1; b < E.length; b++) { const [s, t] = E[a], [u, w] = E[b]; if (s === u || s === w || t === u || t === w) continue; const c = segX(P[s], P[t], P[u], P[w]); if (c) X.push(c); }
  const pad = 14, r = (v) => Math.round(v * 10) / 10;
  let s = `<svg viewBox="${r(x1 - pad)} ${r(y1 - pad)} ${r(x2 - x1 + 2 * pad)} ${r(y2 - y1 + 2 * pad)}" role="img" aria-label="${esc(row.algo)}: ${row.cross} crossed links, ${row.thru} links through classes">`;
  E.forEach(([s0, t0, sub], k) => (s += `<path class="lk${sub ? ' sub' : ''}${thru.has(k) ? ' thru' : ''}" d="M${r(P[s0][0])},${r(P[s0][1])}L${r(P[t0][0])},${r(P[t0][1])}"/>`));
  P.forEach((p, i) => (s += `<g transform="translate(${r(p[0])},${r(p[1])})"><rect class="bx" x="${r(-W[i] / 2)}" y="${-H / 2}" width="${r(W[i])}" height="${H}" rx="4"/><text text-anchor="middle" y="4">${esc(row.labels[i])}</text></g>`));
  X.forEach((c) => (s += `<circle class="x" cx="${r(c[0])}" cy="${r(c[1])}" r="3.5"/>`));
  return s + '</svg>';
}

// ---------- the introduction ----------
function intro() {
  const rows = Object.values(JSON.parse(read('tools/layout-bench/demo_drawings.json')));
  const pick = (k, a) => rows.find((r) => r.key === k && r.algo === a);
  const theirs = pick('crm', 'Graphviz neato'), ours = pick('crm', 'Best Read (ours)');
  const fig = (row, name) => `<figure><figcaption><b>${name}</b><span class="n"><em>${row.cross}</em> crossed links · <em>${row.thru}</em> links through classes</span></figcaption>${drawing(row)}</figure>`;
  const body = `<div class="kicker">Graph layout for ontologies</div>
<h1 class="big">Ontology diagrams a reader can follow</h1>
<p class="lede">Automatic layouts that place each class so its links can be followed: few crossed links, no link running under a class that it does not belong to, and a compact drawing. In under a second, the same drawing on any computer, with one function call for your app.</p>

<div class="paths">
  <a class="path" ${site('playback')}><i>2 minutes</i><b>Watch it work</b><span>Play a layout step by step on a progress bar as long as the work itself. Switch steps off, move classes, mark what you see.</span></a>
  <a class="path" ${site('lab')}><i>Hands on</i><b>Lay out your own ontology</b><span>Open a Turtle (.ttl) file in the Lab, choose boxes or circles, tidy by hand, export SVG, PNG, JSON or GraphML.</span></a>
  <a class="path" ${site('benchmarks')}><i>The evidence</i><b>Benchmarks</b><span>Against 11 open-source layouts, tuned for their best chance, on 51 graphs, 36 of them never seen during development.</span></a>
  <a class="path" ${site('developers')}><i>For developers</i><b>Use it in your app</b><span>One call, your own node shapes and rendering, every option and its measured cost.</span></a>
</div>

<h2 id="see">The difference on one ontology</h2>
<p class="prose">A customer-data ontology of 31 classes around one large hub, drawn by Graphviz <code>neato</code>, a widely used layout, and by ours (Best Read with its clean-up). Dots mark crossed links; red links run through a class they do not belong to, so two unrelated classes look connected. Links are drawn straight here; in use, ours also bends the few links that remain.</p>
<div class="cmp">${fig(theirs, 'Graphviz neato')}${fig(ours, 'Ours: Best Read')}</div>
<p class="note">Both drawings are recorded in the benchmarks (the open-source layouts at general settings there; tuned, they do somewhat better). Every test graph can be compared in the <a ${site('benchmarks', '')}>Benchmarks</a>.</p>

<h2 id="numbers">In numbers</h2>
<div class="stats">
  <div class="stat"><b>About half the crossed links</b><span>of the best tuned open-source layouts over 15 development graphs: 480 against 960 for tuned Graphviz <code>neato</code>.</span></div>
  <div class="stat"><b>An eighth of the links through classes</b><span>of tuned WebCola (39 against 307); tuned <code>neato</code> comes closer (81) in about 16 times the area.</span></div>
  <div class="stat"><b>First of 12</b><span>on the five measures that matter for ontologies, and first again on 36 graphs never seen during development.</span></div>
  <div class="stat"><b>Under a second</b><span>at the median, clean-up included; about 1.3 s for 1,200 classes, where Graphviz takes 20 s.</span></div>
</div>

<h2 id="how">How it works</h2>
<ol class="steps">
<li><strong>Placement.</strong> Two layouts place every class at once so that distance on the page follows distance in the graph: Tidy Stress for typical ontologies, Mycelium for large and hub-heavy ones, which keeps closely linked groups together. Best Read runs both and keeps the more readable drawing.</li>
<li><strong>Clean-up, taught by a person.</strong> Then the drawing is tidied the way a person tidies it: a class moved off a link into open space, leaves turned round the class they hang from, crowded corners spread out. These moves were learned from recorded sessions of a person tidying drawings by hand in the Lab, distilled into rules with an AI assistant.</li>
<li><strong>Link routing.</strong> Parallel links become arcs side by side, self-links loops, a link that still runs through a class bends round it, and link names go where they cover nothing.</li>
</ol>
<p class="prose">Each step can be watched in the <a ${site('playback')}>Playback</a>, switched off to see what it is worth, or replaced by your own layout: the clean-up and the routing also tidy a drawing made by another layout. The same methods keep a drawing stable as a graph grows: expand a class, and nothing already drawn moves.</p>

<h2 id="taught">Taught, not only designed</h2>
<p class="prose">The clean-up did not come from the literature. Brendan Newlon tidied drawings by hand in the Lab while saying why; an AI assistant, Claude, turned the reasons into rules and tested them on graphs nobody had looked at. The Lab and the Playback are offered as tools in their own right, for any problem a person can see and fix better than they can describe: <a href="${REPO}/blob/main/docs/SHOW-AND-TELL-LABS.md">how the method works</a>.</p>`;
  return page({ title: 'Ontology Layouts', description: 'Readable automatic layouts for ontology diagrams: what they do, the difference on one ontology, and where to go next.', pageKey: 'intro', barTitle: 'Introduction', body });
}

function guide() {
  const md = read('docs/DEVELOPER-GUIDE.md'), title = /^# (.*)$/m.exec(md)[1];
  const body = `<div class="kicker">For developers</div>\n<h1 class="big">${esc(title.replace(/^Developer guide: /, ''))}</h1>\n<div class="prose" style="max-width:80ch">${markdown(md)}</div>`;
  return page({ title: 'Developer guide · Ontology Layouts', description: 'How to use the ontology layouts in your app: one call, your own node shapes, every option with its measured trade-offs.', pageKey: 'developers', barTitle: 'Developer guide', body });
}

fs.writeFileSync(path.join(root, 'docs/INTRO.html'), intro());
fs.writeFileSync(path.join(root, 'docs/DEVELOPER-GUIDE.html'), guide());
console.log('wrote docs/INTRO.html, docs/DEVELOPER-GUIDE.html');
