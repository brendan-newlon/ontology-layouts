// Checks for the ontology layouts and the clean-up after them (src/ontology-layouts.js, from function _ogClRng to
// "// ── end of the layouts ──"):
//   1. clock: the layout code reads no wall clock except inside the work clock, so a drawing does not depend on the computer;
//   2. grid: the clean-up's spatial grid gives the same costs as checking every pair (its checkIndex mode compares the two
//      on every evaluation and throws on a difference), with and without subclasses kept below;
//   3. repeatable: the same model laid out and cleaned up twice gives the same drawing.
// node tests/check_ontology_layout.mjs            -> "ontology layout clean" or the failures
// node tests/check_ontology_layout.mjs --self-test -> runs each check on a deliberately broken copy and confirms it fails
import fs from 'node:fs';
const appPath = new URL('../src/ontology-layouts.js', import.meta.url);

function layoutCode(src) {
  const a = src.indexOf('function _ogClRng('), b = src.indexOf('// ── end of the layouts ──');
  if (a < 0 || b < 0 || b < a) throw new Error('layout code anchors not found');
  return src.slice(a, b).replace(/\r\n/g, '\n');
}
function load(code) {
  const api = 'return { auto: _ogAutoLayout, cleanUp: _ogLayoutCleanUp, tidy: _ogHandTidy, now: _ogNow, sep: _ogClSeparate };';
  return new Function('window', 'document', 'state', 'log', code + '\n' + api)({}, {}, { ui: {} }, () => {});
}
// small generated models: a few taxonomies with property links between them, fixed seeds
function model(seed, n, extra) {
  let a = seed; const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const labels = [], edges = [];
  for (let i = 0; i < n; i++) labels.push('Class' + i + ['', 'Record', 'Assignment', 'Item'][i % 4]);
  for (let i = 1; i < n; i++) edges.push([i, Math.max(0, i - 1 - ((rnd() * 6) | 0)), rnd() < 0.6 ? 2 : 1]);
  for (let k = 0; k < extra; k++) { const s = (rnd() * n) | 0, t = (rnd() * n) | 0; if (s !== t) edges.push([s, t, 1]); }
  return { D: labels.map((l) => ({ w: l.length * 6.6 + 10, h: 20 })), edges };
}
const MODELS = [model(1, 14, 4), model(2, 30, 12), model(3, 45, 25), model(4, 70, 30)];

function checkClock(code) {
  const c0 = code.indexOf('// ── Work clock ──'), c1 = code.indexOf('// ── end of the work clock ──');
  if (c0 < 0 || c1 < 0) return ['the work clock section is missing'];
  const outside = code.slice(0, c0) + code.slice(c1), hits = outside.match(/performance\.now\(\)|Date\.now\(\)/g);
  return hits ? [hits.length + ' wall-clock read(s) in the layout code outside the work clock'] : [];
}
function checkGrid(L) {
  const bad = [];
  MODELS.forEach((m, i) => {
    const P = L.auto(m.D, m.edges, { seed: 1 }).pos.map((p) => ({ x: p.x, y: p.y })), E = m.edges.map(([s, t]) => ({ s, t }));
    for (const down of [undefined, m.edges.filter((e) => e[2] === 2).map(([c, p]) => [c, p])]) {
      try { L.tidy.run(P, m.D, E, { budgetMs: 300, checkIndex: true, down }); }
      catch (err) { bad.push('model ' + i + (down ? ' (subclasses below)' : '') + ': ' + err.message); }
    }
  });
  return bad;
}
function checkRepeatable(L) {
  const bad = [], hash = (P) => P.map((p) => p.x.toFixed(3) + ',' + p.y.toFixed(3)).join(';');
  MODELS.forEach((m, i) => {
    const once = () => { const t0 = L.now(), P = L.auto(m.D, m.edges, { seed: 1 }).pos.map((p) => ({ x: p.x, y: p.y })); L.sep(P, m.D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 200); return hash(L.cleanUp(P, m.D, m.edges, t0)); };
    if (once() !== once()) bad.push('model ' + i + ' gave two different drawings');
  });
  return bad;
}
function runAll(code) {
  const out = { clock: checkClock(code) }, L = load(code);
  out.grid = checkGrid(L); out.repeatable = checkRepeatable(L);
  return out;
}

const src = fs.readFileSync(appPath, 'utf8'), code = layoutCode(src);
if (process.argv.includes('--self-test')) {
  // each fixture breaks one thing; the matching check must report it
  const fixtures = [
    ['clock', 'a wall-clock read in a layout function', code.replace('function _ogClCrossings(P, EE) {', 'function _ogClCrossings(P, EE) { const _t = performance.now();')],
    ['grid', 'the grid skips every third cell along a link', code.replace('f(cy * G.cols + cx);', 'if ((cx + cy) % 3) f(cy * G.cols + cx);')],
    ['repeatable', 'the layout depends on the wall clock', code.replace('function _ogNow() {', 'function _ogNow() { return performance.now() * 37 % 1e9;')]
  ];
  let ok = true;
  for (const [check, what, broken] of fixtures) {
    if (broken === code) { console.log('FIXTURE NOT APPLIED:', what); ok = false; continue; }
    let res; try { res = runAll(broken)[check]; } catch (err) { res = ['threw: ' + err.message]; }
    console.log(res.length ? 'fires' : 'MISSED', '-', check, '-', what);
    if (!res.length) ok = false;
  }
  console.log(ok ? 'self-test ok' : 'self-test FAILED'); process.exit(ok ? 0 : 1);
}
const res = runAll(code), fails = Object.entries(res).flatMap(([k, v]) => v.map((x) => k + ': ' + x));
if (fails.length) { fails.forEach((f) => console.log(f)); process.exit(1); }
console.log('ontology layout clean');
