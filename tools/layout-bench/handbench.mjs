// Bench for handtidy.js: node handbench.mjs [budgets ms, comma] [graphs, comma]
// Starts from Best Read (seed 1, same overlap removal as the lab) and reports the Layout Lab measures before and after.
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const { MODELS, OURS } = await import('./_bundle.mjs');
await import('./handtidy.js');
const HT = globalThis.HandTidy;
const GRAPHS = ['prov', 'uni', 'hotel', 'org', 'brewery', 'trial', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'];
const budgets = (process.argv[2] || '500,2000,5000').split(',').map(Number);
const graphs = process.argv[3] ? process.argv[3].split(',') : GRAPHS;
const extra = process.argv[4] ? JSON.parse(process.argv[4]) : {};
const rows = [];
for (const g of graphs) {
  const Md = await MODELS[g].load();
  const D = Md.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 }));
  const edges = Md.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]);
  const E = edges.map(([s, t]) => ({ s, t }));
  const t0 = Date.now();
  const P = OURS.auto(D.map((d) => ({ w: d.w, h: d.h })), edges, { seed: 1 }).pos.map((p) => ({ x: p.x, y: p.y }));
  OURS.sep(P, D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 200);
  const layMs = Date.now() - t0, m0 = HT.measure(P, D, E), row = { graph: g, n: D.length, layMs, before: m0, after: {} };
  for (const b of budgets) {
    const r = HT.run(P, D, E, { budgetMs: b, ...extra });
    if (extra.trace) console.log('  ', g, b, JSON.stringify(r.stats.phase), 'evals', r.stats.evals, 'start', Math.round(r.stats.start), JSON.stringify(r.stats.trace));
    row.after[b] = { ...HT.measure(r.P, D, E), ms: r.stats.ms, units: r.stats.units, unitMoves: r.stats.unitMoves, singleMoves: r.stats.singleMoves, groups: r.stats.groupKept + '/' + r.stats.groupTried, rounds: r.stats.rounds };
    if (b === budgets[budgets.length - 1]) row.P = r.P.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
  }
  rows.push(row);
  const f = (m) => `x${m.cross} th${m.thru} sh${m.sharp} cr${m.tight} A${m.area}`;
  console.log(g.padEnd(8), String(D.length).padStart(3), 'start', f(m0), '|', budgets.map((b) => `${b}ms: ${f(row.after[b])} t${row.after[b].ms} u${row.after[b].unitMoves} s${row.after[b].singleMoves} g${row.after[b].groups}`).join(' | '));
}
const sum = (k, sel) => rows.reduce((s, r) => s + sel(r)[k], 0);
console.log('TOTAL start', ['cross', 'thru', 'sharp', 'tight'].map((k) => k + ' ' + sum(k, (r) => r.before)).join(', '));
for (const b of budgets) console.log(`TOTAL ${b}ms`, ['cross', 'thru', 'sharp', 'tight'].map((k) => k + ' ' + sum(k, (r) => r.after[b])).join(', '), 'time', sum('ms', (r) => r.after[b]), 'ms');
fs.writeFileSync(path.join(here, '..', '..', '_temp', 'handbench_last.json'), JSON.stringify(rows));
