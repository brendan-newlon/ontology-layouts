// Headless layout bench: node bench.mjs [engines,comma] [models,comma|all|small|large] [seeds]
// Loads the library's layout functions (base_layout.js, rebuilt by build_base.mjs), the test models, and engines2.js (experiments).
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), root = path.resolve(here, '..', '..');
import { execSync } from 'node:child_process';
execSync('node build_base.mjs', { cwd: here }); execSync('node mkbundle.mjs', { cwd: here });
const { MODELS, OURS, EXP, EXP3 } = await import('./_bundle.mjs?' + Date.now());
const charW = 6.6;
const dims = (labels) => labels.map((l) => { const dw = String(l).length * charW + 10, dh = 20; return { w: dw, h: dh }; });
const SETS = {
  small: ['uni', 'hotel', 'hr', 'trial', 'grid', 'pub', 'proj', 'brewery', 'parcels', 'org'],
  mid: ['telecom', 'prov', 'sosa', 'crm', 'supply', 'health', 'retail', 'schema', 'fibo', 'sf60', 'mesh'],
  large: ['pizza', 'bio', 'sf120', 'big', 'sf250', 'sf400', 'huge']
};
SETS.all = [...SETS.small, ...SETS.mid, ...SETS.large];
const ENG = {
  compact: (it, ed, o) => OURS.compact(it, ed, o),
  grouped: (it, ed, o) => OURS.layout(it, ed, o),
  auto: (it, ed, o) => OURS.auto(it, ed, o),
  ...EXP.engines(OURS), ...EXP3
};
// Judge on the drawn boxes (label box) so every engine is measured the same way, whatever room it reserved.
export function judge(P, D, EE) {
  const m = OURS.pmetrics(P, D.map((d) => ({ w: d.w + 6, h: d.h + 6 })), EE);
  let nodeArea = 0; D.forEach((d) => (nodeArea += (d.w + 16) * (d.h + 12)));
  m.fill = m.area / nodeArea; // area taken per unit of class area; ~3-6 is comfortable, above 15 is sprawling
  let down = 0, subs = 0; EE.forEach((e) => { if (e.sub) { subs++; if (P[e.s].y > P[e.t].y + 1) down++; } });
  m.down = subs ? down / subs : 1;
  const ls = EE.map((e) => Math.hypot(P[e.s].x - P[e.t].x, P[e.s].y - P[e.t].y)).sort((a, b) => a - b), med = ls[ls.length >> 1] || 1;
  m.lout = 0; ls.forEach((l) => (m.lout += Math.max(0, l / med - 1.8)));
  return m;
}
export const SCORE = (m, n) => 10 * m.cross + 8 * m.thru + 2 * m.near + 40 * m.ov + m.len / 10 + Math.max(0, m.len - 350) / 2 + Math.max(0, m.fill - 8) * 4 * Math.sqrt(n) + 25 * m.lout;
const [engArg, modArg, seedArg] = process.argv.slice(2);
const engs = (engArg || 'compact,grouped').split(',');
const mods = (modArg || 'all').split(',').flatMap((k) => SETS[k] || [k]);
const seeds = +(seedArg || 1);
const rows = [];
for (const k of mods) {
  const M = await MODELS[k].load(), D = dims(M.labels), items = D.map((d) => ({ w: d.w, h: d.h }));
  const edges = M.edges.filter((e) => e.s !== e.t).map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]);
  const EE = edges.map(([a, b, w]) => ({ s: a, t: b, sub: w === 2 }));
  const line = [k.padEnd(8), String(items.length).padStart(4), String(EE.length).padStart(4)];
  for (const en of engs) {
    let agg = null;
    for (let s = 1; s <= seeds; s++) {
      const t = performance.now(); let r = null;
      try { r = ENG[en](items, edges, { seed: s }); } catch (err) { console.error(en, k, err.stack); }
      const ms = performance.now() - t;
      if (!r) { line.push(`${en}:null`); agg = null; break; }
      const m = judge(r.pos, D, EE), sc = SCORE(m, items.length);
      agg = agg || { lout: 0, cross: 0, thru: 0, near: 0, ov: 0, len: 0, fill: 0, down: 0, ms: 0, sc: 0, algo: r.algo || '' };
      for (const f of ['cross', 'thru', 'near', 'ov', 'len', 'fill', 'down', 'lout']) agg[f] += m[f] / seeds; agg.ms += ms / seeds; agg.sc += sc / seeds;
    }
    if (agg) { line.push(`${en}: x${agg.cross.toFixed(0)} t${agg.thru.toFixed(0)} n${agg.near.toFixed(0)} o${agg.ov.toFixed(0)} L${agg.len.toFixed(0)} f${agg.fill.toFixed(1)} lo${agg.lout.toFixed(1)} d${(agg.down * 100).toFixed(0)} ${agg.ms.toFixed(0)}ms S${agg.sc.toFixed(0)}${agg.algo ? ' ' + agg.algo : ''}`); rows.push({ k, en, ...agg }); }
  }
  console.log(line.join(' | '));
}
// summary: per engine, sum of score ranks
const byModel = {}; rows.forEach((r) => (byModel[r.k] = byModel[r.k] || []).push(r));
const wins = {}; Object.values(byModel).forEach((rs) => { rs.sort((a, b) => a.sc - b.sc); rs.forEach((r, i) => (wins[r.en] = (wins[r.en] || 0) + i)); });
console.log('rank sum (lower better):', JSON.stringify(wins));
