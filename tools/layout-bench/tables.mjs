// Builds the result tables of the write-up and prints the numbers the prose quotes.
//  - The 15 test graphs the layouts were developed on: results_tuned.json (one run each).
//  - Graphs never seen during development: the held-out graphs (models5.js, results_heldout.json) and the public benchmark
//    graphs (models6.js, results_public.json), with our rows from results_ours.json.
// Rankings use the five measures that count for ontologies: crossed links, links through classes, area, crossing angle, angular
// resolution. Each ranking table has tabs that add optional measures (subclass links drawn top-down; distance fidelity and
// even link lengths), for readers who value them. Our own readability score is never ranked.
// Output: tables.json, { [placeholder]: html }, read by build_doc_html.mjs. Run: node tables.mjs
import fs from 'node:fs';
const read = (f) => (fs.existsSync(new URL(f, import.meta.url)) ? JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8')).filter((r) => !r.error) : []);
const isOurs = (a) => / \(ours\)$/.test(a);
const TRAIN_ROWS = read('results_tuned.json');
const latestOurs = new Map(); read('results_ours.json').forEach((r) => latestOurs.set(r.key + '|' + r.algo, r));
const UNSEEN_ROWS = [...read('results_heldout.json'), ...read('results_public.json')].filter((r) => !isOurs(r.algo)).concat([...latestOurs.values()].filter((r) => /^(hx|pb)_/.test(r.key)));
const ORDER = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'];
const NAMES = { uni: 'University', hotel: 'Hotel booking', org: 'W3C ORG', brewery: 'Brewery IoT', trial: 'Clinical trial', prov: 'PROV-O', telecom: 'Telecom network', sosa: 'SOSA/SSN', crm: 'Customer 360', schema: 'schema.org core', health: 'Clinical record (3 super-hubs)', fibo: 'FIBO-like loans', pizza: 'Pizza (taxonomy)', bio: 'Biomedical taxonomy', big: 'Bank',
  hx_small: 'Small mixed model', hx_mesh: 'Dense links', hx_rome40: 'Sparse, Rome style', hx_rings: 'Process loops', hx_hubs: 'Two big hubs', hx_md70: 'Multi-domain', hx_rome90: 'Sparse, Rome style', hx_tax: 'Deep taxonomy', hx_md160: 'Multi-domain', hx_md300: 'Multi-domain',
  pb_foaf: 'FOAF', pb_dcterms: 'Dublin Core terms', pb_time: 'OWL-Time', pb_dcat: 'DCAT 3', pb_bfo: 'BFO 2020', pb_dul: 'DOLCE+DnS Ultralite', pb_saref: 'SAREF core', pb_gr: 'GoodRelations' };
const nameOf = (k) => NAMES[k] || (k.startsWith('pb_rome') ? 'Rome graph ' + k.slice(7) : k);
const FIVE = [['cross', 'Crossed links', 1], ['thru', 'Links through classes', 1], ['fill', 'Area', 1], ['xang', 'Crossing angle', -1], ['angres', 'Angular resolution', -1]];
const EXTRA = [
  { id: 'five', label: 'The five measures', m: FIVE },
  { id: 'down', label: '+ subclass links drawn top-down', m: [...FIVE, ['down', 'Subclass links top-down', -1]], note: 'Graphs without subclass links are left out of this column.' },
  { id: 'dist', label: '+ distance fidelity and even link lengths', m: [...FIVE, ['nstress', 'Distance fidelity (stress)', 1], ['elcv', 'Even link lengths', 1]] }
];
const DEFAULTS = ['Graphviz neato', 'Graphviz fdp', 'Graphviz sfdp', 'ELK stress', 'ELK force', 'ELK layered', 'WebCola', 'd3-force', 'dagre (layered)', 'Cytoscape cose', 'Cytoscape fcose'];
const TUNED = ['Graphviz neato (tuned)', 'Graphviz sfdp (tuned)', 'Graphviz fdp (tuned)', 'ELK stress (tuned)', 'ELK force (tuned)', 'ELK layered (tuned)', 'dagre (tuned)', 'WebCola (tuned)', 'd3-force (tuned)', 'Cytoscape cose (tuned)', 'Cytoscape fcose (tuned)'];
const TS = 'Tidy Stress (ours)', MY = 'Mycelium (ours)', BR = 'Best Read (ours)';
const show = (a) => a.replace(' (ours)', '').replace(' (tuned)', '').replace('dagre (layered)', 'dagre');
const msf = (x) => (x >= 1000 ? (x / 1000).toFixed(1) + ' s' : Math.round(x) + ' ms');
const n1 = (x) => x.toFixed(1), int = (x) => Math.round(x).toLocaleString('en-US');

// Everything for one set of graphs and one results file
function setOf(rows, keys) {
  const get = (k, a) => rows.find((r) => r.key === k && r.algo === a);
  // average rank per measure over the graphs; ties share the mean of their places
  function ranks(pool, M) {
    const R = Object.fromEntries(pool.map((a) => [a, {}])), cnt = {};
    for (const [f, , dir] of M) for (const k of keys) {
      const rs = pool.map((a) => [a, get(k, a)]).filter(([, r]) => r && r[f] != null);
      if (rs.length < pool.length) continue;
      rs.sort((x, y) => dir * (x[1][f] - y[1][f]));
      for (let i = 0; i < rs.length;) { let j = i; while (j + 1 < rs.length && Math.abs(rs[j + 1][1][f] - rs[i][1][f]) < 1e-9) j++; for (let t = i; t <= j; t++) R[rs[t][0]][f] = (R[rs[t][0]][f] || 0) + (i + j) / 2 + 1; i = j + 1; }
      cnt[f] = (cnt[f] || 0) + 1;
    }
    for (const a of pool) { for (const f in R[a]) R[a][f] /= cnt[f]; R[a].mean = M.reduce((s, [f]) => s + (R[a][f] || 0), 0) / M.length; }
    return R;
  }
  const sum = (a, f) => keys.reduce((s, k) => s + (get(k, a) ? get(k, a)[f] : 0), 0);
  const med = (a, f) => { const v = keys.map((k) => get(k, a)).filter(Boolean).map((r) => r[f]).sort((x, y) => x - y); return v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  const mean = (a, f) => { const v = keys.map((k) => get(k, a)).filter((r) => r && r[f] != null).map((r) => r[f]); return v.reduce((s, x) => s + x, 0) / v.length; };
  const maxOf = (a, f) => Math.max(...keys.map((k) => (get(k, a) || {})[f] || 0));
  // one ranking table: our two layouts and the open-source pool, then Best Read ranked against the same pool in their place
  function rankTable(others, M) {
    const R = ranks([TS, MY, ...others], M), RB = ranks([BR, ...others], M);
    const best = Object.fromEntries([...M.map(([f]) => f), 'mean'].map((f) => [f, Math.min(...[TS, MY, ...others].map((a) => R[a][f]))]));
    const cell = (v, f) => `<td${Math.abs(v - best[f]) < 1e-9 ? ' class="best"' : ''}>${n1(v)}</td>`;
    const line = (a, cls, src, label) => `<tr${cls ? ` class="${cls}"` : ''}><td>${label || show(a)}</td>${M.map(([f]) => cell(src[a][f], f)).join('')}${cell(src[a].mean, 'mean')}<td>${int(sum(a, 'cross'))}</td><td>${int(sum(a, 'thru'))}</td><td>${msf(med(a, 'ms'))}</td></tr>`;
    const sorted = others.slice().sort((x, y) => R[x].mean - R[y].mean);
    const head = `<thead><tr><th>Layout</th>${M.map(([, l]) => `<th>${l}</th>`).join('')}<th>Mean rank</th><th>Crossed links, total</th><th>Links through classes, total</th><th>Median time</th></tr></thead>`;
    const body = [TS, MY].sort((x, y) => R[x].mean - R[y].mean).map((a) => line(a, 'ours', R)).join('') + sorted.map((a, i) => line(a, i ? '' : 'split', R)).join('') + line(BR, 'autorow split', RB, 'Best Read (auto mode)');
    return { html: `<div class="tbl"><table>${head}<tbody>${body}</tbody></table></div>`, R, RB };
  }
  // the tabs: the five measures, then the same ranking with optional measures added
  function rankTabs(others) {
    const out = EXTRA.map((x) => ({ ...x, ...rankTable(others, x.m) }));
    const html = `<div class="rtabs" role="tablist">${out.map((x, i) => `<button role="tab" aria-selected="${i ? 'false' : 'true'}" data-i="${i}">${x.label}</button>`).join('')}</div>` +
      out.map((x, i) => `<div class="rpanel"${i ? ' hidden' : ''}>${x.note ? `<p class="rnote">${x.note}</p>` : ''}${x.html}</div>`).join('');
    return { html: `<div class="rgroup">${html}</div>`, tabs: out };
  }
  function perGraph() {
    const head = '<thead><tr><th>Graph</th><th>Classes</th><th>Links</th><th>Tidy Stress</th><th>Mycelium</th><th>Best Read</th><th>Best tuned open-source layout</th></tr></thead>';
    const ct = (r) => (r ? `${r.cross} / ${r.thru}` : '–');
    return `<div class="tbl"><table>${head}<tbody>${keys.map((k) => { const r0 = get(k, TS) || get(k, BR); const bo = TUNED.map((a) => get(k, a)).filter(Boolean).sort((x, y) => x.cross + x.thru - y.cross - y.thru || x.fill - y.fill)[0];
      return `<tr><td>${nameOf(k)}</td><td>${r0.n}</td><td>${r0.links}</td><td>${ct(get(k, TS))}</td><td>${ct(get(k, MY))}</td><td>${ct(get(k, BR))}</td><td>${bo ? show(bo.algo) + ' ' + ct(bo) : '–'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  const wins = () => { const w = {}; keys.forEach((k) => { const b = [BR, ...TUNED].map((a) => get(k, a)).filter(Boolean).sort((x, y) => x.cross + x.thru - y.cross - y.thru)[0]; if (b) w[show(b.algo)] = (w[show(b.algo)] || 0) + 1; }); return w; };
  const totals = () => Object.fromEntries([BR, TS, MY, ...TUNED, ...DEFAULTS].map((a) => [show(a) + (TUNED.includes(a) ? ' (tuned)' : ''), { cross: sum(a, 'cross'), thru: sum(a, 'thru'), fill: +med(a, 'fill').toFixed(1), ms: Math.round(med(a, 'ms')), maxMs: Math.round(maxOf(a, 'ms')), xang: +mean(a, 'xang').toFixed(1), down: +mean(a, 'down').toFixed(2) }]));
  return { get, sum, med, mean, rankTable, rankTabs, perGraph, wins, totals, keys };
}

const T = {}, P = {};
// the 15 development graphs
{
  const S = setOf(TRAIN_ROWS, ORDER.filter((k) => TRAIN_ROWS.some((r) => r.key === k)));
  const tuned = S.rankTabs(TUNED), def = S.rankTabs(DEFAULTS);
  T.TABLE_TUNED = tuned.html; T.TABLE_DEFAULT = def.html; T.TABLE_PERGRAPH = S.perGraph();
  // effect of the clean-up on each of our layouts
  const L = [['Tidy Stress', TS, 'Tidy Stress, no clean-up (ours)'], ['Mycelium', MY, 'Mycelium, no clean-up (ours)'], ['Best Read', BR, 'Best Read, no clean-up (ours)']];
  const head = '<thead><tr><th>Layout</th><th>Crossed links, total</th><th>Links through classes, total</th><th>Mean crossing angle</th><th>Mean angular resolution</th><th>Median area</th><th>Median time</th></tr></thead>';
  const pair = (a, b, f, fmt) => `${fmt(S.sum(b, f))} → <b>${fmt(S.sum(a, f))}</b>`;
  const pm = (a, b, f, fmt) => `${fmt(S.mean(b, f))} → <b>${fmt(S.mean(a, f))}</b>`;
  const pmed = (a, b, f, fmt) => `${fmt(S.med(b, f))} → <b>${fmt(S.med(a, f))}</b>`;
  T.TABLE_CLEANUP = `<div class="tbl"><table>${head}<tbody>${L.map(([n, a, b]) => `<tr class="ours"><td>${n}</td><td>${pair(a, b, 'cross', int)}</td><td>${pair(a, b, 'thru', int)}</td><td>${pm(a, b, 'xang', (x) => x.toFixed(0) + '°')}</td><td>${pm(a, b, 'angres', (x) => x.toFixed(2))}</td><td>${pmed(a, b, 'fill', n1)}</td><td>${pmed(a, b, 'ms', msf)}</td></tr>`).join('')}</tbody></table></div>`;
  L.forEach(([n, a, b]) => (P['cleanup ' + n] = { cross: [S.sum(b, 'cross'), S.sum(a, 'cross')], thru: [S.sum(b, 'thru'), S.sum(a, 'thru')], xang: [S.mean(b, 'xang'), S.mean(a, 'xang')], fill: [S.med(b, 'fill'), S.med(a, 'fill')], ms: [S.med(b, 'ms'), S.med(a, 'ms')] }));
  P.totals = S.totals();
  P.tunedRanks = Object.fromEntries(tuned.tabs.map((t) => [t.id, Object.fromEntries(Object.entries(t.R).map(([a, r]) => [show(a), +r.mean.toFixed(2)]))]));
  P.tunedRanksBR = Object.fromEntries(tuned.tabs.map((t) => [t.id, +t.RB[BR].mean.toFixed(2)]));
  P.tunedRanksDetail = Object.fromEntries(Object.entries(tuned.tabs[0].R).map(([a, r]) => [show(a), Object.fromEntries(Object.entries(r).map(([f, v]) => [f, +v.toFixed(2)]))]));
  P.defaultRanks = Object.fromEntries(Object.entries(def.tabs[0].R).map(([a, r]) => [show(a), +r.mean.toFixed(2)]));
  P.defaultRanksBR = +def.tabs[0].RB[BR].mean.toFixed(2);
  P.winsBRvsTuned = S.wins();
}
// graphs never seen during development: the held-out graphs and the public benchmark graphs
for (const [id, label, pick] of [['HELDOUT', 'heldout', (k) => k.startsWith('hx_')], ['PUBLIC', 'public', (k) => k.startsWith('pb_')], ['UNSEEN', 'unseen', (k) => /^(hx|pb)_/.test(k)]]) {
  const keys = [...new Set(UNSEEN_ROWS.map((r) => r.key))].filter(pick).filter((k) => UNSEEN_ROWS.some((r) => r.key === k && r.algo === BR) && UNSEEN_ROWS.some((r) => r.key === k && r.algo === TUNED[0]));
  if (!keys.length) continue;
  keys.sort((a, b) => (UNSEEN_ROWS.find((r) => r.key === a).n - UNSEEN_ROWS.find((r) => r.key === b).n) || a.localeCompare(b));
  const S = setOf(UNSEEN_ROWS, keys), tuned = S.rankTabs(TUNED);
  // the page shows one ranking over all unseen graphs, and the per-graph results of each set
  if (id === 'UNSEEN') T.TABLE_UNSEEN = tuned.html; else T['TABLE_' + id + '_PERGRAPH'] = S.perGraph();
  P[label] = { graphs: keys.length, totals: S.totals(), ranks: Object.fromEntries(tuned.tabs.map((t) => [t.id, Object.fromEntries(Object.entries(t.R).map(([a, r]) => [show(a), +r.mean.toFixed(2)]))])), ranksBR: Object.fromEntries(tuned.tabs.map((t) => [t.id, +t.RB[BR].mean.toFixed(2)])), wins: S.wins() };
}
fs.writeFileSync(new URL('tables.json', import.meta.url), JSON.stringify(T));
fs.writeFileSync(new URL('tables_numbers.json', import.meta.url), JSON.stringify(P, null, 1));
console.log(JSON.stringify(P, null, 1));
