      // ── OG: Layout geometry helpers (Compact, Grouped and Auto layouts, below) ──
      // Seeded random numbers, segment crossings and distances, crossing counts, groups of closely linked classes (Louvain modularity),
      // and pushing boxes apart. Pure geometry, no Cytoscape.
      function _ogClRng(seed) { let a = seed | 0; return function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
      function _ogClSegX(a, b, c, d) {
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
          if (_ogClSegX(P[e.s], P[e.t], P[f.s], P[f.t])) x++;
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
      // Groups smaller than minSize join the neighbouring group they are most connected to.
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
      function _ogClSeparate(P, N, pad, iters) {
        const n = P.length;
        for (let it = 0; it < iters; it++) {
          let moved = false;
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
            const ox = (N[i].w + N[j].w) / 2 + pad - Math.abs(P[i].x - P[j].x); if (ox <= 0) continue;
            const oy = (N[i].h + N[j].h) / 2 + pad - Math.abs(P[i].y - P[j].y); if (oy <= 0) continue;
            moved = true;
            if (ox < oy) { const d = (P[i].x <= P[j].x ? 1 : -1) * (ox / 2 + 0.5); P[i].x -= d; P[j].x += d; }
            else { const d = (P[i].y <= P[j].y ? 1 : -1) * (oy / 2 + 0.5); P[i].y -= d; P[j].y += d; }
          }
          if (!moved) break;
        }
      }
      // Does the segment (ax,ay)-(bx,by), given relative to a box's centre, touch the box of half-sizes hw, hh?
      function _ogClSegBox(ax, ay, bx, by, hw, hh) {
        let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
        const clip = (p, q) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
        return clip(-dx, ax + hw) && clip(dx, hw - ax) && clip(-dy, ay + hh) && clip(dy, hh - ay);
      }
      function _ogClFree(P, N, v, p, gap) {
        for (let u = 0; u < P.length; u++) if (u !== v && Math.abs(P[u].x - p.x) < (N[u].w + N[v].w) / 2 + gap && Math.abs(P[u].y - p.y) < (N[u].h + N[v].h) / 2 + gap) return false;
        return true;
      }
      function _ogClIncidence(n, EE) { const inc = Array.from({ length: n }, () => []); EE.forEach((e, k) => { inc[e.s].push(k); inc[e.t].push(k); }); return inc; }
      // Crossings among a set of links (indexes) and every other link.
      function _ogClCrossSet(P, EE, ks) {
        const set = new Set(ks); let c = 0;
        for (const k of set) {
          const e = EE[k];
          for (let j = 0; j < EE.length; j++) {
            if (j === k || (set.has(j) && j < k)) continue;
            const f = EE[j]; if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue;
            if (_ogClSegX(P[e.s], P[e.t], P[f.s], P[f.t])) c++;
          }
        }
        return c;
      }
      // Swap two classes, or move one beside a neighbour, when the number of crossed links drops and nothing overlaps.
      function _ogClFinCross(P, N, EE, budgetMs, seed) {
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
              const pv = P[v], pu = P[u]; P[v] = pu; P[u] = pv; const after = _ogClCrossSet(P, EE, ks); P[v] = pv; P[u] = pu;
              if (after < before && (!best || after - before < best.d)) best = { kind: "swap", u, d: after - before, c: after };
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
      }
      // Links through class v (its box padded by pad), and v's own links through other classes.
      function _ogClThruCount(P, N, EE, inc, v, pad) {
        let c = 0;
        for (const e of EE) { if (e.s === v || e.t === v) continue; if (_ogClSegBox(P[e.s].x - P[v].x, P[e.s].y - P[v].y, P[e.t].x - P[v].x, P[e.t].y - P[v].y, N[v].w / 2 + pad, N[v].h / 2 + pad)) c++; }
        inc[v].forEach((k) => { const e = EE[k]; for (let u = 0; u < P.length; u++) { if (u === e.s || u === e.t) continue; if (_ogClSegBox(P[e.s].x - P[u].x, P[e.s].y - P[u].y, P[e.t].x - P[u].x, P[e.t].y - P[u].y, N[u].w / 2 + pad, N[u].h / 2 + pad)) c++; } });
        return c;
      }
      // Move classes off links that run through them, never adding a crossing.
      function _ogClFinThru(P, N, EE, rounds, pad, budgetMs) {
        const n = P.length, inc = _ogClIncidence(n, EE), t0 = performance.now();
        for (let r = 0; r < rounds; r++) {
          let moved = false;
          for (let v = 0; v < n; v++) {
            if (performance.now() - t0 > budgetMs) return;
            const b0 = _ogClThruCount(P, N, EE, inc, v, pad); if (!b0) continue;
            const x0 = _ogClCrossSet(P, EE, inc[v]), keep = P[v]; let best = null;
            for (let a = 0; a < 16; a++) for (const d of [20, 45, 80, 120, 170, 230]) {
              const c = { x: keep.x + Math.cos(a * Math.PI / 8) * d, y: keep.y + Math.sin(a * Math.PI / 8) * d };
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
      // Shorten long links: pull each class toward its neighbours when the total length of its links drops and nothing gets worse
      // (no overlap, no new crossing, no new link through a class); then shrink the drawing evenly as far as the boxes allow.
      function _ogClFinTight(P, N, EE, rounds, gap, budgetMs) {
        const n = P.length, inc = _ogClIncidence(n, EE), t0 = performance.now();
        const len = (v) => { let s = 0; inc[v].forEach((k) => { const e = EE[k]; s += Math.hypot(P[e.s].x - P[e.t].x, P[e.s].y - P[e.t].y); }); return s; };
        for (let r = 0; r < rounds; r++) {
          let moved = false;
          const order = [...Array(n).keys()].sort((a, b) => len(b) - len(a));
          for (const v of order) {
            if (!inc[v].length) continue;
            if (performance.now() - t0 > budgetMs) return;
            const l0 = len(v), x0 = _ogClCrossSet(P, EE, inc[v]), h0 = _ogClThruCount(P, N, EE, inc, v, 8), keep = P[v], cands = [];
            const nb = inc[v].map((k) => (EE[k].s === v ? EE[k].t : EE[k].s)), cx = nb.reduce((s, u) => s + P[u].x, 0) / nb.length, cy = nb.reduce((s, u) => s + P[u].y, 0) / nb.length;
            for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) { cands.push({ x: keep.x + (cx - keep.x) * f, y: keep.y + (cy - keep.y) * f }); nb.forEach((u) => cands.push({ x: keep.x + (P[u].x - keep.x) * f, y: keep.y + (P[u].y - keep.y) * f })); }
            let best = null;
            for (const c of cands) {
              if (!_ogClFree(P, N, v, c, gap)) continue;
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
          const old = P.map((p) => ({ x: p.x, y: p.y }));
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
      //    a class with many links gets a ring wide enough for its neighbours; one-link classes placed afterwards. Best for large or
      //    hub-heavy models.
      //  - Auto: runs the variants that suit the size and keeps the best score.
      // Pure geometry, no Cytoscape: items [{w, h}], edges [[i, j, weight, labelWidth?]] (subclass links weight 2). Results { pos, crossings }.
      function _ogClPaths(m, adj) {
        // all-pairs shortest path lengths (Dijkstra with a binary heap); unreachable pairs get a distance a little beyond the longest one
        const D = Array.from({ length: m }, () => new Float64Array(m).fill(Infinity));
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
        const k = Math.min(n, 60), piv = [Math.min(n - 1, Math.floor(rnd() * n))], mind = new Float64Array(n).fill(Infinity);
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
      // Stress majorization: each pair of classes pulled toward its target distance D, near pairs weighted most (1/d²).
      function _ogClStress(P, D, iters, rnd) {
        const n = P.length;
        for (let it = 0; it < iters; it++) {
          let moved = 0;
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
      // Classes linked to one other class only (two links to the same class count as one), whose neighbour has other links
      // (a pair of classes linked only to each other stays together).
      function _ogClLeaves(n, EE) {
        const nb = Array.from({ length: n }, () => new Set()); EE.forEach((e) => { nb[e.s].add(e.t); nb[e.t].add(e.s); });
        const deg = nb.map((x) => x.size);
        const leafOf = new Array(n).fill(-1);
        EE.forEach((e) => { if (deg[e.s] === 1 && deg[e.t] > 1) leafOf[e.s] = e.t; else if (deg[e.t] === 1 && deg[e.s] > 1) leafOf[e.t] = e.s; });
        return leafOf;
      }
      // Put one-link classes beside their neighbour, in the direction where the new link crosses nothing and no link runs through the class,
      // at least gapOf[v] px from the neighbour's box (room for the link's text). improve: every class is placed already; move one only
      // when the new spot is better than where it is.
      function _ogClPlaceLeaves(P, N, EE, leafOf, gapOf, L, gap, improve, deadline) {
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
        const t0 = performance.now(), budget = cfg.budget || 1500, left = () => Math.max(20, budget - (performance.now() - t0));
        const leafAll = _ogClLeaves(n, EE), leafOf = cfg.leaves ? leafAll : new Array(n).fill(-1);
        // room beside a one-link class: at least 40 px, more when its link carries text
        const gapOf = new Array(n).fill(40 * sc); EE.forEach((e) => { [e.s, e.t].forEach((v) => { if (leafAll[v] >= 0) gapOf[v] = Math.max(gapOf[v], e.lab + 16); }); });
        const core = [...Array(n).keys()].filter((v) => leafOf[v] < 0), ci = new Map(core.map((v, k) => [v, k])), m = core.length;
        const nb = Array.from({ length: n }, () => new Set()); EE.forEach((e) => { nb[e.s].add(e.t); nb[e.t].add(e.s); });
        // a class with k links needs a ring of radius about k × (box width + gap) / 2π to hold its neighbours side by side
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
        const NC = core.map((v) => N[v]), EC = EE.filter((e) => ci.has(e.s) && ci.has(e.t)).map((e) => ({ s: ci.get(e.s), t: ci.get(e.t) }));
        const restarts = cfg.restarts != null ? cfg.restarts : (m <= 30 ? 8 : m <= 80 ? 4 : 2), countX = EC.length <= 2500;
        let best = null;
        for (let r = 0; r < Math.max(1, restarts) && (r === 0 || performance.now() - t0 < budget * 0.4); r++) {
          const PC = cfg.init === "pmds" && r === 0 && m > 2 ? _ogClPivotMDS(D, m, rnd) : NC.map(() => ({ x: (rnd() - 0.5) * 400, y: (rnd() - 0.5) * 400 }));
          _ogClStress(PC, D, 120, rnd); _ogClSeparate(PC, NC, 12, 120);
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
          for (let pass = 0; pass < 2 && (n <= 300 || performance.now() < deadline + budget / 4); pass++) {
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
        const t0 = performance.now(), scores = {}; let best = null;
        list.forEach((cfg, k) => {
          const spent = performance.now() - t0; if (k && spent > total) return;
          let r = null; try { r = _ogStressLayout(items, edges, { ...cfg, budget: Math.max(150, (total - spent) / (list.length - k)) }, o); } catch (err) { r = null; }
          if (!r) return;
          const P = r.pos.map((p) => ({ x: p.x, y: p.y })); _ogClSeparate(P, N, 6, 40);
          const s = _ogPlacementScore(_ogPlacementMetrics(P, N, EE)), fam = cfg.family;
          if (scores[fam] === undefined || s < scores[fam]) scores[fam] = s;
          if (!best || s < best.score) best = { score: s, pos: r.pos, crossings: r.crossings, algo: fam, variant: cfg.name };
        });
        return best && { pos: best.pos, crossings: best.crossings, algo: best.algo, variant: best.variant, scores };
      }
      const _ogV = (k, extra) => ({ ..._OG_VARIANTS[k], name: k, ...(extra || {}) });
      // Small models are cheap, so several variants are tried; larger ones give the whole time to fewer (sharing it starves the clean-up).
      const _ogCompactVariants = (n) => n <= 30 ? [_ogV("mds"), _ogV("stress"), _ogV("hubs"), _ogV("leaves")] : n <= 60 ? [_ogV("mds"), _ogV("stress"), _ogV("leaves")] : [_ogV("mds")];
      function _ogCompactLayout(items, edges, opts) {
        const n = items.length;
        return _ogBestOf(items, edges, opts, _ogCompactVariants(n), (opts && opts.budgetMs) || 1500);
      }
      // Grouped needs enough classes to form groups; smaller models go to the force layout.
      function _ogGroupedLayout(items, edges, opts) {
        const n = items.length; if (n < 8 || !edges.length) return null;
        return _ogBestOf(items, edges, opts, [_ogV("groups", { L: n >= 100 ? 260 : 170 })], (opts && opts.budgetMs) || 1000);
      }
      // How good a placement is, for choosing among layouts: crossed links, links through classes, near-touching links, touching classes,
      // mean link length, links much longer than the typical link, and the area taken per unit of class area.
      // P: [{x, y}], N: [{w, h}], EE: [{s, t}].
      function _ogPlacementMetrics(P, N, EE) {
        const n = P.length; let near = 0, thru = 0, ov = 0, len = 0, boxArea = 0;
        const cross = EE.length <= 2500 ? _ogClCrossings(P, EE) : 0;
        if (EE.length <= 1500) for (let i = 0; i < EE.length; i++) for (let j = i + 1; j < EE.length; j++) {
          const e = EE[i], f = EE[j]; if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue;
          if (_ogClDSS(P[e.s], P[e.t], P[f.s], P[f.t]) < 30) near++;
        }
        const lens = [];
        for (const e of EE) { const l = Math.hypot(P[e.s].x - P[e.t].x, P[e.s].y - P[e.t].y); len += l; lens.push(l); for (let i = 0; i < n; i++) { if (i === e.s || i === e.t) continue; if (_ogClSegBox(P[e.s].x - P[i].x, P[e.s].y - P[i].y, P[e.t].x - P[i].x, P[e.t].y - P[i].y, N[i].w / 2 + 6, N[i].h / 2 + 6)) thru++; } }
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
        return 10 * m.cross + 8 * m.thru + 2 * m.near + 40 * m.ov + m.len / 10 + Math.max(0, m.len - 350) / 2 + Math.max(0, (m.fill || 0) - 8) * 4 * Math.sqrt(m.n || 1) + 25 * (m.lout || 0);
      }
      // Automatic choice: the variants that suit the size, best score kept. Returns { pos, crossings, algo, scores } or null.
      function _ogAutoLayout(items, edges, opts) {
        // dense models (more than two links per class) give their time to fewer variants, or the clean-up of each is starved
        const n = items.length, dense = n > 30 && edges.length > 2 * n, list = n > 100 ? [] : dense ? [_ogV("mds")] : _ogCompactVariants(n);
        if (n >= 8) list.push(_ogV("groups", { L: n >= 100 ? 260 : 170 }));
        if (!list.length) list.push(_ogV("mds"));
        return _ogBestOf(items, edges, opts, list, (opts && opts.budgetMs) || (n <= 30 ? 1500 : n <= 100 ? 2200 : 1000));
      }
      // ── end of the layouts ──
