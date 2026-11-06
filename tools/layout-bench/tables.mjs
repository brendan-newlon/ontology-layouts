// Builds the result tables of the write-up from results_tuned.json (15 graphs, one run each) and prints the numbers the prose quotes.
// Rankings use the five measures that count for ontologies: crossed links, links through classes, area, crossing angle, angular
// resolution. Distance fidelity, even link lengths and our own readability score (which has link-length terms) are not ranked.
// Output: tables.json, { [placeholder]: html }, read by build_doc_html.mjs. Run: node tables.mjs
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync(new URL('results_tuned.json', import.meta.url), 'utf8')).filter((r) => !r.error);
const ORDER = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'];
const NAMES = { uni: 'University', hotel: 'Hotel booking', org: 'W3C ORG', brewery: 'Brewery IoT', trial: 'Clinical trial', prov: 'PROV-O', telecom: 'Telecom network', sosa: 'SOSA/SSN', crm: 'Customer 360', schema: 'schema.org core', health: 'Clinical record (3 super-hubs)', fibo: 'FIBO-like loans', pizza: 'Pizza (taxonomy)', bio: 'Biomedical taxonomy', big: 'Bank' };
const keys = ORDER.filter((k) => rows.some((r) => r.key === k));
const get = (k, a) => rows.find((r) => r.key === k && r.algo === a);
const FIVE = [['cross', 'Crossed links', 1], ['thru', 'Links through classes', 1], ['fill', 'Area', 1], ['xang', 'Crossing angle', -1], ['angres', 'Angular resolution', -1]];
const DEFAULTS = ['Graphviz neato', 'Graphviz fdp', 'Graphviz sfdp', 'ELK stress', 'ELK force', 'ELK layered', 'WebCola', 'd3-force', 'dagre (layered)', 'Cytoscape cose', 'Cytoscape fcose'];
const TUNED = ['Graphviz neato (tuned)', 'Graphviz sfdp (tuned)', 'Graphviz fdp (tuned)', 'ELK stress (tuned)', 'ELK force (tuned)', 'ELK layered (tuned)', 'dagre (tuned)', 'WebCola (tuned)', 'd3-force (tuned)', 'Cytoscape cose (tuned)', 'Cytoscape fcose (tuned)'];
const TS = 'Tidy Stress (ours)', MY = 'Mycelium (ours)', BR = 'Best Read (ours)';
const show = (a) => a.replace(' (ours)', '').replace(' (tuned)', '').replace('dagre (layered)', 'dagre');
// average rank per measure over the graphs; ties share the mean of their places
function ranks(pool) {
  const R = Object.fromEntries(pool.map((a) => [a, {}])), cnt = {};
  for (const [f, , dir] of FIVE) for (const k of keys) {
    const rs = pool.map((a) => [a, get(k, a)]).filter(([, r]) => r && r[f] != null);
    if (rs.length < pool.length) continue;
    rs.sort((x, y) => dir * (x[1][f] - y[1][f]));
    for (let i = 0; i < rs.length;) { let j = i; while (j + 1 < rs.length && Math.abs(rs[j + 1][1][f] - rs[i][1][f]) < 1e-9) j++; for (let t = i; t <= j; t++) R[rs[t][0]][f] = (R[rs[t][0]][f] || 0) + (i + j) / 2 + 1; i = j + 1; }
    cnt[f] = (cnt[f] || 0) + 1;
  }
  for (const a of pool) { for (const f in R[a]) R[a][f] /= cnt[f]; R[a].mean = FIVE.reduce((s, [f]) => s + R[a][f], 0) / FIVE.length; }
  return R;
}
const sum = (a, f) => keys.reduce((s, k) => s + (get(k, a) ? get(k, a)[f] : 0), 0);
const med = (a, f) => { const v = keys.map((k) => get(k, a)).filter(Boolean).map((r) => r[f]).sort((x, y) => x - y); return v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
const mean = (a, f) => { const v = keys.map((k) => get(k, a)).filter((r) => r && r[f] != null).map((r) => r[f]); return v.reduce((s, x) => s + x, 0) / v.length; };
const ms = (x) => (x >= 1000 ? (x / 1000).toFixed(1) + ' s' : Math.round(x) + ' ms');
const n1 = (x) => x.toFixed(1), int = (x) => Math.round(x).toLocaleString('en-US');
// a ranking table: our two layouts and the open-source pool, then Best Read ranked against the same pool in their place
function rankTable(others) {
  const R = ranks([TS, MY, ...others]), RB = ranks([BR, ...others]);
  const best = Object.fromEntries([...FIVE.map(([f]) => f), 'mean'].map((f) => [f, Math.min(...[TS, MY, ...others].map((a) => R[a][f]))]));
  const cell = (v, f) => `<td${Math.abs(v - best[f]) < 1e-9 ? ' class="best"' : ''}>${n1(v)}</td>`;
  const line = (a, cls, src, label) => `<tr${cls ? ` class="${cls}"` : ''}><td>${label || show(a)}</td>${FIVE.map(([f]) => cell(src[a][f], f)).join('')}${cell(src[a].mean, 'mean')}<td>${int(sum(a, 'cross'))}</td><td>${int(sum(a, 'thru'))}</td><td>${ms(med(a, 'ms'))}</td></tr>`;
  const sorted = others.slice().sort((x, y) => R[x].mean - R[y].mean);
  const head = `<thead><tr><th>Layout</th>${FIVE.map(([, l]) => `<th>${l}</th>`).join('')}<th>Mean of the five</th><th>Crossed links, total</th><th>Links through classes, total</th><th>Median time</th></tr></thead>`;
  const body = [TS, MY].sort((x, y) => R[x].mean - R[y].mean).map((a) => line(a, 'ours', R)).join('') + sorted.map((a, i) => line(a, i ? '' : 'split', R)).join('') + line(BR, 'autorow split', RB, 'Best Read (auto mode)');
  return { html: `<div class="tbl"><table>${head}<tbody>${body}</tbody></table></div>`, R, RB };
}
const T = {}, P = {};
const tuned = rankTable(TUNED), def = rankTable(DEFAULTS);
T.TABLE_TUNED = tuned.html; T.TABLE_DEFAULT = def.html;
// effect of the clean-up on each of our layouts
{
  const L = [['Tidy Stress', TS, 'Tidy Stress, no clean-up (ours)'], ['Mycelium', MY, 'Mycelium, no clean-up (ours)'], ['Best Read', BR, 'Best Read, no clean-up (ours)']];
  const head = '<thead><tr><th>Layout</th><th>Crossed links, total</th><th>Links through classes, total</th><th>Mean crossing angle</th><th>Mean angular resolution</th><th>Median area</th><th>Median time</th></tr></thead>';
  const pair = (a, b, f, fmt) => `${fmt(sum(b, f))} → <b>${fmt(sum(a, f))}</b>`;
  const pm = (a, b, f, fmt) => `${fmt(mean(b, f))} → <b>${fmt(mean(a, f))}</b>`;
  const pmed = (a, b, f, fmt) => `${fmt(med(b, f))} → <b>${fmt(med(a, f))}</b>`;
  T.TABLE_CLEANUP = `<div class="tbl"><table>${head}<tbody>${L.map(([n, a, b]) => `<tr class="ours"><td>${n}</td><td>${pair(a, b, 'cross', int)}</td><td>${pair(a, b, 'thru', int)}</td><td>${pm(a, b, 'xang', (x) => x.toFixed(0) + '°')}</td><td>${pm(a, b, 'angres', (x) => x.toFixed(2))}</td><td>${pmed(a, b, 'fill', n1)}</td><td>${pmed(a, b, 'ms', ms)}</td></tr>`).join('')}</tbody></table></div>`;
  L.forEach(([n, a, b]) => (P['cleanup ' + n] = { cross: [sum(b, 'cross'), sum(a, 'cross')], thru: [sum(b, 'thru'), sum(a, 'thru')], xang: [mean(b, 'xang'), mean(a, 'xang')], fill: [med(b, 'fill'), med(a, 'fill')], ms: [med(b, 'ms'), med(a, 'ms')] }));
}
// per graph: crossed / through for ours and the tuned open-source layout with the fewest of both
{
  const head = '<thead><tr><th>Graph</th><th>Classes</th><th>Links</th><th>Tidy Stress</th><th>Mycelium</th><th>Best Read</th><th>Best tuned open-source layout</th></tr></thead>';
  const ct = (r) => (r ? `${r.cross} / ${r.thru}` : '–');
  T.TABLE_PERGRAPH = `<div class="tbl"><table>${head}<tbody>${keys.map((k) => { const r0 = get(k, TS); const bo = TUNED.map((a) => get(k, a)).filter(Boolean).sort((x, y) => x.cross + x.thru - y.cross - y.thru || x.fill - y.fill)[0];
    return `<tr><td>${NAMES[k]}</td><td>${r0.n}</td><td>${r0.links}</td><td>${ct(get(k, TS))}</td><td>${ct(get(k, MY))}</td><td>${ct(get(k, BR))}</td><td>${show(bo.algo)} ${ct(bo)}</td></tr>`; }).join('')}</tbody></table></div>`;
}
// numbers for the prose
P.totals = Object.fromEntries([BR, TS, MY, ...TUNED, ...DEFAULTS].map((a) => [show(a) + (TUNED.includes(a) ? ' (tuned)' : ''), { cross: sum(a, 'cross'), thru: sum(a, 'thru'), fill: +med(a, 'fill').toFixed(1), ms: Math.round(med(a, 'ms')), xang: +mean(a, 'xang').toFixed(1) }]));
P.tunedRanks = Object.fromEntries(Object.entries(tuned.R).map(([a, r]) => [show(a), Object.fromEntries(Object.entries(r).map(([f, v]) => [f, +v.toFixed(2)]))]));
P.tunedRanksBR = +tuned.RB[BR].mean.toFixed(2); P.defaultRanksBR = +def.RB[BR].mean.toFixed(2);
P.defaultRanks = Object.fromEntries(Object.entries(def.R).map(([a, r]) => [show(a), +r.mean.toFixed(2)]));
const winsX = {}; keys.forEach((k) => { const b = [BR, ...TUNED].map((a) => get(k, a)).filter(Boolean).sort((x, y) => x.cross + x.thru - y.cross - y.thru)[0]; winsX[show(b.algo)] = (winsX[show(b.algo)] || 0) + 1; });
P.winsBRvsTuned = winsX;
fs.writeFileSync(new URL('tables.json', import.meta.url), JSON.stringify(T));
fs.writeFileSync(new URL('tables_numbers.json', import.meta.url), JSON.stringify(P, null, 1));
console.log(JSON.stringify(P, null, 1));
