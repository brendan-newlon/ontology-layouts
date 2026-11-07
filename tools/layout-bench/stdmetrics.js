// Standard drawing measures from the graph-drawing literature, none of which our layouts optimize directly.
// P: [{x, y}], E: [{s, t, sub}] (sub: s is the subclass, t its parent). Returns:
//  nstress  normalized stress against hop distance, at the best uniform scale (Gansner, Koren, North 2004; scale-free form
//           as in Kruiger et al. 2017). Lower is better: straight-line distances follow graph distances.
//  elcv     coefficient of variation of link lengths. Lower is better: links of even length.
//  xang     mean crossing angle in degrees, 90 when nothing crosses (Huang, Eades, Hong 2008). Higher is better.
//  angres   mean angular resolution: smallest angle between a class's links, as a share of the ideal 360/degree. Higher is better.
//  down     share of subclass links whose subclass sits below its parent. 1 is a consistent top-down hierarchy.
function stdMetrics(P, E) {
  const n = P.length, nb = Array.from({ length: n }, () => []);
  E.forEach((e) => { if (e.s !== e.t) { nb[e.s].push(e.t); nb[e.t].push(e.s); } });
  let sw = 0, swd2 = 0, swdd = 0, sdd2 = 0;
  for (let s = 0; s < n; s++) {
    const d = new Int32Array(n).fill(-1), q = [s]; d[s] = 0;
    for (let h = 0; h < q.length; h++) for (const v of nb[q[h]]) if (d[v] < 0) { d[v] = d[q[h]] + 1; q.push(v); }
    for (let t = s + 1; t < n; t++) {
      if (d[t] <= 0) continue;
      const w = 1 / (d[t] * d[t]), g = Math.hypot(P[s].x - P[t].x, P[s].y - P[t].y);
      sw += w; swd2 += w * d[t] * d[t]; swdd += w * d[t] * g; sdd2 += w * g * g;
    }
  }
  // stress(a) = sum w (a·g − d)²; best a = sum w d g / sum w g²
  const a = sdd2 ? swdd / sdd2 : 1, nstress = swd2 ? (a * a * sdd2 - 2 * a * swdd + swd2) / swd2 : 0;
  const L = E.filter((e) => e.s !== e.t).map((e) => Math.hypot(P[e.s].x - P[e.t].x, P[e.s].y - P[e.t].y));
  const mean = L.reduce((x, y) => x + y, 0) / Math.max(1, L.length), sd = Math.sqrt(L.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, L.length));
  const X = (p, q, r, s) => { const o = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); return o(p, q, r) * o(p, q, s) < 0 && o(r, s, p) * o(r, s, q) < 0; };
  let xs = 0, xc = 0;
  for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
    const e = E[i], f = E[j]; if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue;
    if (!X(P[e.s], P[e.t], P[f.s], P[f.t])) continue;
    const ux = P[e.t].x - P[e.s].x, uy = P[e.t].y - P[e.s].y, vx = P[f.t].x - P[f.s].x, vy = P[f.t].y - P[f.s].y;
    const c = Math.abs(ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1); xs += Math.acos(Math.min(1, c)) * 180 / Math.PI; xc++;
  }
  let ar = 0, an = 0;
  for (let v = 0; v < n; v++) {
    const us = [...new Set(nb[v])]; if (us.length < 2) continue;
    const th = us.map((u) => Math.atan2(P[u].y - P[v].y, P[u].x - P[v].x)).sort((x, y) => x - y);
    let mn = 2 * Math.PI - (th[th.length - 1] - th[0]); for (let k = 1; k < th.length; k++) mn = Math.min(mn, th[k] - th[k - 1]);
    ar += mn / (2 * Math.PI / us.length); an++;
  }
  let dn = 0, subs = 0; E.forEach((e) => { if (e.sub) { subs++; if (P[e.s].y > P[e.t].y + 1) dn++; } });
  return { nstress, elcv: mean ? sd / mean : 0, xang: xc ? xs / xc : 90, angres: an ? ar / an : 1, down: subs ? dn / subs : null };
}
if (typeof window !== 'undefined') window.stdMetrics = stdMetrics;
