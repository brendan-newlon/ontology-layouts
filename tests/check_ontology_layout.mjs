// Checks for the ontology layouts and the clean-up after them (src/ontology-layouts.js, from function _ogClRng to
// "// ── end of the layouts ──"):
//   1. clock: the layout code reads no wall clock except inside the work clock, so a drawing does not depend on the computer;
//   2. grid: the clean-up's spatial grid gives the same costs as checking every pair (its checkIndex mode compares the two
//      on every evaluation and throws on a difference);
//   3. repeatable: the same model laid out and cleaned up twice gives the same drawing;
//   4. tree: a pure taxonomy drawn as a tree, and cleaned up keeping it top-down, has no problem and every subclass below;
//   5. routes: the link routing after a layout leaves no parallel link hidden on another, gives every self-link a loop,
//      never makes a drawing worse than straight links (10 per link through a class, 6 per crossing), gives the same routes
//      twice, and counts its work on the work clock (so its time limit holds); when it moves classes off links still through
//      them (settle), the moved drawing overlaps no class and has no more problems than the one routed without moving;
//   6. moves: the passes after the clean-up (leaf swaps, leaves to open space, classes pushed off a link) never leave more
//      problems on straight links (10 per link through a class with a 9 px margin, 6 per crossing) than without them.
//   7. pull and api: pulling in never adds problems or overlaps; the public entry points exist and draw() returns paths that
//      start and end on the boxes at the returned positions;
//   8. keep: keeping an earlier drawing moves no old class (exact) or little (soft), puts no new class on another, and
//      relation classes (between: [a, b]) go onto their line at a cost of at most one crossing each.
// node tests/check_ontology_layout.mjs            -> "ontology layout clean" or the failures
// node tests/check_ontology_layout.mjs --self-test -> runs each check on a deliberately broken copy and confirms it fails
import fs from 'node:fs';
const appPath = new URL('../src/ontology-layouts.js', import.meta.url);

function layoutCode(src) {
  const a = src.indexOf('function _ogClRng('), b = src.indexOf('// ── end of the layouts ──');
  if (a < 0 || b < 0 || b < a) throw new Error('layout code anchors not found');
  return src.slice(a, b).replace(/\r\n/g, '\n');
}
function load(code) {
  const api = 'return { auto: _ogAutoLayout, tree: _ogTreeLayout, cleanUp: _ogLayoutCleanUp, tidy: _ogHandTidy, now: _ogNow, sep: _ogClSeparate, route: _ogRouteLinks, routeMetrics: _ogRouteMetrics, tune: _OG_TUNE, segX: _ogClSegX, segBox: _ogClSegBox, api: OntologyLayouts };';
  return new Function('window', 'document', 'state', 'log', code + '\n' + api)({}, {}, { ui: {} }, () => {});
}
// small generated models: a few taxonomies with property links between them, fixed seeds
function model(seed, n, extra) {
  let a = seed; const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const labels = [], edges = [];
  for (let i = 0; i < n; i++) labels.push('Class' + i + ['', 'Record', 'Assignment', 'Item'][i % 4]);
  for (let i = 1; i < n; i++) edges.push([i, Math.max(0, i - 1 - ((rnd() * 6) | 0)), rnd() < 0.6 ? 2 : 1]);
  for (let k = 0; k < extra; k++) { const s = (rnd() * n) | 0, t = (rnd() * n) | 0; if (s !== t) edges.push([s, t, 1]); }
  return { D: labels.map((l) => ({ w: l.length * 6.6 + 10, h: 20 })), edges };
}
const MODELS = [model(1, 14, 4), model(2, 30, 12), model(3, 45, 25), model(4, 70, 30)];

function checkClock(code) {
  const c0 = code.indexOf('// ── Work clock ──'), c1 = code.indexOf('// ── end of the work clock ──');
  if (c0 < 0 || c1 < 0) return ['the work clock section is missing'];
  const outside = code.slice(0, c0) + code.slice(c1), hits = outside.match(/performance\.now\(\)|Date\.now\(\)/g);
  return hits ? [hits.length + ' wall-clock read(s) in the layout code outside the work clock'] : [];
}
function checkGrid(L) {
  const bad = [];
  MODELS.forEach((m, i) => {
    const P = L.auto(m.D, m.edges, { seed: 1 }).pos.map((p) => ({ x: p.x, y: p.y })), E = m.edges.map(([s, t]) => ({ s, t }));
    for (const down of [undefined, m.edges.filter((e) => e[2] === 2).map(([c, p]) => [c, p])]) {
      try { L.tidy.run(P, m.D, E, { budgetMs: 300, checkIndex: true, down }); }
      catch (err) { bad.push('model ' + i + (down ? ' (kept top-down)' : '') + ': ' + err.message); }
    }
  });
  return bad;
}
function checkRepeatable(L) {
  const bad = [], hash = (P) => P.map((p) => p.x.toFixed(3) + ',' + p.y.toFixed(3)).join(';');
  MODELS.forEach((m, i) => {
    const once = () => { const t0 = L.now(), P = L.auto(m.D, m.edges, { seed: 1 }).pos.map((p) => ({ x: p.x, y: p.y })); L.sep(P, m.D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 200); return hash(L.cleanUp(P, m.D, m.edges, t0)); };
    if (once() !== once()) bad.push('model ' + i + ' gave two different drawings');
  });
  return bad;
}
// 4. tree: a pure taxonomy (wide fans, three levels) drawn by the tree layout and cleaned up keeping it top-down has no crossed
//    links, no link through a class, and every subclass below its superclass
function checkTree(L) {
  const bad = [], labels = [], edges = [];
  labels.push('Thing'); for (let i = 0; i < 4; i++) { const a = labels.length; labels.push('Category' + i); edges.push([a, 0, 2]);
    for (let j = 0; j < 3 + 3 * i; j++) { const b = labels.length; labels.push('Kind' + i + 'Member' + j); edges.push([b, a, 2]); if (j < 2) for (let k = 0; k < 3; k++) { labels.push('Leaf' + i + j + k); edges.push([labels.length - 1, b, 2]); } } }
  const D = labels.map((l) => ({ w: l.length * 6.6 + 10, h: 20 })), E = edges.map(([s, t]) => ({ s, t }));
  const t0 = L.now(), P = L.tree(D, edges, {}).pos.map((p) => ({ x: p.x, y: p.y })); L.sep(P, D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 40);
  for (const [name, Q] of [['tree', P], ['tree after clean-up', L.cleanUp(P, D, edges, t0, true)]]) {
    const m = L.tidy.measure(Q, D, E), up = edges.filter(([c, p]) => Q[c].y <= Q[p].y).length;
    if (m.cross || m.thru || up) bad.push(`${name}: ${m.cross} crossed, ${m.thru} through classes, ${up} subclass links not pointing down`);
  }
  // multiple superclasses (one of them deep in another branch) and a subclass cycle: every subclass link points down except
  // the one that closes the cycle
  const L2 = ['Thing', 'A', 'B', 'B1', 'B2', 'B3', 'C', 'Cyc1', 'Cyc2', 'Cyc3'], E2 = [[1, 0, 2], [2, 0, 2], [3, 2, 2], [4, 3, 2], [5, 4, 2], [6, 1, 2], [6, 5, 2], [7, 0, 2], [8, 7, 2], [9, 8, 2], [7, 9, 2]];
  const D2 = L2.map((l) => ({ w: l.length * 6.6 + 10, h: 20 })), Q2 = L.tree(D2, E2, {}).pos, up2 = E2.filter(([c, p]) => Q2[c].y <= Q2[p].y).length;
  if (up2 !== 1) bad.push(`tree with multiple superclasses and a cycle: ${up2} subclass links not pointing down (expected 1, the cycle's)`);
  return bad;
}
// 5. routes
function checkRoutes(L) {
  const bad = [];
  // reciprocal pairs, three links between two classes and a self-link, on top of each test model
  MODELS.forEach((m, i) => {
    const n = m.D.length, edges = m.edges.map((e) => [...e, 60]).concat([[0, 1, 1, 70], [1, 0, 1, 80], [2, 3, 1, 50], [2, 3, 1, 50], [3, 2, 1, 90], [4, 4, 1, 40]]);
    const t0 = L.now(), P = L.auto(m.D, edges, { seed: 1 }).pos.map((p) => ({ x: p.x, y: p.y })); L.sep(P, m.D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 200);
    const Q = L.cleanUp(P, m.D, edges, t0).map((p) => ({ x: p.x, y: p.y }));
    const w0 = performance.now(), r = L.route(Q, m.D, edges), wall = performance.now() - w0, r2 = L.route(Q, m.D, edges);
    const st = L.routeMetrics(Q, m.D, edges, edges.map(() => null)), ro = L.routeMetrics(r.pos, m.D, edges, r.routes), cost = (x) => 10 * x.thru + 6 * x.cross;
    const rs = L.route(Q, m.D, edges, { settle: false }), so = L.routeMetrics(Q, m.D, edges, rs.routes), score = (x) => x.cross * 6 + x.thru * 10 + x.labelOver * 8 + x.labelCrossed * 1.5;
    if (score(ro) > score(so)) bad.push(`model ${i}: moving classes off links left more problems (${score(ro)} against ${score(so)})`);
    r.pos.forEach((p, u) => r.pos.forEach((q, w) => { if (w > u && Math.abs(p.x - q.x) < (m.D[u].w + m.D[w].w) / 2 && Math.abs(p.y - q.y) < (m.D[u].h + m.D[w].h) / 2) bad.push(`model ${i}: classes ${u} and ${w} overlap after the routing`); }));
    if (ro.hidden) bad.push(`model ${i}: ${ro.hidden} parallel links hidden on another`);
    if (edges.some(([s, t], k) => s === t && !r.routes[k].loop)) bad.push(`model ${i}: a self-link without a loop`);
    if (cost(ro) > cost(st)) bad.push(`model ${i}: routed links worse than straight (${ro.cross} crossed, ${ro.thru} through classes against ${st.cross}, ${st.thru})`);
    if (JSON.stringify(r.routes) !== JSON.stringify(r2.routes)) bad.push(`model ${i}: two different routings`);
    // the work clock may run ahead of the wall clock but not far behind it: work done and not counted would let the time limit slip
  });
  // the work counted must keep up with the time taken, on a dense model where routing has plenty to do
  const d = model(4, 90, 140), Pd = L.auto(d.D, d.edges, { seed: 1 }).pos, w0 = performance.now(), rd = L.route(Pd, d.D, d.edges), wall = performance.now() - w0;
  if (wall > 2 * rd.stats.work + 25) bad.push(`dense model: routing took ${Math.round(wall)} ms but counted ${Math.round(rd.stats.work)} ms of work`);
  // moving classes off links where some links still run through classes after the bends: two denser models
  [model(5, 40, 60), model(6, 60, 90)].forEach((d2, i) => {
    const P2 = L.auto(d2.D, d2.edges, { seed: 1 }).pos, score = (x) => x.cross * 6 + x.thru * 10 + x.labelOver * 8 + x.labelCrossed * 1.5;
    const a = L.route(P2, d2.D, d2.edges), b = L.route(P2, d2.D, d2.edges, { settle: false });
    if (process.env.CHECK_VERBOSE) console.log('settle model', i, 'moved', a.stats.settled || 0, score(L.routeMetrics(a.pos, d2.D, d2.edges, a.routes)), score(L.routeMetrics(P2, d2.D, d2.edges, b.routes)));
    if (score(L.routeMetrics(a.pos, d2.D, d2.edges, a.routes)) > score(L.routeMetrics(P2, d2.D, d2.edges, b.routes))) bad.push(`dense model ${i}: moving classes off links left more problems`);
  });
  return bad;
}
// 6. moves after the clean-up
function checkMoves(L) {
  const bad = [];
  const problems = (P, D, E) => { let c = 0;
    E.forEach(([s, t], k) => { if (s === t) return; D.forEach((d, u) => { if (u !== s && u !== t && L.segBox(P[s].x - P[u].x, P[s].y - P[u].y, P[t].x - P[u].x, P[t].y - P[u].y, d.w / 2 + 9, d.h / 2 + 9)) c += 10; });
      E.forEach(([a, b], f) => { if (f > k && a !== b && a !== s && a !== t && b !== s && b !== t && L.segX(P[s], P[t], P[a], P[b])) c += 6; }); });
    return c; };
  MODELS.concat([model(7, 40, 6), model(8, 60, 10)]).forEach((m, i) => {
    const run = (off) => { Object.assign(L.tune, off ? { noSwap: true, noFence: true, noNudge: true, noPull: true } : { noSwap: false, noFence: false, noNudge: false, noPull: true });
      const t0 = L.now(), P = L.auto(m.D, m.edges, { seed: 1 }).pos.map((p) => ({ x: p.x, y: p.y })); L.sep(P, m.D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 200);
      // a tiny time limit for the clean-up itself, so both runs clean up the same way and only the passes after it differ
      return L.cleanUp(P, m.D, m.edges, t0 - 5000); };
    const a = problems(run(true), m.D, m.edges), b = problems(run(false), m.D, m.edges);
    Object.assign(L.tune, { noSwap: false, noFence: false, noNudge: false, noPull: false });
    if (b > a) bad.push(`model ${i}: the passes after the clean-up left more problems (${b} against ${a})`);
  });
  return bad;
}
// 7. pulling parts and groups in from the edge: never more problems, never a bigger box, never two boxes on each other
function checkPull(L) {
  const bad = [];
  const problems = (P, D, E) => { let c = 0;
    E.forEach(([s, t], k) => { if (s === t) return; D.forEach((d, u) => { if (u !== s && u !== t && L.segBox(P[s].x - P[u].x, P[s].y - P[u].y, P[t].x - P[u].x, P[t].y - P[u].y, d.w / 2 + 9, d.h / 2 + 9)) c += 10; });
      E.forEach(([a, b], f) => { if (f > k && a !== b && a !== s && a !== t && b !== s && b !== t && L.segX(P[s], P[t], P[a], P[b])) c += 6; }); });
    return c; };
  const area = (P, D) => { let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18; P.forEach((p, i) => { x1 = Math.min(x1, p.x - D[i].w / 2); x2 = Math.max(x2, p.x + D[i].w / 2); y1 = Math.min(y1, p.y - D[i].h / 2); y2 = Math.max(y2, p.y + D[i].h / 2); }); return (x2 - x1) * (y2 - y1); };
  // trees with long hanging chains and loosely joined groups: the shapes this pass is for
  const chainy = (seed, n) => { const m = model(seed, n, 3); for (let i = 0; i < 8; i++) m.edges.push([n + i, i ? n + i - 1 : 0, 1]); for (let i = 0; i < 8; i++) m.D.push({ w: 70, h: 20 }); return m; };
  [chainy(11, 20), chainy(12, 40), model(13, 60, 8), model(14, 90, 12)].forEach((m, i) => {
    const run = (off) => { L.tune.noPull = off; const t0 = L.now(), P = L.auto(m.D, m.edges, { seed: 1 }).pos.map((p) => ({ x: p.x, y: p.y })); L.sep(P, m.D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 200); return L.cleanUp(P, m.D, m.edges, t0 - 5000); };
    const A = run(true), B = run(false); L.tune.noPull = false;
    const pa = problems(A, m.D, m.edges), pb = problems(B, m.D, m.edges);
    if (pb > pa) bad.push(`model ${i}: pulling in left more problems (${pb} against ${pa})`);
    if (area(B, m.D) > area(A, m.D) * 1.0001) bad.push(`model ${i}: pulling in made the drawing bigger`);
    for (let u = 0; u < B.length; u++) for (let v = u + 1; v < B.length; v++) if (Math.abs(B[u].x - B[v].x) < (m.D[u].w + m.D[v].w) / 2 && Math.abs(B[u].y - B[v].y) < (m.D[u].h + m.D[v].h) / 2) { bad.push(`model ${i}: pulling in put two classes on each other`); u = v = 1e9; }
  });
  return bad;
}
// the public entry points: all present, and draw() hands back positions, routes and paths that belong together
function checkApi(L) {
  const bad = [], A = L.api || {};
  ['draw', 'bestRead', 'tidyStress', 'mycelium', 'cleanUp', 'routeLinks', 'routePaths', 'groups', 'routeMetrics', 'metrics', 'score', 'setTimeLimit', 'now'].forEach((k) => { if (typeof A[k] !== 'function') bad.push('OntologyLayouts.' + k + ' missing'); });
  if (bad.length) return bad;
  const onBorder = (p, c, d) => { const ex = Math.abs(Math.abs(p.x - c.x) - d.w / 2), ey = Math.abs(Math.abs(p.y - c.y) - d.h / 2), inX = Math.abs(p.x - c.x) <= d.w / 2 + 0.5, inY = Math.abs(p.y - c.y) <= d.h / 2 + 0.5;
    return (ex < 0.5 && inY) || (ey < 0.5 && inX); };
  // the last two are dense enough that the routing pushes classes off links (seeds found by trying)
  MODELS.concat([model(5, 20, 20), model(36, 30, 40)]).forEach((m, i) => {
    const D = m.D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), E = m.edges.map((e, k) => [e[0], e[1], e[2], e[2] === 1 ? 40 + (k % 3) * 20 : 0]);
    const r = A.draw(D, E, { arrow: 8 }), n = D.length;
    if (r.pos.length !== n || r.paths.length !== E.length || r.groups.length !== n) { bad.push(`model ${i}: draw() returned the wrong number of positions, paths or groups`); return; }
    const ids = [...new Set(r.groups)].sort((a, b) => a - b); if (ids.some((g, j) => g !== j)) bad.push(`model ${i}: group numbers are not 0, 1, 2…`);
    let off = 0, gap = 0;
    E.forEach(([s, t], k) => { if (s === t) return; const p = r.paths[k], pts = p.points, last = pts[pts.length - 1];
      if (Math.abs(r.pos[s].x - r.pos[t].x) < (D[s].w + D[t].w) / 2 && Math.abs(r.pos[s].y - r.pos[t].y) < (D[s].h + D[t].h) / 2) return; // overlapping boxes: centers
      if (!onBorder(pts[0], r.pos[s], D[s]) || !onBorder(p.tip, r.pos[t], D[t])) off++;
      const L0 = pts.reduce((a, q, j) => a + (j ? Math.hypot(q.x - pts[j - 1].x, q.y - pts[j - 1].y) : 0), 0);
      if (L0 > 20 && Math.abs(Math.hypot(p.tip.x - last.x, p.tip.y - last.y) - 8) > 0.5 && pts.length === 2) gap++; });
    if (off) bad.push(`model ${i}: ${off} paths do not start and end on the borders of the classes at the returned positions`);
    if (gap) bad.push(`model ${i}: ${gap} paths do not stop an arrowhead's length short of their end class`);
  });
  return bad;
}
// 8. keeping a drawing and relation classes: draw(..., { keep, exact: true }) leaves every old class exactly where it was and puts
//    no new class on another; draw(..., { keep }) moves old classes less than a tenth of the drawing; a relation class
//    (between: [a, b]) off the line with room on it goes onto the line, and inline() never adds more than one crossing per class
function checkKeep(L) {
  const bad = [], A = L.api || {};
  if (typeof A.placeNew !== 'function' || typeof A.inline !== 'function') return ['OntologyLayouts.placeNew or .inline missing'];
  const problems = (P, D, E) => { let c = 0;
    E.forEach(([s, t], k) => { if (s === t) return; D.forEach((d, u) => { if (u !== s && u !== t && L.segBox(P[s].x - P[u].x, P[s].y - P[u].y, P[t].x - P[u].x, P[t].y - P[u].y, d.w / 2 + 9, d.h / 2 + 9)) c += 10; });
      E.forEach(([a, b], f) => { if (f > k && a !== b && a !== s && a !== t && b !== s && b !== t && L.segX(P[s], P[t], P[a], P[b])) c += 6; }); });
    return c; };
  MODELS.forEach((m, i) => {
    const n = m.D.length, isNew = (v) => v % 5 === 2, old = [...Array(n).keys()].filter((v) => !isNew(v)), at = new Map(old.map((v, j) => [v, j]));
    const E1 = m.edges.filter((e) => !isNew(e[0]) && !isNew(e[1])).map((e) => [at.get(e[0]), at.get(e[1]), e[2]]);
    const d1 = A.draw(old.map((v) => m.D[v]), E1, {}), keep = Array.from({ length: n }, (_, v) => (isNew(v) ? null : d1.pos[at.get(v)]));
    const ex = A.draw(m.D, m.edges, { keep, exact: true }).pos;
    if (old.some((v) => ex[v].x !== keep[v].x || ex[v].y !== keep[v].y)) bad.push(`model ${i}: exact keeping moved an old class`);
    for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) if ((isNew(u) || isNew(v)) && Math.abs(ex[u].x - ex[v].x) < (m.D[u].w + m.D[v].w) / 2 && Math.abs(ex[u].y - ex[v].y) < (m.D[u].h + m.D[v].h) / 2) { bad.push(`model ${i}: a new class placed on another`); u = v = 1e9; }
    const so = A.draw(m.D, m.edges, { keep }).pos; let x1 = 1e18, x2 = -1e18, y1 = 1e18, y2 = -1e18, mv = 0;
    old.forEach((v) => { x1 = Math.min(x1, keep[v].x); x2 = Math.max(x2, keep[v].x); y1 = Math.min(y1, keep[v].y); y2 = Math.max(y2, keep[v].y); mv += Math.hypot(so[v].x - keep[v].x, so[v].y - keep[v].y); });
    if (mv / old.length > 0.1 * Math.hypot(x2 - x1, y2 - y1)) bad.push(`model ${i}: keeping moved the old classes by more than a tenth of the drawing`);
  });
  // a relation class pulled off its line, with room on the line
  { const D = [{ w: 80, h: 30 }, { w: 80, h: 30 }, { w: 90, h: 30, between: [0, 1] }, { w: 80, h: 30 }], E = [[0, 2, 1], [2, 1, 1], [3, 0, 1]];
    const P = A.inline([{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 250, y: 220 }, { x: -200, y: 0 }], D, E);
    if (Math.abs(P[2].y) > 20) bad.push(`a relation class with room on its line stayed ${Math.round(P[2].y)} px off it`); }
  // every third relationship made a class: inline adds at most one crossing (6) per relation class
  MODELS.concat([model(7, 40, 6)]).forEach((m, i) => {
    const D = m.D.map((d) => ({ ...d })), E = []; let r = 0, R = 0;
    m.edges.forEach((e) => { if (e[2] === 1 && r++ % 3 === 0) { const c = D.length; D.push({ w: 90, h: 20, between: [e[0], e[1]] }); E.push([e[0], c, 1], [c, e[1], 1]); R++; } else E.push(e); });
    const t0 = L.now(), P = L.auto(D, E, { seed: 1 }).pos.map((p) => ({ x: p.x, y: p.y })); L.sep(P, D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 200);
    const Q = A.inline(P, D, E), a = problems(P, D, E), b = problems(Q, D, E);
    if (b > a + 6 * R) bad.push(`model ${i}: putting relation classes on their lines added ${b - a} in problems for ${R} classes`);
  });
  return bad;
}
function runAll(code) {
  const out = { clock: checkClock(code) }, L = load(code);
  out.grid = checkGrid(L); out.repeatable = checkRepeatable(L); out.tree = checkTree(L); out.routes = checkRoutes(L); out.moves = checkMoves(L); out.pull = checkPull(L); out.api = checkApi(L); out.keep = checkKeep(L);
  return out;
}

const src = fs.readFileSync(appPath, 'utf8'), code = layoutCode(src);
if (process.argv.includes('--self-test')) {
  // each fixture breaks one thing; the matching check must report it
  const fixtures = [
    ['clock', 'a wall-clock read in a layout function', code.replace('function _ogClCrossings(P, EE) {', 'function _ogClCrossings(P, EE) { const _t = performance.now();')],
    ['grid', 'the grid skips every third cell along a link', code.replace('f(cy * G.cols + cx);', 'if ((cx + cy) % 3) f(cy * G.cols + cx);')],
    ['repeatable', 'the layout depends on the wall clock', code.replace('function _ogNow() {', 'function _ogNow() { return performance.now() * 37 % 1e9;')],
    ['tree', 'the tree gap ignores the lines to far children', code.replace('if (room > 1) G = Math.max(G,', 'if (room > 1e9) G = Math.max(G,')],
    ['tree', 'levels by the shallowest superclass, not the deepest', code.replace('atLeast[k] = Math.max(atLeast[k], level[v] + 1);', 'atLeast[k] = atLeast[k] || level[v] + 1;')],
    ['routes', 'parallel links all on the straight line', code.replace('off: ks.map((_, i) => (i - (ks.length - 1) / 2) * o.sep)', 'off: ks.map(() => 0)')],
    ['routes', 'self-links left without a loop', code.replace('R[k].loop = [{', 'R[k].nope = [{')],
    ['routes', 'bends kept even when they make things worse', code.replace('if (r.c < best.c - 0.5) { best = r; bestW = w; }', 'if (r.c > best.c) { best = r; bestW = w; }').replace('if (bestW !== b.way && best.c < c0 - 0.5) {', 'if (bestW !== b.way) {')],
    ['routes', 'the routing checks not counted on the work clock', code.replace('_ogWorkN[2] += 14 * (n + m) + pl.length * 28; _ogWorkN[5]++;', '').replace('_ogClSegX(a, b, cc, d)', '_ogFreeX(a, b, cc, d)').replace('if (_ogClSegBox(ax, ay, bx, by, hw, hh)) return true;', 'if (_ogFreeBox(ax, ay, bx, by, hw, hh)) return true;')
      + '\nfunction _ogFreeX(a, b, c, d) { const w = _ogWorkN[0], r = _ogClSegX(a, b, c, d); _ogWorkN[0] = w; return r; }\nfunction _ogFreeBox(a, b, c, d, e, f) { const w = _ogWorkN[1], r = _ogClSegBox(a, b, c, d, e, f); _ogWorkN[1] = w; return r; }\n'],
    ['routes', 'classes pushed onto the link and kept even when worse', code.replace('if (score(_ogRouteMetrics(Q, items, edges, r2.routes, o.pad)) < score(_ogRouteMetrics(pos, items, edges, r.routes, o.pad)))', 'if (true)').replace('best = { need, nx: (dd < 0 ? -1 : 1) * nx, ny: (dd < 0 ? -1 : 1) * ny }', 'best = { need: need + 2 * Math.abs(dd), nx: (dd < 0 ? 1 : -1) * nx, ny: (dd < 0 ? 1 : -1) * ny }')],
    ['moves', 'a class pushed off a link even when that is worse', code.replace('if (!overlaps(v) && cost(v) < before - 0.5) return true;', 'if (!overlaps(v)) return true;')],
    ['moves', 'a leaf moved to the spot with the most problems', code.replace('if (x >= now) continue;', 'if (x > 1e9) continue;').replace('const sc = x * 200 - room(v, c) + 0.2 * r;', 'const sc = -x * 200;')],
    ['pull', 'a part pulled in even when that adds problems', code.replace('if (c1.c <= c0.c) {', 'if (true) {').replace("if ((!best || sc > best.sc) && cost(S, inS).c <= c0.c)", "if (!best || sc > best.sc)")],
    ['pull', 'parts pulled in on top of other classes', code.replace('if (!clash(S, inS, o.room) && (sc === 1 || gapsOk(S))) {', 'if (sc === 1 || gapsOk(S)) {').replace('if (inward > 30 && !clash(S, inS, o.groupRoom, true)) {', 'if (inward > 30) {')],
    ['api', 'routeLinks left out of OntologyLayouts', code.replace('routeLinks: _ogRouteLinks,', '')],
    ['api', 'paths not clipped at the start class', code.replace('if (i < pl.length - 1 && inside(pl[i], A, items[s])) pl =', 'if (false) pl =')],
    ['api', 'draw() returns the positions before the routing moved classes', code.replace('return { pos: rr.pos, routes: rr.routes,', 'return { pos: clean, routes: rr.routes,')],
    ['api', 'no room left for the arrowhead', code.replace('let rem = Math.min(o.arrow,', 'let rem = Math.min(0,')],
    ['keep', 'exact keeping still runs the clean-up', code.replace('const clean = ex ? lay.pos :', 'const clean = false ? lay.pos :')],
    ['keep', 'new classes placed without looking for a free spot', code.replace('const free = (v, p) => { _ogWorkN[2] += n;', 'const free = (v, p) => { return true;')],
    ['keep', 'the earlier positions ignored', code.replace('(keep && keep[v] && isFinite(keep[v].x)', '(false && keep[v] && isFinite(keep[v].x)')],
    ['keep', 'relation classes left off their line', code.replace('if (!R.length || n > 1500) return P;', 'return P;')],
    ['keep', 'relation classes moved whatever it costs', code.replace('if (c1 <= c0 + 6) {', 'if (true) {')],
  ];
  let ok = true;
  for (const [check, what, broken] of fixtures) {
    if (broken === code) { console.log('FIXTURE NOT APPLIED:', what); ok = false; continue; }
    let res; try { res = runAll(broken)[check]; } catch (err) { res = ['threw: ' + err.message]; }
    console.log(res.length ? 'fires' : 'MISSED', '-', check, '-', what);
    if (!res.length) ok = false;
  }
  console.log(ok ? 'self-test ok' : 'self-test FAILED'); process.exit(ok ? 0 : 1);
}
const res = runAll(code), fails = Object.entries(res).flatMap(([k, v]) => v.map((x) => k + ': ' + x));
if (fails.length) { fails.forEach((f) => console.log(f)); process.exit(1); }
console.log('ontology layout clean');
