// Best Read with the clean-up, then the link routing, under experimental settings; straight and routed measures.
// node ekgbench.mjs <set: dev|held|public|comma list> '<tuneJSON>' [names: 0|1] [seed]
//   tune: merged into OURS.tune (_OG_TUNE): e.g. {"noTree":true}, {"cleanup":{"W":{"area":3}}}, {"cleanup":{"groupDepth":8}}
//   names 1: the layout gets each link's name width (edges[3]) and reserves room for it
import { execSync } from 'node:child_process';
const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
if (!process.env.EB_NOBUILD) { execSync('node build_base.mjs', { cwd: here }); execSync('node mkbundle.mjs', { cwd: here }); }
const { MODELS, OURS: O } = await import('./_bundle.mjs');
const { names } = await import('./routenames.mjs');
const DEV = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'];
const set = process.argv[2] || 'dev', tune = JSON.parse(process.argv[3] || '{}'), useNames = process.argv[4] === '1', seed = +(process.argv[5] || 1);
Object.assign(O.tune, tune);
const keys = set === 'dev' ? DEV : set === 'held' ? Object.keys(MODELS).filter((k) => k.startsWith('hx_') && !['hx_md1200'].includes(k)) : set === 'public' ? Object.keys(MODELS).filter((k) => k.startsWith('pb_') && k !== 'pb_cl') : set.split(',');
const T = { s: {}, r: {}, ms: 0, msMax: 0, g: 0 }; const add = (a, m) => { for (const f in m) a[f] = (a[f] || 0) + m[f]; };
for (const key of keys) {
  const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 })), N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 }));
  const raw = M.edges.filter((e) => e.s !== e.t), nm = names(M.labels, raw.map((e) => [e.s, e.t, e.kind === 'sub']));
  const edges = raw.map((e, k) => [e.s, e.t, e.kind === 'sub' ? 2 : 1, nm[k] ? nm[k].length * 6 + 8 : 0]);
  const layEdges = useNames ? edges : edges.map((e) => e.slice(0, 3));
  const t0 = performance.now(), w0 = O.now(), r = O.auto(D, layEdges, { seed }); let P = r.pos.map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200);
  P = O.cleanUp(P, D, layEdges, w0, r.algo === 'tree').map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200);
  const rr = O.route(P, D, edges), routes = rr.routes, ms = performance.now() - t0;
  const s = O.routeMetrics(P, D, edges, edges.map(() => null)), ro = O.routeMetrics(rr.pos, D, edges, routes); // the routes belong to rr.pos (classes may move off links)
  add(T.s, s); add(T.r, ro); T.ms += ms; T.msMax = Math.max(T.msMax, ms); T.g++;
  if (process.env.EB_VERBOSE) console.log(key.padEnd(12), r.algo, 'straight', s.cross, s.thru, 'routed', ro.cross, ro.thru, ro.labelOver, Math.round(ms) + 'ms');
}
const f = (m) => `cross ${m.cross} thru ${m.thru} sharp ${m.sharp} hidden ${m.hidden} labelOver ${m.labelOver} labelCrossed ${m.labelCrossed} bends ${m.bends} area ${(m.area / T.g).toFixed(1)}`;
console.log(`${set} ${JSON.stringify(tune)} names=${useNames ? 1 : 0} seed=${seed} (${T.g} graphs)\n  straight: ${f(T.s)}\n  routed:   ${f(T.r)}\n  time: mean ${Math.round(T.ms / T.g)} ms, max ${Math.round(T.msMax)} ms`);
