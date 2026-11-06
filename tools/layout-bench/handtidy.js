// Hand-style clean-up, learned from the Layout Lab sessions. It runs AFTER a layout, on its positions, and works the way a person
// fixing the drawing did:
//   1. pendant units: a leaf, a short leaf chain, a leaf triangle or loop hangs off the rest of the graph by one class (its anchor),
//      so it can always be turned around that anchor, stretched, mirrored or reordered until it crosses nothing;
//   2. single moves: a class at the end of a crossed link, or one a link runs through, moves into nearby open space (any distance:
//      link length is not a goal);
//   3. group moves: the classes crowding one side of a problem, picked by where they sit in the drawing rather than by their links,
//      move together toward open space, even when that first makes things worse; a few single moves then repair around the problem,
//      and the whole step is kept only if the end result is better.
// Growing the drawing's area is penalised, so open space inside the drawing is used before the drawing gets bigger.
// Straight links only. Usage: HandTidy.run(P, D, E, opts) with P [{x,y}], D [{w,h}], E [{s,t}] -> { P, log, stats }.
(function (root) {
  'use strict';
  const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  function crosses(a, b, c, d) {
    const d1 = orient(a, b, c), d2 = orient(a, b, d); if (d1 * d2 >= 0) return false;
    const d3 = orient(c, d, a), d4 = orient(c, d, b); return d3 * d4 < 0;
  }
  function crossAt(a, b, c, d) { const d3 = orient(c, d, a), d4 = orient(c, d, b), t = d3 / (d3 - d4); return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }; }
  function angle(a, b, c, d) {
    const ux = b.x - a.x, uy = b.y - a.y, vx = d.x - c.x, vy = d.y - c.y;
    return Math.acos(Math.min(1, Math.abs(ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1))) * 180 / Math.PI;
  }
  function segBox(a, b, c, hw, hh) { // Liang-Barsky: does segment a-b touch the box of half-size hw, hh centred on c?
    let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y;
    const p = [-dx, dx, -dy, dy], q = [a.x - (c.x - hw), c.x + hw - a.x, a.y - (c.y - hh), c.y + hh - a.y];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }
  const DEF = { budgetMs: 2000, unitSize: 4, clearance: 8, groupDepth: 4, groups: true, W: { cross: 6, sharp: 3, thru: 10, tight: 1, ov: 1000, area: 1 } };

  function Model(P0, D, E0, o) {
    const n = P0.length, seen = new Set(), E = [];
    E0.forEach((e) => { if (e.s === e.t) return; const k = Math.min(e.s, e.t) + ',' + Math.max(e.s, e.t); if (!seen.has(k)) { seen.add(k); E.push({ s: e.s, t: e.t }); } });
    const inc = Array.from({ length: n }, () => []), adj = Array.from({ length: n }, () => []);
    E.forEach((e, k) => { inc[e.s].push(k); inc[e.t].push(k); adj[e.s].push(e.t); adj[e.t].push(e.s); });
    const M = { n, m: E.length, P: P0.map((p) => ({ x: p.x, y: p.y })), D, E, inc, adj, o, W: o.W,
      hw: D.map((d) => d.w / 2 + o.clearance), hh: D.map((d) => d.h / 2 + o.clearance),
      ow: D.map((d) => d.w / 2 + 6), oh: D.map((d) => d.h / 2 + 5), mN: new Uint8Array(n), mE: new Uint8Array(E.length) };
    const ls = E.map((e) => Math.hypot(M.P[e.s].x - M.P[e.t].x, M.P[e.s].y - M.P[e.t].y)).sort((a, b) => a - b);
    M.medLen = ls[ls.length >> 1] || 150; M.A0 = bboxArea(M); return M;
  }
  function bboxArea(M) {
    let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18;
    M.P.forEach((p, i) => { const w = M.D[i].w / 2, h = M.D[i].h / 2; if (p.x - w < x1) x1 = p.x - w; if (p.x + w > x2) x2 = p.x + w; if (p.y - h < y1) y1 = p.y - h; if (p.y + h > y2) y2 = p.y + h; });
    return (x2 - x1) * (y2 - y1);
  }
  const areaPen = (M) => M.W.area * 100 * Math.max(0, bboxArea(M) / M.A0 - 1);
  function minAngle(M, v) {
    const a = M.adj[v]; if (a.length < 2) return 360;
    const th = a.map((u) => Math.atan2(M.P[u].y - M.P[v].y, M.P[u].x - M.P[v].x)).sort((x, y) => x - y);
    let mn = 2 * Math.PI - (th[th.length - 1] - th[0]); for (let i = 1; i < th.length; i++) mn = Math.min(mn, th[i] - th[i - 1]);
    return mn * 180 / Math.PI;
  }
  function pairCost(M, a, f) {
    const ea = M.E[a], ef = M.E[f]; if (ea.s === ef.s || ea.s === ef.t || ea.t === ef.s || ea.t === ef.t) return 0;
    const A = M.P[ea.s], B = M.P[ea.t], C = M.P[ef.s], D = M.P[ef.t];
    if (Math.max(A.x, B.x) < Math.min(C.x, D.x) || Math.max(C.x, D.x) < Math.min(A.x, B.x) || Math.max(A.y, B.y) < Math.min(C.y, D.y) || Math.max(C.y, D.y) < Math.min(A.y, B.y)) return 0;
    if (!crosses(A, B, C, D)) return 0;
    return M.W.cross + (angle(A, B, C, D) < 30 ? M.W.sharp : 0);
  }
  const thruCost = (M, k, v) => { const e = M.E[k]; return v !== e.s && v !== e.t && segBox(M.P[e.s], M.P[e.t], M.P[v], M.hw[v], M.hh[v]) ? M.W.thru : 0; };
  const overlaps = (M, u, v) => Math.abs(M.P[u].x - M.P[v].x) < M.ow[u] + M.ow[v] && Math.abs(M.P[u].y - M.P[v].y) < M.oh[u] + M.oh[v];
  // Cost of everything that involves the classes in S (their links, their boxes, their neighbours' angles)
  function local(M, S) {
    const { mN, mE, E, n, m, W } = M, A = [];
    S.forEach((v) => (mN[v] = 1)); S.forEach((v) => M.inc[v].forEach((k) => { if (!mE[k]) { mE[k] = 1; A.push(k); } }));
    let c = 0;
    for (const a of A) {
      for (let f = 0; f < m; f++) { if (f === a || (mE[f] && f < a)) continue; c += pairCost(M, a, f); }
      for (let v = 0; v < n; v++) c += thruCost(M, a, v);
    }
    for (const v of S) {
      for (let f = 0; f < m; f++) if (!mE[f]) c += thruCost(M, f, v);
      for (let u = 0; u < n; u++) if (u !== v && !(mN[u] && u < v) && overlaps(M, u, v)) c += W.ov;
    }
    const T = new Set(S); S.forEach((v) => M.adj[v].forEach((u) => T.add(u)));
    T.forEach((v) => { if (minAngle(M, v) < 15) c += W.tight; });
    S.forEach((v) => (mN[v] = 0)); A.forEach((k) => (mE[k] = 0));
    return c;
  }
  // Whole-drawing cost and the list of problems
  function total(M, wantIssues) {
    const { E, n, m, W } = M, issues = []; let c = 0;
    for (let a = 0; a < m; a++) for (let f = a + 1; f < m; f++) { const pc = pairCost(M, a, f); if (pc) { c += pc; if (wantIssues) { const ea = E[a], ef = E[f]; issues.push({ kind: 'cross', edges: [a, f], q: crossAt(M.P[ea.s], M.P[ea.t], M.P[ef.s], M.P[ef.t]), nodes: [ea.s, ea.t, ef.s, ef.t] }); } } }
    for (let k = 0; k < m; k++) for (let v = 0; v < n; v++) if (thruCost(M, k, v)) { c += W.thru; if (wantIssues) issues.push({ kind: 'thru', edges: [k], q: { ...M.P[v] }, nodes: [v, E[k].s, E[k].t] }); }
    for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) if (overlaps(M, u, v)) c += W.ov;
    for (let v = 0; v < n; v++) if (minAngle(M, v) < 15) { c += W.tight; if (wantIssues) issues.push({ kind: 'tight', edges: [], q: { ...M.P[v] }, nodes: [v, ...M.adj[v]] }); }
    c += areaPen(M);
    return wantIssues ? { c, issues } : c;
  }
  // Try candidate positions for the classes S; apply the best one if it lowers the cost by more than eps. Returns the gain.
  function best(M, S, cands, eps = 0.01) {
    const before = local(M, S) + areaPen(M), old = S.map((v) => M.P[v]);
    let bestD = -eps, bestC = null;
    for (const c of cands) {
      S.forEach((v, i) => (M.P[v] = c[i]));
      const d = local(M, S) + areaPen(M) - before; if (d < bestD) { bestD = d; bestC = c; }
    }
    S.forEach((v, i) => (M.P[v] = old[i]));
    if (bestC) { S.forEach((v, i) => (M.P[v] = { x: bestC[i].x, y: bestC[i].y })); return -bestD; }
    return 0;
  }
  const DIRS = Array.from({ length: 16 }, (_, i) => [Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)]);
  function singleCands(M, v) {
    const p = M.P[v], out = [], L = M.medLen;
    for (const s of [0.08, 0.2, 0.4, 0.75, 1.2, 1.8]) for (const [dx, dy] of DIRS) out.push([{ x: p.x + dx * s * L, y: p.y + dy * s * L }]);
    return out;
  }
  // Pendant units: the classes cut off from the rest of the graph by removing one class (their anchor), up to unitSize classes
  function findUnits(M, K) {
    const units = [], key = new Set();
    for (let a = 0; a < M.n; a++) {
      if (M.adj[a].length < 2) continue;
      const seen = new Set([a]);
      for (const u0 of M.adj[a]) {
        if (seen.has(u0)) continue;
        const comp = [u0], q = [u0]; seen.add(u0); // the whole component: stopping early would leave parts of it to look small
        while (q.length) { const x = q.pop(); for (const y of M.adj[x]) if (!seen.has(y)) { seen.add(y); comp.push(y); q.push(y); } }
        if (comp.length > K || comp.length >= M.n - 1) continue;
        const k = a + ':' + comp.slice().sort((x, y) => x - y).join(','); if (key.has(k)) continue; key.add(k);
        units.push({ anchor: a, nodes: comp });
      }
    }
    return units;
  }
  function perms(arr) { if (arr.length <= 1) return [arr]; const out = []; arr.forEach((x, i) => perms(arr.filter((_, j) => j !== i)).forEach((p) => out.push([x, ...p]))); return out; }
  function unitCands(M, U) {
    const a = M.P[U.anchor], rel = U.nodes.map((v) => ({ x: M.P[v].x - a.x, y: M.P[v].y - a.y }));
    const cx = rel.reduce((s, r) => s + r.x, 0) / rel.length, cy = rel.reduce((s, r) => s + r.y, 0) / rel.length, ax = Math.atan2(cy, cx);
    const mirror = (r) => { const c = Math.cos(2 * ax), s = Math.sin(2 * ax); return { x: c * r.x + s * r.y, y: s * r.x - c * r.y }; };
    const orders = U.nodes.length <= 3 ? perms(rel.map((_, i) => i)) : [rel.map((_, i) => i)], out = [];
    // coarse pass: every turn, mirror and order at the same size; the size is tried afterwards around the winner (unitScale)
    for (const ord of orders) for (const mi of [0, 1]) for (const s of [1]) for (let k = 0; k < 24; k++) {
      if (k === 0 && s === 1 && !mi && ord.every((x, i) => x === i)) continue;
      const th = k * Math.PI / 12, c = Math.cos(th), sn = Math.sin(th);
      out.push(ord.map((j) => { let r = rel[j]; if (mi) r = mirror(r); return { x: a.x + s * (c * r.x - sn * r.y), y: a.y + s * (sn * r.x + c * r.y) }; }));
    }
    return out;
  }
  function unitScale(M, U) {
    const a = M.P[U.anchor], rel = U.nodes.map((v) => ({ x: M.P[v].x - a.x, y: M.P[v].y - a.y })), out = [];
    for (const s of [1.4, 2, 2.8, 0.75]) for (const k of [-1, 0, 1]) {
      const th = k * Math.PI / 24, c = Math.cos(th), sn = Math.sin(th);
      out.push(rel.map((r) => ({ x: a.x + s * (c * r.x - sn * r.y), y: a.y + s * (sn * r.x + c * r.y) })));
    }
    return out;
  }
  function run(P0, D, E0, opts = {}) {
    const o = { ...DEF, ...opts, W: { ...DEF.W, ...(opts.W || {}) } }, t0 = Date.now(), M = Model(P0, D, E0, o), log = [];
    const timeUp = () => Date.now() - t0 > o.budgetMs;
    const units = o.unitSize > 0 ? findUnits(M, o.unitSize) : [];
    const unitOf = new Map(); units.forEach((U) => U.nodes.forEach((v) => { if (!unitOf.has(v) || unitOf.get(v).nodes.length < U.nodes.length) unitOf.set(v, U); }));
    const start = total(M, true); let cur = start.c, rounds = 0;
    const stats = { start: start.c, units: units.length, unitMoves: 0, singleMoves: 0, groupTried: 0, groupKept: 0 };
    const repair = (near, R, steps) => { // greedy single moves on the classes involved in problems near a point
      for (let s = 0; s < steps && !timeUp(); s++) {
        const { issues } = total(M, true), cand = new Set();
        issues.forEach((is) => { if (Math.hypot(is.q.x - near.x, is.q.y - near.y) < R) is.nodes.forEach((v) => cand.add(v)); });
        let bestG = 0, bestV = -1, bestP = null;
        cand.forEach((v) => { const old = M.P[v], g = best(M, [v], singleCands(M, v)); if (g > bestG) { bestG = g; bestV = v; bestP = M.P[v]; } M.P[v] = old; });
        if (bestV < 0) break; M.P[bestV] = bestP;
      }
    };
    while (!timeUp()) {
      rounds++; let gained = 0;
      // 1. single classes at the end of a crossed link or under a link: move into open space
      let { issues } = total(M, true);
      const hot = new Set(); issues.forEach((is) => is.nodes.forEach((v) => hot.add(v)));
      for (const v of hot) {
        if (timeUp()) break;
        const g = best(M, [v], singleCands(M, v)); if (g > 0) { gained += g; stats.singleMoves++; log.push({ kind: 'move', nodes: [v], gain: +g.toFixed(1) }); }
      }
      // 2. pendant units involved in a problem: turn, mirror or reorder them around their anchor, then stretch or shrink
      ({ issues } = total(M, true)); hot.clear(); issues.forEach((is) => is.nodes.forEach((v) => hot.add(v)));
      for (const U of units) {
        if (timeUp()) break;
        if (!U.nodes.some((v) => hot.has(v)) && !hot.has(U.anchor)) continue;
        const g = best(M, U.nodes, unitCands(M, U)) + best(M, U.nodes, unitScale(M, U));
        if (g > 0) { gained += g; stats.unitMoves++; log.push({ kind: 'unit', anchor: U.anchor, nodes: U.nodes.slice(), gain: +g.toFixed(1) }); }
      }
      cur = total(M);
      // 3. group moves with look-ahead, on the problems still left
      if (o.groups && !timeUp()) {
        ({ issues } = total(M, true));
        const R = 1.3 * M.medLen;
        for (const is of issues.filter((x) => x.kind !== 'tight')) {
          if (timeUp()) break;
          const lines = is.edges.length ? is.edges : [];
          const tries = [];
          for (const k of lines) {
            const e = M.E[k], A = M.P[e.s], B = M.P[e.t], L = Math.hypot(B.x - A.x, B.y - A.y) || 1, nx = -(B.y - A.y) / L, ny = (B.x - A.x) / L;
            for (const side of [1, -1]) {
              const G = []; for (let v = 0; v < M.n; v++) { const dx = M.P[v].x - is.q.x, dy = M.P[v].y - is.q.y; if (Math.hypot(dx, dy) < R && side * (dx * nx + dy * ny) > 0) G.push(v); }
              if (G.length < 2 || G.length > Math.max(6, M.n / 3)) continue;
              for (const d of [0.25, 0.55, 1]) for (const phi of [-0.6, 0, 0.6]) {
                const c = Math.cos(phi), s = Math.sin(phi), ux = side * (c * nx - s * ny), uy = side * (s * nx + c * ny);
                tries.push({ G, dx: ux * d * M.medLen, dy: uy * d * M.medLen });
              }
            }
          }
          // rank by the immediate effect, look ahead on the most promising few
          const before = local.bind(null, M);
          tries.forEach((t) => { const old = t.G.map((v) => M.P[v]), b = before(t.G) + areaPen(M); t.G.forEach((v) => (M.P[v] = { x: M.P[v].x + t.dx, y: M.P[v].y + t.dy })); t.imm = before(t.G) + areaPen(M) - b; t.G.forEach((v, i) => (M.P[v] = old[i])); });
          tries.sort((a, b) => a.imm - b.imm);
          for (const t of tries.slice(0, 3)) {
            if (timeUp() || t.imm > 40) break;
            stats.groupTried++;
            const snap = M.P.map((p) => p), F0 = total(M);
            t.G.forEach((v) => (M.P[v] = { x: M.P[v].x + t.dx, y: M.P[v].y + t.dy }));
            repair(is.q, 2 * R, o.groupDepth);
            const F1 = total(M);
            if (F1 < F0 - 0.5) { gained += F0 - F1; stats.groupKept++; log.push({ kind: 'group', nodes: t.G.slice(), dx: Math.round(t.dx), dy: Math.round(t.dy), gain: +(F0 - F1).toFixed(1) }); break; }
            M.P = snap;
          }
        }
      }
      const now = total(M); if (cur - now < 0.5 && gained < 0.5) break; cur = now;
    }
    stats.end = total(M); stats.rounds = rounds; stats.ms = Date.now() - t0;
    return { P: M.P, log, stats };
  }
  // The measures shown in the Layout Lab (straight links; a link through a class counts within 6 px of its box)
  function measure(P, D, E0) {
    const M = Model(P, D, E0, { ...DEF, clearance: 6 }), { E, n, m } = M;
    let cross = 0, sharp = 0, thru = 0, tight = 0;
    for (let a = 0; a < m; a++) for (let f = a + 1; f < m; f++) { const pc = pairCost(M, a, f); if (pc) { cross++; if (pc > M.W.cross) sharp++; } }
    for (let k = 0; k < m; k++) for (let v = 0; v < n; v++) if (thruCost(M, k, v)) thru++;
    for (let v = 0; v < n; v++) if (minAngle(M, v) < 15) tight++;
    let boxA = 0; D.forEach((d) => (boxA += (d.w + 16) * (d.h + 12)));
    return { cross, sharp, thru, tight, area: +(bboxArea(M) / boxA).toFixed(2) };
  }
  root.HandTidy = { run, measure, findUnits: (P, D, E, K) => findUnits(Model(P, D, E, DEF), K) };
})(typeof window !== 'undefined' ? window : globalThis);
