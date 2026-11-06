// Held-out test graphs: generated from fixed seeds and never opened in the layout lab, never used to tune the layouts or the
// clean-up. They exist only to check that what was tuned on the other graphs carries over. Keep it that way: do not view them
// while tuning, and do not add them to the lab's graph list.
const HX_WORDS = ['Account', 'Asset', 'Batch', 'Billing', 'Branch', 'Campaign', 'Carrier', 'Case', 'Catalog', 'Channel', 'Claim', 'Clinic', 'Contract', 'Course', 'Device', 'Dosage', 'Engine', 'Event', 'Facility', 'Fleet', 'Grant', 'Household', 'Incident', 'Invoice', 'Lab', 'Lease', 'Ledger', 'License', 'Lot', 'Meter', 'Mission', 'Order', 'Outage', 'Parcel', 'Patent', 'Permit', 'Pipeline', 'Plan', 'Policy', 'Port', 'Product', 'Program', 'Project', 'Quote', 'Recipe', 'Region', 'Release', 'Report', 'Route', 'Sample', 'Sensor', 'Shipment', 'Site', 'Skill', 'Specimen', 'Station', 'Store', 'Study', 'Supplier', 'Survey', 'Task', 'Tariff', 'Team', 'Ticket', 'Tool', 'Trade', 'Trial', 'Unit', 'Vessel', 'Visit', 'Warranty', 'Well', 'Workflow', 'Zone'];
const HX_MODS = ['', '', '', 'Active', 'Annual', 'Approved', 'Clinical', 'Derived', 'External', 'Field', 'Internal', 'Legacy', 'Mobile', 'Planned', 'Primary', 'Regional', 'Scheduled', 'Shared', 'Temporary', 'Verified'];
const HX_TAILS = ['', '', '', '', 'Record', 'Type', 'Status', 'Item', 'Line', 'Assignment', 'Measurement', 'Agreement', 'Category'];
function hxNamer(rnd) {
  const used = new Set();
  return () => { for (;;) { const n = HX_MODS[(rnd() * HX_MODS.length) | 0] + HX_WORDS[(rnd() * HX_WORDS.length) | 0] + HX_TAILS[(rnd() * HX_TAILS.length) | 0]; if (!used.has(n)) { used.add(n); return n; } } };
}
// A small taxonomy under one root: each new class picks a parent among the classes so far, biased to recent ones (deeper trees).
function hxTree(rnd, name, n, labels, edges, depthBias) {
  const ids = [labels.length]; labels.push(name());
  for (let i = 1; i < n; i++) { const k = ids.length, j = Math.max(0, k - 1 - ((rnd() * (depthBias ? 4 : k)) | 0)); const id = labels.length; labels.push(name()); edges.push({ s: id, t: ids[j], kind: 'sub' }); ids.push(id); }
  return ids;
}
// Multi-domain model: several domains, each a taxonomy with a few property links inside, all linking out to a few shared classes
// (like Person, Organization, Location in a business ontology) and occasionally to each other.
function hxMultiDomain(seed, sizes, shared, inner, cross) {
  const rnd = mulberry32(seed), name = hxNamer(rnd), labels = [], edges = [];
  const S = shared.map((s) => { labels.push(s); return labels.length - 1; });
  const doms = sizes.map((n) => hxTree(rnd, name, n, labels, edges, rnd() < 0.5));
  doms.forEach((d) => {
    for (let k = 0; k < Math.round(d.length * inner); k++) { const a = d[(rnd() * d.length) | 0], b = d[(rnd() * d.length) | 0]; if (a !== b) edges.push({ s: a, t: b, kind: 'prop' }); }
    const out = 1 + ((rnd() * Math.max(2, d.length / 6)) | 0);
    for (let k = 0; k < out; k++) edges.push({ s: d[(rnd() * d.length) | 0], t: S[(rnd() * S.length) | 0], kind: 'prop' });
  });
  for (let k = 0; k < cross; k++) { const a = doms[(rnd() * doms.length) | 0], b = doms[(rnd() * doms.length) | 0]; if (a !== b) edges.push({ s: a[(rnd() * a.length) | 0], t: b[(rnd() * b.length) | 0], kind: 'prop' }); }
  return { labels, edges };
}
// Hub-heavy: a few hubs with many leaves each, and links between some of the leaves.
function hxHubs(seed, hubs, leaves, extra) {
  const rnd = mulberry32(seed), name = hxNamer(rnd), labels = [], edges = [], all = [];
  for (let h = 0; h < hubs; h++) { const id = labels.length; labels.push(name()); all.push(id); for (let k = 0; k < leaves[h]; k++) { const l = labels.length; labels.push(name()); edges.push({ s: id, t: l, kind: rnd() < 0.4 ? 'sub' : 'prop' }); all.push(l); } if (h) edges.push({ s: id, t: 0, kind: 'prop' }); }
  for (let k = 0; k < extra; k++) { const a = all[(rnd() * all.length) | 0], b = all[(rnd() * all.length) | 0]; if (a !== b) edges.push({ s: a, t: b, kind: 'prop' }); }
  return { labels, edges };
}
// Random sparse connected graph in the style of the Rome graphs of the graph drawing literature: a random spanning tree plus
// extra links chosen uniformly, about m = ratio * n links, all property links.
function hxSparse(seed, n, ratio) {
  const rnd = mulberry32(seed), name = hxNamer(rnd), labels = [], edges = [], has = new Set();
  for (let i = 0; i < n; i++) labels.push(name());
  const add = (a, b) => { const k = a < b ? a + ',' + b : b + ',' + a; if (a === b || has.has(k)) return false; has.add(k); edges.push({ s: a, t: b, kind: 'prop' }); return true; };
  for (let i = 1; i < n; i++) add(i, (rnd() * i) | 0);
  while (edges.length < Math.round(ratio * n)) add((rnd() * n) | 0, (rnd() * n) | 0);
  return { labels, edges };
}
// Rings and chains: process-like models (steps linked in sequence, loops back), with small taxonomies hanging off.
function hxRings(seed, rings, len, hang) {
  const rnd = mulberry32(seed), name = hxNamer(rnd), labels = [], edges = [], ringIds = [];
  for (let r = 0; r < rings; r++) { const ids = []; for (let k = 0; k < len; k++) { ids.push(labels.length); labels.push(name()); if (k) edges.push({ s: ids[k - 1], t: ids[k], kind: 'prop' }); } if (rnd() < 0.7) edges.push({ s: ids[len - 1], t: ids[0], kind: 'prop' }); ringIds.push(ids); }
  for (let r = 1; r < rings; r++) edges.push({ s: ringIds[r][(rnd() * len) | 0], t: ringIds[(rnd() * r) | 0][(rnd() * len) | 0], kind: 'prop' });
  for (let k = 0; k < hang; k++) { const r = ringIds[(rnd() * rings) | 0], at = r[(rnd() * len) | 0], id = labels.length; labels.push(name()); edges.push({ s: id, t: at, kind: 'sub' }); }
  return { labels, edges };
}
const HELD_OUT = {
  hx_small: { name: 'Held-out: small model (18)', load: async () => hxMultiDomain(101, [6, 5, 4], ['Person', 'Organization', 'Location'], 0.3, 1) },
  hx_mesh: { name: 'Held-out: dense links (35)', load: async () => hxSparse(102, 35, 2.2) },
  hx_rome40: { name: 'Held-out: sparse, Rome style (40)', load: async () => hxSparse(103, 40, 1.35) },
  hx_rings: { name: 'Held-out: process loops (50)', load: async () => hxRings(104, 5, 7, 15) },
  hx_hubs: { name: 'Held-out: two big hubs (57)', load: async () => hxHubs(105, 3, [24, 18, 12], 10) },
  hx_md70: { name: 'Held-out: multi-domain (73)', load: async () => hxMultiDomain(106, [14, 12, 18, 10, 16], ['Person', 'Organization', 'Location'], 0.25, 4) },
  hx_rome90: { name: 'Held-out: sparse, Rome style (90)', load: async () => hxSparse(107, 90, 1.3) },
  hx_tax: { name: 'Held-out: deep taxonomy (110)', load: async () => hxMultiDomain(108, [40, 35, 30], ['Thing', 'Agent', 'Place', 'Event'], 0.05, 2) },
  hx_md160: { name: 'Held-out: multi-domain (164)', load: async () => hxMultiDomain(109, [22, 18, 25, 15, 20, 24, 16, 20], ['Person', 'Organization', 'Location', 'Document'], 0.25, 8) },
  hx_md300: { name: 'Held-out: multi-domain (304)', load: async () => hxMultiDomain(110, [30, 25, 40, 35, 28, 32, 22, 38, 26, 24], ['Person', 'Organization', 'Location', 'Document'], 0.25, 14) }
};
Object.assign(MODELS, HELD_OUT);
