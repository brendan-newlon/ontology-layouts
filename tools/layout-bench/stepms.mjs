// Real time of each step of Best Read with the clean-up and the link routing, per graph (wall ms, this computer).
// node stepms.mjs <comma list of graphs | dev | held | public>
import { execSync } from 'node:child_process';
const here = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
if (!process.env.EB_NOBUILD) { execSync('node build_base.mjs', { cwd: here }); execSync('node mkbundle.mjs', { cwd: here }); }
const { MODELS, OURS: O } = await import('./_bundle.mjs');
const { names } = await import('./routenames.mjs');
const DEV = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'];
const arg = process.argv[2] || 'dev', keys = arg === 'dev' ? DEV : arg === 'held' ? Object.keys(MODELS).filter((k) => k.startsWith('hx_') && k !== 'hx_md1200') : arg === 'public' ? Object.keys(MODELS).filter((k) => k.startsWith('pb_') && k !== 'pb_cl') : arg.split(',');
const tot = {};
for (const key of keys) {
  const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 })), N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 }));
  const raw = M.edges.filter((e) => e.s !== e.t), nm = names(M.labels, raw.map((e) => [e.s, e.t, e.kind === 'sub']));
  const edges = raw.map((e, k) => [e.s, e.t, e.kind === 'sub' ? 2 : 1, nm[k] ? nm[k].length * 6 + 8 : 0]), lay = edges.map((e) => e.slice(0, 3));
  const ms = {}; let last = 0, stage = 'setup';
  const add = (k, v) => { ms[k] = (ms[k] || 0) + v; };
  const sink = { map: null, begin() { const t = performance.now(); add(stage, t - last); last = t; stage = 'start'; }, restart() {}, keepRestart() {},
    snap(st) { const t = performance.now(); add(st, t - last); last = performance.now(); }, score() {}, chosen() {} };
  const t0 = performance.now(); last = t0; const w0 = O.now();
  const r = O.traced(sink, () => O.auto(D, lay, { seed: 1 })); add('other', performance.now() - last);
  let P = r.pos.map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200);
  const t1 = performance.now(); const budgetMs = Math.min(500, 1500 - (O.now() - w0));
  const tr = budgetMs >= 100 ? O.clocked(() => O.tidy.run(P, D, lay.map((e) => ({ s: e[0], t: e[1] })), { budgetMs, record: true })) : null; const t2 = performance.now();
  if (tr) { tr.log.filter((x) => x.kind === 'phase-end').forEach((x) => add('c-' + x.phase, 0)); P = tr.P.map((p) => ({ x: p.x, y: p.y })); }
  add('cleanup', t2 - t1);
  const rr = O.route(P, D, edges); const t3 = performance.now(); add('route', t3 - t2);
  for (const k in rr.stats.t) add('r-' + k, rr.stats.t[k] * (t3 - t2) / (rr.stats.ms || 1));
  console.log(key.padEnd(10), String(Math.round(t3 - t0)).padStart(5) + 'ms', Object.entries(ms).filter(([, v]) => v >= 0.5).map(([k, v]) => k + ' ' + Math.round(v)).join(', '));
  for (const k in ms) tot[k] = (tot[k] || 0) + ms[k];
}
console.log('TOTAL', Object.entries(tot).map(([k, v]) => k + ' ' + Math.round(v)).join(', '));
