// ELK layered measured with the links it routes itself (orthogonal or polyline bends), instead of straight lines between
// box centers. Run in contenders.html: await elkRouted(keys) -> rows { key, mode, cross, thru, bends }.
// A crossed pair is two links without a shared end whose drawn paths meet at least once; a link through a class is a path
// that passes within 3 px of a third class box (the same rules as the straight-line measures).
window.elkRouted = async (keys) => {
  const segX = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
  const segBox = (a, b, cx, cy, hw, hh) => { let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y, p = [-dx, dx, -dy, dy], q = [a.x - (cx - hw), cx + hw - a.x, a.y - (cy - hh), cy + hh - a.y];
    for (let i = 0; i < 4; i++) { if (p[i] === 0) { if (q[i] < 0) return false; continue; } const r = q[i] / p[i]; if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } } return true; };
  const out = [];
  for (const key of keys) {
    const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 })), N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 }));
    const ed = M.edges.filter((e) => e.s !== e.t).map((e) => (e.kind === 'sub' ? [e.t, e.s] : [e.s, e.t]));
    let best = null;
    for (const strat of [null, 'NETWORK_SIMPLEX', 'BRANDES_KOEPF', 'LINEAR_SEGMENTS']) for (const routing of ['ORTHOGONAL', 'POLYLINE']) {
      const opts = { 'elk.algorithm': 'layered', 'elk.spacing.nodeNode': '30', 'elk.layered.spacing.nodeNodeBetweenLayers': '60', 'elk.edgeRouting': routing, ...(strat ? { 'elk.layered.nodePlacement.strategy': strat, 'elk.layered.thoroughness': '40', 'elk.direction': 'DOWN' } : {}) };
      const g = await ELKI.layout({ id: 'root', layoutOptions: opts, children: N.map((d, i) => ({ id: 'n' + i, width: d.w, height: d.h })), edges: ed.map(([a, b], k) => ({ id: 'e' + k, sources: ['n' + a], targets: ['n' + b] })) });
      const P = []; g.children.forEach((c) => { P[+c.id.slice(1)] = { x: c.x + c.width / 2, y: c.y + c.height / 2 }; });
      const paths = g.edges.map((e) => { const s = (e.sections || [])[0]; return s ? [s.startPoint, ...(s.bendPoints || []), s.endPoint] : null; });
      let cross = 0, thru = 0, bends = 0;
      paths.forEach((p) => (bends += p ? p.length - 2 : 0));
      for (let i = 0; i < ed.length; i++) for (let j = i + 1; j < ed.length; j++) {
        const [a, b] = ed[i], [c, d] = ed[j]; if (a === c || a === d || b === c || b === d || !paths[i] || !paths[j]) continue;
        let hit = false; for (let u = 0; u + 1 < paths[i].length && !hit; u++) for (let v = 0; v + 1 < paths[j].length && !hit; v++) hit = segX(paths[i][u], paths[i][u + 1], paths[j][v], paths[j][v + 1]);
        if (hit) cross++;
      }
      ed.forEach(([a, b], k) => { if (!paths[k]) return; for (let i = 0; i < P.length; i++) { if (i === a || i === b) continue; let hit = false; for (let u = 0; u + 1 < paths[k].length && !hit; u++) hit = segBox(paths[k][u], paths[k][u + 1], P[i].x, P[i].y, D[i].w / 2 + 3, D[i].h / 2 + 3); if (hit) thru++; } });
      if (!best || cross + thru < best.cross + best.thru) best = { key, strat: strat || 'default', routing, cross, thru, bends };
    }
    out.push(best);
  }
  return out;
};
