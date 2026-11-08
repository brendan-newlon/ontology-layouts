// Link routing after the layout (_ogRouteLinks): measured on the drawn paths, on the recorded drawings in results_ours.json
// (no layout is rerun, so variants of the routing are compared on the same drawings).
// node routebench.mjs [set: dev|held|public|all] [algo: "Best Read (ours)"] [optionsJSON]
// Prints, per set, the straight-line baseline and each routing step added in turn. Link names are derived ("has" + the
// target class, "relatedTo" + target for a second link the same way, ...) since the graphs carry none; subclass links get none.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
execSync('node build_base.mjs', { cwd: here }); execSync('node mkbundle.mjs', { cwd: here });
const { OURS: O } = await import('./_bundle.mjs?' + Date.now());
const rows = JSON.parse(fs.readFileSync(new URL('./results_ours.json', import.meta.url), 'utf8'));
const DEV = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'];
const set = process.argv[2] || 'all', algo = process.argv[3] || 'Best Read (ours)', extra = process.argv[4] ? JSON.parse(process.argv[4]) : {};
const inSet = (k) => set === 'all' ? !['huge', 'sf120', 'sf250', 'sf400'].includes(k) : set === 'dev' ? DEV.includes(k) : set === 'held' ? k.startsWith('hx_') : set === 'public' ? k.startsWith('pb_') : set.split(',').includes(k);

import { names } from './routenames.mjs';
const STEPS = [
  ['straight', { bends: false, ports: 0, labels: false, sep: 0 }],
  ['+ parallel arcs', { bends: false, ports: 0, labels: false }],
  ['+ bends (through)', { crossBends: false, ports: 0, labels: false }],
  ['+ bends (crossings too)', { ports: 0, labels: false }],
  ['+ ports', { labels: false }],
  ['+ names at middle', { labels: true, labelMid: true }],
  ['+ names placed', { labels: true }],
];
const tot = STEPS.map(() => ({ cross: 0, sharp: 0, thru: 0, hidden: 0, ends: 0, labelOver: 0, labelCrossed: 0, bends: 0, area: 0, ms: 0, g: 0 }));
for (const r of rows.filter((r) => r.algo === algo && inSet(r.key))) {
  const P = r.pos.map(([x, y]) => ({ x, y })), N = r.box.map((w) => ({ w, h: 20 })), nm = names(r.labels, r.edges);
  const edges = r.edges.map(([s, t, sub], k) => [s, t, sub ? 2 : 1, nm[k] ? nm[k].length * 6 + 8 : 0]);
  STEPS.forEach(([name, opt], i) => {
    const t0 = O.now(); let routes;
    if (opt.labelMid) { routes = O.route(P, N, edges, { ...extra, labels: false }).routes; routes.forEach((ro, k) => { if (edges[k][3]) { const pl = O.routePoly(P[edges[k][0]], P[edges[k][1]], ro, 8), c = pl[pl.length >> 1]; ro.label = { x: c.x, y: c.y, w: edges[k][3], h: 14 }; } }); }
    else routes = O.route(P, N, edges, { ...extra, ...opt }).routes;
    const ms = O.now() - t0, m = O.routeMetrics(P, N, edges, opt.labels ? routes : routes.map((x) => ({ ...x, label: null })));
    for (const f in m) tot[i][f] += m[f]; tot[i].ms = Math.max(tot[i].ms, ms); tot[i].g++;
    if (process.env.RB_VERBOSE) console.log(r.key.padEnd(12), name.padEnd(24), JSON.stringify(m), Math.round(ms) + 'ms');
  });
}
console.log(`${set} (${tot[0].g} graphs, ${algo})`);
console.log('step'.padEnd(26), 'cross sharp thru hidden ends labelOver labelCrossed bends area/graph max ms');
STEPS.forEach(([name], i) => { const t = tot[i]; console.log(name.padEnd(26), [t.cross, t.sharp, t.thru, t.hidden, t.ends, t.labelOver, t.labelCrossed, t.bends].map((x) => String(x).padStart(5)).join(' '), (t.area / t.g).toFixed(1).padStart(6), Math.round(t.ms)); });
