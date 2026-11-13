# Ontology layouts

Layouts for drawing ontologies (classes as boxes, subclass and relationship links between them) so that a reader can follow every link: far fewer crossed links and far fewer links running through classes than the widely used open-source layouts.

- **Tidy Stress**: stress placement, then a search that removes crossings and links through classes.
- **Mycelium**: the same, with closely linked groups of classes kept together and room around hubs.
- **Top-down** (experiment, not yet an entry point): the same placement with every subclass below its superclass, for models where the hierarchy is the content; a third to a half of the crossings of tuned ELK layered. The repository also has a Reingold–Tilford-style **Tree** (`_ogTreeLayout`), which the top-down drawing beats on every test set.
- **Best Read**: runs Tidy Stress and Mycelium and keeps the more readable drawing.
- **Link routing**: after the layout, draws the links: parallel and reciprocal links as arcs, self-links as loops on the most open side, bends round classes in the way that stay inside the drawing, link ends spread along crowded boxes, link names on or beside their link where they cover nothing; a class a link still runs through is pushed off it when that helps.
- **Keeping a drawing**: after an edit, new classes are placed round the old ones, which stay where the reader knows them.
- **Exploring**: a drawing can start from one class and grow one expansion at a time; the new neighbours of a class go on an arc on its most open side, and nothing already drawn moves. In simulated sessions that is a third of the crossings of a typical force-directed expansion, in a few milliseconds per click. Links can be drawn without bends (`straight: true`); repeated and reciprocal links then stay arcs side by side, unless `arcs: false` draws them as parallel straight lines.
- **Relation classes**: a relationship modelled as a class, when marked, sits on the line between the two classes it relates.
- **Clean-up**: a pass after any layout that moves classes the way a person would (single moves into open space, leaf groups, spreading crowded regions), learned from recorded hand edits. After it: one-link classes trade places or move out of a fence of lines, classes are pushed off links, and parts that sprawl toward the edge (chains, small trees, whole groups) are pulled in where that makes the drawing smaller with no more problems.

Same input, same drawing on any computer: time limits count units of work, not wall time.

**Teach it something.** The clean-up was taught by a person, not designed from the literature: Brendan Newlon tidied drawings by hand in the Layout Lab while saying why, and an AI assistant, Claude (Opus 5.5), distilled the reasons into rules and tested them on graphs nobody had looked at. The Layout Lab and the Layout Playback are offered as tools in their own right. Try your hand in the [lab edition of the write-up](docs/ONTOLOGY-LAYOUT-ALGORITHMS-LAB.html#lab), which needs nothing installed: tidy any graph, say why, and download the session as one file for your AI assistant to turn into rules. Or copy the lab for any problem a person can see and fix better than they can describe. Start with [docs/SHOW-AND-TELL-LABS.md](docs/SHOW-AND-TELL-LABS.md).

## Where things are

| Path | What it is |
|---|---|
| `src/ontology-layouts.js` | The layouts and the clean-up: plain JavaScript, no dependencies. |
| `docs/ONTOLOGY-LAYOUT-ALGORITHMS.md` | Summary of the algorithms and results. |
| `docs/ONTOLOGY-LAYOUT-ALGORITHMS.html` | The full write-up: interactive, self-contained, with drawings side by side against eleven open-source layouts. |
| `docs/ONTOLOGY-LAYOUT-ALGORITHMS-LAB.html` | The same write-up with the Layout Lab built in: tidy a drawing by hand, run the clean-up on it, download the session for an AI assistant; also the sessions in which the clean-up was taught. |
| `docs/SHOW-AND-TELL-LABS.md` | The method: how a person's intuition becomes a program with an AI assistant, how to try the lab here, and how to build a lab of your own for another problem, with the prompts that worked. |
| `docs/PLAYBACK-AND-LAB.md` | The Layout Playback and Layout Lab as a reusable pattern: watch any step-by-step algorithm work, switch steps off, reorder them, edit by hand and record why, then turn the demonstrations into rules. How to adapt it to another algorithm. |
| `docs/BEYOND-LAYOUT.md` | For discussion: which of these methods could carry over to other optimization problems (warehouse slotting, scheduling, bin packing, routing, dependency solving), and which would not. |
| `tests/check_ontology_layout.mjs` | Checks on the layout code (work clock only, clean-up grid equals checking every pair, same drawing twice, tree stays top-down, link routing, the passes after the clean-up, pulling in from the edge, the public entry points, keeping a drawing and relation classes, exploring); `--self-test` proves each check fires. |
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

The file defines `OntologyLayouts`, the entry points. Most callers need one call:
```js
const d = OntologyLayouts.draw(boxes, links, { arrow: 8 });
// boxes [{w, h}] as drawn; links [[s, t, kind, nameWidth?]], kind 2 for a subclass link, 1 otherwise
// d.pos: where to draw each class (final: see below); d.paths: [{ points, tip, angle }] from box border to box border,
// stopping 8 px short of the end class for an arrowhead; d.routes: the routes those paths come from (bends, ports, loop,
// name position); d.groups: a group number per class, for hulls or background areas round related classes
```
Or step by step: `bestRead` (or `tidyStress`, `mycelium`), `cleanUp`, `routeLinks`, `routePaths`; the [write-up](docs/ONTOLOGY-LAYOUT-ALGORITHMS.html#code) shows each call. Self-links and repeated links are welcome.

**After an edit,** pass the earlier drawing to keep the reader's picture: `draw(boxes, links, { keep: oldPos })`, with `null` in `oldPos` for each new class. The new classes are placed round the classes they link to, and the old ones move only a little (2–5% of the drawing, against about a third for a redraw); `exact: true` moves none. Keeping costs some crossings, so redraw from time to time.

**Exploring a graph** (a browser that adds a class's neighbours when it is clicked): draw the first classes with `draw(boxes, links)`, then after each expansion `draw(boxes, links, { keep: oldPos, exact: true, route: { straight: true } })`, with `null` in `oldPos` for each new class. Nothing already drawn moves; new classes that link only to the expanded class go on an arc on its most open side, the others where they cause the fewest problems; one expansion takes a few milliseconds. Without `exact`, the clean-up may also move earlier classes a little, which suits a "tidy" command better than every click. A drawing of one class works, so an exploration can start from a single class.

**Repeated links** between the same two classes (common when instance data is browsed) are drawn side by side, but the placement sees each pair once.

**Relationships modelled as classes** (reification, association classes): give the box `between: [subject, object]`, and it is drawn on the line between the two.

**Draw the classes at the positions the routing returns.** `routeLinks` returns `pos` with the routes: a class that a drawn link still runs through is pushed off it, and the routes belong to those positions. Pass `{ settle: false }` to keep every class where it is.

The function names inside carry the prefix `_og` (ontology graph).

### Settings worth changing
Measured over the 51 test graphs (15 development, 10 held-out, 26 public), Best Read with the clean-up and the link routing:
| Setting | Default | When to change it |
|---|---|---|
| `_ogSetTimeLimit(ms)` | 750 (1500 until 2026-11-12) | 750 against 1500, over the 51 test graphs and two seeds: about 28% faster (mean 470 → 340 ms), after routing 7% more crossed links and 14% fewer links through classes; the link routing keeps at least its time at 1500. Against 1500, 500: about half the time (mean about 250 ms) for 10% more crossed links and nearly three times the links through classes. 3000: links through classes 65 → 47, crossed links about the same, mean time about 650 ms (up to 2.9 s on the densest graph); it helps the dense graphs and changes nothing on most small ones. |
| `_ogRouteLinks(..., { settle })` | `true` | `false` keeps every class exactly where the layout put it (for a drawing the user has arranged by hand); links through classes are then left to the bends. |
| `_ogRouteLinks(..., { labels, labelSide })` | `true`, `true` | `labels: false` when links carry no names. |
| `_ogRouteLinks(..., { bends, crossBends })` | `true`, `true` | `false` for no bends round classes (arcs for parallel links and loops stay). |
| `_ogRouteLinks(..., { straight })` | `false` | `true`: no link is bent round a class; repeated and reciprocal links between two classes are still arcs side by side, and self-links loops. For browsers where links that curve round classes would confuse. Links through classes then remain where the placement could not avoid them. |
| `_ogRouteLinks(..., { arcs })` | `true` | `false`: repeated links between two classes become parallel straight lines, their ends spread across the two boxes (with `straight: true`, no curve at all except self-links, which stay loops). |

The experiment switches in `_OG_TUNE` (`noSwap`, `noFence`, `noNudge`, `noPull`, `skip`, `order`, `pmdsScale`) are for the benchmarks and the playback and are empty in use. Links through classes count within 9 px of a box in `routeMetrics`, and within 3 px in `metrics` and in the ranking tables, as published comparisons of layouts do. The code expects a `log(level, message)` function in scope; `tests/check_ontology_layout.mjs` shows how to load it.
