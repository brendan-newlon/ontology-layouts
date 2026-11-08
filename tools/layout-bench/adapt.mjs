// Experiment: ideas from the chemotaxis proposals as settings of our own layouts (halo around classes that hide one-link classes, fewer stress sweeps).
//   node adapt.mjs '<tune JSON>' <sets: dev,held,public> -> one summary line per layout (with the clean-up as the library runs it)
import fs from 'node:fs';
const { MODELS, OURS: O } = await import('./_bundle.mjs');
const tune = JSON.parse(process.argv[2] || '{}'); Object.assign(O.tune, tune);
const SETS = { dev: ['prov', 'uni', 'hotel', 'org', 'brewery', 'trial', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'], held: ['hx_small', 'hx_mesh', 'hx_rome40', 'hx_rings', 'hx_hubs', 'hx_md70', 'hx_rome90', 'hx_tax', 'hx_md160', 'hx_md300'], public: ['pb_foaf', 'pb_time', 'pb_bfo', 'pb_dul', 'pb_saref', 'pb_gr', 'pb_rome1233', 'pb_rome7797'] };
const withClean = (f) => (it, ed, s, N) => { const t0 = O.now(), r = f(it, ed, s), P = (r.pos || r).map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200); return O.cleanUp(P, it, ed, t0, r.algo === 'tree'); };
const ALGOS = { 'Tidy Stress': withClean((it, ed, s) => O.compact(it, ed, { seed: s }).pos), 'Mycelium': withClean((it, ed, s) => (O.grouped2(it, ed, { seed: s }) || O.compact(it, ed, { seed: s })).pos), 'Best Read': withClean((it, ed, s) => O.auto(it, ed, { seed: s })),
  'Best Read, no clean-up': (it, ed, s) => O.auto(it, ed, { seed: s }).pos, 'Mycelium, no clean-up': (it, ed, s) => (O.grouped2(it, ed, { seed: s }) || O.compact(it, ed, { seed: s })).pos };
for (const set of process.argv[3].split(',')) {
  const tot = {};
  for (const key of SETS[set]) {
    const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 })), items = D.map((d) => ({ ...d })), N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 }));
    const edges = M.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), E = edges.map(([s, t]) => ({ s, t }));
    for (const [name, f] of Object.entries(ALGOS).filter(([k]) => !process.env.ONLY || process.env.ONLY.split(',').includes(k))) {
      const t0 = performance.now(); let P = f(items, edges, +(process.argv[4] || 1), N); const ms = performance.now() - t0; P = P.map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200);
      const m = O.pmetrics(P, D.map((d) => ({ w: d.w + 6, h: d.h + 6 })), E), ml = O.pmetrics(P, N, E), t = (tot[name] ||= { cross: 0, thru: 0, area: 0, ms: 0, score: 0 });
      t.cross += m.cross; t.thru += m.thru; t.area += ml.area / 1e6; t.ms += ms; t.score += O.pscore(ml);
    }
  }
  for (const [name, t] of Object.entries(tot)) console.log(JSON.stringify(tune).padEnd(34), set.padEnd(6), name.padEnd(24), 'x', String(t.cross).padStart(5), 'th', String(t.thru).padStart(4), 'A', t.area.toFixed(1).padStart(6), 'score', Math.round(t.score), 'ms', Math.round(t.ms));
}
