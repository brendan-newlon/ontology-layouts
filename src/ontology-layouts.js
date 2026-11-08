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
      const _ogClk = { depth: 0, v0: 0, w0: 0, lag: 0 };
      function _ogWorkMs() { let s = _ogClk.lag; for (let i = 0; i < 7; i++) s += _ogWorkN[i] * _OG_WORK_NS[i] / 1e6; return s; }
      function _ogNow() {
        const v = _ogWorkMs(); if (!_ogClk.depth) return v;
        const w = _ogClk.v0 + (performance.now() - _ogClk.w0) / _OG_WALL_CAP; return w > v ? w : v;
      }
      // Runs fn as one timed run (nested calls join the outer run); afterwards the clock never runs backwards.
      function _ogClocked(fn) {
        if (_ogClk.depth++ === 0) { _ogClk.v0 = _ogWorkMs(); _ogClk.w0 = performance.now(); }
        try { return fn(); } finally { const end = _ogNow(); if (--_ogClk.depth === 0) { const v = _ogWorkMs(); if (end > v) _ogClk.lag += end - v; } }
      }
      // ── end of the work clock ──
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
            if (best) { if (best.kind === "swap") { const pv = P[v]; P[v] = P[best.u]; P[best.u] = pv; } else P[v] = best.c2; improved = true; }
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
            if (best) { P[v] = best.c; moved = true; }
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
            if (best) { P[v] = best.c; moved = true; }
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
        // classes than starting at the matching size.
        let mx = 0, my = 0; P.forEach((p) => { mx += p.x / n; my += p.y / n; }); P.forEach((p) => { p.x -= mx; p.y -= my; });
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) for (const p of piv) { const d = Math.hypot(P[i].x - P[p].x, P[i].y - P[p].y); if (isFinite(D[i][p])) { num += D[i][p] * d; den += d * d; } }
        const s = (den > 0 ? num / den : 1) * 5; P.forEach((p) => { p.x *= s; p.y *= s; });
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
      function _ogClPlaceLeaves(P, N, EE, leafOf, gapOf, L, gap, improve, deadline) {
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
          const R = nl.map((k) => cfg.halo * Math.sqrt(k) * L / Math.PI);
          for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) if (i !== j) D[i][j] += R[i] + R[j];
        }
        const NC = core.map((v) => N[v]), EC = EE.filter((e) => ci.has(e.s) && ci.has(e.t)).map((e) => ({ s: ci.get(e.s), t: ci.get(e.t) }));
        const restarts = cfg.restarts != null ? cfg.restarts : (m <= 30 ? 8 : m <= 80 ? 4 : 2), countX = EC.length <= 2500;
        let best = null;
        for (let r = 0; r < Math.max(1, restarts) && (r === 0 || _ogNow() - t0 < budget * 0.4); r++) {
          const PC = cfg.init === "pmds" && r === 0 && m > 2 ? _ogClPivotMDS(D, m, rnd) : NC.map(() => ({ x: (rnd() - 0.5) * 400, y: (rnd() - 0.5) * 400 }));
          _ogClStress(PC, D, cfg.sweeps || 120, rnd, t0 + budget * 0.4); _ogClSeparate(PC, NC, 12, 120);
          const x = countX ? _ogClCrossings(PC, EC) : 0; if (!best || x < best.x) best = { x, P: PC };
        }
        const PC = best.P;
        if (countX && EC.length) {
          _ogClFinCross(PC, NC, EC, Math.min(m <= 30 ? 150 : 300, left() / 3), seed); _ogClSeparate(PC, NC, 12, 120);
          _ogClFinThru(PC, NC, EC, 12, 10, left() / 3); _ogClFinTight(PC, NC, EC, 12, 26 * sc, left() / 2); _ogClFinThru(PC, NC, EC, 8, 10, left() / 2);
        } else if (EC.length) _ogClFinTight(PC, NC, EC, 6, 26 * sc, left() / 2);
        const P = new Array(n); core.forEach((v, k) => (P[v] = PC[k]));
        for (let v = 0; v < n; v++) if (!P[v]) P[v] = { x: 0, y: 0 };
        const deadline = t0 + budget;
        if (cfg.leaves) {
          _ogClPlaceLeaves(P, N, EE, leafOf, gapOf, L, 10, false, deadline);
          _ogClFinThru(P, N, EE, 6, 10, left() / 2); _ogClFinTight(P, N, EE, 6, 26 * sc, left());
        }
        if (cfg.leaves || cfg.leafFix) {
          // clean-up may have pulled a one-link class closer than its room allows, or a better spot may be free now
          const short = leafAll.map((p, v) => p >= 0 && Math.max(Math.abs(P[v].x - P[p].x) - (N[v].w + N[p].w) / 2, Math.abs(P[v].y - P[p].y) - (N[v].h + N[p].h) / 2) < gapOf[v] - 0.5 ? p : -1);
          if (short.some((p) => p >= 0)) _ogClPlaceLeaves(P, N, EE, short, gapOf, L, 10, false, deadline);
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
            _ogClPlaceLeaves(P, N, EE, bad, gapOf, L, 10, false, deadline);
          }
          if (cfg.leafFix) _ogClPlaceLeaves(P, N, EE, leafAll, gapOf, L, 10, true, deadline);
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
          const s = _ogChoiceScore(_ogPlacementMetrics(P, N, EE)), fam = cfg.family;
          if (scores[fam] === undefined || s < scores[fam]) scores[fam] = s;
          if (!best || s < best.score) best = { score: s, pos: P, crossings: r.crossings, algo: fam, variant: cfg.name };
        });
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
      // When most links are subclass links, the top-down tree is tried too and kept if it costs nothing: no crossing, no link
      // through a class, and at most 1.5 times the area of the best other drawing (algo "tree"; its clean-up keeps it top-down).
      function _ogAutoLayout(items, edges, opts) {
        // dense models (more than two links per class) give their time to fewer variants, or the clean-up of each is starved.
        // The time limits leave the clean-up after the layout its share of 1.5 s (0.9 s up to 100 classes, 0.6 s above).
        const n = items.length, dense = n > 30 && edges.length > 2 * n, list = n > 100 ? [] : dense ? [_ogV("mds")] : _ogCompactVariants(n);
        if (n >= 8) list.push(_ogV("groups", { L: n >= 100 ? 260 : 170 }));
        if (!list.length) list.push(_ogV("mds"));
        return _ogClocked(() => {
          const best = _ogBestOf(items, edges, opts, list, (opts && opts.budgetMs) || (n <= 30 ? 1500 : n <= 100 ? 900 : 600));
          const links = edges.filter(([a, b]) => a !== b), subs = links.filter((e) => e[2] === 2).length;
          if (!best || !links.length || subs < links.length / 2) return best;
          const sc = opts && opts.roomy ? 1.3 : 1, N = items.map((it) => ({ w: it.w + 16 * sc, h: it.h + 12 * sc })), EE = links.map(([a, b]) => ({ s: a, t: b }));
          const T = _ogTreeLayout(items, edges, opts).pos; _ogClSeparate(T, N, 6, 40);
          // links through classes counted against the boxes as drawn (3 px margin, as the benchmark counts them); area on the padded boxes
          // (cheapest test first: a crossing rules the tree out before anything else is measured)
          if (_ogClCrossings(T, EE)) return best;
          const B = items.map((it) => ({ w: it.w + 6, h: it.h + 6 }));
          if (_ogPlacementMetrics(T, B, EE).thru) return best;
          return _ogPlacementMetrics(T, N, EE).fill <= 1.5 * _ogPlacementMetrics(best.pos, N, EE).fill ? { ...best, pos: T, crossings: 0, algo: "tree", variant: "tree" } : best;
        });
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
        const DEF = { budgetMs: 2000, unitSize: 4, clearance: 8, groupDepth: 4, groups: true, spread: true, spreadRepair: true, finish: true, order: ['single', 'unit', 'spread', 'group'], cell: 0.3, repReach: 1.8, repOpen: 12, repCap: 99, crowdMax: 10, groupTop: 2, downGap: 20, W: { cross: 6, sharp: 3, thru: 10, tight: 1, ov: 1000, area: 6 } };

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
        if (budgetMs < 100) return pos;
        const down = topDown ? edges.filter((e) => e[2] === 2 && e[0] !== e[1]).map((e) => [e[0], e[1]]) : null;
        return _ogClocked(() => _ogHandTidy.run(pos, items, edges.map((e) => ({ s: e[0], t: e[1] })), { budgetMs, down }).P);
      }
      // ── end of the clean-up ──
      // ── end of the layouts ──
