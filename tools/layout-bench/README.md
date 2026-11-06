# Layout benchmark

Reproduces the numbers in `docs/ONTOLOGY-LAYOUT-ALGORITHMS.md` and builds its interactive HTML version.

## What is here

| File | Purpose |
|---|---|
| `build_base.mjs` | Copies the library's layout functions out of `src/ontology-layouts.js` into `base_layout.js` (generated, not committed). Run it after any change to the layouts. |
| `models.js`, `models2.js`, `models3.js`, `models4.js` | The benchmark models, written in a small text format: `A<B C` means B and C are subclasses of A; `A-B C` means A links to B and C. Brewery IoT and Parcel delivery are two small sample ontologies, stored as parsed classes and links. |
| `bench.mjs`, `mkbundle.mjs`, `engines2.js` | The headless bench in Node, for our layouts and the experiments that were tried (`engines2.js`). |
| `contenders.html` | The browser bench against the open-source layouts: Graphviz through viz.js, ELK, WebCola, d3-force, dagre, Cytoscape `cose` and `fcose`. It loads them from public CDNs. |
| `view2.html` | Shows the experimental engines side by side, for looking at drawings while tuning. |
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
- Open-source layouts run with general settings, not tuned per model.
