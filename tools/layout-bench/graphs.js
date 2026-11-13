// Shared by the Layout Lab and the Layout Playback: graphs the reader imported (kept in this browser, so both pages offer
// them), the node style (label boxes, or circles with the name underneath), and downloads.
// Load after models*.js (it adds the imported graphs to MODELS).
(function () {
  const KEY = 'layout-graphs:imported', STYLE = 'layout-graphs:style';
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const all = () => get(KEY, {});
  function register(key, g) { MODELS[key] = { name: g.name, imported: true, load: async () => ({ labels: g.labels, edges: g.edges, iris: g.iris }) }; }
  Object.entries(all()).forEach(([k, g]) => register(k, g));
  // a graph read from a file: { name, labels, edges: [{ s, t, kind: 'sub' | 'rel', name }], iris } -> its key in MODELS
  function add(g) {
    const A = all(), key = 'imp_' + Date.now().toString(36);
    A[key] = { name: g.name, labels: g.labels, edges: g.edges, iris: g.iris || null, at: new Date().toISOString() };
    if (!set(KEY, A)) { delete A[key]; register(key, g); return key; } // too big for this browser's storage: kept until the page closes
    register(key, A[key]); return key;
  }
  function remove(key) { const A = all(); delete A[key]; set(KEY, A); delete MODELS[key]; }
  // Node styles. "box": the label in a box (the benchmarks' boxes). "circle": a circle with the name underneath, as many graph
  // browsers draw them. The layout is given one box per class that covers everything drawn for it, centered where the
  // links meet the class (the circle's center), so the circle's box reaches as far above the circle as the name hangs below.
  const R = 14, LH = 14;
  const labelW = (l) => String(l).length * 6.6 + 10;
  function boxes(labels, style) {
    return labels.map((l) => style === 'circle'
      ? { w: Math.max(2 * R + 8, String(l).length * 6.2 + 8), h: 2 * (R + 3 + LH), shape: 'circle', r: R }
      : { w: labelW(l), h: 20 });
  }
  // the SVG of one class at the origin (the caller translates it); inner markup only
  function nodeSvg(label, d, esc) {
    if (d.shape === 'circle') { const lw = String(label).length * 6.2 + 6;
      return `<circle class="shape" r="${d.r}"/><rect class="lbg" x="${-lw / 2}" y="${d.r + 3}" width="${lw}" height="${LH}" rx="3"/><text text-anchor="middle" y="${d.r + 3 + 11}">${esc(label)}</text>`; }
    return `<rect class="shape" x="${-d.w / 2}" y="${-d.h / 2}" width="${d.w}" height="${d.h}" rx="4"/><text text-anchor="middle" y="4">${esc(label)}</text>`;
  }
  // does segment a-b (relative to the class center) touch what is drawn for the class, with a margin? (circle and name, or box)
  function hits(d, ax, ay, bx, by, pad, segBox) {
    if (d.shape !== 'circle') return segBox(ax, ay, bx, by, d.w / 2 + pad, d.h / 2 + pad);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2));
    if (Math.hypot(ax + t * dx, ay + t * dy) < d.r + pad) return true;
    const lw = d.w / 2, cy = d.r + 3 + LH / 2; // the name under the circle
    return segBox(ax, ay - cy, bx, by - cy, lw + pad, LH / 2 + pad);
  }
  function download(name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  window.LayoutGraphs = { all, add, remove, boxes, nodeSvg, hits, download, style: () => get(STYLE, 'box'), setStyle: (s) => set(STYLE, s), imported: () => Object.keys(all()) };
})();
