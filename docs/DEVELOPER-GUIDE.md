# Developer guide: Ontology Layouts in your app

One function call lays out a graph and draws its links: `draw(boxes, links)` gives you a position for each node and a path for each link. Your app keeps its own rendering, node shapes, icons, colors, interaction and data model. The library has no dependencies, never touches the DOM, and gives the same drawing for the same input on any computer.

Contents: [Add it to your app](#add-it-to-your-app) · [Describe your graph](#describe-your-graph) · [Draw the result](#draw-the-result) · [Where it goes in your app](#where-it-goes-in-your-app) · [Options](#options) · [Time limit](#time-limit) · [Graph size](#graph-size) · [Your own layout, our clean-up](#your-own-layout-our-clean-up) · [Step by step](#step-by-step) · [Good to know](#good-to-know)

## Add it to your app

The files to use are in `dist/`, built from `src/ontology-layouts.js` by `node tools/build_dist.mjs`:

| File | Use |
|---|---|
| `dist/ontology-layouts.mjs` | ES module: `import OntologyLayouts, { draw } from './ontology-layouts.mjs'` |
| `dist/ontology-layouts.js` | A `<script>` tag (defines `window.OntologyLayouts`), CommonJS `require()`, or AMD |
| `dist/ontology-layouts.d.ts` | TypeScript types for both, with every option documented |

Copy the files into your project, or load them from the repository. For example, `https://cdn.jsdelivr.net/gh/brendan-newlon/ontology-layouts@main/dist/ontology-layouts.mjs` serves the latest version; pin a commit instead of `main` in production. The library is plain JavaScript (ES2018) and runs in browsers, Web Workers and Node 16 or later. It needs only `performance.now()`.

```js
import { draw } from './ontology-layouts.mjs';

const boxes = [{ w: 90, h: 24 }, { w: 70, h: 24 }, { w: 110, h: 24 }];   // one per node: what you draw for it
const links = [[1, 0, 2], [2, 0, 2], [2, 1, 1, 48]];                     // [source, target, kind, nameWidth?]
const d = draw(boxes, links, { arrow: 8 });
// d.pos[i]: where to center node i;  d.paths[k].points: link k as a polyline, border to border
```

## Describe your graph

**Nodes are boxes.** Give each node the width and height of everything you draw for it: the shape, the icon and the label. Center the box on the point where links attach. The layout keeps that whole box clear of other nodes and of links. Nothing assumes boxes sized by text. Over the 51 test graphs, the layout was also measured with every box 60 × 40 and with boxes from 40 to 220 px wide and 20 to 90 px high; it stayed well ahead of d3-force in both cases (`tools/layout-bench/sizebench.mjs`).

| Your node | Box to pass |
|---|---|
| Label in a rounded rectangle | the rectangle: `{ w, h }` |
| Circle of radius r, label inside | `{ w: 2r, h: 2r, shape: 'circle', r }` |
| Circle of radius r, label underneath (common in graph browsers) | `{ w: max(2r, labelWidth), h: 2 × (r + gap + labelHeight), shape: 'circle', r }`. The box reaches as far above the circle as the label hangs below it, so it stays centered on the circle. |
| Icon with a caption | the icon and caption together, centered on the icon |
| Ellipse | `{ w, h, shape: 'ellipse' }` |

`shape` and `r` only change where the paths end: on the circle or ellipse instead of the box border. The layout still keeps the whole box clear. The Lab and the Playback have a **Nodes: Circles** setting that does exactly this, so you can see how circles with names underneath lay out.

**Links** are `[source, target, kind, nameWidth]`:

- `source` and `target` are node indexes.
- `kind` is `2` for a subclass link (source is a subclass of target) and `1` for any other link. Subclass links get slightly shorter target lengths, and they decide the levels in the `'tree'` layout.
- `nameWidth` (optional) is the width in px of the link's label, if you draw one. The layout leaves that much room along the link, and the routing places the label where it covers no node, no other label and as few links as possible.

Repeated links between the same two nodes and self-links are fine. The layout counts each pair once; the routing draws every link, as side-by-side arcs and loops.

**Relationships drawn as nodes** (reification, association classes): give the box `between: [a, b]` and it is placed on the line between nodes `a` and `b`.

## Draw the result

```js
const d = draw(boxes, links, { arrow: 8 });
d.pos.forEach((p, i) => drawNode(i, p.x, p.y));           // center of node i
d.paths.forEach((p, k) => {
  drawPolyline(p.points);                                  // from border to border, curved where the routing bent it
  drawArrowhead(p.tip, p.angle);                           // only when you asked for arrow > 0
  const name = d.routes[k].label;                          // { x, y, w, h }: where to center the link's name
  if (name) drawText(linkName[k], name.x, name.y);
});
```

- **Draw nodes at `d.pos`.** The routing may push a node off a link that still ran through it, so the paths belong to these positions, not to the layout's earlier ones.
- **`paths`** are ready to draw. If your renderer draws its own curves, use **`routes`** instead:
  - `bends` are `{ t, d }`: `t` is the share of the way along the straight line from source to target, `d` the offset to its side in px. Draw a smooth curve through them, as `routePaths` does (Catmull-Rom).
  - `ports` are the offsets of the link ends from the node centers.
  - `loop` is a self-link's loop.
  - Renderers that place curve control points along the source–target line use the same idea as `bends`.
- **`d.groups`** is a group number for each node (closely linked nodes), if you want hulls or background areas.
- Coordinates are in px with y pointing down, centered roughly on 0. Fit your viewport to the boxes.

## Where it goes in your app

Find where your app computes node positions today (a force simulation, a layout call in a graph library, positions stored with the data) and replace that one step.

1. **Collect what is on screen.** For each visible node, take its index and box (measure the label, or use your fixed node size plus the label). For each visible edge, take `[sourceIndex, targetIndex, kind]`.
2. **Call `draw`**, in a Web Worker if your graphs can have hundreds of nodes (see [Graph size](#graph-size)).
3. **Apply `pos` to your nodes** and draw the edges from `paths` or `routes`. Animate from the old positions if you like.

Your styling, selection, menus, data and the rest of your rendering stay as they are. The other cases:

| Situation | Call |
|---|---|
| First drawing of a graph | `draw(boxes, links)` |
| The user added or removed a few nodes | `draw(boxes, links, { keep: oldPos })`, with `null` in `oldPos` for each new node: new nodes go round the old ones, and old nodes move 2–5% of the drawing (a redraw moves about a third). Keeping costs some crossings, so offer a "tidy" button that redraws. |
| Exploring: a click adds a node's neighbors | `draw(boxes, links, { keep: oldPos, exact: true, route: { straight: true } })`: nothing already drawn moves, new nodes go on an arc on the clicked node's most open side, a few ms per click. A graph of one node works, so exploring can start from one. |
| The user arranged the nodes by hand | `routeLinks(pos, boxes, links, { settle: false })` (or `routePaths`): links only, no node moves |
| You have your own layout and want to keep it | `draw(boxes, links, { start: yourPos })`: see [Your own layout, our clean-up](#your-own-layout-our-clean-up) |
| A hierarchy that must read top-down | `draw(boxes, links, { layout: 'tree' })` |

## Options

`draw(boxes, links, options)`. Every option is optional.

| Option | Default | What it does |
|---|---|---|
| `layout` | `'auto'` | `'auto'`: Best Read, which runs Tidy Stress and Mycelium (for 8 or more nodes) and keeps the more readable drawing. `'compact'`: Tidy Stress only, best for 10 to 30 nodes. `'grouped'`: Mycelium only, which keeps closely linked groups together; best for large or hub-heavy graphs. `'tree'`: every subclass below its superclass (see below). `'given'`: your positions, see `start`. |
| `start` | none | Your own positions, one `{x, y}` per box. Implies `layout: 'given'`: overlaps are removed, then the clean-up and the routing run. |
| `cleanUp` | `true` | `false` skips the clean-up after the layout: about 0.14 s faster at the median, with about two and a half times the links through nodes. |
| `timeLimit` | `1000` | Work limit for this call, in ms of the reference laptop. See [Time limit](#time-limit). |
| `seed` | `1` | Random seed. Another seed gives another drawing of similar quality, for example for a "try another layout" button. |
| `roomy` | `false` | About 30% more space between nodes. |
| `arrow` | `0` | Paths stop this many px short of the target so an arrowhead fits. `tip` and `angle` give its point and direction. |
| `route` | see below | Options for the link drawing. |
| `keep`, `exact` | none | Keep an earlier drawing (see the table above). |

**Curved or straight links.** These are `route` options:

| Option | Default | What it does |
|---|---|---|
| `bends` | `true` | Bend a link round a node it would run through. `false`: no bends round nodes. |
| `crossBends` | `true` | Also bend a link when that removes crossings. |
| `straight` | `false` | `true`: no link curves round anything (bends and crossing bends off). Repeated links and self-links still get arcs and loops. Use this when curving links would confuse your readers. Links through nodes then stay wherever the layout could not avoid them. |
| `arcs` | `true` | Separate control for links that share both ends (a link and its reverse, or two relationships between the same nodes): drawn as arcs side by side. `false`: parallel straight lines, their ends spread across the two boxes. With `straight: true` and `arcs: false`, nothing curves except self-link loops. |
| `sep` | `24` | Space in px between parallel links. |
| `ports` | `3` | At nodes with at least this many links, spread the link ends along the box sides. Use `0` for circles, so links meet the center. |
| `labels` | `true` | Place link names (needs `nameWidth` on the links). |
| `labelSide` | `true` | A name may sit beside its link when it would cover something on it. |
| `settle` | `true` | Push a node off a link that still runs through it. `false`: no node moves, for drawings arranged by hand. |
| `pad` | `9` | Margin in px a link keeps from the nodes it passes. |

**The tree.** `layout: 'tree'` puts every subclass below its superclass. The tree itself has no crossings and no link through a node; only second superclasses and other relationships can cross it. Use it when the hierarchy is what readers look for. It costs crossings: on the SOSA/SSN ontology (36 classes) it draws 64 crossed links against Best Read's 11. A better top-down layout, with a third to a half of the crossings of tuned ELK layered, exists as an experiment in the benchmarks (`tools/layout-bench/engines3.js`). It is not yet part of the library.

## Time limit

Every step stops on a work limit, not on the clock, so the same input and limit give the same drawing on any computer; a slower computer simply takes longer. Set it per call with `draw(..., { timeLimit })`, or for every later call with `setTimeLimit(ms)`, which returns the previous limit. The link routing always gets at least its time at 1500 (about 25 ms): cutting it lost the most quality. Measured over the 51 test graphs and two seeds, with the clean-up and the routing (mean time on the laptop the limits are measured against):

| Limit | Mean time | Measured | When |
|---|---|---|---|
| 500 | about 250 ms | against 1500: about 10% more crossed links and nearly three times the links through nodes | It must feel instant and some loss is acceptable |
| 750 | about 330 ms | against 1000: 2% more crossed links, 6% more links through nodes; lost two unseen graphs to tuned Graphviz `neato` | Tight budgets |
| **1000 (default)** | about 360 ms | had the fewest problems of all layouts tested on every test graph | Most apps |
| 1500 | about 460 ms | against 1000: about 5% fewer crossed links, about a quarter more links through nodes | No better overall; the default until 2026-11-12 |
| 3000 | about 650 ms, up to 2.9 s on the densest graph | against 1500: links through nodes 65 → 47, crossed links about the same | Dense graphs where every link through a node matters |

Small graphs finish well before the limit: the limit bounds the large ones.

## Graph size

| Nodes | Time at the default limit | Advice |
|---|---|---|
| up to 100 | 0.1 to 0.5 s | Use `draw` as is. |
| 100 to 600 | 0.5 to 1.3 s | Run it in a Web Worker so the page stays responsive. |
| about 1,200 | 1.3 s | Still the fewest crossed links plus links through nodes of every layout tested (Graphviz took 19 to 21 s). Use a Worker. |
| about 3,300 | 8 to 10 s | d3-force draws a fifth fewer crossings, in 6.4 s. Above about 2,000 nodes, use a fast force layout (or show a subset, such as the neighborhood the user is exploring). Then `draw(..., { start })` can tidy the result if you can afford the time. |

A size switch in your code is enough:

```js
const d = boxes.length <= 2000 ? draw(boxes, links) : draw(boxes, links, { start: myForceLayout(boxes, links), timeLimit: 500 });
```

## Your own layout, our clean-up

`draw(boxes, links, { start: yourPositions })` keeps your layout's arrangement and runs the clean-up and the link routing on it. Measured over the 51 test graphs and two seeds (102 drawings), counting crossed links plus links through nodes after the routing:

| Starting layout | Our routing only | Our clean-up and routing | Best Read |
|---|---|---|---|
| d3-force (as in our benchmark) | 12,564 | 7,792 (better on 98 drawings, never worse) | 3,752 |
| d3-force (stronger repulsion) | 11,508 | 6,328 (better on 96, never worse) | 3,752 |
| Random positions | 102,027 | 44,961 | 3,752 |

The clean-up never made a drawing worse in these 306 runs, and after a force layout it removed 38 to 45% of the problems left by the routing alone. It does not reach Best Read: from d3-force, about twice the problems remain, in a larger drawing. The clean-up takes 0.2 to 0.5 s after a foreign layout. Use `start` when your users know your layout's arrangement and you want it tidied, or for very large graphs. Use Best Read when you can choose. Graphviz and ELK starts were not measured.

## Step by step

`draw` is these calls in order. Use them directly to run only part of the pipeline:

```js
import L from './ontology-layouts.mjs';
const t0 = L.now();                                        // the clean-up gets what is left of the limit after the layout
const lay = L.bestRead(boxes, links, { seed: 1 });         // or tidyStress, mycelium (null under 8 nodes)
const pos = L.cleanUp(lay.pos, boxes, links, t0);
const r = L.routeLinks(pos, boxes, links, { straight: false });
const paths = L.routePaths(r.pos, boxes, links, r.routes, { arrow: 8 });
const m = L.routeMetrics(r.pos, boxes, links, r.routes); // { cross, thru, sharp, labelOver, bends, area, ... }: for your own tests
```

`routeMetrics` counts crossed links, links through nodes (within 9 px), sharp crossings and covered link names. It is useful in your app's tests to check that a change in your data or node sizes keeps drawings readable.

## Good to know

- **It runs synchronously.** For more than about 100 nodes, call it in a Web Worker: with `importScripts('ontology-layouts.js')`, `self.OntologyLayouts` is defined. Post boxes and links in, positions and paths out; everything is plain arrays.
- **Same input, same drawing.** The order of nodes and links is part of the input. Keep it stable between calls if you want stable drawings.
- **Disconnected parts and lone nodes** are placed apart from the main graph, out of its way.
- **One node, or none,** returns at once.
- **Labels inside nodes:** measure them with your font. The benchmarks used 6.6 px per character plus 10 px, 20 px high, but your box is what counts.
- **Try it before you integrate.** In the Lab, open your ontology as a Turtle file (File, then Open a Turtle file). Switch Nodes to Circles to see your style, and export the drawing as SVG, PNG, JSON (positions, sizes and paths) or GraphML. The Playback shows each step's share of the time and lets you switch steps off.
- **Questions and changes:** the code is `src/ontology-layouts.js`. Its comments explain each step, and `tests/check_ontology_layout.mjs` checks the public entry points, including every `draw` option above. Run `node tools/build_dist.mjs` after changing the source.
