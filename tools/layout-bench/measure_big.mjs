// The scale test (graphs of 1,000+ classes never seen during development): every drawing measured by one counter,
// HandTidy.measure (crossed links, links through classes, area), since the bench's own counts stop above 2,500 links.
// Inputs: results_big.json (open-source rows from contenders.html with KEEP_POS, and our rows from ours_rows.mjs).
// node measure_big.mjs -> prints a table and writes big_numbers.json
import fs from 'node:fs';
await import('./handtidy.js');
const HT = globalThis.HandTidy;
const rows = JSON.parse(fs.readFileSync(new URL('results_big.json', import.meta.url), 'utf8')).filter((r) => !r.error && r.pos);
const out = {};
for (const r of rows) {
  const D = r.box.map((w) => ({ w, h: 20 })), P = r.pos.map(([x, y]) => ({ x, y })), E = r.edges.map(([s, t]) => ({ s, t }));
  const m = HT.measure(P, D, E), down = (() => { const s = r.edges.filter((e) => e[2] === 1); return s.length ? s.filter(([c, p]) => P[c].y > P[p].y + 1).length / s.length : null; })();
  (out[r.key] = out[r.key] || {})[r.algo] = { cross: m.cross, thru: m.thru, area: m.area, down, ms: Math.round(r.ms) };
}
for (const [k, v] of Object.entries(out)) {
  console.log(k);
  Object.entries(v).sort((a, b) => a[1].cross + a[1].thru - b[1].cross - b[1].thru).forEach(([a, m]) => console.log('  ' + a.padEnd(32), String(m.cross).padStart(7), String(m.thru).padStart(7), String(m.area).padStart(8), (m.down == null ? '-' : Math.round(100 * m.down) + '%').padStart(5), (m.ms / 1000).toFixed(1) + ' s'));
}
fs.writeFileSync(new URL('big_numbers.json', import.meta.url), JSON.stringify(out, null, 1));
