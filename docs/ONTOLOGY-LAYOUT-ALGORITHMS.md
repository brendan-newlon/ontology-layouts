# Tidy Stress and Mycelium: layouts for readable ontology diagrams

The full write-up is [ONTOLOGY-LAYOUT-ALGORITHMS.html](ONTOLOGY-LAYOUT-ALGORITHMS.html). It is a single self-contained page with:
- side-by-side drawings: an open-source layout on the left, ours on the right;
- the rankings and per-graph results;
- a worked example of the clean-up after the layout, step by step, each step explained in plain terms and in math;
- how the clean-up was learned from recorded hand edits, and what is and is not new in it;
- how the layouts work, the prior work they use, the benchmark method, its limits, and what did not work;
- the complete source code.

This file is a short summary.

## What counts, and what deliberately does not
These layouts are for ontologies. All rankings use five measures:
- crossed links and links through classes, first;
- crossing angle and angular resolution, next;
- area.

Distance fidelity (normalised stress) and even link lengths are left out on purpose. A multi-domain business ontology links many domains back to shared classes such as Person or Organization, and keeping each domain together, even at the cost of long links to the shared classes, is the point. Our layouts did poorly on those two measures in an earlier run.

## Results
Over 15 test graphs of 13 to 179 classes, one run each, ours with the clean-up, against 11 open-source layouts with tuned settings:

| Result | Detail |
|---|---|
| **About half the crossings** | Best Read 483 against 960 for tuned `neato` and 971 for tuned WebCola |
| **A quarter of the links through classes of tuned WebCola** | 74 against 307. Tuned `neato` draws 81, in twelve times the area |
| **First on the five measures** | Mean rank among 13 layouts: Tidy Stress 3.3, Mycelium 4.3; next WebCola 5.4 and `neato` 5.5. Best Read, ranked in their place, 2.7 |
| **Per graph** | Best Read has the fewest crossed links plus links through classes, or ties, on 14 of 15 graphs |
| **Under a second** | Median 0.6–0.8 s in a browser, clean-up included; at most about 1.5 s up to 179 classes |

What they give up: they are not the most compact (Cytoscape `cose` and dagre pack tighter; Mycelium's drawings are about 1.4× Best Read's), Mycelium's crossing angles rank mid-table, and they are slower than Graphviz at general settings.

The open-source layouts were Graphviz `neato`, `fdp` and `sfdp`, ELK stress, force and layered, WebCola, d3-force, dagre, and Cytoscape `cose` and `fcose`.

## The two layouts, the auto mode and the clean-up
- **Tidy Stress** (up to a few dozen classes). Stress majorization on graph distances, then tidy-up moves that remove crossings, links through boxes and long links. It tries four settings and keeps the most readable drawing.
- **Mycelium** (large and hub-heavy ontologies). The same placement and tidy-up, plus Louvain pods (shorter links inside groups, longer between), hub rings and leaf fanning.
- **Best Read** (auto mode). Runs both, scores the drawings, keeps the better. Above 100 classes it runs Mycelium alone.
- **Clean-up** (after any of the three). Learned from a person tidying the layouts by hand in the Layout Lab:
  - single moves: a class in a problem moves into nearby open space (an open-space grid);
  - leaf units: leaves, leaf chains and leaf triangles hanging off one class are turned around it; long labels go sideways;
  - region spreading: the regions where problems pile up are pushed outward in 8 slices, more toward open space, then repaired;
  - group moves with look-ahead, and a last leaf pass.

  It uses what is left of 1.5 s, at most 0.5 s. Effect on Best Read over the 15 graphs: links through classes 129 → 74, crossings 499 → 483, area unchanged, median time 0.44 → 0.83 s. Single moves give most of the gain; spreading and group moves together remove about a quarter of what single moves and leaf units leave.

## Experiments not yet in the layouts
Both were tested before the clean-up was added.
- **Subclass links top-down.** A constrained variant draws 100% of subclass links downward, against about half now. On small graphs it costs little; on broad taxonomies it costs readability.
- **Bent links.** Bending the links that run through a class, instead of moving classes, draws a quarter fewer crossings in 15% less area at about 22 bends per graph.

## Limits
- No study with people reading the diagrams; which measures matter most is a judgement backed by Purchase's studies of crossings.
- The layouts and the clean-up were tuned on the same 15 graphs; the clean-up's rules come from one person's edits.
- Best Read and Tidy Stress search within a time limit, so totals vary between runs (up to about 10% in our checks).
- The tuned settings are a reasonable search, not an exhaustive one. All drawings are measured with straight links.
- The test graphs are reconstructions and inventions of typical shapes, not a public corpus of real ontologies. Commercial engines were not tested.

## For developers
- **Code:** the implementation is in `src/ontology-layouts.js`:
  - `_ogCompactLayout` is Tidy Stress;
  - `_ogGroupedLayout` is Mycelium;
  - `_ogAutoLayout` is Best Read;
  - `_ogHandTidy` is the clean-up, and `_ogLayoutCleanUp` calls it after a layout within the time left.
- **Benchmark:** `tools/layout-bench/`. Its README explains how to rerun it and how to rebuild the HTML page.
