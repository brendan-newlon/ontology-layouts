// Puts a new run of our layouts (recorded by contenders.html with window.KEEP_POS = true) into the recorded results, leaving the
// open-source layouts' rows as they were recorded. Input: results_ours.json (an array of runOne results, later rows win).
// Our rows in results_tuned.json and demo_drawings.json are replaced; the "no clean-up" rows are added to results_tuned.json.
// Run: node merge_ours.mjs
import fs from 'node:fs';
const here = (f) => new URL(f, import.meta.url);
const read = (f) => JSON.parse(fs.readFileSync(here(f), 'utf8'));
const runs = read('results_ours.json'), latest = new Map();
runs.forEach((r) => latest.set(r.key + '|' + r.algo, r));
const ours = [...latest.values()], isOurs = (a) => / \(ours\)$/.test(a);
const strip = ({ pos, labels, edges, box, ...rest }) => rest;
const tuned = read('results_tuned.json').filter((r) => !isOurs(r.algo)).concat(ours.map(strip));
fs.writeFileSync(here('results_tuned.json'), JSON.stringify(tuned));
const demoCols = ['key', 'algo', 'seed', 'n', 'links', 'cross', 'thru', 'near', 'len', 'fill', 'lout', 'ov', 'score', 'ms', 'pos', 'labels', 'edges', 'box'];
const demo = read('demo_drawings.json').filter((r) => !isOurs(r.algo))
  .concat(ours.filter((r) => !/no clean-up/.test(r.algo)).map((r) => Object.fromEntries(demoCols.map((c) => [c, r[c]]))));
fs.writeFileSync(here('demo_drawings.json'), JSON.stringify(demo));
console.log('our rows', ours.length, '| results_tuned', tuned.length, '| demo_drawings', demo.length);
