// Records Tidy Mycelium step by step on two graphs for the write-up's walk-through (tm_walk.json), and measures what its
// clean-up and its take-in are worth on the 15 development graphs (tm_steps.json). Run: node gen_tm_walk.mjs (after mkbundle.mjs)
import fs from 'node:fs';
const here = (f) => new URL(f, import.meta.url);
const base = fs.readFileSync(here('_bundle.mjs'), 'utf8'), cut = base.lastIndexOf('\nconst OURS = window.OURS;');
fs.writeFileSync(here('_bundle_walk.mjs'), base.slice(0, cut) + '\nconst OURS = window.OURS;\nexport { MODELS, OURS, _tmBest, _tmCompact };\n');
const { MODELS, OURS: O, _tmBest, _tmCompact } = await import('./_bundle_walk.mjs?' + Date.now());
const r1 = (v) => Math.round(v * 10) / 10;
const D3 = (D) => D.map((d) => ({ w: d.w + 6, h: d.h + 6 }));
function counts(P, D, E, vis) { // crossed links and links through classes (3 px margin), area over the boxes, on the classes shown
  const idx = [...Array(P.length).keys()].filter((i) => !vis || vis[i]), at = new Map(idx.map((v, i) => [v, i]));
  const Q = idx.map((i) => P[i]), Dq = idx.map((i) => D[i]), Eq = E.filter((e) => at.has(e.s) && at.has(e.t)).map((e) => ({ s: at.get(e.s), t: at.get(e.t) }));
  const m = O.pmetrics(Q, D3(Dq), Eq), ml = O.pmetrics(Q, Dq.map((d) => ({ w: d.w + 16, h: d.h + 12 })), Eq);
  return { cross: m.cross, thru: m.thru, area: r1(ml.fill), shown: idx.length };
}
// the bounding box of a drawing, for the outline of the step before
const box = (P, D) => { let x1 = 1e18, y1 = 1e18, x2 = -1e18, y2 = -1e18; P.forEach((p, i) => { x1 = Math.min(x1, p.x - D[i].w / 2); x2 = Math.max(x2, p.x + D[i].w / 2); y1 = Math.min(y1, p.y - 10); y2 = Math.max(y2, p.y + 10); }); return [r1(x1), r1(y1), r1(x2), r1(y2)]; };
const walk = {};
for (const key of ['bio', 'hx_hubs']) {
  const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 }));
  const EE = M.edges.filter((e) => e.s !== e.t), E = EE.map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), Es = EE.map((e) => ({ s: e.s, t: e.t }));
  const rec = [], t0 = O.now(), r = O.clocked(() => _tmBest(D, E, { seed: 1, rec }));
  const frame = (k) => rec.filter((f) => f.k === k).pop();
  const fStress = frame('stress') || frame('start'), fCore = frame('coreClean') || fStress, fLeaves = frame('leaves'), fShrink = frame('shrink') || frame('finish') || fLeaves;
  const hiddenOf = (f) => { const h = new Array(D.length).fill(false); (f.hidden || []).forEach((i) => (h[i] = true)); return h; };
  const P0 = r.pos.map((p) => ({ x: p.x, y: p.y })), P1 = O.cleanUp(P0, D, E, t0, false);
  const P2 = _tmCompact(P1, D, E, { rounds: 0 }), P3 = _tmCompact(P1, D, E);
  const pos = (P) => P.map((p) => [r1(p.x), r1(p.y)]);
  const hidCore = hiddenOf(fCore), groups = (frame('start') || {}).groups || null;
  const anchors = (fCore.room || []).filter((q) => q && q.r > 0 && !hidCore[q.v]).map((q) => [q.v, r1(q.r)]); // the room each anchor keeps for what it hides
  const moved = (A, B) => A.map((p, i) => (Math.hypot(p.x - B[i].x, p.y - B[i].y) > 12 ? i : -1)).filter((i) => i >= 0); // moved more than 12 px
  const steps = [
    { k: 'aside', P: fStress.P, hidden: hidCore, anchors },
    { k: 'core', P: fCore.P, hidden: hidCore, groups },
    { k: 'back', P: fLeaves.P, hidden: null, fresh: hidCore.map((h, i) => (h ? i : -1)).filter((i) => i >= 0) },
    { k: 'tighten', P: fShrink.P, hidden: null },
    { k: 'clean', P: P1, hidden: null, moved: moved(fShrink.P, P1) },
    { k: 'bands', P: P2, hidden: null, prev: P1 },
    { k: 'classes', P: P3, hidden: null, prev: P2 },
  ].map((s) => ({ k: s.k, pos: pos(s.P), hidden: s.hidden ? s.hidden.map((h, i) => (h ? i : -1)).filter((i) => i >= 0) : [], anchors: s.anchors || null, groups: s.groups || null, fresh: s.fresh || null, moved: s.moved || null, prev: s.prev ? box(s.prev, D) : null,
    m: counts(s.P, D, Es, s.hidden ? s.hidden.map((h) => !h) : null) }));
  walk[key] = { graph: key, labels: M.labels, w: D.map((d) => r1(d.w)), edges: E.map(([s, t, k]) => [s, t, k === 2 ? 1 : 0]), units: r.units, steps };
  console.log(key, steps.map((s) => `${s.k} ${s.m.cross}/${s.m.thru} a${s.m.area} (${s.m.shown})`).join(' | '));
}
fs.writeFileSync(here('tm_walk.json'), JSON.stringify(walk));
// what the clean-up and the take-in are worth inside Tidy Mycelium, on the 15 development graphs
const DEV = ['uni', 'hotel', 'org', 'brewery', 'trial', 'prov', 'telecom', 'sosa', 'crm', 'schema', 'health', 'fibo', 'pizza', 'bio', 'big'];
const tot = { place: [], clean: [], take: [], noclean: [] };
for (const key of DEV) {
  const M = await MODELS[key].load(), D = M.labels.map((l) => ({ w: String(l).length * 6.6 + 10, h: 20 }));
  const EE = M.edges.filter((e) => e.s !== e.t), E = EE.map((e) => [e.s, e.t, e.kind === 'sub' ? 2 : 1]), Es = EE.map((e) => ({ s: e.s, t: e.t }));
  const t0 = O.now(), r = O.clocked(() => _tmBest(D, E, { seed: 1 })), P0 = r.pos.map((p) => ({ x: p.x, y: p.y }));
  const P1 = O.cleanUp(P0.map((p) => ({ ...p })), D, E, t0, false), P2 = _tmCompact(P1, D, E), Pn = _tmCompact(P0, D, E);
  tot.place.push(counts(P0, D, Es)); tot.clean.push(counts(P1, D, Es)); tot.take.push(counts(P2, D, Es)); tot.noclean.push(counts(Pn, D, Es));
}
const med = (v) => { v = v.slice().sort((a, b) => a - b); return v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; };
const sum = (L) => ({ cross: L.reduce((a, m) => a + m.cross, 0), thru: L.reduce((a, m) => a + m.thru, 0), area: r1(med(L.map((m) => m.area))) });
const steps = Object.fromEntries(Object.entries(tot).map(([k, L]) => [k, sum(L)]));
fs.writeFileSync(here('tm_steps.json'), JSON.stringify(steps, null, 1)); console.log(JSON.stringify(steps));
