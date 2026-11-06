// Experiment: subclass links point downward (child below parent), as separation constraints y_child >= y_parent + gap,
// after Dwyer, Koren and Marriott's constrained stress majorization (IPSep-CoLa), done here by simple projection after each sweep.
// Wraps the library's own functions: while X3.on is set, _ogStressLayout runs the copy below, and every candidate move the clean-up
// considers (_ogClFree, swaps in _ogClFinCross, one-link placement) must keep the constraints.
const X3 = { on: false, gap: 40, flow: null, squash: 0.75 };
const x3Orig = { stress: _ogStressLayout, free: _ogClFree, finCross: _ogClFinCross, leaves: _ogClPlaceLeaves };
// flow: { par: [[parents]], kid: [[children]], g } in the index space of the arrays being moved
function x3Ok(P, v, c, f) {
  if (!f) return true; const g = f.g * 0.5;
  for (const p of f.par[v] || []) if (c.y < P[p].y + g) return false;
  for (const k of f.kid[v] || []) if (P[k].y < c.y + g) return false;
  return true;
}
function x3FlowOf(n, EE, map) {
  const par = Array.from({ length: n }, () => []), kid = Array.from({ length: n }, () => []);
  EE.forEach((e) => { if (!e.sub) return; const c = map ? map.get(e.s) : e.s, p = map ? map.get(e.t) : e.t; if (c === undefined || p === undefined) return; par[c].push(p); kid[p].push(c); });
  return { par, kid, g: X3.gap };
}
function x3Project(P, f, rounds) {
  for (let r = 0; r < rounds; r++) {
    let worst = 0;
    f.par.forEach((ps, c) => ps.forEach((p) => { const v = P[p].y + f.g - P[c].y; if (v > 0) { P[c].y += v / 2; P[p].y -= v / 2; worst = Math.max(worst, v); } }));
    if (worst < 0.5) break;
  }
}
_ogClFree = function (P, N, v, p, gap) { return x3Orig.free(P, N, v, p, gap) && (!X3.flow || x3Ok(P, v, p, X3.flow)); };
_ogClFinCross = function (P, N, EE, budgetMs, seed) {
  if (!X3.flow) return x3Orig.finCross(P, N, EE, budgetMs, seed);
  // same as the library's, with swaps allowed only when both classes keep their constraints
  const n = P.length, rnd = _ogClRng(seed || 1), inc = _ogClIncidence(n, EE), t0 = performance.now(); let improved = true;
  while (improved && performance.now() - t0 < budgetMs) {
    improved = false;
    const order = [...Array(n).keys()].sort(() => rnd() - 0.5);
    for (const v of order) {
      if (performance.now() - t0 > budgetMs) break;
      if (!_ogClCrossSet(P, EE, inc[v])) continue;
      let best = null;
      for (let u = 0; u < n && !(best && best.c === 0); u++) {
        if (u === v) continue;
        const ks = inc[v].concat(inc[u]), before = _ogClCrossSet(P, EE, ks); if (!before) continue;
        const pv = P[v], pu = P[u]; P[v] = pu; P[u] = pv; const after = _ogClCrossSet(P, EE, ks);
        const ok = x3Ok(P, v, P[v], X3.flow) && x3Ok(P, u, P[u], X3.flow); P[v] = pv; P[u] = pu;
        if (ok && after < before && (!best || after - before < best.d)) best = { kind: "swap", u, d: after - before, c: after };
      }
      const cands = [];
      inc[v].forEach((k) => { const e = EE[k], o = e.s === v ? e.t : e.s; for (let a = 0; a < 12; a++) { const th = a * Math.PI / 6, r = (N[o].w + N[v].w) / 2 + 40 + (a % 3) * 25; cands.push({ x: P[o].x + Math.cos(th) * r, y: P[o].y + Math.sin(th) * r }); } });
      const keep = P[v], before = _ogClCrossSet(P, EE, inc[v]);
      for (const c of cands) {
        if (!_ogClFree(P, N, v, c, 8)) continue;
        P[v] = c; const after = _ogClCrossSet(P, EE, inc[v]); P[v] = keep;
        if (after < before && (!best || after - before < best.d)) best = { kind: "move", c2: c, d: after - before, c: after };
      }
      if (best) { if (best.kind === "swap") { const pv = P[v]; P[v] = P[best.u]; P[best.u] = pv; } else P[v] = best.c2; improved = true; }
    }
  }
};
// One-link classes: the library's placement, with every candidate spot filtered by the constraints.
function x3PlaceLeavesFlow(P, N, EE, leafOf, gapOf, L, gap, improve, deadline) {
        const n = P.length, kids = new Map();
        leafOf.forEach((p, v) => { if (p >= 0) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(v); } });
        const placed = new Uint8Array(n); for (let v = 0; v < n; v++) if (improve || leafOf[v] < 0) placed[v] = 1;
        const freeAt = (v, p, c) => {
          for (let u = 0; u < n; u++) {
            if (u === v || !placed[u]) continue; const g = u === p ? gapOf[v] : gap;
            if (Math.abs(P[u].x - c.x) < (N[u].w + N[v].w) / 2 + g && Math.abs(P[u].y - c.y) < (N[u].h + N[v].h) / 2 + g) return false;
          }
          return true;
        };
        // cost of a spot; gives up (Infinity) as soon as it cannot beat limit
        const costAt = (v, p, c, cur, limit) => {
          let cost = Math.hypot(c.x - P[p].x, c.y - P[p].y); const lim = limit === undefined ? Infinity : limit;
          if (cost >= lim) return Infinity;
          for (const e of cur) {
            if (_ogClSegBox(P[e.s].x - c.x, P[e.s].y - c.y, P[e.t].x - c.x, P[e.t].y - c.y, N[v].w / 2 + 4, N[v].h / 2 + 4)) cost += 80;
            if (e.s !== p && e.t !== p && _ogClSegX(P[p], c, P[e.s], P[e.t])) cost += 100;
            if (cost >= lim) return Infinity;
          }
          for (let u = 0; u < n; u++) if (placed[u] && u !== p && u !== v && _ogClSegBox(P[p].x - P[u].x, P[p].y - P[u].y, c.x - P[u].x, c.y - P[u].y, N[u].w / 2 + 4, N[u].h / 2 + 4)) { cost += 80; if (cost >= lim) return Infinity; }
          return cost;
        };
        const order = [...kids.keys()].sort((a, b) => kids.get(b).length - kids.get(a).length);
        for (const p of order) {
          for (const v of kids.get(p).sort((a, b) => N[b].w - N[a].w)) {
            // placing is cheap below a few hundred classes, so only very large models ever search less once the time is up
            const late = deadline && n > 300 && performance.now() > deadline, dirs = late ? 16 : 48;
            const cur = EE.filter((e) => placed[e.s] && placed[e.t] && e.s !== v && e.t !== v);
            let best = improve ? (freeAt(v, p, P[v]) && x3Ok(P, v, P[v], X3.flow) ? { cost: costAt(v, p, P[v], cur) - 6, c: P[v] } : null) : null;
            if (improve && late) { placed[v] = 1; continue; }
            for (let a = 0; a < dirs; a++) {
              const th = a * 2 * Math.PI / dirs, ux = Math.cos(th), uy = Math.sin(th) * X3.squash;
              // nearest distance in this direction at which the boxes are gapOf apart
              const r0 = Math.min(((N[p].w + N[v].w) / 2 + gapOf[v] + 1) / Math.max(Math.abs(ux), 1e-6), ((N[p].h + N[v].h) / 2 + gapOf[v] + 1) / Math.max(Math.abs(uy), 1e-6));
              let tries = 0;
              for (let r = r0; r < r0 + L * 3 && tries < (late ? 2 : 6) && !(best && best.cost < 100 && r > best.cost); r += 18) {
                const c = { x: P[p].x + ux * r, y: P[p].y + uy * r };
                if (!freeAt(v, p, c) || !x3Ok(P, v, c, X3.flow)) continue;
                tries++;
                const cost = costAt(v, p, c, cur, best ? best.cost : Infinity);
                if (!best || cost < best.cost) best = { cost, c };
                if (cost < 100) break;
              }
            }
            if (best && best.cost >= 100 && !improve) {
              // every nearby spot crosses a link or has one running through it: look further out, all round
              for (let a = 0; a < 72; a++) {
                const th = a * 2 * Math.PI / 72, ux = Math.cos(th), uy = Math.sin(th) * X3.squash;
                const r0 = Math.min(((N[p].w + N[v].w) / 2 + gapOf[v] + 1) / Math.max(Math.abs(ux), 1e-6), ((N[p].h + N[v].h) / 2 + gapOf[v] + 1) / Math.max(Math.abs(uy), 1e-6));
                for (let r = r0; r < r0 + L * 1.5 && !(best.cost < 100 && r > best.cost); r += 24) {
                  const c = { x: P[p].x + ux * r, y: P[p].y + uy * r };
                  if (!freeAt(v, p, c) || !x3Ok(P, v, c, X3.flow)) continue;
                  const cost = costAt(v, p, c, cur, best.cost);
                  if (cost < best.cost) best = { cost, c };
                  if (cost < 100) break;
                }
              }
            }
            if (best) P[v] = best.c; placed[v] = 1;
          }
        }
      }
      _ogClPlaceLeaves = function (P, N, EE, leafOf, gapOf, L, gap, improve, deadline) {
  return (X3.flow ? x3PlaceLeavesFlow : x3Orig.leaves)(P, N, EE, leafOf, gapOf, L, gap, improve, deadline);
};
_ogStressLayout = function (items, edges, cfg, opts) {
  if (!X3.on) return x3Orig.stress(items, edges, cfg, opts);
  // the library's run, with the constraints applied during stress and kept by every clean-up move
  const n = items.length; if (n < 2 || !edges.length) return null;
  const o = opts || {}, sc = o.roomy ? 1.3 : 1, L = (cfg.L || 170) * sc, seed = o.seed || 1, rnd = _ogClRng(seed * 31 + 7);
  const N = items.map((it) => ({ w: it.w + 16 * sc, h: it.h + 12 * sc }));
  const EE = edges.filter(([a, b]) => a !== b).map(([a, b, w, lab]) => ({ s: a, t: b, sub: w === 2, lab: lab || 0 }));
  if (!EE.length) return null;
  const t0 = performance.now(), budget = cfg.budget || 1500, left = () => Math.max(20, budget - (performance.now() - t0));
  const leafAll = _ogClLeaves(n, EE), leafOf = cfg.leaves ? leafAll : new Array(n).fill(-1);
  const gapOf = new Array(n).fill(40 * sc); EE.forEach((e) => { [e.s, e.t].forEach((v) => { if (leafAll[v] >= 0) gapOf[v] = Math.max(gapOf[v], e.lab + 16); }); });
  const core = [...Array(n).keys()].filter((v) => leafOf[v] < 0), ci = new Map(core.map((v, k) => [v, k])), m = core.length;
  const nb = Array.from({ length: n }, () => new Set()); EE.forEach((e) => { nb[e.s].add(e.t); nb[e.t].add(e.s); });
  const ring = new Array(n).fill(0);
  if (cfg.hub) for (let v = 0; v < n; v++) { let s = 0; nb[v].forEach((u) => (s += Math.max(N[u].w, N[u].h * 2.5) + cfg.hub)); ring[v] = s / (2 * Math.PI); }
  let com = null;
  if (cfg.pods) { const E3 = EE.map((e) => [e.s, e.t, 1]); com = _ogClMergeSmall(_ogClLouvain(n, E3), E3, 4); }
  const adj = Array.from({ length: m }, () => []);
  EE.forEach((e) => {
    if (!ci.has(e.s) || !ci.has(e.t)) return;
    let len = L * (e.sub ? 0.9 : 1);
    if (cfg.hub) len = Math.max(len, Math.min(3 * L, Math.max(ring[e.s], ring[e.t])));
    if (com) len *= com[e.s] === com[e.t] ? 0.85 : cfg.pods;
    if (e.lab) len = Math.max(len, (N[e.s].w + N[e.t].w) / 2 + e.lab + 24);
    adj[ci.get(e.s)].push([ci.get(e.t), len]); adj[ci.get(e.t)].push([ci.get(e.s), len]);
  });
  const D = _ogClPaths(m, adj);
  const NC = core.map((v) => N[v]), EC = EE.filter((e) => ci.has(e.s) && ci.has(e.t)).map((e) => ({ s: ci.get(e.s), t: ci.get(e.t), sub: e.sub }));
  const fC = x3FlowOf(m, EE, ci), fA = x3FlowOf(n, EE, null);
  const restarts = cfg.restarts != null ? cfg.restarts : (m <= 30 ? 8 : m <= 80 ? 4 : 2), countX = EC.length <= 2500;
  let best = null;
  for (let r = 0; r < Math.max(1, restarts) && (r === 0 || performance.now() - t0 < budget * 0.4); r++) {
    const PC = cfg.init === "pmds" && r === 0 && m > 2 ? _ogClPivotMDS(D, m, rnd) : NC.map(() => ({ x: (rnd() - 0.5) * 400, y: (rnd() - 0.5) * 400 }));
    x3Project(PC, fC, 30);
    for (let it = 0; it < 120; it++) { const before = PC.map((p) => p.x + p.y); _ogClStress(PC, D, 1, rnd); x3Project(PC, fC, 10); let mv = 0; PC.forEach((p, i) => (mv += Math.abs(p.x + p.y - before[i]))); if (mv / m < 0.05) break; }
    _ogClSeparate(PC, NC, 12, 120); x3Project(PC, fC, 30); _ogClSeparate(PC, NC, 12, 60);
    const x = countX ? _ogClCrossings(PC, EC) : 0; if (!best || x < best.x) best = { x, P: PC };
  }
  const PC = best.P;
  X3.flow = fC;
  if (countX && EC.length) {
    _ogClFinCross(PC, NC, EC, Math.min(m <= 30 ? 150 : 300, left() / 3), seed); _ogClSeparate(PC, NC, 12, 120);
    _ogClFinThru(PC, NC, EC, 12, 10, left() / 3); _ogClFinTight(PC, NC, EC, 12, 26 * sc, left() / 2); _ogClFinThru(PC, NC, EC, 8, 10, left() / 2);
  } else if (EC.length) _ogClFinTight(PC, NC, EC, 6, 26 * sc, left() / 2);
  const P = new Array(n); core.forEach((v, k) => (P[v] = PC[k]));
  for (let v = 0; v < n; v++) if (!P[v]) P[v] = { x: 0, y: 0 };
  const deadline = t0 + budget;
  X3.flow = fA;
  if (cfg.leaves) {
    _ogClPlaceLeaves(P, N, EE, leafOf, gapOf, L, 10, false, deadline);
    _ogClFinThru(P, N, EE, 6, 10, left() / 2); _ogClFinTight(P, N, EE, 6, 26 * sc, left());
  }
  if (cfg.leaves || cfg.leafFix) {
    const short = leafAll.map((p, v) => p >= 0 && Math.max(Math.abs(P[v].x - P[p].x) - (N[v].w + N[p].w) / 2, Math.abs(P[v].y - P[p].y) - (N[v].h + N[p].h) / 2) < gapOf[v] - 0.5 ? p : -1);
    if (short.some((p) => p >= 0)) _ogClPlaceLeaves(P, N, EE, short, gapOf, L, 10, false, deadline);
    if (cfg.leafFix) _ogClPlaceLeaves(P, N, EE, leafAll, gapOf, L, 10, true, deadline);
  }
  X3.flow = null;
  return { pos: P, crossings: countX ? _ogClCrossings(P, EE) : 0 };
};
const x3Wrap = (fn, gap) => (it, ed, o) => { X3.on = true; X3.gap = gap; try { return fn(it, ed, o); } finally { X3.on = false; X3.flow = null; } };
const EXP3 = {
  compactF: x3Wrap((a, b, c) => _ogCompactLayout(a, b, c), 40),
  groupedF: x3Wrap((a, b, c) => _ogGroupedLayout(a, b, c), 40),
  autoF: x3Wrap((a, b, c) => _ogAutoLayout(a, b, c), 40),
  compactF20: x3Wrap((a, b, c) => _ogCompactLayout(a, b, c), 20),
  autoF70: x3Wrap((a, b, c) => _ogAutoLayout(a, b, c), 70),
  autoF20: x3Wrap((a, b, c) => _ogAutoLayout(a, b, c), 20),
  autoF10: x3Wrap((a, b, c) => _ogAutoLayout(a, b, c), 10)
};
const x3Wrap2 = (fn, gap, squash) => (it, ed, o) => { X3.squash = squash; try { return x3Wrap(fn, gap)(it, ed, o); } finally { X3.squash = 0.75; } };
EXP3.autoFs5 = x3Wrap2((a, b, c) => _ogAutoLayout(a, b, c), 40, 0.5);
EXP3.autoFs35 = x3Wrap2((a, b, c) => _ogAutoLayout(a, b, c), 40, 0.35);
// Experiment: no moves off links (the clean-up step that moves classes off links running through them is skipped),
// to measure what that step costs in area and what it saves in links through classes.
const x3OrigThru = _ogClFinThru;
const x3NoThru = (fn) => (it, ed, o) => { _ogClFinThru = () => {}; try { return fn(it, ed, o); } finally { _ogClFinThru = x3OrigThru; } };
EXP3.compactNT = x3NoThru((a, b, c) => _ogCompactLayout(a, b, c));
EXP3.groupedNT = x3NoThru((a, b, c) => _ogGroupedLayout(a, b, c));
EXP3.autoNT = x3NoThru((a, b, c) => _ogAutoLayout(a, b, c));
