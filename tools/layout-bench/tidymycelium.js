// Experiment (2026-11-14): "Tidy Mycelium", one layout instead of Best Read's several. Appended to the bundle by tmbench.mjs,
// so it uses the library's own steps (_og…). Not part of the library.
//   1. hanging units: every part that hangs off the rest by one class (a leaf, a chain, a small tree, a triangle or loop, a
//      small cluster) is set aside, up to K classes; its anchor remembers how many units and how many classes it hides;
//   2. Mycelium on the core: Louvain groups (shorter links inside, longer between), hub rings, and room reserved round each
//      anchor in proportion to what it hides (stress distances grow by R(i) + R(j));
//   3. clean-up of the core (fewer crossings, classes off links);
//   4. units placed largest first, each into the most open slice round its anchor (rays cast through the drawing so far;
//      large units prefer slices that open to the outside), laid out radially in that slice; single leaves by the library's
//      leaf placement;
//   5. classes off links, boxes apart; then (in tmbench) the library's clean-up, pull-in and routing as for Best Read.
//   6. after the clean-up: empty space taken in (_tmCompact), each class with what hangs from it stepping inward while that adds no problem.
const _TM_DEF = { K: 8, Kfrac: 0.25, L: 150, Lbig: 260, pods: 1.6, podIn: 1.6, hub: 20, room: 1, roomMode: 'add', cntW: 0.5, linkShare: 0.5,
  restarts: 8, sweeps: 240, finCross: true, finThru: true, coreTight: false, endTight: true, endTightR: 2, unitGap: 0.75, dirs: 36, outward: 0.5,
  budget: 1000, singlesBySlice: false, shrink: 'strict', shrinkMs: 150, shrinkF: 0.88, shrinkSlack: 0.06, hubBig: 20, tries: 1, triesMs: 400, grid: true, coreRoom: 0.25, denseCore: 2.7, budgetBig: 0 };

function _tmUnits(n, EE, K, Kfrac) {
  const adj = Array.from({ length: n }, () => []), seen = new Set();
  EE.forEach((e) => { const k = Math.min(e.s, e.t) + ',' + Math.max(e.s, e.t); if (e.s === e.t || seen.has(k)) return; seen.add(k); adj[e.s].push(e.t); adj[e.t].push(e.s); });
  const comp = new Int32Array(n).fill(-1), comps = [];
  for (let s = 0; s < n; s++) if (comp[s] < 0) { const q = [s]; comp[s] = comps.length; for (let i = 0; i < q.length; i++) for (const w of adj[q[i]]) if (comp[w] < 0) { comp[w] = comps.length; q.push(w); } comps.push(q); }
  const disc = new Int32Array(n).fill(-1), low = new Int32Array(n), par = new Int32Array(n).fill(-1), sub = new Int32Array(n), kids = Array.from({ length: n }, () => []);
  let time = 0;
  const roots = comps.map((c) => c.reduce((b, v) => (adj[v].length > adj[b].length ? v : b), c[0]));
  for (const r of roots) {
    const st = [[r, 0]]; disc[r] = low[r] = time++;
    while (st.length) {
      const top = st[st.length - 1], v = top[0];
      if (top[1] < adj[v].length) { const w = adj[v][top[1]++];
        if (disc[w] < 0) { par[w] = v; kids[v].push(w); disc[w] = low[w] = time++; st.push([w, 0]); } else if (w !== par[v]) low[v] = Math.min(low[v], disc[w]);
      } else { st.pop(); sub[v] += 1; if (par[v] >= 0) { low[par[v]] = Math.min(low[par[v]], low[v]); sub[par[v]] += sub[v]; } }
    }
  }
  const unitOf = new Int32Array(n).fill(-1), units = [];
  const collect = (c) => { const out = [c]; for (let i = 0; i < out.length; i++) out.push(...kids[out[i]]); return out; };
  comps.forEach((cc, k) => {
    if (cc.length < 4) return;
    const lim = Math.max(1, Math.min(K, Math.floor(cc.length * Kfrac))), st = [roots[k]];
    while (st.length) { const v = st.pop();
      for (const c of kids[v]) {
        if (low[c] >= disc[v] && sub[c] <= lim) { const nodes = collect(c), id = units.length; nodes.forEach((u) => (unitOf[u] = id)); units.push({ anchor: v, nodes }); }
        else st.push(c);
      }
    }
  });
  return { unitOf, units, adj };
}

// A grid over the drawing for the slice search: each cell lists the boxes (grown by pad) and links that touch it, so a ray
// only tests what lies in the cells it passes (cells walked exactly, so a crossing point is always in a cell both pass).
function _tmWalk(ax, ay, bx, by, cs, f) {
  let x = Math.floor(ax / cs), y = Math.floor(ay / cs); const X = Math.floor(bx / cs), Y = Math.floor(by / cs), dx = bx - ax, dy = by - ay;
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, tdx = dx ? Math.abs(cs / dx) : Infinity, tdy = dy ? Math.abs(cs / dy) : Infinity;
  let tmx = dx ? (sx > 0 ? (x + 1) * cs - ax : ax - x * cs) / Math.abs(dx) : Infinity, tmy = dy ? (sy > 0 ? (y + 1) * cs - ay : ay - y * cs) / Math.abs(dy) : Infinity, t = 0;
  for (let g = 0; g < 1e5; g++) { if (f(x, y, t) === false) return; if (x === X && y === Y) return; if (tmx < tmy) { t = tmx; tmx += tdx; x += sx; } else { t = tmy; tmy += tdy; y += sy; } }
}
function _tmGrid(cs, pad) {
  const cells = new Map(), key = (x, y) => x * 73856093 ^ y * 19349663, G = { cs, pad, boxes: [], segs: [], stamp: 0 };
  const at = (x, y, mk) => { const k = key(x, y); let c = cells.get(k); if (!c && mk) { c = { b: [], s: [] }; cells.set(k, c); } return c; };
  G.addBox = (v, p, d) => { const i = G.boxes.length; G.boxes.push({ v, x: p.x, y: p.y, hw: d.w / 2 + pad, hh: d.h / 2 + pad, mark: 0 });
    for (let x = Math.floor((p.x - d.w / 2 - pad) / cs); x <= Math.floor((p.x + d.w / 2 + pad) / cs); x++) for (let y = Math.floor((p.y - d.h / 2 - pad) / cs); y <= Math.floor((p.y + d.h / 2 + pad) / cs); y++) at(x, y, true).b.push(i); };
  G.addSeg = (A, B, s, t) => { const i = G.segs.length; G.segs.push({ A: { x: A.x, y: A.y }, B: { x: B.x, y: B.y }, s, t, mark: 0 }); _tmWalk(A.x, A.y, B.x, B.y, cs, (x, y) => { at(x, y, true).s.push(i); }); };
  // free length from p along (ux, uy), at most cap; boxes of skipV and links with an end at skipV do not count
  G.ray = (p, ux, uy, cap, skipV) => {
    const st = ++G.stamp, q = { x: p.x + ux * cap, y: p.y + uy * cap }; let best = cap;
    _tmWalk(p.x, p.y, q.x, q.y, cs, (x, y, t) => {
      if (t * cap > best + 1) return false;
      const c = at(x, y, false); if (!c) return;
      for (const i of c.b) { const b = G.boxes[i]; if (b.mark === st || b.v === skipV) continue; b.mark = st;
        let t0 = 0, t1 = cap;
        for (const [o, d, lo, hi] of [[p.x, ux, b.x - b.hw, b.x + b.hw], [p.y, uy, b.y - b.hh, b.y + b.hh]]) {
          if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = 1; t1 = 0; } continue; }
          let a = (lo - o) / d, e = (hi - o) / d; if (a > e) { const z = a; a = e; e = z; } t0 = Math.max(t0, a); t1 = Math.min(t1, e); }
        if (t0 <= t1 && t0 < best) best = t0; }
      for (const i of c.s) { const g = G.segs[i]; if (g.mark === st || g.s === skipV || g.t === skipV) continue; g.mark = st;
        const A = g.A, B = g.B, rx = q.x - p.x, ry = q.y - p.y, sx = B.x - A.x, sy = B.y - A.y, den = rx * sy - ry * sx; if (Math.abs(den) < 1e-9) continue;
        const tt = ((A.x - p.x) * sy - (A.y - p.y) * sx) / den, u = ((A.x - p.x) * ry - (A.y - p.y) * rx) / den;
        if (tt > 1e-6 && tt <= 1 && u >= 0 && u <= 1) best = Math.min(best, tt * cap); }
    });
    return best;
  };
  return G;
}

// (brute-force version of G.ray, for checking) free length along a ray from p in direction (ux, uy): to the first box (grown by pad) or link it meets, at most cap
function _tmRay(p, ux, uy, cap, P, N, placed, segs, skipV, pad) {
  let best = cap; const q = { x: p.x + ux * cap, y: p.y + uy * cap };
  for (let v = 0; v < P.length; v++) {
    if (!placed[v] || v === skipV) continue; const hw = N[v].w / 2 + pad, hh = N[v].h / 2 + pad, c = P[v];
    // slab test: entry distance of the ray into the box
    let t0 = 0, t1 = cap;
    for (const [o, d, lo, hi] of [[p.x, ux, c.x - hw, c.x + hw], [p.y, uy, c.y - hh, c.y + hh]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = 1; t1 = 0; } continue; }
      let a = (lo - o) / d, b = (hi - o) / d; if (a > b) { const t = a; a = b; b = t; }
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (t0 <= t1 && t0 < best) best = t0;
  }
  for (const [A, B] of segs) {
    // segment p-q against A-B
    const rx = q.x - p.x, ry = q.y - p.y, sx = B.x - A.x, sy = B.y - A.y, den = rx * sy - ry * sx; if (Math.abs(den) < 1e-9) continue;
    const t = ((A.x - p.x) * sy - (A.y - p.y) * sx) / den, u = ((A.x - p.x) * ry - (A.y - p.y) * rx) / den;
    if (t > 1e-6 && t <= 1 && u >= 0 && u <= 1) best = Math.min(best, t * cap);
  }
  return best;
}

function _tmLayout(items, edges, opts) {
  const o = opts || {}, T = { ..._TM_DEF, ...(o.tm || {}) }, n = items.length, seed = o.seed || 1, rnd = _ogClRng(seed * 31 + 7);
  const t0 = _ogNow(), stage = {}; let tl = performance.now(); const mark = (k) => { const t = performance.now(); stage[k] = (stage[k] || 0) + t - tl; tl = t; };
  const N = items.map((it) => ({ w: it.w + 16, h: it.h + 12 }));
  const EE = edges.filter(([a, b]) => a !== b).map(([a, b, w, lab]) => ({ s: a, t: b, sub: w === 2, lab: lab || 0 }));
  if (n < 2 || !EE.length) return { pos: items.map((_, i) => ({ x: i * 200, y: 0 })), stage };
  const L = n >= 100 ? T.Lbig : T.L, rec = o.rec || null;
  // tr: the playback's recorder (_ogTraced), or null; it gets the positions after every sweep and move, as the library's layouts report them
  const tr = typeof _ogTr !== 'undefined' ? _ogTr : null;
  // 1. hanging units
  const { unitOf, units, adj } = _tmUnits(n, EE, T.K, T.Kfrac);
  const mass = new Float64Array(n), cnt = new Int32Array(n); units.forEach((u) => { mass[u.anchor] += u.nodes.length; cnt[u.anchor]++; });
  const core = [], ci = new Int32Array(n).fill(-1); for (let v = 0; v < n; v++) if (unitOf[v] < 0) { ci[v] = core.length; core.push(v); }
  const m = core.length; mark('units');
  // rec (the lab's walk-through): positions after each step; a class not placed yet sits on its anchor and is listed as hidden
  const snap = (k, PP, extra) => { if (!rec) return; const at = (v) => (PP[v] ? { x: PP[v].x, y: PP[v].y } : unitOf[v] >= 0 && PP[units[unitOf[v]].anchor] ? { x: PP[units[unitOf[v]].anchor].x, y: PP[units[unitOf[v]].anchor].y } : { x: 0, y: 0 });
    rec.push({ k, P: Array.from({ length: n }, (_, v) => at(v)), hidden: Array.from({ length: n }, (_, v) => v).filter((v) => !PP[v]), ...(extra || {}) }); };
  const fullOf = (PCx) => { const Q = new Array(n); core.forEach((v, k) => (Q[v] = PCx[k])); return Q; };
  // 2. Mycelium on the core
  const EC = EE.filter((e) => ci[e.s] >= 0 && ci[e.t] >= 0);
  const ring = new Float64Array(n); const hubW = n >= 100 && T.hubBig != null ? T.hubBig : T.hub;
  if (hubW) for (const v of core) { let s = 0; for (const u of adj[v]) if (T.ringAll || ci[u] >= 0) s += Math.max(N[u].w, N[u].h * 2.5) + hubW; ring[v] = s / (2 * Math.PI); }
  let com = null;
  if (T.pods && T.comAll && n >= 8) { const E3 = EE.map((e) => [e.s, e.t, 1]), cAll = _ogClMergeSmall(_ogClLouvain(n, E3), E3, 4); com = core.map((v) => cAll[v]); }
  else if (T.pods && m >= 8) { const E3 = EC.map((e) => [ci[e.s], ci[e.t], 1]); com = _ogClMergeSmall(_ogClLouvain(m, E3), E3, 4); }
  // room round an anchor: grows with the classes it hides (sqrt: they spread out in 2-D) and with the number of separate units
  // leaving it (each needs a slice of its own)
  const R = core.map((v) => (mass[v] ? T.room * L * (Math.sqrt(mass[v]) + T.cntW * Math.max(0, cnt[v] - 1)) / Math.PI : 0));
  const A = Array.from({ length: m }, () => []);
  EC.forEach((e) => { const a = ci[e.s], b = ci[e.t]; let len = L * (e.sub ? 0.9 : 1);
    if (hubW) len = Math.max(len, Math.min(3 * L, Math.max(ring[e.s], ring[e.t])));
    if (com) len *= com[a] === com[b] ? T.podIn : T.pods;
    if (e.lab) len = Math.max(len, (N[e.s].w + N[e.t].w) / 2 + e.lab + 24);
    if (T.roomMode === 'link' || T.roomMode === 'both') len += (R[a] + R[b]) * (T.roomMode === 'both' ? T.linkShare : 1);
    A[a].push([b, len]); A[b].push([a, len]); });
  const roomInfo = core.map((v, k) => ({ v, r: R[k], units: cnt[v], classes: mass[v] })).filter((x) => x.r > 0);
  const NC = core.map((v) => N[v]), EC2 = EC.map((e) => ({ s: ci[e.s], t: ci[e.t] }));
  if (tr) { tr.begin(o.tryName || 'Tidy Mycelium', n, core, unitOf); tr.tmPhase = 'core'; tr.map = core; }
  let PC;
  if (m === 1) PC = [{ x: 0, y: 0 }];
  else {
    const D = _ogClPaths(m, A);
    if (T.roomMode === 'add' || T.roomMode === 'both') for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (i !== j) D[i][j] += R[i] + R[j];
    if (T.roomMode === 'max') for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (i !== j) D[i][j] = Math.max(D[i][j], R[i] + R[j] + L * 0.6);
    mark('paths');
    const sBud = T.budget * 0.35; let best = null;
    for (let r = 0; r < Math.max(1, T.restarts) && (r === 0 || _ogNow() - t0 < sBud); r++) {
      const P0 = r === 0 && m > 2 ? _ogClPivotMDS(D, m, rnd) : T.init3d && m > 3 && (T.init3d === 'all' || r % 2) ? _tm3d(D, m, rnd, T) : NC.map(() => ({ x: (rnd() - 0.5) * 400, y: (rnd() - 0.5) * 400 }));
      const start = rec ? P0.map((p) => ({ x: p.x, y: p.y })) : null;
      if (tr) { tr.restart(r); tr.snap(r === 0 && m > 2 ? 'tm-start' : 'restart', P0, { room: roomInfo, groups: com ? new Set(com).size : 0 }); }
      _ogClStress(P0, D, T.sweeps, rnd, t0 + sBud); _ogClSeparate(P0, NC, 12, 120); if (tr) tr.snap('separate', P0);
      const x = EC2.length <= 2500 ? _ogClCrossings(P0, EC2) : 0; if (!best || x < best.x) best = { x, P: P0, r, start };
    }
    PC = best.P; mark('stress'); if (tr) tr.keepRestart(best.r);
    if (rec) { snap('start', fullOf(best.start), { room: roomInfo, restart: best.r, groups: com ? new Set(com).size : 0 }); snap('stress', fullOf(PC), { room: roomInfo, restart: best.r, crossings: best.x }); }
    const left = () => Math.max(20, T.budget - (_ogNow() - t0));
    // coreRoom: the core's crossing swaps and moves off links see each anchor as big as the room it keeps for its parts
    const NR = T.coreRoom ? core.map((v, k) => ({ w: NC[k].w + 2 * T.coreRoom * R[k], h: NC[k].h + 2 * T.coreRoom * R[k] })) : NC;
    if (EC2.length && EC2.length <= 2500) {
      if (T.finCross) { _ogClFinCross(PC, NR, EC2, Math.min(m <= 30 ? 150 : 300, left() / 3) * (T.coreX || 1), seed); _ogClSeparate(PC, NR, 12, 120); }
      if (T.finThru) _ogClFinThru(PC, NR, EC2, 12, 10, left() / 3);
      if (T.coreTight) { _ogClFinTight(PC, NC, EC2, 12, 26, left() / 2); if (T.coreThru2) _ogClFinThru(PC, NR, EC2, 8, 10, left() / 2); }
    }
    mark('coreClean');
    snap('coreClean', fullOf(PC), { room: roomInfo });
  }
  // the time the core's last checks took (often finding nothing to move) goes to a frame of their own, not to the first part placed
  if (tr && m > 1 && EC2.length) tr.snap('thru', PC);
  if (tr) tr.map = null;
  const P = new Array(n), placed = new Uint8Array(n); core.forEach((v, k) => { P[v] = PC[k]; placed[v] = 1; });
  // 4. units, largest first, each into the most open slice round its anchor
  let cx = 0, cy = 0; core.forEach((v) => { cx += P[v].x / m; cy += P[v].y / m; });
  const segs = [], GR = T.grid ? _tmGrid(L * 0.5, 10) : null;
  EE.forEach((e) => { if (placed[e.s] && placed[e.t]) { segs.push([P[e.s], P[e.t], e.s, e.t]); if (GR) GR.addSeg(P[e.s], P[e.t], e.s, e.t); } });
  if (GR) core.forEach((v) => GR.addBox(v, P[v], N[v]));
  const gapOf = new Array(n).fill(40); EE.forEach((e) => { [e.s, e.t].forEach((v) => { if (unitOf[v] >= 0) gapOf[v] = Math.max(gapOf[v], e.lab + 16); }); });
  const Lu = T.unitGap * L, leafOf = new Array(n).fill(-1);
  const order = units.map((u, k) => k).sort((a, b) => units[b].nodes.length - units[a].nodes.length || a - b);
  for (const k of order) {
    const U = units[k], a = U.anchor, inU = new Set(U.nodes);
    if (U.nodes.length === 1 && !T.singlesBySlice) { leafOf[U.nodes[0]] = a; continue; }
    // BFS tree from the anchor inside the unit
    const dep = new Map([[a, 0]]), tpar = new Map(), ch = new Map([[a, []]]), q = [a];
    for (let i = 0; i < q.length; i++) { const v = q[i]; for (const w of adj[v]) if (inU.has(w) && !dep.has(w)) { dep.set(w, dep.get(v) + 1); tpar.set(w, v); ch.set(w, []); ch.get(v).push(w); q.push(w); } }
    const lc = new Map(); for (let i = q.length - 1; i >= 0; i--) { const v = q[i], c = ch.get(v); lc.set(v, c.length ? c.reduce((s, w) => s + lc.get(w), 0) : 1); }
    const dmax = Math.max(...U.nodes.map((v) => dep.get(v))), leaves = lc.get(a), wmax = Math.max(...U.nodes.map((v) => N[v].w));
    const r0 = Math.max(Lu, (N[a].w + wmax) / 2 + Math.max(...U.nodes.filter((v) => tpar.get(v) === a).map((v) => gapOf[v]))), need = r0 + (dmax - 1) * Lu + wmax / 2;
    const half = Math.min(Math.PI * 0.45, Math.max(0.25, leaves * (wmax + 24) / (2 * (r0 + (dmax - 1) * Lu)))), cap = need * 2.2;
    const out = Math.atan2(P[a].y - cy, P[a].x - cx), far = Math.hypot(P[a].x - cx, P[a].y - cy) > 1;
    let bestTh = 0, bestS = -Infinity, bestFr = 0; const segsA = GR ? null : segs.filter((s) => s[2] !== a && s[3] !== a);
    const ray = (th) => (GR ? GR.ray(P[a], Math.cos(th), Math.sin(th), cap, a) : _tmRay(P[a], Math.cos(th), Math.sin(th), cap, P, N, placed, segsA, a, 10));
    const tried = rec || tr ? [] : null;
    for (let d = 0; d < T.dirs; d++) {
      const th = d * 2 * Math.PI / T.dirs; let fr = Infinity;
      for (const off of [-half, -half / 2, 0, half / 2, half]) fr = Math.min(fr, ray(th + off) / (off ? Math.cos(off) * 0.5 + 0.5 : 1));
      const s = Math.min(fr, need * 1.5) / need + (far ? T.outward * Math.min(1, U.nodes.length / 4) * Math.cos(th - out) : 0) + (fr >= cap * 0.98 ? 0.3 * T.outward : 0);
      if (tried) tried.push([th, Math.min(fr, cap)]);
      if (s > bestS) { bestS = s; bestTh = th; bestFr = fr; }
    }
    // radial layout in the slice [bestTh - half, bestTh + half]
    const ang = new Map([[a, [bestTh - half, bestTh + half]]]), cntD = new Map(); U.nodes.forEach((v) => cntD.set(dep.get(v), (cntD.get(dep.get(v)) || 0) + 1));
    for (const v of q) { const [lo, hi] = ang.get(v); let x = lo; for (const w of ch.get(v)) { const span = (hi - lo) * lc.get(w) / lc.get(v); ang.set(w, [x, x + span]); x += span; } }
    for (const v of U.nodes) {
      const d = dep.get(v), [lo, hi] = ang.get(v), th = (lo + hi) / 2;
      let r = r0 + (d - 1) * Lu; r = Math.max(r, cntD.get(d) * (wmax + 24) / (2 * half));
      P[v] = { x: P[a].x + Math.cos(th) * r, y: P[a].y + Math.sin(th) * r * 0.85 }; placed[v] = 1;
    }
    EE.forEach((e) => { if ((inU.has(e.s) || inU.has(e.t)) && placed[e.s] && placed[e.t]) { segs.push([P[e.s], P[e.t], e.s, e.t]); if (GR) GR.addSeg(P[e.s], P[e.t], e.s, e.t); } });
    if (GR) U.nodes.forEach((v) => GR.addBox(v, P[v], N[v]));
    snap('unit', P, { anchor: a, nodes: U.nodes.slice(), wedge: { th: bestTh, half, r: need, free: Math.min(bestFr, cap), cap }, rays: tried, outward: far ? out : null });
    if (tr) tr.snap('tm-unit', P, { show: U.nodes, from: a, ov: { slice: { anchor: a, at: { x: P[a].x, y: P[a].y }, th: bestTh, half, r: need, free: Math.min(bestFr, cap), cap, outward: far ? out : null, rays: tried.map(([t, f]) => [+t.toFixed(4), Math.round(f)]) } } });
  }
  mark('units');
  for (let v = 0; v < n; v++) if (!P[v]) P[v] = { x: P[leafOf[v]] ? P[leafOf[v]].x : 0, y: P[leafOf[v]] ? P[leafOf[v]].y : 0 };
  const singles = leafOf.map((p, v) => (p >= 0 ? v : -1)).filter((v) => v >= 0);
  if (rec && singles.length) { const Q = P.slice(); singles.forEach((v) => (Q[v] = null)); snap('beforeLeaves', Q, { singles }); }
  if (singles.length) _ogClPlaceLeaves(P, N, EE, leafOf, gapOf, L, 10, false, t0 + T.budget);
  mark('leaves');
  if (singles.length) snap('leaves', P, { singles });
  _ogClSeparate(P, N, 12, 120); if (tr) { tr.snap('separate', P); tr.tmPhase = 'fin'; }
  if (EE.length <= 2500) { _ogClFinThru(P, N, EE, 6, 10, Math.max(20, T.budget - (_ogNow() - t0)) / 2); if (T.endTight) _ogClFinTight(P, N, EE, T.endTightR || 6, 26, Math.min(T.endTightMs || 1e9, Math.max(20, T.budget - (_ogNow() - t0)))); }
  mark('finish');
  snap('finish', P);
  if (T.shrink) { const kept = _tmShrink(P, N, EE, T, t0); snap('shrink', P, { kept }); }
  mark('shrink');
  return { pos: P, stage, units: units.length, core: m, algo: 'tidymycelium', rec };
}

// Pull in: the whole drawing shrinks toward its center a step at a time, boxes pushed apart after each step.
//   strict: a step is kept only when it adds no crossing and no link through a class;
//   slack: a step is kept while the problems stay within shrinkSlack x links of where they started (the clean-up repairs);
//   repair: after each step a short crossing pass and links-off-classes pass, then kept only when nothing got worse.
// Returns how many steps were kept.
function _tmShrink(P, N, EE, T, t0) {
  const n = P.length; if (n > 600 || EE.length > 1500) return 0;
  const E2 = EE.map((e) => ({ s: e.s, t: e.t })), cost = (Q) => { const m = _ogPlacementMetrics(Q, N, E2); return m.cross + m.thru + 1000 * m.ov; };
  const mode = T.shrink === true ? 'strict' : T.shrink, c0 = cost(P), lim = mode === 'slack' ? c0 + Math.max(1, Math.round(T.shrinkSlack * E2.length)) : Infinity;
  let cur = c0, f = T.shrinkF, kept = 0; const end = _ogNow() + T.shrinkMs;
  while (_ogNow() < end && f < 0.995) {
    let cx = 0, cy = 0; P.forEach((p) => { cx += p.x / n; cy += p.y / n; });
    const Q = P.map((p) => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f })); _ogClSeparate(Q, N, 12, 60);
    if (mode === 'repair') { _ogClFinCross(Q, N, E2, 15, 7); _ogClSeparate(Q, N, 12, 60); _ogClFinThru(Q, N, E2, 2, 10, 15); }
    const c = cost(Q);
    if (mode === 'slack' ? c <= lim : c <= cur) { Q.forEach((q, i) => { P[i].x = q.x; P[i].y = q.y; }); cur = c; kept++; if (typeof _ogTr !== 'undefined' && _ogTr) _ogTr.snap('tm-shrink', P, { f }); } else f = 1 - (1 - f) / 2;
  }
  return kept;
}

// A start for the core found in 3-D: stress with a third axis, where parts can pass round each other, then the thinnest axis
// squashed a little at a time while the stress goes on (a ball letting out its air), then dropped.
function _tm3d(D, m, rnd, T) {
  const X = new Float64Array(m), Y = new Float64Array(m), Z = new Float64Array(m); let sc = 0; for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) sc = Math.max(sc, D[i][j]);
  for (let i = 0; i < m; i++) { X[i] = (rnd() - 0.5) * sc; Y[i] = (rnd() - 0.5) * sc; Z[i] = (rnd() - 0.5) * sc; }
  const sweep = (zf) => { _ogWorkN[3] += m * m * 1.5;
    for (let i = 0; i < m; i++) { const Di = D[i]; let nx = 0, ny = 0, nz = 0, den = 0;
      for (let j = 0; j < m; j++) { if (i === j) continue; const d = Di[j], w = 1 / (d * d); let dx = X[i] - X[j], dy = Y[i] - Y[j], dz = Z[i] - Z[j], cur = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (cur < 1e-3) { dx = rnd() - 0.5; dy = rnd() - 0.5; dz = rnd() - 0.5; cur = Math.sqrt(dx * dx + dy * dy + dz * dz); }
        nx += w * (X[j] + d * dx / cur); ny += w * (Y[j] + d * dy / cur); nz += w * (Z[j] + d * dz / cur); den += w; }
      X[i] = nx / den; Y[i] = ny / den; Z[i] = (nz / den) * zf; } };
  const s3 = T.sweeps3d || 60; for (let k = 0; k < s3; k++) sweep(1);
  // turn so that z is the thinnest axis (power iteration on the covariance for the two widest axes)
  let mx = 0, my = 0, mz = 0; for (let i = 0; i < m; i++) { mx += X[i] / m; my += Y[i] / m; mz += Z[i] / m; }
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (let i = 0; i < m; i++) { const v = [X[i] - mx, Y[i] - my, Z[i] - mz]; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += v[a] * v[b]; }
  const pw = (M, o) => { let v = [rnd() + 0.1, rnd() + 0.1, rnd() + 0.1]; for (let it = 0; it < 60; it++) { if (o) { const d = v[0] * o[0] + v[1] * o[1] + v[2] * o[2]; v = v.map((x, k) => x - d * o[k]); }
    const w = [0, 1, 2].map((a) => M[a][0] * v[0] + M[a][1] * v[1] + M[a][2] * v[2]); const l = Math.hypot(...w) || 1; v = w.map((x) => x / l); } return v; };
  const e1 = pw(C), e2 = pw(C, e1), e3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  for (let i = 0; i < m; i++) { const v = [X[i] - mx, Y[i] - my, Z[i] - mz]; X[i] = v[0] * e1[0] + v[1] * e1[1] + v[2] * e1[2]; Y[i] = v[0] * e2[0] + v[1] * e2[1] + v[2] * e2[2]; Z[i] = v[0] * e3[0] + v[1] * e3[1] + v[2] * e3[2]; }
  for (let k = 0; k < (T.flat3d || 12); k++) sweep(T.squash3d || 0.7);
  return Array.from({ length: m }, (_, i) => ({ x: X[i], y: Y[i] }));
}

// One layout, a few tries: the placement (before the clean-up) with tm.tries seeds, the best by Best Read's own choice score.
// Links per class in the 2-core (what is left once every class with one link or none is peeled off, again and again)
function _tmCoreDensity(n, edges) {
  const adj = Array.from({ length: n }, () => new Set()); edges.forEach((e) => { if (e[0] !== e[1]) { adj[e[0]].add(e[1]); adj[e[1]].add(e[0]); } });
  const deg = adj.map((s) => s.size), gone = new Array(n).fill(false); let q = deg.map((d, i) => (d <= 1 ? i : -1)).filter((i) => i >= 0);
  while (q.length) { const nq = []; for (const v of q) { if (gone[v]) continue; gone[v] = true; adj[v].forEach((w) => { if (!gone[w] && --deg[w] <= 1) nq.push(w); }); } q = nq; }
  let c = 0, e = 0; for (let v = 0; v < n; v++) if (!gone[v]) { c++; adj[v].forEach((w) => { if (!gone[w]) e++; }); }
  return c ? e / 2 / c : 0;
}
// A dense core (more than denseCore links per class) is placed as Mycelium places it: only one-link classes set aside, no room
// kept round them (rings round busy classes count every neighbor instead), groups found on the whole graph, links inside a
// group 0.85 and between groups 1.6 times the usual length, and a last tightening of the core. Found over 3 seeds on 62 graphs.
const _TM_DENSE = { K: 1, room: 0, ringAll: true, comAll: true, coreTight: true, coreThru2: true, pods: 1.6, podIn: 0.85, sweeps: 120 };
// Variants shown side by side in the Lab: 'fewer' keeps core links twice the usual length and the usual length at 170
// (more room, fewer crossings, larger drawings); the default is the smaller drawing.
// 'smallest' also keeps links on graphs over 100 classes at 200 rather than 260, and its bands take along whatever is in their way.
const _TM_VAR = { fewer: { L: 170, pods: 2, podIn: 2 }, smallest: { Lbig: 200, cp: { lasso: 8, bandMs: 60 } } };
function _tmBest(items, edges, opts) {
  const o0 = opts || {}, vb = _TM_VAR[o0.variant] || {}, T0 = { ..._TM_DEF, ...vb, ...(o0.tm || {}) }, dense = T0.denseCore && _tmCoreDensity(items.length, edges) > T0.denseCore;
  const big = T0.budgetBig && items.length > 100 ? { budget: T0.budgetBig } : {}; // a big graph: less time, as Mycelium gives it
  const o = { ...o0, tm: { ...vb, ...(dense ? _TM_DENSE : {}), ...big, ...(o0.tm || {}) } }, T = { ..._TM_DEF, ...(o.tm || {}) }, k = Math.max(1, T.tries || 1);
  if (k === 1) { const r = _tmLayout(items, edges, o); r.dense = dense; return r; }
  const N = items.map((it) => ({ w: it.w + 16, h: it.h + 12 })), E2 = edges.filter((e) => e[0] !== e[1]).map((e) => ({ s: e[0], t: e[1] }));
  let best = null; const t0 = _ogNow();
  for (let i = 0; i < k; i++) {
    if (i && _ogNow() - t0 > (T.triesMs || 400)) break;
    const r = _tmLayout(items, edges, { ...o, tryName: 'Try ' + (i + 1), rec: o.rec ? [] : null, seed: (o.seed || 1) + 1000 * i, tm: { ...T, budget: T.budget / (T.split ? k : 1), ...(T.altPods && i % 2 ? { pods: 1, podIn: 1 } : {}) } });
    const pm = _ogPlacementMetrics(r.pos, N, E2), s = T.choose === 'p1' ? pm.cross + pm.thru + 100 * pm.ov + pm.len / 1e4 : _ogChoiceScore(pm);
    if (typeof _ogTr !== 'undefined' && _ogTr) _ogTr.score('Try ' + (i + 1), s);
    if (!best || s < best.s) best = { s, r, i };
    if (T.choose === 'p1' && best.s < 1) break; // nothing left to improve
  }
  if (typeof _ogTr !== 'undefined' && _ogTr) _ogTr.chosen('Try ' + (best.i + 1));
  if (o.rec) { o.rec.push(...best.r.rec); best.r.recTry = best.i; best.r.recTries = k; }
  return best.r;
}

// The pull-in at the very end (after the clean-up): the whole drawing shrinks toward its middle while that adds no crossing,
// no link through a class and no overlap; parts that have no problem are pulled in too.
function _tmEndPull(P, items, edges, ms, f) {
  const N = items.map((it) => ({ w: it.w + 16, h: it.h + 12 })), EE = edges.filter((e) => e[0] !== e[1]).map((e) => ({ s: e[0], t: e[1] }));
  return _tmShrink(P, N, EE, { shrink: 'strict', shrinkF: f || 0.8, shrinkMs: ms || 100 }, 0);
}
_tmBest.endPull = _tmEndPull;

// The last step (after the clean-up, before the links are drawn): empty space taken in.
// Take in empty space: each class, carrying every part that hangs from it, steps toward the middle, toward the classes it
// links to, or toward the class it hangs from, while that adds no crossing and no link through a class, keeps boxes `gap`
// apart and leaves each link room for its name. Outermost first; a class that could not move is tried again only once
// something near it has moved. A grid of cells holds the boxes and links, so each try looks only at what is nearby.
function _tmCX(ax, ay, bx, by, cx, cy, dx, dy) { const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  if (d1 * d2 >= 0) return false; const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx); return d3 * d4 < 0; }
function _tmCB(ax, ay, bx, by, x0, y0, x1, y1) { let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
  const cl = (p, q) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
  return cl(-dx, ax - x0) && cl(dx, x1 - ax) && cl(-dy, ay - y0) && cl(dy, y1 - ay) && t0 <= t1; }
function _tmCompact(P, boxes, lay, v) {
  const o = v || {}, n = P.length, LE = lay.filter((e) => e[0] !== e[1]), E = LE.map((e) => [e[0], e[1]]), m = E.length, pad = o.pad ?? 9, gap = o.gap ?? 20, ms = o.ms ?? 300, maxR = o.rounds ?? 12, minL = o.minL ?? 70;
  if (n < 2) return P;
  const adj = Array.from({ length: n }, () => []); E.forEach((e, k) => { adj[e[0]].push(k); adj[e[1]].push(k); });
  const other = (k, u) => (E[k][0] === u ? E[k][1] : E[k][0]);
  // the parts that hang from each class: one-link classes peeled again and again
  const par = new Array(n).fill(-1), left = adj.map((l, u) => new Set(l.map((k) => other(k, u)))), gone = new Array(n).fill(false);
  let q = [...Array(n).keys()].filter((u) => left[u].size === 1);
  while (q.length) { const nq = []; for (const u of q) { if (gone[u] || left[u].size !== 1) continue; const p = [...left[u]][0]; if (left[p].size <= 1 && !gone[p] && p < u) continue;
    gone[u] = true; par[u] = p; left[p].delete(u); if (left[p].size === 1) nq.push(p); } q = nq; }
  const ch = Array.from({ length: n }, () => []); par.forEach((p, u) => p >= 0 && ch[p].push(u));
  const carry = Array.from({ length: n }, (_, u) => { const out = [u], st = [...ch[u]]; while (st.length) { const w = st.pop(); out.push(w); st.push(...ch[w]); } return out; });
  const X = new Float64Array(n), Y = new Float64Array(n); P.forEach((p, i) => { X[i] = p.x; Y[i] = p.y; });
  const hw = boxes.map((b) => b.w / 2), hh = boxes.map((b) => b.h / 2);
  const clear = (k) => { const [a, b] = E[k], dx = Math.abs(X[a] - X[b]), dy = Math.abs(Y[a] - Y[b]), d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
    const ext = (w) => Math.min(ux ? hw[w] / ux : 1e9, uy ? hh[w] / uy : 1e9); return d - ext(a) - ext(b); };
  // room along each link for its name: the name's width (links[3]) when known, else minL
  const need = E.map((e, k) => Math.min(LE[k].length > 3 ? (LE[k][3] ? LE[k][3] + (o.nameGap ?? 12) : (o.bare ?? 24)) : minL, clear(k)) - 0.5);
  // grid
  const CS = 140, G = new Map(), key = (i, j) => i * 65536 + j;
  const cellsOf = (x0, y0, x1, y1, f) => { for (let i = Math.floor(x0 / CS); i <= Math.floor(x1 / CS); i++) for (let j = Math.floor(y0 / CS); j <= Math.floor(y1 / CS); j++) f(key(i, j)); };
  const cell = (c) => { let g = G.get(c); if (!g) G.set(c, (g = { b: new Set(), e: new Set(), t: 0 })); return g; };
  const bB = (u) => [X[u] - hw[u] - gap, Y[u] - hh[u] - gap, X[u] + hw[u] + gap, Y[u] + hh[u] + gap];
  const eB = (k) => { const [a, b] = E[k]; return [Math.min(X[a], X[b]), Math.min(Y[a], Y[b]), Math.max(X[a], X[b]), Math.max(Y[a], Y[b])]; };
  // the hot paths walk the cells directly (no closures per cell)
  const put = (bb, kind, id, add) => { const i0 = Math.floor(bb[0] / CS), i1 = Math.floor(bb[2] / CS), j0 = Math.floor(bb[1] / CS), j1 = Math.floor(bb[3] / CS);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const c = i * 65536 + j; if (add) cell(c)[kind].add(id); else { const g = G.get(c); if (g) g[kind].delete(id); } } };
  const addB = (u) => put(bB(u), 'b', u, true), delB = (u) => put(bB(u), 'b', u, false), addE = (k) => put(eB(k), 'e', k, true), delE = (k) => put(eB(k), 'e', k, false);
  for (let u = 0; u < n; u++) addB(u);
  for (let k = 0; k < m; k++) addE(k);
  const seenB = new Int32Array(n), seenE = new Int32Array(m); let ep = 0;
  const nearB = (bb, f) => { ep++; const i0 = Math.floor(bb[0] / CS), i1 = Math.floor(bb[2] / CS), j0 = Math.floor(bb[1] / CS), j1 = Math.floor(bb[3] / CS);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const g = G.get(i * 65536 + j); if (g) for (const w of g.b) if (seenB[w] !== ep) { seenB[w] = ep; f(w); } } };
  const nearE = (bb, f) => { ep++; const i0 = Math.floor(bb[0] / CS), i1 = Math.floor(bb[2] / CS), j0 = Math.floor(bb[1] / CS), j1 = Math.floor(bb[3] / CS);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const g = G.get(i * 65536 + j); if (g) for (const k of g.e) if (seenE[k] !== ep) { seenE[k] = ep; f(k); } } };
  // two or more links between the same two classes are drawn as arcs that bow out about 12 px each way: such a link is wider
  const mult = new Map(); E.forEach(([a, b]) => { const kk = Math.min(a, b) * 1e6 + Math.max(a, b); mult.set(kk, (mult.get(kk) || 0) + 1); });
  const padK = E.map(([a, b]) => pad + (o.arcPad ?? 12) * Math.max(0, mult.get(Math.min(a, b) * 1e6 + Math.max(a, b)) - 1));
  const pM = Math.max(pad, ...padK);
  const thru = (k, w) => { const [a, b] = E[k], p = padK[k]; return a !== w && b !== w && _tmCB(X[a], Y[a], X[b], Y[b], X[w] - hw[w] - p, Y[w] - hh[w] - p, X[w] + hw[w] + p, Y[w] + hh[w] + p); };
  const inS = new Int32Array(n), inK = new Int32Array(m); let sp = 0;
  function cost(S, ks, lim, rigid) { // rigid: S moves as one block, so links inside it keep their crossings with each other // crossings and links through classes that touch S (the moved boxes and links are off the grid while tried)
    let c = 0, t = 0;
    for (const k of ks) { const [a, b] = E[k];
      nearE(eB(k), (j) => { const [p, r] = E[j]; if (p === a || p === b || r === a || r === b) return; if (_tmCX(X[a], Y[a], X[b], Y[b], X[p], Y[p], X[r], Y[r])) c++; });
      const ink = rigid && inS[a] === sp && inS[b] === sp; for (const j of ks) if (j > k) { const [p, r] = E[j]; if (ink && inS[p] === sp && inS[r] === sp) continue; if (p === a || p === b || r === a || r === b) continue; if (_tmCX(X[a], Y[a], X[b], Y[b], X[p], Y[p], X[r], Y[r])) c++; }
      const bb = eB(k), pk = padK[k]; nearB([bb[0] - pk, bb[1] - pk, bb[2] + pk, bb[3] + pk], (w) => { if (thru(k, w)) t++; });
      if (lim && (c > lim[0] || t > lim[1])) return [c, t]; } // already worse: no need to count on
    for (const u of S) { nearE([X[u] - hw[u] - pM, Y[u] - hh[u] - pM, X[u] + hw[u] + pM, Y[u] + hh[u] + pM], (k) => { if (thru(k, u)) t++; });
      for (const k of ks) if (!(rigid && inS[E[k][0]] === sp && inS[E[k][1]] === sp) && thru(k, u)) t++; if (lim && t > lim[1]) return [c, t]; }
    return [c, t]; }
  // two links from the same class lying on each other: within 4 px for more than 12 px outside the class's box
  const onLine = (k, j) => { const [a, b] = E[k], [p, r] = E[j]; const s = a === p || a === r ? a : b === p || b === r ? b : -1; if (s < 0) return false;
    const u = s === a ? b : a, w = s === p ? r : p; if (u === w) return false; const x1 = X[u] - X[s], y1 = Y[u] - Y[s], x2 = X[w] - X[s], y2 = Y[w] - Y[s];
    const l1 = Math.hypot(x1, y1) || 1, l2 = Math.hypot(x2, y2) || 1; if (x1 * x2 + y1 * y2 <= 0) return false; const sn = Math.abs(x1 * y2 - y1 * x2) / l1 / l2;
    const ux = Math.abs(x1) / l1, uy = Math.abs(y1) / l1, ex = Math.min(ux ? hw[s] / ux : 1e9, uy ? hh[s] / uy : 1e9);
    return Math.min(l1, l2, sn > 1e-6 ? 4 / sn : 1e9) - ex > 12; };
  const lov = o.lineOv !== false;
  function onLines(ks) { if (!lov) return 0; let c = 0; for (const k of ks) for (const e of E[k]) for (const j of adj[e]) if (j !== k && (inK[j] !== sp || j > k) && onLine(k, j)) c++; return c; }
  function clash(S, ks) {
    for (const k of ks) if (clear(k) < need[k]) return 'name';
    for (const u of S) { let hit = false; nearB(bB(u), (w) => { if (!hit && Math.abs(X[u] - X[w]) < hw[u] + hw[w] + gap && Math.abs(Y[u] - Y[w]) < hh[u] + hh[w] + gap) hit = true; }); if (hit) return 'gap'; }
    for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) { const u = S[i], w = S[j]; if (Math.abs(X[u] - X[w]) < hw[u] + hw[w] + 1 && Math.abs(Y[u] - Y[w]) < hh[u] + hh[w] + 1) return 'gap'; }
    return ''; }
  // repelled, not passed through: a class may not cross another link on its way (its box's corners and middle swept along the move)
  function sweeps(S, ox, oy) {
    for (let i = 0; i < S.length; i++) { const u = S[i], dx = X[u] - ox[i], dy = Y[u] - oy[i];
      const bb = [Math.min(ox[i], X[u]) - hw[u], Math.min(oy[i], Y[u]) - hh[u], Math.max(ox[i], X[u]) + hw[u], Math.max(oy[i], Y[u]) + hh[u]]; let hit = false;
      nearE(bb, (k) => { if (hit) return; const [a, b] = E[k]; if (inS[a] === sp || inS[b] === sp) return;
        for (const [sx, sy] of [[0, 0], [-hw[u], -hh[u]], [hw[u], -hh[u]], [-hw[u], hh[u]], [hw[u], hh[u]]]) if (_tmCX(ox[i] + sx, oy[i] + sy, X[u] + sx, Y[u] + sy, X[a], Y[a], X[b], Y[b])) { hit = true; return; } });
      if (hit) return true; }
    return false; }
  const t0 = performance.now(), failAt = new Float64Array(n).fill(-1); let moves = 0, rounds = 0, tick = 1, fixed = 0;
  // a class that a link runs through (or passes within pad of) is pushed, with what hangs from it, just clear of the line,
  // when that leaves fewer crossings plus links through classes
  function unThru() {
    for (let w = 0; w < n; w++) { let ks0 = []; nearE([X[w] - hw[w] - pM, Y[w] - hh[w] - pM, X[w] + hw[w] + pM, Y[w] + hh[w] + pM], (k) => { if (thru(k, w)) ks0.push(k); });
      for (const k of ks0) { const [a, b] = E[k]; if (!thru(k, w)) continue; let nx = -(Y[b] - Y[a]), ny = X[b] - X[a]; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
        const d = (X[w] - X[a]) * nx + (Y[w] - Y[a]) * ny, sg = d < 0 ? -1 : 1, ext = hw[w] * Math.abs(nx) + hh[w] * Math.abs(ny), sh = ext + pad + 1.5 - Math.abs(d);
        const S = carry[w].includes(a) || carry[w].includes(b) ? [w] : carry[w]; sp++; S.forEach((x) => (inS[x] = sp)); const ks = []; S.forEach((x) => adj[x].forEach((j) => { if (inK[j] !== sp) { inK[j] = sp; ks.push(j); } }));
        S.forEach(delB); ks.forEach(delE); const ox = S.map((x) => X[x]), oy = S.map((x) => Y[x]), c0 = cost(S, ks); let ok = false;
        for (const f of [1, 1.6, -1]) { const s2 = f < 0 ? -(ext + pad + 1.5 + Math.abs(d)) : sh * f; S.forEach((x, i) => { X[x] = ox[i] + sg * s2 * nx; Y[x] = oy[i] + sg * s2 * ny; });
          if (!clash(S, ks)) { const c1 = cost(S, ks, c0); if (c1[0] <= c0[0] && c1[0] + c1[1] < c0[0] + c0[1]) { ok = true; break; } } }
        if (!ok) S.forEach((x, i) => { X[x] = ox[i]; Y[x] = oy[i]; }); else fixed++;
        S.forEach(addB); ks.forEach(addE); } } }
  unThru();
  const WHY = { name: 0, gap: 0, sweep: 0, cross: 0, thru: 0, line: 0 }; let GRP = null; if (o.groups !== false && n >= 12) { const top = [...Array(n).keys()].filter((u) => par[u] < 0), ti = new Map(top.map((u, i) => [u, i]));
    const E3 = E.filter(([a, b]) => ti.has(a) && ti.has(b)).map(([a, b]) => [ti.get(a), ti.get(b), 1]);
    if (E3.length) { const c = _ogClMergeSmall(_ogClLouvain(top.length, E3), E3, 3), by = new Map(); top.forEach((u, i) => { if (!by.has(c[i])) by.set(c[i], []); by.get(c[i]).push(u); });
      GRP = [...by.values()].filter((g) => g.length >= 2 && g.length < top.length); } }
  const touched = (u) => { let t = 0; cellsOf(X[u] - 2 * CS, Y[u] - 2 * CS, X[u] + 2 * CS, Y[u] + 2 * CS, (c) => { const g = G.get(c); if (g && g.t > t) t = g.t; }); return t; };
  // a hanging part on the edge of the drawing turns round the class it hangs from, as a whole, into open space inside: only
  // when there is ample room there (twice the usual gap all round), it adds no crossing, no link through a class and no line on
  // a line, and the drawing's extent gets at least 3% smaller. Otherwise it stays outside, where there is room.
  let jumped = 0;
  // ample room: no other box within twice the usual gap of the part's new place
  const crowded = (S) => { for (const u of S) { let hit = false; const g2 = 2 * gap; nearB([X[u] - hw[u] - g2, Y[u] - hh[u] - g2, X[u] + hw[u] + g2, Y[u] + hh[u] + g2], (w) => { if (!hit && inS[w] !== sp && Math.abs(X[u] - X[w]) < hw[u] + hw[w] + g2 && Math.abs(Y[u] - Y[w]) < hh[u] + hh[w] + g2) hit = true; }); if (hit) return true; } return false; };
  function relocate() { if (o.jump === false) return 0; let got = 0;
    let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18; for (let i = 0; i < n; i++) { x0 = Math.min(x0, X[i] - hw[i]); x1 = Math.max(x1, X[i] + hw[i]); y0 = Math.min(y0, Y[i] - hh[i]); y1 = Math.max(y1, Y[i] + hh[i]); }
    const roots = [...Array(n).keys()].filter((u) => par[u] >= 0 && par[par[u]] < 0 || par[u] >= 0 && carry[u].length >= 1).filter((u) => par[u] >= 0);
    for (const u of roots) { if (performance.now() - t0 > ms) break; const p = par[u], S = carry[u];
      // touches the extent? only a part on the edge of the drawing can make it smaller
      let edge = false; for (const w of S) if (X[w] - hw[w] <= x0 + 1 || X[w] + hw[w] >= x1 - 1 || Y[w] - hh[w] <= y0 + 1 || Y[w] + hh[w] >= y1 - 1) { edge = true; break; } if (!edge) continue;
      let a0 = 1e18, b0 = 1e18, a1 = -1e18, b1 = -1e18; for (let i = 0; i < n; i++) if (!S.includes(i)) { a0 = Math.min(a0, X[i] - hw[i]); a1 = Math.max(a1, X[i] + hw[i]); b0 = Math.min(b0, Y[i] - hh[i]); b1 = Math.max(b1, Y[i] + hh[i]); }
      const ext = () => { let p0 = a0, q0 = b0, p1 = a1, q1 = b1; for (const w of S) { p0 = Math.min(p0, X[w] - hw[w]); p1 = Math.max(p1, X[w] + hw[w]); q0 = Math.min(q0, Y[w] - hh[w]); q1 = Math.max(q1, Y[w] + hh[w]); } return (p1 - p0) * (q1 - q0); };
      sp++; S.forEach((x) => (inS[x] = sp)); const ks = []; S.forEach((x) => adj[x].forEach((q) => { if (inK[q] !== sp) { inK[q] = sp; ks.push(q); } }));
      S.forEach(delB); ks.forEach(delE); const ox = S.map((x) => X[x]), oy = S.map((x) => Y[x]), A0 = ext(), c0 = cost(S, ks), l0 = onLines(ks); let best = null;
      for (let dg = 15; dg < 360; dg += 15) for (const sc of [1, 0.75]) { const a = dg * Math.PI / 180, cs = Math.cos(a) * sc, sn = Math.sin(a) * sc;
        S.forEach((x, i) => { const dx = ox[i] - X[p], dy = oy[i] - Y[p]; X[x] = X[p] + dx * cs - dy * sn; Y[x] = Y[p] + dx * sn + dy * cs; });
        const A1 = ext(); if (A1 > A0 * 0.97 || best && A1 >= best.A) continue; if (clash(S, ks) || crowded(S)) continue;
        const c1 = cost(S, ks); if (c1[0] > c0[0] || c1[1] > c0[1] || onLines(ks) > l0) continue; best = { A: A1, x: S.map((x) => X[x]), y: S.map((x) => Y[x]) }; }
      if (best) { S.forEach((x, i) => { X[x] = best.x[i]; Y[x] = best.y[i]; }); got++; jumped++; tick++; S.forEach((w, i) => cellsOf(Math.min(ox[i], X[w]) - 1, Math.min(oy[i], Y[w]) - 1, Math.max(ox[i], X[w]) + 1, Math.max(oy[i], Y[w]) + 1, (c) => (cell(c).t = tick)));
        x0 = 1e18; y0 = 1e18; x1 = -1e18; y1 = -1e18; for (let i = 0; i < n; i++) { x0 = Math.min(x0, X[i] - hw[i]); x1 = Math.max(x1, X[i] + hw[i]); y0 = Math.min(y0, Y[i] - hh[i]); y1 = Math.max(y1, Y[i] + hh[i]); } }
      else S.forEach((x, i) => { X[x] = ox[i]; Y[x] = oy[i]; });
      S.forEach(addB); ks.forEach(addE); }
    return got; }
  // Bands and islands: everything beyond a line across the drawing (from each side and each corner, an outer sixth, a third or
  // half of the way in) moves inward as one block, the links across the line getting shorter. A class in the way is taken
  // along (the selection widens round it, as a lasso would) rather than blocking. Kept when nothing overlaps, every name
  // still fits, and the crossings, links through classes and links on links do not rise. Largest step first.
  let banded = 0; const BWHY = { name: 0, block: 0, lassoMax: 0, sweep: 0, cross: 0, thru: 0, line: 0, ok: 0 };
  function bands() { if (o.bands === false) return 0; let got = 0; const inB = new Int32Array(n); let bs = 0; const tb = performance.now(), bms = o.bandMs ?? 30, late = () => performance.now() - t0 > ms || performance.now() - tb > bms;
    for (let dir = 0; dir < 8; dir++) { if (late()) break; const a = dir * Math.PI / 4, ux = Math.cos(a), uy = Math.sin(a);
      for (const f of o.bandF || [1 / 6, 1 / 3, 1 / 2]) { if (late()) break;
        let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += X[i] / n; cy += Y[i] / n; }
        let s0 = 1e18, s1 = -1e18; const s = new Float64Array(n); for (let i = 0; i < n; i++) { s[i] = (X[i] - cx) * ux + (Y[i] - cy) * uy; s0 = Math.min(s0, s[i]); s1 = Math.max(s1, s[i]); }
        const D = s1 - s0, cut = s1 - f * D; if (D < 40) continue;
        for (const g of o.bandG || [0.06, 0.02]) { const d = g * D; if (d < 4) continue;
          bs++; let S = []; for (let i = 0; i < n; i++) if (s[i] > cut && inB[i] !== bs) for (const w of carry[i]) if (inB[w] !== bs) { inB[w] = bs; S.push(w); }
          if (!S.length || S.length >= n - 1) continue;
          let ok = false; for (let grow = 0; grow <= (o.lasso ?? 0); grow++) {
            sp++; S.forEach((x) => (inS[x] = sp)); const ks = []; S.forEach((x) => adj[x].forEach((q) => { if (inK[q] !== sp) { inK[q] = sp; ks.push(q); } }));
            S.forEach(delB); ks.forEach(delE); const ox = S.map((x) => X[x]), oy = S.map((x) => Y[x]), c0 = cost(S, ks, null, true); c0.push(onLines(ks));
            S.forEach((x, i) => { X[x] = ox[i] - ux * d; Y[x] = oy[i] - uy * d; });
            let blk = -1, bad = false; for (const k of ks) if ((inS[E[k][0]] === sp) !== (inS[E[k][1]] === sp) && clear(k) < need[k]) { bad = true; blk = inS[E[k][0]] === sp ? E[k][1] : E[k][0]; break; }
            if (!bad) for (const u of S) { nearB(bB(u), (w) => { if (blk < 0 && Math.abs(X[u] - X[w]) < hw[u] + hw[w] + gap && Math.abs(Y[u] - Y[w]) < hh[u] + hh[w] + gap) blk = w; }); if (blk >= 0) break; }
            if (bad) BWHY.name++; else if (blk >= 0) BWHY.block++; else if (o.bandSweep !== false && sweeps(S, ox, oy)) BWHY.sweep++; else { const c1 = cost(S, ks, c0, true), l1 = onLines(ks); if (c1[0] <= c0[0] && c1[1] <= c0[1] && l1 <= c0[2]) { ok = true; BWHY.ok++; } else { BWHY[c1[0] > c0[0] ? 'cross' : c1[1] > c0[1] ? 'thru' : 'line']++;
              // a link across the line now running through a class: that class is taken along
              if (c1[0] <= c0[0] && c1[1] > c0[1]) for (const k of ks) { if ((inS[E[k][0]] === sp) === (inS[E[k][1]] === sp)) continue; const bb = eB(k), pk = padK[k]; nearB([bb[0] - pk, bb[1] - pk, bb[2] + pk, bb[3] + pk], (w) => { if (blk < 0 && inS[w] !== sp && thru(k, w)) blk = w; }); if (blk >= 0) break; } } }
            if (!ok) S.forEach((x, i) => { X[x] = ox[i]; Y[x] = oy[i]; });
            S.forEach(addB); ks.forEach(addE);
            if (ok || blk < 0) break;
            // the lasso widens round the class in the way (with what hangs from it, or what it hangs from)
            let r = blk; while (par[r] >= 0) r = par[r]; for (const w of carry[r]) if (inB[w] !== bs) { inB[w] = bs; S.push(w); } if (S.length >= n - 1) break; }
          if (ok) { got++; banded++; tick++; for (let i = 0; i < n; i++) s[i] = (X[i] - cx) * ux + (Y[i] - cy) * uy; break; } } } }
    if (got && typeof _ogTr !== 'undefined' && _ogTr) _ogTr.snap('compact', [...Array(n).keys()].map((i) => ({ x: X[i], y: Y[i] })));
    return got; }
  for (let b = 0; b < (o.bandRounds ?? 4) && bands(); b++);
  while (rounds < maxR && performance.now() - t0 < ms) {
    const jg = relocate();
    rounds++; let cx = 0, cy = 0; for (let i = 0; i < n; i++) { cx += X[i] / n; cy += Y[i] / n; }
    const order = [...Array(n).keys()].sort((a, b) => Math.hypot(X[b] - cx, Y[b] - cy) - Math.hypot(X[a] - cx, Y[a] - cy));
    let any = 0;
    for (const u of order) { if (performance.now() - t0 > ms) break;
      if (failAt[u] >= 0 && touched(u) <= failAt[u]) continue;
      const S = carry[u]; sp++; S.forEach((w) => (inS[w] = sp)); const ks = []; S.forEach((w) => adj[w].forEach((k) => { if (inK[k] !== sp) { inK[k] = sp; ks.push(k); } }));
      const nb = adj[u].map((k) => other(k, u)).filter((w) => inS[w] !== sp); let bx = 0, by = 0; nb.forEach((w) => { bx += X[w] / nb.length; by += Y[w] / nb.length; });
      const cands = []; for (const f of o.fs || [0.3, 0.12]) { cands.push([(cx - X[u]) * f, (cy - Y[u]) * f]); if (nb.length) cands.push([(bx - X[u]) * f, (by - Y[u]) * f]); if (par[u] >= 0) cands.push([(X[par[u]] - X[u]) * f, (Y[par[u]] - Y[u]) * f]); if (o.axis !== false) { cands.push([0, (cy - Y[u]) * f]); cands.push([(cx - X[u]) * f, 0]); } }
      S.forEach(delB); ks.forEach(delE);
      const ox = S.map((w) => X[w]), oy = S.map((w) => Y[w]); let ok = false, c0 = null; // the count before, only once a try passes the quick checks
      for (const [mx, my] of cands) { if (Math.abs(mx) + Math.abs(my) < 3) continue;
        S.forEach((w, i) => { X[w] = ox[i] + mx; Y[w] = oy[i] + my; });
        const cl = clash(S, ks); if (cl) WHY[cl]++; else if (sweeps(S, ox, oy)) WHY.sweep++; else { if (!c0) { const nx = S.map((w) => X[w]), ny = S.map((w) => Y[w]); S.forEach((w, i) => { X[w] = ox[i]; Y[w] = oy[i]; }); c0 = cost(S, ks); c0.push(onLines(ks)); S.forEach((w, i) => { X[w] = nx[i]; Y[w] = ny[i]; }); } const c1 = cost(S, ks, c0); if (c1[0] <= c0[0] && c1[1] <= c0[1] && onLines(ks) <= c0[2]) { ok = true; break; } WHY[c1[0] > c0[0] ? 'cross' : c1[1] > c0[1] ? 'thru' : 'line']++; } }
      if (!ok) S.forEach((w, i) => { X[w] = ox[i]; Y[w] = oy[i]; });
      S.forEach(addB); ks.forEach(addE);
      if (ok) { any++; moves++; tick++; S.forEach((w, i) => cellsOf(Math.min(ox[i], X[w]) - 1, Math.min(oy[i], Y[w]) - 1, Math.max(ox[i], X[w]) + 1, Math.max(oy[i], Y[w]) + 1, (c) => (cell(c).t = tick))); failAt[u] = -1; }
      else failAt[u] = tick;
    }
    // whole groups (Louvain), each with what hangs from its classes, slide toward the middle as one block
    if (GRP) for (const g of GRP) { if (performance.now() - t0 > ms) break; if (g.failAt != null && g.failAt === tick) continue; // nothing has moved since it last failed
      let gx = 0, gy = 0; g.forEach((w) => { gx += X[w] / g.length; gy += Y[w] / g.length; });
      sp++; const S = []; g.forEach((w) => carry[w].forEach((x) => { if (inS[x] !== sp) { inS[x] = sp; S.push(x); } }));
      const ks = []; S.forEach((w) => adj[w].forEach((k) => { if (inK[k] !== sp) { inK[k] = sp; ks.push(k); } }));
      S.forEach(delB); ks.forEach(delE);
      const ox = S.map((w) => X[w]), oy = S.map((w) => Y[w]); let ok = false, c0 = null; // the count before, only once a try passes the quick checks
      for (const f of [0.3, 0.15, 0.07]) { const mx = (cx - gx) * f, my = (cy - gy) * f; if (Math.abs(mx) + Math.abs(my) < 3) continue;
        S.forEach((w, i) => { X[w] = ox[i] + mx; Y[w] = oy[i] + my; });
        const cl = clash(S, ks); if (cl) WHY[cl]++; else if (sweeps(S, ox, oy)) WHY.sweep++; else { if (!c0) { const nx = S.map((w) => X[w]), ny = S.map((w) => Y[w]); S.forEach((w, i) => { X[w] = ox[i]; Y[w] = oy[i]; }); c0 = cost(S, ks); c0.push(onLines(ks)); S.forEach((w, i) => { X[w] = nx[i]; Y[w] = ny[i]; }); } const c1 = cost(S, ks, c0); if (c1[0] <= c0[0] && c1[1] <= c0[1] && onLines(ks) <= c0[2]) { ok = true; break; } WHY[c1[0] > c0[0] ? 'cross' : c1[1] > c0[1] ? 'thru' : 'line']++; } }
      if (!ok) S.forEach((w, i) => { X[w] = ox[i]; Y[w] = oy[i]; });
      S.forEach(addB); ks.forEach(addE);
      if (ok) { any++; moves++; tick++; g.failAt = null; S.forEach((w, i) => cellsOf(Math.min(ox[i], X[w]) - 1, Math.min(oy[i], Y[w]) - 1, Math.max(ox[i], X[w]) + 1, Math.max(oy[i], Y[w]) + 1, (c) => (cell(c).t = tick))); }
      else g.failAt = tick;
    }
    if (typeof _ogTr !== 'undefined' && _ogTr && any) _ogTr.snap('compact', [...Array(n).keys()].map((i) => ({ x: X[i], y: Y[i] })));
    if (!any && !jg) break;
  }
  // links on each other: the far end of one (with what hangs from it) turns round the shared class, a few degrees either way,
  // when that takes the two apart and adds no crossing, no link through a class and no other overlap
  let nudged = 0;
  if (lov) for (let k = 0; k < m; k++) for (const e of E[k]) for (const j of adj[e]) { if (j <= k || !onLine(k, j)) continue;
    let done = false;
    for (const kk of [k, j]) { if (done) break; const s = e, w = other(kk, s); if (carry[w].includes(s)) continue; const S = carry[w];
      sp++; S.forEach((x) => (inS[x] = sp)); const ks = []; S.forEach((x) => adj[x].forEach((q) => { if (inK[q] !== sp) { inK[q] = sp; ks.push(q); } }));
      S.forEach(delB); ks.forEach(delE); const ox = S.map((x) => X[x]), oy = S.map((x) => Y[x]), c0 = cost(S, ks), l0 = onLines(ks);
      for (const dg of [6, -6, 12, -12, 20, -20]) { const a = dg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
        S.forEach((x, i) => { const dx = ox[i] - X[s], dy = oy[i] - Y[s]; X[x] = X[s] + dx * cs - dy * sn; Y[x] = Y[s] + dx * sn + dy * cs; });
        if (clash(S, ks)) continue; const c1 = cost(S, ks, c0); if (c1[0] <= c0[0] && c1[1] <= c0[1] && onLines(ks) < l0) { done = true; break; } }
      if (!done) S.forEach((x, i) => { X[x] = ox[i]; Y[x] = oy[i]; }); else nudged++;
      S.forEach(addB); ks.forEach(addE); } }
  for (let b = 0; b < (o.bandRounds ?? 4) && bands(); b++);
  unThru(); _tmCompact.last = { why: WHY, moves, rounds, fixed, nudged, jumped, banded, bwhy: BWHY, ms: performance.now() - t0 };
  return [...Array(n).keys()].map((i) => ({ x: X[i], y: Y[i] }));
}
_tmBest.compact = _tmCompact;
