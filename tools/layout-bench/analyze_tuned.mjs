// Summarises results_tuned.json (recorded by contenders.html, all layouts, default and tuned settings, seed 1):
//  1. how much tuning helped each open-source layout;
//  2. average rank on each standard measure, ours against the tuned open-source layouts;
//  3. the layouts that draw subclass links top-down, compared with each other.
// Run: node analyze_tuned.mjs
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync(new URL('results_tuned.json', import.meta.url), 'utf8')).filter((r) => !r.error);
const keys = [...new Set(rows.map((r) => r.key))];
const get = (k, a) => rows.find((r) => r.key === k && r.algo === a);
const MEAS = [
  ['score', 'Readability score', 1], ['cross', 'Crossed links', 1], ['thru', 'Links through classes', 1], ['fill', 'Area', 1],
  ['nstress', 'Distance fidelity (stress)', 1], ['elcv', 'Even link lengths', 1], ['xang', 'Crossing angle', -1], ['angres', 'Angular resolution', -1], ['down', 'Top-down subclass links', -1]
];
const STD = ['cross', 'thru', 'fill', 'nstress', 'elcv', 'xang', 'angres'];
function ranks(pool, measures) {
  const R = Object.fromEntries(pool.map((a) => [a, {}])), cnt = {};
  for (const [f, , dir] of measures) for (const k of keys) {
    const rs = pool.map((a) => [a, get(k, a)]).filter(([, r]) => r && r[f] != null);
    if (rs.length < pool.length) continue;
    rs.sort((x, y) => dir * (x[1][f] - y[1][f]));
    // ties share the mean of their places
    for (let i = 0; i < rs.length;) { let j = i; while (j + 1 < rs.length && Math.abs(rs[j + 1][1][f] - rs[i][1][f]) < 1e-9) j++; for (let t = i; t <= j; t++) R[rs[t][0]][f] = (R[rs[t][0]][f] || 0) + (i + j) / 2 + 1; i = j + 1; }
    cnt[f] = (cnt[f] || 0) + 1;
  }
  for (const a of pool) for (const f in R[a]) R[a][f] /= cnt[f];
  for (const a of pool) R[a].std = STD.reduce((s, f) => s + (R[a][f] || 0), 0) / STD.length;
  return { R, cnt };
}
const algos = [...new Set(rows.map((r) => r.algo))];
const pad = (s, n) => String(s).padEnd(n);
const fmt = (x) => (x == null ? '–' : x.toFixed(1));
// 1. tuning
console.log('\n1. Tuning: median readability score and total crossed + through links over', keys.length, 'graphs, default -> tuned');
for (const a of algos.filter((x) => / \(tuned\)$/.test(x) && !/top-down/.test(x))) {
  const base = a.replace(' (tuned)', '') === 'dagre' ? 'dagre (layered)' : a.replace(' (tuned)', '');
  const ct = (al) => keys.reduce((s, k) => { const r = get(k, al); return s + (r ? r.cross + r.thru : 0); }, 0);
  const med = (al) => { const v = keys.map((k) => get(k, al)).filter(Boolean).map((r) => r.score).sort((x, y) => x - y); return Math.round(v[v.length >> 1]); };
  console.log(pad(base, 18), 'score', med(base), '->', med(a), ' crossed+through', ct(base), '->', ct(a));
}
// 2. ours against tuned
const pool = ['Tidy Stress (ours)', 'Mycelium (ours)', ...algos.filter((x) => / \(tuned\)$/.test(x) && !/top-down/.test(x))];
const { R } = ranks(pool, MEAS.filter(([f]) => f !== 'down'));
console.log('\n2. Average rank among', pool.length, 'layouts (1 = best), ours against the tuned open-source layouts');
console.log(pad('', 26) + MEAS.filter(([f]) => f !== 'down').map(([f]) => pad(f, 8)).join('') + 'std-mean');
pool.slice().sort((a, b) => R[a].score - R[b].score).forEach((a) => console.log(pad(a, 26) + MEAS.filter(([f]) => f !== 'down').map(([f]) => pad(fmt(R[a][f]), 8)).join('') + fmt(R[a].std)));
// 3. top-down layouts
const td = ['Tidy Stress, top-down (ours, experiment)', 'Best Read, top-down (ours, experiment)', 'WebCola, top-down (constrained)', 'ELK layered, top-down (tuned)', 'dagre, top-down (tuned)'];
const T = ranks(td, MEAS);
console.log('\n3. Top-down layouts: average rank among', td.length);
console.log(pad('', 42) + MEAS.map(([f]) => pad(f, 8)).join('') + 'std-mean');
td.slice().sort((a, b) => T.R[a].score - T.R[b].score).forEach((a) => console.log(pad(a, 42) + MEAS.map(([f]) => pad(fmt(T.R[a][f]), 8)).join('') + fmt(T.R[a].std)));
// raw means of the top-down share, and of the cost of top-down for ours
const mean = (a, f) => { const v = keys.map((k) => get(k, a)).filter((r) => r && r[f] != null); return v.reduce((s, r) => s + r[f], 0) / v.length; };
console.log('\nmean top-down share:', algos.map((a) => a.replace(/ \(.*\)/, '') + ' ' + (mean(a, 'down') * 100).toFixed(0) + '%').join(', '));
console.log('mean score, ours vs ours top-down:', Math.round(mean('Best Read (ours)', 'score')), Math.round(mean('Best Read, top-down (ours, experiment)', 'score')), '| Tidy Stress', Math.round(mean('Tidy Stress (ours)', 'score')), Math.round(mean('Tidy Stress, top-down (ours, experiment)', 'score')));
// per graph winners on the score among pool
const wins = {}; keys.forEach((k) => { const b = pool.map((a) => get(k, a)).filter(Boolean).sort((x, y) => x.score - y.score)[0]; wins[b.algo] = (wins[b.algo] || 0) + 1; });
console.log('score wins among the pool:', JSON.stringify(wins));
const winsX = {}; keys.forEach((k) => { const b = pool.map((a) => get(k, a)).filter(Boolean).sort((x, y) => x.cross + x.thru - y.cross - y.thru)[0]; winsX[b.algo] = (winsX[b.algo] || 0) + 1; });
console.log('fewest crossed + through links, wins among the pool:', JSON.stringify(winsX));
fs.writeFileSync(new URL('tuned_summary.json', import.meta.url), JSON.stringify({ keys, pool, ranks: R, topdown: td, topdownRanks: T.R, wins, winsX, means: Object.fromEntries(algos.map((a) => [a, Object.fromEntries(['score', 'cross', 'thru', 'fill', 'nstress', 'elcv', 'xang', 'angres', 'down', 'ms'].map((f) => [f, mean(a, f)]))])) }, null, 1));
