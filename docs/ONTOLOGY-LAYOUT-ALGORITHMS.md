# Ontology diagram layouts: hand-off notes

Layouts for drawing an ontology (classes as labelled boxes, subclass links and object-property links between them) so that a person can read it: few crossed links, no link running through a class box, short and even links, classes that belong together drawn together, a drawing that is not much bigger than it needs to be. Written so another team can reimplement or reuse the code for any node-link diagram with labelled rectangular nodes.

The code is pure geometry with no dependencies (about 500 lines of JavaScript in `src/ontology-layouts.js`, between `// ── OG: Layout geometry helpers` and `function _ogClusterSpread`). Input: boxes `[{w, h}]` and links `[[i, j, weight, labelWidth?]]` (weight 2 for subclass links). Output: box centres `[{x, y}]`. Nothing is rounded.

Working names are used below (**Compact**, **Grouped**, **Auto**); official names are still to be chosen (see the last section).

## What is new, and what is not

Most building blocks are published, well-known techniques. Stated plainly, so nobody oversells this:

| Building block | Source | Ours? |
|---|---|---|
| Stress majorization (place nodes so straight distances match graph distances, weights 1/d²) | Gansner, Koren and North 2004; Graphviz `neato` | no |
| Pivot MDS start | Brandes and Pich 2006 | no |
| Louvain communities | Blondel et al. 2008 | no |
| Edge lengths that differ inside and between groups | known idea (group-aware and modularity layouts, cola's link-length helpers) | the factors are ours |
| Removing degree-1 nodes before layout and adding them back | common practice | the placement rule is ours |

What this work adds, and what the measurements below support:

1. **Hub ring lengths.** A link at a class with k neighbours gets an ideal length of at least Σ(neighbour box width + 20) / 2π, the radius of a ring that holds those neighbours side by side. One line of code, and on hub-heavy models it removes many of the links that run through classes (health record model, 53 classes and 129 links: about 80 links through classes with plain lengths, about 43 with ring lengths alone, about 22 with ring lengths, groups and leaf fanning together).
2. **One-link class placement with label room ("leaf fanning").** Classes with a single neighbour are taken out, the rest is laid out, then each is put back around its neighbour by searching 48 directions × the nearest free distances, minimising 100 × crossings + 80 × links touching the box + distance. It keeps a gap of max(40 px, label width + 16 px) from the neighbour so the link's text fits. A final pass re-places any whose link ended up crossed or touched. This is what makes taxonomy-heavy ontologies (many leaf subclasses) readable.
3. **Safe clean-up passes after stress.** Four local searches, each refusing any move that adds a crossing, a link through a box or an overlap: swap or move classes to reduce crossings; move a class off links that run through it; pull each class toward its neighbours to shorten long links; shrink the whole drawing evenly as far as the boxes allow. In the benchmark, plain stress runs typically 2–3× (1.2–4×) as many links through classes as stress with these passes, and usually about twice as many crossed links (up to 6× on the customer-hub model).
4. **A readability score and a portfolio.** Instead of one algorithm, several variants run within a time budget and a single score picks the result. The score: 10·crossings + 8·links through boxes + 2·near-touching link pairs (< 30 px) + 40·overlapping boxes + mean link length/10 + max(0, mean length − 350)/2 + max(0, area/(Σ box area) − 8)·4·√n + 25·Σ max(0, length/median − 1.8). The last two terms matter: without them the score prefers sprawling drawings (fewer crossings bought with enormous empty space) and drawings with a few absurdly long links.
5. **Measured, size-aware choice.** Which variants to run, and when to stop running them, comes from a benchmark of 28 model shapes (below), not from taste.

None of this is a new layout paradigm; it is a carefully tuned and measured combination aimed at ontologies. Whether it beats commercial engines (yFiles organic, Tom Sawyer) has not been tested.

## The algorithms

### Shared core: one stress run (`_ogStressLayout`)

```
boxes  := each class box + 16 × 12 px of room (× 1.3 when attribute tables are shown)
leaves := classes with exactly one distinct neighbour whose neighbour has others      (if cfg.leaves)
core   := all classes − leaves
for each core link (u, v):
    len := L (170 px; subclass links 0.9 L)
    if cfg.hub:  len := max(len, min(3 L, ring(u), ring(v)))      ring(x) = Σ(neighbour width + 20) / 2π
    if cfg.pods: len *= 0.85 if same Louvain group else cfg.pods (1.6)
    if the link carries a label: len := max(len, (w_u + w_v)/2 + labelWidth + 24)
D := all-pairs shortest paths over len (Dijkstra)
repeat restarts (8 / 4 / 2 by size; first from pivot MDS, others random), within 40 % of the budget:
    stress majorization on D (≤ 120 iterations, stop when average move < 0.05 px)
    push overlapping boxes apart
    keep the run with fewest crossings
clean-up: fewer crossings (swap/move) → off links → shorten links + even shrink → off links   (each time-boxed)
if cfg.leaves: put leaves back (see 2 above), clean-up once more on the whole drawing
re-place any one-link class closer than its label room, or whose link is crossed or touched (two passes)
if cfg.leafFix: move each one-link class to a better free spot if there is one
```

### Variants

| Variant | Settings | Good at |
|---|---|---|
| stress | random starts, plain lengths | dense small models (telecom-like meshes) |
| mds | pivot MDS start, leafFix | the safe default at every size |
| hubs | hub ring lengths, leaves out then back | models with one or two hubs and many one-link classes |
| leaves | leaves out then back | taxonomies |
| groups | pods 1.6, hub rings, leaves out then back; L 260 from 100 classes | large and hub-heavy models |

### Compact
Runs the variants that suit the size and keeps the best score: up to 30 classes mds, stress, hubs, leaves; up to 60 mds, stress, leaves; above that mds alone (sharing the time on large models starves the clean-up). 1.5 s budget.

### Grouped
The `groups` variant alone, 1 s budget; refuses models under 8 classes. Groups of closely linked classes stand apart, hubs get room, one-link classes fan out round their neighbour.

### Auto
Compact's variants plus `groups` up to 100 classes (dense models over 30 classes with more than two links per class: only mds plus groups), `groups` alone above 100 classes. Keeps the best score.

## Results

Benchmark: 28 model shapes, 9 to 537 classes, two seeds each, run as a Node module on a laptop (one core). The shapes include ontologies written from the published structure of PROV-O, SOSA/SSN, W3C ORG, the Pizza tutorial ontology, schema.org's core types and a FIBO-like loan model, plus invented domain models (university, hotel, HR, clinical trial, energy grid, telecom, healthcare record, customer 360 with one large hub, retail, supply chain, a 115-class biomedical taxonomy, a 179-class bank, three banks joined (537)), a structureless random mesh and scale-free graphs of 60–400 nodes. Boxes are sized from the label text.

Each cell: **crossed links / links through a class box (box + 9 px)**. "Plain stress" is the public baseline (stress majorization from a pivot-MDS start, as Graphviz `neato` does, then overlap removal). "fcose" is the Cytoscape force-directed layout with the settings the library uses for its Force choice (one run, then the same overlap removal), measured in a browser on the same boxes.

| Model | classes / links | Plain stress | fcose | Compact | Grouped | Auto (kept) | Auto time |
|---|---|---|---|---|---|---|---|
| University | 14 / 20 | 3 / 1 | 3 / 2 | 2 / 0 | 1 / 1 | 2 / 0 (Compact) | 22 ms |
| W3C ORG | 15 / 20 | 2 / 2 | 6 / 6 | 0 / 0 | 0 / 0 | 0 / 0 (Compact) | 13 ms |
| Brewery IoT (app sample) | 23 / 37 | 2 / 1 | 3 / 0 | 1 / 0 | 1 / 0 | 1 / 0 (Compact) | 39 ms |
| PROV-O | 30 / 62 | 58 / 24 | 86 / 32 | 35 / 10 | 28 / 12 | 35 / 10 (Compact) | 0.5 s |
| Telecom network (dense) | 34 / 86 | 69 / 15 | 172 / 33 | 32 / 7 | 36 / 4 | 30 / 6 (Grouped) | 0.3 s |
| SOSA/SSN | 36 / 63 | 38 / 20 | 45 / 21 | 12 / 8 | 14 / 5 | 12 / 8 (Compact) | 0.3 s |
| schema.org core (hubs) | 49 / 102 | 237 / 59 | 402 / 132 | 112 / 29 | 58 / 47 | 111 / 29 (Compact) | 0.7 s |
| Healthcare record (3 super-hubs) | 53 / 129 | 451 / 128 | 755 / 208 | 214 / 101 | 161 / 25 | 161 / 25 (Grouped) | 1.2 s |
| FIBO-like loans | 59 / 77 | 32 / 19 | 44 / 39 | 14 / 6 | 14 / 4 | 14 / 6 (Compact) | 0.4 s |
| Pizza (taxonomy) | 90 / 94 | 15 / 86 | 102 / 107 | 2 / 26 | 10 / 38 | 2 / 26 (Compact) | 0.4 s |
| Biomedical taxonomy | 115 / 139 | 71 / 61 | 181 / 139 | 36 / 22 | 22 / 9 | 22 / 9 (Grouped) | 0.4 s |
| Bank | 179 / 285 | 337 / 296 | 719 / 461 | 152 / 126 | 72 / 15 | 71 / 16 (Grouped) | 1.0 s |
| Scale-free 400 | 400 / 482 | 1242 / 860 | 4527 / 3727 | 1063 / 617 | 753 / 253 | 766 / 256 (Grouped) | 1.3 s |
| Three banks joined | 537 / 915 | 4129 / 2646 | 5861 / 3142 | 3921 / 2282 | 2317 / 1012 | 2292 / 984 (Grouped) | 1.4 s |

On the readability score, Auto ranks first or tied-first on 27 of the 28 shapes (the random mesh is 0.3 % behind Compact), and plain stress ranks last on every shape. fcose is faster (under 50 ms up to 180 classes) but from 30 classes up it crosses 2.5–10× more links and runs 3–30× more links through classes than the better of Compact and Grouped. Compact's drawings take 4–10× the area of their boxes; Grouped's 5–30× (hub-heavy models spread most).

Honest limits:
- Hub-heavy models stay hard: the health model still has 161 crossings. Grouped gets links out of class boxes (25 against 101), not out of each other's way.
- One-link classes: Grouped keeps every one at least its label room from its neighbour; on a 159-class test model none has its link crossed and 3 of 31 have another link touching them (the rest are boxed in by surrounding links, and making room would mean stretching the drawing).
- Timings are for one core in Node; in a visible browser tab expect about the same, in a hidden tab 2–4× slower. The time budget is enforced by the clean-up steps; the fixed part (paths, stress, leaf placement) is about 0.3 s at 160 classes.

## What did not work (do not repeat)
- **Unbounded stretching** to make room for one-link classes (scale the drawing about the neighbour until a clean spot exists). The earlier cluster layout did this and produced drawings millions of pixels wide on hub-heavy models; even capped at 2.5× it doubled the area of dense drawings for one or two fewer touched classes.
- Pulling hubs together toward the centre, 1/d stress weights instead of 1/d², degree- or Jaccard-scaled link lengths: no gain.
- Splitting a fixed time budget between several variants on large models: each run's clean-up is starved and the result is worse than one variant with all the time.
- Longer base link length (L 280) for large models: fewer links through classes but more area; 260 from 100 classes is the compromise.
- A 20-second exhaustive search on the hub-heavy health model reaches about 150 crossings against 161 in 1 s. For hub-heavy models the stress family is near its limit; a real improvement there needs a different drawing (edge bundling, or showing a hub more than once), not a better placement.

## Reuse notes
- Pure functions; wrap boxes and links from any renderer (the library wraps Cytoscape nodes in `_ogClusterSpread`).
- Benchmark harness: `bench.mjs` with `models*.js` and `engines2.js`. Run the code as an ES module: Node's `vm` contexts run it about 20× slower, and a hidden browser tab 2–4× slower than a visible one.

## Names (to be decided)

Three things here are worth a name of their own. Suggestions only; the final names are the author's call. The names a user sees in the library's list can stay short and plain (Compact, Grouped, Auto) whatever the algorithms are called in documents.

| What | Working name | Suggestions | Reasoning |
|---|---|---|---|
| Stress layout with safe clean-up passes and leaf fanning, best of a few variants | Compact | **Tidy Stress**; **Settled Stress**; **Stress+** | Says what it is (stress majorization) and what it adds (a tidy result: nothing crossed, touched or stretched that a safe move can fix). |
| Group- and hub-aware stress: short links inside Louvain groups, long between, ring room for hubs, fanned leaves | Grouped | **Mycelium**; **Pod Stress**; **Hub-and-Pod** | Mycelium matches the picture (dense pods joined by long threads) and the "mycelium-style pods" idea it came from; Pod Stress is the descriptive alternative. |
| Running a few layouts and keeping the best by one readability score with sprawl and long-link penalties | Auto | **Readability Portfolio**; **Best-Read**; **Layout Jury** | It is a portfolio judged by a score, not an algorithm; the name should say it picks. |
| The two smaller techniques, if they are written up separately | (none) | **Hub rings** (ring-radius link lengths); **Leaf fanning with label room** | Plain descriptive names; neither is big enough to deserve a brand. |
