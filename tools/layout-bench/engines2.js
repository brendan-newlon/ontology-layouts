// Experimental engines for the headless bench. Each: (items, edges, opts) => { pos, crossings } | null.
// Uses the library's helpers (_ogClSeparate, _ogClFinCross, _ogClFinThru, _ogClFinTight, _ogClCrossings, _ogClRng) from base_layout.js.
function x2Dijkstra(n, adj) {
  // all-pairs shortest path lengths with a binary heap
  const D = Array.from({ length: n }, () => new Float64Array(n).fill(Infinity));
  for (let s = 0; s < n; s++) {
    const d = D[s]; d[s] = 0; const h = [[0, s]];
    while (h.length) {
      // pop min
      let top = h[0]; const last = h.pop();
      if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[i], h[m]] = [h[m], h[i]]; i = m; } }
      const [du, u] = top; if (du > d[u]) continue;
      for (const [v, w] of adj[u]) { const nd = du + w; if (nd < d[v]) { d[v] = nd; h.push([nd, v]); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } } }
    }
  }
  let mx = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (isFinite(D[i][j])) mx = Math.max(mx, D[i][j]);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!isFinite(D[i][j])) D[i][j] = mx * 0.6 + 200;
  return D;
}
function x2PivotMDS(D, n, rnd) {
  const k = Math.min(n, 60), piv = [(rnd() * n) | 0], mind = new Float64Array(n).fill(Infinity);
  while (piv.length < k) { const p = piv[piv.length - 1]; let b = -1, bi = 0; for (let i = 0; i < n; i++) { mind[i] = Math.min(mind[i], D[p][i]); if (mind[i] > b) { b = mind[i]; bi = i; } } piv.push(bi); }
  const C = Array.from({ length: n }, (_, i) => piv.map((p) => D[i][p] * D[i][p]));
  const rm = new Float64Array(n), cm = new Float64Array(k); let all = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) { rm[i] += C[i][j] / k; cm[j] += C[i][j] / n; all += C[i][j] / (n * k); }
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) C[i][j] = -0.5 * (C[i][j] - rm[i] - cm[j] + all);
  const M = Array.from({ length: k }, () => new Float64Array(k));
  for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) { let s = 0; for (let i = 0; i < n; i++) s += C[i][a] * C[i][b]; M[a][b] = s; }
  const vecs = [];
  for (let e = 0; e < 2; e++) {
    let v = Array.from({ length: k }, () => rnd() - 0.5);
    for (let it = 0; it < 200; it++) {
      const w = new Float64Array(k); for (let a = 0; a < k; a++) { let s = 0; for (let b = 0; b < k; b++) s += M[a][b] * v[b]; w[a] = s; }
      vecs.forEach((u) => { let dt = 0; for (let a = 0; a < k; a++) dt += w[a] * u[a]; for (let a = 0; a < k; a++) w[a] -= dt * u[a]; });
      let nr = 0; for (let a = 0; a < k; a++) nr += w[a] * w[a]; nr = Math.sqrt(nr) || 1; v = Array.from(w, (x) => x / nr);
    }
    vecs.push(v);
  }
  return Array.from({ length: n }, (_, i) => { let x = 0, y = 0; for (let j = 0; j < k; j++) { x += C[i][j] * vecs[0][j]; y += C[i][j] * vecs[1][j]; } return { x, y }; });
}
function x2Stress(P, D, iters, rnd, wp) {
  const wpow = wp || 2;
  const n = P.length;
  for (let it = 0; it < iters; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      const pi = P[i], Di = D[i]; let nx = 0, ny = 0, den = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const pj = P[j], d = Di[j], w = wpow === 2 ? 1 / (d * d) : Math.pow(d, -wpow); let dx = pi.x - pj.x, dy = pi.y - pj.y, cur = Math.sqrt(dx * dx + dy * dy);
        if (cur < 1e-3) { dx = rnd() - 0.5; dy = rnd() - 0.5; cur = Math.sqrt(dx * dx + dy * dy); }
        nx += w * (pj.x + d * dx / cur); ny += w * (pj.y + d * dy / cur); den += w;
      }
      const qx = nx / den, qy = ny / den; moved += Math.abs(qx - pi.x) + Math.abs(qy - pi.y); pi.x = qx; pi.y = qy;
    }
    if (moved / n < 0.05) break;
  }
}
// Leaves: classes with exactly one link, and whose neighbour has another link (so pairs are kept).
function x2Leaves(n, EE) {
  const deg = new Array(n).fill(0); EE.forEach((e) => { deg[e.s]++; deg[e.t]++; });
  const leafOf = new Array(n).fill(-1);
  EE.forEach((e) => { if (deg[e.s] === 1 && deg[e.t] > 1) leafOf[e.s] = e.t; else if (deg[e.t] === 1 && deg[e.s] > 1) leafOf[e.t] = e.s; });
  return leafOf;
}
// Put each leaf back beside its parent: in the widest free directions round the parent, as close as the boxes allow.
// improve=true: every leaf is already placed; move one only when the new spot is cheaper than where it is.
function x2PlaceLeaves(P, N, EE, leafOf, L, gap, improve) {
  const n = P.length, kids = new Map();
  leafOf.forEach((p, v) => { if (p >= 0) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(v); } });
  const placed = new Uint8Array(n); for (let v = 0; v < n; v++) if (improve || leafOf[v] < 0) placed[v] = 1;
  const freeAt = (v, c) => { for (let u = 0; u < n; u++) if (u !== v && placed[u] && Math.abs(P[u].x - c.x) < (N[u].w + N[v].w) / 2 + gap && Math.abs(P[u].y - c.y) < (N[u].h + N[v].h) / 2 + gap) return false; return true; };
  const costAt = (v, p, c, cur) => {
    let x = 0, t = 0;
    for (const e of cur) {
      if (_ogClSegBox(P[e.s].x - c.x, P[e.s].y - c.y, P[e.t].x - c.x, P[e.t].y - c.y, N[v].w / 2 + 4, N[v].h / 2 + 4)) t++;
      if (e.s === p || e.t === p) continue; if (_ogClSegX(P[p], c, P[e.s], P[e.t])) x++;
    }
    for (let u = 0; u < n; u++) if (placed[u] && u !== p && u !== v && _ogClSegBox(P[p].x - P[u].x, P[p].y - P[u].y, c.x - P[u].x, c.y - P[u].y, N[u].w / 2 + 4, N[u].h / 2 + 4)) t++;
    return 100 * x + 80 * t + Math.hypot(c.x - P[p].x, c.y - P[p].y);
  };
  const order = [...kids.keys()].sort((a, b) => kids.get(b).length - kids.get(a).length);
  for (const p of order) {
    const ks = kids.get(p).sort((a, b) => N[b].w - N[a].w);
    for (const v of ks) {
      const cur = EE.filter((e) => placed[e.s] && placed[e.t] && e.s !== v && e.t !== v);
      let best = improve ? { cost: costAt(v, p, P[v], cur) - 6, c: P[v] } : null;
      for (let a = 0; a < 48; a++) {
        const th = a * Math.PI / 24;
        let tries = 0;
        for (let r = (N[p].w + N[v].w) / 4 + 30; r < L * 3.5 && tries < 6; r += 18) {
          const c = { x: P[p].x + Math.cos(th) * r, y: P[p].y + Math.sin(th) * r * 0.75 };
          if (!freeAt(v, c)) continue;
          tries++;
          const cost = costAt(v, p, c, cur);
          if (!best || cost < best.cost) best = { cost, c };
          if (cost < 100) break; // nearest clean spot in this direction
        }
      }
      if (best) P[v] = best.c; placed[v] = 1;
    }
  }
}
function x2Make(cfg) {
  return (items, edges, opts) => {
    const n = items.length; if (n < 2 || !edges.length) return null;
    const o = opts || {}, sc = o.roomy ? 1.3 : 1, L = (cfg.L || 170) * sc, seed = o.seed || 1, rnd = _ogClRng(seed * 31 + 7);
    const N = items.map((it) => ({ w: it.w + 16 * sc, h: it.h + 12 * sc }));
    const EE = edges.filter(([a, b]) => a !== b).map(([a, b, w]) => ({ s: a, t: b, sub: w === 2 }));
    if (!EE.length) return null;
    const t0 = performance.now(), budget = cfg.budget || 1500, left = () => Math.max(30, budget - (performance.now() - t0));
    const leafOf = cfg.leaves ? x2Leaves(n, EE) : new Array(n).fill(-1);
    const core = [...Array(n).keys()].filter((v) => leafOf[v] < 0), ci = new Map(core.map((v, k) => [v, k])), m = core.length;
    const nb = Array.from({ length: n }, () => new Set()); EE.forEach((e) => { nb[e.s].add(e.t); nb[e.t].add(e.s); });
    const leafCount = new Array(n).fill(0); leafOf.forEach((p) => { if (p >= 0) leafCount[p]++; });
    const adj = Array.from({ length: m }, () => []);
    // hub room: a class with k links needs a ring of radius k * (mean box width + gap) / 2π to hold its neighbours side by side
    const ring = new Array(n).fill(0);
    if (cfg.hub) for (let v = 0; v < n; v++) { let s = 0; nb[v].forEach((u) => (s += Math.max(N[u].w, N[u].h * 2.5) + cfg.hub)); ring[v] = s / (2 * Math.PI); }
    let com = null;
    let member = null;
    if (cfg.pods) {
      const E3 = EE.map((e) => [e.s, e.t, 1]);
      com = cfg.gamma ? x2LouvainG(n, E3, cfg.gamma) : _ogClLouvain(n, E3); com = _ogClMergeSmall(com, E3, cfg.podMin || 4);
      if (cfg.overlap) {
        // a class also belongs to any group holding at least cfg.overlap of its links
        member = com.map((c) => new Set([c]));
        nb.forEach((set, v) => { const cnt = new Map(); set.forEach((u) => cnt.set(com[u], (cnt.get(com[u]) || 0) + 1)); cnt.forEach((k, c) => { if (k / set.size >= cfg.overlap) member[v].add(c); }); });
      }
    }
    EE.forEach((e) => {
      if (!ci.has(e.s) || !ci.has(e.t)) return;
      let len = L * (e.sub ? 0.9 : 1);
      if (cfg.hub) len = Math.max(len, Math.min(cfg.hubCap || 3 * L, Math.max(ring[e.s], ring[e.t]) * (cfg.hubF || 1)));
      if (com) { const same = member ? [...member[e.s]].some((c) => member[e.t].has(c)) : com[e.s] === com[e.t]; len *= same ? (cfg.podIn || 0.85) : cfg.pods; }
      if (cfg.lenMode === 'jacc') { const a = nb[e.s], b = nb[e.t]; let inter = 0; a.forEach((x) => { if (b.has(x)) inter++; }); const uni = a.size + b.size - inter; len *= 0.75 + 0.5 * (1 - inter / uni); }
      if (cfg.lenMode === 'deg') len *= 0.8 + 0.12 * Math.sqrt(nb[e.s].size + nb[e.t].size);
      if (cfg.leafRoom) len += cfg.leafRoom * (Math.sqrt(leafCount[e.s]) + Math.sqrt(leafCount[e.t]));
      len += (cfg.wRoom || 0) * ((N[e.s].w + N[e.t].w) / 2 - 120);
      adj[ci.get(e.s)].push([ci.get(e.t), len]); adj[ci.get(e.t)].push([ci.get(e.s), len]);
    });
    const tp=()=>globalThis.PROF&&console.log('  t', (performance.now()-t0).toFixed(0)); tp();
    const D = x2Dijkstra(m, adj); tp();
    if (cfg.hubNear) {
      let avg = 0; core.forEach((v) => (avg += nb[v].size / m)); const hubs = core.filter((v) => nb[v].size >= Math.max(6, 2.5 * avg)).map((v) => ci.get(v));
      hubs.forEach((a) => hubs.forEach((b) => { if (a !== b) D[a][b] = Math.min(D[a][b], L * cfg.hubNear); }));
    }
    const NC = core.map((v) => N[v]), EC = EE.filter((e) => ci.has(e.s) && ci.has(e.t)).map((e) => ({ s: ci.get(e.s), t: ci.get(e.t), sub: e.sub }));
    const restarts = cfg.restarts != null ? cfg.restarts : (m <= 30 ? 8 : m <= 80 ? 4 : 2), countX = EC.length <= 2500;
    let best = null;
    for (let r = 0; r < Math.max(1, restarts) && (r === 0 || performance.now() - t0 < budget * (cfg.initShare || 0.4)); r++) {
      const PC = (cfg.init === 'pmds' && r === 0) || cfg.init === 'pmdsAll' ? x2PivotMDS(D, m, rnd) : NC.map(() => ({ x: (rnd() - 0.5) * 400, y: (rnd() - 0.5) * 400 }));
      tp(); x2Stress(PC, D, cfg.iters || 120, rnd, cfg.wPow); tp(); _ogClSeparate(PC, NC, 12, 120); tp();
      const x = countX ? _ogClCrossings(PC, EC) : 0; tp(); if (!best || x < best.x) best = { x, P: PC };
    }
    const PC = best.P; tp();
    if (countX && cfg.clean !== false) {
      _ogClFinCross(PC, NC, EC, cfg.crossMs || (m <= 30 ? 150 : 300), seed); _ogClSeparate(PC, NC, 12, 120);
      _ogClFinThru(PC, NC, EC, 12, 10, left() / 3); _ogClFinTight(PC, NC, EC, 12, 26 * sc, left() / 2); _ogClFinThru(PC, NC, EC, 8, 10, left() / 2);
    }
    tp(); const P = new Array(n); core.forEach((v, k) => (P[v] = PC[k]));
    for (let v = 0; v < n; v++) if (!P[v]) P[v] = { x: 0, y: 0 };
    if (cfg.leafFix) x2PlaceLeaves(P, N, EE, x2Leaves(n, EE), L, 10, true);
    if (cfg.leaves) {
      x2PlaceLeaves(P, N, EE, leafOf, L, 10); tp();
      if (cfg.leaves === 2) x2PlaceLeaves(P, N, EE, leafOf, L, 10, true);
      if (cfg.finalClean) { _ogClFinThru(P, N, EE, 6, 10, left() / 2); _ogClFinTight(P, N, EE, 6, 26 * sc, left()); }
    }
    tp(); return { pos: P, crossings: 0 };
  };
}
const EXP = {
  engines(O) {
    return {
      c2: x2Make({}),
      c2p: x2Make({ init: 'pmds' }),
      c2l: x2Make({ leaves: true }),
      c2lf: x2Make({ leaves: true, finalClean: true }),
      c2lr: x2Make({ leaves: true, leafRoom: 25, finalClean: true }),
      c2j: x2Make({ lenMode: 'jacc' }),
      c2d: x2Make({ lenMode: 'deg' }),
      c2pl: x2Make({ init: 'pmds', leaves: true, leafRoom: 25, finalClean: true }),
      hub: x2Make({ init: 'pmds', hub: 20 }),
      hubl: x2Make({ init: 'pmds', hub: 20, leaves: true, finalClean: true }),
      pod: x2Make({ init: 'pmds', pods: 1.6 }),
      podh: x2Make({ init: 'pmds', pods: 1.6, hub: 20 }),
      podhl: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true }),
      L220: x2Make({ init: 'pmds', L: 220 }),
      podhlnf: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: true }),
      fix: x2Make({ init: 'pmds', leafFix: true }),
      podfix: x2Make({ init: 'pmds', pods: 1.6, leafFix: true }),
      podhfix: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leafFix: true }),
      podhl2x: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: 2, finalClean: true }),
      podhlr: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: 2, leafRoom: 20, finalClean: true }),
      pL200: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true, L: 200 }),
      pL240: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true, L: 240 }),
      pL240f: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leafFix: true, L: 240 }),
      pL280: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true, L: 280 }),
      floor: x2Make({ init: 'pmds', pods: 1.6, hub: 20, restarts: 30, budget: 20000, initShare: 0.5, crossMs: 6000 }),
      hn: x2Make({ init: 'pmds', hubNear: 1.2, leafFix: true }),
      hn2: x2Make({ init: 'pmds', hubNear: 0.8, leafFix: true }),
      hnp: x2Make({ init: 'pmds', hubNear: 1.2, pods: 1.6, hub: 20, leaves: true, finalClean: true }),
      w1: x2Make({ init: 'pmds', wPow: 1, leafFix: true }),
      w1p: x2Make({ init: 'pmds', wPow: 1, pods: 1.6, hub: 20, leaves: true, finalClean: true }),
      podhl4s: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true, budget: 4000 }),
      podhl2: x2Make({ init: 'pmds', pods: 2.2, hub: 20, leaves: true, finalClean: true }),
      podhlr1: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true, restarts: 1 }),
      podhlR: x2Make({ init: 'pmdsAll', pods: 1.6, hub: 20, leaves: true, finalClean: true, restarts: 1 })
    };
  }
};
function x2Score(P, N, EE) {
  const m = _ogPlacementMetrics(P, N, EE); let na = 0; N.forEach((d) => (na += d.w * d.h)); m.fill = m.area / na;
  const ls = EE.map((e) => Math.hypot(P[e.s].x - P[e.t].x, P[e.s].y - P[e.t].y)).sort((a, b) => a - b), med = ls[ls.length >> 1] || 1;
  let lout = 0; ls.forEach((l) => (lout += Math.max(0, l / med - 1.8)));
  return 10 * m.cross + 8 * m.thru + 2 * m.near + 40 * m.ov + m.len / 10 + Math.max(0, m.len - 350) / 2 + Math.max(0, m.fill - 8) * 4 * Math.sqrt(P.length) + 25 * lout;
}
function x2Portfolio(cfgs, total) {
  return (items, edges, opts) => {
    const n = items.length, o = opts || {}, sc = o.roomy ? 1.3 : 1, N = items.map((it) => ({ w: it.w + 16 * sc, h: it.h + 12 * sc }));
    const EE = edges.filter(([a, b]) => a !== b).map(([a, b]) => ({ s: a, t: b }));
    const list = typeof cfgs === 'function' ? cfgs(n, EE.length) : cfgs; let best = null; const t0 = performance.now();
    list.forEach((c, k) => {
      const share = (total || 1500) / list.length;
      if (k && performance.now() - t0 > (total || 1500) * 1.1) return;
      const r = x2Make({ ...c, budget: c.budget || share })(items, edges, o); if (!r) return;
      const s = x2Score(r.pos, N, EE); if (!best || s < best.s) best = { s, pos: r.pos, algo: c.name || String(k) };
    });
    return best && { pos: best.pos, crossings: 0, algo: best.algo };
  };
}
const X2C = {
  fix: { name: 'fix', init: 'pmds', leafFix: true },
  old: { name: 'old' },
  hl: { name: 'hl', init: 'pmds', hub: 20, leaves: true, finalClean: true },
  lv: { name: 'lv', init: 'pmds', leaves: true, finalClean: true },
  podfix: { name: 'podfix', init: 'pmds', pods: 1.6, leafFix: true },
  podhl: { name: 'podhl', init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true },
  podhlB: { name: 'podhlB', init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true, L: 260 }
};
const _engOld = EXP.engines;
EXP.engines = (O) => ({ ..._engOld(O),
  pfA: x2Portfolio([X2C.fix, X2C.old, X2C.hl]),
  pfB: x2Portfolio([X2C.fix, X2C.lv, X2C.podhl]),
  pfC: x2Portfolio([X2C.fix, X2C.hl, X2C.podfix, X2C.podhl]),
  pfD: x2Portfolio([X2C.fix, X2C.old, X2C.hl, X2C.lv, X2C.podfix, X2C.podhl], 3000),
  gB: x2Portfolio([X2C.podhlB], 2000),
  gC: x2Portfolio([X2C.podhl, X2C.podhlB], 2000)
});
const _engOld2 = EXP.engines;
EXP.engines = (O) => ({ ..._engOld2(O),
  cpt: x2Portfolio((n) => n <= 60 ? [X2C.fix, X2C.old, X2C.hl, X2C.lv] : [X2C.fix], 1500),
  grp: x2Portfolio((n) => [{ ...X2C.podhl, L: n >= 100 ? 260 : 170 }], 2000),
  au: x2Portfolio((n) => n <= 40 ? [X2C.fix, X2C.old, X2C.hl, X2C.lv, X2C.podhl] : n <= 100 ? [X2C.hl, X2C.podhl, X2C.fix] : [{ ...X2C.podhl, L: 260 }], 2000)
});
// Public baseline: plain stress majorization (as Graphviz neato) from a pivot-MDS start, then overlap removal only.
const _engOld3 = EXP.engines;
EXP.engines = (O) => ({ ..._engOld3(O), neato: x2Make({ init: 'pmds', clean: false, restarts: 1 }) });
// Clustering alternatives for the pods: Louvain with a resolution parameter, and overlapping membership.
function x2LouvainG(n, E, gamma) {
  let comOfNode = [...Array(n).keys()], curN = n, curE = E;
  for (let level = 0; level < 6; level++) {
    const adj = Array.from({ length: curN }, () => []), loops = Array(curN).fill(0); let m2 = 0;
    curE.forEach(([a, b, w]) => { m2 += 2 * w; if (a === b) { loops[a] += 2 * w; return; } adj[a].push([b, w]); adj[b].push([a, w]); });
    if (!m2) break;
    const deg = adj.map((l, i) => l.reduce((s, [, w]) => s + w, loops[i])), com = [...Array(curN).keys()], tot = deg.slice();
    let moved = true, pass = 0;
    while (moved && pass++ < 30) { moved = false;
      for (let i = 0; i < curN; i++) { const ci = com[i], wc = new Map(); adj[i].forEach(([j, w]) => wc.set(com[j], (wc.get(com[j]) || 0) + w));
        tot[ci] -= deg[i]; let best = ci, bg = (wc.get(ci) || 0) - gamma * tot[ci] * deg[i] / m2;
        wc.forEach((w, c) => { const g = w - gamma * tot[c] * deg[i] / m2; if (g > bg + 1e-12) { bg = g; best = c; } });
        tot[best] += deg[i]; if (best !== ci) { com[i] = best; moved = true; } } }
    const ids = new Map(); com.forEach((c) => { if (!ids.has(c)) ids.set(c, ids.size); });
    if (ids.size === curN) break;
    comOfNode = comOfNode.map((c) => ids.get(com[c]));
    const agg = new Map(); curE.forEach(([a, b, w]) => { const x = ids.get(com[a]), y = ids.get(com[b]); const k = x < y ? x + ',' + y : y + ',' + x; agg.set(k, (agg.get(k) || 0) + w); });
    curE = [...agg].map(([k, w]) => { const [x, y] = k.split(',').map(Number); return [x, y, w]; }); curN = ids.size;
  }
  return comOfNode;
}

const _engOld4 = EXP.engines;
EXP.engines = (O) => ({ ..._engOld4(O),
  myc: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true }),
  mycOv30: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true, overlap: 0.3 }),
  mycG07: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true, gamma: 0.7 }),
  mycG15: x2Make({ init: 'pmds', pods: 1.6, hub: 20, leaves: true, finalClean: true, gamma: 1.5 }),
  mycNoPods: x2Make({ init: 'pmds', hub: 20, leaves: true, finalClean: true })
});
