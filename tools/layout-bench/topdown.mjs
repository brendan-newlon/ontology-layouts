// Top-down drawings with the clean-up as shipped: the Tree, and Tidy Stress and Best Read with every subclass at least 40 px
// below its superclass (engines3.js, constrained stress in the spirit of IPSep-CoLa), each followed by the clean-up in its
// top-down mode. Measured as ours_rows.mjs measures; compare with the recorded top-down open-source rows.
// node topdown.mjs dev|held|public|<keys> <out.json>   (run build_base.mjs and mkbundle.mjs first)
import fs from 'node:fs';
const { MODELS, OURS: O, EXP3 } = await import('./_bundle.mjs');
const stdMetrics = new Function(fs.readFileSync(new URL('./stdmetrics.js', import.meta.url), 'utf8') + '\nreturn stdMetrics;')();
const DEV = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'];
const arg = process.argv[2] || 'dev';
const keys = arg === 'dev' ? DEV : arg === 'held' ? Object.keys(MODELS).filter((k) => k.startsWith('hx_') && !/1200/.test(k))
  : arg === 'public' ? Object.keys(MODELS).filter((k) => k.startsWith('pb_') && k !== 'pb_cl') : arg.split(',');
const td = (f) => (it, ed, s, N) => { const t0 = O.now(), r = f(it, ed, s), P = (r.pos || r).map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200); return O.cleanUp(P, it, ed, t0, true); };
const ALGOS = {
  'Tree (ours)': td((it, ed, s) => O.tree(it, ed, { seed: s })),
  'Tidy Stress, top-down (ours)': td((it, ed, s) => EXP3.compactF(it, ed, { seed: s })),
  'Best Read, top-down (ours)': td((it, ed, s) => EXP3.autoF(it, ed, { seed: s }))
};
const rows = [];
for (const key of keys) {
  const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 })), items = D.map((d) => ({ w: d.w, h: d.h }));
  const edges = M.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), E = edges.map(([s, t]) => ({ s, t }));
  const N = D.map((d) => ({ w: d.w + 16, h: d.h + 12 }));
  for (const [algo, f] of Object.entries(ALGOS)) {
    const t0 = performance.now(); let P; try { P = f(items, edges, 1, N); } catch (e) { console.log(key, algo, 'failed', e.message); continue; }
    const ms = performance.now() - t0;
    P = P.map((p) => ({ x: p.x, y: p.y })); O.sep(P, N, 6, 200);
    const m = O.pmetrics(P, D.map((d) => ({ w: d.w + 6, h: d.h + 6 })), E), ml = O.pmetrics(P, N, E);
    rows.push({ key, algo, seed: 1, n: N.length, links: E.length, cross: m.cross, thru: m.thru, fill: ml.fill, ov: ml.ov, ms,
      ...stdMetrics(P, M.edges.filter((e) => e.s !== e.t).map((e) => ({ s: e.s, t: e.t, sub: e.kind === 'sub' }))) });
  }
  console.log(key, rows.filter((r) => r.key === key).map((r) => r.algo.split(',')[0].split(' (')[0] + ' x' + r.cross + ' th' + r.thru + ' down' + (r.down == null ? '-' : Math.round(r.down * 100)) + '% ' + Math.round(r.ms) + 'ms').join(' | '));
}
fs.writeFileSync(process.argv[3] || '../../_temp/topdown.json', JSON.stringify(rows));
