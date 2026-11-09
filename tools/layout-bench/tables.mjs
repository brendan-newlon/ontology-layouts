// Builds the result tables of the write-up and prints the numbers the prose quotes.
//  - The 15 test graphs the layouts were developed on: results_tuned.json (one run each).
//  - Graphs never seen during development: the held-out graphs (models5.js, results_heldout.json) and the public benchmark
//    graphs (models6.js, results_public.json), with our rows from results_ours.json.
// Best Read is ranked against the open-source layouts in one pool; Tidy Stress and Mycelium each in a pool of their own.
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
  // one ranking table: Best Read against the open-source layouts, one pool, best mean rank first; then Tidy Stress and
  // Mycelium, each ranked on its own against the same layouts (its own pool of the same size), so every number is a rank
  // among the same number of layouts
  function rankTable(others, M) {
    const RB = ranks([BR, ...others], M), RT = ranks([TS, ...others], M), RM = ranks([MY, ...others], M);
    const pool = others.length + 1, ord = (i) => i + (i % 10 === 1 && i % 100 !== 11 ? 'st' : i % 10 === 2 && i % 100 !== 12 ? 'nd' : i % 10 === 3 && i % 100 !== 13 ? 'rd' : 'th');
    const best = Object.fromEntries([...M.map(([f]) => f), 'mean'].map((f) => [f, Math.min(...[BR, ...others].map((a) => RB[a][f]))]));
    const cell = (v, f, b) => `<td${b && Math.abs(v - b[f]) < 1e-9 ? ' class="best"' : ''}>${n1(v)}</td>`;
    const cols = (a, src, b) => M.map(([f]) => cell(src[a][f], f, b)).join('') + cell(src[a].mean, 'mean', b) + `<td>${int(sum(a, 'cross'))}</td><td>${int(sum(a, 'thru'))}</td><td>${msf(med(a, 'ms'))}</td>`;
    const sorted = [BR, ...others].sort((x, y) => RB[x].mean - RB[y].mean);
    const head = (first) => `<thead><tr><th>${first}</th><th>Layout</th>${M.map(([, l]) => `<th>${l}</th>`).join('')}<th>Mean rank</th><th>Crossed links, total</th><th>Links through classes, total</th><th>Median time</th></tr></thead>`;
    const body = sorted.map((a, i) => `<tr${a === BR ? ' class="ours"' : ''}><td>${i + 1}</td><td>${a === BR ? 'Best Read (ours)' : show(a)}</td>${cols(a, RB, best)}</tr>`).join('');
    const place = (R, a) => [a, ...others].sort((x, y) => R[x].mean - R[y].mean).indexOf(a) + 1;
    const body2 = [[TS, RT], [MY, RM]].map(([a, R]) => `<tr class="ours"><td>${ord(place(R, a))} of ${pool}</td><td>${show(a)}</td>${cols(a, R, null)}</tr>`).join('');
    const html = `<div class="tbl"><table>${head('Place')}<tbody>${body}</tbody></table></div>` +
      `<p class="rnote">Best Read draws with one of our two layouts. Each of them, ranked on its own against the same ${others.length} layouts:</p>` +
      `<div class="tbl"><table>${head('Place')}<tbody>${body2}</tbody></table></div>`;
    return { html, RB, RT, RM, R: Object.fromEntries([BR, TS, MY, ...others].map((a) => [a, a === TS ? RT[a] : a === MY ? RM[a] : RB[a]])), places: { [BR]: place(RB, BR), [TS]: place(RT, TS), [MY]: place(RM, MY) }, next: sorted.find((a) => a !== BR) };
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
  P.tunedPlaces = Object.fromEntries(tuned.tabs.map((t) => [t.id, { ...Object.fromEntries(Object.entries(t.places).map(([a, v]) => [show(a), v])), next: show(t.next), nextRank: +t.RB[t.next].mean.toFixed(2) }]));
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
  P[label] = { graphs: keys.length, totals: S.totals(), ranks: Object.fromEntries(tuned.tabs.map((t) => [t.id, Object.fromEntries(Object.entries(t.R).map(([a, r]) => [show(a), +r.mean.toFixed(2)]))])), ranksBR: Object.fromEntries(tuned.tabs.map((t) => [t.id, +t.RB[BR].mean.toFixed(2)])), places: Object.fromEntries(tuned.tabs.map((t) => [t.id, { ...Object.fromEntries(Object.entries(t.places).map(([a, v]) => [show(a), v])), next: show(t.next), nextRank: +t.RB[t.next].mean.toFixed(2) }])), wins: S.wins() };
}
// Top-down drawings (results_topdown.json, from topdown.mjs) against the layered layouts, which were given subclass links
// oriented parent to child: on the development graphs the runs kept to top-down settings, on the others the tuned runs.
{
  const TD = read('results_topdown.json'), OURS_ROWS = [...latestOurs.values()];
  const sets = [['15 development graphs', ORDER, TRAIN_ROWS, [['ELK layered, top-down (tuned)', 'ELK layered, tuned'], ['dagre, top-down (tuned)', 'dagre, tuned'], ['WebCola, top-down (constrained)', 'WebCola, constrained']]],
    ['10 held-out graphs', (k) => k.startsWith('hx_'), read('results_heldout.json'), [['ELK layered (tuned)', 'ELK layered, tuned'], ['dagre (tuned)', 'dagre, tuned']]],
    ['26 public graphs', (k) => k.startsWith('pb_'), read('results_public.json'), [['ELK layered (tuned)', 'ELK layered, tuned'], ['dagre (tuned)', 'dagre, tuned']]]];
  const ourTD = [['Best Read, top-down (ours)', 'Best Read, top-down'], ['Tidy Stress, top-down (ours)', 'Tidy Stress, top-down'], ['Tree (ours)', 'Tree']];
  const med = (v) => { v = v.slice().sort((x, y) => x - y); return v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
  let body = '', nums = {};
  for (const [label, pick, rows, theirs] of sets) {
    const keys = Array.isArray(pick) ? pick : [...new Set(TD.map((r) => r.key))].filter(pick);
    const line = (name, rs, cls) => { if (rs.length < keys.length) return null; const sub = rs.filter((r) => r.down != null);
      return { name, cls, down: sub.reduce((a, r) => a + r.down, 0) / sub.length, cross: rs.reduce((a, r) => a + r.cross, 0), thru: rs.reduce((a, r) => a + r.thru, 0), fill: med(rs.map((r) => r.fill)), ms: med(rs.map((r) => r.ms)) }; };
    const L = [...ourTD.map(([a, n]) => line(n, keys.map((k) => TD.find((r) => r.key === k && r.algo === a)).filter(Boolean), 'ours')),
      ...theirs.map(([a, n]) => line(n, keys.map((k) => rows.find((r) => r.key === k && r.algo === a)).filter(Boolean), '')),
      line('Best Read, not top-down (for reference)', keys.map((k) => OURS_ROWS.find((r) => r.key === k && r.algo === BR) || TRAIN_ROWS.find((r) => r.key === k && r.algo === BR)).filter(Boolean), 'ref')].filter(Boolean);
    const td = L.filter((l) => l.cls !== 'ref'), bc = Math.min(...td.map((l) => l.cross)), bt = Math.min(...td.map((l) => l.thru)), bf = Math.min(...td.map((l) => l.fill));
    nums[label] = Object.fromEntries(L.map((l) => [l.name, { down: +(l.down * 100).toFixed(0), cross: l.cross, thru: l.thru, fill: +l.fill.toFixed(1), ms: Math.round(l.ms) }]));
    body += L.map((l, i) => `<tr class="${[l.cls === 'ours' ? 'ours' : '', i === 0 && body ? 'split' : ''].join(' ').trim()}"><td>${i ? '' : label}</td><td>${l.name}</td><td>${Math.round(l.down * 100)}%</td>` +
      `<td${l.cls !== 'ref' && l.cross === bc ? ' class="best"' : ''}>${int(l.cross)}</td><td${l.cls !== 'ref' && l.thru === bt ? ' class="best"' : ''}>${int(l.thru)}</td><td${l.cls !== 'ref' && l.fill === bf ? ' class="best"' : ''}>${n1(l.fill)}</td><td>${msf(l.ms)}</td></tr>`).join('');
  }
  T.TABLE_TOPDOWN = `<div class="tbl"><table><thead><tr><th>Graphs</th><th>Layout</th><th>Subclass links pointing down</th><th>Crossed links, total</th><th>Links through classes, total</th><th>Median area</th><th>Median time</th></tr></thead><tbody>${body}</tbody></table></div>`;
  P.topdown = nums;
}
fs.writeFileSync(new URL('tables.json', import.meta.url), JSON.stringify(T));
fs.writeFileSync(new URL('tables_numbers.json', import.meta.url), JSON.stringify(P, null, 1));
console.log(JSON.stringify(P, null, 1));
