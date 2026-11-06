# Layout benchmark

Reproduces the numbers in `docs/ONTOLOGY-LAYOUT-ALGORITHMS.md` and builds its interactive HTML version.

## What is here

| File | Purpose |
|---|---|
| `build_base.mjs` | Copies the library's layout functions out of `src/ontology-layouts.js` into `base_layout.js` (generated, not committed). Run it after any change to the layouts. |
| `models.js`, `models2.js`, `models3.js`, `models4.js` | The benchmark models, written in a small text format: `A<B C` means B and C are subclasses of A; `A-B C` means A links to B and C. Brewery IoT and Parcel delivery are two small sample ontologies, stored as parsed classes and links. |
| `bench.mjs`, `mkbundle.mjs`, `engines2.js` | The headless bench in Node, for our layouts and the experiments that were tried (`engines2.js`). |
| `contenders.html` | The browser bench against the open-source layouts: Graphviz through viz.js, ELK, WebCola, d3-force, dagre, Cytoscape `cose` and `fcose`. It loads them from public CDNs. |
| `lab.html` | Hands-on lab: starts from Best Read (or Tidy Stress, Mycelium), lets you move classes, move a Ctrl+click selection as a group, and pull bends into links, while measuring crossings, sharp crossings, links through classes and cramped classes along the curves. Every step and every typed note is logged in order with the measures before and after and the positions after; sessions are posted to `tools/recv.py` (port 8013) as `_temp/lab_<graph>_<time>.json`. |
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
