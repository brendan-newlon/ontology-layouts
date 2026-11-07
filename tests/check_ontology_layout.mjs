// Checks for the ontology layouts and the clean-up after them (src/ontology-layouts.js, from function _ogClRng to
// "// ── end of the layouts ──"):
//   1. clock: the layout code reads no wall clock except inside the work clock, so a drawing does not depend on the computer;
//   2. grid: the clean-up's spatial grid gives the same costs as checking every pair (its checkIndex mode compares the two
//      on every evaluation and throws on a difference);
//   3. repeatable: the same model laid out and cleaned up twice gives the same drawing;
//   4. tree: a pure taxonomy drawn as a tree, and cleaned up keeping it top-down, has no problem and every subclass below.
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
  const api = 'return { auto: _ogAutoLayout, tree: _ogTreeLayout, cleanUp: _ogLayoutCleanUp, tidy: _ogHandTidy, now: _ogNow, sep: _ogClSeparate };';
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
      catch (err) { bad.push('model ' + i + (down ? ' (kept top-down)' : '') + ': ' + err.message); }
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
// 4. tree: a pure taxonomy (wide fans, three levels) drawn by the tree layout and cleaned up keeping it top-down has no crossed
//    links, no link through a class, and every subclass below its superclass
function checkTree(L) {
  const bad = [], labels = [], edges = [];
  labels.push('Thing'); for (let i = 0; i < 4; i++) { const a = labels.length; labels.push('Category' + i); edges.push([a, 0, 2]);
    for (let j = 0; j < 3 + 3 * i; j++) { const b = labels.length; labels.push('Kind' + i + 'Member' + j); edges.push([b, a, 2]); if (j < 2) for (let k = 0; k < 3; k++) { labels.push('Leaf' + i + j + k); edges.push([labels.length - 1, b, 2]); } } }
  const D = labels.map((l) => ({ w: l.length * 6.6 + 10, h: 20 })), E = edges.map(([s, t]) => ({ s, t }));
  const t0 = L.now(), P = L.tree(D, edges, {}).pos.map((p) => ({ x: p.x, y: p.y })); L.sep(P, D.map((d) => ({ w: d.w + 16, h: d.h + 12 })), 6, 40);
  for (const [name, Q] of [['tree', P], ['tree after clean-up', L.cleanUp(P, D, edges, t0, true)]]) {
    const m = L.tidy.measure(Q, D, E), up = edges.filter(([c, p]) => Q[c].y <= Q[p].y).length;
    if (m.cross || m.thru || up) bad.push(`${name}: ${m.cross} crossed, ${m.thru} through classes, ${up} subclass links not pointing down`);
  }
  // multiple superclasses (one of them deep in another branch) and a subclass cycle: every subclass link points down except
  // the one that closes the cycle
  const L2 = ['Thing', 'A', 'B', 'B1', 'B2', 'B3', 'C', 'Cyc1', 'Cyc2', 'Cyc3'], E2 = [[1, 0, 2], [2, 0, 2], [3, 2, 2], [4, 3, 2], [5, 4, 2], [6, 1, 2], [6, 5, 2], [7, 0, 2], [8, 7, 2], [9, 8, 2], [7, 9, 2]];
  const D2 = L2.map((l) => ({ w: l.length * 6.6 + 10, h: 20 })), Q2 = L.tree(D2, E2, {}).pos, up2 = E2.filter(([c, p]) => Q2[c].y <= Q2[p].y).length;
  if (up2 !== 1) bad.push(`tree with multiple superclasses and a cycle: ${up2} subclass links not pointing down (expected 1, the cycle's)`);
  return bad;
}
function runAll(code) {
  const out = { clock: checkClock(code) }, L = load(code);
  out.grid = checkGrid(L); out.repeatable = checkRepeatable(L); out.tree = checkTree(L);
  return out;
}

const src = fs.readFileSync(appPath, 'utf8'), code = layoutCode(src);
if (process.argv.includes('--self-test')) {
  // each fixture breaks one thing; the matching check must report it
  const fixtures = [
    ['clock', 'a wall-clock read in a layout function', code.replace('function _ogClCrossings(P, EE) {', 'function _ogClCrossings(P, EE) { const _t = performance.now();')],
    ['grid', 'the grid skips every third cell along a link', code.replace('f(cy * G.cols + cx);', 'if ((cx + cy) % 3) f(cy * G.cols + cx);')],
    ['repeatable', 'the layout depends on the wall clock', code.replace('function _ogNow() {', 'function _ogNow() { return performance.now() * 37 % 1e9;')],
    ['tree', 'the tree gap ignores the lines to far children', code.replace('if (room > 1) G = Math.max(G,', 'if (room > 1e9) G = Math.max(G,')],
    ['tree', 'levels by the shallowest superclass, not the deepest', code.replace('atLeast[k] = Math.max(atLeast[k], level[v] + 1);', 'atLeast[k] = atLeast[k] || level[v] + 1;')]
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
