# Tidy Stress and Mycelium: layouts for readable ontology diagrams

The full write-up is [ONTOLOGY-LAYOUT-ALGORITHMS.html](ONTOLOGY-LAYOUT-ALGORITHMS.html). It is a single self-contained page with:
- side-by-side drawings: an open-source layout on the left, ours on the right, on the 15 development graphs and on 34 graphs never seen during development;
- the rankings and per-graph results, with tabs that add optional measures (subclass links top-down; distance fidelity and even link lengths);
- a worked example of the clean-up after the layout, step by step, each step explained in plain terms and in math;
- how the clean-up was taught: a person explained and demonstrated how they tidy these drawings, and the principles were distilled into rules a program can run;
- time for one graph and for many, how the layouts work, the prior work they use, the benchmark method, its limits, and what did not work;
- the complete source code.

This file is a short summary.

## What counts, and what deliberately does not
These layouts are for ontologies. The main rankings use five measures:
- crossed links and links through classes, first;
- crossing angle and angular resolution, next;
- area.

Distance fidelity (normalized stress) and even link lengths are left out on purpose. A multi-domain business ontology links many domains back to shared classes such as Person or Organization, and keeping each domain together, even at the cost of long links to the shared classes, is the point. These layouts are for conceptual ontologies, where classes are joined mostly by relationships; there a subclass link is one relationship among many, and about half point down. Taxonomies are not the target: Best Read no longer draws a top-down tree (it did until 2026-11-07, and kept it on one of 51 graphs, where the other drawing was just as clean); the Tree layout still draws any model top-down on request. Each of these measures can be added to the rankings with a tab; our layouts rank lower with distance and length in.

## Results
Over 15 development graphs of 13 to 179 classes, one run each, ours with the clean-up, against 11 open-source layouts with tuned settings:

| Result | Detail |
|---|---|
| **About half the crossings** | Best Read 450 against 960 for tuned `neato` and 971 for tuned WebCola |
| **A fifth of the links through classes of tuned WebCola** | 60 against 307. Tuned `neato` draws 81, in about 13 times the area |
| **First on the five measures** | Mean rank among 13 layouts: Tidy Stress 3.1, Mycelium 4.7; next WebCola 5.4 and `neato` 5.5. Best Read, ranked in their place, 2.9 |
| **Per graph** | Best Read has the fewest crossed links plus links through classes, or ties, on all 15 graphs |
| **Under a second** | Median 0.6 s, clean-up included; at most about 1.3 s up to 537 classes; the same drawing on any computer |

**Graphs never seen during development** (10 held-out graphs, 8 published ontologies, 18 Rome benchmark graphs): Best Read 1,593 crossed links and 156 links through classes, against 2,160 / 212 for tuned `neato` (in eight times the area) and 2,429 / 780 for tuned WebCola; fewest of both, or tied, on 35 of 36 graphs (the exception: two big hubs). Mean rank: Tidy Stress 3.5, Mycelium 3.6, `neato` 5.4, WebCola 5.6; Best Read in their place 2.9. Best Read chooses without the long-link penalties of the readability score (decided on the development graphs).

What they give up: they are not the most compact (Cytoscape `cose` and dagre pack tighter), and they are slower than Graphviz at general settings: for one graph under 100 classes about 0.3 to 0.6 s against 20 to 50 ms, which a person opening one diagram does not notice; for 100 graphs of about 70 classes, about a minute against about 5 seconds.

The open-source layouts were Graphviz `neato`, `fdp` and `sfdp`, ELK stress, force and layered, WebCola, d3-force, dagre, and Cytoscape `cose` and `fcose`.

## The two layouts, the auto mode and the clean-up
- **Tidy Stress** (up to a few dozen classes). Stress majorization on graph distances, then tidy-up moves that remove crossings, links through boxes and long links. It tries several settings and keeps the most readable drawing.
- **Mycelium** (large and hub-heavy ontologies). The same placement and tidy-up, plus Louvain pods (shorter links inside groups, longer between), hub rings and leaf fanning.
- **Best Read** (auto mode). Runs Tidy Stress and Mycelium, scores the drawings (problems, mean length and area; no long-link penalty), keeps the better; above 100 classes it runs Mycelium alone.
- **Tree** (offered on its own; not used by Best Read). Custom, after Reingold–Tilford tidy trees: classes on levels, each one below its deepest superclass (so second superclasses are above too), subtrees side by side, each level deep enough that no parent-to-child line clips a sibling; the clean-up keeps it top-down. Models linked mostly by relationships go to dagre instead.
- **Clean-up** (after any of the three). Taught by a person who explained and demonstrated how they tidy these drawings in the Layout Lab; their principles were distilled into:
  - single moves: a class in a problem moves into nearby open space (an open-space grid);
  - leaf units: leaves, leaf chains and leaf triangles hanging off one class are turned around it; long labels go sideways;
  - region spreading: the regions where problems pile up are pushed outward in 8 slices, more toward open space, then repaired;
  - group moves with look-ahead, and a last leaf pass.

  It uses what is left of 1.5 s, at most 0.5 s; above 100 classes the layout gets 0.6 s so the clean-up keeps its share. Effect on Best Read over the 15 graphs: links through classes 124 → 60, crossings 484 → 450, area unchanged, median time 0.3 → 0.6 s.
- **Passes after the clean-up** (in `_ogLayoutCleanUp`, at most 120 ms): one-link classes of the same class trade places when that leaves fewer problems; a one-link class whose link still crosses or runs through something moves to the most open spot round its neighbor; a class that a link runs through (or passes within 9 px of) is pushed sideways off it. On straight links over the 51 graphs, links through classes 216 → 178.
- **Link routing** (after any layout, `_ogRouteLinks`). Parallel and reciprocal links become arcs 24 px apart; self-links become loops; a link still through a class (or crossing others, when it pays off) gets one or two bends round the obstacle, kept only if the drawing improves counting the extra length; link ends crowding one side of a box are spread along it (ports); link names go on or just beside their link where they cover no class and no other name. Since 2026-11-08: loops take the most open of 12 places round the class; a bend outside the drawing costs 1 per 20 px; and a class a drawn curve still runs through is pushed off it, the links routed again, kept only if better (the result then carries the moved positions in `pos`). Totals over the 51 graphs with the clean-up and routing, before → after these changes: crossed links 1,738 → 1,714, links through classes 75 → 59, names over a class or name 331 → 147, names with a link across 1,330 → 882, bends 534 → 503, area 0 to 2% larger, mean time about 430 → 455 ms (SAREF about 1.6 s). First measured on 2026-11-07, over the 51 graphs, measured on the curves, on Best Read's drawings: crossed links 2,043 → 1,736, links through classes 218 → 75, parallel links hidden on another 171 → 0, sharp crossings 113 → 25, names over a class or another name 4,396 → 328 (against names at the middle of straight links; the names are made up, the graphs carry none), about 10 bends per graph, 2–4% more area, at most 250 ms. Routes come as bends `{t, d}` (fraction along the line between the two centers, offset to its left), port offsets, a loop for self-links and a name position; `_ogRoutePoly` turns one into the drawn curve.
- **Time limits count work, not seconds.** `_ogSetTimeLimit(ms)` sets the limit for the layouts, clean-up and routing together (default 1500). A computer up to 2.5 times slower takes longer and draws the same picture.

## Experiments not in the layouts
- **Subclass links top-down in the stress layouts.** Not free: as hard constraints with the clean-up, crossings +27% and links through classes fourfold over the 15 graphs; as a soft hierarchy term in the placement (λ·max(0, violation)², after DIG-CoLa), 94% down but crossings 203 → 262 and links through classes 91 → 166 on eight graphs; as a tie-breaker in the clean-up, links through classes 55 → 67. Hence the separate tree for taxonomies.
- **Hierarchy as a stress energy term** (DIG-CoLa style, λ up to 16): the share of subclass links pointing down rises only from 46% to 54%, with 14% more links through classes; the tidy-up steps after the stress solve decide most directions.
- **Bent links instead of moves** (simple router, current layouts, per graph): placement plus bends 27.5 crossings, 3.9 through, 18 bends, 9% less area; as shipped 34.7, 1.8, no bends; as shipped plus bends for what is left 33.5, 0.4, 2 bends. This became the link routing above. Routing the drawing before the clean-up instead of after leaves twice the links through classes for no smaller area, so the clean-up stays.
- **Also tested for the review of 2026-11-07, not adopted** (`tools/layout-bench/ekgbench.mjs`): a half or quarter area penalty in the clean-up and a deeper look-ahead for group moves (within about 1% on problems, up to 6% more area); giving the layout the link names' widths (fewer name overlaps on unseen graphs, but 15% more crossings on the development graphs and up to 30% more area).
- **Start at the matching size instead of five times too large** (retested 2026-11-08 with the clean-up and routing, 51 graphs): 2% fewer crossed links and fewer links through classes, but twice the sharp crossings (59 against 29), all on the two densest public ontologies. Not adopted for now.
- **ELK layered with its own routed links**, instead of straight ones: no links through classes, but 1,322 crossed pairs over the 15 graphs against Best Read's 450, with about 165 bends per graph (a different trade-off, not a defect; no comparison with a dedicated obstacle router was made).

## Limits
- No study with people reading the diagrams; which measures matter most is a judgment backed by Purchase's studies of crossings. A task-based study is the missing evidence.
- At 1,204 classes Best Read still has the fewest problems (1.6 s, against 19–21 s for Graphviz); at 3,335 (Cell Ontology) d3-force draws fewer (60k crossings against 75k, 12k links through classes against 27k), and Graphviz `sfdp` did not finish in ten minutes. Thousands of classes need a multilevel placement.
- The layouts and the clean-up were developed on 15 graphs; the 36 unseen graphs check that the lead carries over. The clean-up's principles come from one person.
- The layouts use a random seed; totals over the 15 graphs differ by a few percent between seeds. Every result uses seed 1.
- The tuned settings are a reasonable search, not an exhaustive one. The rankings measure straight links; the link routing is measured on our drawings only.
- Hubs with dozens of links (the clinical record's three hubs) still leave the most crossings; bundling or drawing a hub twice was not tried.
- Commercial engines were not tested, and the public graphs are eight ontologies and 18 Rome graphs, not a large corpus.

## For developers
- **Code:** the implementation is in `src/ontology-layouts.js`:
  - `_ogCompactLayout` is Tidy Stress;
  - `_ogGroupedLayout` is Mycelium;
  - `_ogAutoLayout` is Best Read;
  - `_ogHandTidy` is the clean-up, and `_ogLayoutCleanUp` calls it after a layout within the time left;
  - `_ogRouteLinks` draws the links after that, `_ogRoutePoly` gives a route's curve, `_ogRouteMetrics` measures on the curves;
  - `_ogLeafSwap` runs the passes after the clean-up; `_ogSetTimeLimit` sets the time limit;
  - `_ogTraced` reports every step of a layout, for the playback;
  - `_ogNow` is the work clock every time limit reads.
- **Benchmark:** `tools/layout-bench/`. Its README explains how to rerun it and how to rebuild the HTML page.
