// Do the layouts and the clean-up depend on boxes sized by their labels? Lays out the graphs with three kinds of boxes and
// measures as the rankings do (crossed links, links through classes within 3 px, area), for Best Read with the clean-up and
// for d3-force (a widely used open-source layout, given each box's size for collisions), both with the same overlap removal.
//   label:   width from the label (6.6 px a character + 10), height 20, as in every other benchmark
//   uniform: every box 60 x 40 (nodes drawn as same-size shapes, labels outside or inside)
//   varied:  widths 40 to 220 and heights 20 to 90 px, from a fixed seed (icons, cards, nodes with several lines of text)
// node sizebench.mjs [dev|held|public|keys]   (needs d3-force in node_modules; builds the bundle first)
import { execSync } from 'node:child_process';
import * as d3 from 'd3-force';
const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
execSync('node build_base.mjs', { cwd: here }); execSync('node mkbundle.mjs', { cwd: here });
const { MODELS, OURS: O } = await import('./_bundle.mjs');
const DEV = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'];
const set = process.argv[2] || 'dev';
const keys = set === 'dev' ? DEV : set === 'held' ? Object.keys(MODELS).filter((k) => k.startsWith('hx_') && k !== 'hx_md1200') : set === 'public' ? Object.keys(MODELS).filter((k) => k.startsWith('pb_') && k !== 'pb_cl') : set.split(',');
const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const SIZES = {
  label: (M) => M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 })),
  uniform: (M) => M.labels.map(() => ({ w: 60, h: 40 })),
  varied: (M) => { const r = rng(7); return M.labels.map(() => ({ w: Math.round(40 + 180 * r()), h: Math.round(20 + 70 * r()) })); }
};
function force(D, edges) {
  const nodes = D.map((d, i) => ({ x: 100 * Math.cos(i), y: 100 * Math.sin(i), r: Math.hypot(d.w, d.h) / 2 + 8 }));
  const sim = d3.forceSimulation(nodes).stop()
    .force('link', d3.forceLink(edges.map(([s, t]) => ({ source: s, target: t }))).distance(170))
    .force('charge', d3.forceManyBody().strength(-300)).force('collide', d3.forceCollide((d) => d.r)).force('center', d3.forceCenter(0, 0));
  for (let i = 0; i < 300; i++) sim.tick();
  return nodes.map((p) => ({ x: p.x, y: p.y }));
}
const T = {};
for (const key of keys) {
  const M = await MODELS[key].load(), raw = M.edges.filter((e) => e.s !== e.t), edges = raw.map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), E = edges.map(([s, t]) => ({ s, t }));
  for (const [sz, mk] of Object.entries(SIZES)) {
    const D = mk(M), N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), A = D.reduce((a, d) => a + d.w * d.h, 0);
    const box = (P) => { let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity; P.forEach((p, i) => { x1 = Math.min(x1, p.x - D[i].w / 2); x2 = Math.max(x2, p.x + D[i].w / 2); y1 = Math.min(y1, p.y - D[i].h / 2); y2 = Math.max(y2, p.y + D[i].h / 2); }); return (x2 - x1) * (y2 - y1) / A; };
    const runs = {
      ours: () => { const t0 = O.now(), r = O.auto(D, edges, { seed: 1 }); const P = r.pos.map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200); return O.cleanUp(P, D, edges, t0, r.algo === 'tree').map((p) => ({ x: p.x, y: p.y })); },
      d3: () => { const P = force(D, edges); O.sep(P, N, 6, 200); return P; }
    };
    for (const [name, run] of Object.entries(runs)) {
      const P = run(); O.sep(P, N, 6, 200);
      const m = O.pmetrics(P, D.map((d) => ({ w: d.w + 6, h: d.h + 6 })), E), t = (T[sz + ' ' + name] = T[sz + ' ' + name] || { cross: 0, thru: 0, area: 0, g: 0 });
      t.cross += m.cross; t.thru += m.thru; t.area += box(P); t.g++;
    }
  }
}
console.log(`${set} (${keys.length} graphs): totals of crossed links and links through classes (3 px), mean area / box area`);
for (const [k, t] of Object.entries(T)) console.log(k.padEnd(14), 'cross', String(t.cross).padStart(5), ' thru', String(t.thru).padStart(4), ' area', (t.area / t.g).toFixed(1));
