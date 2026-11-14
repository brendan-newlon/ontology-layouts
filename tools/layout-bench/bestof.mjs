// For the Layout Lab's graph list: on every graph it offers, how many problems each of our layouts leaves (seed 1, boxes with
// the name on them, as the page opens), after the clean-up and the link drawing exactly as the page runs them.
// Problems = crossed links + links through classes + covered names + overlapping boxes, measured after routing.
// Writes bestof.json, which the page reads to mark the graphs where the chosen layout is not the best of ours.
//   node bestof.mjs            (a few minutes; run again after a change to a layout)
import fs from 'node:fs';
import { names } from './routenames.mjs';
const here = (f) => new URL(f, import.meta.url);
const base = fs.readFileSync(here('_bundle.mjs'), 'utf8'), cut = base.lastIndexOf('\nconst OURS = window.OURS;');
if (cut < 0) throw new Error('_bundle.mjs: export block not found; run mkbundle.mjs');
fs.writeFileSync(here('_bundle_bo.mjs'), base.slice(0, cut) + '\n' + fs.readFileSync(here('tidymycelium.js'), 'utf8') + '\nconst OURS = window.OURS;\nexport { MODELS, OURS, _tmBest };\n');
const { MODELS, OURS: O, _tmBest } = await import('./_bundle_bo.mjs?' + Date.now());
const TOO_BIG = new Set(['huge', 'hx_md1200', 'pb_cl', 'sf400']); // as in the page's list
const LAYOUTS = { auto: (b, e, s) => O.auto(b, e, { seed: s }), compact: (b, e, s) => O.compact(b, e, { seed: s }),
  grouped: (b, e, s) => O.grouped2(b, e, { seed: s }) || O.compact(b, e, { seed: s }), tidy: (b, e, s) => O.clocked(() => _tmBest(b, e, { seed: s })) };
function overlaps(P, B) { let c = 0; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (Math.abs(P[i].x - P[j].x) < (B[i].w + B[j].w) / 2 && Math.abs(P[i].y - P[j].y) < (B[i].h + B[j].h) / 2) c++; return c; }
const out = { made: new Date().toISOString().slice(0, 10), seed: 1, nodes: 'box', measure: 'crossed links + links through classes + covered names + overlapping boxes, after the clean-up and the link drawing', graphs: {} };
for (const key of Object.keys(MODELS).filter((k) => !TOO_BIG.has(k))) {
  const M = await MODELS[key].load(), boxes = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 }));
  const raw = M.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), nm = names(M.labels, raw);
  const links = raw.map((e, i) => [e[0], e[1], e[2], nm[i] ? nm[i].length * 6.6 + 8 : 0]), lay = links.map((e) => e.slice(0, 3));
  const row = {};
  for (const [k, fn] of Object.entries(LAYOUTS)) {
    const t0 = O.now(), r = fn(boxes, lay, 1), P = O.cleanUp(r.pos, boxes, lay, t0, false), rr = O.route(P, boxes, links), m = O.routeMetrics(rr.pos, boxes, links, rr.routes);
    row[k] = m.cross + m.thru + m.labelOver + overlaps(rr.pos, boxes);
  }
  out.graphs[key] = row; console.log(key.padEnd(14), JSON.stringify(row));
}
fs.writeFileSync(here('bestof.json'), JSON.stringify(out, null, 0).replace(/},"/g, '},\n"'));
console.log('wrote bestof.json:', Object.keys(out.graphs).length, 'graphs');
