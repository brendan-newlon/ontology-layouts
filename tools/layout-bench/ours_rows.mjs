// Our three layouts as contenders.html runs them (withCleanUp), measured as runOne measures, in Node at native speed.
// node ours_rows.mjs <key prefix or comma list> <out.json> [seed]   (run mkbundle.mjs first)
import fs from 'node:fs';
const { MODELS, OURS: O } = await import('./_bundle.mjs');
const stdMetrics = new Function(fs.readFileSync(new URL('./stdmetrics.js', import.meta.url), 'utf8') + '\nreturn stdMetrics;')();
const arg = process.argv[2], seed = +(process.argv[4] || 1);
const keys = arg.includes(',') ? arg.split(',') : Object.keys(MODELS).filter((k) => k.startsWith(arg));
const withCleanUp = (f) => (it, ed, s, N) => { const t0 = O.now(), P = f(it, ed, s).map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200); return O.cleanUp(P, it, ed, t0); };
const ALGOS = {
  'Tidy Stress (ours)': withCleanUp((it, ed, s) => O.compact(it, ed, { seed: s }).pos),
  'Mycelium (ours)': withCleanUp((it, ed, s) => (O.grouped2(it, ed, { seed: s }) || O.compact(it, ed, { seed: s })).pos),
  'Best Read (ours)': withCleanUp((it, ed, s) => O.auto(it, ed, { seed: s }).pos),
  'Tidy Stress, no clean-up (ours)': (it, ed, s) => O.compact(it, ed, { seed: s }).pos,
  'Mycelium, no clean-up (ours)': (it, ed, s) => (O.grouped2(it, ed, { seed: s }) || O.compact(it, ed, { seed: s })).pos,
  'Best Read, no clean-up (ours)': (it, ed, s) => O.auto(it, ed, { seed: s }).pos
};
const rows = [];
for (const key of keys) {
  const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 })), items = D.map((d) => ({ w: d.w, h: d.h }));
  const edges = M.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), E = edges.map(([s, t]) => ({ s, t }));
  const N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 }));
  for (const [algo, f] of Object.entries(ALGOS)) {
    const t0 = performance.now(); let P = f(items, edges, seed, N); const ms = performance.now() - t0;
    P = P.map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200);
    const m = O.pmetrics(P, D.map((d) => ({ w: d.w + 6, h: d.h + 6 })), E), ml = O.pmetrics(P, N, E);
    rows.push({ key, algo, seed, n: N.length, links: E.length, cross: m.cross, thru: m.thru, near: m.near, len: m.len, fill: ml.fill, lout: ml.lout, ov: ml.ov, score: O.pscore(ml), ms,
      ...stdMetrics(P, M.edges.filter((e) => e.s !== e.t).map((e) => ({ s: e.s, t: e.t, sub: e.kind === 'sub' }))),
      pos: P.map((q) => [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10]), labels: M.labels, edges: M.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 1 : 0]), box: D.map((d) => d.w) });
  }
  console.log(key, rows.slice(-6, -3).map((r) => r.algo.split(' ')[0] + ' x' + r.cross + ' th' + r.thru + ' ' + Math.round(r.ms) + 'ms').join(' | '));
}
fs.writeFileSync(process.argv[3], JSON.stringify(rows));

