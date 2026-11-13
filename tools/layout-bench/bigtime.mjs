// Does Best Read draw a very large graph better when it is given more time? Runs Best Read with the clean-up (as ours_rows.mjs)
// at several time limits and counts each drawing with HandTidy.measure, the counter of the scale table (measure_big.mjs).
// node bigtime.mjs [keys, default pb_cl] [limits in ms, default 1500,6000,24000,60000]   (run mkbundle.mjs first)
const { MODELS, OURS: O } = await import('./_bundle.mjs');
await import('./handtidy.js');
const HT = globalThis.HandTidy;
const keys = (process.argv[2] || 'pb_cl').split(','), limits = (process.argv[3] || '1500,6000,24000,60000').split(',').map(Number);
for (const key of keys) {
  const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 })), items = D.map((d) => ({ w: d.w, h: d.h }));
  const edges = M.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), E = edges.map(([s, t]) => ({ s, t }));
  const N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 }));
  for (const lim of limits) {
    O.setTimeLimit(lim);
    const t0 = performance.now(), c0 = O.now(), r = O.auto(items, edges, { seed: 1 }), P = r.pos.map((p) => ({ x: p.x, y: p.y }));
    O.sep(P, N, 6, 200); const tl = performance.now() - t0;
    const Q = O.cleanUp(P, items, edges, c0, r.algo === 'tree').map((p) => ({ x: p.x, y: p.y })); O.sep(Q, N, 6, 200);
    const ms = performance.now() - t0, m = HT.measure(Q, D.map((d) => ({ w: d.w, h: 20 })), E), ml = HT.measure(P, D.map((d) => ({ w: d.w, h: 20 })), E);
    console.log(`${key} limit ${lim} ms: ${r.algo} | layout ${(tl / 1000).toFixed(1)} s cross ${ml.cross} thru ${ml.thru} | +clean-up ${(ms / 1000).toFixed(1)} s cross ${m.cross} thru ${m.thru} sum ${m.cross + m.thru} area ${m.area}`);
  }
}
O.setTimeLimit(1500);
