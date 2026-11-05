# Cluster-aware graph layout with few crossed links

A layout algorithm for medium-sized graphs (tens to a few hundred nodes, up to about a thousand links) that have visible communities, such as ontologies, schemas, service maps and dependency graphs. It draws the graph as a handful of tight clusters joined by long, mostly straight links, and works to keep links from crossing each other or passing through nodes. It is deterministic given a seed, needs no dependencies, and runs in 10 ms to 1 s on a laptop in JavaScript.

This document describes the method, the maths behind each step, what was measured, what was tried and did not help, and a complete reference implementation (Appendix A).

---

## 1. Goals and measures

Given an undirected view of the graph, nodes with a width and a height, and optional link weights, place every node's centre so that:

1. **No two node boxes touch.**
2. **Few crossings.** A crossing is a pair of links that share no endpoint and whose straight segments intersect.
3. **No link passes through a node** it does not end at, and links keep away from each other.
4. **Clusters are visible**: closely linked nodes sit together; the links between clusters are the long ones.
5. **A node with a single link never causes a crossing** and is not crowded against its neighbour.
6. **Fast enough** to run when a user clicks a button (budget: about one second for 150 nodes).

Measures used below (all on straight-line drawings):

| Measure | Definition |
|---|---|
| crossings | number of link pairs, sharing no endpoint, whose segments intersect |
| lines through nodes | number of (link, node) pairs where the node is not an endpoint and its centre lies within about half a node of the link |
| near-misses | number of link pairs (no shared endpoint, no crossing) closer than 30 px |
| overlaps | number of node pairs whose boxes intersect |

## 2. Overview

```
 input: nodes (w, h), links (i, j, weight)
   │
   ├─ 1  find clusters                       Louvain modularity, small clusters merged
   ├─ 2  set aside single-link nodes         repeatedly; they come back at step 11
   ├─ 3  lay out each cluster on its own     spring + repulsion
   ├─ 4  lay out clusters as big nodes       strong repulsion, springs on inter-cluster links
   ├─ 5  ring of "gateway" nodes per cluster each faces the nodes it links to, spaced apart
   ├─ 6  imaginary node on every link        midpoints repel each other; ends are pushed apart
   ├─ 7  slide whole clusters                to straighten links and clear nodes and other links
   ├─ 8  swap nodes inside a cluster         when that removes crossings
   ├─ 9  push links off nodes lying on them  undo any step that adds a crossing
   ├─ 11 put single-link nodes back, then shrink the whole drawing evenly
   └─ 10 (the whole pipeline is run from several seeds; keep the fewest crossings, within a time budget)
 output: a centre (x, y) for every node
```

Two ideas carry most of the result and are worth borrowing even if you use a different base layout:

* **Treat the problem in two scales.** Clusters are first-class objects: they get their own layout, are placed as big nodes, and are moved as rigid units later. Most crossings in a force layout come from clusters being arranged badly relative to each other, which node-level moves cannot fix.
* **Take single-link nodes out of the optimisation.** A node with one link can always be placed beside its neighbour without crossing anything, so it only adds noise to the search. Remove them first, put them back last (Section 4.10), and the remaining problem is smaller and easier.

## 3. Notation

* `n` nodes, `m` links; link `e = (s, t)`; node `i` has box size `(w_i, h_i)` and position `p_i = (x_i, y_i)`.
* `L` is the natural link length (default 95 px for node boxes about 100 × 30 px; scale it with node size).
* `g` is the target gap between clusters (default 60 px).
* A *gateway* is a node with at least one link to another cluster.
* `unit(v)` is `v / |v|`; `d(a, b)` is the distance between points; `dist(p, seg)` is the distance from point `p` to a segment.

## 4. The steps

### 4.1 Find clusters

Run multi-level **Louvain** community detection on the weighted, undirected graph. For a node `i` considered for community `C`, the modularity gain used (up to a constant factor) is

```
ΔQ(i → C) = k_{i,C} − Σ_C · k_i / (2W)
```

where `k_{i,C}` is the weight of links from `i` into `C`, `Σ_C` the total weighted degree of `C`, `k_i` the weighted degree of `i`, and `W` the total link weight. Nodes are moved greedily to the community with the largest positive gain until nothing moves, then communities are collapsed into nodes and the process repeats (up to 6 levels). Self-loops are kept at every level; dropping them at collapsed levels merges everything into one cluster, which is a trap.

Link weights: use 2 for hierarchy links (subclass, parent-child) and 1 for other relationships so that hierarchies stay together. Then **merge small clusters**: any cluster with fewer than 3 nodes joins the neighbouring cluster it shares the most link weight with (repeat up to 3 passes).

If this yields a single cluster, the method does not apply; fall back to a plain force layout.

### 4.2 Set aside single-link nodes

Let `N(i)` be the distinct neighbours of `i` (ignore self-loops and duplicate links). Repeatedly remove any node with `|N(i)| = 1` and remember its neighbour (its *hub*) and the order of removal. Removing a leaf can make its hub a leaf, so this peels whole trees hanging off the graph. The rest is the *core*. All of steps 4.1 to 4.9 run on the core only (4.1 is therefore computed on the core).

### 4.3 Lay out each cluster alone

For each cluster `c`, run a Fruchterman–Reingold style relaxation on its nodes with only its internal links:

```
repulsion between every pair (within a cutoff):  f = L² / d       along the line joining them
spring on a link of rest length ℓ, strength k:   f = k (d − ℓ)    (ℓ = L for weight-2 links, 1.25 L otherwise; k = 0.35)
displacement per iteration capped by a temperature  T(it) = T0 (1 − it/iters) + 0.5,  T0 = 0.35 L
iterations = min(260, 80 + 6·|c|);  weak pull to the origin (0.04) keeps it centred
```

Then push boxes apart until none touches (pad 22 px), centre the cluster at the origin and record its radius `R_c = max_i (|p_i| + half-diagonal_i) + 18`.

### 4.4 Lay out the clusters as big nodes

Each cluster becomes a disc of radius `R_c` at centre `C_c`. Forces on cluster centres:

```
repulsion for a pair (a, b), s = R_a + R_b + 0.6 g, d = |C_a − C_b|:
      f = ρ · s² / (d · L) · (3 if d < s else 1)         ρ = 2.2
spring for every pair of clusters joined by links, c = number of such links:
      rest length  R_a + R_b + g,   strength  0.08·√c,   f = strength · (d − rest) · (L/20)
weak pull to the middle:  0.0002 · L · position
```

The repulsion jumps to three times its size when two discs touch, which is what keeps clusters apart. Run 400 iterations with a decaying step (`T = 2L (1 − it/400) + 0.5`). Restart from 6 random starts (3 if there are more than 12 clusters) and keep the one with the smallest energy `Σ c·|d − rest|` plus a large penalty (10⁵) per overlapping pair.

### 4.5 Gateways on a ring, facing their partners

Place each cluster at its centre. For each cluster, put its gateways on an ellipse around the centre:

* **Direction.** For gateway `i`, the preferred angle is `θ_i = atan2( Σ_j unit(p_j − C) )` summed over the nodes `j` in other clusters that `i` links to. In the first round `p_j` is replaced by the *centre of j's cluster*. In later rounds it is the position of `j` itself, so a node faces the particular node it links to, not the middle of the other cluster. Run three rounds.
* **Radius.** `ρ = max(0.85·R_c, Σ_i (w_i + 12) / (2π) · 1.1)`; the ring is flattened vertically by 0.85.
* **Spacing.** Sort gateways by angle. Repeat 80 times: for each neighbouring pair, if the angular gap is below `((w_i + w_j)/2 + 34) / ρ`, push the two apart by half the shortfall each; then pull every angle 8 % of the way back toward its preferred angle. Several gateways that all link to the same neighbour therefore face it but fan out instead of crowding.
* **Interior nodes.** Non-gateways start near the point `C − 0.7·ρ·unit(Σ_i unit-direction_i)`, that is on the side facing away from the neighbours, and the cluster is relaxed again (as in 4.3) with a strong anchor (k = 0.5) holding each gateway at its ring position and a weak anchor (k = 0.06) holding the interior nodes at that away-point. Then push boxes apart (pad 14).

Finally slide whole clusters apart until their bounding boxes are at least `0.35 g + 20` apart (up to 120 sweeps; move along the axis of smaller overlap).

### 4.6 An imaginary node on every link

For 40 iterations, treat the midpoint `m_e = (p_s + p_t)/2` of each link as a particle:

```
repulsion between midpoints a, b closer than 2.2 L:   f = L² / d²  · (m_a − m_b)·½
      applied half to each end of each link, so a link is pushed sideways away from its neighbours
spring on every link back to its starting length:     k = 0.4
anchor of every node to its starting position:        k = 0.03
displacement capped by T = 0.12 L (1 − it/40) + 0.3
```

Then push boxes apart (pad 26) and re-separate clusters. Used alone this does little for crossings. Its value is that it spreads links away from each other and rounds off crowded fans, and the later steps keep the benefit.

### 4.7 Slide whole clusters

Visit clusters in descending number of inter-cluster links. For each cluster `c` compute the cost of everything that depends on its position

```
cost(c) = 1000 · (crossings of c's inter-cluster links with any link)
        + 0.8  · Σ over pairs of inter-cluster links (one of them c's) with distance d < 70:  (70 − d)
        + Σ over (inter-cluster link of c, node not at its ends) with distance d < θ_node:   1.5 (θ_node − d) + 10
        + Σ over (node of c, inter-cluster link not of c)   with distance d < θ_node:        1.5 (θ_node − d) + 10
        + 0.01 · total length of c's inter-cluster links
θ_node = 0.8 · half-diagonal + 14
```

Try shifting the whole cluster rigidly in 8 directions at distances `{0.3, 0.65, 1.1}·R_c`; reject shifts that bring its bounding box within `0.35 g + 20` of another cluster; keep the shift with the lowest cost if it lowers it. Up to 3 passes within 250 ms. Since the ring positions in 4.5 were chosen for the old cluster positions, redo step 4.5's last round for all clusters afterwards and **keep the result only if the summed cost is no worse**, otherwise restore the saved positions.

This is the step that reproduces what a person does by hand when re-stacking clusters so that the links between them run straight and side by side.

### 4.8 Swap nodes inside a cluster

For each node `v` that currently crosses something (up to 5 passes within 400 ms): try exchanging positions with each other node `u` of the same cluster; keep the swap if

```
cost(links at v and u) = crossings among them and every other link + 0.0003 · total length
```

drops. Rigid cluster moves cannot fix the crossings inside or between clusters that come from the order nodes sit in; swaps can. Only swapping within one cluster keeps the cluster's outline.

### 4.9 Push links off nodes

Up to 30 iterations (250 ms): for every link `e = (a, b)` and every other node `i`, let `q` be the point of the segment nearest to `i`. If `d = |p_i − q|` is below `θ_i = 0.8 · half-diagonal_i + 18`, push the node away from `q` by `(θ_i − d)/2`, and the link ends in the opposite direction by half of that, weighted by where `q` lies on the link. Apply the step (cap 40 px), push boxes apart (pad 18), recount crossings; **if the count rose, undo the step and halve the step size**. This is an imaginary node at the nearest point of each link; it removes most links lying across nodes without ever adding a crossing.

### 4.10 Multi-start

The whole pipeline (4.1 to 4.9 and 4.11) is run from different random seeds and the finished layout with the fewest crossings is kept. Number of tries: 6 for up to 40 nodes, 3 up to 100, 2 above; stop starting new tries after 900 ms, and stop at once when a layout has no crossings.

### 4.11 Put single-link nodes back, then shrink

For each set-aside node `v` in reverse order of removal, with hub `h` already placed:

1. For each of 72 directions `u`, the node would sit at `p_h + u · need`, where `need = min( ((w_h + w_v)/2 + G)/|u_x| , ((h_h + h_v)/2 + G)/|u_y| )` and `G = 40` is the gap (scale with node size).
2. **Ray cast.** `reach(u)` is the distance along the ray from `p_h` to the first link that does not touch `h`. If `reach < need + half-extent of v + 14`, the direction needs the surroundings stretched by `s = want / reach`.
3. **Clash test.** If any other node (including leaves already put back) would overlap the new box (with 12 px of margin) when all other nodes are stretched about `h` by `s`, increase `s` through `{1.1, 1.25, 1.5, 2, 3, 5, 8, 15, 30, 60}` until none does.
4. Choose the direction with the smallest `s` (ties: longer reach). If `s > 1`, scale all placed nodes about `h` by `1.03 s`; this is a similarity transform, so **no crossing changes while room is made**. Place `v`.

If any leaf needed stretching, restart the whole placement from the core scaled up about its centre by `min(1.04 · s_max, 3)`, up to 5 passes, so that the room comes from the core as a whole rather than from many local stretches.

A link to a single-link node cannot cross anything by construction: the segment from the hub to the chosen position lies inside the clear cone found by the ray cast.

**Shrink.** Stretching may have left the drawing larger than needed. Scale every position about the centroid by `f ∈ (0, 1]`, with `f` found by bisection on a log scale (30 steps) as the smallest value for which the number of touching pairs is no larger than at `f = 1`. A pair touches when boxes are closer than `G − 6` apart, or when two cluster bounding boxes are within 34 px. A uniform scale preserves every crossing and the order of everything, so the shrink is free; the gap threshold stops it squeezing a leaf back against its hub.

## 5. Cost

| Step | Cost |
|---|---|
| Louvain | O(m) per level |
| cluster layouts, gateway rings | O(Σ_c n_c² · iterations), n_c cluster size |
| midpoint repulsion | O(m²) per iteration inside a cutoff; 40 iterations. About 10–25 ms at m = 285. Use a spatial grid above about m = 1,000; the reference code skips it above m = 2,500 |
| cluster slide | O(inter-links · m) per candidate, 24 candidates per cluster, time capped |
| swaps | O(m) per candidate swap, time capped |
| push off nodes | O(n·m) per iteration, time capped |
| leaves | O(72 · (m + n)) per leaf |
| crossing count | O(m²) |

Measured on a 179-node, 285-link model (JavaScript, one laptop): one try ≈ 300 ms. A 23-node model: about 10 ms.

## 6. Results

Two models were used: a hand-made 23-class flight/aircraft ontology (38 links) and a synthetic 179-class bank ontology (285 links; eleven domains, hierarchies, cross-domain relationships). Numbers are averages over seeds.

| Model | Plain force layout (fcose) | This method, single try | Best of 6 tries |
|---|---|---|---|
| 23 nodes, crossings | 3 | 1.0 to 1.6 | 1.0 |
| 179 nodes, crossings | 668 to 811 | ≈ 75 | ≈ 71 |
| 179 nodes, lines through nodes | not measured | 27 | |
| 179 nodes, near-misses (< 30 px) | not measured | 76 | |
| 179 nodes, time per try | 80–120 ms | ≈ 300 ms | ≈ 1.5 s |

Contributions on the 179-node model (crossings, 4-seed averages): clusters laid out as big nodes and gateways on a ring ≈ 178; with partner-facing and more room ≈ 95; with the cluster slide ≈ 75; the push-off-nodes pass leaves crossings at ≈ 75 but cuts lines through nodes from 48 to 27 and near-misses from 131 to 76. Single-link nodes add exactly 0 crossings.

Compared with a layout a person tuned by hand on the 23-node model: the hand layout reached 1 crossing, the method reaches 1.0 to 1.6 on a single try. The person's moves that cannot be reproduced by single-node search are all of one type: several nodes moved at once, each move alone making things worse. The cluster slide (4.7) is the cheapest approximation to that found so far.

## 7. What was tried and did not help

* **Looser springs inside clusters** (to let nodes drift toward their partner side): no gain; swaps do it more reliably.
* **Rotating each cluster** to the best of 32 orientations: a large gain over a plain cluster layout (178 → 125 crossings) but subsumed by gateway rings facing partners; harmless on top, no extra gain.
* **Midpoint repulsion before the crossing search**: the later swap and move steps undo it; it only pays as a layout of links (4.6) or as a final pass that refuses to add crossings (4.9). Midpoints that also repel *nodes* were worse than the nearest-point push of 4.9.
* **Node moves to free spots next to neighbours, one at a time**: about 15 % fewer crossings but twice the time and more lines through nodes than the cluster slide.
* **Large gap between clusters first, then closing up evenly**: no gain. Cluster outlines, not the gap, set the size; the larger gap produced worse arrangements (84 vs 75 crossings) and the closing-up could recover about 2 % of the width.
* **Setting aside small groups hanging off one node** (the same idea as single-link nodes, for groups of 2 to 10 nodes): placing each group as a rigid piece needs more room than the layout has and either stretches the drawing 4–30× or leaves crossings. Reserving the group's footprint as one big node during the cluster layout is better (68.7 crossings versus 73.7 on the 179-node model, 16 % wider), but still leaves about 11 crossings on the groups' links. Not part of the method.
* **Best of more tries**: 6 tries cut crossings by about 8 % on the large model for 5× the time; on small models 6 tries are almost free and worth it.

## 8. Parameters

| Parameter | Default | Meaning |
|---|---|---|
| `L` | 95 px | natural link length; scale with typical node width |
| `g` | 60 px | cluster gap |
| `ρ` (meta repulsion) | 2.2 | cluster repulsion strength |
| gateway spacing pad | 34 px | extra room between neighbouring gateways |
| interior bias | 0.7 | how far interior nodes sit toward the side facing away |
| `G` leaf gap | 40 px | space between a single-link node and its hub |
| midpoint iterations | 40 | |
| slide budget / swap budget / push budget | 250 / 400 / 250 ms | |
| tries | 6 / 3 / 2 | by node count: up to 40 / up to 100 / more |
| minimum size | 8 nodes | smaller graphs use a plain force layout |

When node boxes are much larger or smaller than about 100 × 30 px, scale `L`, `g` and `G` by the same factor.

## 9. Limits and notes

* Straight-line drawings only. Crossings can often be reduced further by curving or bundling long links; that is a rendering step and is not part of this method.
* The quality of the result depends on the clusters found. Graphs without community structure (grids, random graphs) form one cluster; use a force layout.
* Time budgets are wall-clock; on a slow machine the later steps do less and the layout is slightly worse, never invalid. Positions are always finite and non-overlapping.
* Hub nodes with very many links make narrow ring spacing; the ring then widens (`ρ` grows with the sum of node widths).

## Appendix A. Reference implementation (JavaScript)

Self-contained; no dependencies. `_ogClusterLayout(items, edges, opts)` is the entry point: `items` is an array of `{ w, h }`, `edges` an array of `[i, j, weight]`; it returns `{ pos: [{ x, y }, …], crossings }`, or `null` when the graph is smaller than 8 nodes, has no links, or forms a single cluster (use a force layout then). The function names carry the prefix `_og` (ontology graph); rename freely.

```js
// ── OG: Cluster layout ─────────────
// Draws the classes as a few tight groups joined by long links, with as few crossed links as it can find:
//  1. Find groups of closely linked classes (Louvain modularity; subclass links count double; groups under 3 classes join a neighbour).
//  2. Set aside classes with a single link (and, repeatedly, classes that become single-linked); they come back at the end.
//  3. Lay each group out alone with springs, then lay the groups out as large nodes: strong repulsion, springs along the links between them.
//  4. Put each group's classes that link to other groups on a ring, each facing the classes it links to (not the other group's middle),
//     spaced apart; relax the rest of the group inside, pulled to the side facing away from its neighbours.
//  5. Push apart the midpoints of links (an imaginary node on each link), slide whole groups to where the links between groups are
//     straighter and further from classes and from each other, swap classes inside a group when that removes crossings,
//     push links off classes lying on them (any step that adds a crossing is undone).
//  6. Put the single-link classes back beside their neighbour in a spot where their one link crosses nothing, then shrink the whole
//     drawing evenly as far as nothing touches (shrinking evenly cannot change a crossing).
// Pure geometry, no Cytoscape: items [{w, h}], edges [[i, j, weight]]. Returns { pos: [{x, y}], crossings } or null when the model is
// too small to form groups (the caller then uses the force layout).
function _ogClRng(seed) { let a = seed | 0; return function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function _ogClSegX(a, b, c, d) {
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
function _ogClDPS(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); }
function _ogClDSS(a, b, c, d) { return _ogClSegX(a, b, c, d) ? 0 : Math.min(_ogClDPS(a, c, d), _ogClDPS(b, c, d), _ogClDPS(c, a, b), _ogClDPS(d, a, b)); }
// Edges [{s, t}] (self-links already dropped): how many pairs of links that share no end cross.
function _ogClCrossings(P, EE) {
  let x = 0;
  for (let i = 0; i < EE.length; i++) for (let j = i + 1; j < EE.length; j++) {
    const e = EE[i], f = EE[j];
    if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue;
    if (_ogClSegX(P[e.s], P[e.t], P[f.s], P[f.t])) x++;
  }
  return x;
}
// Community detection by modularity (multi-level Louvain). E: [a, b, weight]. Returns a group number per node.
function _ogClLouvain(n, E) {
  let comOfNode = [...Array(n).keys()], curN = n, curE = E;
  for (let level = 0; level < 6; level++) {
    const adj = Array.from({ length: curN }, () => []), loops = Array(curN).fill(0); let m2 = 0;
    curE.forEach(([a, b, w]) => { m2 += 2 * w; if (a === b) { loops[a] += 2 * w; return; } adj[a].push([b, w]); adj[b].push([a, w]); });
    if (!m2) break;
    const deg = adj.map((l, i) => l.reduce((s, [, w]) => s + w, loops[i])), com = [...Array(curN).keys()], tot = deg.slice();
    let moved = true, pass = 0;
    while (moved && pass++ < 30) {
      moved = false;
      for (let i = 0; i < curN; i++) {
        const ci = com[i], wc = new Map(); adj[i].forEach(([j, w]) => wc.set(com[j], (wc.get(com[j]) || 0) + w));
        tot[ci] -= deg[i]; let best = ci, bg = (wc.get(ci) || 0) - tot[ci] * deg[i] / m2;
        wc.forEach((w, c) => { const g = w - tot[c] * deg[i] / m2; if (g > bg + 1e-12) { bg = g; best = c; } });
        tot[best] += deg[i]; if (best !== ci) { com[i] = best; moved = true; }
      }
    }
    const ids = new Map(); com.forEach((c) => { if (!ids.has(c)) ids.set(c, ids.size); });
    if (ids.size === curN) break;
    comOfNode = comOfNode.map((c) => ids.get(com[c]));
    const agg = new Map(); curE.forEach(([a, b, w]) => { const x = ids.get(com[a]), y = ids.get(com[b]); const k = x < y ? x + "," + y : y + "," + x; agg.set(k, (agg.get(k) || 0) + w); });
    curE = [...agg].map(([k, w]) => { const [x, y] = k.split(",").map(Number); return [x, y, w]; }); curN = ids.size;
  }
  return comOfNode;
}
// Groups smaller than minSize join the neighbouring group they are most connected to.
function _ogClMergeSmall(com, E, minSize) {
  for (let pass = 0; pass < 3; pass++) {
    const size = new Map(); com.forEach((c) => size.set(c, (size.get(c) || 0) + 1));
    const link = new Map();
    E.forEach(([a, b, w]) => { if (com[a] !== com[b]) for (const [x, y] of [[com[a], com[b]], [com[b], com[a]]]) { if (!link.has(x)) link.set(x, new Map()); link.get(x).set(y, (link.get(x).get(y) || 0) + w); } });
    let changed = false;
    [...size].filter(([, s]) => s < minSize).forEach(([c]) => {
      const l = link.get(c); if (!l) return; let best = null, bw = 0; l.forEach((w, o) => { if (w > bw) { bw = w; best = o; } });
      if (best !== null) { com = com.map((x) => x === c ? best : x); changed = true; }
    });
    if (!changed) break;
  }
  const ids = new Map(); return com.map((c) => { if (!ids.has(c)) ids.set(c, ids.size); return ids.get(c); });
}
// Push nodes apart until no two boxes come closer than pad. P: [{x, y}], N: [{w, h}], moved in place.
function _ogClSeparate(P, N, pad, iters) {
  const n = P.length;
  for (let it = 0; it < iters; it++) {
    let moved = false;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const ox = (N[i].w + N[j].w) / 2 + pad - Math.abs(P[i].x - P[j].x); if (ox <= 0) continue;
      const oy = (N[i].h + N[j].h) / 2 + pad - Math.abs(P[i].y - P[j].y); if (oy <= 0) continue;
      moved = true;
      if (ox < oy) { const d = (P[i].x <= P[j].x ? 1 : -1) * (ox / 2 + 0.5); P[i].x -= d; P[j].x += d; }
      else { const d = (P[i].y <= P[j].y ? 1 : -1) * (oy / 2 + 0.5); P[i].y -= d; P[j].y += d; }
    }
    if (!moved) break;
  }
}
// Spring layout over some nodes (Fruchterman-Reingold style): springs [a, b, length, strength]; o.anchor(i) may return {x, y, k}.
function _ogClRelax(ids, P, N, springs, o, rnd) {
  const n = ids.length, L = o.L, cut2 = (o.cut || 4 * L) ** 2, K2 = L * L, D = ids.map(() => [0, 0]);
  const pos = new Map(ids.map((g, k) => [g, k]));
  const sp = springs.filter((s) => pos.has(s[0]) && pos.has(s[1])).map((s) => [pos.get(s[0]), pos.get(s[1]), s[2], s[3]]);
  for (let it = 0; it < o.iters; it++) {
    const t = o.t0 * (1 - it / o.iters) + 0.5;
    for (let a = 0; a < n; a++) { D[a][0] = 0; D[a][1] = 0; }
    for (let a = 0; a < n; a++) {
      const pa = P[ids[a]];
      for (let b = a + 1; b < n; b++) {
        const pb = P[ids[b]]; let dx = pa.x - pb.x, dy = pa.y - pb.y, d2 = dx * dx + dy * dy; if (d2 > cut2) continue;
        if (d2 < 1e-4) { dx = rnd() - 0.5; dy = rnd() - 0.5; d2 = dx * dx + dy * dy; }
        const d = Math.sqrt(d2), f = K2 / d / d;
        D[a][0] += dx * f; D[a][1] += dy * f; D[b][0] -= dx * f; D[b][1] -= dy * f;
      }
    }
    sp.forEach(([a, b, len, k]) => {
      const pa = P[ids[a]], pb = P[ids[b]], dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 0.01, f = k * (d - len) / d;
      D[a][0] += dx * f; D[a][1] += dy * f; D[b][0] -= dx * f; D[b][1] -= dy * f;
    });
    for (let a = 0; a < n; a++) {
      const p = P[ids[a]];
      if (o.anchor) { const an = o.anchor(ids[a]); if (an) { D[a][0] += (an.x - p.x) * an.k; D[a][1] += (an.y - p.y) * an.k; } }
      else { D[a][0] -= p.x * (o.grav || 0.01); D[a][1] -= p.y * (o.grav || 0.01); }
      const m = Math.hypot(D[a][0], D[a][1]); if (m > 0) { const s = Math.min(m, t) / m; p.x += D[a][0] * s; p.y += D[a][1] * s; }
    }
  }
}
// Crossings among the links in `inc` (each counted once) plus a tiny preference for short links.
function _ogClIncCost(P, EE, inc, incSet, countOnly) {
  let c = 0, len = 0;
  for (const i of inc) {
    const e = EE[i], pa = P[e.s], pb = P[e.t]; len += Math.hypot(pa.x - pb.x, pa.y - pb.y);
    for (let j = 0; j < EE.length; j++) {
      if (j === i || (j < i && incSet.has(j))) continue; const f = EE[j];
      if (e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t) continue;
      if (_ogClSegX(pa, pb, P[f.s], P[f.t])) c++;
    }
  }
  return countOnly ? c : c + len * 0.0003;
}
// Steps 1, 3, 4 and 5 for the classes that were not set aside. N: [{w, h}], edges [[a, b, weight]].
function _ogClCore(N, edges, opt, seed) {
  const n = N.length, L = opt.L, rnd = _ogClRng(seed);
  const E = edges.filter((e) => e[0] !== e[1]), EE = E.map((e) => ({ s: e[0], t: e[1] }));
  let com = n > 6 ? _ogClLouvain(n, E) : Array(n).fill(0);
  com = _ogClMergeSmall(com, E, 3);
  const nc = Math.max(...com) + 1, groups = Array.from({ length: nc }, () => []);
  com.forEach((c, i) => groups[c].push(i));
  if (nc < 2) return null;
  const P = N.map(() => ({ x: 0, y: 0 }));
  // Each group on its own, springs inside only
  const intra = E.filter(([a, b]) => com[a] === com[b]).map(([a, b, w]) => [a, b, L * (w > 1 ? 1 : 1.25), 0.35]);
  const R = [];
  groups.forEach((g, c) => {
    const rr = Math.sqrt(g.length) * L * 0.55;
    g.forEach((i, k) => { const a = 2 * Math.PI * k / g.length + rnd(), r = rr * (0.4 + rnd() * 0.6); P[i].x = Math.cos(a) * r; P[i].y = Math.sin(a) * r; });
    _ogClRelax(g, P, N, intra, { L, iters: g.length > 1 ? Math.min(260, 80 + g.length * 6) : 0, t0: L * 0.35, grav: 0.04 }, rnd);
    _ogClSeparate(g.map((i) => P[i]), g.map((i) => N[i]), 22, 40);
    let cx = 0, cy = 0; g.forEach((i) => { cx += P[i].x; cy += P[i].y; }); cx /= g.length; cy /= g.length;
    let r = 0; g.forEach((i) => { P[i].x -= cx; P[i].y -= cy; r = Math.max(r, Math.hypot(P[i].x, P[i].y) + Math.hypot(N[i].w, N[i].h) / 2); });
    R[c] = r + 18;
  });
  // Groups as large nodes: repulsion stronger than anything inside a group (and jumping when two touch), springs along the links between groups
  const link = new Map();
  E.forEach(([a, b]) => { if (com[a] !== com[b]) { const x = Math.min(com[a], com[b]), y = Math.max(com[a], com[b]), k = x + "," + y; link.set(k, (link.get(k) || 0) + 1); } });
  const metaSprings = [...link].map(([k, c]) => { const [x, y] = k.split(",").map(Number); return [x, y, R[x] + R[y] + opt.gap, 0.08 * Math.sqrt(c), c]; });
  let bestC = null, bestE = Infinity;
  for (let rs = 0; rs < (nc <= 12 ? 6 : 3); rs++) {
    const C = groups.map((g, c) => ({ x: Math.cos(2 * Math.PI * c / nc + rs * 1.3 + rnd()) * Math.sqrt(nc) * L * 2, y: Math.sin(2 * Math.PI * c / nc + rs * 1.3 + rnd()) * Math.sqrt(nc) * L * 2 }));
    const iters = 400;
    for (let it = 0; it < iters; it++) {
      const t = L * 2 * (1 - it / iters) + 0.5, D = C.map(() => [0, 0]);
      for (let a = 0; a < nc; a++) for (let b = a + 1; b < nc; b++) {
        const dx = C[a].x - C[b].x, dy = C[a].y - C[b].y, d = Math.hypot(dx, dy) || 0.01, s = R[a] + R[b] + opt.gap * 0.6;
        const mag = opt.metaRep * s * s / d / L * (d < s ? 3 : 1), ux = dx / d, uy = dy / d;
        D[a][0] += ux * mag; D[a][1] += uy * mag; D[b][0] -= ux * mag; D[b][1] -= uy * mag;
      }
      metaSprings.forEach(([a, b, len, k]) => { const dx = C[b].x - C[a].x, dy = C[b].y - C[a].y, d = Math.hypot(dx, dy) || 0.01, f = k * (d - len) / d * (L / 20); D[a][0] += dx * f; D[a][1] += dy * f; D[b][0] -= dx * f; D[b][1] -= dy * f; });
      C.forEach((c, a) => { D[a][0] -= c.x * 0.002 * L / 10; D[a][1] -= c.y * 0.002 * L / 10; const m = Math.hypot(D[a][0], D[a][1]); if (m > 0) { const s = Math.min(m, t) / m; c.x += D[a][0] * s; c.y += D[a][1] * s; } });
    }
    let en = 0; metaSprings.forEach(([a, b, len, , cnt]) => { const d = Math.hypot(C[a].x - C[b].x, C[a].y - C[b].y); en += cnt * Math.abs(d - len); });
    for (let a = 0; a < nc; a++) for (let b = a + 1; b < nc; b++) { if (Math.hypot(C[a].x - C[b].x, C[a].y - C[b].y) < R[a] + R[b]) en += 1e5; }
    if (en < bestE) { bestE = en; bestC = C; }
  }
  // Linked classes on a ring facing their partners; the rest relaxed inside, pulled away from the neighbours
  const ext = Array.from({ length: n }, () => []), extN = Array.from({ length: n }, () => []);
  E.forEach(([a, b]) => { if (com[a] !== com[b]) { ext[a].push(com[b]); ext[b].push(com[a]); extN[a].push(b); extN[b].push(a); } });
  const doGroup = (g, c, useNodes) => {
    const C = bestC[c], gw = g.filter((i) => ext[i].length), inner = g.filter((i) => !ext[i].length), th = {}; let ux = 0, uy = 0;
    gw.forEach((i) => {
      let dx = 0, dy = 0;
      if (useNodes) extN[i].forEach((j) => { const vx = P[j].x - C.x, vy = P[j].y - C.y, d = Math.hypot(vx, vy) || 1; dx += vx / d; dy += vy / d; });
      else ext[i].forEach((o) => { const vx = bestC[o].x - C.x, vy = bestC[o].y - C.y, d = Math.hypot(vx, vy) || 1; dx += vx / d; dy += vy / d; });
      th[i] = Math.atan2(dy, dx); ux += dx; uy += dy;
    });
    const um = Math.hypot(ux, uy) || 1; ux /= um; uy /= um;
    const sumW = gw.reduce((s, i) => s + N[i].w + 12, 0), rho = Math.max(R[c] * 0.85, sumW / (2 * Math.PI) * 1.1);
    const ord = gw.slice().sort((a, b) => th[a] - th[b]), ang = ord.map((i) => th[i]);
    for (let it = 0; it < 80 && ord.length > 1; it++) {
      for (let k = 0; k < ord.length; k++) {
        const j = (k + 1) % ord.length; let gp = ang[j] - ang[k]; if (j === 0) gp += 2 * Math.PI;
        const need = ((N[ord[k]].w + N[ord[j]].w) / 2 + 34) / rho;
        if (gp < need) { const d = (need - gp) / 2; ang[k] -= d; ang[j] += d; }
      }
      ord.forEach((i, k) => { ang[k] += (th[i] - ang[k]) * 0.08; });
    }
    ord.forEach((i, k) => { P[i].x = C.x + Math.cos(ang[k]) * rho; P[i].y = C.y + Math.sin(ang[k]) * rho * 0.85; th[i] = ang[k]; });
    const away = { x: C.x - ux * rho * 0.7, y: C.y - uy * rho * 0.7 };
    inner.forEach((i) => { P[i].x = away.x + (rnd() - 0.5) * rho * 0.6; P[i].y = away.y + (rnd() - 0.5) * rho * 0.6; });
    _ogClRelax(g, P, N, intra, { L, iters: Math.min(220, 100 + g.length * 4), t0: L * 0.2, cut: 3 * L,
      anchor: (i) => ext[i].length ? { x: C.x + Math.cos(th[i]) * rho, y: C.y + Math.sin(th[i]) * rho * 0.85, k: 0.5 } : { x: away.x, y: away.y, k: 0.06 } }, rnd);
    _ogClSeparate(g.map((i) => P[i]), g.map((i) => N[i]), 14, 40);
  };
  for (let rd = 0; rd < 3; rd++) groups.forEach((g, c) => doGroup(g, c, rd > 0));
  // Groups must not overlap: slide whole groups apart until their outlines clear
  const box = (g) => { let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9; g.forEach((i) => { x1 = Math.min(x1, P[i].x - N[i].w / 2); x2 = Math.max(x2, P[i].x + N[i].w / 2); y1 = Math.min(y1, P[i].y - N[i].h / 2); y2 = Math.max(y2, P[i].y + N[i].h / 2); }); return { x1, y1, x2, y2 }; };
  const gap = opt.gap * 0.35 + 20;
  const sepGroups = () => {
    for (let it = 0; it < 120; it++) {
      let moved = false; const B = groups.map(box);
      for (let a = 0; a < nc; a++) for (let b = a + 1; b < nc; b++) {
        const ox = Math.min(B[a].x2, B[b].x2) - Math.max(B[a].x1, B[b].x1) + gap, oy = Math.min(B[a].y2, B[b].y2) - Math.max(B[a].y1, B[b].y1) + gap;
        if (ox <= 0 || oy <= 0) continue; moved = true;
        const ca = { x: (B[a].x1 + B[a].x2) / 2, y: (B[a].y1 + B[a].y2) / 2 }, cb = { x: (B[b].x1 + B[b].x2) / 2, y: (B[b].y1 + B[b].y2) / 2 };
        let dx = 0, dy = 0; if (ox < oy) dx = (ca.x <= cb.x ? 1 : -1) * (ox / 2 + 1); else dy = (ca.y <= cb.y ? 1 : -1) * (oy / 2 + 1);
        groups[a].forEach((i) => { P[i].x -= dx; P[i].y -= dy; }); groups[b].forEach((i) => { P[i].x += dx; P[i].y += dy; });
      }
      if (!moved) break;
    }
  };
  sepGroups();
  const incE = Array.from({ length: n }, () => []); EE.forEach((e, i) => { incE[e.s].push(i); incE[e.t].push(i); });
  const m = EE.length, t0 = performance.now();
  // An imaginary node at the middle of every link; they repel each other and push the link's two ends apart
  if (m <= 2500) {
    const P0 = P.map((p) => ({ x: p.x, y: p.y })), len0 = EE.map((e) => Math.hypot(P[e.s].x - P[e.t].x, P[e.s].y - P[e.t].y));
    const cut2 = (2.2 * L) ** 2, K = L * L, iters = 40, mx = new Float64Array(m), my = new Float64Array(m), Dx = new Float64Array(n), Dy = new Float64Array(n);
    for (let it = 0; it < iters; it++) {
      const t = L * 0.12 * (1 - it / iters) + 0.3; Dx.fill(0); Dy.fill(0);
      for (let k = 0; k < m; k++) { const e = EE[k]; mx[k] = (P[e.s].x + P[e.t].x) / 2; my[k] = (P[e.s].y + P[e.t].y) / 2; }
      for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) {
        const dx = mx[a] - mx[b], dy = my[a] - my[b]; let d2 = dx * dx + dy * dy; if (d2 > cut2) continue; if (d2 < 1) d2 = 1;
        const f = K / d2 * 0.5, ea = EE[a], eb = EE[b];
        Dx[ea.s] += dx * f; Dy[ea.s] += dy * f; Dx[ea.t] += dx * f; Dy[ea.t] += dy * f; Dx[eb.s] -= dx * f; Dy[eb.s] -= dy * f; Dx[eb.t] -= dx * f; Dy[eb.t] -= dy * f;
      }
      for (let k = 0; k < m; k++) { const e = EE[k], pa = P[e.s], pb = P[e.t], dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 0.01, f = 0.4 * (d - len0[k]) / d; Dx[e.s] += dx * f; Dy[e.s] += dy * f; Dx[e.t] -= dx * f; Dy[e.t] -= dy * f; }
      for (let i = 0; i < n; i++) { Dx[i] += (P0[i].x - P[i].x) * 0.03; Dy[i] += (P0[i].y - P[i].y) * 0.03; const mg = Math.hypot(Dx[i], Dy[i]); if (mg > 0) { const s = Math.min(mg, t) / mg; P[i].x += Dx[i] * s; P[i].y += Dy[i] * s; } }
    }
    _ogClSeparate(P, N, 26, 60); sepGroups();
  }
  // Slide whole groups (rigidly) to where the links between groups are straighter and further from other links and from classes
  {
    const tn = performance.now(), thr = (i) => Math.hypot(N[i].w, N[i].h) / 2 * 0.8 + 14, adj = (e, f) => e.s === f.s || e.s === f.t || e.t === f.s || e.t === f.t;
    const interIdx = []; EE.forEach((e, i) => { if (com[e.s] !== com[e.t]) interIdx.push(i); });
    const costOf = (c) => {
      const inter = interIdx.filter((i) => com[EE[i].s] === c || com[EE[i].t] === c), set = new Set(inter); let cost = 0, len = 0;
      for (const i of inter) {
        const e = EE[i], a = P[e.s], b = P[e.t]; len += Math.hypot(a.x - b.x, a.y - b.y);
        for (let j = 0; j < EE.length; j++) { if (j === i || (set.has(j) && j < i)) continue; const f = EE[j]; if (adj(e, f)) continue; if (_ogClSegX(a, b, P[f.s], P[f.t])) cost += 1000; }
        for (const j of interIdx) { if (j === i || (set.has(j) && j < i)) continue; const f = EE[j]; if (adj(e, f)) continue; const d = _ogClDSS(a, b, P[f.s], P[f.t]); if (d < 70) cost += (70 - d) * 0.8; }
        for (let u = 0; u < n; u++) { if (u === e.s || u === e.t) continue; const d = _ogClDPS(P[u], a, b), th = thr(u); if (d < th) cost += (th - d) * 1.5 + 10; }
      }
      for (const u of groups[c]) for (const j of interIdx) { if (set.has(j)) continue; const f = EE[j]; if (f.s === u || f.t === u) continue; const d = _ogClDPS(P[u], P[f.s], P[f.t]), th = thr(u); if (d < th) cost += (th - d) * 1.5 + 10; }
      return cost + len * 0.01;
    };
    const overlapsOthers = (c) => { const B = box(groups[c]); for (let b = 0; b < nc; b++) { if (b === c) continue; const o = box(groups[b]); if (B.x1 < o.x2 + gap && o.x1 < B.x2 + gap && B.y1 < o.y2 + gap && o.y1 < B.y2 + gap) return true; } return false; };
    const shift = (c, dx, dy) => { groups[c].forEach((i) => { P[i].x += dx; P[i].y += dy; }); bestC[c].x += dx; bestC[c].y += dy; };
    const degOf = (c) => interIdx.filter((i) => com[EE[i].s] === c || com[EE[i].t] === c).length;
    const order = [...Array(nc).keys()].sort((a, b) => degOf(b) - degOf(a));
    let moved = 0;
    for (let pass = 0; pass < 3 && performance.now() - tn < opt.nudgeBudget; pass++) {
      let improved = false;
      for (const c of order) {
        if (performance.now() - tn > opt.nudgeBudget) break;
        const cur = costOf(c); let best = null;
        for (let k = 0; k < 8; k++) for (const f of [0.3, 0.65, 1.1]) {
          const a = 2 * Math.PI * k / 8, dx = Math.cos(a) * R[c] * f, dy = Math.sin(a) * R[c] * f; shift(c, dx, dy);
          if (!overlapsOthers(c)) { const v = costOf(c); if (v < cur - 1e-6 && (!best || v < best.v)) best = { v, dx, dy }; }
          shift(c, -dx, -dy);
        }
        if (best) { shift(c, best.dx, best.dy); improved = true; moved++; }
      }
      if (!improved) break;
    }
    // the ring positions were chosen for the old group positions: choose them again, and keep that only if it is no worse
    if (moved) {
      const snap = P.map((p) => ({ x: p.x, y: p.y })), tot = () => { let s = 0; for (let c = 0; c < nc; c++) s += costOf(c); return s; }, before = tot();
      groups.forEach((g, c) => doGroup(g, c, true)); sepGroups();
      if (tot() > before) for (let i = 0; i < n; i++) { P[i].x = snap[i].x; P[i].y = snap[i].y; }
    }
  }
  _ogClSeparate(P, N, 26, 60);
  // Swap two classes of one group whenever that removes crossings (inside the group or between groups)
  {
    const ts = performance.now();
    for (let pass = 0; pass < 5 && performance.now() - ts < opt.swapBudget; pass++) {
      let improved = false;
      for (const g of groups) {
        if (g.length < 2) continue;
        for (const v of g) {
          if (performance.now() - ts > opt.swapBudget) break;
          const sv = new Set(incE[v]); if (!_ogClIncCost(P, EE, incE[v], sv, true)) continue;
          for (const u of g) {
            if (u === v) continue;
            const set = new Set(incE[v]); incE[u].forEach((k) => set.add(k)); const inc = [...set];
            const before = _ogClIncCost(P, EE, inc, set), pv = P[v], pu = P[u]; P[v] = pu; P[u] = pv;
            const after = _ogClIncCost(P, EE, inc, set);
            if (after < before - 1e-9) improved = true; else { P[v] = pv; P[u] = pu; }
          }
        }
      }
      if (!improved) break;
    }
  }
  // Push links off classes lying on them: the point of the link nearest a class acts as an imaginary node pushing it away
  if (m <= 2500) {
    const tp = performance.now(); let cur = _ogClCrossings(P, EE), step = 1;
    const Dx = new Float64Array(n), Dy = new Float64Array(n);
    for (let it = 0; it < 30 && performance.now() - tp < opt.spreadBudget; it++) {
      Dx.fill(0); Dy.fill(0);
      for (let k = 0; k < m; k++) {
        const e = EE[k], a = P[e.s], b = P[e.t], ex = b.x - a.x, ey = b.y - a.y, L2 = ex * ex + ey * ey || 1;
        for (let i = 0; i < n; i++) {
          if (i === e.s || i === e.t) continue;
          const p = P[i]; let t = ((p.x - a.x) * ex + (p.y - a.y) * ey) / L2; t = Math.max(0, Math.min(1, t));
          let dx = p.x - (a.x + t * ex), dy = p.y - (a.y + t * ey); const d = Math.hypot(dx, dy) || 0.01, th = Math.hypot(N[i].w, N[i].h) / 2 * 0.8 + 18;
          if (d >= th) continue;
          const push = (th - d) * 0.5; dx /= d; dy /= d;
          Dx[i] += dx * push; Dy[i] += dy * push; Dx[e.s] -= dx * push * 0.5 * (1 - t); Dy[e.s] -= dy * push * 0.5 * (1 - t); Dx[e.t] -= dx * push * 0.5 * t; Dy[e.t] -= dy * push * 0.5 * t;
        }
      }
      const snap = P.map((p) => ({ x: p.x, y: p.y })); let any = false;
      for (let i = 0; i < n; i++) { const mg = Math.hypot(Dx[i], Dy[i]); if (mg > 0.01) { any = true; const s = Math.min(mg, 40) / mg * step; P[i].x += Dx[i] * s; P[i].y += Dy[i] * s; } }
      if (!any) break;
      _ogClSeparate(P, N, 18, 6); const x = _ogClCrossings(P, EE);
      if (x > cur) { for (let i = 0; i < n; i++) { P[i].x = snap[i].x; P[i].y = snap[i].y; } step *= 0.5; if (step < 0.1) break; } else cur = x;
    }
  }
  _ogClSeparate(P, N, 26, 60); sepGroups();
  return { P, com, groups, ms: performance.now() - t0 };
}
// The whole layout: set aside single-link classes, lay out the rest, put the single-link classes back, shrink evenly.
function _ogClOnce(items, edges, opt, seed) {
  const n = items.length, N = items.map((it) => ({ w: it.w, h: it.h }));
  const nb = Array.from({ length: n }, () => new Set());
  edges.forEach(([a, b]) => { if (a !== b) { nb[a].add(b); nb[b].add(a); } });
  const removed = new Array(n).fill(false), order = [], hubOf = new Array(n).fill(-1), deg = nb.map((s) => s.size), q = [];
  for (let i = 0; i < n; i++) if (deg[i] === 1) q.push(i);
  while (q.length) {
    const v = q.pop(); if (removed[v] || deg[v] !== 1) continue;
    let h = -1; nb[v].forEach((w) => { if (!removed[w]) h = w; }); if (h < 0) continue;
    removed[v] = true; order.push(v); hubOf[v] = h; deg[h]--; if (deg[h] === 1) q.push(h);
  }
  const core = []; for (let i = 0; i < n; i++) if (!removed[i]) core.push(i);
  if (core.length < 3) return null;
  const idx = new Map(core.map((g, k) => [g, k]));
  const cEdges = edges.filter(([a, b]) => idx.has(a) && idx.has(b)).map(([a, b, w]) => [idx.get(a), idx.get(b), w]);
  const r = _ogClCore(core.map((i) => N[i]), cEdges, opt, seed);
  if (!r) return null;
  const allEE = edges.filter(([a, b]) => a !== b).map(([a, b]) => [a, b]);
  const LG = opt.leafGap;
  let P = null, com = null, placed = null, maxNeed = 0, S = 1;
  const rayHit = (h, ux, uy) => {
    let best = Infinity; const o = P[h];
    for (const [x, y] of placed) {
      if (x === h || y === h) continue;
      const a = P[x], b = P[y], ex = b.x - a.x, ey = b.y - a.y, den = ux * ey - uy * ex; if (Math.abs(den) < 1e-12) continue;
      const t = ((a.x - o.x) * ey - (a.y - o.y) * ex) / den, s = ((a.x - o.x) * uy - (a.y - o.y) * ux) / den;
      if (t > 0 && s >= 0 && s <= 1 && t < best) best = t;
    }
    return best;
  };
  const scaleAbout = (h, s) => { const hx = P[h].x, hy = P[h].y; for (let u = 0; u < n; u++) if (P[u] && u !== h) { P[u].x = hx + (P[u].x - hx) * s; P[u].y = hy + (P[u].y - hy) * s; } };
  const placeLeaf = (v, h) => {
    let best = null;
    for (let a = 0; a < 72; a++) {
      const t = 2 * Math.PI * a / 72 + 0.05, ux = Math.cos(t), uy = Math.sin(t);
      const need = Math.min(((N[h].w + N[v].w) / 2 + LG) / Math.max(Math.abs(ux), 1e-6), ((N[h].h + N[v].h) / 2 + LG) / Math.max(Math.abs(uy), 1e-6));
      const reach = rayHit(h, ux, uy), want = need + Math.max(N[v].w * Math.abs(ux), N[v].h * Math.abs(uy)) / 2 + 14;
      let s = Math.max(1, want / reach);
      const p = { x: P[h].x + ux * need * 1.02, y: P[h].y + uy * need * 1.02 };
      // no other class (leaves already put back included) may sit on the leaf once everything else is stretched by s
      const clash = (sc) => {
        for (let u = 0; u < n; u++) {
          if (!P[u] || u === h) continue;
          const dx = (P[u].x - P[h].x) * sc - (p.x - P[h].x), dy = (P[u].y - P[h].y) * sc - (p.y - P[h].y);
          if (Math.abs(dx) < (N[u].w + N[v].w) / 2 + 12 && Math.abs(dy) < (N[u].h + N[v].h) / 2 + 12) return true;
        }
        return false;
      };
      if (clash(s)) { let ok = false; for (const f of [1.1, 1.25, 1.5, 2, 3, 5, 8, 15, 30, 60]) { const s2 = Math.max(s, f); if (!clash(s2)) { s = s2; ok = true; break; } } if (!ok) s = 1e3; }
      const cost = s + (Number.isFinite(reach) ? 0 : -0.001) - Math.min(reach, 400) * 1e-5;
      if (!best || cost < best.cost) best = { cost, s, ux, uy, need };
    }
    if (best.s > 1.0001) { maxNeed = Math.max(maxNeed, best.s); scaleAbout(h, best.s * 1.03); }
    P[v] = { x: P[h].x + best.ux * best.need * 1.02, y: P[h].y + best.uy * best.need * 1.02 }; com[v] = com[h]; placed.push([h, v]);
  };
  // The core is drawn at scale S about its centre; if the worst leaf needed more room, the next pass starts from a core scaled up by that much.
  for (let pass = 0; pass < 5; pass++) {
    P = new Array(n).fill(null); com = new Array(n).fill(0);
    const ccx = r.P.reduce((s, p) => s + p.x, 0) / r.P.length, ccy = r.P.reduce((s, p) => s + p.y, 0) / r.P.length;
    core.forEach((g, k) => { P[g] = { x: ccx + (r.P[k].x - ccx) * S, y: ccy + (r.P[k].y - ccy) * S }; com[g] = r.com[k]; });
    placed = allEE.filter(([a, b]) => P[a] && P[b]); maxNeed = 0;
    for (let k = order.length - 1; k >= 0; k--) { const v = order[k], h = hubOf[v]; if (P[h]) placeLeaf(v, h); }
    if (maxNeed <= 1.0001) break; S *= Math.min(maxNeed * 1.04, 3);
  }
  for (let i = 0; i < n; i++) if (!P[i]) P[i] = { x: 0, y: 0 };
  // Shrink evenly (a uniform scale cannot change a crossing) to the tightest size where no more boxes touch than at the start
  const nGroups = Math.max(...com) + 1, groups = Array.from({ length: nGroups }, () => []); com.forEach((c, i) => groups[c].push(i));
  const cx = P.reduce((s, p) => s + p.x, 0) / n, cy = P.reduce((s, p) => s + p.y, 0) / n, P1 = P.map((p) => ({ x: p.x, y: p.y })), tp = Math.max(8, LG - 6);
  const touches = (s) => {
    const Q = P1.map((p) => ({ x: cx + (p.x - cx) * s, y: cy + (p.y - cy) * s })); let c = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.abs(Q[i].x - Q[j].x) < (N[i].w + N[j].w) / 2 + tp && Math.abs(Q[i].y - Q[j].y) < (N[i].h + N[j].h) / 2 + tp) c++;
    const B = groups.map((g) => { let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9; g.forEach((i) => { x1 = Math.min(x1, Q[i].x - N[i].w / 2); x2 = Math.max(x2, Q[i].x + N[i].w / 2); y1 = Math.min(y1, Q[i].y - N[i].h / 2); y2 = Math.max(y2, Q[i].y + N[i].h / 2); }); return { x1, y1, x2, y2 }; });
    for (let a = 0; a < B.length; a++) for (let b = a + 1; b < B.length; b++) if (B[a].x1 < B[b].x2 + 34 && B[b].x1 < B[a].x2 + 34 && B[a].y1 < B[b].y2 + 34 && B[b].y1 < B[a].y2 + 34) c++;
    return c;
  };
  { const c1 = touches(1); let lo = 1e-4, hi = 1; for (let k = 0; k < 30; k++) { const mid = Math.sqrt(lo * hi); if (touches(mid) <= c1) hi = mid; else lo = mid; } P1.forEach((p, i) => { P[i].x = cx + (p.x - cx) * hi; P[i].y = cy + (p.y - cy) * hi; }); }
  return P;
}
// Several tries from different starts within a time budget; the one with the fewest crossed links is kept.
function _ogClusterLayout(items, edges, opts) {
  const n = items.length; if (n < 8 || !edges.length) return null;
  const o = opts || {}, sc = o.roomy ? 1.3 : 1;
  const opt = { L: 95 * sc, gap: 60 * sc, metaRep: 2.2, leafGap: 40 * sc, nudgeBudget: 250, swapBudget: 400, spreadBudget: 250 };
  const EE = edges.filter(([a, b]) => a !== b).map(([a, b]) => ({ s: a, t: b }));
  const maxTries = o.tries || (n <= 40 ? 6 : n <= 100 ? 3 : 2), budget = o.budgetMs || 900, t0 = performance.now();
  let best = null;
  for (let k = 0; k < maxTries && (k === 0 || performance.now() - t0 < budget); k++) {
    const P = _ogClOnce(items, edges, opt, 104729 + k * 7919); if (!P) return null;
    const x = EE.length <= 2500 ? _ogClCrossings(P, EE) : 0;
    if (!best || x < best.crossings) best = { pos: P, crossings: x };
    if (!x) break;
  }
  return best;
}
```
