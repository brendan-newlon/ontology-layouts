# Tidy Stress and Mycelium: layouts for readable ontology diagrams

The full write-up is [ONTOLOGY-LAYOUT-ALGORITHMS.html](ONTOLOGY-LAYOUT-ALGORITHMS.html). It is a single self-contained page with:
- side-by-side drawings: an open-source layout on the left, ours on the right;
- the scoreboard and per-graph results;
- how both layouts work, how readability is scored, and the prior work they use;
- the benchmark method, its limits, and what did not work;
- the complete source code.

This file is a short summary.

## Results
Against 11 widely used open-source layouts, on 19 test graphs of 13 to 537 classes:

| Result | Detail |
|---|---|
| **Ahead of all 11** | Tidy Stress and Mycelium each rank above every one of the 11 open-source layouts on overall readability |
| **2–3× fewer crossed links** | Than the best open-source layout, on mid-size and hub-heavy ontologies |
| **2–5× fewer links through classes** | The error that makes two unrelated classes look linked |
| **1.5 s or less** | For ontologies of up to 537 classes, in a browser |

The open-source layouts were Graphviz `neato`, `fdp` and `sfdp`, ELK stress, force and layered, WebCola, d3-force, dagre, and Cytoscape `cose` and `fcose`.

What they give up:
- They are not the most compact layouts.
- Mycelium's threads between pods are long by design.
- At 537 classes, WebCola draws somewhat fewer crossings, but takes over a hundred times as long.

## The two layouts and the auto mode
- **Tidy Stress** (up to a few dozen classes). It places classes so that straight-line distances match how many links apart they are (stress majorization). It then tidies the drawing with moves that remove crossings, links through boxes and long links, keeping a move only if nothing else gets worse. It tries four settings of these steps and keeps the most readable drawing.
- **Mycelium** (large and hub-heavy ontologies). The same placement and tidy-up, plus three things:
  - pods: links inside Louvain groups are drawn shorter and links between groups longer;
  - hub rings: a class with many links gets room for all its neighbours;
  - leaf fanning: single-link classes fan out around their neighbour, with room for the link's label.
- **Best Read** (auto mode). It runs both layouts, scores the two drawings for readability, and keeps the better one. Above 100 classes it runs Mycelium alone. It changes no setting inside either layout.

## Scoreboard (average rank among 14 layouts, 1 = best)

| Layout | Readability, all graphs | ≤ 30 classes | 31–100 | > 100 | Crossed links | Links through classes | Area | Very long links | Wins | Median time |
|---|---|---|---|---|---|---|---|---|---|---|
| **Tidy Stress** | 1.8 | 1.0 | 1.8 | 3.5 | 2.1 | 3.0 | 5.6 | 8.5 | 14 | 288 ms |
| **Mycelium** | 3.6 | 4.0 | 4.1 | 1.8 | 1.8 | 2.4 | 7.6 | 11.9 | 4 | 88 ms |
| Graphviz sfdp | 6.1 | 4.7 | 5.8 | 9.0 | 6.4 | 4.9 | 7.2 | 7.7 | 0 | 8 ms |
| ELK stress | 6.1 | 6.4 | 6.0 | 5.8 | 5.8 | 6.8 | 7.3 | 1.1 | 0 | 152 ms |
| WebCola | 6.2 | 9.7 | 5.0 | 2.5 | 5.2 | 4.9 | 10.9 | 3.6 | 1 | 97 ms |
| Graphviz neato | 6.5 | 6.6 | 4.9 | 9.8 | 5.7 | 4.1 | 10.4 | 5.5 | 0 | 7 ms |
| d3-force | 7.7 | 8.9 | 8.0 | 5.3 | 8.3 | 7.6 | 9.6 | 2.0 | 0 | 22 ms |
| Cytoscape fcose | 8.3 | 6.9 | 9.0 | 9.3 | 8.5 | 9.3 | 5.4 | 1.2 | 0 | 6 ms |
| ELK layered | 8.9 | 8.3 | 9.5 | 8.7 | 8.1 | 8.7 | 9.6 | 12.4 | 0 | 35 ms |
| dagre (layered) | 9.6 | 8.3 | 10.6 | 10.0 | 9.6 | 11.3 | 4.5 | 11.3 | 0 | 19 ms |
| ELK force | 12.2 | 11.4 | 12.4 | 13.3 | 13.2 | 10.8 | 11.1 | 3.9 | 0 | 143 ms |
| Cytoscape cose | 12.8 | 13.9 | 13.1 | 10.3 | 11.4 | 13.9 | 1.1 | 10.4 | 0 | 23 ms |
| Graphviz fdp | 12.9 | 13.0 | 13.3 | 12.3 | 13.6 | 11.7 | 7.6 | 3.5 | 0 | 10 ms |
| *Best Read (auto mode)* | 1.3 | 1.1 | 1.0 | 2.3 | 1.5 | 1.6 | 6.2 | 9.5 | – | 359 ms |

- **Wins** counts the graphs on which a layout ranked first in readability against the other 12 layouts. Best Read is left out of that count, because its drawing is always one of ours.
- **Best Read** has its own row because it is a complete layout procedure: it takes a graph and returns positions, and its time includes running both layouts.

## Limits
- The readability score was designed with these layouts, and the layouts were tuned against it. The crossing and through-class counts are standard measures and agree with the score, but no study with people reading the diagrams has been done.
- The open-source layouts ran with general settings, not settings tuned for each graph.
- The test graphs are reconstructions and inventions of typical shapes, not a public collection of real ontologies. Commercial engines were not tested.

## For developers
- **Code:** the implementation is in `src/ontology-layouts.js`:
  - `_ogCompactLayout` is Tidy Stress;
  - `_ogGroupedLayout` is Mycelium;
  - `_ogAutoLayout` is Best Read.
- **Benchmark:** `tools/layout-bench/`. Its README explains how to rerun it and how to rebuild the HTML page.
