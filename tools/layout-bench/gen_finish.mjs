// Records the second part of the write-up's worked example: the finishing passes after the clean-up (leaves trade places,
// out of a fence of lines and off a line they run through, pulled in from the edge), on one graph drawn by Best Read and
// cleaned up. Stores the drawing after the clean-up and after each pass that moved something, with the counts.
// Output: finish.json. Run: node gen_finish.mjs [graph]   (run build_base.mjs and mkbundle.mjs first)
import fs from 'node:fs';
const { MODELS, OURS } = await import('./_bundle.mjs');
await import('./handtidy.js');
const HT = globalThis.HandTidy, g = process.argv[2] || 'pizza';
const Md = await MODELS[g].load(), D = Md.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 }));
const edges = Md.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), E = edges.map(([s, t]) => ({ s, t }));
const P0 = OURS.auto(D.map((d) => ({ ...d })), edges, { seed: 1 }).pos.map((p) => ({ x: p.x, y: p.y })); OURS.sep(P0, D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 200);
const run = HT.run(P0, D, E, { budgetMs: 500, record: true }), P1 = run.P, snaps = {};
OURS.traced({ snap: (k, P) => (snaps[k] = P.map((p) => ({ x: p.x, y: p.y }))), begin() {}, restart() {}, score() {}, chosen() {} }, () => { const Q = OURS.leafSwap(P1, D, edges); OURS.pullIn(Q, D, edges); });
const round = (A) => A.map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
const size = (P) => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; P.forEach((p, i) => { a = Math.min(a, p.x - D[i].w / 2); c = Math.max(c, p.x + D[i].w / 2); b = Math.min(b, p.y - 10); d = Math.max(d, p.y + 10); }); return [Math.round(c - a), Math.round(d - b)]; };
const swap = snaps.swap || P1, fence = snaps.nudge || snaps.fence || swap, pull = snaps.pull || fence;
const frames = { start: P0, clean: P1, swap, fence, pull }, out = { graph: g, labels: Md.labels, w: D.map((d) => d.w), edges: edges.map(([s, t, w]) => [s, t, w === 2 ? 1 : 0]) };
for (const [k, P] of Object.entries(frames)) out[k] = { pos: round(P), m: { ...HT.measure(P, D, E), size: size(P) } };
// what the clean-up proper did (kept steps by kind) and the open space before it, for a walk-through of the whole clean-up
const kinds = {}; (run.log || []).forEach((st) => { if (['move', 'unit', 'spread', 'group'].includes(st.kind)) kinds[st.kind] = (kinds[st.kind] || 0) + 1; });
const grid = HT.openSpace(P0, D, E); out.cleanSteps = kinds; out.open = { s: grid.s, cells: grid.open.map((c) => [Math.round(c.x), Math.round(c.y)]) };
fs.writeFileSync(process.env.FX_OUT || new URL('finish.json', import.meta.url), JSON.stringify(out));
console.log(g, Object.entries(frames).map(([k]) => k + ' ' + JSON.stringify(out[k].m)).join('\n'));
