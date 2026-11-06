// Experiment: instead of moving classes off links, bend links around the classes they run through (one or two bends at padded box corners).
// Compares: layout as shipped (moves, straight links) vs the same layout without the move step plus bends.
// Run: node route.mjs [models] — prints crossings, links through classes, bends and area for both.
import { execSync } from 'node:child_process';
execSync('node build_base.mjs'); execSync('node mkbundle.mjs');
const { MODELS, OURS, EXP3, _ogClSegBox } = await import('./_bundle.mjs?' + Date.now());
const segX = OURS.segX;
const dims = (labels) => labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 }));
// polylines: route[k] = [p0, ..., pn]; crossings between segments of links that share no end; thru = segment through a box not its end's
function pm(P, B, EE, R) {
  const segs = EE.map((e, k) => { const pts = R[k]; const s = []; for (let i = 0; i < pts.length - 1; i++) s.push([pts[i], pts[i + 1]]); return s; });
  let cross = 0, thru = 0, bends = 0;
  for (let a = 0; a < EE.length; a++) {
    bends += R[a].length - 2;
    for (let b = a + 1; b < EE.length; b++) {
      const e = EE[a], f = EE[b]; if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue;
      let c = 0; for (const [p, q] of segs[a]) for (const [r, s] of segs[b]) if (segX(p, q, r, s)) c++; cross += c;
    }
    for (let i = 0; i < P.length; i++) { if (i === EE[a].s || i === EE[a].t) continue; if (segs[a].some(([p, q]) => _ogClSegBox(p.x - P[i].x, p.y - P[i].y, q.x - P[i].x, q.y - P[i].y, B[i].w / 2 + 6, B[i].h / 2 + 6))) thru++; }
  }
  let x1 = 1e9, x2 = -1e9, y1 = 1e9, y2 = -1e9, ba = 0;
  P.forEach((p, i) => { x1 = Math.min(x1, p.x - B[i].w / 2); x2 = Math.max(x2, p.x + B[i].w / 2); y1 = Math.min(y1, p.y - B[i].h / 2); y2 = Math.max(y2, p.y + B[i].h / 2); ba += (B[i].w + 10) * (B[i].h + 6); });
  R.forEach((pts) => pts.forEach((p) => { x1 = Math.min(x1, p.x); x2 = Math.max(x2, p.x); y1 = Math.min(y1, p.y); y2 = Math.max(y2, p.y); }));
  return { cross, thru, bends, fill: (x2 - x1) * (y2 - y1) / ba };
}
// route each link that runs through a box: try one bend at any padded corner of a box it hits, then two bends; keep the best
function routeAll(P, B, EE) {
  const R = EE.map((e) => [P[e.s], P[e.t]]);
  const hits = (pts, k) => { let h = 0; const e = EE[k]; for (let i = 0; i < P.length; i++) { if (i === e.s || i === e.t) continue; for (let j = 0; j < pts.length - 1; j++) if (_ogClSegBox(pts[j].x - P[i].x, pts[j].y - P[i].y, pts[j + 1].x - P[i].x, pts[j + 1].y - P[i].y, B[i].w / 2 + 6, B[i].h / 2 + 6)) { h++; break; } } return h; };
  const crossK = (pts, k) => { let c = 0; const e = EE[k]; for (let b = 0; b < EE.length; b++) { if (b === k) continue; const f = EE[b]; if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue; const q = R[b]; for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < q.length - 1; j++) if (segX(pts[i], pts[i + 1], q[j], q[j + 1])) c++; } return c; };
  for (let k = 0; k < EE.length; k++) {
    const e = EE[k], h0 = hits(R[k], k); if (!h0) continue;
    const corners = [];
    for (let i = 0; i < P.length; i++) { if (i === e.s || i === e.t) continue; if (!_ogClSegBox(P[e.s].x - P[i].x, P[e.s].y - P[i].y, P[e.t].x - P[i].x, P[e.t].y - P[i].y, B[i].w / 2 + 6, B[i].h / 2 + 6)) continue; for (const sx of [-1, 1]) for (const sy of [-1, 1]) corners.push({ x: P[i].x + sx * (B[i].w / 2 + 14), y: P[i].y + sy * (B[i].h / 2 + 12) }); }
    let best = { pts: R[k], cost: 10 * crossK(R[k], k) + 8 * h0 };
    for (const c of corners) { const pts = [P[e.s], c, P[e.t]]; const cost = 10 * crossK(pts, k) + 8 * hits(pts, k) + 3; if (cost < best.cost) best = { pts, cost }; }
    if (best.cost > 3) for (const c of corners) for (const d of corners) { if (c === d) continue; const pts = [P[e.s], c, d, P[e.t]]; const cost = 10 * crossK(pts, k) + 8 * hits(pts, k) + 6; if (cost < best.cost) best = { pts, cost }; }
    R[k] = best.pts;
  }
  return R;
}
const keys = (process.argv[2] || 'uni,trial,org,brewery,prov,sosa,crm,supply,retail,schema,fibo,telecom,pizza,bio,big').split(',');
const tot = { a: { cross: 0, thru: 0, bends: 0, fill: 0 }, b: { cross: 0, thru: 0, bends: 0, fill: 0 }, c: { cross: 0, thru: 0, bends: 0, fill: 0 } };
for (const key of keys) {
  const M = await MODELS[key].load(), D = dims(M.labels), items = D.map((d) => ({ w: d.w, h: d.h }));
  const edges = M.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), EE = edges.map(([s, t]) => ({ s, t }));
  const run = (fn) => { const P = fn(items, edges, { seed: 1 }).pos.map((p) => ({ ...p })); OURS.sep(P, D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 200); return P; };
  const Pa = run(OURS.auto), Pb = run(EXP3.autoNT);
  const a = pm(Pa, D, EE, EE.map((e) => [Pa[e.s], Pa[e.t]])), b = pm(Pb, D, EE, routeAll(Pb, D, EE)), c = pm(Pa, D, EE, routeAll(Pa, D, EE));
  console.log(key.padEnd(8), 'moves:', JSON.stringify(a), '| no moves + bends:', JSON.stringify(b), '| moves + bends:', JSON.stringify(c));
  for (const [t, m] of [['a', a], ['b', b], ['c', c]]) for (const f in m) tot[t][f] += m[f] / keys.length;
}
console.log('mean', JSON.stringify(tot));
