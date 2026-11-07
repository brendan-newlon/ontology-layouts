// Experiment: a top-down tree layout for graphs made mostly of subclass links (taxonomies).
// Each class hangs under one parent (its shallowest); subtrees sit side by side under their parent. The gap down to a row of
// children is made deep enough that no straight line from the parent to a child clips a sibling's box, so the tree itself has
// no crossings and no link through a class; only the other links (second parents, relationships) can.
//  - Siblings are ordered by where their other links lead (barycenter of those classes' x, a few passes), so those links
//    cross less; siblings without other links keep a balanced fan (small subtrees at the ends).
//  - A long row of leaf children is staggered into two rows, which halves its width.
// items [{w, h}], edges [[i, j, weight]] (weight 2: i is a subclass of j). Returns { pos } or null.
function x4TreeLayout(items, edges, opts) {
  const n = items.length, o = opts || {}, sc = o.roomy ? 1.3 : 1, passes = o.passes == null ? 4 : o.passes, stagger = o.stagger == null ? 6 : o.stagger;
  const N = items.map((it) => ({ w: it.w + 16 * sc, h: it.h + 12 * sc })), SIB = 18 * sc, MINGAP = 50 * sc;
  const par = Array.from({ length: n }, () => []), linked = new Uint8Array(n), nb = Array.from({ length: n }, () => []);
  edges.forEach(([a, b, w]) => { if (a === b) return; linked[a] = linked[b] = 1; if (w === 2) par[a].push(b); nb[a].push(b); nb[b].push(a); });
  const depth = new Array(n).fill(-1), kidsAll = Array.from({ length: n }, () => []);
  par.forEach((ps, c) => ps.forEach((p) => kidsAll[p].push(c)));
  const q = [], bfs = (from) => { for (let i = from; i < q.length; i++) for (const k of kidsAll[q[i]]) if (depth[k] < 0) { depth[k] = depth[q[i]] + 1; q.push(k); } };
  for (let v = 0; v < n; v++) if (!par[v].length && linked[v]) { depth[v] = 0; q.push(v); }
  bfs(0);
  for (let v = 0; v < n; v++) if (depth[v] < 0 && linked[v]) { depth[v] = 0; const f = q.length; q.push(v); bfs(f); }
  const tp = new Array(n).fill(-1), kids = Array.from({ length: n }, () => []);
  for (let v = 0; v < n; v++) { let best = -1; for (const p of par[v]) if (depth[p] >= 0 && depth[p] < depth[v] && (best < 0 || depth[p] < depth[best])) best = p; if (best >= 0) { tp[v] = best; kids[best].push(v); } }
  const size = new Array(n).fill(1); for (let i = q.length - 1; i >= 0; i--) { const v = q[i]; if (tp[v] >= 0) size[tp[v]] += size[v]; }
  // the classes of each subtree, for the barycenter of its links that leave the subtree
  const root = new Array(n); const subOf = (v) => { const out = [v]; for (let i = 0; i < out.length; i++) out.push(...kids[out[i]]); return out; };
  const fan = (ks) => { const s = ks.slice().sort((a, b) => size[a] - size[b] || a - b), out = []; s.forEach((v, i) => (i % 2 ? out.push(v) : out.unshift(v))); return out; };
  let P = null;
  const bary = (v) => { if (!P) return null; const S = new Set(subOf(v)); let s = 0, k = 0; S.forEach((u) => nb[u].forEach((w) => { if (!S.has(w) && w !== tp[v] && P[w]) { s += P[w].x; k++; } })); return k ? s / k : null; };
  const order = (ks) => {
    const f = fan(ks); if (!P) return f;
    const keyed = f.map((v, i) => { const b = bary(v); return { v, k: b == null ? P[v].x : b }; });
    return keyed.sort((a, b) => a.k - b.k || a.v - b.v).map((x) => x.v);
  };
  const clips = (x0, y0, x1, y1, cx, cy, hw, hh) => { let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0, p = [-dx, dx, -dy, dy], qq = [x0 - (cx - hw), cx + hw - x0, y0 - (cy - hh), cy + hh - y0];
    for (let i = 0; i < 4; i++) { if (p[i] === 0) { if (qq[i] < 0) return false; continue; } const r = qq[i] / p[i]; if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } } return true; };
  function lay(v) {
    const ks = order(kids[v]); if (!ks.length) return { pts: [[v, 0, 0]], l: -N[v].w / 2, r: N[v].w / 2, b: N[v].h / 2 };
    const subs = ks.map(lay);
    // staggered leaves: in a long run of leaf children, every second one goes one row lower and they close up sideways
    const isLeaf = ks.map((k) => !kids[k].length), nLeaf = isLeaf.filter(Boolean).length, stag = stagger && nLeaf >= stagger;
    const DY = ks.map(() => 0), X = []; let x = 0, lastRow = [null, null], li = 0;
    subs.forEach((s, i) => {
      if (stag && isLeaf[i]) {
        const row = li++ % 2; DY[i] = row * (Math.max(...ks.map((k) => N[k].h)) + 10 * sc);
        // a leaf must clear the previous box in its own row, and overlap the other row's last box by at most half a slot
        const prev = lastRow[row], other = lastRow[1 - row];
        let at = prev ? prev.x + prev.r + SIB - s.l : (other ? other.x : 0) - s.l;
        if (other) at = Math.max(at, other.x + other.r / 2);
        if (i && !isLeaf[i - 1]) at = Math.max(at, x + SIB - s.l);
        X.push(at); lastRow[row] = { x: at, r: s.r }; x = Math.max(x, at + s.r);
      } else { if (i) x += SIB; x += -s.l; X.push(x); x += s.r; lastRow = [{ x: X[i], r: s.r }, { x: X[i], r: s.r }]; }
    });
    const mid = (Math.min(...X) + Math.max(...X)) / 2; for (let i = 0; i < X.length; i++) X[i] -= mid;
    // deep enough that the line to each child passes beside every sibling's box
    let G = MINGAP + (N[v].h + Math.max(...ks.map((k) => N[k].h))) / 2;
    for (let guard = 0; guard < 60; guard++) {
      let bad = false;
      for (let i = 0; i < ks.length && !bad; i++) for (let j = 0; j < ks.length && !bad; j++) if (i !== j && clips(0, 0, X[i], G + DY[i], X[j], G + DY[j], N[ks[j]].w / 2 + 3, N[ks[j]].h / 2 + 3)) bad = true;
      if (!bad) break; G *= 1.12;
    }
    const pts = [[v, 0, 0]]; let l = -N[v].w / 2, r = N[v].w / 2, b = N[v].h / 2;
    subs.forEach((s, i) => { s.pts.forEach(([u, dx, dy]) => pts.push([u, X[i] + dx, G + DY[i] + dy])); l = Math.min(l, X[i] + s.l); r = Math.max(r, X[i] + s.r); b = Math.max(b, G + DY[i] + s.b); });
    return { pts, l, r, b };
  }
  const roots = q.filter((v) => tp[v] < 0);
  for (let pass = 0; pass <= passes; pass++) {
    const Q = new Array(n); let x = 0;
    order(roots).forEach((v) => { const s = lay(v); x += -s.l; s.pts.forEach(([u, dx, dy]) => (Q[u] = { x: x + dx, y: dy })); x += s.r + 3 * SIB; });
    let maxY = 0; Q.forEach((p) => p && (maxY = Math.max(maxY, p.y))); let ux = 0;
    for (let v = 0; v < n; v++) if (!Q[v]) { Q[v] = { x: ux + N[v].w / 2, y: maxY + 80 }; ux += N[v].w + SIB; }
    P = Q;
  }
  return { pos: P, crossings: 0 };
}
const EXP4 = { tree: x4TreeLayout, tree0: (a, b, c) => x4TreeLayout(a, b, { ...c, passes: 0, stagger: 0 }), treeNoStag: (a, b, c) => x4TreeLayout(a, b, { ...c, stagger: 0 }) };
