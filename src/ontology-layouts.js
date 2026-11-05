      // ── OG: Cluster layout ─────────────
      // Draws the classes as a few tight groups joined by long links, with as few crossed links as it can find:
      //  1. Find groups of closely linked classes (Louvain modularity; subclass links count double; groups under 3 classes join a neighbour).
      //  2. Set aside classes with a single link (and, repeatedly, classes that become single-linked); they come back at the end.
      //  3. Lay each group out alone with springs, then lay the groups out as large nodes: strong repulsion, springs along the links between them.
      //  4. Put each group's classes that link to other groups on a ring, each facing the classes it links to (not the other group's middle),
      //     spaced apart; relax the rest of the group inside, pulled to the side facing away from its neighbours.
      //  5. Push apart the midpoints of links (an imaginary node on each link), slide whole groups to where the links between groups are
      //     straighter and further from classes and from each other, swap classes inside a group when that removes crossings,
      //     push links off classes lying on them (any step that adds a crossing is undone).
      //  6. Put the single-link classes back beside their neighbour in a spot where their one link crosses nothing, then shrink the whole
      //     drawing evenly as far as nothing touches (shrinking evenly cannot change a crossing).
      // Pure geometry, no Cytoscape: items [{w, h}], edges [[i, j, weight]]. Returns { pos: [{x, y}], crossings } or null when the model is
      // too small to form groups (the caller then uses the force layout).
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
      // Spring layout over some nodes (Fruchterman-Reingold style): springs [a, b, length, strength]; o.anchor(i) may return {x, y, k}.
      function _ogClRelax(ids, P, N, springs, o, rnd) {
        const n = ids.length, L = o.L, cut2 = (o.cut || 4 * L) ** 2, K2 = L * L, D = ids.map(() => [0, 0]);
        const pos = new Map(ids.map((g, k) => [g, k]));
        const sp = springs.filter((s) => pos.has(s[0]) && pos.has(s[1])).map((s) => [pos.get(s[0]), pos.get(s[1]), s[2], s[3]]);
        for (let it = 0; it < o.iters; it++) {
          const t = o.t0 * (1 - it / o.iters) + 0.5;
          for (let a = 0; a < n; a++) { D[a][0] = 0; D[a][1] = 0; }
          for (let a = 0; a < n; a++) {
            const pa = P[ids[a]];
            for (let b = a + 1; b < n; b++) {
              const pb = P[ids[b]]; let dx = pa.x - pb.x, dy = pa.y - pb.y, d2 = dx * dx + dy * dy; if (d2 > cut2) continue;
              if (d2 < 1e-4) { dx = rnd() - 0.5; dy = rnd() - 0.5; d2 = dx * dx + dy * dy; }
              const d = Math.sqrt(d2), f = K2 / d / d;
              D[a][0] += dx * f; D[a][1] += dy * f; D[b][0] -= dx * f; D[b][1] -= dy * f;
            }
          }
          sp.forEach(([a, b, len, k]) => {
            const pa = P[ids[a]], pb = P[ids[b]], dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 0.01, f = k * (d - len) / d;
            D[a][0] += dx * f; D[a][1] += dy * f; D[b][0] -= dx * f; D[b][1] -= dy * f;
          });
          for (let a = 0; a < n; a++) {
            const p = P[ids[a]];
            if (o.anchor) { const an = o.anchor(ids[a]); if (an) { D[a][0] += (an.x - p.x) * an.k; D[a][1] += (an.y - p.y) * an.k; } }
            else { D[a][0] -= p.x * (o.grav || 0.01); D[a][1] -= p.y * (o.grav || 0.01); }
            const m = Math.hypot(D[a][0], D[a][1]); if (m > 0) { const s = Math.min(m, t) / m; p.x += D[a][0] * s; p.y += D[a][1] * s; }
          }
        }
      }
      // Crossings among the links in `inc` (each counted once) plus a tiny preference for short links.
      function _ogClIncCost(P, EE, inc, incSet, countOnly) {
        let c = 0, len = 0;
        for (const i of inc) {
          const e = EE[i], pa = P[e.s], pb = P[e.t]; len += Math.hypot(pa.x - pb.x, pa.y - pb.y);
          for (let j = 0; j < EE.length; j++) {
            if (j === i || (j < i && incSet.has(j))) continue; const f = EE[j];
            if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue;
            if (_ogClSegX(pa, pb, P[f.s], P[f.t])) c++;
          }
        }
        return countOnly ? c : c + len * 0.0003;
      }
      // Steps 1, 3, 4 and 5 for the classes that were not set aside. N: [{w, h}], edges [[a, b, weight]].
      function _ogClCore(N, edges, opt, seed) {
        const n = N.length, L = opt.L, rnd = _ogClRng(seed);
        const E = edges.filter((e) => e[0] !== e[1]), EE = E.map((e) => ({ s: e[0], t: e[1] }));
        let com = n > 6 ? _ogClLouvain(n, E) : Array(n).fill(0);
        com = _ogClMergeSmall(com, E, 3);
        const nc = Math.max(...com) + 1, groups = Array.from({ length: nc }, () => []);
        com.forEach((c, i) => groups[c].push(i));
        if (nc < 2) return null;
        const P = N.map(() => ({ x: 0, y: 0 }));
        // Each group on its own, springs inside only
        const intra = E.filter(([a, b]) => com[a] === com[b]).map(([a, b, w]) => [a, b, L * (w > 1 ? 1 : 1.25), 0.35]);
        const R = [];
        groups.forEach((g, c) => {
          const rr = Math.sqrt(g.length) * L * 0.55;
          g.forEach((i, k) => { const a = 2 * Math.PI * k / g.length + rnd(), r = rr * (0.4 + rnd() * 0.6); P[i].x = Math.cos(a) * r; P[i].y = Math.sin(a) * r; });
          _ogClRelax(g, P, N, intra, { L, iters: g.length > 1 ? Math.min(260, 80 + g.length * 6) : 0, t0: L * 0.35, grav: 0.04 }, rnd);
          _ogClSeparate(g.map((i) => P[i]), g.map((i) => N[i]), 22, 40);
          let cx = 0, cy = 0; g.forEach((i) => { cx += P[i].x; cy += P[i].y; }); cx /= g.length; cy /= g.length;
          let r = 0; g.forEach((i) => { P[i].x -= cx; P[i].y -= cy; r = Math.max(r, Math.hypot(P[i].x, P[i].y) + Math.hypot(N[i].w, N[i].h) / 2); });
          R[c] = r + 18;
        });
        // Groups as large nodes: repulsion stronger than anything inside a group (and jumping when two touch), springs along the links between groups
        const link = new Map();
        E.forEach(([a, b]) => { if (com[a] !== com[b]) { const x = Math.min(com[a], com[b]), y = Math.max(com[a], com[b]), k = x + "," + y; link.set(k, (link.get(k) || 0) + 1); } });
        const metaSprings = [...link].map(([k, c]) => { const [x, y] = k.split(",").map(Number); return [x, y, R[x] + R[y] + opt.gap, 0.08 * Math.sqrt(c), c]; });
        let bestC = null, bestE = Infinity;
        for (let rs = 0; rs < (nc <= 12 ? 6 : 3); rs++) {
          const C = groups.map((g, c) => ({ x: Math.cos(2 * Math.PI * c / nc + rs * 1.3 + rnd()) * Math.sqrt(nc) * L * 2, y: Math.sin(2 * Math.PI * c / nc + rs * 1.3 + rnd()) * Math.sqrt(nc) * L * 2 }));
          const iters = 400;
          for (let it = 0; it < iters; it++) {
            const t = L * 2 * (1 - it / iters) + 0.5, D = C.map(() => [0, 0]);
            for (let a = 0; a < nc; a++) for (let b = a + 1; b < nc; b++) {
              const dx = C[a].x - C[b].x, dy = C[a].y - C[b].y, d = Math.hypot(dx, dy) || 0.01, s = R[a] + R[b] + opt.gap * 0.6;
              const mag = opt.metaRep * s * s / d / L * (d < s ? 3 : 1), ux = dx / d, uy = dy / d;
              D[a][0] += ux * mag; D[a][1] += uy * mag; D[b][0] -= ux * mag; D[b][1] -= uy * mag;
            }
            metaSprings.forEach(([a, b, len, k]) => { const dx = C[b].x - C[a].x, dy = C[b].y - C[a].y, d = Math.hypot(dx, dy) || 0.01, f = k * (d - len) / d * (L / 20); D[a][0] += dx * f; D[a][1] += dy * f; D[b][0] -= dx * f; D[b][1] -= dy * f; });
            C.forEach((c, a) => { D[a][0] -= c.x * 0.002 * L / 10; D[a][1] -= c.y * 0.002 * L / 10; const m = Math.hypot(D[a][0], D[a][1]); if (m > 0) { const s = Math.min(m, t) / m; c.x += D[a][0] * s; c.y += D[a][1] * s; } });
          }
          let en = 0; metaSprings.forEach(([a, b, len, , cnt]) => { const d = Math.hypot(C[a].x - C[b].x, C[a].y - C[b].y); en += cnt * Math.abs(d - len); });
          for (let a = 0; a < nc; a++) for (let b = a + 1; b < nc; b++) { if (Math.hypot(C[a].x - C[b].x, C[a].y - C[b].y) < R[a] + R[b]) en += 1e5; }
          if (en < bestE) { bestE = en; bestC = C; }
        }
        // Linked classes on a ring facing their partners; the rest relaxed inside, pulled away from the neighbours
        const ext = Array.from({ length: n }, () => []), extN = Array.from({ length: n }, () => []);
        E.forEach(([a, b]) => { if (com[a] !== com[b]) { ext[a].push(com[b]); ext[b].push(com[a]); extN[a].push(b); extN[b].push(a); } });
        const doGroup = (g, c, useNodes) => {
          const C = bestC[c], gw = g.filter((i) => ext[i].length), inner = g.filter((i) => !ext[i].length), th = {}; let ux = 0, uy = 0;
          gw.forEach((i) => {
            let dx = 0, dy = 0;
            if (useNodes) extN[i].forEach((j) => { const vx = P[j].x - C.x, vy = P[j].y - C.y, d = Math.hypot(vx, vy) || 1; dx += vx / d; dy += vy / d; });
            else ext[i].forEach((o) => { const vx = bestC[o].x - C.x, vy = bestC[o].y - C.y, d = Math.hypot(vx, vy) || 1; dx += vx / d; dy += vy / d; });
            th[i] = Math.atan2(dy, dx); ux += dx; uy += dy;
          });
          const um = Math.hypot(ux, uy) || 1; ux /= um; uy /= um;
          const sumW = gw.reduce((s, i) => s + N[i].w + 12, 0), rho = Math.max(R[c] * 0.85, sumW / (2 * Math.PI) * 1.1);
          const ord = gw.slice().sort((a, b) => th[a] - th[b]), ang = ord.map((i) => th[i]);
          for (let it = 0; it < 80 && ord.length > 1; it++) {
            for (let k = 0; k < ord.length; k++) {
              const j = (k + 1) % ord.length; let gp = ang[j] - ang[k]; if (j === 0) gp += 2 * Math.PI;
              const need = ((N[ord[k]].w + N[ord[j]].w) / 2 + 34) / rho;
              if (gp < need) { const d = (need - gp) / 2; ang[k] -= d; ang[j] += d; }
            }
            ord.forEach((i, k) => { ang[k] += (th[i] - ang[k]) * 0.08; });
          }
          ord.forEach((i, k) => { P[i].x = C.x + Math.cos(ang[k]) * rho; P[i].y = C.y + Math.sin(ang[k]) * rho * 0.85; th[i] = ang[k]; });
          const away = { x: C.x - ux * rho * 0.7, y: C.y - uy * rho * 0.7 };
          inner.forEach((i) => { P[i].x = away.x + (rnd() - 0.5) * rho * 0.6; P[i].y = away.y + (rnd() - 0.5) * rho * 0.6; });
          _ogClRelax(g, P, N, intra, { L, iters: Math.min(220, 100 + g.length * 4), t0: L * 0.2, cut: 3 * L,
            anchor: (i) => ext[i].length ? { x: C.x + Math.cos(th[i]) * rho, y: C.y + Math.sin(th[i]) * rho * 0.85, k: 0.5 } : { x: away.x, y: away.y, k: 0.06 } }, rnd);
          _ogClSeparate(g.map((i) => P[i]), g.map((i) => N[i]), 14, 40);
        };
        for (let rd = 0; rd < 3; rd++) groups.forEach((g, c) => doGroup(g, c, rd > 0));
        // Groups must not overlap: slide whole groups apart until their outlines clear
        const box = (g) => { let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9; g.forEach((i) => { x1 = Math.min(x1, P[i].x - N[i].w / 2); x2 = Math.max(x2, P[i].x + N[i].w / 2); y1 = Math.min(y1, P[i].y - N[i].h / 2); y2 = Math.max(y2, P[i].y + N[i].h / 2); }); return { x1, y1, x2, y2 }; };
        const gap = opt.gap * 0.35 + 20;
        const sepGroups = () => {
          for (let it = 0; it < 120; it++) {
            let moved = false; const B = groups.map(box);
            for (let a = 0; a < nc; a++) for (let b = a + 1; b < nc; b++) {
              const ox = Math.min(B[a].x2, B[b].x2) - Math.max(B[a].x1, B[b].x1) + gap, oy = Math.min(B[a].y2, B[b].y2) - Math.max(B[a].y1, B[b].y1) + gap;
              if (ox <= 0 || oy <= 0) continue; moved = true;
              const ca = { x: (B[a].x1 + B[a].x2) / 2, y: (B[a].y1 + B[a].y2) / 2 }, cb = { x: (B[b].x1 + B[b].x2) / 2, y: (B[b].y1 + B[b].y2) / 2 };
              let dx = 0, dy = 0; if (ox < oy) dx = (ca.x <= cb.x ? 1 : -1) * (ox / 2 + 1); else dy = (ca.y <= cb.y ? 1 : -1) * (oy / 2 + 1);
              groups[a].forEach((i) => { P[i].x -= dx; P[i].y -= dy; }); groups[b].forEach((i) => { P[i].x += dx; P[i].y += dy; });
            }
            if (!moved) break;
          }
        };
        sepGroups();
        const incE = Array.from({ length: n }, () => []); EE.forEach((e, i) => { incE[e.s].push(i); incE[e.t].push(i); });
        const m = EE.length, t0 = performance.now();
        // An imaginary node at the middle of every link; they repel each other and push the link's two ends apart
        if (m <= 2500) {
          const P0 = P.map((p) => ({ x: p.x, y: p.y })), len0 = EE.map((e) => Math.hypot(P[e.s].x - P[e.t].x, P[e.s].y - P[e.t].y));
          const cut2 = (2.2 * L) ** 2, K = L * L, iters = 40, mx = new Float64Array(m), my = new Float64Array(m), Dx = new Float64Array(n), Dy = new Float64Array(n);
          for (let it = 0; it < iters; it++) {
            const t = L * 0.12 * (1 - it / iters) + 0.3; Dx.fill(0); Dy.fill(0);
            for (let k = 0; k < m; k++) { const e = EE[k]; mx[k] = (P[e.s].x + P[e.t].x) / 2; my[k] = (P[e.s].y + P[e.t].y) / 2; }
            for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) {
              const dx = mx[a] - mx[b], dy = my[a] - my[b]; let d2 = dx * dx + dy * dy; if (d2 > cut2) continue; if (d2 < 1) d2 = 1;
              const f = K / d2 * 0.5, ea = EE[a], eb = EE[b];
              Dx[ea.s] += dx * f; Dy[ea.s] += dy * f; Dx[ea.t] += dx * f; Dy[ea.t] += dy * f; Dx[eb.s] -= dx * f; Dy[eb.s] -= dy * f; Dx[eb.t] -= dx * f; Dy[eb.t] -= dy * f;
            }
            for (let k = 0; k < m; k++) { const e = EE[k], pa = P[e.s], pb = P[e.t], dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 0.01, f = 0.4 * (d - len0[k]) / d; Dx[e.s] += dx * f; Dy[e.s] += dy * f; Dx[e.t] -= dx * f; Dy[e.t] -= dy * f; }
            for (let i = 0; i < n; i++) { Dx[i] += (P0[i].x - P[i].x) * 0.03; Dy[i] += (P0[i].y - P[i].y) * 0.03; const mg = Math.hypot(Dx[i], Dy[i]); if (mg > 0) { const s = Math.min(mg, t) / mg; P[i].x += Dx[i] * s; P[i].y += Dy[i] * s; } }
          }
          _ogClSeparate(P, N, 26, 60); sepGroups();
        }
        // Slide whole groups (rigidly) to where the links between groups are straighter and further from other links and from classes
        {
          const tn = performance.now(), thr = (i) => Math.hypot(N[i].w, N[i].h) / 2 * 0.8 + 14, adj = (e, f) => e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t;
          const interIdx = []; EE.forEach((e, i) => { if (com[e.s] !== com[e.t]) interIdx.push(i); });
          const costOf = (c) => {
            const inter = interIdx.filter((i) => com[EE[i].s] === c || com[EE[i].t] === c), set = new Set(inter); let cost = 0, len = 0;
            for (const i of inter) {
              const e = EE[i], a = P[e.s], b = P[e.t]; len += Math.hypot(a.x - b.x, a.y - b.y);
              for (let j = 0; j < EE.length; j++) { if (j === i || (set.has(j) && j < i)) continue; const f = EE[j]; if (adj(e, f)) continue; if (_ogClSegX(a, b, P[f.s], P[f.t])) cost += 1000; }
              for (const j of interIdx) { if (j === i || (set.has(j) && j < i)) continue; const f = EE[j]; if (adj(e, f)) continue; const d = _ogClDSS(a, b, P[f.s], P[f.t]); if (d < 70) cost += (70 - d) * 0.8; }
              for (let u = 0; u < n; u++) { if (u === e.s || u === e.t) continue; const d = _ogClDPS(P[u], a, b), th = thr(u); if (d < th) cost += (th - d) * 1.5 + 10; }
            }
            for (const u of groups[c]) for (const j of interIdx) { if (set.has(j)) continue; const f = EE[j]; if (f.s === u || f.t === u) continue; const d = _ogClDPS(P[u], P[f.s], P[f.t]), th = thr(u); if (d < th) cost += (th - d) * 1.5 + 10; }
            return cost + len * 0.01;
          };
          const overlapsOthers = (c) => { const B = box(groups[c]); for (let b = 0; b < nc; b++) { if (b === c) continue; const o = box(groups[b]); if (B.x1 < o.x2 + gap && o.x1 < B.x2 + gap && B.y1 < o.y2 + gap && o.y1 < B.y2 + gap) return true; } return false; };
          const shift = (c, dx, dy) => { groups[c].forEach((i) => { P[i].x += dx; P[i].y += dy; }); bestC[c].x += dx; bestC[c].y += dy; };
          const degOf = (c) => interIdx.filter((i) => com[EE[i].s] === c || com[EE[i].t] === c).length;
          const order = [...Array(nc).keys()].sort((a, b) => degOf(b) - degOf(a));
          let moved = 0;
          for (let pass = 0; pass < 3 && performance.now() - tn < opt.nudgeBudget; pass++) {
            let improved = false;
            for (const c of order) {
              if (performance.now() - tn > opt.nudgeBudget) break;
              const cur = costOf(c); let best = null;
              for (let k = 0; k < 8; k++) for (const f of [0.3, 0.65, 1.1]) {
                const a = 2 * Math.PI * k / 8, dx = Math.cos(a) * R[c] * f, dy = Math.sin(a) * R[c] * f; shift(c, dx, dy);
                if (!overlapsOthers(c)) { const v = costOf(c); if (v < cur - 1e-6 && (!best || v < best.v)) best = { v, dx, dy }; }
                shift(c, -dx, -dy);
              }
              if (best) { shift(c, best.dx, best.dy); improved = true; moved++; }
            }
            if (!improved) break;
          }
          // the ring positions were chosen for the old group positions: choose them again, and keep that only if it is no worse
          if (moved) {
            const snap = P.map((p) => ({ x: p.x, y: p.y })), tot = () => { let s = 0; for (let c = 0; c < nc; c++) s += costOf(c); return s; }, before = tot();
            groups.forEach((g, c) => doGroup(g, c, true)); sepGroups();
            if (tot() > before) for (let i = 0; i < n; i++) { P[i].x = snap[i].x; P[i].y = snap[i].y; }
          }
        }
        _ogClSeparate(P, N, 26, 60);
        // Swap two classes of one group whenever that removes crossings (inside the group or between groups)
        {
          const ts = performance.now();
          for (let pass = 0; pass < 5 && performance.now() - ts < opt.swapBudget; pass++) {
            let improved = false;
            for (const g of groups) {
              if (g.length < 2) continue;
              for (const v of g) {
                if (performance.now() - ts > opt.swapBudget) break;
                const sv = new Set(incE[v]); if (!_ogClIncCost(P, EE, incE[v], sv, true)) continue;
                for (const u of g) {
                  if (u === v) continue;
                  const set = new Set(incE[v]); incE[u].forEach((k) => set.add(k)); const inc = [...set];
                  const before = _ogClIncCost(P, EE, inc, set), pv = P[v], pu = P[u]; P[v] = pu; P[u] = pv;
                  const after = _ogClIncCost(P, EE, inc, set);
                  if (after < before - 1e-9) improved = true; else { P[v] = pv; P[u] = pu; }
                }
              }
            }
            if (!improved) break;
          }
        }
        // Push links off classes lying on them: the point of the link nearest a class acts as an imaginary node pushing it away
        if (m <= 2500) {
          const tp = performance.now(); let cur = _ogClCrossings(P, EE), step = 1;
          const Dx = new Float64Array(n), Dy = new Float64Array(n);
          for (let it = 0; it < 30 && performance.now() - tp < opt.spreadBudget; it++) {
            Dx.fill(0); Dy.fill(0);
            for (let k = 0; k < m; k++) {
              const e = EE[k], a = P[e.s], b = P[e.t], ex = b.x - a.x, ey = b.y - a.y, L2 = ex * ex + ey * ey || 1;
              for (let i = 0; i < n; i++) {
                if (i === e.s || i === e.t) continue;
                const p = P[i]; let t = ((p.x - a.x) * ex + (p.y - a.y) * ey) / L2; t = Math.max(0, Math.min(1, t));
                let dx = p.x - (a.x + t * ex), dy = p.y - (a.y + t * ey); const d = Math.hypot(dx, dy) || 0.01, th = Math.hypot(N[i].w, N[i].h) / 2 * 0.8 + 18;
                if (d >= th) continue;
                const push = (th - d) * 0.5; dx /= d; dy /= d;
                Dx[i] += dx * push; Dy[i] += dy * push; Dx[e.s] -= dx * push * 0.5 * (1 - t); Dy[e.s] -= dy * push * 0.5 * (1 - t); Dx[e.t] -= dx * push * 0.5 * t; Dy[e.t] -= dy * push * 0.5 * t;
              }
            }
            const snap = P.map((p) => ({ x: p.x, y: p.y })); let any = false;
            for (let i = 0; i < n; i++) { const mg = Math.hypot(Dx[i], Dy[i]); if (mg > 0.01) { any = true; const s = Math.min(mg, 40) / mg * step; P[i].x += Dx[i] * s; P[i].y += Dy[i] * s; } }
            if (!any) break;
            _ogClSeparate(P, N, 18, 6); const x = _ogClCrossings(P, EE);
            if (x > cur) { for (let i = 0; i < n; i++) { P[i].x = snap[i].x; P[i].y = snap[i].y; } step *= 0.5; if (step < 0.1) break; } else cur = x;
          }
        }
        _ogClSeparate(P, N, 26, 60); sepGroups();
        return { P, com, groups, ms: performance.now() - t0 };
      }
      // The whole layout: set aside single-link classes, lay out the rest, put the single-link classes back, shrink evenly.
      // Does the segment (ax,ay)-(bx,by), given relative to a box's centre, touch the box of half-sizes hw, hh?
      function _ogClSegBox(ax, ay, bx, by, hw, hh) {
        let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
        const clip = (p, q) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
        return clip(-dx, ax + hw) && clip(dx, hw - ax) && clip(-dy, ay + hh) && clip(dy, hh - ay);
      }
      function _ogClOnce(items, edges, opt, seed) {
        const n = items.length, N = items.map((it) => ({ w: it.w, h: it.h }));
        const nb = Array.from({ length: n }, () => new Set());
        edges.forEach(([a, b]) => { if (a !== b) { nb[a].add(b); nb[b].add(a); } });
        const removed = new Array(n).fill(false), order = [], hubOf = new Array(n).fill(-1), deg = nb.map((s) => s.size), q = [];
        for (let i = 0; i < n; i++) if (deg[i] === 1) q.push(i);
        while (q.length) {
          const v = q.pop(); if (removed[v] || deg[v] !== 1) continue;
          let h = -1; nb[v].forEach((w) => { if (!removed[w]) h = w; }); if (h < 0) continue;
          removed[v] = true; order.push(v); hubOf[v] = h; deg[h]--; if (deg[h] === 1) q.push(h);
        }
        const core = []; for (let i = 0; i < n; i++) if (!removed[i]) core.push(i);
        if (core.length < 3) return null;
        const idx = new Map(core.map((g, k) => [g, k]));
        const cEdges = edges.filter(([a, b]) => idx.has(a) && idx.has(b)).map(([a, b, w]) => [idx.get(a), idx.get(b), w]);
        const r = _ogClCore(core.map((i) => N[i]), cEdges, opt, seed);
        if (!r) return null;
        const allEE = edges.filter(([a, b]) => a !== b).map(([a, b]) => [a, b]);
        const LG = opt.leafGap, lgOf = new Array(n).fill(0), labLen = new Map();
        // The room beside a single-link class also has to hold the text on its link.
        edges.forEach(([a, b, w, len]) => { if (len) { const k = a < b ? a * n + b : b * n + a; labLen.set(k, Math.max(labLen.get(k) || 0, len)); } });
        const gapFor = (v, h) => Math.max(LG, (labLen.get(v < h ? v * n + h : h * n + v) || 0) + 16);
        let P = null, com = null, placed = null, maxNeed = 0, S = 1;
        const rayHit = (h, ux, uy) => {
          let best = Infinity; const o = P[h];
          for (const [x, y] of placed) {
            if (x === h || y === h) continue;
            const a = P[x], b = P[y], ex = b.x - a.x, ey = b.y - a.y, den = ux * ey - uy * ex; if (Math.abs(den) < 1e-12) continue;
            const t = ((a.x - o.x) * ey - (a.y - o.y) * ex) / den, s = ((a.x - o.x) * uy - (a.y - o.y) * ux) / den;
            if (t > 0 && s >= 0 && s <= 1 && t < best) best = t;
          }
          return best;
        };
        const scaleAbout = (h, s) => { const hx = P[h].x, hy = P[h].y; for (let u = 0; u < n; u++) if (P[u] && u !== h) { P[u].x = hx + (P[u].x - hx) * s; P[u].y = hy + (P[u].y - hy) * s; } };
        const placeLeaf = (v, h) => {
          let best = null; const LGv = gapFor(v, h); lgOf[v] = LGv;
          for (let a = 0; a < 72; a++) {
            const t = 2 * Math.PI * a / 72 + 0.05, ux = Math.cos(t), uy = Math.sin(t);
            const need = Math.min(((N[h].w + N[v].w) / 2 + LGv) / Math.max(Math.abs(ux), 1e-6), ((N[h].h + N[v].h) / 2 + LGv) / Math.max(Math.abs(uy), 1e-6));
            const reach = rayHit(h, ux, uy), want = need + Math.max(N[v].w * Math.abs(ux), N[v].h * Math.abs(uy)) / 2 + 14;
            let s = Math.max(1, want / reach);
            const p = { x: P[h].x + ux * need * 1.02, y: P[h].y + uy * need * 1.02 };
            // no other class (leaves already put back included) may sit on the leaf once everything else is stretched by s
            const clash = (sc) => {
              for (let u = 0; u < n; u++) {
                if (!P[u] || u === h) continue;
                const dx = (P[u].x - P[h].x) * sc - (p.x - P[h].x), dy = (P[u].y - P[h].y) * sc - (p.y - P[h].y);
                if (Math.abs(dx) < (N[u].w + N[v].w) / 2 + 12 && Math.abs(dy) < (N[u].h + N[v].h) / 2 + 12) return true;
              }
              return false;
            };
            // and no link may run through the leaf's box (a link from the hub itself cannot be stretched away, so that direction is rejected)
            const lineClash = (sc) => {
              const hx = P[h].x, hy = P[h].y, hw = N[v].w / 2 + 12, hh = N[v].h / 2 + 12;
              for (const [x, y] of placed) {
                if (_ogClSegBox(hx + (P[x].x - hx) * sc - p.x, hy + (P[x].y - hy) * sc - p.y, hx + (P[y].x - hx) * sc - p.x, hy + (P[y].y - hy) * sc - p.y, hw, hh)) return true;
              }
              return false;
            };
            const bad = (sc) => clash(sc) || lineClash(sc);
            if (bad(s)) { let ok = false; for (const f of [1.1, 1.25, 1.5, 2, 3, 5, 8, 15, 30, 60]) { const s2 = Math.max(s, f); if (!bad(s2)) { s = s2; ok = true; break; } } if (!ok) s = 1e3; }
            const cost = s + (Number.isFinite(reach) ? 0 : -0.001) - Math.min(reach, 400) * 1e-5;
            if (!best || cost < best.cost) best = { cost, s, ux, uy, need };
          }
          if (best.s > 1.0001) { maxNeed = Math.max(maxNeed, best.s); scaleAbout(h, best.s * 1.03); }
          P[v] = { x: P[h].x + best.ux * best.need * 1.02, y: P[h].y + best.uy * best.need * 1.02 }; com[v] = com[h]; placed.push([h, v]);
        };
        // The core is drawn at scale S about its centre; if the worst leaf needed more room, the next pass starts from a core scaled up by that much.
        for (let pass = 0; pass < 5; pass++) {
          P = new Array(n).fill(null); com = new Array(n).fill(0);
          const ccx = r.P.reduce((s, p) => s + p.x, 0) / r.P.length, ccy = r.P.reduce((s, p) => s + p.y, 0) / r.P.length;
          core.forEach((g, k) => { P[g] = { x: ccx + (r.P[k].x - ccx) * S, y: ccy + (r.P[k].y - ccy) * S }; com[g] = r.com[k]; });
          placed = allEE.filter(([a, b]) => P[a] && P[b]); maxNeed = 0;
          for (let k = order.length - 1; k >= 0; k--) { const v = order[k], h = hubOf[v]; if (P[h]) placeLeaf(v, h); }
          if (maxNeed <= 1.0001) break; S *= Math.min(maxNeed * 1.04, 3);
        }
        for (let i = 0; i < n; i++) if (!P[i]) P[i] = { x: 0, y: 0 };
        // Shrink evenly (a uniform scale cannot change a crossing) to the tightest size where no more boxes touch than at the start
        const nGroups = Math.max(...com) + 1, groups = Array.from({ length: nGroups }, () => []); com.forEach((c, i) => groups[c].push(i));
        const cx = P.reduce((s, p) => s + p.x, 0) / n, cy = P.reduce((s, p) => s + p.y, 0) / n, P1 = P.map((p) => ({ x: p.x, y: p.y })), tp = Math.max(8, LG - 6);
        const touches = (s) => {
          const Q = P1.map((p) => ({ x: cx + (p.x - cx) * s, y: cy + (p.y - cy) * s })); let c = 0;
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
            const pad = Math.max(tp, removed[i] && hubOf[i] === j ? lgOf[i] - 6 : 0, removed[j] && hubOf[j] === i ? lgOf[j] - 6 : 0);
            if (Math.abs(Q[i].x - Q[j].x) < (N[i].w + N[j].w) / 2 + pad && Math.abs(Q[i].y - Q[j].y) < (N[i].h + N[j].h) / 2 + pad) c++;
          }
          const B = groups.map((g) => { let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9; g.forEach((i) => { x1 = Math.min(x1, Q[i].x - N[i].w / 2); x2 = Math.max(x2, Q[i].x + N[i].w / 2); y1 = Math.min(y1, Q[i].y - N[i].h / 2); y2 = Math.max(y2, Q[i].y + N[i].h / 2); }); return { x1, y1, x2, y2 }; });
          for (let a = 0; a < B.length; a++) for (let b = a + 1; b < B.length; b++) if (B[a].x1 < B[b].x2 + 34 && B[b].x1 < B[a].x2 + 34 && B[a].y1 < B[b].y2 + 34 && B[b].y1 < B[a].y2 + 34) c++;
          return c;
        };
        { const c1 = touches(1); let lo = 1e-4, hi = 1; for (let k = 0; k < 30; k++) { const mid = Math.sqrt(lo * hi); if (touches(mid) <= c1) hi = mid; else lo = mid; } P1.forEach((p, i) => { P[i].x = cx + (p.x - cx) * hi; P[i].y = cy + (p.y - cy) * hi; }); }
        return P;
      }
      // Several tries from different starts within a time budget; the one with the fewest crossed links is kept.
      function _ogClusterLayout(items, edges, opts) {
        const n = items.length; if (n < 8 || !edges.length) return null;
        const o = opts || {}, sc = o.roomy ? 1.3 : 1;
        const opt = { L: 95 * sc, gap: 60 * sc, metaRep: 2.2, leafGap: 40 * sc, nudgeBudget: 250, swapBudget: 400, spreadBudget: 250 };
        const EE = edges.filter(([a, b]) => a !== b).map(([a, b]) => ({ s: a, t: b }));
        const maxTries = o.tries || (n <= 40 ? 6 : n <= 100 ? 3 : 2), budget = o.budgetMs || 900, t0 = performance.now();
        let best = null;
        for (let k = 0; k < maxTries && (k === 0 || performance.now() - t0 < budget); k++) {
          const P = _ogClOnce(items, edges, opt, 104729 + k * 7919); if (!P) return null;
          const x = EE.length <= 2500 ? _ogClCrossings(P, EE) : 0;
          if (!best || x < best.crossings) best = { pos: P, crossings: x };
          if (!x) break;
        }
        return best;
      }
      // ── end of the layouts ──
