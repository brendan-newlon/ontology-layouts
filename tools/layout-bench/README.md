# Layout benchmark

Reproduces the numbers in `docs/ONTOLOGY-LAYOUT-ALGORITHMS.md` and builds its interactive HTML version.

## What is here

| File | Purpose |
|---|---|
| `build_base.mjs` | Copies the library's layout functions out of `src/ontology-layouts.js` into `base_layout.js` (generated, not committed). Run it after any change to the layouts. |
| `models.js`, `models2.js`, `models3.js`, `models4.js` | The benchmark models, written in a small text format: `A<B C` means B and C are subclasses of A; `A-B C` means A links to B and C. Brewery IoT and Parcel delivery are two small sample ontologies, stored as parsed classes and links. |
| `bench.mjs`, `mkbundle.mjs`, `engines2.js` | The headless bench in Node, for our layouts and the experiments that were tried (`engines2.js`). |
| `contenders.html` | The browser bench against the open-source layouts: Graphviz through viz.js, ELK, WebCola, d3-force, dagre, Cytoscape `cose` and `fcose`. It loads them from public CDNs. |
| `lab.html` | Hands-on lab: starts from Best Read (or Tidy Stress, Mycelium), lets you move classes, move a Ctrl+click selection as a group, and pull bends into links, while measuring crossings, sharp crossings, links through classes and cramped classes along the curves. Every step and every typed note is logged in order with the measures before and after and the positions after; sessions are posted to `tools/recv.py` (port 8013) as `_temp/lab_<graph>_<time>.json`. One session per graph: coming back to a graph resumes its latest session from localStorage (event `resume`), and `_temp/lab_journal.json` records the order in which graphs were opened. Ctrl+Z (also from an empty note box) marks the undone step `undone: true`; the "ignore" button on a step sets `ignored: true`. Leave both out when analysing. Pans, zooms and toggles are recorded as `view` and `toggle` events but not listed. **Walk through** runs the clean-up with every step recorded, on the starting layout (default, leaving your drawing alone) or on the current drawing, and steps through it: stage summaries (time, tries, kept), each kept step with its effect on the counts, optionally the dropped group tries, and a legend that toggles the overlays (problem worked on, open space, crowded cells and slices, crowd, leaf unit and anchor, moved classes with arrows, dropped tries). Arrow keys step; "Next stage" skips ahead. A note typed during the walk-through is stored with `walk: {walk, step, where, about}`; events `walkthrough`, `walk-step` (not listed), `walk-closed`, and `cleanup` with `fromWalk` when a step's drawing is kept. |
| `handtidy.js` | Hand-style clean-up after a layout, generalised from the lab sessions. Stages per round: (1) single moves: classes in a problem try the open cells of a grid near them (cells 0.3 link long, free of boxes and links) plus small nudges; (2) leaf units (a leaf, a leaf chain, triangle or loop of up to 4 classes hanging off one anchor) turned, mirrored, reordered and resized around their anchor, single leaves turned and stretched together, long labels trying sideways spots first; (3) crowd spreading: a density grid (cells half a link long) marks cells at twice the average density, each crowd's surroundings are cut into 8 slices and pushed outward (more where there is open space beyond), followed by a few repair moves; (4) group moves: the crowd on one side of a problem moves away from the line, with repair moves of look-ahead. Steps 3 and 4 are kept only if the end result is better. A class or problem that failed is retried only once something near it has moved. A final leaf and single pass runs even when the time is up. Area growth is penalised. `record: true` logs every step (positions before and after, stage markers with time, tries and kept counts) for the walk-through. In the lab as **Clean up** and **Walk through**, with Time and Look-ahead sliders. |
| `handbench.mjs` | `node handbench.mjs 300,1500 [graphs] [optionsJSON]`: runs the clean-up after Best Read at the given time budgets and prints the lab measures before and after; `{"trace":true}` prints the time per stage. |
| `view2.html` | Shows the experimental engines side by side, for looking at drawings while tuning. |
| `engines3.js` | Experiments run on top of the library's own functions: subclass links kept top-down (`compactF`, `autoF` and gap variants), and the layouts without the step that moves classes off links (`compactNT`, `groupedNT`, `autoNT`). Loaded by both benches. |
| `stdmetrics.js` | Standard measures from the literature that our layouts do not optimise directly: normalised stress, even link lengths, crossing angle, angular resolution, share of subclass links drawn top-down. |
| `route.mjs` | Experiment: bend the links that run through a class around it, instead of (or as well as) moving classes. |
| `results_tuned.json`, `analyze_tuned.mjs` | The run against tuned open-source settings (15 graphs, 28 layouts, seed 1) and its summary; `analyze_tuned.mjs` writes `tuned_summary.json`. |
| `demo_drawings.json` | Recorded drawings (run 1) of 15 models under all 14 layouts, used by the HTML doc. |
| `doc_template.html`, `build_doc_html.mjs` | Build `docs/ONTOLOGY-LAYOUT-ALGORITHMS.html`, a single self-contained page that needs no network. |

## Run

Run the Node bench from this folder; the arguments are engines, models (or the sets `small`, `mid`, `large`, `all`) and the number of seeds:

```bash
node bench.mjs compact,grouped,auto all 2
```

Run the bench as a module like this. A Node `vm` context runs the same code about 20× slower, and a hidden browser tab 2–4× slower than a visible one.

For the browser bench, serve the repository root (for example `python -m http.server 8011` from the repository root) and open `http://localhost:8011/tools/layout-bench/contenders.html`. Then call `runOne(model, layout, seed)` from the console, or loop over models and layouts. Set `window.KEEP_POS = true` to keep the drawings.

To rebuild the HTML doc after recording new drawings into `demo_drawings.json`:

```bash
node build_doc_html.mjs
```

## Fairness rules used
- Every layout gets the same boxes (label width × 6.6 px + 10, height 20, plus a 16 × 12 px margin) and the same 170 px target link length where it takes one.
- Every layout gets the same overlap removal afterwards.
- Every layout is measured by the same functions as the library (`_ogPlacementMetrics`, `_ogPlacementScore`).
- Open-source layouts run with general settings (the "default" rows), and again with tuned settings: each library tries several settings and seeds, its default run included, and keeps the run with the fewest crossed links plus links through classes. That choice uses standard measures, not our readability score. Layered layouts get subclass links oriented parent to child.
- A browser tab that is not in front throttles timers. `contenders.html` runs zero-delay timers through a message channel so that ELK and WebCola are neither slowed nor cut short; the bench still runs best in a tab in front.
