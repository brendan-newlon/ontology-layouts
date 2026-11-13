# Ontology layouts

Layouts for drawing ontologies (classes as boxes, subclass and relationship links between them) so that a reader can follow every link: far fewer crossed links and far fewer links running through classes than the widely used open-source layouts.

**See it live:** [brendan-newlon.github.io/ontology-layouts](https://brendan-newlon.github.io/ontology-layouts/), one page with an introduction, the Layout Playback, the Layout Lab (open your own Turtle file, export the drawing), how it was built, the benchmarks and the developer guide. **Use it in an app:** [docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md) and the files in `dist/`.

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
| `dist/` | What an app loads, built from the source by `tools/build_dist.mjs`: `ontology-layouts.mjs` (ES module), `ontology-layouts.js` (script tag, CommonJS, AMD) and `ontology-layouts.d.ts` (types, written by hand). |
| `docs/DEVELOPER-GUIDE.md` | Using the layouts in an app: one call, your own node shapes, where it goes, every option with its measured cost, graph size, your own layout with our clean-up. |
| `index.html`, `site-nav.js` | The one-page site: each page in a frame kept alive (introduction, playback, lab, how it was built, benchmarks, developer guide), switched from the menu at the top left; `index.html#page:section` opens a section. `tools/build_site.mjs` builds `docs/INTRO.html` and `docs/DEVELOPER-GUIDE.html`; `tools/layout-bench/build_doc_html.mjs` builds the benchmarks page and `docs/STORY.html` (how the layouts work, how the clean-up was taught, with the lab and the teaching sessions, prior work, what did not work) from one template. |
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

```js
import { draw } from './dist/ontology-layouts.mjs';
const d = draw(boxes, links, { arrow: 8 });   // boxes [{w, h}]; links [[source, target, kind (2 subclass, 1 other), nameWidth?]]
// d.pos: where to center each node; d.paths: each link as points, border to border; d.routes: bends, ports, loops, name positions
```

Options include the layout (`'auto'`, `'compact'`, `'grouped'`, `'tree'`, or your own positions with `start`), `cleanUp`, `timeLimit`, straight or curved links, arcs for parallel links, circle and ellipse nodes, and keeping a drawing as a graph grows. All of them, with what each costs and gains, are in [docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md). After changing `src/ontology-layouts.js`, run `node tools/build_dist.mjs`; the checks fail while `dist/` is out of date.

The experiment switches in `_OG_TUNE` (`noSwap`, `noFence`, `noNudge`, `noPull`, `skip`, `order`, `pmdsScale`, `stressShare`, `sweeps`) are for the benchmarks and the playback and are empty in use. Links through classes count within 9 px of a box in `routeMetrics`, and within 3 px in `metrics` and in the ranking tables, as published comparisons of layouts do.
