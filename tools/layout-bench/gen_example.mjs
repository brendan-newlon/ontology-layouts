// Records the worked example of the write-up: one graph laid out with Best Read (no clean-up), then the clean-up with every step
// recorded. Picks the kept crowd spread with the most problems that moves less than 60% of the classes, and stores the drawing
// before it, right after the push, after its repair moves, and at the end of the clean-up. Output: example.json.
// The example runs the stages in the order a person works (spread the worst region first, then the easy fixes); the layouts
// themselves spread after the single moves and leaf units, which measured slightly better. Run: node gen_example.mjs [graph] [budget ms] [starts file]
import fs from 'node:fs';
const { MODELS, OURS } = await import('./_bundle.mjs');
await import('./handtidy.js');
const HT = globalThis.HandTidy;
const g = process.argv[2] || 'bio', budget = +(process.argv[3] || 600), startsFile = process.argv[4];
const Md = await MODELS[g].load();
const D = Md.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 }));
const edges = Md.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]);
const E = edges.map(([s, t]) => ({ s, t }));
let P0;
if (startsFile) P0 = JSON.parse(fs.readFileSync(startsFile, 'utf8'))[g].map(([x, y]) => ({ x, y }));
else { P0 = OURS.auto(D.map((d) => ({ ...d })), edges, { seed: 1 }).pos.map((p) => ({ x: p.x, y: p.y })); OURS.sep(P0, D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 200); }
const r = HT.run(P0, D, E, { budgetMs: budget, record: true, order: ['spread', 'single', 'unit', 'group'] });
// replay to the chosen step
const apply = (P, s) => { if (s.kind === 'move' || s.kind === 'unit' || s.kind === 'spread') s.nodes.forEach((v, i) => (P[v] = { x: s.to[i][0], y: s.to[i][1] })); if (s.kind === 'group') s.after.forEach(([v, x, y]) => (P[v] = { x, y })); };
const steps = r.log.filter((s) => s.kind === 'spread' && s.pushed && s.nodes.length < 0.6 * D.length).sort((a, b) => b.problems - a.problems);
if (!steps.length) throw new Error('no local spread on ' + g);
const pick = steps[0], P = P0.map((p) => ({ ...p }));
let before = null, after = null, idx = -1;
r.log.forEach((s, i) => { if (s === pick) { before = P.map((p) => ({ ...p })); apply(P, s); after = P.map((p) => ({ ...p })); idx = i; } else apply(P, s); });
const pushedP = before.map((p) => ({ ...p })); pick.pushed.forEach(([v, x, y]) => (pushedP[v] = { x, y }));
const later = r.log.slice(idx + 1).filter((s) => ['move', 'unit', 'spread', 'group'].includes(s.kind)).map((s) => ({ kind: s.kind, nodes: s.kind === 'group' ? s.after.map((a) => a[0]) : s.nodes, anchor: s.anchor }));
const round = (A) => A.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
const grid = HT.openSpace(before, D, E);
const out = {
  graph: g, labels: Md.labels, w: D.map((d) => d.w), edges: edges.map(([s, t, w]) => [s, t, w === 2 ? 1 : 0]),
  start: round(P0), before: round(before), pushed: round(pushedP), repaired: round(after), end: round(r.P),
  region: { center: pick.center, r0: pick.r0, cells: pick.cells, cell: pick.cell, room: pick.room, problems: pick.problems, moved: pick.nodes, pushedSet: pick.pushed.map((a) => a[0]) },
  open: { s: grid.s, cells: grid.open.map((c) => [Math.round(c.x), Math.round(c.y)]) },
  later, measures: { start: HT.measure(P0, D, E), before: HT.measure(before, D, E), pushed: HT.measure(pushedP, D, E), repaired: HT.measure(after, D, E), end: HT.measure(r.P, D, E) }, ms: r.stats.ms
};
fs.writeFileSync(process.env.EX_OUT || new URL('example.json', import.meta.url), JSON.stringify(out));
console.log(g, 'region', JSON.stringify(out.region.center), 'r0', out.region.r0, 'problems', out.region.problems, 'moved', out.region.moved.length, 'later steps', later.length, JSON.stringify(out.measures));
