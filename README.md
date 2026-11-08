# Ontology layouts

Layouts for drawing ontologies (classes as boxes, subclass and relationship links between them) so that a reader can follow every link: far fewer crossed links and far fewer links running through classes than the widely used open-source layouts.

- **Tidy Stress**: stress placement, then a search that removes crossings and links through classes.
- **Mycelium**: the same, with closely linked groups of classes kept together and room around hubs.
- **Tree**: a top-down tree for taxonomies, after Reingold–Tilford, with levels deep enough that no parent-to-child line cuts through a sibling. On request only: these layouts are for business models joined mostly by relationships.
- **Best Read**: runs Tidy Stress and Mycelium and keeps the more readable drawing.
- **Link routing**: after the layout, draws the links without moving a class: parallel and reciprocal links as arcs, self-links as loops, bends round classes in the way, link ends spread along crowded boxes, link names placed where they cover nothing.
- **Clean-up**: a pass after any layout that moves classes the way a person would (single moves into open space, leaf groups, spreading crowded regions), learned from recorded hand edits.

Same input, same drawing on any computer: time limits count units of work, not wall time.

## Where things are

| Path | What it is |
|---|---|
| `src/ontology-layouts.js` | The layouts and the clean-up: plain JavaScript, no dependencies. |
| `docs/ONTOLOGY-LAYOUT-ALGORITHMS.md` | Summary of the algorithms and results. |
| `docs/ONTOLOGY-LAYOUT-ALGORITHMS.html` | The full write-up: interactive, self-contained, with drawings side by side against eleven open-source layouts. |
| `tests/check_ontology_layout.mjs` | Checks on the layout code (work clock only, clean-up grid equals checking every pair, same drawing twice, tree stays top-down); `--self-test` proves each check fires. |
| `tools/layout-bench/` | Benchmark graphs, the Node and browser benches, the hands-on lab, recorded results and the script that builds the write-up. See its README. |
| `tools/recv.py` | Local receiver for the lab: saves posted sessions into `_temp/`. |
| `Start Layout Lab.cmd` | Double-click (Windows) to open the playback and the lab: starts the page server (port 8011) and the receiver (port 8013) in two small windows; close them to stop. |

## Run

```bash
node tests/check_ontology_layout.mjs
node tests/check_ontology_layout.mjs --self-test
```

Playback and lab: double-click `Start Layout Lab.cmd`, or by hand: serve the repository root (`python -m http.server 8011`), run `node tools/layout-bench/build_base.mjs`, open `http://localhost:8011/tools/layout-bench/playback.html`, `lab.html` or `contenders.html`; for the lab, also run `python tools/recv.py`.

`_temp/` is scratch space for bench output and lab sessions; it is not committed.

## Using the code

The layout functions take boxes `[{w, h}]` and links `[[a, b, kind]]` (kind 2 for a subclass link, 1 otherwise) and return positions. `_ogRouteLinks(positions, boxes, links)` then returns one route per link (`[a, b, kind, nameWidth]`; self-links and repeated links welcome): bends `{t, d}`, port offsets, a loop, a name position. The function names carry the prefix `_og` (ontology graph). The code expects a `log(level, message)` function in scope; `tests/check_ontology_layout.mjs` shows how to load it.
