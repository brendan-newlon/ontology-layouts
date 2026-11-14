// Experiment (2026-11-14): Tidy Mycelium (tidymycelium.js) against Best Read, each followed by the library's clean-up and
// link routing exactly as draw() runs them, measured after routing on links named as routenames.mjs names them.
//   node tmbench.mjs <keys comma | dev | held | public | all> '<variants JSON: {"name": {tm options}, …}>' [seeds] [cleanupJSON]
// Prints per graph and totals: crossed links, links through classes, covered names, overlapping boxes (= problems), sharp
// crossings, area, ms (wall time of layout + clean-up + routing).
import fs from 'node:fs';
import { names } from './routenames.mjs';
const here = (f) => new URL(f, import.meta.url);
const base = fs.readFileSync(here('_bundle.mjs'), 'utf8'), cut = base.lastIndexOf('\nconst OURS = window.OURS;');
if (cut < 0) throw new Error('_bundle.mjs: export block not found; run mkbundle.mjs');
fs.writeFileSync(here('_bundle_tm.mjs'), base.slice(0, cut) + '\n' + fs.readFileSync(here('tidymycelium.js'), 'utf8') + '\nconst OURS = window.OURS;\nexport { MODELS, OURS, _tmLayout, _tmUnits, _tmBest };\n');
const { MODELS, OURS: O, _tmLayout, _tmBest } = await import('./_bundle_tm.mjs?' + Date.now());
O.tune.noWall = true;
if (process.env.TM_TUNE) Object.assign(O.tune, JSON.parse(process.env.TM_TUNE)); // e.g. TM_TUNE='{"leafClaim":0}'
const SETS = { dev: ['prov', 'uni', 'hotel', 'org', 'brewery', 'trial', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'], held: ['hx_small', 'hx_mesh', 'hx_rome40', 'hx_rings', 'hx_hubs', 'hx_md70', 'hx_rome90', 'hx_tax', 'hx_md160', 'hx_md300'],
  public: ['pb_foaf', 'pb_dcterms', 'pb_time', 'pb_dcat', 'pb_bfo', 'pb_dul', 'pb_saref', 'pb_gr', 'pb_rome117', 'pb_rome121', 'pb_rome115', 'pb_rome135', 'pb_rome120', 'pb_rome134', 'pb_rome1182', 'pb_rome1307', 'pb_rome1192', 'pb_rome1270', 'pb_rome1233', 'pb_rome1381', 'pb_rome481', 'pb_rome2778', 'pb_rome3756', 'pb_rome7130', 'pb_rome7785', 'pb_rome7797'],
  few: ['telecom', 'pizza', 'bio', 'big', 'hx_rome40', 'hx_hubs', 'hx_tax', 'hx_md160', 'pb_dul', 'pb_saref', 'pb_rome7797'] };
SETS.all = [...SETS.dev, ...SETS.held, ...SETS.public];
SETS.ex = Object.keys(MODELS).filter((k) => !['huge', 'hx_md1200', 'pb_cl', 'sf400'].includes(k)); // the Lab's 62 graphs (9 to 304 classes)
// TM_EX=1: large circles (circles of radius 156 px, names 20 px per letter + 14), in library units (÷ 51/14)
const EXS = process.env.TM_EX ? 51 / 14 : 0;
const keys = process.argv[2].split(',').flatMap((k) => SETS[k] || [k]);
const variants = JSON.parse(process.argv[3] || '{"tm":{}}'), seeds = +(process.argv[4] || 1), cleanup = JSON.parse(process.argv[5] || 'null');
const VERBOSE = !!process.env.TM_VERBOSE;

function dedupe(links) { const at = new Map(), out = [];
  for (const e of links) { const k = Math.min(e[0], e[1]) + ',' + Math.max(e[0], e[1]), j = at.get(k); if (j == null) { at.set(k, out.length); out.push(e.slice()); continue; }
    const f = out[j]; if ((e[3] || 0) > (f[3] || 0)) f[3] = e[3]; if (e[2] === 2) f[2] = 2; }
  return out; }
function overlaps(P, B) { let c = 0; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (Math.abs(P[i].x - P[j].x) < (B[i].w + B[j].w) / 2 && Math.abs(P[i].y - P[j].y) < (B[i].h + B[j].h) / 2) c++; return c; }

function run(name, boxes, links, seed) {
  const lay1 = dedupe(links), t = performance.now(); let lay, stage = null;
  const prevC = O.tune.cleanup;
  if (name === 'Best Read') { const t0 = O.now(); lay = O.auto(boxes, lay1, { seed }); var P = O.cleanUp(lay.pos, boxes, lay1, t0, false); }
  else { const v = variants[name]; if (v.cleanup) O.tune.cleanup = v.cleanup; else if (cleanup) O.tune.cleanup = cleanup;
    const t0 = O.now(); lay = O.clocked(() => _tmBest(boxes, lay1, { seed, tm: v })); stage = lay.stage;
    const tc = performance.now(); var P = v.noClean ? lay.pos : O.cleanUp(lay.pos, boxes, lay1, t0, false); if (stage) stage.cleanUp = performance.now() - tc; }
  O.tune.cleanup = prevC;
  const tr = performance.now(), rr = O.route(P, boxes, links); if (stage) stage.route = performance.now() - tr;
  const ms = performance.now() - t, m = O.routeMetrics(rr.pos, boxes, links, rr.routes), ov = overlaps(rr.pos, boxes);
  return { cross: m.cross, thru: m.thru, names: m.labelOver, ov, sharp: m.sharp, area: m.area, ms, prob: m.cross + m.thru + m.labelOver + ov, stage, units: lay.units, core: lay.core };
}

const names_ = ['Best Read', ...Object.keys(variants)], tot = Object.fromEntries(names_.map((k) => [k, { cross: 0, thru: 0, names: 0, ov: 0, sharp: 0, area: 0, ms: 0, prob: 0, win: 0, tie: 0, lose: 0, msList: [] }]));
const pad = (s, n) => String(s).padStart(n);
for (const key of keys) {
  const M = await MODELS[key].load(), boxes = M.labels.map((l) => (EXS ? { w: 312 / EXS, h: 312 / EXS, shape: 'circle', r: 156 / EXS } : { w: String(l).length * 6.6 + 10, h: 20 }));
  const raw = M.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), nm = names(M.labels, raw);
  const links = raw.map((e, i) => [e[0], e[1], e[2], nm[i] ? (EXS ? (nm[i].length * 20) / EXS : nm[i].length * 6.6 + 8) : 0]);
  const row = {};
  for (const name of names_) {
    const acc = { cross: 0, thru: 0, names: 0, ov: 0, sharp: 0, area: 0, ms: 0, prob: 0 };
    for (let s = 1; s <= seeds; s++) { const r = run(name, boxes, links, s); for (const k in acc) acc[k] += r[k] / seeds; if (s === 1) { acc.stage = r.stage; acc.units = r.units; acc.core = r.core; } }
    row[name] = acc; const T = tot[name]; for (const k of ['cross', 'thru', 'names', 'ov', 'sharp', 'area', 'ms', 'prob']) T[k] += acc[k]; T.msList.push(acc.ms);
  }
  const br = row['Best Read'];
  let line = key.padEnd(13) + pad(M.labels.length, 5) + ' |';
  for (const name of names_) { const r = row[name]; line += ` ${name.slice(0, 10).padEnd(10)} ${pad(Math.round(r.prob), 4)} (${pad(Math.round(r.cross), 3)}/${pad(Math.round(r.thru), 3)}/${pad(Math.round(r.names), 3)}/${r.ov}) ${pad(Math.round(r.ms), 5)}ms |`;
    if (name !== 'Best Read') { const T = tot[name]; if (r.prob < br.prob - 0.01) T.win++; else if (r.prob > br.prob + 0.01) T.lose++; else T.tie++; } }
  console.log(line);
  if (VERBOSE) for (const name of names_.slice(1)) console.log("   ", name, "area", row[name].area.toFixed(1), "BR area", row["Best Read"].area.toFixed(1), "core", row[name].core, 'units', row[name].units, JSON.stringify(Object.fromEntries(Object.entries(row[name].stage || {}).map(([k, v]) => [k, Math.round(v)]))));
}
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
console.log('TOTAL (problems = crossed + through + covered names + overlaps; better/same/worse vs Best Read)');
for (const name of names_) { const T = tot[name];
  console.log(name.padEnd(22), 'problems', pad(Math.round(T.prob), 6), 'cross', pad(Math.round(T.cross), 5), 'thru', pad(Math.round(T.thru), 4), 'names', pad(Math.round(T.names), 4), 'ov', pad(T.ov, 3), 'sharp', pad(Math.round(T.sharp), 4), 'area', T.area.toFixed(0).padStart(5), 'ms total', pad(Math.round(T.ms), 6), 'median', pad(Math.round(med(T.msList)), 5), name === 'Best Read' ? '' : `  ${T.win}/${T.tie}/${T.lose}`); }
