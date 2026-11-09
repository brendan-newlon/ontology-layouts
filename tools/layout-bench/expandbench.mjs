// Exploring a graph: sessions that start from one class (or a class and its neighbours) and expand one class at a time, as a
// graph browser does when a reader clicks a class to show its hidden neighbours. Each step is drawn four ways, links straight:
//   force   a typical force-directed expansion (d3-force, ISC licence): classes already shown are pinned, new ones start
//           beside the class that was expanded and settle under link, repulsion and collision forces (300 ticks)
//   exact   OntologyLayouts.draw(..., { keep, exact: true }): nothing already shown moves
//   keep    OntologyLayouts.draw(..., { keep }): classes already shown may move a little (clean-up)
//   redraw  OntologyLayouts.draw from scratch at every step
// Measured with routeMetrics (crossings, links through classes within 9 px, names over a class or name), plus how far the
// classes already shown moved, as a share of the earlier drawing's diagonal, and the time per step.
// CURVED=1: our drawings with the routing's bends and arcs (the force rows stay straight).
// node expandbench.mjs [graph keys] [strategies] [steps]   (needs d3-force in node_modules; run build_base.mjs and mkbundle.mjs first)
import * as d3 from 'd3-force';
import { names } from './routenames.mjs';
const { MODELS, OURS: O } = await import('./_bundle.mjs');
const OL = O.api;
const KEYS = (process.argv[2] || 'crm,health,pizza,fibo,schema,telecom,sosa,big,hx_md70,hx_md160,hx_mesh,hx_rings').split(',');
const CURVED = process.env.CURVED === '1'; // links drawn with the routing's bends and arcs instead of straight
const STRATS = (process.argv[3] || 'force,exact,keep,redraw').split(','), STEPS = +(process.argv[4] || 8), CAP = 15;
const rng = (seed) => { let a = seed | 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

function session(G, start, seed) {
  const n = G.labels.length, R = rng(seed), adj = Array.from({ length: n }, () => new Set());
  G.links.forEach(([s, t]) => { adj[s].add(t); adj[t].add(s); });
  const cand = [...Array(n).keys()].filter((v) => adj[v].size >= 2), first = cand[Math.floor(R() * cand.length)];
  let shown = [first];
  if (start === 'part') { const set = new Set([first]); let front = [first];
    for (let d = 0; d < 2 && set.size < 6; d++) { const nx = []; front.forEach((v) => [...adj[v]].sort((a, b) => a - b).forEach((w) => { if (!set.has(w) && set.size < 15) { set.add(w); nx.push(w); } })); front = nx; }
    shown = [...set]; }
  const steps = [{ add: shown, anchor: null }], on = new Set(shown);
  for (let k = 0; k < STEPS; k++) {
    const open = [...on].filter((v) => [...adj[v]].some((w) => !on.has(w))); if (!open.length) break;
    const a = open[Math.floor(R() * open.length)], add = [...adj[a]].filter((w) => !on.has(w)).sort((x, y) => x - y).slice(0, CAP);
    add.forEach((w) => on.add(w)); steps.push({ add, anchor: a });
  }
  return steps;
}
function force(boxes, links, prev, anchor, seed) {
  const R = rng(seed), nodes = boxes.map((b, i) => {
    if (prev[i]) return { x: prev[i].x, y: prev[i].y, fx: prev[i].x, fy: prev[i].y, r: Math.hypot(b.w, b.h) / 2 + 8 };
    const c = anchor != null && prev[anchor] ? prev[anchor] : { x: 0, y: 0 }, a = R() * 2 * Math.PI;
    return { x: c.x + 60 * Math.cos(a), y: c.y + 60 * Math.sin(a), r: Math.hypot(b.w, b.h) / 2 + 8 };
  });
  const sim = d3.forceSimulation(nodes).stop()
    .force('link', d3.forceLink(links.filter(([s, t]) => s !== t).map(([s, t]) => ({ source: s, target: t }))).distance(170))
    .force('charge', d3.forceManyBody().strength(-300)).force('collide', d3.forceCollide((d) => d.r));
  if (!prev.length) sim.force('center', d3.forceCenter(0, 0));
  sim.tick(300);
  const pos = nodes.map((d) => ({ x: d.x, y: d.y })), routes = OL.routeLinks(pos, boxes, links, { straight: true, settle: false }).routes;
  return { pos, routes };
}
const draw = (strat, k, boxes, links, prev, anchor) => {
  if (strat === 'force') return force(boxes, links, prev, anchor, k + 1);
  const keep = k && strat !== 'redraw' ? boxes.map((_, i) => prev[i] || null) : null;
  return OL.draw(boxes, links, { route: { straight: !CURVED }, ...(keep ? { keep, exact: strat === 'exact' } : {}) });
};
const T = Object.fromEntries(STRATS.map((s) => [s, { steps: 0, cross: 0, thru: 0, names: 0, move: 0, moveMax: 0, ms: 0, msMax: 0, fcross: 0, fthru: 0, sessions: 0 }]));
for (const key of KEYS) {
  const M = await MODELS[key].load(), raw = M.edges.filter((e) => e.s !== e.t), nm = names(M.labels, raw.map((e) => [e.s, e.t, e.kind === 'sub']));
  const G = { labels: M.labels.map(String), links: raw.map((e, k) => [e.s, e.t, e.kind === 'sub' ? 2 : 1, nm[k] ? nm[k].length * 6 + 8 : 0]) };
  for (const start of ['class', 'part']) for (const seed of [1, 2]) {
    const steps = session(G, start, seed);
    for (const s of STRATS) {
      const order = [], t = T[s]; let prev = [], last = null;
      steps.forEach((st, k) => {
        st.add.forEach((v) => order.push(v));
        const idx = new Map(order.map((v, i) => [v, i])), boxes = order.map((v) => ({ w: G.labels[v].length * 6.6 + 10, h: 20 }));
        const links = G.links.filter(([a, b]) => idx.has(a) && idx.has(b)).map(([a, b, kind, w]) => [idx.get(a), idx.get(b), kind, w]);
        const anchor = st.anchor == null ? null : idx.get(st.anchor), t0 = performance.now(), d = draw(s, k, boxes, links, prev, anchor), ms = performance.now() - t0;
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity; prev.forEach((p) => { x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y); x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y); });
        const diag = Math.max(Math.hypot(x2 - x1, y2 - y1), 600), mv = prev.map((p, i) => Math.hypot(d.pos[i].x - p.x, d.pos[i].y - p.y) / diag);
        const m = O.routeMetrics(d.pos, boxes, links, d.routes);
        t.steps++; t.cross += m.cross; t.thru += m.thru; t.names += m.labelOver; t.ms += ms; t.msMax = Math.max(t.msMax, ms);
        if (mv.length) { t.move += mv.reduce((a, b) => a + b, 0) / mv.length; t.moveMax = Math.max(t.moveMax, ...mv); }
        prev = d.pos.slice(); last = m;
      });
      t.sessions++; t.fcross += last.cross; t.fthru += last.thru;
    }
  }
  process.stderr.write(key + ' ');
}
console.log(`\n${KEYS.length} graphs, ${T[STRATS[0]].sessions} sessions, up to ${STEPS} expansions of up to ${CAP} classes each`);
console.log('strategy  steps | per step: crossed  through  names | earlier classes moved: mean  max | ms: mean  max | last drawing: crossed through');
for (const s of STRATS) { const t = T[s], f = (v) => (v / t.steps).toFixed(1).padStart(7);
  console.log(s.padEnd(8), String(t.steps).padStart(6), '|', f(t.cross), f(t.thru), f(t.names), '|', ((t.move / t.steps) * 100).toFixed(1).padStart(6) + '%', (t.moveMax * 100).toFixed(0).padStart(5) + '%', '|', f(t.ms), Math.round(t.msMax).toString().padStart(5), '|', String(t.fcross).padStart(6), String(t.fthru).padStart(6)); }
