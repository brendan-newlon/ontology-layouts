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

Distance fidelity (normalized stress) and even link lengths are left out on purpose. A multi-domain business ontology links many domains back to shared classes such as Person or Organization, and keeping each domain together, even at the cost of long links to the shared classes, is the point. Subclass links drawn top-down are not a goal either: an ontology diagram is a map of concepts, not an organization chart. Each of these can be added to the rankings with a tab; our layouts rank lower with distance and length in.

## Results
Over 15 development graphs of 13 to 179 classes, one run each, ours with the clean-up, against 11 open-source layouts with tuned settings:

| Result | Detail |
|---|---|
| **About half the crossings** | Best Read 529 against 960 for tuned `neato` and 971 for tuned WebCola |
| **A sixth of the links through classes of tuned WebCola** | 47 against 307. Tuned `neato` draws 81, in about 13 times the area |
| **First on the five measures** | Mean rank among 13 layouts: Tidy Stress 3.3, Mycelium 4.4; next WebCola 5.4 and `neato` 5.5. Best Read, ranked in their place, 2.8 |
| **Per graph** | Best Read has the fewest crossed links plus links through classes, or ties, on 14 of 15 graphs |
| **Under a second** | Median 0.6 s, clean-up included; at most about 1.2 s up to 537 classes; the same drawing on any computer |

**Graphs never seen during development** (10 held-out graphs, 8 published ontologies, 18 Rome benchmark graphs): Best Read 1,615 crossed links and 179 links through classes, against 2,160 / 212 for tuned `neato` (in eight times the area) and 2,429 / 780 for tuned WebCola; fewest of both on 35 of 36 graphs, all 26 public ones included. Mean rank: Tidy Stress 3.7, Mycelium 3.8, `neato` 5.3, WebCola 5.6; Best Read in their place 3.1. On the public graphs Mycelium alone draws fewer crossings than Best Read (1,071 against 1,297), so Best Read's choice between the two is not always the better one there.

What they give up: they are not the most compact (Cytoscape `cose` and dagre pack tighter), and they are slower than Graphviz at general settings: for one graph under 100 classes about 0.3 to 0.6 s against 20 to 50 ms, which a person opening one diagram does not notice; for 100 graphs of about 70 classes, about a minute against about 5 seconds.

The open-source layouts were Graphviz `neato`, `fdp` and `sfdp`, ELK stress, force and layered, WebCola, d3-force, dagre, and Cytoscape `cose` and `fcose`.

## The two layouts, the auto mode and the clean-up
- **Tidy Stress** (up to a few dozen classes). Stress majorization on graph distances, then tidy-up moves that remove crossings, links through boxes and long links. It tries several settings and keeps the most readable drawing.
- **Mycelium** (large and hub-heavy ontologies). The same placement and tidy-up, plus Louvain pods (shorter links inside groups, longer between), hub rings and leaf fanning.
- **Best Read** (auto mode). Runs both, scores the drawings, keeps the better. Above 100 classes it runs Mycelium alone.
- **Clean-up** (after any of the three). Taught by a person who explained and demonstrated how they tidy these drawings in the Layout Lab; their principles were distilled into:
  - single moves: a class in a problem moves into nearby open space (an open-space grid);
  - leaf units: leaves, leaf chains and leaf triangles hanging off one class are turned around it; long labels go sideways;
  - region spreading: the regions where problems pile up are pushed outward in 8 slices, more toward open space, then repaired;
  - group moves with look-ahead, and a last leaf pass.

  It uses what is left of 1.5 s, at most 0.5 s; above 100 classes the layout gets 0.6 s so the clean-up keeps its share. Effect on Best Read over the 15 graphs: links through classes 145 → 47, crossings 539 → 529, area unchanged, median time 0.3 → 0.6 s.
- **Time limits count work, not seconds.** A computer up to 2.5 times slower takes longer and draws the same picture.

## Experiments not in the layouts
- **Subclass links top-down.** Not free: with the clean-up, keeping every subclass below its parent raised crossings 27% and links through classes fourfold over the 15 graphs; even as a tie-breaker it raised links through classes from 55 to 67. So the layouts do not do it.
- **Bent links.** Bending the links that run through a class, instead of moving classes, draws a quarter fewer crossings in 15% less area at about 22 bends per graph (tested before the clean-up).
- **ELK layered with its own routed links**, instead of straight ones: no links through classes, but 1,322 crossed pairs over the 15 graphs against Best Read's 529, and about 165 bends per graph.

## Limits
- No study with people reading the diagrams; which measures matter most is a judgment backed by Purchase's studies of crossings.
- The layouts and the clean-up were developed on 15 graphs; the 36 unseen graphs check that the lead carries over. The clean-up's principles come from one person.
- The layouts use a random seed; totals over the 15 graphs differ by a few percent between seeds. Every result uses seed 1.
- The tuned settings are a reasonable search, not an exhaustive one. All drawings are measured with straight links.
- Commercial engines were not tested, and the public graphs are eight ontologies and 18 Rome graphs, not a large corpus.

## For developers
- **Code:** the implementation is in `src/ontology-layouts.js`:
  - `_ogCompactLayout` is Tidy Stress;
  - `_ogGroupedLayout` is Mycelium;
  - `_ogAutoLayout` is Best Read;
  - `_ogHandTidy` is the clean-up, and `_ogLayoutCleanUp` calls it after a layout within the time left;
  - `_ogNow` is the work clock every time limit reads.
- **Benchmark:** `tools/layout-bench/`. Its README explains how to rerun it and how to rebuild the HTML page.
