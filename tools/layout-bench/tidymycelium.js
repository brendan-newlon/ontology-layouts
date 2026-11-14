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
const _TM_DEF = { K: 8, Kfrac: 0.25, L: 170, Lbig: 260, pods: 1.6, podIn: 0.85, hub: 20, room: 1, roomMode: 'add', cntW: 0.5, linkShare: 0.5,
  restarts: 3, sweeps: 120, finCross: true, finThru: true, coreTight: false, endTight: false, unitGap: 0.75, dirs: 36, outward: 0.5,
  budget: 600, singlesBySlice: false, shrink: 'slack', shrinkMs: 150, shrinkF: 0.88, shrinkSlack: 0.06, hubBig: 20, tries: 2, triesMs: 400, grid: true };

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
  if (hubW) for (const v of core) { let s = 0; for (const u of adj[v]) if (ci[u] >= 0) s += Math.max(N[u].w, N[u].h * 2.5) + hubW; ring[v] = s / (2 * Math.PI); }
  let com = null; if (T.pods && m >= 8) { const E3 = EC.map((e) => [ci[e.s], ci[e.t], 1]); com = _ogClMergeSmall(_ogClLouvain(m, E3), E3, 4); }
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
      const P0 = r === 0 && m > 2 ? _ogClPivotMDS(D, m, rnd) : NC.map(() => ({ x: (rnd() - 0.5) * 400, y: (rnd() - 0.5) * 400 }));
      const start = rec ? P0.map((p) => ({ x: p.x, y: p.y })) : null;
      if (tr) { tr.restart(r); tr.snap(r === 0 && m > 2 ? 'tm-start' : 'restart', P0, { room: roomInfo, groups: com ? new Set(com).size : 0 }); }
      _ogClStress(P0, D, T.sweeps, rnd, t0 + sBud); _ogClSeparate(P0, NC, 12, 120); if (tr) tr.snap('separate', P0);
      const x = EC2.length <= 2500 ? _ogClCrossings(P0, EC2) : 0; if (!best || x < best.x) best = { x, P: P0, r, start };
    }
    PC = best.P; mark('stress'); if (tr) tr.keepRestart(best.r);
    if (rec) { snap('start', fullOf(best.start), { room: roomInfo, restart: best.r, groups: com ? new Set(com).size : 0 }); snap('stress', fullOf(PC), { room: roomInfo, restart: best.r, crossings: best.x }); }
    const left = () => Math.max(20, T.budget - (_ogNow() - t0));
    if (EC2.length && EC2.length <= 2500) {
      if (T.finCross) { _ogClFinCross(PC, NC, EC2, Math.min(m <= 30 ? 150 : 300, left() / 3), seed); _ogClSeparate(PC, NC, 12, 120); }
      if (T.finThru) _ogClFinThru(PC, NC, EC2, 12, 10, left() / 3);
      if (T.coreTight) _ogClFinTight(PC, NC, EC2, 12, 26, left() / 2);
    }
    mark('coreClean');
    snap('coreClean', fullOf(PC), { room: roomInfo });
  }
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
  if (EE.length <= 2500) { _ogClFinThru(P, N, EE, 6, 10, Math.max(20, T.budget - (_ogNow() - t0)) / 2); if (T.endTight) _ogClFinTight(P, N, EE, 6, 26, Math.max(20, T.budget - (_ogNow() - t0))); }
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

// One layout, a few tries: the placement (before the clean-up) with tm.tries seeds, the best by Best Read's own choice score.
function _tmBest(items, edges, opts) {
  const o = opts || {}, T = { ..._TM_DEF, ...(o.tm || {}) }, k = Math.max(1, T.tries || 1);
  if (k === 1) return _tmLayout(items, edges, o);
  const N = items.map((it) => ({ w: it.w + 16, h: it.h + 12 })), E2 = edges.filter((e) => e[0] !== e[1]).map((e) => ({ s: e[0], t: e[1] }));
  let best = null; const t0 = _ogNow();
  for (let i = 0; i < k; i++) {
    if (i && _ogNow() - t0 > (T.triesMs || 400)) break;
    const r = _tmLayout(items, edges, { ...o, tryName: 'Try ' + (i + 1), rec: o.rec ? [] : null, seed: (o.seed || 1) + 1000 * i, tm: { ...T, budget: T.budget / (T.split ? k : 1), ...(T.altPods && i % 2 ? { pods: 1, podIn: 1 } : {}) } });
    const s = _ogChoiceScore(_ogPlacementMetrics(r.pos, N, E2));
    if (typeof _ogTr !== 'undefined' && _ogTr) _ogTr.score('Try ' + (i + 1), s);
    if (!best || s < best.s) best = { s, r, i };
  }
  if (typeof _ogTr !== 'undefined' && _ogTr) _ogTr.chosen('Try ' + (best.i + 1));
  if (o.rec) { o.rec.push(...best.r.rec); best.r.recTry = best.i; best.r.recTries = k; }
  return best.r;
}
