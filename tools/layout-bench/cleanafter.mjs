// Does the clean-up (and the link routing after it) make other layouts' drawings good? Starts from a foreign layout, removes
// overlaps (OURS.sep, as every benchmark does), then runs our clean-up and our routing, measured exactly as ekgbench.mjs does
// (OURS.routeMetrics: crossed links, links through classes, sharp crossings, area). Starting layouts, each with seed 1 and 2:
//   d3:      d3-force with the sizebench.mjs settings (link 170, charge -300, collide by box diagonal, 300 ticks)
//   d3pb:    d3-force with the playback.html 'x:d3' settings (random start 600 px, link 170 / 0.6, charge -700, 400 ticks)
//   random:  uniform in a square with the area of Best Read's drawing of the same graph and seed (a worst case)
//   best:    Best Read (OURS.auto then the clean-up as the layouts use it), the reference
// For each: straight measures before the clean-up, after it, and after routing; plus the foreign layout routed without the
// clean-up, so "is the clean-up worth adding when an app already routes with ours" can be counted per graph.
// The clean-up after a foreign layout gets w0 = OURS.now() read just before it, so its full budget: min(500, 1500) = 500 on the
// work clock, which at the default 1000 ms time limit is about 333 ms of reference-laptop work. OURS.tune.noWall = true.
// node cleanafter.mjs [dev|held|public|all|keys] [seeds, default 1,2]   (needs d3-force in node_modules; builds the bundle first)
import { execSync } from 'node:child_process';
import * as d3 from 'd3-force';
const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
if (!process.env.EB_NOBUILD) { execSync('node build_base.mjs', { cwd: here }); execSync('node mkbundle.mjs', { cwd: here }); }
const { MODELS, OURS: O } = await import('./_bundle.mjs');
O.tune.noWall = true;
const DEV = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'];
const SETS = { dev: DEV, held: Object.keys(MODELS).filter((k) => k.startsWith('hx_') && k !== 'hx_md1200'), public: Object.keys(MODELS).filter((k) => k.startsWith('pb_') && k !== 'pb_cl') };
const arg = process.argv[2] || 'all', seeds = (process.argv[3] || '1,2').split(',').map(Number);
const jobs = arg === 'all' ? Object.entries(SETS) : SETS[arg] ? [[arg, SETS[arg]]] : [['keys', arg.split(',')]];
const lcg = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
function d3sb(D, edges) { // sizebench.mjs (deterministic start; the seed does not change it)
  const nodes = D.map((d, i) => ({ x: 100 * Math.cos(i), y: 100 * Math.sin(i), r: Math.hypot(d.w, d.h) / 2 + 8 }));
  const sim = d3.forceSimulation(nodes).stop()
    .force('link', d3.forceLink(edges.map(([s, t]) => ({ source: s, target: t }))).distance(170))
    .force('charge', d3.forceManyBody().strength(-300)).force('collide', d3.forceCollide((d) => d.r)).force('center', d3.forceCenter(0, 0));
  for (let i = 0; i < 300; i++) sim.tick();
  return nodes.map((p) => ({ x: p.x, y: p.y }));
}
function d3pb(D, edges, seed) { // playback.html 'x:d3' (G.N = boxes + 16/+12)
  const N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), r = O.rng(seed), nodes = N.map((d, i) => ({ i, x: (r() - 0.5) * 600, y: (r() - 0.5) * 600 }));
  const sim = d3.forceSimulation(nodes).force('link', d3.forceLink(edges.map(([s, t]) => ({ source: s, target: t }))).distance(170).strength(0.6))
    .force('charge', d3.forceManyBody().strength(-700)).force('collide', d3.forceCollide((n) => Math.max(N[n.i].w, N[n.i].h) / 2 + 6)).force('center', d3.forceCenter(0, 0)).stop();
  for (let k = 0; k < 400; k++) sim.tick();
  return nodes.map((n) => ({ x: n.x, y: n.y }));
}
const KEYS = ['cross', 'thru', 'sharp', 'area'];
const pick = (m) => ({ cross: m.cross, thru: m.thru, sharp: m.sharp, area: m.area });
const T = {}; // T[set][start] = { pre, post, routed, routedNoClean, cleanMs, cleanWork, routeMs, n, winVsAlone, tieVsAlone, lossVsAlone, winVsBest, tieVsBest, lossVsBest }
const PG = []; // per graph rows
for (const [setName, keys] of jobs) for (const key of keys) {
  const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 })), N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 }));
  const raw = M.edges.filter((e) => e.s !== e.t), edges = raw.map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1, 0]), lay = edges.map((e) => e.slice(0, 3));
  const boxA = N.reduce((a, d) => a + d.w * d.h, 0);
  for (const seed of seeds) {
    const res = {};
    // reference: Best Read as ekgbench.mjs runs it
    { const w0 = O.now(), r = O.auto(D, lay, { seed }); let P = r.pos.map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200);
      const pre = pick(O.routeMetrics(P, D, edges, edges.map(() => null)));
      const c0 = O.now(), t0 = performance.now(); P = O.cleanUp(P, D, lay, w0, r.algo === 'tree').map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200);
      const cleanMs = performance.now() - t0, cleanWork = O.now() - c0, post = pick(O.routeMetrics(P, D, edges, edges.map(() => null)));
      const t1 = performance.now(), rr = O.route(P, D, edges), routeMs = performance.now() - t1, routed = pick(O.routeMetrics(rr.pos, D, edges, rr.routes));
      res.best = { pre, post, routed, routedNoClean: null, cleanMs, cleanWork, routeMs, budget: Math.min(500, 1500 - (c0 - w0)) }; }
    const side = Math.sqrt(res.best.post.area * boxA);
    const starts = { d3: () => d3sb(D, lay), d3pb: () => d3pb(D, lay, seed), random: () => { const r = lcg(seed * 7919 + 13); return D.map(() => ({ x: (r() - 0.5) * side, y: (r() - 0.5) * side })); } };
    for (const [name, mk] of Object.entries(starts)) {
      let P = mk(); O.sep(P, N, 6, 200);
      const pre = pick(O.routeMetrics(P, D, edges, edges.map(() => null)));
      const ra = O.route(P.map((p) => ({ x: p.x, y: p.y })), D, edges), routedNoClean = pick(O.routeMetrics(ra.pos, D, edges, ra.routes));
      const w0 = O.now(), t0 = performance.now(); P = O.cleanUp(P, D, lay, w0, false).map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200);
      const cleanMs = performance.now() - t0, cleanWork = O.now() - w0, post = pick(O.routeMetrics(P, D, edges, edges.map(() => null)));
      const t1 = performance.now(), rr = O.route(P, D, edges), routeMs = performance.now() - t1, routed = pick(O.routeMetrics(rr.pos, D, edges, rr.routes));
      res[name] = { pre, post, routed, routedNoClean, cleanMs, cleanWork, routeMs, budget: 500 };
    }
    const prob = (m) => m.cross + m.thru;
    for (const [name, r] of Object.entries(res)) {
      const t = ((T[setName] = T[setName] || {})[name] = T[setName][name] || { pre: {}, post: {}, routed: {}, routedNoClean: {}, cleanMs: 0, cleanMsMax: 0, cleanWork: 0, routeMs: 0, n: 0, wA: 0, tA: 0, lA: 0, wB: 0, tB: 0, lB: 0 });
      for (const s of ['pre', 'post', 'routed', 'routedNoClean']) if (r[s]) for (const f of KEYS) t[s][f] = (t[s][f] || 0) + r[s][f];
      t.cleanMs += r.cleanMs; t.cleanMsMax = Math.max(t.cleanMsMax, r.cleanMs); t.cleanWork += r.cleanWork; t.routeMs += r.routeMs; t.n++;
      if (r.routedNoClean) { const a = prob(r.routed), b = prob(r.routedNoClean); a < b ? t.wA++ : a === b ? t.tA++ : t.lA++; }
      if (name !== 'best') { const a = prob(r.routed), b = prob(res.best.routed); a < b ? t.wB++ : a === b ? t.tB++ : t.lB++; }
    }
    PG.push({ set: setName, key, seed, ...Object.fromEntries(Object.entries(res).map(([k, r]) => [k, { pre: prob(r.pre), routed: prob(r.routed), alone: r.routedNoClean ? prob(r.routedNoClean) : null, ms: Math.round(r.cleanMs) }])) });
    if (process.env.EB_VERBOSE) { const g = PG[PG.length - 1]; console.log(key.padEnd(14), seed, Object.keys(res).map((k) => `${k} ${g[k].pre}->${g[k].routed}${g[k].alone !== null ? ' (alone ' + g[k].alone + ')' : ''} ${g[k].ms}ms`).join(' | ')); }
  }
}
const fmt = (m) => `${String(m.cross).padStart(5)} ${String(m.thru).padStart(5)} ${String(m.sharp).padStart(5)}`;
const merge = (dst, src) => { for (const s of ['pre', 'post', 'routed', 'routedNoClean']) for (const f in src[s]) dst[s][f] = (dst[s][f] || 0) + src[s][f]; for (const f of ['cleanMs', 'cleanWork', 'routeMs', 'n', 'wA', 'tA', 'lA', 'wB', 'tB', 'lB']) dst[f] = (dst[f] || 0) + src[f]; dst.cleanMsMax = Math.max(dst.cleanMsMax || 0, src.cleanMsMax); };
const sets = Object.keys(T); if (sets.length > 1) { T.all = {}; for (const s of sets) for (const [name, t] of Object.entries(T[s])) merge((T.all[name] = T.all[name] || { pre: {}, post: {}, routed: {}, routedNoClean: {} }), t); }
console.log(`seeds ${seeds.join(',')}; columns cross thru sharp (totals), area = mean bbox / box area; "alone" = foreign layout + our routing, no clean-up`);
console.log('W/T/L vs alone and vs Best Read: runs where crossed + through after routing is lower / equal / higher');
for (const [s, byName] of Object.entries(T)) {
  console.log(`\n${s} (${Object.values(byName)[0].n} runs)`);
  console.log('start      before clean-up      after clean-up       after routing        alone routed       area pre/post/rout  clean ms mean/max (work)  route ms  vs alone  vs best');
  for (const [name, t] of Object.entries(byName)) {
    const a = (st) => (t[st].area / t.n).toFixed(1);
    console.log(name.padEnd(8), fmt(t.pre), ' ', fmt(t.post), ' ', fmt(t.routed), ' ', t.routedNoClean.cross !== undefined ? fmt(t.routedNoClean) : '        -        ', ' ', `${a('pre')}/${a('post')}/${a('routed')}`.padEnd(18),
      `${Math.round(t.cleanMs / t.n)}/${Math.round(t.cleanMsMax)} (${Math.round(t.cleanWork / t.n)})`.padEnd(24), String(Math.round(t.routeMs / t.n)).padStart(6),
      name === 'best' ? '     -    ' : `  ${t.wA}/${t.tA}/${t.lA}`.padEnd(10), name === 'best' ? '' : `  ${t.wB}/${t.tB}/${t.lB}`);
  }
}
if (process.env.EB_JSON) (await import('node:fs')).writeFileSync(process.env.EB_JSON, JSON.stringify(PG, null, 1));
