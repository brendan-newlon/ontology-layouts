// Drawing size, crossings and links through classes per named graph after Best Read and the clean-up: node boxes.mjs <keys> [tuneJSON]
const { MODELS, OURS: O } = await import('./_bundle.mjs');
const keys = process.argv[2].split(','), tune = JSON.parse(process.argv[3] || '{}'); Object.assign(O.tune, tune);
for (const key of keys) {
  const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 })), N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 }));
  const edges = M.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]);
  const w0 = O.now(), r = O.auto(D, edges, { seed: 1 }); let P = r.pos.map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200);
  P = O.cleanUp(P, D, edges, w0, false); O.sep(P, N, 6, 200);
  let x1 = 1e9, x2 = -1e9, y1 = 1e9, y2 = -1e9; P.forEach((p, i) => { x1 = Math.min(x1, p.x - D[i].w / 2); x2 = Math.max(x2, p.x + D[i].w / 2); y1 = Math.min(y1, p.y - D[i].h / 2); y2 = Math.max(y2, p.y + D[i].h / 2); });
  const m = O.routeMetrics(P, D, edges, edges.map(() => null));
  const hi = M.labels.indexOf('HormoneSignaling'); let hs = '';
  if (hi >= 0) { const e = edges.find((e) => e[0] === hi || e[1] === hi), o = e[0] === hi ? e[1] : e[0]; hs = ` HormoneSignaling link ${Math.round(Math.hypot(P[hi].x - P[o].x, P[hi].y - P[o].y))} px to ${M.labels[o]}`; }
  console.log(key.padEnd(12), r.algo, `${Math.round(x2 - x1)}x${Math.round(y2 - y1)}`, 'cross', m.cross, 'thru', m.thru + hs);
}
