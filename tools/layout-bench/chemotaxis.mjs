// Experiment: "Mycelium Chemotaxis" (prune, Pivot-MDS on the core, hunger/food chemotaxis, sprouting, clean-up) against our layouts.
// Not part of the library. Run mkbundle.mjs first.
//   node chemotaxis.mjs <graph keys comma | set: dev|held|public|big> <out.json>
//   env CH_PARAMS='{"eta":0.3,"gamma":0.05,"iters":30}' overrides the constants the spec leaves open.
import fs from 'node:fs';
const { MODELS, OURS: O } = await import('./_bundle.mjs');
const stdMetrics = new Function(fs.readFileSync(new URL('./stdmetrics.js', import.meta.url), 'utf8') + '\nreturn stdMetrics;')();

const DEFAULT = { K: 4, L: 170, iters: 30, refresh: 10, eta: 0.35, gamma: 0.06, alpha: 1 / 170, beta: 1.0, cellF: 0.5, maxStep: 0.5, chemo: true };

// ── 1. prune: peel degree-1 classes whose hidden mass stays within K (leaves, leaf chains, small hanging trees) ──
function prune(n, EE, K) {
  const nb = Array.from({ length: n }, () => new Set()); EE.forEach((e) => { nb[e.s].add(e.t); nb[e.t].add(e.s); });
  const alive = new Uint8Array(n).fill(1), hidden = new Array(n).fill(1), parent = new Array(n).fill(-1);
  const q = []; for (let v = 0; v < n; v++) if (nb[v].size === 1) q.push(v);
  let aliveN = n;
  while (q.length) {
    const v = q.shift(); if (!alive[v] || nb[v].size !== 1 || aliveN <= 2) continue;
    const [p] = nb[v]; if (hidden[v] + hidden[p] > K + 1 || hidden[v] > K) continue;   // p would hide more than K classes
    alive[v] = 0; aliveN--; parent[v] = p; hidden[p] += hidden[v]; nb[p].delete(v); nb[v].clear();
    if (nb[p].size === 1) q.push(p);
  }
  return { alive, parent, mass: hidden };
}

// ── 2. Pivot-MDS on the core (graph distances x link length) ──
function pivotMDS(m, adj, L, rnd) {
  const k = Math.min(m, 50), D = [];
  const bfs = (s) => { const d = new Float64Array(m).fill(-1); d[s] = 0; const q = [s]; for (let i = 0; i < q.length; i++) for (const w of adj[q[i]]) if (d[w] < 0) { d[w] = d[q[i]] + 1; q.push(w); } return d; };
  const piv = [Math.floor(rnd() * m)], dist = [], mind = new Float64Array(m).fill(Infinity);
  let mx = 0;
  while (piv.length < k) {
    const d = bfs(piv[piv.length - 1]); dist.push(d); d.forEach((x) => { if (x > mx) mx = x; });
    let b = -1, bi = 0; for (let i = 0; i < m; i++) { const x = d[i] < 0 ? Infinity : d[i]; mind[i] = Math.min(mind[i], x); if (mind[i] > b && isFinite(mind[i])) { b = mind[i]; bi = i; } }
    if (b <= 0) break; piv.push(bi);
  }
  while (dist.length < piv.length) dist.push(bfs(piv[dist.length]));
  const kk = piv.length, far = mx + 2;
  const C = Array.from({ length: m }, (_, i) => dist.map((d) => { const x = d[i] < 0 ? far : d[i]; return x * x; }));
  const rm = new Float64Array(m), cm = new Float64Array(kk); let all = 0;
  for (let i = 0; i < m; i++) for (let j = 0; j < kk; j++) { rm[i] += C[i][j] / kk; cm[j] += C[i][j] / m; all += C[i][j] / (m * kk); }
  for (let i = 0; i < m; i++) for (let j = 0; j < kk; j++) C[i][j] = -0.5 * (C[i][j] - rm[i] - cm[j] + all);
  const M = Array.from({ length: kk }, () => new Float64Array(kk));
  for (let a = 0; a < kk; a++) for (let b = 0; b < kk; b++) { let s = 0; for (let i = 0; i < m; i++) s += C[i][a] * C[i][b]; M[a][b] = s; }
  const vecs = [];
  for (let e = 0; e < 2; e++) {
    let v = Array.from({ length: kk }, () => rnd() - 0.5);
    for (let it = 0; it < 200; it++) {
      const w = new Float64Array(kk); for (let a = 0; a < kk; a++) { let s = 0; for (let b = 0; b < kk; b++) s += M[a][b] * v[b]; w[a] = s; }
      vecs.forEach((u) => { let dt = 0; for (let a = 0; a < kk; a++) dt += w[a] * u[a]; for (let a = 0; a < kk; a++) w[a] -= dt * u[a]; });
      let nr = 0; for (let a = 0; a < kk; a++) nr += w[a] * w[a]; nr = Math.sqrt(nr) || 1; v = Array.from(w, (x) => x / nr);
    }
    vecs.push(v);
  }
  const P = Array.from({ length: m }, (_, i) => { let x = 0, y = 0; for (let j = 0; j < kk; j++) { x += C[i][j] * vecs[0][j]; y += C[i][j] * vecs[1][j]; } return { x, y }; });
  let mx0 = 0, my0 = 0; P.forEach((p) => { mx0 += p.x / m; my0 += p.y / m; }); P.forEach((p) => { p.x -= mx0; p.y -= my0; });
  let num = 0, den = 0;
  for (let i = 0; i < m; i++) piv.forEach((p, j) => { const d = Math.hypot(P[i].x - P[p].x, P[i].y - P[p].y), t = dist[j][i]; if (t >= 0) { num += t * L * d; den += d * d; } });
  const s = den > 0 ? num / den : 1; P.forEach((p) => { p.x *= s; p.y *= s; });
  return P;
}

// ── 3. environment: grid, problems per class, hunger, food ──
function problems(P, N, EE) {
  const n = P.length, C = new Float64Array(n), T = new Float64Array(n), Ov = new Float64Array(n);
  const cr = new Uint8Array(EE.length);
  for (let i = 0; i < EE.length; i++) for (let j = i + 1; j < EE.length; j++) {
    const e = EE[i], f = EE[j]; if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue;
    if (O.segX(P[e.s], P[e.t], P[f.s], P[f.t])) cr[i] = cr[j] = 1;
  }
  EE.forEach((e, k) => { if (cr[k]) { C[e.s]++; C[e.t]++; } });
  EE.forEach((e) => {
    const A = P[e.s], B = P[e.t];
    for (let i = 0; i < n; i++) {
      if (i === e.s || i === e.t) continue;
      const hw = N[i].w / 2 + 6, hh = N[i].h / 2 + 6, ax = A.x - P[i].x, ay = A.y - P[i].y, bx = B.x - P[i].x, by = B.y - P[i].y;
      if ((ax < -hw && bx < -hw) || (ax > hw && bx > hw) || (ay < -hh && by < -hh) || (ay > hh && by > hh)) continue;
      if (O.segBox(ax, ay, bx, by, hw, hh)) T[i]++;
    }
  });
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(P[i].x - P[j].x) < (N[i].w + N[j].w) / 2 && Math.abs(P[i].y - P[j].y) < (N[i].h + N[j].h) / 2) { Ov[i]++; Ov[j]++; }
  return Array.from(C, (c, i) => 10 * c + 8 * T[i] + 40 * Ov[i]);
}
class Grid {
  constructor(P, N, EE, cell, pad) {
    let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18;
    P.forEach((p, i) => { x1 = Math.min(x1, p.x - N[i].w / 2); x2 = Math.max(x2, p.x + N[i].w / 2); y1 = Math.min(y1, p.y - N[i].h / 2); y2 = Math.max(y2, p.y + N[i].h / 2); });
    this.c = cell; this.x0 = x1 - pad; this.y0 = y1 - pad; this.W = Math.ceil((x2 - x1 + 2 * pad) / cell) + 1; this.H = Math.ceil((y2 - y1 + 2 * pad) / cell) + 1;
    this.rho = new Float32Array(this.W * this.H); this.cx = (x1 + x2) / 2; this.cy = (y1 + y2) / 2;
    this.rad = Math.hypot(x2 - x1, y2 - y1) / 2 + pad;
    for (const e of EE) {   // links: 0.25 along the line
      const A = P[e.s], B = P[e.t], len = Math.hypot(A.x - B.x, A.y - B.y), st = Math.max(1, Math.ceil(len / (cell / 2)));
      for (let s = 0; s <= st; s++) { const gx = this.gx(A.x + (B.x - A.x) * s / st), gy = this.gy(A.y + (B.y - A.y) * s / st), k = gy * this.W + gx; if (this.rho[k] < 0.25) this.rho[k] = 0.25; }
    }
    P.forEach((p, i) => this.stamp(p, N[i]));
  }
  gx(x) { return Math.max(0, Math.min(this.W - 1, Math.floor((x - this.x0) / this.c))); }
  gy(y) { return Math.max(0, Math.min(this.H - 1, Math.floor((y - this.y0) / this.c))); }
  stamp(p, n) { for (let gy = this.gy(p.y - n.h / 2); gy <= this.gy(p.y + n.h / 2); gy++) for (let gx = this.gx(p.x - n.w / 2); gx <= this.gx(p.x + n.w / 2); gx++) this.rho[gy * this.W + gx] = 1; }
  raw(gx, gy, beta) { if (gx < 0 || gy < 0 || gx >= this.W || gy >= this.H) return 0.0; const x = this.x0 + (gx + 0.5) * this.c, y = this.y0 + (gy + 0.5) * this.c; return Math.max(0, 1 - this.rho[gy * this.W + gx]) * (1 + beta * Math.hypot(x - this.cx, y - this.cy) / this.rad); }
  food(gx, gy, beta) {   // Laplacian-style smoothing kernel [.5 1 .5; 1 2 1; .5 1 .5] / 8, on the fly
    const K = [[0.5, 1, 0.5], [1, 2, 1], [0.5, 1, 0.5]]; let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += K[dy + 1][dx + 1] * this.raw(gx + dx, gy + dy, beta);
    return s / 8;
  }
  bake(beta) { this.phi = new Float32Array(this.W * this.H); for (let gy = 0; gy < this.H; gy++) for (let gx = 0; gx < this.W; gx++) this.phi[gy * this.W + gx] = this.food(gx, gy, beta); }
  grad(p) { const gx = Math.max(1, Math.min(this.W - 2, this.gx(p.x))), gy = Math.max(1, Math.min(this.H - 2, this.gy(p.y))), f = (a, b) => this.phi[b * this.W + a];
    return { x: f(gx + 1, gy) - f(gx - 1, gy), y: f(gx, gy + 1) - f(gx, gy - 1) }; }
}

// ── the algorithm ──
function chemotaxis(items, edges, seed, N, prm) {
  const o = { ...DEFAULT, ...prm }, n = items.length, L = o.L, rnd = O.rng(seed * 31 + 7), st = {};
  const EE = edges.filter(([a, b]) => a !== b).map(([a, b]) => ({ s: a, t: b }));
  let t = performance.now();
  const { alive, parent, mass } = prune(n, EE, o.K);
  const core = [...Array(n).keys()].filter((v) => alive[v]), ci = new Map(core.map((v, k) => [v, k])), m = core.length;
  const CE = EE.filter((e) => alive[e.s] && alive[e.t]).map((e) => ({ s: ci.get(e.s), t: ci.get(e.t) }));
  const CN = core.map((v) => N[v]); const adj = Array.from({ length: m }, () => []); CE.forEach((e) => { adj[e.s].push(e.t); adj[e.t].push(e.s); });
  st.core = m; st.prune = +(performance.now() - t).toFixed(1); t = performance.now();
  let P = o.start ? core.map((v) => ({ x: o.start[v].x, y: o.start[v].y })) : pivotMDS(m, adj, L, rnd); st.mds = +(performance.now() - t).toFixed(1); t = performance.now();
  if (m > 1 && !o.start) O.sep(P, CN, 6, 200);
  const w = core.map((v) => mass[v]);
  const cell = o.cellF * L;
  if (o.chemo && m > 2) {
    let hung = null, grid = null;
    for (let it = 0; it < o.iters; it++) {
      if (it % o.refresh === 0) {
        const Pi = problems(P, CN, CE);
        hung = P.map((p, i) => { let h = 1 + Pi[i]; for (let j = 0; j < m; j++) if (j !== i && Pi[j]) h += Pi[j] * Math.exp(-o.alpha * Math.hypot(p.x - P[j].x, p.y - P[j].y)); return h; });
        const hm = Math.max(...hung); hung = hung.map((h) => h / hm);   // relative hunger, so eta and gamma are scale-free
        grid = new Grid(P, CN, CE, cell, 3 * L); grid.bake(o.beta);
      }
      const D = P.map(() => ({ x: 0, y: 0 }));
      for (let i = 0; i < m; i++) {
        const g = grid.grad(P[i]), gl = Math.hypot(g.x, g.y) || 1;
        let dx = o.eta * hung[i] * L * g.x / gl, dy = o.eta * hung[i] * L * g.y / gl;
        let rx = 0, ry = 0;
        for (let j = 0; j < m; j++) { if (j === i) continue; const ex = P[i].x - P[j].x, ey = P[i].y - P[j].y, d = Math.max(20, Math.hypot(ex, ey)); const f = w[i] * w[j] / (d * d); rx += f * ex / d; ry += f * ey / d; }
        dx += o.gamma * hung[i] * L * L * rx; dy += o.gamma * hung[i] * L * L * ry;
        const l = Math.hypot(dx, dy), cap = o.maxStep * L; if (l > cap) { dx *= cap / l; dy *= cap / l; }
        D[i] = { x: dx, y: dy };
      }
      for (let i = 0; i < m; i++) { P[i].x += D[i].x; P[i].y += D[i].y; }
    }
    st.chemo = +(performance.now() - t).toFixed(1); t = performance.now();
  }
  // ── 5. sprouting: each hidden class goes in the open direction (highest food along a ray) beside its parent ──
  const Q = new Array(n); core.forEach((v, k) => (Q[v] = { x: P[k].x, y: P[k].y }));
  const all = Array.from({ length: n }, (_, v) => v), childrenOf = Array.from({ length: n }, () => []);
  for (let v = 0; v < n; v++) if (!alive[v]) childrenOf[parent[v]].push(v);
  const CorePos = core.map((v) => Q[v]), grid = new Grid(CorePos, CN, CE, cell, 3 * L); grid.bake(o.beta);
  const order = []; core.forEach((v) => order.push(v)); for (let i = 0; i < order.length; i++) for (const c of childrenOf[order[i]]) order.push(c);
  const NR = 16;
  for (const u of order) {
    for (const c of childrenOf[u]) {
      let best = -1, bs = -1;
      for (let a = 0; a < NR; a++) {
        const ang = 2 * Math.PI * a / NR; let s = 0;
        for (let r = 0.4; r <= 1.6; r += 0.4) { const x = Q[u].x + Math.cos(ang) * r * L, y = Q[u].y + Math.sin(ang) * r * L; s += grid.food(grid.gx(x), grid.gy(y), o.beta) * (2 - r / 1.6); }
        if (s > bs) { bs = s; best = ang; }
      }
      const hw = (N[u].w + N[c].w) / 2, hh = (N[u].h + N[c].h) / 2, ca = Math.abs(Math.cos(best)), sa = Math.abs(Math.sin(best));
      const reach = Math.min(ca > 1e-6 ? hw / ca : Infinity, sa > 1e-6 ? hh / sa : Infinity) + 40;
      Q[c] = { x: Q[u].x + Math.cos(best) * reach, y: Q[u].y + Math.sin(best) * reach };
      grid.stamp(Q[c], N[c]);
    }
  }
  st.sprout = +(performance.now() - t).toFixed(1);
  O.sep(Q, N, 6, 200);
  return { pos: Q, st };
}


// ── Variant B ("halo hopping"): pruned core, inflated distances D' = D + R(i) + R(j), 25 stress sweeps, vacancy hops for the top 5%
// conflicted classes (delta cost < 0 only), sprouting into the halos, one 50 ms clean-up. Spec pasted by the user, 2026-11-07. ──
function haloHop(items, edges, seed, N, prm) {
  const o = { L: 170, K: 4, sweeps: 25, top: 0.05, clear: 1.2, cleanMs: 50, hop: true, inflate: true, ...prm }, n = items.length, L = o.L, rnd = O.rng(seed * 31 + 7), st = {};
  const EE = edges.filter(([a, b]) => a !== b).map(([a, b]) => ({ s: a, t: b }));
  let t = performance.now();
  const { alive, parent, mass } = prune(n, EE, o.K);
  const core = [...Array(n).keys()].filter((v) => alive[v]), ci = new Map(core.map((v, k) => [v, k])), m = core.length;
  const CE = EE.filter((e) => alive[e.s] && alive[e.t]).map((e) => ({ s: ci.get(e.s), t: ci.get(e.t) })), CN = core.map((v) => N[v]);
  const adj = Array.from({ length: m }, () => []); CE.forEach((e) => { adj[e.s].push(e.t); adj[e.t].push(e.s); });
  const R = core.map((v) => (o.inflate ? Math.sqrt(mass[v] - 1) * L / Math.PI : 0));
  const D = Array.from({ length: m }, () => new Float64Array(m)); let mx = 0;
  for (let s0 = 0; s0 < m; s0++) { const d = new Float64Array(m).fill(-1); d[s0] = 0; const q = [s0]; for (let i = 0; i < q.length; i++) for (const w of adj[q[i]]) if (d[w] < 0) { d[w] = d[q[i]] + 1; q.push(w); } for (let j = 0; j < m; j++) { D[s0][j] = d[j]; if (d[j] > mx) mx = d[j]; } }
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) D[i][j] = i === j ? 0 : (D[i][j] < 0 ? mx + 2 : D[i][j]) * L + R[i] + R[j];
  const k = Math.min(m, 50), piv = [Math.floor(rnd() * m)], mind = new Float64Array(m).fill(Infinity);
  while (piv.length < k) { const p = piv[piv.length - 1]; let b = -1, bi = 0; for (let i = 0; i < m; i++) { mind[i] = Math.min(mind[i], D[p][i]); if (mind[i] > b) { b = mind[i]; bi = i; } } if (b <= 0) break; piv.push(bi); }
  const kk = piv.length, C = Array.from({ length: m }, (_, i) => piv.map((p) => D[i][p] * D[i][p])), rm = new Float64Array(m), cm = new Float64Array(kk); let all = 0;
  for (let i = 0; i < m; i++) for (let j = 0; j < kk; j++) { rm[i] += C[i][j] / kk; cm[j] += C[i][j] / m; all += C[i][j] / (m * kk); }
  for (let i = 0; i < m; i++) for (let j = 0; j < kk; j++) C[i][j] = -0.5 * (C[i][j] - rm[i] - cm[j] + all);
  const M = Array.from({ length: kk }, () => new Float64Array(kk));
  for (let a = 0; a < kk; a++) for (let b = 0; b < kk; b++) { let q = 0; for (let i = 0; i < m; i++) q += C[i][a] * C[i][b]; M[a][b] = q; }
  const vecs = [];
  for (let e = 0; e < 2; e++) {
    let v = Array.from({ length: kk }, () => rnd() - 0.5);
    for (let it = 0; it < 200; it++) { const w = new Float64Array(kk); for (let a = 0; a < kk; a++) { let q = 0; for (let b = 0; b < kk; b++) q += M[a][b] * v[b]; w[a] = q; }
      vecs.forEach((u) => { let dt = 0; for (let a = 0; a < kk; a++) dt += w[a] * u[a]; for (let a = 0; a < kk; a++) w[a] -= dt * u[a]; });
      let nr = 0; for (let a = 0; a < kk; a++) nr += w[a] * w[a]; nr = Math.sqrt(nr) || 1; v = Array.from(w, (x) => x / nr); }
    vecs.push(v);
  }
  const P = Array.from({ length: m }, (_, i) => { let x = 0, y = 0; for (let j = 0; j < kk; j++) { x += C[i][j] * vecs[0][j]; y += C[i][j] * vecs[1][j]; } return { x, y }; });
  { let num = 0, den = 0; for (let i = 0; i < m; i++) for (const p of piv) { const d = Math.hypot(P[i].x - P[p].x, P[i].y - P[p].y); num += D[i][p] * d; den += d * d; } const sc = den > 0 ? num / den : 1; P.forEach((p) => { p.x *= sc; p.y *= sc; }); }
  for (let it = 0; it < o.sweeps; it++) for (let i = 0; i < m; i++) { let nx = 0, ny = 0, dn = 0; for (let j = 0; j < m; j++) { if (i === j) continue; const d = D[i][j], w = 1 / (d * d), ex = P[i].x - P[j].x, ey = P[i].y - P[j].y, l = Math.hypot(ex, ey) || 1e-6; nx += w * (P[j].x + d * ex / l); ny += w * (P[j].y + d * ey / l); dn += w; } if (dn) { P[i].x = nx / dn; P[i].y = ny / dn; } }
  st.stress = +(performance.now() - t).toFixed(1); t = performance.now();
  let hops = 0, tried = 0;
  if (o.hop && m > 3) {
    const incident = Array.from({ length: m }, () => []); CE.forEach((e, k2) => { incident[e.s].push(k2); incident[e.t].push(k2); });
    const cost = (v, pos) => {   // 10 x crossings(v) + 8 x through(v) + 0.1 x length(v), with v at pos
      const old = P[v]; P[v] = pos; let c = 0, th = 0, len = 0;
      for (const k2 of incident[v]) {
        const e = CE[k2], A = P[e.s], B = P[e.t]; len += Math.hypot(A.x - B.x, A.y - B.y);
        for (let k3 = 0; k3 < CE.length; k3++) { const f = CE[k3]; if (k3 === k2 || f.s === e.s || f.s === e.t || f.t === e.s || f.t === e.t) continue; if (O.segX(A, B, P[f.s], P[f.t])) c++; }
        for (let i = 0; i < m; i++) { if (i === e.s || i === e.t) continue; const hw = CN[i].w / 2 + 6, hh = CN[i].h / 2 + 6, ax = A.x - P[i].x, ay = A.y - P[i].y, bx = B.x - P[i].x, by = B.y - P[i].y; if ((ax < -hw && bx < -hw) || (ax > hw && bx > hw) || (ay < -hh && by < -hh) || (ay > hh && by > hh)) continue; if (O.segBox(ax, ay, bx, by, hw, hh)) th++; }
      }
      const hw = CN[v].w / 2 + 6, hh = CN[v].h / 2 + 6;
      CE.forEach((f) => { if (f.s === v || f.t === v) return; const A = P[f.s], B = P[f.t], ax = A.x - pos.x, ay = A.y - pos.y, bx = B.x - pos.x, by = B.y - pos.y; if ((ax < -hw && bx < -hw) || (ax > hw && bx > hw) || (ay < -hh && by < -hh) || (ay > hh && by > hh)) return; if (O.segBox(ax, ay, bx, by, hw, hh)) th++; });
      P[v] = old; return 10 * c + 8 * th + 0.1 * len;
    };
    const Pi = problems(P, CN, CE), top = [...Array(m).keys()].sort((a, b) => Pi[b] - Pi[a]).slice(0, Math.max(3, Math.ceil(o.top * m))).filter((v) => Pi[v] > 0);
    const grid = new Grid(P, CN, CE, 0.5 * L, 3 * L);
    for (const v of top) {
      let cx = 0, cy = 0; adj[v].forEach((u) => { cx += P[u].x / adj[v].length; cy += P[u].y / adj[v].length; });
      const cand = [];
      for (let gy = 0; gy < grid.H; gy++) for (let gx = 0; gx < grid.W; gx++) {
        const x = grid.x0 + (gx + 0.5) * grid.c, y = grid.y0 + (gy + 0.5) * grid.c; let ok = true;
        for (let i = 0; i < m && ok; i++) if (i !== v && Math.hypot(P[i].x - x, P[i].y - y) < o.clear * L) ok = false;
        if (ok) cand.push({ x, y, d: Math.hypot(x - cx, y - cy) });
      }
      cand.sort((a, b) => a.d - b.d); let bc = cost(v, P[v]), best = null;
      for (const c of cand.slice(0, 24)) { tried++; const cc = cost(v, c); if (cc < bc) { bc = cc; best = c; } }
      if (best) { P[v] = { x: best.x, y: best.y }; hops++; }
    }
  }
  st.hop = +(performance.now() - t).toFixed(1); st.hops = hops + '/' + tried; t = performance.now();
  const Q = new Array(n); core.forEach((v, k2) => (Q[v] = { x: P[k2].x, y: P[k2].y }));
  const childrenOf = Array.from({ length: n }, () => []); for (let v = 0; v < n; v++) if (!alive[v]) childrenOf[parent[v]].push(v);
  const grid2 = new Grid(core.map((v) => Q[v]), CN, CE, 0.5 * L, 3 * L); grid2.bake(1);
  const order = core.slice(); for (let i = 0; i < order.length; i++) for (const c of childrenOf[order[i]]) order.push(c);
  for (const u of order) for (const c of childrenOf[u]) {
    let best = 0, bs = -1;
    for (let a = 0; a < 16; a++) { const ang = Math.PI * a / 8; let sc = 0; for (let r = 0.4; r <= 1.6; r += 0.4) sc += grid2.food(grid2.gx(Q[u].x + Math.cos(ang) * r * L), grid2.gy(Q[u].y + Math.sin(ang) * r * L), 1) * (2 - r / 1.6); if (sc > bs) { bs = sc; best = ang; } }
    const hw = (N[u].w + N[c].w) / 2, hh = (N[u].h + N[c].h) / 2, ca = Math.abs(Math.cos(best)), sa = Math.abs(Math.sin(best)), reach = Math.min(ca > 1e-6 ? hw / ca : Infinity, sa > 1e-6 ? hh / sa : Infinity) + 40;
    Q[c] = { x: Q[u].x + Math.cos(best) * reach, y: Q[u].y + Math.sin(best) * reach }; grid2.stamp(Q[c], N[c]);
  }
  O.sep(Q, N, 6, 200);
  st.sprout = +(performance.now() - t).toFixed(1);
  if (o.cleanMs) { const E2 = edges.map(([a, b]) => ({ s: a, t: b })); return { pos: O.tidy.run(Q, items, E2, { budgetMs: o.cleanMs }).P, st }; }
  return { pos: Q, st };
}

// ── harness ──
const SETS = { dev: ['prov', 'uni', 'hotel', 'org', 'brewery', 'trial', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'], held: ['hx_small', 'hx_mesh', 'hx_rome40', 'hx_rings', 'hx_hubs', 'hx_md70', 'hx_rome90', 'hx_tax', 'hx_md160', 'hx_md300'], public: ['pb_foaf', 'pb_time', 'pb_bfo', 'pb_dul', 'pb_saref', 'pb_gr', 'pb_rome1233', 'pb_rome7797'], big: ['huge', 'sf250', 'sf400', 'hx_md1200'] };
const arg = process.argv[2] || 'dev', keys = SETS[arg] || arg.split(','), prm = process.env.CH_PARAMS ? JSON.parse(process.env.CH_PARAMS) : {};
const withClean = (f) => (it, ed, s, N) => { const t0 = O.now(), P0 = f(it, ed, s, N), P = P0.map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200); return O.cleanUp(P, it, ed, t0, false); };
const ALGOS = {
  'Tidy Stress': (it, ed, s) => O.compact(it, ed, { seed: s }).pos,
  'Mycelium': (it, ed, s) => (O.grouped2(it, ed, { seed: s }) || O.compact(it, ed, { seed: s })).pos,
  'Best Read': (it, ed, s) => O.auto(it, ed, { seed: s }).pos,
  'Chemo': (it, ed, s, N) => chemotaxis(it, ed, s, N, prm).pos,
  'BestRead>Chemo(polish)': (it, ed, s, N) => { const S = O.auto(it, ed, { seed: s }).pos.map((p) => ({ x: p.x, y: p.y })); O.sep(S, N, 6, 200); return chemotaxis(it, ed, s, N, { ...prm, start: S, K: 0, eta: 0.1, gamma: 0.01, maxStep: 0.15, beta: 0 }).pos; },
  'HaloHop (spec B)': (it, ed, s, N) => haloHop(it, ed, s, N, prm).pos,
  'HaloHop no-hop': (it, ed, s, N) => haloHop(it, ed, s, N, { ...prm, hop: false }).pos,
  'HaloHop no-inflate': (it, ed, s, N) => haloHop(it, ed, s, N, { ...prm, inflate: false }).pos,
  'PruneMDS (no chemo)': (it, ed, s, N) => chemotaxis(it, ed, s, N, { ...prm, chemo: false }).pos
};
const rows = [];
for (const key of keys) {
  const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 })), items = D.map((d) => ({ w: d.w, h: d.h }));
  const edges = M.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), E = edges.map(([s, t]) => ({ s, t })), N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 }));
  const line = [];
  for (const [name, f] of Object.entries(ALGOS).filter(([k]) => !process.env.CH_ONLY || process.env.CH_ONLY.split(',').includes(k))) for (const clean of [false, true]) {
    const g = clean ? withClean(f) : f, label = name + (clean ? ' +cleanup' : '');
    // Best Read, Tidy Stress, Mycelium run their own start; clean-up is applied exactly as the bench does
    const t0 = performance.now(); let P = g(items, edges, 1, N); const ms = performance.now() - t0;
    P = P.map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200);
    const m = O.pmetrics(P, D.map((d) => ({ w: d.w + 6, h: d.h + 6 })), E), ml = O.pmetrics(P, N, E);
    rows.push({ key, algo: label, n: N.length, links: E.length, cross: m.cross, thru: m.thru, ov: ml.ov, fill: ml.fill, area: ml.area, len: m.len, score: O.pscore(ml), ms, ...stdMetrics(P, M.edges.filter((e) => e.s !== e.t).map((e) => ({ s: e.s, t: e.t, sub: e.kind === 'sub' }))), pos: P.map((q) => [Math.round(q.x), Math.round(q.y)]) });
    line.push(`${label}: x${m.cross} th${m.thru} ov${ml.ov} A${(ml.area / 1e6).toFixed(2)}M ${Math.round(ms)}ms`);
  }
  console.log(key, N.length + '/' + E.length + '\n  ' + line.join('\n  '));
}
fs.writeFileSync(process.argv[3] || new URL('../../_temp/chemo_' + arg + '.json', import.meta.url), JSON.stringify(rows));
// totals
const names = [...new Set(rows.map((r) => r.algo))];
console.log('\nTOTAL over', keys.length, 'graphs'); console.log('algo'.padEnd(34), 'cross', 'thru', 'ov', 'areaM', 'ms(sum)', 'best-or-tied(x+th)');
const prob = (r) => r.cross + r.thru;
for (const a of names) { const rs = rows.filter((r) => r.algo === a), wins = keys.filter((k) => prob(rows.find((r) => r.key === k && r.algo === a)) <= Math.min(...rows.filter((r) => r.key === k).map(prob))).length;
  console.log(a.padEnd(34), String(rs.reduce((s, r) => s + r.cross, 0)).padStart(5), String(rs.reduce((s, r) => s + r.thru, 0)).padStart(4), String(rs.reduce((s, r) => s + r.ov, 0)).padStart(3), (rs.reduce((s, r) => s + r.area, 0) / 1e6).toFixed(1).padStart(6), String(Math.round(rs.reduce((s, r) => s + r.ms, 0))).padStart(7), String(wins).padStart(4)); }
