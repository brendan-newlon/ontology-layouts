// Builds docs/ONTOLOGY-LAYOUT-ALGORITHMS.html: a single self-contained page (no external files) with the write-up and
// side-by-side drawings. Input: demo_drawings.json (recorded by contenders.html with window.KEEP_POS = true, seed 1).
// Run: node build_doc_html.mjs
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const rows = JSON.parse(fs.readFileSync(path.join(here, 'demo_drawings.json'), 'utf8')).filter((r) => !r.error);
const NAMES = { uni: 'University', hotel: 'Hotel booking', org: 'W3C ORG', brewery: 'Brewery IoT', trial: 'Clinical trial', prov: 'PROV-O', telecom: 'Telecom network', sosa: 'SOSA/SSN', crm: 'Customer 360 (one large hub)', schema: 'schema.org core', health: 'Clinical record (three super-hubs)', fibo: 'FIBO-like loans', pizza: 'Pizza (taxonomy)', bio: 'Biomedical taxonomy', big: 'Bank' };
const OURS = { 'Tidy Stress (ours)': 'Tidy Stress', 'Mycelium (ours)': 'Mycelium', 'Best Read (ours)': 'Best Read' };
const DATA = {};
for (const r of rows) {
  const m = (DATA[r.key] = DATA[r.key] || { name: NAMES[r.key] || r.key, labels: r.labels, box: r.box, edges: r.edges, ours: {}, pub: {} });
  const side = OURS[r.algo] ? m.ours : m.pub, name = OURS[r.algo] || r.algo;
  side[name] = { pos: r.pos, cross: r.cross, thru: r.thru, fill: Math.round(r.fill * 10) / 10, score: Math.round(r.score), ms: Math.round(r.ms) };
}
const order = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'].filter((k) => DATA[k]);
const data = JSON.stringify({ order, models: DATA });
const tpl = fs.readFileSync(path.join(here, 'doc_template.html'), 'utf8');
const out = tpl.replace('/*__DATA__*/null', () => data);
const dest = path.resolve(here, '..', '..', 'docs', 'ONTOLOGY-LAYOUT-ALGORITHMS.html');
fs.writeFileSync(dest, out);
console.log('wrote', dest, (out.length / 1024).toFixed(0), 'KB,', order.length, 'models');
