# Tidy Mycelium and the earlier layouts: readable ontology diagrams

There are two branches of layouts here. **Tidy Mycelium** is our best and the default everywhere: in the library, the Layout Lab and the write-up. The **earlier layouts** it grew from, Tidy Stress, Mycelium and Best Read (which keeps the better of the two), are still in the library: their approaches worked well too, and parts of them live on in Tidy Mycelium. The clean-up and the link routing are shared by all of them.

The full write-up is [ONTOLOGY-LAYOUT-ALGORITHMS.html](ONTOLOGY-LAYOUT-ALGORITHMS.html), and [ONTOLOGY-LAYOUT-ALGORITHMS-LAB.html](ONTOLOGY-LAYOUT-ALGORITHMS-LAB.html) is the same page with the Layout Lab built in. Each is a single self-contained page with a tab for Tidy Mycelium (shown first) and a tab for the earlier layouts, each with:
- an executive summary, and the five problems the rankings count, pictured;
- side-by-side drawings: an open-source layout on the left, ours on the right, on the 15 development graphs and on 34 graphs never seen during development; ours can be shown with straight or curved (routed) links, and ← → flip through the graphs;
- the rankings and per-graph results, with tabs that add optional measures (subclass links top-down; distance fidelity and even link lengths; for the unseen graphs, links touching classes graded);
- time and scale; on the earlier layouts' tab also top-down drawings of hierarchies.

Below the two tabs, shared by all the layouts: drawings that change (keeping a drawing after an edit, and growing it click by click in a graph browser); a worked example of the clean-up and its finishing passes; link routing; the benchmark method, its limits, and an appendix on using the code, with the complete source. How the layouts work, how the clean-up was taught by show and tell (Brendan Newlon designed the lab for teaching it, demonstrated and explained there how he tidies these drawings, and directed an AI assistant, Claude (Opus 5.5), to distill the principles into rules a program can run), the prior work and what did not work are on the development story page.

This file is a short summary. The method behind the clean-up, and how to build a lab like ours for another problem, is in [SHOW-AND-TELL-LABS.md](SHOW-AND-TELL-LABS.md).

## What counts, and what deliberately does not
These layouts are for ontologies. The main rankings use five measures:
- crossed links and links through classes, first;
- crossing angle and angular resolution, next;
- area.

Distance fidelity (normalized stress) and even link lengths are left out on purpose. A multi-domain business ontology links many domains back to shared classes such as Person or Organization. Keeping each domain together, even at the cost of long links to the shared classes, is the point. Each of these measures can be added to the rankings with a tab; our layouts rank lower with distance and length in.

## Tidy Mycelium (the default)
The parts that hang off the graph by one class are set aside; the core is placed in Mycelium's groups with room kept round each anchor; the parts come back into the most open slice round their anchor; the clean-up runs; then the empty space is taken in, in bands from each side and corner that take along what is in their way, and class by class. Every link keeps room for its name. `prefer` chooses what matters most:

| 62 graphs, 3 seeds | Problems | Area | Time |
|---|---|---|---|
| `'fewer-problems'` (default) | **15,316** | 1,600 | 59 s |
| `'smaller'` | 16,633 | **1,224** | 57 s |
| `'faster'` | 16,310 | 2,010 | **33 s** |

Problems are crossed links, links through classes and overlaps, with straight links and no link names; area is each drawing's bounding box over its boxes' area, summed. Apps that draw each link's name at the middle of the link pass the names' height as `midNames`, and the last step never makes a name cover a class or another name.

Over 15 development graphs of 13 to 179 classes, one run each, against 11 open-source layouts with tuned settings:

| Result | Detail |
|---|---|
| **Well under half the crossings** | 402 against 960 for tuned `neato` and 971 for tuned WebCola |
| **A sixth of the links through classes of tuned WebCola** | 54 against 307. Tuned `neato` draws 81, in about 11 times the area |
| **First of 12 on the five measures** | Its overall score, its average place over the graphs and the five measures (lower is better), is 3.3 among itself and the 11 open-source layouts; next comes WebCola (4.7). Each of the other two preferences, ranked on its own, also places first |
| **Nearly every graph** | The fewest crossed links plus links through classes, or ties, on 13 of the 15 graphs; on the other two a tuned Graphviz layout has one fewer |
| **Under a second** | Median 0.27 s, clean-up included; about 1.5 s at 400 to 1,204 classes; the same drawing on any computer |

**Graphs never seen during development** (10 held-out graphs, 8 published ontologies, 18 Rome benchmark graphs): 1,352 crossed links and 150 links through classes, in a median 5.6 times the area of the boxes, against 2,160 and 212 for tuned `neato` (in about fifteen times the area) and 2,429 and 780 for tuned WebCola. The fewest of both, or ties, on 32 of the 36 graphs (tuned `neato` has one or two fewer on the other four), and first of 12 with a mean rank of 3.2 (`neato` 4.6).

**Links touching classes, graded.** A link that clips a corner of a class misleads less than one through its middle. On the unseen graphs, where every layout's drawing is recorded, each touch is also counted by how bad it is: through the middle 1, a clipped corner (less than 15% of the box cut off) ½, a near miss within 3 px ¼. Graded, Tidy Mycelium counts 76, tuned `neato` 125 and tuned WebCola 461; Tidy Mycelium ranks first on that measure too. The Layout Lab colors the three kinds red, orange and yellow.

**Large graphs.** A fifth to a third fewer problems than Best Read at 400 to 1,204 classes, in about 1.5 s; at 3,335 classes (the Cell Ontology) level with d3-force, in 16 s against its 6.4 s.

**Where others lead.** Cytoscape `cose` and dagre pack tighter, by letting links run through boxes. Graphviz is faster: for one graph under 100 classes it takes 20 to 50 ms against our 0.15 to 0.3 s; 100 graphs of about 70 classes take about half a minute against about 5 seconds. With distance and even lengths added, WebCola ranks first.

The open-source layouts were Graphviz `neato`, `fdp` and `sfdp`, ELK stress, force and layered, WebCola, d3-force, dagre, and Cytoscape `cose` and `fcose`.

## The earlier layouts: Tidy Stress, Mycelium and Best Read
- **Tidy Stress** (`layout: 'compact'`, up to a few dozen classes). Stress majorization on graph distances, then tidy-up moves that remove crossings, links through boxes and long links. It tries several settings and keeps the most readable drawing.
- **Mycelium** (`layout: 'grouped'`, large and hub-heavy ontologies). The same placement and tidy-up, plus Louvain pods (shorter links inside groups, longer between), hub rings and leaf fanning.
- **Best Read** (`layout: 'auto'`, the default until November 2026). Runs Tidy Stress and Mycelium, scores the drawings (problems, mean length and area; no long-link penalty), and keeps the better one. Above 100 classes it runs Mycelium alone.

Measured the same way, Best Read draws 480 crossed links and 51 links through classes over the 15 development graphs, first of 12 with an overall score of 2.9 (WebCola 4.7), and has the fewest problems, or ties, on all 15; on the 36 unseen graphs 1,549 and 127, first of 12 with 2.9, the fewest or tied on all 36. Tidy Stress and Mycelium, each ranked on its own, also place first. At 3,335 classes d3-force draws far fewer problems than Best Read.

**Top-down hierarchies** (an experiment, not yet an entry point). The same placement, with every subclass at least 40 px below its superclass. The clean-up and its finishing passes keep it that way. Every subclass link points down, with a third to a half of the crossings of tuned ELK layered and a quarter to an eighth of its links through classes:

| Graphs | Our top-down | Tuned ELK layered |
|---|---|---|
| 15 development | 588 crossed links, 141 links through classes | 1,663 and 516 |
| 10 held-out | 420 and 63 | 1,433 and 509 |
| 26 public | 1,391 and 135 | 3,100 and 751 |

The tidy tree in the library (`_ogTreeLayout`, after Reingold–Tilford, levels by the deepest superclass) draws two to four times the crossings of the top-down stress drawing on every set, because real taxonomies have second superclasses and relationships that cut across a tree.

## Shared by all our layouts
**Exploring a graph.** Simulated graph-browser sessions: 12 graphs, 48 sessions, 425 drawings of up to 15 new classes each, straight links. The table gives per-drawing averages:

| Each click drawn by | Crossed links | Links through classes | Names covered | Earlier classes moved | Time |
|---|---|---|---|---|---|
| A typical force-directed expansion (earlier classes pinned) | 71.7 | 25.7 | 6.3 | none | 12 ms |
| `draw(…, { keep, exact: true })` | 24.9 | 5.4 | 1.9 | none | 6 ms |
| `draw(…, { keep })` | 20.0 | 1.1 | 1.2 | 2.7% of the drawing | 132 ms |
| Redraw | 13.3 | 1.6 | 1.1 | 38.5% | 237 ms |

- **Clean-up, first part** (after any layout). Taught by Brendan Newlon, who designed the Layout Lab for teaching it and demonstrated there how he tidies these drawings and why. At his direction, his principles were distilled into:
  - single moves: a class in a problem moves into nearby open space (an open-space grid);
  - leaf units: leaves, leaf chains and leaf triangles hanging off one class are turned around it; long labels go sideways;
  - region spreading: the regions where problems pile up are pushed outward in 8 slices, more toward open space, then repaired;
  - group moves with look-ahead, and a last leaf pass.

  It uses what is left of the time limit, at most a third of it. Above 100 classes the layout gets 40% of the limit, so the clean-up keeps its share. (The default limit is 1 s since 2026-11-12; it was 1.5 s.) Effect on Best Read over the 15 graphs, with the finishing passes: links through classes 124 → 39, crossings 484 → 452, area 8.0 → 6.3 times the boxes, median time 0.2 → 0.5 s.
- **Clean-up, finishing passes** (`_ogLeafSwap`, `_ogPullIn`). These came from a second round of teaching, in which he watched the first part in the Layout Playback and named what was still wrong:
  - one-link classes of the same class trade places;
  - "don't fence me in": a one-link class whose link still crosses or runs through something moves to the most open spot round its neighbor;
  - "push it off the line": a class a link runs through is pushed sideways off it;
  - "pull it in from the edge": parts hanging by one link turn or draw in, and whole groups slide toward the middle, when the drawing gets smaller with no more problems.

  Last, classes with no link and small separate parts that sit among the main graph's classes move out to one side of it (`_ogApart`), when that adds no problem and at most 10% area.
  In top-down mode no pass may lift a subclass above its superclass, and the pull-in is skipped. Over the 51 graphs the pull-in makes the drawing 9% smaller on the development graphs and 27–29% smaller on the unseen ones.
- **Relation classes** (`between: [subject, object]` on a box; opt-in). A relationship modelled as a class moves onto the line between the two classes it relates.
- **Keeping an earlier drawing** (`draw(…, { keep, exact })`). After an edit, the old classes keep their positions and only the new ones are placed, round the classes they link to.
- **Link routing** (`_ogRouteLinks`):
  - parallel and reciprocal links become arcs;
  - self-links become loops on the most open side;
  - a link still through a class gets one or two bends round it, kept only if the drawing improves;
  - link ends crowding one side of a box are spread along it;
  - link names go on or beside their link where they cover nothing.

  Over the 51 graphs: 15% fewer crossed links, two thirds fewer links through classes, no parallel link hidden, and 93% fewer names on top of classes or other names, for about 10 bends per graph. `straight: true` bends no link round a class; repeated and reciprocal links stay arcs and self-links loops, unless `arcs: false` also draws repeated links as parallel straight lines. Bending links instead of moving classes was retested with this routing and is no longer better: two to eleven times the links through classes left, about twice the bends, for about as many crossings.
- **Time limits count work, not seconds.** `_ogSetTimeLimit(ms)` sets the limit for the layouts and the clean-up (default 1000 since 2026-11-12, was 1500: about 22% faster, after routing 5% more crossed links and 19% fewer links through classes over the 51 test graphs, still the fewest problems on every test graph; the routing keeps at least its time at 1500). A computer up to 2.5 times slower takes longer and draws the same picture.

## Limits
- As graph-drawing theory nothing here is new: no new model and no bounds. The new parts are applied: the clean-up taught by demonstration, routing joined to placement, the work clock, and the evaluation on unseen graphs.
- No study with people reading the diagrams has been done. Which measures matter most is a judgment backed by Purchase's studies of crossings; a task-based study is the missing evidence.
- At 3,335 classes d3-force draws fewer problems (72,111 in 6.4 s, against 102,600 in 9.8 s). More time does not close the gap: with a 60 s limit Best Read takes 44 s and draws 92,316. At 1,204 classes more time helps (6,176 problems at the default, 4,881 in 4.3 s). Thousands of classes need a multilevel placement.
- Boxes: every benchmark sizes boxes from their labels. The layouts work on any box sizes; with all boxes 60 × 40 the counts are about the same, and with mixed boxes up to 220 × 90 there are 14% more crossed links and twice the links through classes, still a quarter of d3-force's crossings and a tenth of its links through classes (`sizebench.mjs`).
- The clean-up's principles come from one person. The layouts use a random seed, and totals differ by a few percent between seeds; every result uses seed 1.
- The tuned settings are a reasonable search, not an exhaustive one. The rankings measure straight links.
- Commercial engines (yFiles, Tom Sawyer and others) were not tested. They are closed source, and we found no published drawing of theirs of a graph we could rebuild exactly. yEd, built on yFiles, could be compared by hand.

## For developers
- **Code:** the implementation is in `src/ontology-layouts.js`:
  - `_ogTidyMycelium` is Tidy Mycelium (`_tmBest` places, `_tmCompact` takes in the empty space), `_ogCompactLayout` Tidy Stress, `_ogGroupedLayout` Mycelium, `_ogAutoLayout` Best Read, `_ogTreeLayout` the tidy tree;
  - `_ogHandTidy` is the clean-up, and `_ogLayoutCleanUp` calls it and the finishing passes after a layout;
  - `_ogRouteLinks` draws the links, `_ogRoutePoly` gives a route's curve, and `_ogRouteMetrics` measures on the curves;
  - `_ogPlaceNew` places new classes round a kept drawing;
  - `_ogTraced` reports every step of a layout, for the playback;
  - `_ogNow` is the work clock;
  - `OntologyLayouts.draw` runs the whole pipeline.
- **Two margins:** links through classes count within 3 px of a box in the rankings, as published comparisons do, and within 9 px in everything about the routing.
- **Playback and Lab:** [SHOW-AND-TELL-LABS.md](SHOW-AND-TELL-LABS.md) covers the method; [PLAYBACK-AND-LAB.md](PLAYBACK-AND-LAB.md) covers the technical contract for adapting the pages.
- **Benchmark:** `tools/layout-bench/`. Its README explains how to rerun it and how to rebuild the HTML page.
