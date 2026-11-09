      // ── OG: Layout geometry helpers (Compact, Grouped and Auto layouts, below) ──
      // Seeded random numbers, segment crossings and distances, crossing counts, groups of closely linked classes (Louvain modularity),
      // and pushing boxes apart. Pure geometry, no Cytoscape.
      function _ogClRng(seed) { let a = seed | 0; return function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
      // ── Work clock ──
      // The layouts and the clean-up count their time limits in units of work, not on the computer's clock, so a model gets the
      // same drawing on any computer, however fast or busy it is: a slower one takes longer for the same drawing. _ogWorkN counts
      // the work done by kind; _OG_WORK_NS is what one unit of each kind takes, in nanoseconds, on the laptop the layouts were
      // tuned on. Within one run the wall clock still applies at 1/_OG_WALL_CAP speed, so on a computer more than that many times
      // slower the wait stays bounded and the drawing gets less work instead.
      const _ogWorkN = new Float64Array(7); // 0 link pairs tested, 1 link-box tests, 2 pair loops, 3 placement sums, 4 clean-up checks, 5 steps, 6 crossing-count visits
      const _OG_WORK_NS = [10, 30, 5, 5, 50, 600, 20], _OG_WALL_CAP = 2.5;
      // scale: the time limit as a multiple of the default (1.5 s for a layout and its clean-up). Every limit in the layouts is
      // on this clock, so a scale of 2 lets each step do twice the work before it stops (_ogSetTimeLimit).
      const _ogClk = { depth: 0, v0: 0, w0: 0, lag: 0, scale: 1 };
      function _ogWorkMs() { let s = 0; for (let i = 0; i < 7; i++) s += _ogWorkN[i] * _OG_WORK_NS[i] / 1e6; return _ogClk.lag + s / _ogClk.scale; }
      // Time limit for the layouts, the clean-up and the link routing together, in ms of the reference laptop (default 1500).
      // Longer limits let the steps that stop on time (restarts, crossing swaps, the clean-up, bends) do more; the same limit
      // gives the same drawing on any computer. Returns the previous limit.
      function _ogSetTimeLimit(ms) { const prev = 1500 * _ogClk.scale; _ogClk.scale = Math.max(0.05, (+ms || 1500) / 1500); return prev; }
      function _ogNow() {
        const v = _ogWorkMs(); if (!_ogClk.depth) return v;
        const w = _ogClk.v0 + (performance.now() - _ogClk.w0) / (_OG_WALL_CAP * _ogClk.scale); return w > v ? w : v;
      }
      // Runs fn as one timed run (nested calls join the outer run); afterwards the clock never runs backwards.
      function _ogClocked(fn) {
        if (_ogClk.depth++ === 0) { _ogClk.v0 = _ogWorkMs(); _ogClk.w0 = performance.now(); }
        try { return fn(); } finally { const end = _ogNow(); if (--_ogClk.depth === 0) { const v = _ogWorkMs(); if (end > v) _ogClk.lag += end - v; } }
      }
      // ── end of the work clock ──
      // ── Trace (playback in the Layout Lab) ──
      // Off unless _ogTraced runs a layout: then each step that moves classes reports the positions after it, so the lab can
      // replay the layout step by step. Reporting only copies positions; the drawing is the same with or without it.
      let _ogTr = null;
      function _ogTraced(sink, fn) { const prev = _ogTr; _ogTr = sink; try { return fn(); } finally { _ogTr = prev; } }
      // experiments and the lab: steps of the layouts left out (_OG_TUNE.skip = { cross, thru, tight })
      const _ogSkip = (k) => !!(_OG_TUNE.skip && _OG_TUNE.skip[k]);
      function _ogClSegX(a, b, c, d) {
        _ogWorkN[0]++;
        const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
        return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
      }
      function _ogClDPS(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); }
      function _ogClDSS(a, b, c, d) { return _ogClSegX(a, b, c, d) ? 0 : Math.min(_ogClDPS(a, c, d), _ogClDPS(b, c, d), _ogClDPS(c, a, b), _ogClDPS(d, a, b)); }
      // Edges [{s, t}] (self-links already dropped): how many pairs of links that share no end cross.
      function _ogClCrossings(P, EE) {
        let x = 0;
        for (let i = 0; i < EE.length; i++) for (let j = i + 1; j < EE.length; j++) {
          const e = EE[i], f = EE[j];
          if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue;
          const A = P[e.s], B = P[e.t], C = P[f.s], D = P[f.t];
          if (Math.max(A.x, B.x) < Math.min(C.x, D.x) || Math.max(C.x, D.x) < Math.min(A.x, B.x) || Math.max(A.y, B.y) < Math.min(C.y, D.y) || Math.max(C.y, D.y) < Math.min(A.y, B.y)) continue;
          if (_ogClSegX(A, B, C, D)) x++;
        }
        return x;
      }
      // Community detection by modularity (multi-level Louvain). E: [a, b, weight]. Returns a group number per node.
      function _ogClLouvain(n, E) {
        let comOfNode = [...Array(n).keys()], curN = n, curE = E;
        for (let level = 0; level < 6; level++) {
          const adj = Array.from({ length: curN }, () => []), loops = Array(curN).fill(0); let m2 = 0;
          curE.forEach(([a, b, w]) => { m2 += 2 * w; if (a === b) { loops[a] += 2 * w; return; } adj[a].push([b, w]); adj[b].push([a, w]); });
          if (!m2) break;
          const deg = adj.map((l, i) => l.reduce((s, [, w]) => s + w, loops[i])), com = [...Array(curN).keys()], tot = deg.slice();
          let moved = true, pass = 0;
          while (moved && pass++ < 30) {
            moved = false;
            for (let i = 0; i < curN; i++) {
              const ci = com[i], wc = new Map(); adj[i].forEach(([j, w]) => wc.set(com[j], (wc.get(com[j]) || 0) + w));
              tot[ci] -= deg[i]; let best = ci, bg = (wc.get(ci) || 0) - tot[ci] * deg[i] / m2;
              wc.forEach((w, c) => { const g = w - tot[c] * deg[i] / m2; if (g > bg + 1e-12) { bg = g; best = c; } });
              tot[best] += deg[i]; if (best !== ci) { com[i] = best; moved = true; }
            }
          }
          const ids = new Map(); com.forEach((c) => { if (!ids.has(c)) ids.set(c, ids.size); });
          if (ids.size === curN) break;
          comOfNode = comOfNode.map((c) => ids.get(com[c]));
          const agg = new Map(); curE.forEach(([a, b, w]) => { const x = ids.get(com[a]), y = ids.get(com[b]); const k = x < y ? x + "," + y : y + "," + x; agg.set(k, (agg.get(k) || 0) + w); });
          curE = [...agg].map(([k, w]) => { const [x, y] = k.split(",").map(Number); return [x, y, w]; }); curN = ids.size;
        }
        return comOfNode;
      }
      // Groups smaller than minSize join the neighboring group they are most connected to.
      function _ogClMergeSmall(com, E, minSize) {
        for (let pass = 0; pass < 3; pass++) {
          const size = new Map(); com.forEach((c) => size.set(c, (size.get(c) || 0) + 1));
          const link = new Map();
          E.forEach(([a, b, w]) => { if (com[a] !== com[b]) for (const [x, y] of [[com[a], com[b]], [com[b], com[a]]]) { if (!link.has(x)) link.set(x, new Map()); link.get(x).set(y, (link.get(x).get(y) || 0) + w); } });
          let changed = false;
          [...size].filter(([, s]) => s < minSize).forEach(([c]) => {
            const l = link.get(c); if (!l) return; let best = null, bw = 0; l.forEach((w, o) => { if (w > bw) { bw = w; best = o; } });
            if (best !== null) { com = com.map((x) => x === c ? best : x); changed = true; }
          });
          if (!changed) break;
        }
        const ids = new Map(); return com.map((c) => { if (!ids.has(c)) ids.set(c, ids.size); return ids.get(c); });
      }
      // Push nodes apart until no two boxes come closer than pad. P: [{x, y}], N: [{w, h}], moved in place.
      // Returns whether anything moved.
      function _ogClSeparate(P, N, pad, iters) {
        const n = P.length; let any = false;
        for (let it = 0; it < iters; it++) {
          let moved = false; _ogWorkN[2] += n * (n - 1) / 2;
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
            const ox = (N[i].w + N[j].w) / 2 + pad - Math.abs(P[i].x - P[j].x); if (ox <= 0) continue;
            const oy = (N[i].h + N[j].h) / 2 + pad - Math.abs(P[i].y - P[j].y); if (oy <= 0) continue;
            moved = true;
            if (ox < oy) { const d = (P[i].x <= P[j].x ? 1 : -1) * (ox / 2 + 0.5); P[i].x -= d; P[j].x += d; }
            else { const d = (P[i].y <= P[j].y ? 1 : -1) * (oy / 2 + 0.5); P[i].y -= d; P[j].y += d; }
          }
          if (!moved) break;
          any = true;
        }
        return any;
      }
      // Does the segment (ax,ay)-(bx,by), given relative to a box's center, touch the box of half-sizes hw, hh?
      function _ogClSegBox(ax, ay, bx, by, hw, hh) {
        _ogWorkN[1]++;
        let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
        const clip = (p, q) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
        return clip(-dx, ax + hw) && clip(dx, hw - ax) && clip(-dy, ay + hh) && clip(dy, hh - ay);
      }
      function _ogClFree(P, N, v, p, gap) {
        _ogWorkN[2] += P.length;
        for (let u = 0; u < P.length; u++) if (u !== v && Math.abs(P[u].x - p.x) < (N[u].w + N[v].w) / 2 + gap && Math.abs(P[u].y - p.y) < (N[u].h + N[v].h) / 2 + gap) return false;
        return true;
      }
      function _ogClIncidence(n, EE) { const inc = Array.from({ length: n }, () => []); EE.forEach((e, k) => { inc[e.s].push(k); inc[e.t].push(k); }); return inc; }
      // Crossings among a set of links (indexes) and every other link.
      function _ogClCrossSet(P, EE, ks) {
        const set = new Set(ks); let c = 0; _ogWorkN[6] += set.size * EE.length;
        for (const k of set) {
          const e = EE[k], A = P[e.s], B = P[e.t], x1 = Math.min(A.x, B.x), x2 = Math.max(A.x, B.x), y1 = Math.min(A.y, B.y), y2 = Math.max(A.y, B.y);
          for (let j = 0; j < EE.length; j++) {
            if (j === k || (set.has(j) && j < k)) continue;
            const f = EE[j]; if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue;
            // links whose boxes lie apart cannot cross: skip the exact test
            const C = P[f.s], D = P[f.t]; if ((C.x < x1 && D.x < x1) || (C.x > x2 && D.x > x2) || (C.y < y1 && D.y < y1) || (C.y > y2 && D.y > y2)) continue;
            if (_ogClSegX(A, B, C, D)) c++;
          }
        }
        return c;
      }
      // Swap two classes, or move one beside a neighbor, when the number of crossed links drops and nothing overlaps.
      function _ogClFinCross(P, N, EE, budgetMs, seed) {
        const n = P.length, rnd = _ogClRng(seed || 1), inc = _ogClIncidence(n, EE), t0 = _ogNow(); let improved = true;
        while (improved && _ogNow() - t0 < budgetMs) {
          improved = false;
          // shuffled with the seeded generator (Fisher-Yates): a random sort comparator would depend on the browser's sort
          const order = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
          for (const v of order) {
            if (_ogNow() - t0 > budgetMs) break;
            if (!_ogClCrossSet(P, EE, inc[v])) continue;
            let best = null;
            for (let u = 0; u < n && !(best && best.c === 0); u++) {
              if (u === v) continue;
              _ogWorkN[5]++; const ks = inc[v].concat(inc[u]), before = _ogClCrossSet(P, EE, ks); if (!before) continue;
              const pv = P[v], pu = P[u]; P[v] = pu; P[u] = pv; const after = _ogClCrossSet(P, EE, ks); P[v] = pv; P[u] = pu;
              if (after < before && (!best || after - before < best.d)) best = { kind: "swap", u, d: after - before, c: after };
            }
            const cands = [];
            inc[v].forEach((k) => { const e = EE[k], o = e.s === v ? e.t : e.s; for (let a = 0; a < 12; a++) { const th = a * Math.PI / 6, r = (N[o].w + N[v].w) / 2 + 40 + (a % 3) * 25; cands.push({ x: P[o].x + Math.cos(th) * r, y: P[o].y + Math.sin(th) * r }); } });
            const keep = P[v], before = _ogClCrossSet(P, EE, inc[v]);
            for (const c of cands) {
              _ogWorkN[5]++;
              if (!_ogClFree(P, N, v, c, 8)) continue;
              P[v] = c; const after = _ogClCrossSet(P, EE, inc[v]); P[v] = keep;
              if (after < before && (!best || after - before < best.d)) best = { kind: "move", c2: c, d: after - before, c: after };
            }
            if (best) { if (best.kind === "swap") { const pv = P[v]; P[v] = P[best.u]; P[best.u] = pv; } else P[v] = best.c2; improved = true; if (_ogTr) _ogTr.snap("cross", P); }
          }
        }
      }
      // Links through class v (its box padded by pad), and v's own links through other classes.
      function _ogClThruCount(P, N, EE, inc, v, pad) {
        let c = 0; _ogWorkN[2] += EE.length + inc[v].length * P.length;
        // a link whose two ends lie beyond the same side of a box cannot touch it: the exact test is skipped
        const t = (ax, ay, bx, by, hw, hh) => !((ax < -hw && bx < -hw) || (ax > hw && bx > hw) || (ay < -hh && by < -hh) || (ay > hh && by > hh)) && _ogClSegBox(ax, ay, bx, by, hw, hh);
        for (const e of EE) { if (e.s === v || e.t === v) continue; if (t(P[e.s].x - P[v].x, P[e.s].y - P[v].y, P[e.t].x - P[v].x, P[e.t].y - P[v].y, N[v].w / 2 + pad, N[v].h / 2 + pad)) c++; }
        inc[v].forEach((k) => { const e = EE[k]; for (let u = 0; u < P.length; u++) { if (u === e.s || u === e.t) continue; if (t(P[e.s].x - P[u].x, P[e.s].y - P[u].y, P[e.t].x - P[u].x, P[e.t].y - P[u].y, N[u].w / 2 + pad, N[u].h / 2 + pad)) c++; } });
        return c;
      }
      // Move classes off links that run through them, never adding a crossing.
      function _ogClFinThru(P, N, EE, rounds, pad, budgetMs) {
        const n = P.length, inc = _ogClIncidence(n, EE), t0 = _ogNow();
        for (let r = 0; r < rounds; r++) {
          let moved = false;
          for (let v = 0; v < n; v++) {
            if (_ogNow() - t0 > budgetMs) return;
            const b0 = _ogClThruCount(P, N, EE, inc, v, pad); if (!b0) continue;
            const x0 = _ogClCrossSet(P, EE, inc[v]), keep = P[v]; let best = null;
            for (let a = 0; a < 16; a++) for (const d of [20, 45, 80, 120, 170, 230]) {
              const c = { x: keep.x + Math.cos(a * Math.PI / 8) * d, y: keep.y + Math.sin(a * Math.PI / 8) * d }; _ogWorkN[5]++;
              if (!_ogClFree(P, N, v, c, 8)) continue;
              P[v] = c; const b1 = _ogClThruCount(P, N, EE, inc, v, pad);
              if (b1 < b0 && _ogClCrossSet(P, EE, inc[v]) <= x0 && (!best || b1 < best.b || (b1 === best.b && d < best.d))) best = { c, b: b1, d };
              P[v] = keep;
            }
            if (best) { P[v] = best.c; moved = true; if (_ogTr) _ogTr.snap("thru", P); }
          }
          if (!moved) break;
        }
      }
      // Shorten long links: pull each class toward its neighbors when the total length of its links drops and nothing gets worse
      // (no overlap, no new crossing, no new link through a class); then shrink the drawing evenly as far as the boxes allow.
      function _ogClFinTight(P, N, EE, rounds, gap, budgetMs) {
        const n = P.length, inc = _ogClIncidence(n, EE), t0 = _ogNow();
        const len = (v) => { let s = 0; inc[v].forEach((k) => { const e = EE[k]; s += Math.hypot(P[e.s].x - P[e.t].x, P[e.s].y - P[e.t].y); }); return s; };
        for (let r = 0; r < rounds; r++) {
          let moved = false;
          const order = [...Array(n).keys()].sort((a, b) => len(b) - len(a));
          for (const v of order) {
            if (!inc[v].length) continue;
            if (_ogNow() - t0 > budgetMs) return;
            const l0 = len(v), x0 = _ogClCrossSet(P, EE, inc[v]), h0 = _ogClThruCount(P, N, EE, inc, v, 8), keep = P[v], cands = [];
            const nb = inc[v].map((k) => (EE[k].s === v ? EE[k].t : EE[k].s)), cx = nb.reduce((s, u) => s + P[u].x, 0) / nb.length, cy = nb.reduce((s, u) => s + P[u].y, 0) / nb.length;
            for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) { cands.push({ x: keep.x + (cx - keep.x) * f, y: keep.y + (cy - keep.y) * f }); nb.forEach((u) => cands.push({ x: keep.x + (P[u].x - keep.x) * f, y: keep.y + (P[u].y - keep.y) * f })); }
            let best = null;
            for (const c of cands) {
              _ogWorkN[5]++; if (!_ogClFree(P, N, v, c, gap)) continue;
              P[v] = c; const l1 = len(v);
              if (l1 < l0 - 4 && (!best || l1 < best.l) && _ogClCrossSet(P, EE, inc[v]) <= x0 && _ogClThruCount(P, N, EE, inc, v, 8) <= h0) best = { c, l: l1 };
              P[v] = keep;
            }
            if (best) { P[v] = best.c; moved = true; if (_ogTr) _ogTr.snap("tight", P); }
          }
          if (!moved) break;
        }
        const all = () => { let c = 0; for (let v = 0; v < n; v++) c += _ogClThruCount(P, N, EE, inc, v, 8); return c; }, h0 = all();
        let cxm = 0, cym = 0; P.forEach((p) => { cxm += p.x / n; cym += p.y / n; });
        for (let it = 0; it < 30; it++) {
          const old = P.map((p) => ({ x: p.x, y: p.y })); _ogWorkN[2] += n * n / 2;
          P.forEach((p) => { p.x = cxm + (p.x - cxm) * 0.96; p.y = cym + (p.y - cym) * 0.96; });
          let ok = true;
          for (let i = 0; i < n && ok; i++) for (let j = i + 1; j < n; j++) if (Math.abs(P[i].x - P[j].x) < (N[i].w + N[j].w) / 2 + gap && Math.abs(P[i].y - P[j].y) < (N[i].h + N[j].h) / 2 + gap) { ok = false; break; }
          if (!ok || all() > h0) { old.forEach((o, i) => { P[i].x = o.x; P[i].y = o.y; }); break; }
          if (_ogTr) _ogTr.snap("tight", P);
        }
      }
      // ── OG: Compact, Grouped and Auto layouts ────────────────────────────────
      // All three place every class at once so that straight distances match how many links apart two classes are (stress majorization
      // from a pivot-MDS start), then clean up: fewer crossings, classes moved off links, long links shortened. They differ in what they feed in:
      //  - Compact: plain link lengths; the best-scoring of a few variants (one-link classes placed afterwards in free directions, or moved
      //    there only when that is better; room round classes with many links; several random starts).
      //  - Grouped: links inside a group of closely linked classes (Louvain) shorter, links between groups longer, so the groups stand apart;
      //    a class with many links gets a ring wide enough for its neighbors; one-link classes placed afterwards. Best for large or
      //    hub-heavy models.
      //  - Auto: runs the variants that suit the size and keeps the best score.
      // Pure geometry, no Cytoscape: items [{w, h}], edges [[i, j, weight, labelWidth?]] (subclass links weight 2). Results { pos, crossings }.
      function _ogClPaths(m, adj) {
        // all-pairs shortest path lengths (Dijkstra with a binary heap); unreachable pairs get a distance a little beyond the longest one
        const D = Array.from({ length: m }, () => new Float64Array(m).fill(Infinity)); _ogWorkN[3] += 3 * m * m;
        for (let s = 0; s < m; s++) {
          const d = D[s]; d[s] = 0; const h = [[0, s]];
          while (h.length) {
            const top = h[0], last = h.pop();
            if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let k = i; if (l < h.length && h[l][0] < h[k][0]) k = l; if (r < h.length && h[r][0] < h[k][0]) k = r; if (k === i) break; const t = h[i]; h[i] = h[k]; h[k] = t; i = k; } }
            const du = top[0], u = top[1]; if (du > d[u]) continue;
            for (const [v, w] of adj[u]) { const nd = du + w; if (nd < d[v]) { d[v] = nd; h.push([nd, v]); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; const t = h[p]; h[p] = h[i]; h[i] = t; i = p; } } }
          }
        }
        let mx = 0; for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (isFinite(D[i][j])) mx = Math.max(mx, D[i][j]);
        for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (!isFinite(D[i][j])) D[i][j] = mx * 0.6 + 200;
        return D;
      }
      // Pivot MDS start: a good, repeatable first placement (no random start needed).
      function _ogClPivotMDS(D, n, rnd) {
        const k = Math.min(n, 60); _ogWorkN[3] += k * k * n + 400 * k * k + k * n; const piv = [Math.min(n - 1, Math.floor(rnd() * n))], mind = new Float64Array(n).fill(Infinity);
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
        const P = Array.from({ length: n }, (_, i) => { let x = 0, y = 0; for (let j = 0; j < k; j++) { x += C[i][j] * vecs[0][j]; y += C[i][j] * vecs[1][j]; } return { x, y }; });
        // The projection gives the right shape at an arbitrary scale and offset (on a 3,000-class model, millions of px away).
        // Stress keeps any offset and needs many sweeps from a wrong scale, so center the drawing and scale it to five times the
        // size whose distances to the pivots best match their targets (least squares): stress then unfolds the drawing rather
        // than pressing it together, which on the 15 development graphs gave as many crossed links and fewer links through
        // classes than starting at the matching size. Retested over 51 graphs and three seeds with the clean-up,
        // the pull-in and the link routing: 1x, 2x, 3x and 5x all within 0.5% on crossings, links through classes and sharp
        // crossings together (the spread between seeds), so 5x stays; _OG_TUNE.pmdsScale sets it for experiments.
        let mx = 0, my = 0; P.forEach((p) => { mx += p.x / n; my += p.y / n; }); P.forEach((p) => { p.x -= mx; p.y -= my; });
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) for (const p of piv) { const d = Math.hypot(P[i].x - P[p].x, P[i].y - P[p].y); if (isFinite(D[i][p])) { num += D[i][p] * d; den += d * d; } }
        const s = (den > 0 ? num / den : 1) * (_OG_TUNE.pmdsScale || 5); P.forEach((p) => { p.x *= s; p.y *= s; });
        return P;
      }
      // Stress majorization: each pair of classes pulled toward its target distance D, near pairs weighted most (1/d²).
      // deadline (work clock, optional): stop sweeping once it has passed; very large models get fewer sweeps, not a longer wait
      function _ogClStress(P, D, iters, rnd, deadline) {
        const n = P.length;
        for (let it = 0; it < iters && !(deadline && it && _ogNow() > deadline); it++) {
          let moved = 0; _ogWorkN[3] += n * n;
          for (let i = 0; i < n; i++) {
            const pi = P[i], Di = D[i]; let nx = 0, ny = 0, den = 0;
            for (let j = 0; j < n; j++) {
              if (i === j) continue;
              const pj = P[j], d = Di[j], w = 1 / (d * d); let dx = pi.x - pj.x, dy = pi.y - pj.y, cur = Math.sqrt(dx * dx + dy * dy);
              if (cur < 1e-3) { dx = rnd() - 0.5; dy = rnd() - 0.5; cur = Math.sqrt(dx * dx + dy * dy); }
              nx += w * (pj.x + d * dx / cur); ny += w * (pj.y + d * dy / cur); den += w;
            }
            const qx = nx / den, qy = ny / den; moved += Math.abs(qx - pi.x) + Math.abs(qy - pi.y); pi.x = qx; pi.y = qy;
          }
          if (_ogTr) _ogTr.snap("stress", P, { D }); // D: the target distances, for the playback's stress rings
          if (moved / n < 0.05) break;
        }
      }
      // Classes linked to one other class only (two links to the same class count as one), whose neighbor has other links
      // (a pair of classes linked only to each other stays together).
      function _ogClLeaves(n, EE) {
        const nb = Array.from({ length: n }, () => new Set()); EE.forEach((e) => { nb[e.s].add(e.t); nb[e.t].add(e.s); });
        const deg = nb.map((x) => x.size);
        const leafOf = new Array(n).fill(-1);
        EE.forEach((e) => { if (deg[e.s] === 1 && deg[e.t] > 1) leafOf[e.s] = e.t; else if (deg[e.t] === 1 && deg[e.s] > 1) leafOf[e.t] = e.s; });
        return leafOf;
      }
      // Put one-link classes beside their neighbor, in the direction where the new link crosses nothing and no link runs through the class,
      // at least gapOf[v] px from the neighbor's box (room for the link's text). improve: every class is placed already; move one only
      // when the new spot is better than where it is.
      function _ogClPlaceLeaves(P, N, EE, leafOf, gapOf, L, gap, improve, deadline, stage) {
        const n = P.length, kids = new Map();
        leafOf.forEach((p, v) => { if (p >= 0) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(v); } });
        const placed = new Uint8Array(n); for (let v = 0; v < n; v++) if (improve || leafOf[v] < 0) placed[v] = 1;
        // Every spot tried for a class lies within reach of its neighbor, so only the classes and links near there can count:
        // NB holds those classes for the class being placed (the same answers as checking all, much faster on large models).
        let NB = null;
        const freeAt = (v, p, c) => {
          _ogWorkN[2] += NB.length;
          for (const u of NB) {
            if (u === v || !placed[u]) continue; const g = u === p ? gapOf[v] : gap;
            if (Math.abs(P[u].x - c.x) < (N[u].w + N[v].w) / 2 + g && Math.abs(P[u].y - c.y) < (N[u].h + N[v].h) / 2 + g) return false;
          }
          return true;
        };
        // cost of a spot; gives up (Infinity) as soon as it cannot beat limit
        const costAt = (v, p, c, cur, limit) => {
          _ogWorkN[5]++;
          let cost = Math.hypot(c.x - P[p].x, c.y - P[p].y); const lim = limit === undefined ? Infinity : limit;
          if (cost >= lim) return Infinity;
          for (const e of cur) {
            if (_ogClSegBox(P[e.s].x - c.x, P[e.s].y - c.y, P[e.t].x - c.x, P[e.t].y - c.y, N[v].w / 2 + 4, N[v].h / 2 + 4)) cost += 80;
            if (e.s !== p && e.t !== p && _ogClSegX(P[p], c, P[e.s], P[e.t])) cost += 100;
            if (cost >= lim) return Infinity;
          }
          for (const u of NB) if (placed[u] && u !== p && u !== v && _ogClSegBox(P[p].x - P[u].x, P[p].y - P[u].y, c.x - P[u].x, c.y - P[u].y, N[u].w / 2 + 4, N[u].h / 2 + 4)) { cost += 80; if (cost >= lim) return Infinity; }
          return cost;
        };
        const order = [...kids.keys()].sort((a, b) => kids.get(b).length - kids.get(a).length);
        for (const p of order) {
          for (const v of kids.get(p).sort((a, b) => N[b].w - N[a].w)) {
            // placing is cheap below a few hundred classes, so only very large models ever search less once the time is up
            const late = deadline && n > 300 && _ogNow() > deadline, dirs = late ? 16 : 48;
            // the farthest spot tried is under r0 + 3 L from the neighbor, and r0 is at most √2 × the larger of the two box gaps
            const R = Math.SQRT2 * Math.max((N[p].w + N[v].w) / 2 + gapOf[v] + 1, ((N[p].h + N[v].h) / 2 + gapOf[v] + 1) / 0.75) + 3 * L + 24;
            let rx1 = P[p].x - R, rx2 = P[p].x + R, ry1 = P[p].y - R, ry2 = P[p].y + R;
            if (improve) { rx1 = Math.min(rx1, P[v].x); rx2 = Math.max(rx2, P[v].x); ry1 = Math.min(ry1, P[v].y); ry2 = Math.max(ry2, P[v].y); }
            const mx = N[v].w / 2 + Math.max(gap, gapOf[v]) + 4, my = N[v].h / 2 + Math.max(gap, gapOf[v]) + 4;
            NB = []; for (let u = 0; u < n; u++) if (P[u].x + N[u].w / 2 + mx > rx1 && P[u].x - N[u].w / 2 - mx < rx2 && P[u].y + N[u].h / 2 + my > ry1 && P[u].y - N[u].h / 2 - my < ry2) NB.push(u);
            const cur = EE.filter((e) => placed[e.s] && placed[e.t] && e.s !== v && e.t !== v && Math.max(P[e.s].x, P[e.t].x) > rx1 - mx && Math.min(P[e.s].x, P[e.t].x) < rx2 + mx && Math.max(P[e.s].y, P[e.t].y) > ry1 - my && Math.min(P[e.s].y, P[e.t].y) < ry2 + my);
            let best = improve ? (freeAt(v, p, P[v]) ? { cost: costAt(v, p, P[v], cur) - 6, c: P[v] } : null) : null;
            if (improve && late) { placed[v] = 1; continue; }
            for (let a = 0; a < dirs; a++) {
              const th = a * 2 * Math.PI / dirs, ux = Math.cos(th), uy = Math.sin(th) * 0.75;
              // nearest distance in this direction at which the boxes are gapOf apart
              const r0 = Math.min(((N[p].w + N[v].w) / 2 + gapOf[v] + 1) / Math.max(Math.abs(ux), 1e-6), ((N[p].h + N[v].h) / 2 + gapOf[v] + 1) / Math.max(Math.abs(uy), 1e-6));
              let tries = 0;
              for (let r = r0; r < r0 + L * 3 && tries < (late ? 2 : 6) && !(best && best.cost < 100 && r > best.cost); r += 18) {
                const c = { x: P[p].x + ux * r, y: P[p].y + uy * r };
                if (!freeAt(v, p, c)) continue;
                tries++;
                const cost = costAt(v, p, c, cur, best ? best.cost : Infinity);
                if (!best || cost < best.cost) best = { cost, c };
                if (cost < 100) break;
              }
            }
            if (best && best.cost >= 100 && !improve) {
              // every nearby spot crosses a link or has one running through it: look further out, all round
              for (let a = 0; a < 72; a++) {
                const th = a * 2 * Math.PI / 72, ux = Math.cos(th), uy = Math.sin(th) * 0.75;
                const r0 = Math.min(((N[p].w + N[v].w) / 2 + gapOf[v] + 1) / Math.max(Math.abs(ux), 1e-6), ((N[p].h + N[v].h) / 2 + gapOf[v] + 1) / Math.max(Math.abs(uy), 1e-6));
                for (let r = r0; r < r0 + L * 1.5 && !(best.cost < 100 && r > best.cost); r += 24) {
                  const c = { x: P[p].x + ux * r, y: P[p].y + uy * r };
                  if (!freeAt(v, p, c)) continue;
                  const cost = costAt(v, p, c, cur, best.cost);
                  if (cost < best.cost) best = { cost, c };
                  if (cost < 100) break;
                }
              }
            }
            // no free spot near the neighbor (a crowded hub on a very large model): look further out, ring by ring, and in the
            // end take the outermost spot tried, so a class is never left where it started
            if (!best) for (let r = 4, done = false; r <= 12 && !done; r += 2) for (let a = 0; a < 16; a++) {
              const th = a * Math.PI / 8, c = { x: P[p].x + Math.cos(th) * r * L, y: P[p].y + Math.sin(th) * r * L * 0.75 };
              if (freeAt(v, p, c) || r === 12) { best = { cost: 0, c }; done = true; break; }
            }
            if (best) P[v] = best.c; placed[v] = 1;
            if (_ogTr) _ogTr.snap(stage || "leaves", P, { v, p });
          }
        }
      }
      // One layout run. cfg: { L, init: "pmds", leaves, leafFix, hub, pods, restarts, budget }.
      function _ogStressLayout(items, edges, cfg, opts) {
        const n = items.length; if (n < 2 || !edges.length) return null;
        const o = opts || {}, sc = o.roomy ? 1.3 : 1, L = (cfg.L || 170) * sc, seed = o.seed || 1, rnd = _ogClRng(seed * 31 + 7);
        const N = items.map((it) => ({ w: it.w + 16 * sc, h: it.h + 12 * sc }));
        const EE = edges.filter(([a, b]) => a !== b).map(([a, b, w, lab]) => ({ s: a, t: b, sub: w === 2, lab: lab || 0 }));
        if (!EE.length) return null;
        const t0 = _ogNow(), budget = cfg.budget || 1500, left = () => Math.max(20, budget - (_ogNow() - t0));
        const leafAll = _ogClLeaves(n, EE), leafOf = cfg.leaves ? leafAll : new Array(n).fill(-1);
        // room beside a one-link class: at least 40 px, more when its link carries text
        const gapOf = new Array(n).fill(40 * sc); EE.forEach((e) => { [e.s, e.t].forEach((v) => { if (leafAll[v] >= 0) gapOf[v] = Math.max(gapOf[v], e.lab + 16); }); });
        const core = [...Array(n).keys()].filter((v) => leafOf[v] < 0), ci = new Map(core.map((v, k) => [v, k])), m = core.length;
        const nb = Array.from({ length: n }, () => new Set()); EE.forEach((e) => { nb[e.s].add(e.t); nb[e.t].add(e.s); });
        // a class with k links needs a ring of radius about k × (box width + gap) / 2π to hold its neighbors side by side
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
        // halo (cfg.halo, off by default): a class that hides k one-link classes stands apart from the rest by sqrt(k) × L / π, as if it were a disc
        if (cfg.halo) {
          const nl = new Array(m).fill(0); leafOf.forEach((p, v) => { if (p >= 0 && ci.has(p)) nl[ci.get(p)]++; });
          // cfg.haloMin2: only a class hiding two or more leaves gets a halo, of sqrt(k - 1) × L / π
          const R = nl.map((k) => (cfg.haloMin2 ? (k >= 2 ? Math.sqrt(k - 1) : 0) : Math.sqrt(k)) * cfg.halo * L / Math.PI);
          for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (i !== j) D[i][j] += R[i] + R[j];
        }
        const NC = core.map((v) => N[v]), EC = EE.filter((e) => ci.has(e.s) && ci.has(e.t)).map((e) => ({ s: ci.get(e.s), t: ci.get(e.t) }));
        const restarts = cfg.restarts != null ? cfg.restarts : (m <= 30 ? 8 : m <= 80 ? 4 : 2), countX = EC.length <= 2500;
        let best = null;
        if (_ogTr) { _ogTr.begin(cfg.name, n, core, leafOf); _ogTr.map = core; }
        for (let r = 0; r < Math.max(1, restarts) && (r === 0 || _ogNow() - t0 < budget * 0.4); r++) {
          const PC = cfg.init === "pmds" && r === 0 && m > 2 ? _ogClPivotMDS(D, m, rnd) : NC.map(() => ({ x: (rnd() - 0.5) * 400, y: (rnd() - 0.5) * 400 }));
          if (_ogTr) { _ogTr.restart(r); _ogTr.snap(cfg.init === "pmds" && r === 0 && m > 2 ? "start" : "restart", PC); }
          _ogClStress(PC, D, cfg.sweeps || 120, rnd, t0 + budget * 0.4); _ogClSeparate(PC, NC, 12, 120);
          if (_ogTr) _ogTr.snap("separate", PC);
          const x = countX ? _ogClCrossings(PC, EC) : 0; if (!best || x < best.x) best = { x, P: PC, r };
        }
        if (_ogTr) _ogTr.keepRestart(best.r);
        const PC = best.P;
        if (countX && EC.length) {
          // _OG_TUNE.order (experiments, the playback): the order of these three steps; each keeps its own share of the time
          const fin = { cross: () => { _ogClFinCross(PC, NC, EC, Math.min(m <= 30 ? 150 : 300, left() / 3), seed); _ogClSeparate(PC, NC, 12, 120); if (_ogTr) _ogTr.snap("separate", PC); },
            thru: () => _ogClFinThru(PC, NC, EC, 12, 10, left() / 3), tight: () => _ogClFinTight(PC, NC, EC, 12, 26 * sc, left() / 2) };
          (_OG_TUNE.order || ["cross", "thru", "tight"]).forEach((k) => { if (fin[k] && !_ogSkip(k)) fin[k](); });
          if (!_ogSkip("thru")) _ogClFinThru(PC, NC, EC, 8, 10, left() / 2);
        } else if (EC.length && !_ogSkip("tight")) _ogClFinTight(PC, NC, EC, 6, 26 * sc, left() / 2);
        const P = new Array(n); core.forEach((v, k) => (P[v] = PC[k]));
        for (let v = 0; v < n; v++) if (!P[v]) P[v] = { x: 0, y: 0 };
        if (_ogTr) _ogTr.map = null;
        const deadline = t0 + budget;
        if (cfg.leaves) {
          _ogClPlaceLeaves(P, N, EE, leafOf, gapOf, L, 10, false, deadline);
          if (!_ogSkip("thru")) _ogClFinThru(P, N, EE, 6, 10, left() / 2);
          if (!_ogSkip("tight")) _ogClFinTight(P, N, EE, 6, 26 * sc, left());
        }
        if (cfg.leaves || cfg.leafFix) {
          // clean-up may have pulled a one-link class closer than its room allows, or a better spot may be free now
          const short = leafAll.map((p, v) => p >= 0 && Math.max(Math.abs(P[v].x - P[p].x) - (N[v].w + N[p].w) / 2, Math.abs(P[v].y - P[p].y) - (N[v].h + N[p].h) / 2) < gapOf[v] - 0.5 ? p : -1);
          if (short.some((p) => p >= 0)) _ogClPlaceLeaves(P, N, EE, short, gapOf, L, 10, false, deadline, "leaffix");
          // and the clean-up may have moved a link across a one-link class's link or through its box: put those classes back once more
          const isBad = (v, p) => {
            for (const e of EE) {
              if (e.s === v || e.t === v) continue;
              if (_ogClSegBox(P[e.s].x - P[v].x, P[e.s].y - P[v].y, P[e.t].x - P[v].x, P[e.t].y - P[v].y, N[v].w / 2 + 2, N[v].h / 2 + 2)) return true;
              if (e.s !== p && e.t !== p && _ogClSegX(P[p], P[v], P[e.s], P[e.t])) return true;
            }
            for (let u = 0; u < n; u++) if (u !== v && u !== p && _ogClSegBox(P[p].x - P[u].x, P[p].y - P[u].y, P[v].x - P[u].x, P[v].y - P[u].y, N[u].w / 2 + 2, N[u].h / 2 + 2)) return true;
            return false;
          };
          for (let pass = 0; pass < 2 && (n <= 300 || _ogNow() < deadline + budget / 4); pass++) {
            const bad = leafAll.map((p, v) => (p >= 0 && isBad(v, p) ? p : -1));
            if (!bad.some((p) => p >= 0)) break;
            _ogClPlaceLeaves(P, N, EE, bad, gapOf, L, 10, false, deadline, "leaffix");
          }
          if (cfg.leafFix) _ogClPlaceLeaves(P, N, EE, leafAll, gapOf, L, 10, true, deadline, "leaffix");
        }
        return { pos: P, crossings: countX ? _ogClCrossings(P, EE) : 0 };
      }
      // The variants the layouts choose from (tested on 28 model shapes, 9 to 540 classes).
      const _OG_VARIANTS = {
        stress: { family: "compact" },
        mds: { family: "compact", init: "pmds", leafFix: true },
        hubs: { family: "compact", init: "pmds", hub: 20, leaves: true },
        leaves: { family: "compact", init: "pmds", leaves: true },
        groups: { family: "grouped", init: "pmds", pods: 1.6, hub: 20, leaves: true }
      };
      // Run each variant (sharing the time budget), score each, keep the best. Returns { pos, crossings, algo, variant, scores } or null.
      function _ogBestOf(items, edges, opts, list, total) {
        const n = items.length, o = opts || {}, sc = o.roomy ? 1.3 : 1, N = items.map((it) => ({ w: it.w + 16 * sc, h: it.h + 12 * sc }));
        const EE = edges.filter(([a, b]) => a !== b).map(([a, b]) => ({ s: a, t: b }));
        const t0 = _ogNow(), scores = {}; let best = null;
        list.forEach((cfg, k) => {
          const spent = _ogNow() - t0; if (k && spent > total) return;
          let r = null;
          try { r = _ogStressLayout(items, edges, { ...cfg, budget: Math.max(150, (total - spent) / (list.length - k)) }, o); }
          catch (err) { if (typeof log === "function") log("debug", "Layout variant " + cfg.name + " failed: " + (err && err.message)); }
          if (!r) return;
          // the drawing that is scored is the one returned: separated so that no boxes touch
          const P = r.pos.map((p) => ({ x: p.x, y: p.y })); _ogClSeparate(P, N, 6, 40);
          if (_ogTr) _ogTr.snap("separate", P);
          const s = _ogChoiceScore(_ogPlacementMetrics(P, N, EE)), fam = cfg.family;
          if (_ogTr) _ogTr.score(cfg.name, s);
          if (scores[fam] === undefined || s < scores[fam]) scores[fam] = s;
          if (!best || s < best.score) best = { score: s, pos: P, crossings: r.crossings, algo: fam, variant: cfg.name };
        });
        if (_ogTr && best) _ogTr.chosen(best.variant);
        return best && { pos: best.pos, crossings: best.crossings, algo: best.algo, variant: best.variant, scores };
      }
      const _OG_TUNE = {}; // experiments only: settings merged into every variant (the benchmark sets them; empty in use)
      const _ogV = (k, extra) => ({ ..._OG_VARIANTS[k], ..._OG_TUNE, name: k, ...(extra || {}) });
      // Small models are cheap, so several variants are tried; larger ones give the whole time to fewer (sharing it starves the clean-up).
      const _ogCompactVariants = (n) => n <= 30 ? [_ogV("mds"), _ogV("stress"), _ogV("hubs"), _ogV("leaves")] : n <= 60 ? [_ogV("mds"), _ogV("stress"), _ogV("leaves")] : [_ogV("mds")];
      function _ogCompactLayout(items, edges, opts) {
        const n = items.length;
        return _ogClocked(() => _ogBestOf(items, edges, opts, _ogCompactVariants(n), (opts && opts.budgetMs) || 1500));
      }
      // Grouped needs enough classes to form groups; smaller models go to the force layout. Above 100 classes the layout gets
      // 0.6 s so that the clean-up after it has time left: on large models that gives fewer problems than a longer layout.
      function _ogGroupedLayout(items, edges, opts) {
        const n = items.length; if (n < 8 || !edges.length) return null;
        return _ogClocked(() => _ogBestOf(items, edges, opts, [_ogV("groups", { L: n >= 100 ? 260 : 170 })], (opts && opts.budgetMs) || (n > 100 ? 600 : 1000)));
      }
      // How good a placement is, for choosing among layouts: crossed links, links through classes, near-touching links, touching classes,
      // mean link length, links much longer than the typical link, and the area taken per unit of class area.
      // P: [{x, y}], N: [{w, h}], EE: [{s, t}].
      function _ogPlacementMetrics(P, N, EE) {
        const n = P.length; let near = 0, thru = 0, ov = 0, len = 0, boxArea = 0; _ogWorkN[2] += EE.length * EE.length / 2 + n * n / 2;
        const cross = EE.length <= 2500 ? _ogClCrossings(P, EE) : 0;
        // links whose boxes lie 30 px or more apart cannot be near each other: the exact distance is skipped
        if (EE.length <= 1500) for (let i = 0; i < EE.length; i++) {
          const e = EE[i], A = P[e.s], B = P[e.t], x1 = Math.min(A.x, B.x) - 30, x2 = Math.max(A.x, B.x) + 30, y1 = Math.min(A.y, B.y) - 30, y2 = Math.max(A.y, B.y) + 30;
          for (let j = i + 1; j < EE.length; j++) {
            const f = EE[j]; if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue;
            const C = P[f.s], D = P[f.t]; if ((C.x <= x1 && D.x <= x1) || (C.x >= x2 && D.x >= x2) || (C.y <= y1 && D.y <= y1) || (C.y >= y2 && D.y >= y2)) continue;
            if (_ogClDSS(A, B, C, D) < 30) near++;
          }
        }
        const lens = [];
        for (const e of EE) {
          const A = P[e.s], B = P[e.t], l = Math.hypot(A.x - B.x, A.y - B.y); len += l; lens.push(l);
          for (let i = 0; i < n; i++) {
            if (i === e.s || i === e.t) continue;
            // a link whose two ends lie beyond the same side of a class's box cannot touch it
            const hw = N[i].w / 2 + 6, hh = N[i].h / 2 + 6, ax = A.x - P[i].x, ay = A.y - P[i].y, bx = B.x - P[i].x, by = B.y - P[i].y;
            if ((ax < -hw && bx < -hw) || (ax > hw && bx > hw) || (ay < -hh && by < -hh) || (ay > hh && by > hh)) continue;
            if (_ogClSegBox(ax, ay, bx, by, hw, hh)) thru++;
          }
        }
        lens.sort((a, b) => a - b); const med = lens[lens.length >> 1] || 1; let lout = 0; lens.forEach((l) => (lout += Math.max(0, l / med - 1.8)));
        let x1 = 1e9, x2 = -1e9, y1 = 1e9, y2 = -1e9;
        for (let i = 0; i < n; i++) {
          boxArea += N[i].w * N[i].h;
          x1 = Math.min(x1, P[i].x - N[i].w / 2); x2 = Math.max(x2, P[i].x + N[i].w / 2); y1 = Math.min(y1, P[i].y - N[i].h / 2); y2 = Math.max(y2, P[i].y + N[i].h / 2);
          for (let j = i + 1; j < n; j++) if (Math.abs(P[i].x - P[j].x) < (N[i].w + N[j].w) / 2 && Math.abs(P[i].y - P[j].y) < (N[i].h + N[j].h) / 2) ov++;
        }
        const area = (x2 - x1) * (y2 - y1);
        return { n, cross, near, thru, ov, len: len / Math.max(1, EE.length), lout, area, fill: area / Math.max(1, boxArea) };
      }
      function _ogPlacementScore(m) {
        return _ogChoiceScore(m) + Math.max(0, m.len - 350) / 2 + 25 * (m.lout || 0);
      }
      // Top-down tree for models made mostly of subclass links. Classes stand on levels: each class one level below its deepest
      // superclass (the longest chain of subclass links from a root), so every superclass is on a higher level than its
      // subclasses, second superclasses included. Each class hangs under one superclass on the level just above; subtrees sit
      // side by side under it, and each level sits deep enough below the one above that no straight line from a parent to its
      // child clips a sibling's box. The tree itself then has no crossing and no link through a class; only second
      // superclasses and relationships can cross. In a subclass cycle, the link that closes the cycle is the only one that
      // points up. items [{w, h}], edges [[i, j, weight]] -> { pos } (classes with no link go in a row underneath).
      function _ogTreeLayout(items, edges, opts) {
        const n = items.length, sc = opts && opts.roomy ? 1.3 : 1, SIB = 18 * sc, MINGAP = 50 * sc;
        const N = items.map((it) => ({ w: it.w + 16 * sc, h: it.h + 12 * sc }));
        const par = Array.from({ length: n }, () => []), kidsAll = Array.from({ length: n }, () => []), linked = new Uint8Array(n);
        edges.forEach(([a, b, w]) => { if (a === b) return; linked[a] = linked[b] = 1; if (w === 2) { par[a].push(b); kidsAll[b].push(a); } });
        // levels by the longest chain (a class is placed once all its superclasses are); a class left in a cycle is released
        // with the level its placed superclasses give it
        const level = new Array(n).fill(-1), atLeast = new Array(n).fill(0), waiting = par.map((ps) => ps.length), order = [];
        let head = 0;
        const expand = () => { for (; head < order.length; head++) { const v = order[head];
          for (const k of kidsAll[v]) { if (level[k] >= 0) continue; atLeast[k] = Math.max(atLeast[k], level[v] + 1); if (--waiting[k] === 0) { level[k] = atLeast[k]; order.push(k); } } } };
        for (let v = 0; v < n; v++) if (linked[v] && !waiting[v]) { level[v] = 0; order.push(v); }
        expand();
        for (let v = 0; v < n; v++) if (level[v] < 0 && linked[v]) { level[v] = atLeast[v]; order.push(v); expand(); }
        // each class hangs under a superclass on the level just above (there is one unless the class starts a level-0 tree)
        const tp = new Array(n).fill(-1), kids = Array.from({ length: n }, () => []);
        for (const v of order) { const p = par[v].find((u) => level[u] === level[v] - 1); if (p !== undefined) { tp[v] = p; kids[p].push(v); } }
        const size = new Array(n).fill(1); for (let i = order.length - 1; i >= 0; i--) if (tp[order[i]] >= 0) size[tp[order[i]]] += size[order[i]];
        // a balanced fan: small subtrees at the two ends, large ones toward the middle
        const fan = (ks) => { const out = []; ks.slice().sort((a, b) => size[a] - size[b] || a - b).forEach((v, i) => (i % 2 ? out.push(v) : out.unshift(v))); return out; };
        const gap = []; // gap[d]: how far level d sits below level d − 1, the largest any parent on level d − 1 needs
        function lay(v) { // x offsets of the subtree of v from v, and its extents
          const ks = fan(kids[v]); if (!ks.length) return { pts: [[v, 0]], l: -N[v].w / 2, r: N[v].w / 2 };
          const subs = ks.map(lay), X = []; let x = 0;
          subs.forEach((s, i) => { if (i) x += SIB; x -= s.l; X.push(x); x += s.r; });
          const mid = (X[0] + X[X.length - 1]) / 2; for (let i = 0; i < X.length; i++) X[i] -= mid;
          // the line to child i, from the parent's center, clears neighbor j's box (j nearer the parent) at depth G when
          // G ≥ |X_i| · (h_j/2 + 4) / (|X_i − X_j| − w_j/2); a deeper level only clears it more
          let G = MINGAP + (N[v].h + Math.max(...ks.map((k) => N[k].h))) / 2;
          ks.forEach((k, i) => [i - 1, i + 1].forEach((j) => { if (j < 0 || j >= ks.length || Math.abs(X[j]) >= Math.abs(X[i])) return;
            const room = Math.abs(X[i] - X[j]) - N[ks[j]].w / 2; if (room > 1) G = Math.max(G, Math.abs(X[i]) * (N[ks[j]].h / 2 + 4) / room); }));
          _ogWorkN[2] += ks.length * 2;
          const d = level[v] + 1; gap[d] = Math.max(gap[d] || 0, G);
          const pts = [[v, 0]]; let l = -N[v].w / 2, r = N[v].w / 2;
          subs.forEach((s, i) => { s.pts.forEach(([u, dx]) => pts.push([u, X[i] + dx])); l = Math.min(l, X[i] + s.l); r = Math.max(r, X[i] + s.r); });
          return { pts, l, r };
        }
        const X = new Array(n); let x = 0;
        fan(order.filter((v) => tp[v] < 0)).forEach((v) => { const s = lay(v); x -= s.l; s.pts.forEach(([u, dx]) => (X[u] = x + dx)); x += s.r + 3 * SIB; });
        const Y = [0]; let top = 0; for (let d = 1; d < gap.length || d <= Math.max(0, ...level); d++) Y[d] = Y[d - 1] + (gap[d] || MINGAP + 40 * sc);
        level.forEach((d) => { if (d > top) top = d; });
        const P = new Array(n); let ux = 0;
        for (let v = 0; v < n; v++) if (X[v] !== undefined) P[v] = { x: X[v], y: Y[level[v]] };
        for (let v = 0; v < n; v++) if (!P[v]) { P[v] = { x: ux + N[v].w / 2, y: Y[top] + 80 * sc }; ux += N[v].w + SIB; }
        return { pos: P, crossings: 0 };
      }
      // The score Best Read chooses by: the readability score without its penalties for long links (mean length beyond 350 px
      // and links much longer than the typical one). Those penalties made it pass over pod layouts with fewer crossings; on the
      // 15 development graphs, choosing without them gave 6.5% fewer crossings plus links through classes for 7% more area.
      function _ogChoiceScore(m) { return 10 * m.cross + 8 * m.thru + 2 * m.near + 40 * m.ov + m.len / 10 + Math.max(0, (m.fill || 0) - 8) * 4 * Math.sqrt(m.n || 1); }
      // Automatic choice: the variants that suit the size, best score kept. Returns { pos, crossings, algo, scores } or null.
      // (It used to draw the top-down tree when most links were subclass links. Over the 51 benchmark graphs the
      // tree was kept once, on Dublin Core terms, where the drawing kept without it has no crossing and no link through a class
      // either; these layouts are for business models joined mostly by relationships, so it was dropped. _ogTreeLayout is still
      // there for an app that wants a taxonomy drawn as a tree.)
      function _ogAutoLayout(items, edges, opts) {
        // dense models (more than two links per class) give their time to fewer variants, or the clean-up of each is starved.
        // The time limits leave the clean-up after the layout its share of 1.5 s (0.9 s up to 100 classes, 0.6 s above).
        const n = items.length, dense = n > 30 && edges.length > 2 * n, list = n > 100 ? [] : dense ? [_ogV("mds")] : _ogCompactVariants(n);
        if (n >= 8) list.push(_ogV("groups", { L: n >= 100 ? 260 : 170 }));
        if (!list.length) list.push(_ogV("mds"));
        if (_OG_TUNE.addHalo && n >= 8) list.push(_ogV("hubs", { halo: 1, name: "hubs+halo" }));
        if (_OG_TUNE.addHaloGroups && n >= 8) list.push(_ogV("groups", { L: n >= 100 ? 260 : 170, halo: 1, name: "groups+halo" }));
        return _ogClocked(() => _ogBestOf(items, edges, opts, list, (opts && opts.budgetMs) || (n <= 30 ? 1500 : n <= 100 ? 900 : 600)));
      }
      // ── Clean-up after a layout ──
      // Generalized from recorded sessions of a person tidying these layouts by hand. It runs after a layout, on its positions:
      //   1. single moves: a class at the end of a crossed link, or one a link runs through, moves into nearby open space (a grid
      //      over the drawing whose cells hold no class and no link) or is nudged a little; link length is not a goal;
      //   2. leaf units: a leaf, a short leaf chain, a leaf triangle or loop hangs off the rest of the graph by one class (its anchor),
      //      so it can always be turned around that anchor, stretched, mirrored or reordered until it crosses nothing; a single
      //      leaf with a long label tries sideways spots first, since a long label reads best on a link that runs sideways;
      //   3. crowd spreading: problems are counted on a grid of cells one link long; the regions with the most problems are spread
      //      outward in 8 slices around their center, more where open space lies beyond, pushing the neighbors further out a
      //      little too; a few single moves then repair, and the step is kept only if the drawing ends up better;
      //   4. group moves: the classes on one side of a remaining problem move together away from the line, with a few repair moves;
      //   5. a last pass over leaf units and single classes, which can be left on a line by the moves before.
      // Growing the drawing's area is penalised, so open space inside the drawing is used before the drawing gets bigger.
      // A class or problem that could not be improved is tried again only once something near it has moved.
      // Straight links only. _ogHandTidy.run(P, D, E, opts) with P [{x,y}], D [{w,h}], E [{s,t}] -> { P, log, stats };
      // opts.budgetMs bounds the whole run, opts.record keeps every step for replaying it.
      const _ogHandTidy = (function () {
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
        function segBox(a, b, c, hw, hh) { // Liang-Barsky: does segment a-b touch the box of half-size hw, hh centered on c?
          let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y;
          const p = [-dx, dx, -dy, dy], q = [a.x - (c.x - hw), c.x + hw - a.x, a.y - (c.y - hh), c.y + hh - a.y];
          for (let i = 0; i < 4; i++) {
            if (p[i] === 0) { if (q[i] < 0) return false; continue; }
            const r = q[i] / p[i];
            if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
          }
          return true;
        }
        const DEF = { budgetMs: 2000, unitSize: 4, clearance: 8, groupDepth: 4, groups: true, spread: true, spreadRepair: true, finish: true, order: ['single', 'unit', 'spread', 'group'], cell: 0.3, repReach: 1.8, repOpen: 12, repCap: 99, crowdMax: 10, groupTop: 2, downGap: 20, W: { cross: 6, sharp: 3, thru: 10, tight: 1, ov: 1e6, area: 6 } };

        function Model(P0, D, E0, o) {
          const n = P0.length, seen = new Set(), E = [];
          E0.forEach((e) => { if (e.s === e.t) return; const k = Math.min(e.s, e.t) + ',' + Math.max(e.s, e.t); if (!seen.has(k)) { seen.add(k); E.push({ s: e.s, t: e.t }); } });
          const inc = Array.from({ length: n }, () => []), adj = Array.from({ length: n }, () => []);
          E.forEach((e, k) => { inc[e.s].push(k); inc[e.t].push(k); adj[e.s].push(e.t); adj[e.t].push(e.s); });
          const M = { n, m: E.length, P: P0.map((p) => ({ x: p.x, y: p.y })), D, E, inc, adj, o, W: o.W,
            hw: D.map((d) => d.w / 2 + o.clearance), hh: D.map((d) => d.h / 2 + o.clearance),
            // classes keep at least 16 px apart sideways and 12 px vertically, the gap the layouts' overlap removal leaves
            ow: D.map((d) => d.w / 2 + 8), oh: D.map((d) => d.h / 2 + 6), mN: new Uint8Array(n), mE: new Uint8Array(E.length),
            // for the grid: the extent a class is listed with (its larger box plus a pixel), and scratch marks
            ex: D.map((d) => d.w / 2 + Math.max(o.clearance, 8) + 1), ey: D.map((d) => d.h / 2 + Math.max(o.clearance, 6) + 1),
            vSeen: new Int32Array(n), eSeen: new Int32Array(E.length), tSeen: new Int32Array(n), sSeen: new Int32Array(n), qStamp: 0, eStamp: new Int32Array(E.length), isMovedE: new Uint8Array(E.length), isMovedN: new Uint8Array(n) };
          const ls = E.map((e) => Math.hypot(M.P[e.s].x - M.P[e.t].x, M.P[e.s].y - M.P[e.t].y)).sort((a, b) => a - b);
          M.medLen = ls[ls.length >> 1] || 150; M.A0 = bboxArea(M);
          // opts.down [[subclass, superclass]]: keep each subclass at least opts.downGap px below its superclass (a drawing that
          // starts top-down stays top-down); a link drawn upward costs as much as an overlap
          M.dn = null; if (o.down && o.down.length) { M.dn = Array.from({ length: n }, () => []); o.down.forEach(([c, p]) => { if (c !== p) { M.dn[c].push([p, 1]); M.dn[p].push([c, -1]); } }); }
          return M;
        }
        // cramped classes among S and their neighbors, each counted once (a stamp per evaluation instead of a new Set)
        function tightAround(M, S) {
          const q = ++M.qStamp, seen = M.tSeen; let c = 0;
          const one = (v) => { if (seen[v] !== q) { seen[v] = q; if (minAngle(M, v) < 15) c += M.W.tight; } };
          for (const v of S) { one(v); for (const u of M.adj[v]) one(u); }
          return c;
        }
        const upward = (M, v, u, dir) => (dir > 0 ? M.P[v].y < M.P[u].y + M.o.downGap : M.P[u].y < M.P[v].y + M.o.downGap);
        function upCost(M, S, mN) { let c = 0; for (const v of S) for (const [u, dir] of M.dn[v]) if ((!mN[u] || u > v) && upward(M, v, u, dir)) c += M.W.ov; return c; }
        function upAll(M) { let c = 0; if (M.dn) M.o.down.forEach(([v, u]) => { if (v !== u && upward(M, v, u, 1)) c += M.W.ov; }); return c; }
        function bboxArea(M) {
          let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18;
          M.P.forEach((p, i) => { const w = M.D[i].w / 2, h = M.D[i].h / 2; if (p.x - w < x1) x1 = p.x - w; if (p.x + w > x2) x2 = p.x + w; if (p.y - h < y1) y1 = p.y - h; if (p.y + h > y2) y2 = p.y + h; });
          return (x2 - x1) * (y2 - y1);
        }
        const areaPen = (M) => M.W.area * 100 * Math.max(0, bboxArea(M) / M.A0 - 1);
        function minAngle(M, v) {
          _ogWorkN[4] += 2; const a = M.adj[v]; if (a.length < 2) return 360;
          const th = a.map((u) => Math.atan2(M.P[u].y - M.P[v].y, M.P[u].x - M.P[v].x)).sort((x, y) => x - y);
          let mn = 2 * Math.PI - (th[th.length - 1] - th[0]); for (let i = 1; i < th.length; i++) mn = Math.min(mn, th[i] - th[i - 1]);
          return mn * 180 / Math.PI;
        }
        function pairCost(M, a, f) {
          _ogWorkN[4]++;
          const ea = M.E[a], ef = M.E[f]; if (ea.s === ef.s || ea.s === ef.t || ea.t === ef.s || ea.t === ef.t) return 0;
          const A = M.P[ea.s], B = M.P[ea.t], C = M.P[ef.s], D = M.P[ef.t];
          if (Math.max(A.x, B.x) < Math.min(C.x, D.x) || Math.max(C.x, D.x) < Math.min(A.x, B.x) || Math.max(A.y, B.y) < Math.min(C.y, D.y) || Math.max(C.y, D.y) < Math.min(A.y, B.y)) return 0;
          if (!crosses(A, B, C, D)) return 0;
          return M.W.cross + (angle(A, B, C, D) < 30 ? M.W.sharp : 0);
        }
        const thruCost = (M, k, v) => { _ogWorkN[4]++; const e = M.E[k]; return v !== e.s && v !== e.t && segBox(M.P[e.s], M.P[e.t], M.P[v], M.hw[v], M.hh[v]) ? M.W.thru : 0; };
        const overlaps = (M, u, v) => ++_ogWorkN[4] && Math.abs(M.P[u].x - M.P[v].x) < M.ow[u] + M.ow[v] && Math.abs(M.P[u].y - M.P[v].y) < M.oh[u] + M.oh[v];
        // Spatial index: a grid of cells one link long. Each class is listed in the cells its box covers, each link in the cells
        // its line passes through, so a check looks only at what is nearby instead of at every link and class. Positions are
        // objects that are replaced, never changed in place, so a class whose position object is not the one the grid was built
        // with has moved: it and its links are checked directly, and the grid is rebuilt once many classes have moved. The
        // grid's bounds hold every class when it is built, so nothing outside them can be missed. Same results as checking all.
        function buildGrid(M) {
          const ex = M.ex, ey = M.ey; let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18;
          M.P.forEach((p, i) => { x1 = Math.min(x1, p.x - ex[i]); x2 = Math.max(x2, p.x + ex[i]); y1 = Math.min(y1, p.y - ey[i]); y2 = Math.max(y2, p.y + ey[i]); });
          const s = cellSize(M.medLen, x1, y1, x2, y2); x1 -= s; y1 -= s; x2 += s; y2 += s;
          const cols = Math.max(1, Math.ceil((x2 - x1) / s)), rows = Math.max(1, Math.ceil((y2 - y1) / s));
          const G = { s, x1, y1, x2: x1 + cols * s, y2: y1 + rows * s, cols, rows, nodes: Array.from({ length: cols * rows }, () => []), edges: Array.from({ length: cols * rows }, () => []), ref: M.P.slice(), stamp: 0 };
          M.P.forEach((p, i) => boxCells(G, p, ex[i], ey[i], (c) => G.nodes[c].push(i)));
          M.E.forEach((e, k) => segCells(G, M.P[e.s], M.P[e.t], (c) => G.edges[c].push(k)));
          M.grid = G; M.gridBuilds = (M.gridBuilds || 0) + 1; return G;
        }
        // A cell is never smaller than 1/256 of the drawing's width or height (nor than 1 px), so stacked classes or one class
        // far away cannot make a grid of millions of cells
        const cellSize = (base, x1, y1, x2, y2) => Math.max(base, Math.max(x2 - x1, y2 - y1) / 256, 1);
        const cellX = (G, x) => Math.min(G.cols - 1, Math.max(0, Math.floor((x - G.x1) / G.s))), cellY = (G, y) => Math.min(G.rows - 1, Math.max(0, Math.floor((y - G.y1) / G.s)));
        function boxCells(G, p, hw, hh, f) {
          const a = cellX(G, p.x - hw), b = cellX(G, p.x + hw), c = cellY(G, p.y - hh), d = cellY(G, p.y + hh);
          for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) f(y * G.cols + x);
        }
        // the cells a segment passes through (clipped to the grid), stepping from cell to cell along the line
        function segCells(G, A, B, f) {
          let t0 = 0, t1 = 1; const dx = B.x - A.x, dy = B.y - A.y;
          const p = [-dx, dx, -dy, dy], q = [A.x - G.x1, G.x2 - A.x, A.y - G.y1, G.y2 - A.y];
          for (let i = 0; i < 4; i++) {
            if (p[i] === 0) { if (q[i] < 0) return; continue; }
            const r = q[i] / p[i]; if (p[i] < 0) { if (r > t1) return; if (r > t0) t0 = r; } else { if (r < t0) return; if (r < t1) t1 = r; }
          }
          const ax = A.x + t0 * dx, ay = A.y + t0 * dy, bx = A.x + t1 * dx, by = A.y + t1 * dy;
          let cx = cellX(G, ax), cy = cellY(G, ay); const tx = cellX(G, bx), ty = cellY(G, by), sx = Math.sign(bx - ax), sy = Math.sign(by - ay);
          const ddx = Math.abs(bx - ax), ddy = Math.abs(by - ay);
          let tMaxX = sx ? Math.abs((G.x1 + (cx + (sx > 0 ? 1 : 0)) * G.s - ax) / (bx - ax)) : Infinity, tMaxY = sy ? Math.abs((G.y1 + (cy + (sy > 0 ? 1 : 0)) * G.s - ay) / (by - ay)) : Infinity;
          const tdX = sx ? G.s / ddx : Infinity, tdY = sy ? G.s / ddy : Infinity;
          for (let guard = G.cols + G.rows + 4; guard > 0; guard--) {
            f(cy * G.cols + cx);
            if (cx === tx && cy === ty) break;
            if (tMaxX < tMaxY) { tMaxX += tdX; cx += sx; } else { tMaxY += tdY; cy += sy; }
            if (cx < 0 || cy < 0 || cx >= G.cols || cy >= G.rows) break;
          }
        }
        // The grid, rebuilt when too many classes have moved since it was built; and the moved classes and their links. The
        // classes being evaluated (marked in M.mN) are checked directly anyway, so they never count as moved: a spread of many
        // classes would otherwise rebuild the grid for every candidate.
        function freshGrid(M) {
          let G = M.grid, moved = [];
          if (G) { for (let v = 0; v < M.n; v++) if (M.P[v] !== G.ref[v] && !M.mN[v]) moved.push(v); }
          if (!G || moved.length > Math.max(12, M.n / 12)) { G = buildGrid(M); moved = []; }
          const movedE = []; if (moved.length) { G.stamp++; const st = M.eStamp; moved.forEach((v) => M.inc[v].forEach((k) => { if (st[k] !== G.stamp) { st[k] = G.stamp; movedE.push(k); } })); }
          return { G, moved, movedE };
        }
        // Cost of everything that involves the classes in S (their links, their boxes, their neighbors' angles)
        function local(M, S) {
          _ogWorkN[5]++; _ogWorkN[2] += M.n;
          if (M.o.index === false) return localAll(M, S);
          const { mN, mE, W } = M, A = [], vSeen = M.vSeen, eSeen = M.eSeen;
          S.forEach((v) => (mN[v] = 1)); S.forEach((v) => M.inc[v].forEach((k) => { if (!mE[k]) { mE[k] = 1; A.push(k); } }));
          const { G, moved: movedN, movedE } = freshGrid(M), movedL = movedE.filter((k) => !mE[k]), isMovedE = M.isMovedE, isMovedN = M.isMovedN;
          movedL.forEach((k) => (isMovedE[k] = 1)); movedN.forEach((v) => (isMovedN[v] = 1));
          let c = 0;
          for (const a of A) {
            const e = M.E[a], q = ++M.qStamp;
            segCells(G, M.P[e.s], M.P[e.t], (cell) => {
              for (const f of G.edges[cell]) if (eSeen[f] !== q) { eSeen[f] = q; if (!mE[f] && !isMovedE[f]) c += pairCost(M, a, f); }
              for (const v of G.nodes[cell]) if (vSeen[v] !== q) { vSeen[v] = q; if (!mN[v] && !isMovedN[v]) c += thruCost(M, a, v); }
            });
            for (const f of movedL) c += pairCost(M, a, f);
            for (const f of A) if (f > a) c += pairCost(M, a, f);
            for (const v of movedN) c += thruCost(M, a, v);
            for (const v of S) c += thruCost(M, a, v);
          }
          for (const v of S) {
            const q = ++M.qStamp;
            boxCells(G, M.P[v], M.ex[v], M.ey[v], (cell) => {
              for (const f of G.edges[cell]) if (eSeen[f] !== q) { eSeen[f] = q; if (!mE[f] && !isMovedE[f]) c += thruCost(M, f, v); }
              for (const u of G.nodes[cell]) if (vSeen[u] !== q) { vSeen[u] = q; if (!mN[u] && !isMovedN[u] && overlaps(M, u, v)) c += W.ov; }
            });
            for (const f of movedL) c += thruCost(M, f, v);
            for (const u of movedN) if (overlaps(M, u, v)) c += W.ov;
            for (const u of S) if (u > v && overlaps(M, u, v)) c += W.ov;
          }
          movedL.forEach((k) => (isMovedE[k] = 0)); movedN.forEach((v) => (isMovedN[v] = 0));
          c += tightAround(M, S);
          if (M.dn) c += upCost(M, S, mN);
          S.forEach((v) => (mN[v] = 0)); A.forEach((k) => (mE[k] = 0));
          if (M.o.checkIndex) { const b = localAll(M, S); if (Math.abs(b - c) > 1e-6) throw new Error('grid check: local ' + c + ' vs ' + b + ' for ' + S.join(',')); }
          return c;
        }
        // The same cost by checking every link and class (the reference the grid is checked against)
        function localAll(M, S) {
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
          c += tightAround(M, S);
          if (M.dn) c += upCost(M, S, mN);
          S.forEach((v) => (mN[v] = 0)); A.forEach((k) => (mE[k] = 0));
          return c;
        }
        // Whole-drawing cost and the list of problems, in the same order as checking every pair would give them
        function total(M, wantIssues) {
          if (M.o.index === false) return totalAll(M, wantIssues);
          _ogWorkN[2] += M.m * 8 + M.n * 8; const { E, n, m, W } = M, G = buildGrid(M), eSeen = M.eSeen, vSeen = M.vSeen, cr = [], th = []; let c = 0;
          for (let a = 0; a < m; a++) {
            const q = ++M.qStamp, fs = [], vs = [];
            segCells(G, M.P[E[a].s], M.P[E[a].t], (cell) => {
              for (const f of G.edges[cell]) if (f > a && eSeen[f] !== q) { eSeen[f] = q; fs.push(f); }
              for (const v of G.nodes[cell]) if (vSeen[v] !== q) { vSeen[v] = q; vs.push(v); }
            });
            fs.sort((x, y) => x - y).forEach((f) => { const pc = pairCost(M, a, f); if (pc) { c += pc; if (wantIssues) { const ea = E[a], ef = E[f]; cr.push({ kind: 'cross', edges: [a, f], q: crossAt(M.P[ea.s], M.P[ea.t], M.P[ef.s], M.P[ef.t]), nodes: [ea.s, ea.t, ef.s, ef.t] }); } } });
            vs.sort((x, y) => x - y).forEach((v) => { if (thruCost(M, a, v)) { c += W.thru; if (wantIssues) th.push({ kind: 'thru', edges: [a], q: { ...M.P[v] }, nodes: [v, E[a].s, E[a].t] }); } });
          }
          for (let u = 0; u < n; u++) { const q = ++M.qStamp; boxCells(G, M.P[u], M.ex[u], M.ey[u], (cell) => { for (const v of G.nodes[cell]) if (v > u && vSeen[v] !== q) { vSeen[v] = q; if (overlaps(M, u, v)) c += W.ov; } }); }
          const issues = wantIssues ? cr.concat(th) : null;
          for (let v = 0; v < n; v++) if (minAngle(M, v) < 15) { c += W.tight; if (wantIssues) issues.push({ kind: 'tight', edges: [], q: { ...M.P[v] }, nodes: [v, ...M.adj[v]] }); }
          c += upAll(M) + areaPen(M);
          if (M.o.checkIndex) { const b = totalAll(M, true); if (Math.abs(b.c - c) > 1e-6 || (wantIssues && b.issues.length !== issues.length)) throw new Error('grid check: total ' + c + ' vs ' + b.c); }
          return wantIssues ? { c, issues } : c;
        }
        function totalAll(M, wantIssues) {
          const { E, n, m, W } = M, issues = []; let c = 0;
          for (let a = 0; a < m; a++) for (let f = a + 1; f < m; f++) { const pc = pairCost(M, a, f); if (pc) { c += pc; if (wantIssues) { const ea = E[a], ef = E[f]; issues.push({ kind: 'cross', edges: [a, f], q: crossAt(M.P[ea.s], M.P[ea.t], M.P[ef.s], M.P[ef.t]), nodes: [ea.s, ea.t, ef.s, ef.t] }); } } }
          for (let k = 0; k < m; k++) for (let v = 0; v < n; v++) if (thruCost(M, k, v)) { c += W.thru; if (wantIssues) issues.push({ kind: 'thru', edges: [k], q: { ...M.P[v] }, nodes: [v, E[k].s, E[k].t] }); }
          for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) if (overlaps(M, u, v)) c += W.ov;
          for (let v = 0; v < n; v++) if (minAngle(M, v) < 15) { c += W.tight; if (wantIssues) issues.push({ kind: 'tight', edges: [], q: { ...M.P[v] }, nodes: [v, ...M.adj[v]] }); }
          c += upAll(M) + areaPen(M);
          return wantIssues ? { c, issues } : c;
        }
        // Try candidate positions for the classes S; apply the best one if it lowers the cost by more than eps. Returns the gain.
        function best(M, S, cands, eps = 0.01) {
          M.evals = (M.evals || 0) + cands.length + 1; _ogWorkN[2] += M.n;
          // the area of everything but S is the same for every candidate: measure it once, then add S's boxes per candidate
          const sq = ++M.qStamp, inS = M.sSeen; for (const v of S) inS[v] = sq; let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18;
          M.P.forEach((p, i) => { if (inS[i] === sq) return; const w = M.D[i].w / 2, h = M.D[i].h / 2; if (p.x - w < x1) x1 = p.x - w; if (p.x + w > x2) x2 = p.x + w; if (p.y - h < y1) y1 = p.y - h; if (p.y + h > y2) y2 = p.y + h; });
          const pen = () => { let a = x1, b = y1, c = x2, d = y2; for (const v of S) { const p = M.P[v], w = M.D[v].w / 2, h = M.D[v].h / 2; if (p.x - w < a) a = p.x - w; if (p.x + w > c) c = p.x + w; if (p.y - h < b) b = p.y - h; if (p.y + h > d) d = p.y + h; } return M.W.area * 100 * Math.max(0, (c - a) * (d - b) / M.A0 - 1); };
          const before = local(M, S) + pen(), old = S.map((v) => M.P[v]);
          let bestD = -eps, bestC = null;
          for (const c of cands) {
            S.forEach((v, i) => (M.P[v] = c[i]));
            const d = local(M, S) + pen() - before; if (d < bestD) { bestD = d; bestC = c; }
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
          if (U.nodes.length === 1) { // a single leaf: every direction at its own distance and further out, turned and stretched together
            const v = U.nodes[0], r0 = Math.max(Math.hypot(rel[0].x, rel[0].y), 0.5 * M.medLen), out = [];
            for (const s of [1, 1.6, 2.4]) for (let k = 0; k < 24; k++) { const th = k * Math.PI / 12; out.push({ th, p: [{ x: a.x + s * r0 * Math.cos(th), y: a.y + s * r0 * Math.sin(th) }] }); }
            // a long label reads best on a link that runs sideways, so for long labels the sideways spots come first and win ties
            if (M.D[v].w > 100) out.sort((p, q) => Math.abs(Math.sin(p.th)) - Math.abs(Math.sin(q.th)));
            return out.map((c) => c.p);
          }
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
        // Open space: a grid over the drawing with cells about half a link long. A cell is open when no class box and no link
        // passes through it. Single moves try the open cells near a class (plus small nudges) instead of a fixed ring of spots.
        function openGrid(M) {
          let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18;
          M.P.forEach((p, i) => { x1 = Math.min(x1, p.x - M.hw[i]); x2 = Math.max(x2, p.x + M.hw[i]); y1 = Math.min(y1, p.y - M.hh[i]); y2 = Math.max(y2, p.y + M.hh[i]); });
          const s = cellSize(M.medLen * (M.o.cell || 0.5), x1, y1, x2, y2), cols = Math.max(1, Math.ceil((x2 - x1) / s)), rows = Math.max(1, Math.ceil((y2 - y1) / s)), busy = new Uint8Array(cols * rows);
          const cellOf = (x, y) => [Math.min(cols - 1, Math.max(0, ((x - x1) / s) | 0)), Math.min(rows - 1, Math.max(0, ((y - y1) / s) | 0))];
          M.P.forEach((p, i) => { const [a, b] = cellOf(p.x - M.hw[i], p.y - M.hh[i]), [c, d] = cellOf(p.x + M.hw[i], p.y + M.hh[i]); for (let x = a; x <= c; x++) for (let y = b; y <= d; y++) busy[y * cols + x] = 1; });
          M.E.forEach((e) => { const A = M.P[e.s], B = M.P[e.t], k = Math.max(1, Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) / (s / 3))); for (let j = 0; j <= k; j++) { const [x, y] = cellOf(A.x + (B.x - A.x) * j / k, A.y + (B.y - A.y) * j / k); busy[y * cols + x] = 1; } });
          const open = []; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!busy[y * cols + x]) open.push({ x: x1 + (x + 0.5) * s, y: y1 + (y + 0.5) * s });
          return { s, x1, y1, cols, rows, open, busy };
        }
        const DIR8 = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
        function openCands(M, v, grid, reach, maxOpen) {
          const p = M.P[v], L = M.medLen, out = [];
          for (const s of [0.1, 0.25]) for (const [dx, dy] of DIR8) out.push([{ x: p.x + dx * s * L, y: p.y + dy * s * L }]);
          // only the cells within reach: the open cells of the window around the class, nearest first
          const R = reach * L, s = grid.s, near = [], a = Math.max(0, Math.floor((p.x - R - grid.x1) / s)), b = Math.min(grid.cols - 1, Math.floor((p.x + R - grid.x1) / s));
          for (let y = Math.max(0, Math.floor((p.y - R - grid.y1) / s)), y2 = Math.min(grid.rows - 1, Math.floor((p.y + R - grid.y1) / s)); y <= y2; y++) for (let x = a; x <= b; x++) {
            if (grid.busy[y * grid.cols + x]) continue; const c = { x: grid.x1 + (x + 0.5) * s, y: grid.y1 + (y + 0.5) * s }, d = Math.hypot(c.x - p.x, c.y - p.y); if (d < R) near.push([d, c]);
          }
          near.sort((u, w) => u[0] - w[0] || u[1].y - w[1].y || u[1].x - w[1].x);
          for (let i = 0; i < near.length && i < maxOpen; i++) out.push([{ x: near[i][1].x, y: near[i][1].y }]);
          return out;
        }
        // Crowds, from a density grid over the drawing (cells half a link long): a class counts 1 in its cell, a link 0.25 in each
        // cell it passes. Cells at least twice the average density, touching each other, form a crowd around its center of weight.
        function crowdsOf(M) {
          let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18;
          M.P.forEach((p) => { x1 = Math.min(x1, p.x); x2 = Math.max(x2, p.x); y1 = Math.min(y1, p.y); y2 = Math.max(y2, p.y); });
          const s = cellSize(M.medLen * 0.5, x1, y1, x2, y2), cols = Math.max(1, Math.ceil((x2 - x1) / s) + 1), rows = Math.max(1, Math.ceil((y2 - y1) / s) + 1), dens = new Float32Array(cols * rows);
          const ci = (x, y) => Math.min(rows - 1, Math.max(0, ((y - y1) / s) | 0)) * cols + Math.min(cols - 1, Math.max(0, ((x - x1) / s) | 0));
          M.P.forEach((p) => (dens[ci(p.x, p.y)] += 1));
          M.E.forEach((e) => { const A = M.P[e.s], B = M.P[e.t], k = Math.max(1, Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) / (s / 3))), seen = new Set(); for (let j = 1; j < k; j++) seen.add(ci(A.x + (B.x - A.x) * j / k, A.y + (B.y - A.y) * j / k)); seen.forEach((c) => (dens[c] += 0.25)); });
          let sum = 0; dens.forEach((d) => (sum += d)); const avg = sum / dens.length, thr = Math.max(2 * avg, 1.5), seen = new Uint8Array(dens.length), out = [];
          const center = (c) => ({ x: x1 + ((c % cols) + 0.5) * s, y: y1 + (((c / cols) | 0) + 0.5) * s });
          for (let c0 = 0; c0 < dens.length; c0++) {
            if (seen[c0] || dens[c0] < thr) continue;
            const cells = [], q = [c0]; seen[c0] = 1;
            while (q.length) { const c = q.pop(); cells.push(c); const cx = c % cols, cy = (c / cols) | 0;
              for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const n = ny * cols + nx; if (!seen[n] && dens[n] >= thr) { seen[n] = 1; q.push(n); } } }
            let w = 0, x = 0, y = 0; cells.forEach((c) => { const p = center(c); w += dens[c]; x += dens[c] * p.x; y += dens[c] * p.y; });
            const ctr = { x: x / w, y: y / w }; let r0 = 0; cells.forEach((c) => { const p = center(c); r0 = Math.max(r0, Math.hypot(p.x - ctr.x, p.y - ctr.y)); });
            out.push({ c: ctr, r0: r0 + s * 0.75, weight: w, cells: cells.map(center) });
          }
          return { s, avg, dens, cols, rows, x1, y1, crowds: out.sort((a, b) => b.weight - a.weight), center, ci };
        }
        // Problem regions: a crowd worth spreading is one with problems in it. Problems (crossings, links through classes) are
        // counted on a grid of cells one link long. Hot cells hold at least 2 problems and at least half as many as the worst
        // cell; touching hot cells form a region, the regions with the most problems come first, and each is centered on the
        // mean of its problems, with a radius of at most one and a half cells, so that a spread stays local.
        function problemCrowds(M, issues) {
          const s = M.medLen, cells = new Map();
          issues.forEach((is) => { if (is.kind === 'tight') return; const k = Math.floor(is.q.x / s) + ',' + Math.floor(is.q.y / s); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(is); });
          let most = 0; cells.forEach((l) => (most = Math.max(most, l.length)));
          const hotMin = Math.max(2, Math.ceil(most / 2));
          for (const [k, l] of [...cells]) if (l.length < hotMin) cells.delete(k);
          const seen = new Set(), out = [];
          for (const k0 of cells.keys()) {
            if (seen.has(k0)) continue;
            const q = [k0], list = [], cl = []; seen.add(k0);
            while (q.length) { const k = q.pop(); cl.push(k); list.push(...cells.get(k)); const [x, y] = k.split(',').map(Number);
              for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const n = (x + dx) + ',' + (y + dy); if (cells.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } }
            const c = { x: list.reduce((a, is) => a + is.q.x, 0) / list.length, y: list.reduce((a, is) => a + is.q.y, 0) / list.length };
            const r0 = Math.min(1.5 * s, Math.max(...list.map((is) => Math.hypot(is.q.x - c.x, is.q.y - c.y))) + 0.6 * s);
            out.push({ c, r0, weight: list.length, cells: cl.map((k) => { const [x, y] = k.split(',').map(Number); return { x: (x + 0.5) * s, y: (y + 0.5) * s }; }), cellSize: s });
          }
          return out.sort((a, b) => b.weight - a.weight);
        }
        // Pizza slices: the drawing around a crowd's center is cut into 8 slices. Classes inside the crowd move outward in
        // proportion to their distance from the center, classes beyond it are pushed less the further out they are, so the room
        // is made by shifting the neighbors too. "room" weights each slice by how much low-density space lies beyond it.
        function spreadCands(M, dg, C) {
          const L = M.medLen, R = 3 * C.r0, room = new Array(8).fill(0), S = [];
          for (let v = 0; v < M.n; v++) if (Math.hypot(M.P[v].x - C.c.x, M.P[v].y - C.c.y) < R) S.push(v);
          for (let c = 0; c < dg.dens.length; c++) { const p = dg.center(c), d = Math.hypot(p.x - C.c.x, p.y - C.c.y); if (d < C.r0 || d > C.r0 + 4 * dg.s) continue;
            const k = (Math.floor((Math.atan2(p.y - C.c.y, p.x - C.c.x) + Math.PI) / (Math.PI / 4)) + 8) % 8; room[k] += Math.max(0, dg.avg - dg.dens[c]) + (dg.dens[c] === 0 ? 0.5 : 0); }
          const mx = Math.max(...room) || 1, cands = [];
          for (const a of [0.25, 0.5, 0.8]) for (const mode of ['even', 'room']) {
            cands.push(S.map((v) => { const p = M.P[v], dx = p.x - C.c.x, dy = p.y - C.c.y, d = Math.hypot(dx, dy); if (d < 1e-6) return { x: p.x, y: p.y };
              const k = (Math.floor((Math.atan2(dy, dx) + Math.PI) / (Math.PI / 4)) + 8) % 8, w = mode === 'even' ? 1 : 0.3 + 0.7 * room[k] / mx;
              const disp = a * L * w * (d <= C.r0 ? d / C.r0 : Math.max(0, 1 - (d - C.r0) / (2 * C.r0)));
              return { x: p.x + dx / d * disp, y: p.y + dy / d * disp }; }));
          }
          return { S, cands, room };
        }
        // Problems near a point, found only among the links and classes around it
        function issuesNear(M, q, R) {
          const L = [], V = [];
          for (let k = 0; k < M.m; k++) { const A = M.P[M.E[k].s], B = M.P[M.E[k].t]; if (Math.max(A.x, B.x) > q.x - R && Math.min(A.x, B.x) < q.x + R && Math.max(A.y, B.y) > q.y - R && Math.min(A.y, B.y) < q.y + R) L.push(k); }
          for (let v = 0; v < M.n; v++) if (Math.abs(M.P[v].x - q.x) < R && Math.abs(M.P[v].y - q.y) < R) V.push(v);
          const out = [];
          for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (pairCost(M, L[i], L[j])) { const a = M.E[L[i]], f = M.E[L[j]]; out.push({ kind: 'cross', edges: [L[i], L[j]], q: crossAt(M.P[a.s], M.P[a.t], M.P[f.s], M.P[f.t]), nodes: [a.s, a.t, f.s, f.t] }); }
          for (const k of L) for (const v of V) if (thruCost(M, k, v)) out.push({ kind: 'thru', edges: [k], q: { ...M.P[v] }, nodes: [v, M.E[k].s, M.E[k].t] });
          return out;
        }
        const cp = (S, M) => S.map((v) => [Math.round(M.P[v].x * 10) / 10, Math.round(M.P[v].y * 10) / 10]);
        function run(P0, D, E0, opts = {}) {
          const o = { ...DEF, ...opts, W: { ...DEF.W, ...(opts.W || {}) } }, t0 = _ogNow(), M = Model(P0, D, E0, o), log = [];
          // budgetMs is the whole clean-up: the rounds get 80% of it, the final leaf pass the rest
          const timeUp = () => _ogNow() - t0 > o.budgetMs * (o.finish ? 0.8 : 1), rec = !!o.record;
          const units = o.unitSize > 0 ? findUnits(M, o.unitSize) : [];
          const start = total(M, true); let cur = start.c, rounds = 0;
          const stats = { start: start.c, units: units.length, unitMoves: 0, singleMoves: 0, groupTried: 0, groupKept: 0, skipped: 0 };
          // "Nothing changed here since it last failed": each class carries the time of its last move; a class or problem that was
          // tried without success is tried again only once something within reach has moved.
          const stamp = new Int32Array(M.n); let clock = 1;
          const moved = (S) => { clock++; S.forEach((v) => (stamp[v] = clock)); };
          const quietSince = (q, R, c) => { for (let v = 0; v < M.n; v++) if (stamp[v] > c && Math.abs(M.P[v].x - q.x) < R && Math.abs(M.P[v].y - q.y) < R) return false; return true; };
          const failedV = new Map(), failedIssue = new Map(), failedCrowd = [], reach = 2 * M.medLen;
          let grid = openGrid(M);
          const repair = (q, R, steps, S) => { // a few single moves on the classes in problems around the point
            const reps = [];
            for (let s = 0; s < steps && !timeUp(); s++) {
              const cand = new Set(); issuesNear(M, q, R).forEach((is) => is.nodes.forEach((v) => cand.add(v)));
              let bestG = 0, bestV = -1, bestP = null;
              [...cand].slice(0, o.repCap || 8).forEach((v) => { const old = M.P[v], g = best(M, [v], o.repOld ? singleCands(M, v) : openCands(M, v, grid, o.repReach || 1.2, o.repOpen || 6)); if (g > bestG) { bestG = g; bestV = v; bestP = M.P[v]; } M.P[v] = old; });
              if (bestV < 0) break;
              if (rec) reps.push({ v: bestV, from: cp([bestV], M)[0] });
              M.P[bestV] = bestP; S.add(bestV);
              if (rec) reps[reps.length - 1].to = cp([bestV], M)[0];
            }
            return reps;
          };
          const PH = stats.phase = { single: 0, unit: 0, spread: 0, group: 0 }; let tp = _ogNow();
          const trace = stats.trace = [];
          const lap = (k) => { const t = _ogNow(); PH[k] += t - tp; if (o.trace) trace.push([k, t - t0, Math.round(total(M))]); tp = _ogNow(); };
          const step = (x) => { if (rec) log.push({ round: rounds, t: _ogNow() - t0, ...x }); else log.push(x); };
          // stage markers for the walk-through: when each stage started and ended, how many tries it made and how many it kept
          let tally = null;
          const stage = (phase) => { if (!rec) return; if (tally) log.push({ kind: 'phase-end', ...tally, ms: _ogNow() - t0 - tally.t0 }); tally = phase ? { phase, round: rounds, t0: _ogNow() - t0, tried: 0, kept: 0, skipped: 0 } : null; if (phase) log.push({ kind: 'phase', phase, round: rounds, t: _ogNow() - t0 }); };
          const tick = (k) => { if (tally) tally[k]++; };
          let gained = 0;
          // 1. single classes at the end of a crossed link or under a link: move into open space
          // up: when to stop; own: a stage of its own (false in the finish, which is one stage for both passes)
          const doSingle = (up = timeUp, own = true) => {
            if (own) stage('single');
            const { issues } = total(M, true), hot = new Set(); issues.forEach((is) => is.nodes.forEach((v) => hot.add(v)));
            grid = openGrid(M);
            // for the playback: the open-space grid this pass chose from, on its stage marker (record only)
            if (rec) { const ph = log.findLast((x) => x.kind === 'phase'); if (ph && !ph.grid) ph.grid = { s: grid.s, x1: grid.x1, y1: grid.y1, cols: grid.cols, rows: grid.rows, busy: Array.from(grid.busy).join(''), reach: 1.8 * M.medLen }; }
            for (const v of hot) {
              if (up()) break;
              if (failedV.has(v) && quietSince(M.P[v], reach, failedV.get(v))) { stats.skipped++; tick('skipped'); continue; }
              tick('tried');
              const from = rec ? cp([v], M) : null;
              const g = best(M, [v], openCands(M, v, grid, 1.8, 12));
              if (g > 0) { gained += g; stats.singleMoves++; tick('kept'); moved([v]); failedV.delete(v); step({ kind: 'move', nodes: [v], from, to: rec ? cp([v], M) : null, gain: +g.toFixed(1) }); }
              else failedV.set(v, clock);
            }
            if (own) lap('single');
          };
          // 2. leaf units involved in a problem (the easy fixes): turn, mirror or reorder them around their anchor, then stretch or shrink
          const doUnit = (up = timeUp, own = true) => {
            if (own) stage('unit');
            const { issues } = total(M, true), hot = new Set(); issues.forEach((is) => is.nodes.forEach((v) => hot.add(v)));
            for (const U of units) {
              if (up()) break;
              if (!U.nodes.some((v) => hot.has(v)) && !hot.has(U.anchor)) continue;
              const from = rec ? cp(U.nodes, M) : null; tick('tried');
              const g = best(M, U.nodes, unitCands(M, U)) + best(M, U.nodes, unitScale(M, U));
              if (g > 0) { gained += g; stats.unitMoves++; tick('kept'); moved(U.nodes); step({ kind: 'unit', anchor: U.anchor, nodes: U.nodes.slice(), from, to: rec ? cp(U.nodes, M) : null, gain: +g.toFixed(1) }); }
            }
            if (own) lap('unit');
          };
          // 3. spread the regions with the most problems: cut the space around each into slices and shift them outward, toward open space
          const doSpread = () => {
            if (!o.spread || timeUp()) return;
            stage('spread');
            const dg = crowdsOf(M), crowds = o.spreadAll ? dg.crowds : problemCrowds(M, total(M, true).issues);
            for (const C of crowds.slice(0, o.spreadMax || 6)) {
              if (timeUp()) break;
              if (failedCrowd.some((f) => Math.hypot(f.x - C.c.x, f.y - C.c.y) < C.r0 && quietSince(C.c, 3 * C.r0, f.at))) { stats.skipped++; tick('skipped'); continue; }
              tick('tried');
              const { S, cands, room } = spreadCands(M, dg, C); if (S.length < 3) continue;
              const snapAll = M.P.slice(); let g = best(M, S, cands), pushed = null;
              if (!(g > 0) && o.spreadRepair) { // the room pays off only after a few single moves: push, repair, keep if better overall
                const snap = M.P.slice(); let bestC = 0, bestF = Infinity;
                cands.forEach((c, ci) => { S.forEach((v, i) => (M.P[v] = c[i])); const f = local(M, S) + areaPen(M); if (f < bestF) { bestF = f; bestC = ci; } });
                S.forEach((v, i) => (M.P[v] = cands[bestC][i]));
                if (rec) pushed = S.map((v) => [v, Math.round(M.P[v].x * 10) / 10, Math.round(M.P[v].y * 10) / 10]);
                const Sx = new Set(S); repair(C.c, 1.5 * C.r0 + M.medLen, o.groupDepth, Sx);
                const Sa = [...Sx], F1 = local(M, Sa) + areaPen(M), now = Sa.map((v) => M.P[v]); Sa.forEach((v) => (M.P[v] = snap[v]));
                const F0b = local(M, Sa) + areaPen(M);
                if (F1 < F0b - 0.5) { Sa.forEach((v, i) => (M.P[v] = now[i])); g = F0b - F1; S.length = 0; Sa.forEach((v) => S.push(v)); } else M.P = snap;
              }
              if (g > 0) { gained += g; stats.spreadMoves = (stats.spreadMoves || 0) + 1; tick('kept'); moved(S);
                step({ kind: 'spread', center: { x: Math.round(C.c.x), y: Math.round(C.c.y) }, r0: Math.round(C.r0), problems: C.weight, cells: rec ? C.cells.map((p) => [Math.round(p.x), Math.round(p.y)]) : undefined, cell: Math.round(C.cellSize || dg.s), room: rec ? room.map((x) => +x.toFixed(1)) : undefined, nodes: S.slice(), from: rec ? S.map((v) => [Math.round(snapAll[v].x * 10) / 10, Math.round(snapAll[v].y * 10) / 10]) : null, to: rec ? cp(S, M) : null, pushed: pushed || undefined, gain: +g.toFixed(1) }); }
              else failedCrowd.push({ x: C.c.x, y: C.c.y, at: clock });
            }
            lap('spread');
          };
          // 4. group moves with look-ahead, on the problems still left
          const doGroup = () => {
            if (!o.groups || timeUp()) return;
            stage('group');
              const { issues } = total(M, true); grid = openGrid(M);
              const R = 1.3 * M.medLen;
              for (const is of issues.filter((x) => x.kind !== 'tight')) {
                if (timeUp()) break;
                const key = is.kind + is.edges.join(',') + (is.kind === 'thru' ? ':' + is.nodes[0] : '');
                if (failedIssue.has(key) && quietSince(is.q, 2 * R, failedIssue.get(key))) { stats.skipped++; tick('skipped'); continue; }
                const tries = [];
                for (const k of is.edges) {
                  const e = M.E[k], A = M.P[e.s], B = M.P[e.t], L = Math.hypot(B.x - A.x, B.y - A.y) || 1, nx = -(B.y - A.y) / L, ny = (B.x - A.x) / L;
                  for (const side of [1, -1]) {
                    // the crowd: classes on this side of the line, near the problem, nearest first, at most 10
                    const G = []; for (let v = 0; v < M.n; v++) { const dx = M.P[v].x - is.q.x, dy = M.P[v].y - is.q.y, d = Math.hypot(dx, dy); if (d < R && side * (dx * nx + dy * ny) > 0) G.push([d, v]); }
                    if (G.length < 2) continue;
                    const crowd = G.sort((a, b) => a[0] - b[0]).slice(0, o.crowdMax || 1e9).map((x) => x[1]);
                    for (const d of (o.groupDist || [0.3, 0.7])) for (const phi of [-0.5, 0, 0.5]) {
                      const c = Math.cos(phi), s = Math.sin(phi), ux = side * (c * nx - s * ny), uy = side * (s * nx + c * ny);
                      tries.push({ G: crowd, side, line: k, dx: ux * d * M.medLen, dy: uy * d * M.medLen });
                    }
                  }
                }
                // rank by the immediate effect, look ahead on the most promising two
                tries.forEach((t) => { const old = t.G.map((v) => M.P[v]), b = local(M, t.G) + areaPen(M); t.G.forEach((v) => (M.P[v] = { x: M.P[v].x + t.dx, y: M.P[v].y + t.dy })); t.imm = local(M, t.G) + areaPen(M) - b; t.G.forEach((v, i) => (M.P[v] = old[i])); });
                tries.sort((a, b) => a.imm - b.imm);
                let kept = false;
                for (const t of tries.slice(0, o.groupTop || 2)) {
                  if (timeUp() || t.imm > 40) break;
                  stats.groupTried++; tick('tried');
                  const snap = M.P.slice(), S = new Set(t.G), from = rec ? cp(t.G, M) : null;
                  t.G.forEach((v) => (M.P[v] = { x: M.P[v].x + t.dx, y: M.P[v].y + t.dy }));
                  const reps = repair(is.q, 2 * R, o.groupDepth, S);
                  const Sa = [...S], F1 = local(M, Sa) + areaPen(M), now = Sa.map((v) => M.P[v]);
                  Sa.forEach((v) => (M.P[v] = snap[v])); const F0 = local(M, Sa) + areaPen(M);
                  const info = rec ? { problem: { kind: is.kind, q: { x: Math.round(is.q.x), y: Math.round(is.q.y) }, edges: is.edges.map((k) => [M.E[k].s, M.E[k].t]) }, nodes: t.G.slice(), from, dx: Math.round(t.dx), dy: Math.round(t.dy), repairs: reps } : {};
                  if (F1 < F0 - 0.5) { Sa.forEach((v, i) => (M.P[v] = now[i])); gained += F0 - F1; stats.groupKept++; tick('kept'); moved(Sa); step({ kind: 'group', ...info, nodes: t.G.slice(), dx: Math.round(t.dx), dy: Math.round(t.dy), gain: +(F0 - F1).toFixed(1), after: rec ? Sa.map((v) => [v, ...cp([v], M)[0]]) : undefined }); kept = true; break; }
                  if (rec) step({ kind: 'group-rejected', ...info, loss: +(F1 - F0).toFixed(1) });
                  M.P = snap;
                }
                if (!kept) failedIssue.set(key, clock);
              }
            lap('group');
          };
          const STAGES = { single: doSingle, unit: doUnit, spread: doSpread, group: doGroup };
          while (!timeUp()) {
            rounds++; gained = 0; tp = _ogNow();
            for (const k of o.order) STAGES[k]();
            stage(null);
            const now = total(M); if (cur - now < 0.5 && gained < 0.5) break; cur = now;
          }
          // finish: one last pass over leaves and single classes, even when the time is up, since it is cheap and the group moves
          // can leave a leaf on a line (the hand sessions also tidied leaves last)
          // the rounds stop at 80% of the budget, so the finish has the rest; it stops at the budget too
          if (o.finish) {
            rounds++; stage('finish');
            const hardUp = () => _ogNow() - t0 > o.budgetMs;
            doUnit(hardUp, false); doSingle(hardUp, false);
          }
          stage(null); stats.end = total(M); stats.rounds = rounds; stats.ms = _ogNow() - t0; stats.evals = M.evals;
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
        return { run, measure, findUnits: (P, D, E, K) => findUnits(Model(P, D, E, DEF), K),
          openSpace: (P, D, E, cell) => openGrid(Model(P, D, E, { ...DEF, cell: cell || DEF.cell })) };
      })();
      // The clean-up as the layouts use it: whatever is left of 1.5 s after the layout (on the work clock), at most 500 ms.
      // With less than 100 ms left it is skipped: it would change too little.
      // topDown: the layout drew subclasses below their superclasses (the tree), and the clean-up keeps them there.
      function _ogLayoutCleanUp(pos, items, edges, startedAt, topDown) {
        const budgetMs = Math.min(500, 1500 - (_ogNow() - startedAt));
        const down = topDown ? edges.filter((e) => e[2] === 2 && e[0] !== e[1]).map((e) => [e[0], e[1]]) : null;
        const swap0 = (P) => (_OG_TUNE.noSwap ? P : _ogClocked(() => _ogLeafSwap(P, items, edges, down))); // a top-down drawing stays top-down
        const swap1 = (P) => { const Q = swap0(P); return _OG_TUNE.noPull || topDown ? Q : _ogClocked(() => _ogPullIn(Q, items, edges, _OG_TUNE.pull)); }; // a top-down tree keeps its levels
        const swap = (P) => { const Q = swap1(P); return topDown || !items.some((d) => d && d.between) ? Q : _ogClocked(() => _ogInline(Q, items, edges)); };
        // last, classes with no link and small separate parts move out of the way of the main graph
        const fin = (P) => (_OG_TUNE.noApart ? P : _ogClocked(() => _ogApart(P, items, edges)));
        if (budgetMs < 100) return fin(swap(pos));
        return fin(swap(_ogClocked(() => _ogHandTidy.run(pos, items, edges.map((e) => ({ s: e[0], t: e[1] })), { budgetMs, down, ...(_OG_TUNE.cleanup || {}) }).P)));
      }
      // Problems that involve class v: its links through other boxes (10 each, with a pad px margin) and across other links
      // (6 each), and other links through its box (10 each). Classes without a position yet (P[u] null) and their links are left out.
      function _ogVCost(P, items, EE, inc, v, pad) {
        const n = P.length, m = EE.length; let c = 0; _ogWorkN[1] += n + m; _ogWorkN[0] += m * inc[v].length;
        for (const k of inc[v]) { const e = EE[k], a = P[e.s], b = P[e.t]; if (!a || !b) continue;
          for (let u = 0; u < n; u++) if (u !== e.s && u !== e.t && P[u] && _ogClSegBox(a.x - P[u].x, a.y - P[u].y, b.x - P[u].x, b.y - P[u].y, items[u].w / 2 + pad, items[u].h / 2 + pad)) c += 10;
          for (let f = 0; f < m; f++) { const g = EE[f]; if (g.s === e.s || g.s === e.t || g.t === e.s || g.t === e.t || !P[g.s] || !P[g.t]) continue; if (_ogClSegX(a, b, P[g.s], P[g.t])) c += 6; } }
        for (let f = 0; f < m; f++) { const g = EE[f]; if (g.s === v || g.t === v || !P[g.s] || !P[g.t]) continue; if (_ogClSegBox(P[g.s].x - P[v].x, P[g.s].y - P[v].y, P[g.t].x - P[v].x, P[g.t].y - P[v].y, items[v].w / 2 + pad, items[v].h / 2 + pad)) c += 10; }
        return c;
      }
      // Keep a drawing the reader knows: classes with a position in keep ([{x, y}] or null per class) stay exactly there, and
      // each new class (null) goes where it has the fewest problems, then the shortest links, round the classes it links to
      // (or beside the drawing if it links to none yet), on a free spot. A second round reconsiders each new class once all
      // are placed. For redrawing a model after a small edit without moving what the reader has seen. Positions out.
      function _ogPlaceNew(keep, items, edges) {
        const n = items.length, P = Array.from({ length: n }, (_, v) => (keep && keep[v] && isFinite(keep[v].x) && isFinite(keep[v].y) ? { x: keep[v].x, y: keep[v].y } : null));
        const fresh = []; for (let v = 0; v < n; v++) if (!P[v]) fresh.push(v);
        if (!fresh.length) return P;
        const EE = edges.filter((e) => e[0] !== e[1]).map((e) => ({ s: e[0], t: e[1] })), inc = _ogClIncidence(n, EE), N = items.map((d) => ({ w: d.w + 16, h: d.h + 12 }));
        const nbr = (v) => inc[v].map((k) => (EE[k].s === v ? EE[k].t : EE[k].s)).filter((u) => P[u]);
        const free = (v, p) => { _ogWorkN[2] += n; for (let u = 0; u < n; u++) if (u !== v && P[u] && Math.abs(P[u].x - p.x) < (N[u].w + N[v].w) / 2 + 14 && Math.abs(P[u].y - p.y) < (N[u].h + N[v].h) / 2 + 14) return false; return true; };
        const beside = (v) => { let x2 = -1e18, y1 = 1e18, y2 = -1e18, any = false; P.forEach((p, u) => { if (!p) return; any = true; x2 = Math.max(x2, p.x + N[u].w / 2); y1 = Math.min(y1, p.y); y2 = Math.max(y2, p.y); }); return any ? { x: x2 + N[v].w, y: (y1 + y2) / 2 } : { x: 0, y: 0 }; };
        const place = (v) => { const nb = nbr(v); let c;
          if (nb.length) { c = { x: 0, y: 0 }; nb.forEach((u) => { c.x += P[u].x / nb.length; c.y += P[u].y / nb.length; }); } else c = beside(v);
          let best = null;
          for (const r of [0, 70, 100, 140, 190, 250, 320, 400, 500, 620, 760, 920]) for (let k = 0; k < (r ? 24 : 1); k++) {
            const p = { x: c.x + r * Math.cos(k * Math.PI / 12), y: c.y + r * 0.7 * Math.sin(k * Math.PI / 12) }; if (!free(v, p)) continue;
            P[v] = p; let len = 0; nb.forEach((u) => (len += Math.hypot(P[u].x - p.x, P[u].y - p.y)));
            const sc = _ogVCost(P, items, EE, inc, v, 9) * 1e4 + len; P[v] = null; if (!best || sc < best.sc) best = { sc, p }; }
          P[v] = best ? best.p : c; };
        // Bursts (a graph browser expanding a class): new classes whose one placed neighbour is the same class go on an arc round
        // it, in its most open direction, side by side (subclasses together), on one ring or two staggered rings, at the
        // length the layouts give a link with its name. Placed one at a time instead, they fill whatever gaps the ring search
        // finds first and their links cross each other.
        const fanned = new Set();
        if (!_OG_TUNE.noFan) {
          const burst = new Map(), labTo = new Map(), subTo = new Set();
          edges.forEach((e) => { if (e[0] === e[1]) return; for (const [v, u] of [[e[0], e[1]], [e[1], e[0]]]) { if (P[v] || !P[u]) continue; labTo.set(v, Math.max(labTo.get(v) || 0, e[3] || 0)); if (e[2] === 2) subTo.add(v); } });
          for (const v of fresh) { const nb = [...new Set(nbr(v))]; if (nb.length === 1) { const a = nb[0]; if (!burst.has(a)) burst.set(a, []); burst.get(a).push(v); } }
          for (const [a, B] of burst) {
            if (B.length < 2) continue;
            B.sort((x, y) => subTo.has(y) - subTo.has(x) || x - y);
            const A = P[a], size = Math.max(...B.map((v) => Math.max(N[v].w, N[v].h))), s0 = size + 14;
            const R0 = Math.max(...B.map((v) => (N[a].w + N[v].w) / 2 + (labTo.get(v) || 0) + 24), (Math.max(N[a].w, N[a].h) + size) / 2 + 30);
            const blocked = (R) => { const iv = []; _ogWorkN[2] += n;
              for (let u = 0; u < n; u++) { if (u === a || !P[u]) continue; const d = Math.hypot(P[u].x - A.x, P[u].y - A.y); if (d < 1e-6) continue;
                const th = Math.atan2(P[u].y - A.y, P[u].x - A.x), near = d < R + 2 * s0;
                const h = near ? Math.asin(Math.min(1, (Math.max(N[u].w, N[u].h) / 2 + s0 / 2 + 14) / Math.max(d, 1))) : 0;
                const link = nbr(a).includes(u) ? Math.asin(Math.min(1, (s0 / 2 + 9) / R)) : 0; const w = Math.max(h, link); if (w > 0) iv.push([th - w, th + w]); }
              return iv; };
            const largestGap = (iv) => { if (!iv.length) return { mid: 0, len: 2 * Math.PI };
              const pts = iv.map(([x, y]) => [((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), y - x]).sort((p, q) => p[0] - q[0]);
              const cov = []; for (const [st, len] of pts) { const en = st + len; if (cov.length && st <= cov[cov.length - 1][1]) cov[cov.length - 1][1] = Math.max(cov[cov.length - 1][1], en); else cov.push([st, en]); }
              if (cov[cov.length - 1][1] - 2 * Math.PI >= cov[0][0]) return { mid: 0, len: 0 };
              let best = { mid: 0, len: -1 }; for (let i = 0; i < cov.length; i++) { const st = cov[i][1], en = i + 1 < cov.length ? cov[i + 1][0] : cov[0][0] + 2 * Math.PI; if (en - st > best.len) best = { mid: (st + en) / 2, len: en - st }; }
              return best; };
            // every arc (four radii, the three widest gaps, one ring or two) and the one-at-a-time placement are scored the
            // same way (problems first, then link length); the cheapest wins
            // a link name sits at the middle of its link: one covering a class or another new name counts 8, as in the routing
            const costOf = () => { let c = 0; const nb = B.map((v) => ({ x: (P[v].x + A.x) / 2, y: (P[v].y + A.y) / 2, w: labTo.get(v) || 0 }));
              for (let i = 0; i < B.length; i++) { const v = B[i]; c += _ogVCost(P, items, EE, inc, v, 9) * 1e4 + Math.hypot(P[v].x - A.x, P[v].y - A.y); const q = nb[i]; if (!q.w) continue;
                for (let u = 0; u < n; u++) if (P[u] && Math.abs(P[u].x - q.x) < (items[u].w + q.w) / 2 + 2 && Math.abs(P[u].y - q.y) < items[u].h / 2 + 9) c += 8e4;
                for (let j = i + 1; j < B.length; j++) if (nb[j].w && Math.abs(nb[j].x - q.x) < (q.w + nb[j].w) / 2 + 2 && Math.abs(nb[j].y - q.y) < 16) c += 8e4; }
              return c; };
            let best = null;
            for (const R of [R0, R0 * 1.35, R0 * 1.8, R0 * 2.4]) {
              const iv = blocked(R); const gaps = [];
              { const g0 = largestGap(iv); if (g0.len > 0) gaps.push(g0); }
              for (const sh of [-1, 1]) { const g0 = gaps[0]; if (!g0 || g0.len < Math.PI / 2) continue; gaps.push({ mid: g0.mid + sh * g0.len / 4, len: g0.len / 2 }); }
              for (const g of gaps) for (const rings of [1, 2]) {
                const per = Math.ceil(B.length / rings), step = Math.min(1.5 * s0 / R, g.len / Math.max(per, 1)); if (step * R < s0 * (rings === 1 ? 1 : 0.6)) continue;
                const spots = B.map((v, i) => { const ring = rings === 1 ? 0 : i % 2, j = rings === 1 ? i : i >> 1, cnt = rings === 1 ? B.length : (ring ? B.length >> 1 : per);
                  const th = g.mid + (j - (cnt - 1) / 2) * step, rr = R + ring * s0 * 0.9; return { x: A.x + rr * Math.cos(th), y: A.y + rr * Math.sin(th) }; });
                const ok = spots.every((p, i) => { const v = B[i]; if (!free(v, p)) return false; P[v] = p; return true; });
                if (ok) { const c = costOf(); if (!best || c < best.c) best = { c, spots }; }
                B.forEach((v) => (P[v] = null));
              }
            }
            if (!best) continue;
            for (const v of B) place(v); const one = costOf(), oneAt = B.map((v) => P[v]); B.forEach((v) => (P[v] = null));
            if (one <= best.c) { B.forEach((v, i) => (P[v] = oneAt[i])); } else B.forEach((v, i) => (P[v] = best.spots[i]));
            B.forEach((v) => fanned.add(v));
          }
        }
        // the new class with the most placed neighbours goes first
        const todo = new Set(fresh.filter((v) => !fanned.has(v)));
        while (todo.size) { let pick = -1, most = -1; for (const v of todo) { const c = nbr(v).length; if (c > most) { most = c; pick = v; } } todo.delete(pick); place(pick); }
        for (const v of fresh) { if (fanned.has(v)) continue; P[v] = null; place(v); }
        if (_ogTr) _ogTr.snap("place", P);
        return P;
      }
      // Relation classes (a relationship modelled as a class, as with reification or an association class): a box with
      // between: [subject, object] moves onto the line between those two classes, as near its middle as there is room, when that
      // costs it at most one crossing more than where it is (a link through a box counts 10, a crossing 6). Measured on the 15
      // development graphs with every third relationship made a class: relation classes bent by more than 45 degrees 100 -> 66
      // of 225, with fewer crossed links and links through classes in total. Positions in, new positions out.
      function _ogInline(pos, items, edges) {
        const n = pos.length, P = pos.map((p) => ({ x: p.x, y: p.y })), EE = edges.filter((e) => e[0] !== e[1]).map((e) => ({ s: e[0], t: e[1] })), m = EE.length;
        const R = []; items.forEach((d, v) => { const b = d && d.between; if (b && b.length === 2 && b[0] !== b[1] && b.every((u) => u >= 0 && u < n && u !== v)) R.push(v); });
        if (!R.length || n > 1500) return P;
        const inc = _ogClIncidence(n, EE), pad = 9;
        const cost = (v) => _ogVCost(P, items, EE, inc, v, pad);
        const clash = (v) => { _ogWorkN[2] += n; for (let u = 0; u < n; u++) if (u !== v && Math.abs(P[u].x - P[v].x) < (items[u].w + items[v].w) / 2 + 10 && Math.abs(P[u].y - P[v].y) < (items[u].h + items[v].h) / 2 + 10) return true; return false; };
        // how far a point lies off the line between the two classes, as a share of their distance
        const off = (v, p) => { const [a, b] = items[v].between, A = P[a], B = P[b], L = Math.hypot(B.x - A.x, B.y - A.y) || 1; return Math.abs((B.x - A.x) * (p.y - A.y) - (B.y - A.y) * (p.x - A.x)) / L / L; };
        let moved = 0;
        for (let pass = 0; pass < 2; pass++) for (const v of R) {
          const [a, b] = items[v].between, A = P[a], B = P[b], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
          const old = P[v], f0 = off(v, old); if (f0 < 0.05) continue;
          const c0 = cost(v); let best = null;
          for (const t of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) for (const d of [0, 12, -12, 24, -24, 40, -40]) {
            const p = { x: A.x + dx * t + nx * d, y: A.y + dy * t + ny * d }; if (off(v, p) >= f0 * 0.7) continue;
            P[v] = p; if (!clash(v)) { const c1 = cost(v); if (c1 <= c0 + 6) { const sc = c1 * 100 + off(v, p) * 50 + Math.abs(t - 0.5); if (!best || sc < best.sc) best = { sc, p }; } }
            P[v] = old; }
          if (best) { P[v] = best.p; moved++; }
        }
        if (_ogTr && moved) _ogTr.snap("inline", P);
        return P;
      }
      // Two one-link classes of the same class trade places when that leaves fewer problems: a link through a box (with a
      // 9 px margin, as the drawing is measured) counts 10, a crossing 6. A long name beside a link that passes close by is
      // the usual case: the shorter box fits where the longer one was in the way. Positions in, new positions out.
      // down [[subclass, superclass]] (a top-down drawing): no move may leave a subclass less than 20 px below its superclass.
      function _ogLeafSwap(pos, items, edges, down) {
        const n = pos.length, P = pos.map((p) => ({ x: p.x, y: p.y })), EE = edges.filter((e) => e[0] !== e[1]).map((e) => ({ s: e[0], t: e[1] })), m = EE.length;
        if (!m || n > 1500) return P;
        const dn = down && down.length ? Array.from({ length: n }, () => []) : null;
        if (dn) down.forEach(([c, q]) => { if (c !== q) { dn[c].push([c, q]); dn[q].push([c, q]); } });
        const level = (v) => !dn || dn[v].every(([c, q]) => P[c].y >= P[q].y + 20);
        const leafOf = _ogClLeaves(n, EE), kids = new Map(), inc = _ogClIncidence(n, EE), pad = 9;
        leafOf.forEach((p, v) => { if (p >= 0) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(v); } });
        // problems that involve class v: its links (crossings, through boxes) and links through its box
        const cost = (v) => _ogVCost(P, items, EE, inc, v, pad);
        let swaps = 0;
        kids.forEach((ks) => {
          if (ks.length < 2 || ks.length > 40) return;
          for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
            const a = ks[i], b = ks[j], before = cost(a) + cost(b); if (!before) continue;
            const pa = P[a]; P[a] = P[b]; P[b] = pa;
            const after = cost(a) + cost(b);
            // the two classes must not overlap anything at their new places
            const clash = [a, b].some((v) => { for (let u = 0; u < n; u++) if (u !== v && Math.abs(P[u].x - P[v].x) < (items[u].w + items[v].w) / 2 + 4 && Math.abs(P[u].y - P[v].y) < (items[u].h + items[v].h) / 2 + 4) return true; return false; });
            if (clash || after >= before - 0.5 || !level(a) || !level(b)) { P[b] = P[a]; P[a] = pa; } else swaps++;
          }
        });
        if (_ogTr && swaps) _ogTr.snap("swap", P);
        let moved = 0;
        const t0 = _ogNow(), late = () => _ogNow() - t0 > 120; // these passes stop after 120 ms of the work clock
        const overlaps = (v) => { _ogWorkN[2] += n; for (let u = 0; u < n; u++) if (u !== v && Math.abs(P[u].x - P[v].x) < (items[u].w + items[v].w) / 2 + 6 && Math.abs(P[u].y - P[v].y) < (items[u].h + items[v].h) / 2 + 6) return true; return false; };
        // "Don't fence me in": a one-link class whose link still crosses another link or runs through a class looks for the
        // most open spot round its neighbor (out to 4 link lengths, 48 directions): problems first (a crossing 6, a link through a
        // class 10, as in the link routing), then the most room
        // around it (clearance to the nearest class or link, up to 120 px), then the shorter link. Taken only if its problems
        // get fewer.
        if (!_OG_TUNE.noFence) {
          const L0 = 170, segs = EE;
          const probs = (v, c) => { const p = leafOf[v]; let x = 0; _ogWorkN[0] += m; _ogWorkN[1] += n + m;
            for (const g of segs) { if (g.s === v || g.t === v) continue;
              if (g.s !== p && g.t !== p && _ogClSegX(P[p], c, P[g.s], P[g.t])) x += 6;
              if (_ogClSegBox(P[g.s].x - c.x, P[g.s].y - c.y, P[g.t].x - c.x, P[g.t].y - c.y, items[v].w / 2 + pad, items[v].h / 2 + pad)) x += 10; }
            for (let u = 0; u < n; u++) if (u !== v && u !== p && _ogClSegBox(P[p].x - P[u].x, P[p].y - P[u].y, c.x - P[u].x, c.y - P[u].y, items[u].w / 2 + pad, items[u].h / 2 + pad)) x += 10;
            return x; };
          const room = (v, c) => { let d = _OG_TUNE.fenceRoom || 120; _ogWorkN[1] += n + m;
            for (let u = 0; u < n; u++) if (u !== v) { const gx = Math.abs(P[u].x - c.x) - (items[u].w + items[v].w) / 2, gy = Math.abs(P[u].y - c.y) - (items[u].h + items[v].h) / 2; d = Math.min(d, Math.max(gx, gy)); }
            for (const g of segs) { if (g.s === v || g.t === v) continue; d = Math.min(d, _ogClDPS(c, P[g.s], P[g.t]) - Math.max(items[v].w, items[v].h) / 2); }
            return d; };
          for (let v = 0; v < n; v++) {
            const p = leafOf[v]; if (p < 0) continue; if (late()) break; const now = probs(v, P[v]); if (!now) continue;
            let best = null; const old = P[v];
            for (let a = 0; a < 48; a++) { const th = a * Math.PI / 24, ux = Math.cos(th), uy = Math.sin(th) * 0.75;
              const r0 = Math.min(((items[p].w + items[v].w) / 2 + 40) / Math.max(Math.abs(ux), 1e-6), ((items[p].h + items[v].h) / 2 + 40) / Math.max(Math.abs(uy), 1e-6));
              for (let r = r0; r < r0 + 3 * L0; r += 30) { const c = { x: P[p].x + ux * r, y: P[p].y + uy * r }; P[v] = c;
                const free = !overlaps(v) && level(v); P[v] = old; if (!free) continue;
                const x = probs(v, c); if (x >= now) continue; const sc = x * 200 - room(v, c) + 0.2 * r;
                if (!best || sc < best.sc) best = { sc, c }; } }
            if (best) { P[v] = best.c; moved++; }
          }
        }
        if (_ogTr && moved) _ogTr.snap("fence", P);
        if (_OG_TUNE.noNudge) return P;
        // Then a class that a link runs through (or within the margin of) is pushed off the line, to the side it is on, just far
        // enough to clear it (or twice that); or, when one end of the link is a one-link class, that end turns round its neighbor
        // by 8 to 30 degrees. Kept only if the problems involving the moved class get fewer and it overlaps nothing.
        const tryMove = (v, x, y) => { const o = P[v], before = cost(v); P[v] = { x, y }; if (!overlaps(v) && level(v) && cost(v) < before - 0.5) return true; P[v] = o; return false; };
        for (let pass = 0; pass < 3; pass++) {
          let any = false;
          for (let k = 0; k < m && !late(); k++) {
            const e = EE[k]; _ogWorkN[1] += n;
            for (let u = 0; u < n; u++) {
              if (u === e.s || u === e.t) continue; const a = P[e.s], b = P[e.t], c = P[u];
              if (!_ogClSegBox(a.x - c.x, a.y - c.y, b.x - c.x, b.y - c.y, items[u].w / 2 + pad, items[u].h / 2 + pad)) continue;
              const L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, d = (c.x - a.x) * nx + (c.y - a.y) * ny, sg = d >= 0 ? 1 : -1;
              const need = Math.abs(nx) * items[u].w / 2 + Math.abs(ny) * items[u].h / 2 + pad + 2 - Math.abs(d);
              let done = false;
              for (const f of [1, 2]) if (!done && tryMove(u, c.x + sg * nx * need * f, c.y + sg * ny * need * f)) done = true;
              for (const end of [e.s, e.t]) { if (done || leafOf[end] < 0) continue; const h = P[leafOf[end]], q = P[end], r = Math.hypot(q.x - h.x, q.y - h.y), a0 = Math.atan2(q.y - h.y, q.x - h.x);
                for (const da of [8, -8, 15, -15, 30, -30]) { const t = a0 + da * Math.PI / 180; if (tryMove(end, h.x + r * Math.cos(t), h.y + r * Math.sin(t))) { done = true; break; } } }
              if (done) { moved++; any = true; }
            }
          }
          if (!any) break;
        }
        if (_ogTr && moved) _ogTr.snap("nudge", P);
        return P;
      }
      // "Pull in": a part that hangs off the rest by one link (a one-link class, a chain, a small tree) and sprawls toward
      // the edge of the drawing turns round the class it hangs from and/or draws in toward it, into open space, when that
      // leaves no more problems (crossing 6, link through a class 10, measured on the part's links and on links through its
      // boxes) and either shrinks the drawing's box or, with the box unchanged, makes the part's links much shorter. Parts
      // on the edge go first; at most `ms` of the work clock. Positions in, new positions out.
      const _OG_PULL = { ms: 100, maxPart: 0.4, gain: 0.01, shorter: 0.25, room: 14, pad: 9, minGap: 70, groupRoom: 40 };
      function _ogPullIn(pos, items, edges, opt) {
        const o = { ..._OG_PULL, ...(opt || {}) }, n = pos.length, P = pos.map((p) => ({ x: p.x, y: p.y }));
        const EE = edges.filter((e) => e[0] !== e[1]).map((e) => ({ s: e[0], t: e[1] })), m = EE.length;
        if (n < 4 || !m || n > 1500) return P;
        const inc = _ogClIncidence(n, EE), pad = o.pad, t0 = _ogNow();
        // parts hanging by one link: strip one-link classes until none is left; each stripped class hangs from the
        // neighbor still there when it went, and a part is a stripped class with everything hanging below it
        const deg = inc.map((l) => l.length), gone = new Array(n).fill(false), up = new Array(n).fill(-1), q = [];
        for (let v = 0; v < n; v++) if (deg[v] === 1) q.push(v);
        let left = n;
        while (q.length && left > 1) { const v = q.shift(); if (gone[v] || deg[v] !== 1) continue; gone[v] = true; left--;
          for (const k of inc[v]) { const u = EE[k].s === v ? EE[k].t : EE[k].s; if (!gone[u]) { up[v] = u; if (--deg[u] === 1) q.push(u); } } }
        const kids = Array.from({ length: n }, () => []); for (let v = 0; v < n; v++) if (gone[v] && up[v] >= 0) kids[up[v]].push(v);
        const below = (v) => { const S = [v]; for (let i = 0; i < S.length; i++) S.push(...kids[S[i]]); return S; };
        // every stripped class with what hangs below it is a part (a whole hanging tree, and each of its branches)
        const parts = []; for (let v = 0; v < n; v++) if (gone[v] && up[v] >= 0) { const S = below(v); if (S.length <= o.maxPart * n) parts.push({ root: v, hang: up[v], S }); }
        if (!parts.length) return P;
        const box = () => { let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18; for (let u = 0; u < n; u++) { const p = P[u], w = items[u].w / 2, h = items[u].h / 2; if (p.x - w < x1) x1 = p.x - w; if (p.x + w > x2) x2 = p.x + w; if (p.y - h < y1) y1 = p.y - h; if (p.y + h > y2) y2 = p.y + h; } return { x1, y1, x2, y2, a: (x2 - x1) * (y2 - y1) }; };
        // problems involving the part (its links against all links and boxes, other links through its boxes) and its link length
        const cost = (S, inS) => { let c = 0, len = 0; const ek = new Set(); for (const v of S) for (const k of inc[v]) ek.add(k); _ogWorkN[0] += ek.size * m; _ogWorkN[1] += ek.size * n + m * S.length;
          for (const k of ek) { const e = EE[k], a = P[e.s], b = P[e.t]; len += Math.hypot(b.x - a.x, b.y - a.y);
            for (let u = 0; u < n; u++) if (u !== e.s && u !== e.t && _ogClSegBox(a.x - P[u].x, a.y - P[u].y, b.x - P[u].x, b.y - P[u].y, items[u].w / 2 + pad, items[u].h / 2 + pad)) c += 10;
            for (let f = 0; f < m; f++) { if (ek.has(f) && f <= k) continue; const g = EE[f]; if (g.s === e.s || g.s === e.t || g.t === e.s || g.t === e.t) continue; if (_ogClSegX(a, b, P[g.s], P[g.t])) c += 6; } }
          for (let f = 0; f < m; f++) { if (ek.has(f)) continue; const g = EE[f]; for (const v of S) if (_ogClSegBox(P[g.s].x - P[v].x, P[g.s].y - P[v].y, P[g.t].x - P[v].x, P[g.t].y - P[v].y, items[v].w / 2 + pad, items[v].h / 2 + pad)) c += 10; }
          return { c, len }; };
        // the part's boxes must keep `room` px from every other box (and from each other when drawn in)
        const clash = (S, inS, gap, rigid) => { _ogWorkN[2] += S.length * n; for (const v of S) for (let u = 0; u < n; u++) { if (u === v || (inS[u] && (rigid || u < v))) continue; if (Math.abs(P[u].x - P[v].x) < (items[u].w + items[v].w) / 2 + gap && Math.abs(P[u].y - P[v].y) < (items[u].h + items[v].h) / 2 + gap) return true; } return false; };
        const edgeDist = (S, B) => { let d = 1e18; for (const v of S) { const p = P[v], w = items[v].w / 2, h = items[v].h / 2; d = Math.min(d, p.x - w - B.x1, B.x2 - p.x - w, p.y - h - B.y1, B.y2 - p.y - h); } return d; };
        // a link drawn in keeps at least minGap px between its two boxes (or what it had), so its name still fits
        const gap = (e) => { const a = P[e.s], b = P[e.t], dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), L = Math.hypot(dx, dy) || 1;
          const inA = Math.min(dx ? items[e.s].w / 2 * L / dx : 1e9, dy ? items[e.s].h / 2 * L / dy : 1e9), inB = Math.min(dx ? items[e.t].w / 2 * L / dx : 1e9, dy ? items[e.t].h / 2 * L / dy : 1e9); return L - inA - inB; };
        const gap0 = EE.map(gap), gapsOk = (S) => { for (const v of S) for (const k of inc[v]) if (gap(EE[k]) < Math.min(gap0[k], o.minGap)) return false; return true; };
        const angs = [20, -20, 40, -40, 60, -60, 90, -90, 120, -120, 150, -150, 180], scales = [1, 0.85, 0.7, 0.55];
        let moved = 0;
        for (let pass = 0; pass < 2; pass++) {
          let B = box(); parts.sort((a, b) => edgeDist(a.S, B) - edgeDist(b.S, B) || b.S.length - a.S.length);
          let any = false;
          for (const pt of parts) {
            if (_ogNow() - t0 > o.ms) break;
            const S = pt.S, inS = new Array(n).fill(false); S.forEach((v) => (inS[v] = true));
            B = box(); const c0 = cost(S, inS), old = S.map((v) => P[v]), h = P[pt.hang];
            let best = null;
            for (const sc of scales) for (const da of [0, ...angs]) {
              if (sc === 1 && da === 0) continue; const t = da * Math.PI / 180, cs = Math.cos(t), sn = Math.sin(t);
              S.forEach((v, i) => { const dx = old[i].x - h.x, dy = old[i].y - h.y; P[v] = { x: h.x + sc * (dx * cs - dy * sn), y: h.y + sc * (dx * sn + dy * cs) }; });
              if (!clash(S, inS, o.room) && (sc === 1 || gapsOk(S))) { const c1 = cost(S, inS);
                if (c1.c <= c0.c) { const B1 = box(), gain = (B.a - B1.a) / B.a, short = 1 - c1.len / (c0.len || 1);
                  const ok = gain > o.gain || (gain > -1e-9 && short > o.shorter);
                  if (ok) { const sc2 = c1.c * 1e6 - gain * 1e4 - short * 100 + Math.abs(da) / 180; if (!best || sc2 < best.sc) best = { sc: sc2, at: S.map((v) => P[v]) }; } } }
              S.forEach((v, i) => (P[v] = old[i]));
            }
            if (best) { S.forEach((v, i) => (P[v] = best.at[i])); moved++; any = true; }
          }
          if (!any) break;
        }
        // groups (Louvain communities of 4 or more) slide straight toward the middle of the drawing, as a block, by the largest
        // step that keeps room round every box, no more problems and a smaller box: closes the empty bands between groups
        if (!o.noGroups && n >= 12) {
          const com = _ogClMergeSmall(_ogClLouvain(n, EE.map((e) => [e.s, e.t, 1])), EE.map((e) => [e.s, e.t, 1]), 4), G = new Map();
          com.forEach((c, v) => { if (!G.has(c)) G.set(c, []); G.get(c).push(v); });
          const groups = [...G.values()].filter((S) => S.length < n * 0.6);
          for (let pass = 0; pass < 3; pass++) {
            let any = false; const B = box(); groups.sort((a, b) => edgeDist(a, B) - edgeDist(b, B));
            for (const S of groups) {
              if (_ogNow() - t0 > o.ms * 2) break;
              const inS = new Array(n).fill(false); S.forEach((v) => (inS[v] = true));
              const B0 = box(), cx = (B0.x1 + B0.x2) / 2, cy = (B0.y1 + B0.y2) / 2; let gx = 0, gy = 0; S.forEach((v) => { gx += P[v].x; gy += P[v].y; }); gx /= S.length; gy /= S.length;
              const c0 = cost(S, inS), old = S.map((v) => P[v]), d0 = Math.hypot(gx - cx, gy - cy); let best = null;
              for (let k = 0; k < 16; k++) { const th = k * Math.PI / 8, ux = Math.cos(th), uy = Math.sin(th);
                if (ux * (cx - gx) + uy * (cy - gy) <= 0) continue; // only steps toward the middle
                for (const st of [640, 320, 160, 80, 40]) {
                  S.forEach((v, i) => (P[v] = { x: old[i].x + ux * st, y: old[i].y + uy * st }));
                  const inward = d0 - Math.hypot(gx + ux * st - cx, gy + uy * st - cy);
                  if (inward > 30 && !clash(S, inS, o.groupRoom, true)) { const B1 = box(), gain = (B0.a - B1.a) / B0.a;
                    if (gain > -1e-9) { const sc = gain * 1e4 + inward; if ((!best || sc > best.sc) && cost(S, inS).c <= c0.c) best = { sc, gain, at: S.map((v) => P[v]) }; } }
                  S.forEach((v, i) => (P[v] = old[i])); } }
              if (best) { S.forEach((v, i) => (P[v] = best.at[i])); moved++; any = true; }
            }
            if (!any) break;
          }
        }
        if (_ogTr && moved) _ogTr.snap("pull", P);
        return P;
      }
      // ── end of the clean-up ──
      // Apart: classes with no link, and small parts of the graph not linked to the rest, that sit inside or against the area
      // of the largest part move out to one side of it, each part as it was drawn, so that they neither crowd the main graph
      // nor look linked to it. A small part has at most a quarter of the largest part's classes and at most 12. Each side is
      // tried, the parts packed in rows along it (largest first); the side that leaves the smallest drawing wins. A move is kept
      // only when crossed links and links through classes do not rise, no box overlaps another and the drawing grows by at
      // most 10%. Only when the largest part has 6 classes or more and twice as many as any other part.
      function _ogApart(pos, items, edges) {
        const n = pos.length; if (n < 8 || n > 1500) return pos;
        const par = Array.from({ length: n }, (_, i) => i), root = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
        edges.forEach(([s, t]) => { if (s !== t) par[root(s)] = root(t); });
        const parts = new Map(); for (let i = 0; i < n; i++) { const r = root(i); if (!parts.has(r)) parts.set(r, []); parts.get(r).push(i); }
        const C = [...parts.values()].sort((a, b) => b.length - a.length);
        if (C.length < 2 || C[0].length < 6 || C[0].length < 2 * C[1].length) return pos;
        const G = 40, lim = Math.min(12, Math.max(1, Math.floor(C[0].length / 4)));
        const box = (vs, P) => { let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
          for (const v of vs) { x1 = Math.min(x1, P[v].x - items[v].w / 2); x2 = Math.max(x2, P[v].x + items[v].w / 2); y1 = Math.min(y1, P[v].y - items[v].h / 2); y2 = Math.max(y2, P[v].y + items[v].h / 2); }
          return { x1, y1, x2, y2 }; };
        const M = box(C[0], pos), near = (b) => b.x1 < M.x2 + G && b.x2 > M.x1 - G && b.y1 < M.y2 + G && b.y2 > M.y1 - G;
        const units = C.slice(1).filter((c) => c.length <= lim).map((vs) => ({ vs, b: box(vs, pos) })).filter((u) => near(u.b));
        if (!units.length) return pos;
        units.sort((a, b) => b.vs.length - a.vs.length || (b.b.x2 - b.b.x1) - (a.b.x2 - a.b.x1) || a.vs[0] - b.vs[0]);
        const EE = edges.filter((e) => e[0] !== e[1]).map((e) => ({ s: e[0], t: e[1] })), Np = items.map((d) => ({ w: d.w + 6, h: d.h + 6 }));
        const all = Array.from({ length: n }, (_, i) => i), area = (P) => { const b = box(all, P); return (b.x2 - b.x1) * (b.y2 - b.y1); };
        const m0 = _ogPlacementMetrics(pos, Np, EE), A0 = area(pos), moving = new Set(units.flatMap((u) => u.vs)), still = all.filter((v) => !moving.has(v));
        let best = null;
        for (const side of ["below", "right", "above", "left"]) {
          const along = side === "below" || side === "above", span = Math.max(along ? M.x2 - M.x1 : M.y2 - M.y1, ...units.map((u) => (along ? u.b.x2 - u.b.x1 : u.b.y2 - u.b.y1)));
          const P = pos.map((p) => ({ x: p.x, y: p.y })); let a = 0, b = 0, row = 0; // a: along the side, b: depth of the current row, row: its height
          for (const u of units) {
            const w = along ? u.b.x2 - u.b.x1 : u.b.y2 - u.b.y1, h = along ? u.b.y2 - u.b.y1 : u.b.x2 - u.b.x1;
            if (a > 0 && a + w > span) { b += row + G / 2; a = 0; row = 0; }
            const x = side === "below" || side === "above" ? M.x1 + a : side === "right" ? M.x2 + G + b : M.x1 - G - b - h;
            const y = side === "below" ? M.y2 + G + b : side === "above" ? M.y1 - G - b - h : M.y1 + a;
            for (const v of u.vs) P[v] = { x: pos[v].x + x - u.b.x1, y: pos[v].y + y - u.b.y1 };
            a += w + G / 2; row = Math.max(row, h);
          }
          const hit = still.some((s) => [...moving].some((v) => Math.abs(P[s].x - P[v].x) < (items[s].w + items[v].w) / 2 + 6 && Math.abs(P[s].y - P[v].y) < (items[s].h + items[v].h) / 2 + 6));
          if (hit) continue;
          const m = _ogPlacementMetrics(P, Np, EE), A = area(P);
          if (m.cross > m0.cross || m.thru > m0.thru || A > A0 * 1.1) continue;
          if (!best || A < best.A) best = { P, A };
        }
        if (!best) return pos;
        if (_ogTr) _ogTr.snap("apart", best.P);
        return best.P;
      }
      // ── Link routing after a layout ──
      // The layouts place classes; this draws the links between them, on the final positions, without moving any class:
      //   1. parallel links: two or more links between the same two classes (a link and its reverse, or two relationships)
      //      become arcs spread evenly on both sides of the straight line, so none hides another and each name has room;
      //   2. self-links: a loop beside the class, on its emptiest side;
      //   3. bends: a link that still runs through a class (or, if that pays off, crosses another) gets one or two bends that
      //      take it round the obstacle, kept only when the drawing gets better counting the extra length;
      //   4. ports: at a class with three or more links, link ends that would meet the box closer than portGap px apart are
      //      spread along the side of the box they reach, in the same order, so each link meets the box at its own point;
      //   5. names: each link's name is placed on its path where it covers no class, no other name and as few links as can be.
      // A route is { bends: [{t, d}], ports: [start, end] offsets from the class centers or null, loop, label }. A bend lies at
      // fraction t along the line between the two centers and d px to its left (d < 0: right); the path is a Catmull-Rom curve
      // from the start through the bends to the end (_ogRoutePoly). Same input, same routes: the time limit is on the work clock.
      // items [{w, h}] as drawn, edges [[s, t, kind, nameWidth?]] -> { routes (one per edge), stats }.
      const _OG_ROUTE = { sep: 24, pad: 9, samples: 8, bends: true, crossBends: true, ports: 3, portGap: 10, labels: true, labelH: 14, labelSide: true, settle: true, straight: false, arcs: true, budgetMs: 250, W: { thru: 10, cross: 6, sharp: 3, len: 5, bend: 1.5, turn: 3, out: 1 } };
      function _ogRoutePts(A, B, bends) {
        const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        return bends.map((h) => ({ x: A.x + h.t * dx + h.d * nx, y: A.y + h.t * dy + h.d * ny }));
      }
      // The drawn path as points: straight from end to end, or the Catmull-Rom curve sampled with `samples` segments per piece.
      // A, B: the class centers; pa, pb: port offsets from them (or null); loop: absolute points of a self-link's loop.
      function _ogRoutePoly(A, B, r, samples) {
        const s = samples || 8, a = r && r.ports && r.ports[0] ? { x: A.x + r.ports[0].x, y: A.y + r.ports[0].y } : A, b = r && r.ports && r.ports[1] ? { x: B.x + r.ports[1].x, y: B.y + r.ports[1].y } : B;
        const mid = r && r.loop ? r.loop.map((p) => ({ x: A.x + p.x, y: A.y + p.y })) : r && r.bends && r.bends.length ? _ogRoutePts(A, B, r.bends) : [];
        if (!mid.length) return [a, b];
        const pts = [a, ...mid, b], out = [a];
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
          const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }, c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
          for (let j = 1; j <= s; j++) { const t = j / s, u = 1 - t; out.push({ x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x, y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y }); }
        }
        return out;
      }
      const _ogPolyBox = (pl) => { let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18; for (const p of pl) { if (p.x < x1) x1 = p.x; if (p.x > x2) x2 = p.x; if (p.y < y1) y1 = p.y; if (p.y > y2) y2 = p.y; } return { x1, y1, x2, y2 }; };
      const _ogPolyLen = (pl) => { let s = 0; for (let i = 1; i < pl.length; i++) s += Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y); return s; };
      // crossings between two paths (each crossing point once), and how many of them are sharp (under 30°)
      function _ogPolyCross(p, q, bp, bq) {
        if (bp.x2 < bq.x1 || bq.x2 < bp.x1 || bp.y2 < bq.y1 || bq.y2 < bp.y1) return [0, 0];
        let c = 0, sh = 0;
        for (let i = 0; i < p.length - 1; i++) {
          const a = p[i], b = p[i + 1];
          if (Math.max(a.x, b.x) < bq.x1 || Math.min(a.x, b.x) > bq.x2 || Math.max(a.y, b.y) < bq.y1 || Math.min(a.y, b.y) > bq.y2) continue;
          for (let j = 0; j < q.length - 1; j++) {
            const cc = q[j], d = q[j + 1];
            if (Math.max(a.x, b.x) < Math.min(cc.x, d.x) || Math.max(cc.x, d.x) < Math.min(a.x, b.x) || Math.max(a.y, b.y) < Math.min(cc.y, d.y) || Math.max(cc.y, d.y) < Math.min(a.y, b.y)) continue;
            if (_ogClSegX(a, b, cc, d)) { c++; const ux = b.x - a.x, uy = b.y - a.y, vx = d.x - cc.x, vy = d.y - cc.y; if (Math.abs(ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1) > 0.866) sh++; }
          }
        }
        return [c, sh];
      }
      // does the path touch the box of class v (half-sizes plus pad)?
      function _ogPolyThru(pl, bb, P, N, v, pad) {
        const c = P[v], hw = N[v].w / 2 + pad, hh = N[v].h / 2 + pad;
        if (bb.x2 < c.x - hw || bb.x1 > c.x + hw || bb.y2 < c.y - hh || bb.y1 > c.y + hh) return false;
        for (let i = 0; i < pl.length - 1; i++) {
          const ax = pl[i].x - c.x, ay = pl[i].y - c.y, bx = pl[i + 1].x - c.x, by = pl[i + 1].y - c.y;
          if ((ax < -hw && bx < -hw) || (ax > hw && bx > hw) || (ay < -hh && by < -hh) || (ay > hh && by > hh)) continue;
          if (_ogClSegBox(ax, ay, bx, by, hw, hh)) return true;
        }
        return false;
      }
      // settle (on by default): a class that a drawn link still runs through (curve included, with the 9 px margin) is pushed
      // off it, perpendicular to the piece of the path that crosses it, just far enough, if it then overlaps nothing; the links
      // are routed again and the moved drawing is kept only if it has fewer problems (crossing 6, link through a class 10,
      // name over a class or name 8, link across a name 1.5). Only when the first routing used under half its time.
      // Returns { routes, stats, pos }: pos is the positions the routes belong to (the input itself when nothing moved).
      function _ogRouteLinks(pos, items, edges, opts) { const w0 = _ogWorkMs(); return _ogClocked(() => {
        const o = { ..._OG_ROUTE, ...(opts || {}) }; let r = _ogRouteRun(pos, items, edges, opts); r.pos = pos;
        if (o.settle && r.stats.ms < o.budgetMs / 2) {
          const n = pos.length, m = edges.length, score = (q) => q.cross * 6 + q.thru * 10 + q.labelOver * 8 + q.labelCrossed * 1.5;
          const Q = pos.map((p) => ({ x: p.x, y: p.y })); let moved = 0;
          edges.forEach(([s, t], k) => { if (s === t) return; const pl = _ogRoutePoly(pos[s], pos[t], r.routes[k], o.samples); _ogWorkN[1] += n * pl.length;
            for (let u = 0; u < n; u++) { if (u === s || u === t) continue; const c = Q[u], hw = items[u].w / 2, hh = items[u].h / 2; let best = null;
              for (let i = 0; i < pl.length - 1; i++) if (_ogClSegBox(pl[i].x - c.x, pl[i].y - c.y, pl[i + 1].x - c.x, pl[i + 1].y - c.y, hw + o.pad, hh + o.pad)) {
                const a = pl[i], b = pl[i + 1], L = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, dd = (c.x - a.x) * nx + (c.y - a.y) * ny, need = Math.abs(nx) * hw + Math.abs(ny) * hh + o.pad + 2 - Math.abs(dd);
                if (!best || need > best.need) best = { need, nx: (dd < 0 ? -1 : 1) * nx, ny: (dd < 0 ? -1 : 1) * ny }; }
              if (!best) continue; const nq = { x: c.x + best.nx * best.need, y: c.y + best.ny * best.need }; let free = true;
              for (let w = 0; w < n && free; w++) if (w !== u && Math.abs(Q[w].x - nq.x) < (items[w].w + items[u].w) / 2 + 6 && Math.abs(Q[w].y - nq.y) < (items[w].h + items[u].h) / 2 + 6) free = false;
              if (free) { Q[u] = nq; moved++; } } });
          if (moved) {
            const r2 = _ogRouteRun(Q, items, edges, { ...(opts || {}), budgetMs: o.budgetMs - r.stats.ms }); _ogWorkN[0] += 2 * m * m * o.samples; _ogWorkN[1] += 2 * m * n;
            if (score(_ogRouteMetrics(Q, items, edges, r2.routes, o.pad)) < score(_ogRouteMetrics(pos, items, edges, r.routes, o.pad))) { r2.pos = Q; r2.stats.settled = moved; r2.stats.t.settle = r.stats.ms; r = r2; }
          }
        }
        r.stats.work = _ogWorkMs() - w0; return r; }); }
      function _ogRouteRun(pos, items, edges, opts) {
        const o = { ..._OG_ROUTE, ...(opts || {}), W: { ..._OG_ROUTE.W, ...((opts && opts.W) || {}) } }, P = pos, N = items, n = P.length, t0 = _ogNow();
        // straight: no bends (a link through a class is not bent round it). Repeated and reciprocal links between two classes
        // still become arcs side by side and self-links loops, as by default.
        // arcs: false forces repeated links straight too: parallel straight lines, their ends spread across the two boxes.
        // Self-links stay loops either way (a link from a class to itself has no straight line to draw).
        if (o.straight) { o.bends = false; o.crossBends = false; }
        const E = edges.map(([s, t, w, lab]) => ({ s, t, sub: w === 2, lab: lab || 0 })), m = E.length;
        const R = E.map(() => ({ bends: [], ports: null, loop: null, label: null }));
        const stats = { parallel: 0, loops: 0, bent: 0, bends: 0, ported: 0, labels: 0, ms: 0, t: {} };
        let tq = t0; const lap = (k) => { const x = _ogNow(); stats.t[k] = x - tq; tq = x; }; // work-clock ms per step, for the playback
        // 1. parallel links: bundles of links between the same two classes, spread sep px apart, the middle one straight when odd
        const bundles = new Map();
        E.forEach((e, k) => { if (e.s === e.t) return; const key = Math.min(e.s, e.t) + ',' + Math.max(e.s, e.t); if (!bundles.has(key)) bundles.set(key, []); bundles.get(key).push(k); });
        const B = [...bundles.values()].map((ks) => { const lo = Math.min(E[ks[0]].s, E[ks[0]].t), hi = Math.max(E[ks[0]].s, E[ks[0]].t);
          return { lo, hi, ks, off: ks.map((_, i) => (i - (ks.length - 1) / 2) * o.sep), way: [] }; });
        // a bundle's centerline bends (in the lo -> hi frame) plus each member's offset give the member's bends in its own frame
        const memberBends = (b, i) => {
          const k = b.ks[i], flip = E[k].s !== b.lo, off = b.off[i];
          let w = b.way.length ? b.way.map((h) => ({ t: h.t, d: h.d + off })) : off ? [{ t: 0.5, d: off }] : [];
          if (flip) w = w.map((h) => ({ t: 1 - h.t, d: -h.d })).reverse();
          return w;
        };
        B.forEach((b) => { if (b.ks.length > 1) stats.parallel += b.ks.length;
          if (o.arcs !== false) { b.ks.forEach((k, i) => (R[k].bends = memberBends(b, i))); return; }
          if (b.ks.length < 2) return; // parallel straight lines: the same offset at both ends, kept inside the smaller box
          const A = P[b.lo], Bp = P[b.hi], L = Math.hypot(Bp.x - A.x, Bp.y - A.y) || 1, nx = -(Bp.y - A.y) / L, ny = (Bp.x - A.x) / L;
          const half = Math.min(N[b.lo].w, N[b.lo].h, N[b.hi].w, N[b.hi].h) * 0.4, sp = Math.min(o.sep, 2 * half / (b.ks.length - 1));
          b.ks.forEach((k, i) => { const d = (i - (b.ks.length - 1) / 2) * sp, q = { x: nx * d, y: ny * d }; R[k].ports = [{ ...q }, { ...q }]; });
        });
        lap("arcs");
        // 2. self-links: a loop on the side of the class (a corner, or along a side: 12 places in all) whose wedge is the most
        //    open: fewest links and classes inside the loop, fewest links crossing it, fewest link ends leaving that way
        const dirs = Array.from({ length: n }, () => []);
        E.forEach((e) => { if (e.s === e.t) return; const a = Math.atan2(P[e.t].y - P[e.s].y, P[e.t].x - P[e.s].x); dirs[e.s].push(a); dirs[e.t].push(a + Math.PI); });
        const SL = E.map((e) => (e.s === e.t ? null : [P[e.s], P[e.t]])), SB = SL.map((l) => l && _ogPolyBox(l));
        const loopAt = (v, sx, sy, r, sh) => { const hw = N[v].w / 2, hh = N[v].h / 2;
          if (sx && sy) return { loop: [{ x: sx * (hw + r * 0.3), y: sy * (hh + r) }, { x: sx * (hw + r), y: sy * (hh + r * 0.3) }], ports: [{ x: sx * hw * 0.55, y: sy * hh }, { x: sx * hw, y: sy * hh * 0.2 }] };
          // along the top or bottom: centered, or shifted toward either end of the side (sh = -1, 0, 1) to clear a link leaving there
          if (sy) { const u = Math.min(hw * 0.5, 16), c = (sh || 0) * Math.max(0, hw - u - 2); return { loop: [{ x: c - u - r * 0.5, y: sy * (hh + r) }, { x: c + u + r * 0.5, y: sy * (hh + r) }], ports: [{ x: c - u, y: sy * hh }, { x: c + u, y: sy * hh }] }; }
          const u = hh * 0.5; return { loop: [{ x: sx * (hw + r), y: -u - r * 0.5 }, { x: sx * (hw + r), y: u + r * 0.5 }], ports: [{ x: sx * hw, y: -u }, { x: sx * hw, y: u }] }; };
        const loopsAt = new Map();
        E.forEach((e, k) => {
          if (e.s !== e.t) return; const v = e.s, used = loopsAt.get(v) || []; loopsAt.set(v, used);
          const r = 22 + 8 * Math.floor(used.length / 8); let best = null;
          for (const [sx, sy, sh] of [[1, -1, 0], [1, 1, 0], [-1, 1, 0], [-1, -1, 0], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 1, -1], [0, 1, 1], [0, -1, -1], [0, -1, 1]]) {
            if (used.some((u) => u[0] === sx && u[1] === sy && (u[2] === sh || !sy || sx))) continue;
            const L = loopAt(v, sx, sy, r, sh), pl = _ogRoutePoly(P[v], P[v], L, o.samples), bb = _ogPolyBox(pl); _ogWorkN[2] += 14 * (n + m);
            const a = Math.atan2(sy * N[v].h, sx * N[v].w); let c = 0;
            dirs[v].forEach((d) => { const x = Math.abs(((d - a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); if (x < Math.PI / 4) c += 1; });
            for (let u = 0; u < n; u++) if (u !== v) { if (_ogPolyThru(pl, bb, P, N, u, o.pad)) c += o.W.thru;
              else if (Math.abs(P[u].x - (bb.x1 + bb.x2) / 2) < (N[u].w + bb.x2 - bb.x1) / 2 + 12 && Math.abs(P[u].y - (bb.y1 + bb.y2) / 2) < (N[u].h + bb.y2 - bb.y1) / 2 + 12) c += 2; }
            for (let f = 0; f < m; f++) if (SL[f]) c += _ogPolyCross(pl, SL[f], bb, SB[f])[0] * o.W.cross; // its own links too: one leaving inside the loop crosses it
            if (!best || c < best.c - 1e-9) best = { c, sx, sy, sh, L };
          }
          if (!best) best = { sx: 1, sy: -1, sh: 0, L: loopAt(v, 1, -1, r + 8) };
          used.push([best.sx, best.sy, best.sh]);
          R[k].loop = [{ ...best.L.loop[0] }, { ...best.L.loop[1] }];
          R[k].ports = best.L.ports;
          stats.loops++;
        });
        lap("loops");
        // the box round the classes: a bend that takes a link outside it costs W.out per 20 px, so a link goes round obstacles
        // through the open space inside the drawing rather than in a wide arc beyond its edge
        let fx1 = Infinity, fy1 = Infinity, fx2 = -Infinity, fy2 = -Infinity;
        for (let v = 0; v < n; v++) { fx1 = Math.min(fx1, P[v].x - N[v].w / 2); fx2 = Math.max(fx2, P[v].x + N[v].w / 2); fy1 = Math.min(fy1, P[v].y - N[v].h / 2); fy2 = Math.max(fy2, P[v].y + N[v].h / 2); }
        const outside = (pl) => { let d = 0; for (const p of pl) d = Math.max(d, fx1 - p.x, p.x - fx2, fy1 - p.y, p.y - fy2); return d; };
        // current paths of every link, for the checks below
        const PL = E.map((e, k) => _ogRoutePoly(P[e.s], P[e.t], R[k], o.samples)), BB = PL.map(_ogPolyBox);
        // 3. bends round classes in the way
        const costOf = (k, pl, bb, skip) => { // problems on one link's path: through classes, crossings with links outside skip
          const e = E[k]; let c = 0, x = 0; _ogWorkN[2] += 14 * (n + m) + pl.length * 28; _ogWorkN[5]++;
          for (let v = 0; v < n; v++) if (v !== e.s && v !== e.t && _ogPolyThru(pl, bb, P, N, v, o.pad)) c += o.W.thru;
          for (let f = 0; f < m; f++) {
            if (skip.has(f)) continue; const g = E[f]; if (e.s === g.s || e.s === g.t || e.t === g.s || e.t === g.t) continue;
            const [cx, sh] = _ogPolyCross(pl, PL[f], bb, BB[f]); x += cx; c += cx * o.W.cross + sh * o.W.sharp;
          }
          return c;
        };
        const bundleCost = (b, way) => {
          const keep = b.way; b.way = way; const skip = new Set(b.ks); let c = 0, len = 0;
          const pls = b.ks.map((k, i) => { const pl = _ogRoutePoly(P[E[k].s], P[E[k].t], { bends: memberBends(b, i), ports: R[k].ports }, o.samples); return pl; });
          pls.forEach((pl, i) => { const bb = _ogPolyBox(pl); c += costOf(b.ks[i], pl, bb, skip) + o.W.out * outside(pl) / 20; len += _ogPolyLen(pl); });
          // members of one bundle never cross each other (they share their ends), so only the outside counts
          b.way = keep;
          const straight = Math.hypot(P[b.hi].x - P[b.lo].x, P[b.hi].y - P[b.lo].y) || 1;
          let turn = 0; if (way.length) { const pts = [P[b.lo], ..._ogRoutePts(P[b.lo], P[b.hi], way), P[b.hi]];
            for (let i = 1; i < pts.length - 1; i++) { const ux = pts[i].x - pts[i - 1].x, uy = pts[i].y - pts[i - 1].y, vx = pts[i + 1].x - pts[i].x, vy = pts[i + 1].y - pts[i].y; if (ux * vx + uy * vy < 0) turn++; } }
          return { c: c + o.W.len * Math.max(0, len / b.ks.length / straight - 1) + o.W.bend * way.length + o.W.turn * turn, pls };
        };
        if (o.bends && m) {
          const deadline = t0 + o.budgetMs;
          const problems = (b) => { let c = 0, th = 0; b.ks.forEach((k) => { c += costOf(k, PL[k], BB[k], new Set(b.ks)); for (let v = 0; v < n; v++) if (v !== b.lo && v !== b.hi && _ogPolyThru(PL[k], BB[k], P, N, v, o.pad)) th++; }); return [c, th]; };
          // links through classes first (the time may run out on a dense model), then the most problems first
          const work = B.map((b) => { const [c, th] = problems(b); return { b, c, th }; }).filter((x) => x.th || (o.crossBends && x.c >= o.W.cross)).sort((p, q) => (q.th > 0) - (p.th > 0) || q.c - p.c);
          // a second pass for links still through a class: the bends made since may have opened a way round
          const again = () => work.filter((x) => x.th && problems(x.b)[1]);
          const routeBundle = (b) => {
            if (_ogNow() > deadline) return;
            const A = P[b.lo], Bq = P[b.hi], dx = Bq.x - A.x, dy = Bq.y - A.y, L2 = dx * dx + dy * dy || 1, L = Math.sqrt(L2);
            const td = (p) => ({ t: ((p.x - A.x) * dx + (p.y - A.y) * dy) / L2, d: ((p.x - A.x) * -dy + (p.y - A.y) * dx) / L });
            const spread = Math.max(...b.off.map(Math.abs));
            // obstacles: classes the bundle runs through, and the ends of links it crosses
            // obstacles: classes the bundle runs through, and for each link it crosses, that link's end nearer the crossing
            // (going round it removes the crossing); at most four such ends, the nearest to the bundle's middle
            const obst = new Set(), near = new Map(), mid = { x: (P[b.lo].x + P[b.hi].x) / 2, y: (P[b.lo].y + P[b.hi].y) / 2 };
            b.ks.forEach((k) => { _ogWorkN[2] += n + m; for (let v = 0; v < n; v++) if (v !== b.lo && v !== b.hi && _ogPolyThru(PL[k], BB[k], P, N, v, o.pad)) obst.add(v);
              if (o.crossBends) for (let f = 0; f < m; f++) { const g = E[f]; if (b.ks.includes(f) || g.s === b.lo || g.s === b.hi || g.t === b.lo || g.t === b.hi) continue;
                if (_ogPolyCross(PL[k], PL[f], BB[k], BB[f])[0]) { const v = Math.hypot(P[g.s].x - mid.x, P[g.s].y - mid.y) < Math.hypot(P[g.t].x - mid.x, P[g.t].y - mid.y) ? g.s : g.t; near.set(v, Math.hypot(P[v].x - mid.x, P[v].y - mid.y)); } } });
            const ends = [...near].sort((p, q) => p[1] - q[1]).slice(0, 4).map((x) => x[0]).filter((v) => !obst.has(v));
            const around = (v, mg) => { const out = [], hw = N[v].w / 2 + mg, hh = N[v].h / 2 + mg; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push(td({ x: P[v].x + sx * hw, y: P[v].y + sy * hh }));
              const q = td(P[v]), ext = (Math.abs(-dy / L) * N[v].w + Math.abs(dx / L) * N[v].h) / 2 + mg; out.push({ t: q.t, d: q.d + ext }, { t: q.t, d: q.d - ext }); return out; };
            const ok = (h) => h.t > 0.04 && h.t < 0.96, sp = [];
            [...obst].slice(0, 6).forEach((v) => sp.push(...around(v, o.pad + 10 + spread).filter(ok))); ends.forEach((v) => sp.push(...around(v, o.pad + 10 + spread).filter(ok)));
            const cands = sp.map((h) => [h]);
            for (const t of [0.5, 0.33, 0.67]) for (const f of [0.18, 0.32, 0.5, 0.75]) for (const sg of [1, -1]) cands.push([{ t, d: sg * f * L }]);
            // two bends: pairs on the same side, in order along the link (at most 60)
            const pairs = []; for (let i = 0; i < sp.length; i++) for (let j = 0; j < sp.length; j++) if (sp[i].t < sp[j].t - 0.05 && Math.sign(sp[i].d) === Math.sign(sp[j].d)) pairs.push([sp[i], sp[j]]);
            pairs.sort((p, q) => Math.abs(p[0].d) + Math.abs(p[1].d) - Math.abs(q[0].d) - Math.abs(q[1].d)); cands.push(...pairs.slice(0, 60));
            let best = bundleCost(b, b.way), bestW = b.way; const c0 = best.c;
            for (const w of cands) { if (_ogNow() > deadline) break; const r = bundleCost(b, w); if (r.c < best.c - 0.5) { best = r; bestW = w; } }
            if (bestW !== b.way && best.c < c0 - 0.5) {
              b.way = bestW; stats.bent += b.ks.length; stats.bends += bestW.length * b.ks.length;
              b.ks.forEach((k, i) => { R[k].bends = memberBends(b, i); PL[k] = best.pls[i]; BB[k] = _ogPolyBox(PL[k]); });
            }
          };
          work.forEach((x) => routeBundle(x.b));
          again().forEach((x) => routeBundle(x.b));
        }
        lap("bends");
        // 4. ports: spread link ends that would meet a crowded box at nearly the same point
        if (o.ports) {
          const endsAt = Array.from({ length: n }, () => []);
          E.forEach((e, k) => { if (e.s === e.t) return; endsAt[e.s].push([k, 0]); endsAt[e.t].push([k, 1]); });
          for (let v = 0; v < n; v++) {
            if (endsAt[v].length < o.ports) continue; const hw = N[v].w / 2, hh = N[v].h / 2, faces = [[], [], [], []];
            endsAt[v].forEach(([k, which]) => {
              const e = E[k], pts = _ogRoutePts(P[e.s], P[e.t], R[k].bends), toward = which === 0 ? (pts[0] || P[e.t]) : (pts[pts.length - 1] || P[e.s]);
              const ux = toward.x - P[v].x, uy = toward.y - P[v].y, sx = Math.abs(ux) > 1e-9 ? hw / Math.abs(ux) : Infinity, sy = Math.abs(uy) > 1e-9 ? hh / Math.abs(uy) : Infinity;
              if (sx <= sy) faces[ux > 0 ? 1 : 3].push({ k, which, at: uy * sx }); else faces[uy > 0 ? 2 : 0].push({ k, which, at: ux * sy });
            });
            faces.forEach((f, fi) => {
              if (f.length < 2) return; f.sort((a, b) => a.at - b.at);
              const half = (fi % 2 ? hh : hw) - 3, gap = Math.min(o.portGap, 2 * half / (f.length - 1 || 1));
              let clash = false; for (let i = 1; i < f.length; i++) if (f[i].at - f[i - 1].at < gap - 0.01) clash = true;
              if (!clash) return;
              // keep the order, push apart to the gap, then centre the run on where the ends wanted to be, inside the side
              const want = f.map((x) => x.at), at = want.slice(); for (let i = 1; i < at.length; i++) at[i] = Math.max(at[i], at[i - 1] + gap);
              const shift = (want.reduce((s, x) => s + x, 0) - at.reduce((s, x) => s + x, 0)) / at.length; for (let i = 0; i < at.length; i++) at[i] += shift;
              const lo = -half - at[0], hi = half - at[at.length - 1]; const sh = lo > 0 ? lo : hi < 0 ? hi : 0; for (let i = 0; i < at.length; i++) at[i] = Math.max(-half, Math.min(half, at[i] + sh));
              // kept only if these links get no more crossings or links through classes than before
              const ks = new Set(f.map((x) => x.k)), before = [...ks].reduce((s, k) => s + costOf(k, PL[k], BB[k], ks), 0), old = f.map((x) => R[x.k].ports && R[x.k].ports.slice());
              f.forEach((x, i) => { const p = fi === 0 ? { x: at[i], y: -hh } : fi === 2 ? { x: at[i], y: hh } : fi === 1 ? { x: hw, y: at[i] } : { x: -hw, y: at[i] };
                if (!R[x.k].ports) R[x.k].ports = [null, null]; R[x.k].ports[x.which] = p; });
              const NP = new Map([...ks].map((k) => { const pl = _ogRoutePoly(P[E[k].s], P[E[k].t], R[k], o.samples); return [k, [pl, _ogPolyBox(pl)]]; }));
              const after = [...ks].reduce((s, k) => s + costOf(k, NP.get(k)[0], NP.get(k)[1], ks), 0);
              if (after > before + 0.01) { f.forEach((x, i) => (R[x.k].ports = old[i])); return; }
              NP.forEach(([pl, bb], k) => { PL[k] = pl; BB[k] = bb; }); stats.ported += f.length;
            });
          }
        }
        lap("ports");
        // 5. names: on the path or just beside it (touching it, on either side), where they cover no class and no other name,
        //    and as few links as possible; on the path wins a tie
        if (o.labels) {
          const H = o.labelH, placed = [], order = E.map((e, k) => k).filter((k) => E[k].lab > 0).sort((a, b) => E[b].lab - E[a].lab);
          const at = (pl, f) => { const L = _ogPolyLen(pl) * f; let s = 0; for (let i = 1; i < pl.length; i++) { const l = Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y); if (s + l >= L) { const u = l ? (L - s) / l : 0; return { x: pl[i - 1].x + u * (pl[i].x - pl[i - 1].x), y: pl[i - 1].y + u * (pl[i].y - pl[i - 1].y) }; } s += l; } return pl[pl.length - 1]; };
          for (const k of order) {
            const w = E[k].lab; let best = null;
            for (const f of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) for (const side of o.labelSide ? [0, 1, -1] : [0]) {
              let c = at(PL[k], f);
              if (side) { const a = at(PL[k], Math.max(0, f - 0.02)), b = at(PL[k], Math.min(1, f + 0.02)), tl = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / tl, ny = (b.x - a.x) / tl, d = Math.abs(nx) * w / 2 + Math.abs(ny) * H / 2 + 2; c = { x: c.x + side * nx * d, y: c.y + side * ny * d }; }
              const bx = { x1: c.x - w / 2, x2: c.x + w / 2, y1: c.y - H / 2, y2: c.y + H / 2 }; let cost = Math.abs(f - 0.5) * 4 + (side ? 0.6 : 0); _ogWorkN[2] += n + placed.length;
              for (let v = 0; v < n; v++) if (Math.abs(P[v].x - c.x) < (N[v].w + w) / 2 + 2 && Math.abs(P[v].y - c.y) < (N[v].h + H) / 2 + 2) cost += 10;
              for (const q of placed) if (bx.x1 < q.x2 + 2 && q.x1 < bx.x2 + 2 && bx.y1 < q.y2 + 1 && q.y1 < bx.y2 + 1) cost += 8;
              for (let g = 0; g < m && cost < (best ? best.cost : Infinity); g++) { if (g === k) continue; const b = BB[g]; if (b.x2 < bx.x1 || b.x1 > bx.x2 || b.y2 < bx.y1 || b.y1 > bx.y2) continue;
                const pl = PL[g]; for (let i = 0; i < pl.length - 1; i++) { const cx = (bx.x1 + bx.x2) / 2, cy = (bx.y1 + bx.y2) / 2; if (_ogClSegBox(pl[i].x - cx, pl[i].y - cy, pl[i + 1].x - cx, pl[i + 1].y - cy, w / 2, H / 2)) { cost += 1.5; break; } } }
              if (!best || cost < best.cost) best = { cost, f, c, bx, side };
            }
            R[k].label = { x: best.c.x, y: best.c.y, w, h: H, at: best.f, side: best.side }; placed.push(best.bx); stats.labels++;
          }
        }
        lap("names"); stats.ms = _ogNow() - t0;
        return { routes: R, stats };
      }
      // The measures on the drawn paths: crossings (each crossing point), sharp crossings, links through classes (box plus pad),
      // links hidden on top of another (parallel links drawn on the same line), link ends meeting a box closer than 4 px to
      // another end, names over a class or another name, names with a link across them, bends.
      function _ogRouteMetrics(pos, items, edges, routes, pad) {
        const P = pos, N = items, n = P.length, E = edges.map(([s, t, w, lab]) => ({ s, t, lab: lab || 0 })), m = E.length, R = routes || E.map(() => null), pd = pad == null ? 9 : pad;
        const PL = E.map((e, k) => (e.s === e.t && !(R[k] && R[k].loop) ? null : _ogRoutePoly(P[e.s], P[e.t], R[k], 8))), BB = PL.map((p) => p && _ogPolyBox(p));
        let cross = 0, sharp = 0, thru = 0, hidden = 0, ends = 0, labelOver = 0, labelCrossed = 0, bends = 0;
        for (let a = 0; a < m; a++) { if (!PL[a]) continue; bends += R[a] && R[a].bends ? R[a].bends.length : 0;
          for (let b = a + 1; b < m; b++) { if (!PL[b]) continue; const e = E[a], f = E[b];
            if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) { // shares an end: hidden if it lies on the same line
              if (e.s !== e.t && f.s !== f.t && Math.min(e.s, e.t) === Math.min(f.s, f.t) && Math.max(e.s, e.t) === Math.max(f.s, f.t)) {
                const q = PL[b], p = PL[a], mp = p[p.length >> 1], mq = q[q.length >> 1], same = (p.length === 2 && q.length === 2) || Math.hypot(mp.x - mq.x, mp.y - mq.y) < 4; if (same) hidden++; }
              continue; }
            const [c, s] = _ogPolyCross(PL[a], PL[b], BB[a], BB[b]); cross += c; sharp += s; }
          for (let v = 0; v < n; v++) if (v !== E[a].s && v !== E[a].t && _ogPolyThru(PL[a], BB[a], P, N, v, pd)) thru++;
        }
        // where each link meets each end's box
        const meet = Array.from({ length: n }, () => []);
        E.forEach((e, k) => { if (!PL[k] || e.s === e.t) return; for (const [v, seq] of [[e.s, PL[k]], [e.t, PL[k].slice().reverse()]]) {
          const c = P[v], hw = N[v].w / 2, hh = N[v].h / 2, i = seq.findIndex((q) => Math.abs(q.x - c.x) > hw || Math.abs(q.y - c.y) > hh); if (i <= 0) { meet[v].push(seq[0]); continue; }
          const a = seq[i - 1], b = seq[i]; let lo = 0, hi = 1; for (let it = 0; it < 20; it++) { const md = (lo + hi) / 2, x = a.x + md * (b.x - a.x), y = a.y + md * (b.y - a.y); if (Math.abs(x - c.x) > hw || Math.abs(y - c.y) > hh) hi = md; else lo = md; }
          meet[v].push({ x: a.x + hi * (b.x - a.x), y: a.y + hi * (b.y - a.y) }); } });
        meet.forEach((l) => { for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) if (Math.hypot(l[i].x - l[j].x, l[i].y - l[j].y) < 4) ends++; });
        const L = R.map((r, k) => (r && r.label ? { k, x1: r.label.x - r.label.w / 2, x2: r.label.x + r.label.w / 2, y1: r.label.y - r.label.h / 2, y2: r.label.y + r.label.h / 2 } : null)).filter(Boolean);
        L.forEach((q, i) => {
          for (let v = 0; v < n; v++) if (q.x1 < P[v].x + N[v].w / 2 && P[v].x - N[v].w / 2 < q.x2 && q.y1 < P[v].y + N[v].h / 2 && P[v].y - N[v].h / 2 < q.y2) labelOver++;
          for (let j = i + 1; j < L.length; j++) { const r = L[j]; if (q.x1 < r.x2 && r.x1 < q.x2 && q.y1 < r.y2 && r.y1 < q.y2) labelOver++; }
          const cx = (q.x1 + q.x2) / 2, cy = (q.y1 + q.y2) / 2, hw = (q.x2 - q.x1) / 2, hh = (q.y2 - q.y1) / 2;
          for (let g = 0; g < m; g++) { if (g === q.k || !PL[g]) continue; const pl = PL[g]; for (let i2 = 0; i2 < pl.length - 1; i2++) if (_ogClSegBox(pl[i2].x - cx, pl[i2].y - cy, pl[i2 + 1].x - cx, pl[i2 + 1].y - cy, hw, hh)) { labelCrossed++; break; } }
        });
        let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18, boxA = 0;
        P.forEach((p, i) => { x1 = Math.min(x1, p.x - N[i].w / 2); x2 = Math.max(x2, p.x + N[i].w / 2); y1 = Math.min(y1, p.y - N[i].h / 2); y2 = Math.max(y2, p.y + N[i].h / 2); boxA += (N[i].w + 16) * (N[i].h + 12); });
        PL.forEach((pl) => pl && pl.forEach((p) => { x1 = Math.min(x1, p.x); x2 = Math.max(x2, p.x); y1 = Math.min(y1, p.y); y2 = Math.max(y2, p.y); }));
        L.forEach((q) => { x1 = Math.min(x1, q.x1); x2 = Math.max(x2, q.x2); y1 = Math.min(y1, q.y1); y2 = Math.max(y2, q.y2); });
        return { cross, sharp, thru, hidden, ends, labelOver, labelCrossed, bends, area: (x2 - x1) * (y2 - y1) / boxA };
      }
      // ── end of the link routing ──
      // ── Drawing helpers and public entry points ──
      // Groups of closely linked classes (Louvain modularity, groups under 4 classes merged into their best-linked neighbor),
      // numbered 0, 1, 2… in order of first appearance: the groups Mycelium keeps together and the pull-in slides, for a
      // renderer that draws hulls or background areas round related classes. Same input, same groups.
      function _ogGroups(n, edges) {
        const E3 = edges.filter((e) => e[0] !== e[1]).map((e) => [e[0], e[1], 1]), com = E3.length ? _ogClMergeSmall(_ogClLouvain(n, E3), E3, 4) : [...Array(n).keys()];
        const id = new Map(); return com.map((c) => { if (!id.has(c)) id.set(c, id.size); return id.get(c); });
      }
      // Each route as points ready to draw: from the border of the start box to the border of the end box (the routes run
      // between centers or ports). arrow > 0: the path stops that many px short of the end box along its last direction, so
      // an arrowhead of that length drawn from the path's end to `tip` touches the border without entering the box; `angle`
      // (radians) is the arrowhead's direction. Boxes that overlap give the straight line between centers.
      // -> [{ points: [{x, y}], tip: {x, y}, angle }], one per edge.
      function _ogRoutePaths(pos, items, edges, routes, opts) {
        const o = { arrow: 0, samples: 8, ...(opts || {}) };
        const inside = (p, c, it) => Math.abs(p.x - c.x) <= it.w / 2 + 1e-6 && Math.abs(p.y - c.y) <= it.h / 2 + 1e-6;
        const leave = (a, b, c, it) => { // a inside the box, b outside: where a-b crosses the border
          let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (inside({ x: a.x + (b.x - a.x) * m, y: a.y + (b.y - a.y) * m }, c, it)) lo = m; else hi = m; }
          return { x: a.x + (b.x - a.x) * hi, y: a.y + (b.y - a.y) * hi }; };
        return edges.map(([s, t], k) => {
          const A = pos[s], B = pos[t], r = routes ? routes[k] : null; let pl = _ogRoutePoly(A, B, r, o.samples), i = 0;
          while (i < pl.length - 1 && inside(pl[i + 1], A, items[s])) i++;
          if (i < pl.length - 1 && inside(pl[i], A, items[s])) pl = [leave(pl[i], pl[i + 1], A, items[s]), ...pl.slice(i + 1)];
          let j = pl.length - 1; while (j > 0 && inside(pl[j - 1], B, items[t])) j--;
          if (j > 0 && inside(pl[j], B, items[t])) pl = [...pl.slice(0, j), leave(pl[j], pl[j - 1], B, items[t])];
          if (pl.length < 2 || inside(pl[0], B, items[t]) && s !== t) pl = [{ x: A.x, y: A.y }, { x: B.x, y: B.y }];
          const tip = pl[pl.length - 1]; let rem = Math.min(o.arrow, _ogPolyLen(pl) / 2);
          if (rem > 0) for (let q = pl.length - 1; q > 0; q--) {
            const a = pl[q - 1], b = pl[q], l = Math.hypot(b.x - a.x, b.y - a.y);
            if (l >= rem) { pl = [...pl.slice(0, q), { x: b.x - (b.x - a.x) * rem / l, y: b.y - (b.y - a.y) * rem / l }]; break; }
            rem -= l; }
          const e = pl[pl.length - 1], f = rem > 0 ? e : pl[pl.length - 2];
          return { points: pl, tip, angle: Math.atan2(tip.y - f.y, tip.x - f.x) };
        });
      }
      // The whole pipeline in one call: Best Read, the clean-up, the link routing, the groups and the paths to draw.
      // boxes [{w, h}] as drawn; links [[s, t, kind, nameWidth?]] (kind 2 for a subclass link, 1 otherwise);
      // opts: { seed, roomy, arrow (px, 0 = no arrowheads), route: options for _ogRouteLinks }.
      // -> { pos, routes, paths, groups, algo }. pos is the final position of every class: the link routing may push a class
      // off a link (settle), so draw the classes at pos, never at the layout's positions, or the paths will miss them.
      function _ogDraw(boxes, links, opts) {
        const o = opts || {}, t0 = _ogNow();
        // The placement sees each pair of linked classes once (the widest name and a subclass link win); the routing draws every
        // link. A model browsed as data can repeat a link between two classes a dozen times, which costs the placement time
        // and tells it nothing more.
        const pairAt = new Map(), lay1 = [];
        for (const e of links) { const k = Math.min(e[0], e[1]) + "," + Math.max(e[0], e[1]), j = pairAt.get(k);
          if (j == null) { pairAt.set(k, lay1.length); lay1.push(e.slice()); continue; }
          const f = lay1[j]; if ((e[3] || 0) > (f[3] || 0)) f[3] = e[3]; if (e[2] === 2) f[2] = 2; }
        const layLinks = lay1.length < links.length ? lay1 : links;
        // keep: an earlier drawing's positions (null for new classes). The new classes are placed round the old ones, then the
        // clean-up and the routing make local moves (old classes move a few percent of the drawing, a redraw about a third).
        // exact: true keeps every old class exactly where it was (no clean-up, the routing moves no class).
        const ex = o.keep && o.exact, lay = o.keep ? { pos: _ogClocked(() => _ogPlaceNew(o.keep, boxes, layLinks)), algo: "keep" }
          : boxes.length < 2 ? { pos: boxes.map(() => ({ x: 0, y: 0 })), algo: "single" } // the layouts need two classes; an exploration starts from one
          : _ogAutoLayout(boxes, layLinks, { seed: o.seed, roomy: o.roomy });
        const clean = ex ? lay.pos : _ogLayoutCleanUp(lay.pos, boxes, layLinks, t0, lay.algo === "tree");
        const rr = _ogRouteLinks(clean, boxes, links, ex ? { settle: false, ...(o.route || {}) } : o.route);
        return { pos: rr.pos, routes: rr.routes, paths: _ogRoutePaths(rr.pos, boxes, links, rr.routes, { arrow: o.arrow || 0 }), groups: _ogGroups(boxes.length, links), algo: lay.algo };
      }
      // Loaded as a script, this is the library's one global; as a module, import it (see README, "Using the code").
      const OntologyLayouts = {
        draw: _ogDraw,                 // (boxes, links, { arrow, seed, keep, exact, route }) -> { pos, routes, paths, groups, algo }: everything below in one call
        placeNew: _ogPlaceNew,         // (keep, boxes, links) -> [{x, y}]: classes in keep stay, the others (null) are placed round them
        inline: _ogInline,             // (pos, boxes, links) -> [{x, y}]: boxes with between: [a, b] onto the line from a to b (cleanUp does this)
        bestRead: _ogAutoLayout,       // (boxes, links, { seed, roomy }) -> { pos, algo, ... }: the more readable of the two
        tidyStress: _ogCompactLayout,  // same
        mycelium: _ogGroupedLayout,    // same, or null for fewer than 8 classes
        cleanUp: _ogLayoutCleanUp,     // (pos, boxes, links, startedAt) -> [{x, y}]; startedAt: now() read before the layout
        routeLinks: _ogRouteLinks,     // (pos, boxes, links, opts) -> { routes, pos, stats }: draw the classes at the returned pos
        routePaths: _ogRoutePaths,     // (pos, boxes, links, routes, { arrow }) -> [{ points, tip, angle }]
        groups: _ogGroups,             // (n, links) -> a group number per class
        routeMetrics: _ogRouteMetrics, // (pos, boxes, links, routes, pad = 9) -> { cross, thru, sharp, labelOver, labelCrossed, bends, area, ... }
        metrics: _ogPlacementMetrics,  // (pos, boxes, links as [{s, t}]) -> straight-line measures with a 3 px margin, as ranked
        score: _ogPlacementScore,      // (metrics) -> number, lower is more readable
        setTimeLimit: _ogSetTimeLimit, // (ms) -> previous limit; default 1500, on the work clock
        now: _ogNow                    // () -> ms on the work clock
      };
      // ── end of the layouts ──
