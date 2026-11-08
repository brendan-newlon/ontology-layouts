# Ontology layouts

Layouts for drawing ontologies (classes as boxes, subclass and relationship links between them) so that a reader can follow every link: far fewer crossed links and far fewer links running through classes than the widely used open-source layouts.

- **Tidy Stress**: stress placement, then a search that removes crossings and links through classes.
- **Mycelium**: the same, with closely linked groups of classes kept together and room around hubs.
- **Tree**: a top-down tree for taxonomies, after Reingold–Tilford, with levels deep enough that no parent-to-child line cuts through a sibling. On request only: these layouts are for business models joined mostly by relationships.
- **Best Read**: runs Tidy Stress and Mycelium and keeps the more readable drawing.
- **Link routing**: after the layout, draws the links: parallel and reciprocal links as arcs, self-links as loops on the most open side, bends round classes in the way that stay inside the drawing, link ends spread along crowded boxes, link names on or beside their link where they cover nothing; a class a link still runs through is pushed off it when that helps.
- **Clean-up**: a pass after any layout that moves classes the way a person would (single moves into open space, leaf groups, spreading crowded regions), learned from recorded hand edits. After it: one-link classes trade places or move out of a fence of lines, classes are pushed off links, and parts that sprawl toward the edge (chains, small trees, whole groups) are pulled in where that makes the drawing smaller with no more problems.

Same input, same drawing on any computer: time limits count units of work, not wall time.

## Where things are

| Path | What it is |
|---|---|
| `src/ontology-layouts.js` | The layouts and the clean-up: plain JavaScript, no dependencies. |
| `docs/ONTOLOGY-LAYOUT-ALGORITHMS.md` | Summary of the algorithms and results. |
| `docs/ONTOLOGY-LAYOUT-ALGORITHMS.html` | The full write-up: interactive, self-contained, with drawings side by side against eleven open-source layouts. |
| `docs/PLAYBACK-AND-LAB.md` | The Layout Playback and Layout Lab as a reusable pattern: watch any step-by-step algorithm work, switch steps off, reorder them, edit by hand and record why, then turn the demonstrations into rules. How to adapt it to another algorithm. |
| `tests/check_ontology_layout.mjs` | Checks on the layout code (work clock only, clean-up grid equals checking every pair, same drawing twice, tree stays top-down, link routing, the passes after the clean-up, pulling in from the edge); `--self-test` proves each check fires. |
| `tools/layout-bench/` | Benchmark graphs, the Node and browser benches, the hands-on lab, recorded results and the script that builds the write-up. See its README. |
| `tools/recv.py` | Local receiver for the lab: saves posted sessions into `_temp/`. |
| `Start Layout Lab.cmd` | Double-click (Windows) to open the playback and the lab: starts a page server for this folder (first free port from 8611; one already serving this folder is reused) and the receiver (port 8613) in small windows; close them to stop. |

## Run

```bash
node tests/check_ontology_layout.mjs
node tests/check_ontology_layout.mjs --self-test
```

Playback and lab: double-click `Start Layout Lab.cmd`, or by hand: serve the repository root (`python -m http.server 8011`), run `node tools/layout-bench/build_base.mjs`, open `http://localhost:8011/tools/layout-bench/playback.html`, `lab.html` or `contenders.html`; for the lab, also run `python tools/recv.py`.

`_temp/` is scratch space for bench output and lab sessions; it is not committed.

## License

Apache License 2.0: see `LICENSE` and `NOTICE`. The benchmark graphs converted from published ontologies and the Rome graphs remain under their sources' terms.

## Using the code

The layout functions take boxes `[{w, h}]` and links `[[a, b, kind]]` (kind 2 for a subclass link, 1 otherwise) and return positions. `_ogRouteLinks(positions, boxes, links)` then returns one route per link (`[a, b, kind, nameWidth]`; self-links and repeated links welcome): bends `{t, d}`, port offsets, a loop, a name position, plus `pos`, the positions the routes belong to (classes may have been pushed off links; pass `{ settle: false }` to keep every class where it is). `_ogSetTimeLimit(ms)` sets how long the layouts, clean-up and routing may work together (default 1500, on the work clock). The function names carry the prefix `_og` (ontology graph).

### Settings worth changing
Measured over the 51 test graphs (15 development, 10 held-out, 26 public), Best Read with the clean-up and the link routing:
| Setting | Default | When to change it |
|---|---|---|
| `_ogSetTimeLimit(ms)` | 1500 | 500: about half the time (mean about 250 ms) for 10% more crossed links and nearly three times the links through classes. 3000: links through classes 65 → 47, crossed links about the same, mean time about 650 ms (up to 2.9 s on the densest graph); it helps the dense graphs and changes nothing on most small ones. |
| `_ogRouteLinks(..., { settle })` | `true` | `false` keeps every class exactly where the layout put it (for a drawing the user has arranged by hand); links through classes are then left to the bends. |
| `_ogRouteLinks(..., { labels, labelSide })` | `true`, `true` | `labels: false` when links carry no names. |
| `_ogRouteLinks(..., { bends, crossBends })` | `true`, `true` | `false` for straight links only (arcs for parallel links and loops stay). |

The experiment switches in `_OG_TUNE` (`noSwap`, `noFence`, `noNudge`, `noPull`, `skip`, `order`, `pmdsScale`) are for the benchmarks and the playback and are empty in use. The code expects a `log(level, message)` function in scope; `tests/check_ontology_layout.mjs` shows how to load it.
