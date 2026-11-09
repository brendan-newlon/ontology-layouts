# Playback and Lab: watch an algorithm work, then teach it

The Layout Playback (`tools/layout-bench/playback.html`) and the Layout Lab (`tools/layout-bench/lab.html`) were built to improve the layouts in this repository. They are offered here as a reusable pattern for any algorithm that changes a picture step by step, where a person who can see what went wrong can describe a better method:
- graph layout, routing and labeling;
- schedulers and packers (Gantt bars, bins, floor plans);
- clustering and map simplification;
- any search or optimization whose state can be drawn.

Copy them and adapt them; the parts that are specific to diagrams are listed below.

This file is the technical contract. For the method (how a person's demonstrations become rules with an AI assistant), how to try the lab here, and the prompts that worked for adapting it, read [SHOW-AND-TELL-LABS.md](SHOW-AND-TELL-LABS.md) first.

## What the pair does
**Playback** runs the algorithm with a recorder attached and plays the recording back:
- **Real time.** Each frame plays for the time its step took on this computer, times a speed (0.1× to 100×), so a fast step flashes and a slow one lingers.
- **One step bar.** Each step's share of the playing time is shown on one bar. Drag a border to give a step more or less time; lock a step so it keeps its time.
- **Per-step controls.**
  - **Show**: animate the step, or apply it at once.
  - **Run**: rerun the whole algorithm without the step, to see what it is worth.
  - **Order**: drag steps that can run in another order into a new order, and the algorithm reruns.
- **Hover a step** for what it does, its measured time, its frames, the elements it moved and the change in the measures.
- **Show the math.** Each overlay draws an idea the algorithm uses but nobody sees, faintly behind the picture, and each has its own toggle. Examples here: the open-space grid, the spreading slices and stress rings. A legend names the overlays that are on; it shrinks to one line or closes into a drawer at the edge.
- **Live measures.** The counts the algorithm is judged by are shown on every frame, and a time-limit slider reruns the algorithm with a different budget.

**Lab** is where the person works:
- **Opens on the playback's current frame** and follows the playback until the person moves something.
- **Edits flow back.** A manual edit comes back to the playback as its own step, and the steps after it rerun from there, so a person can fix one thing and watch the algorithm continue.
- **Sessions are saved.** Moves, comments and the steps they belong to are recorded per session in localStorage and posted to a local receiver (`tools/recv.py`, which writes `_temp/<session>.json`).

## How it was used here: from demonstration to rules
The clean-up after the layouts (`_ogHandTidy`) was taught this way:
1. A person moved classes in the Lab until the drawing read well, saying why in the comments: "this leaf is fenced in", "slide this group into the open space", "turn the chain so it hangs down".
2. The recorded sessions were read, and each recurring move with its reason was written down as a principle.
3. Each principle became a rule a program can run, measured on graphs the person never saw, and kept only where it measured better.

Examples of this path, from words to methods:
| What the person said or did | What the code does |
|---|---|
| "Move it into the open space" | Single moves onto cells of an open-space grid with no class and no link (`_ogHandTidy`, stage `single`) |
| "Turn the leaves round their parent" | Leaf units (a leaf, a chain, a triangle) turned, mirrored or resized round the class they hang from |
| "Push the crowd apart, more toward the open side" | Region spreading in 8 slices, weighted by the open space beyond each |
| "Don't fence me in" | A one-link class whose link crosses something moves to the most open spot round its neighbor (`_ogLeafSwap`) |
| "Push the class off the line, it's in the way" | Classes pushed sideways off a link that runs through them, on straight links and on the drawn curves |
| "That chain sprawls into empty canvas; fold it up or down" and "these groups could sit closer, the middle is empty" | Pull-in: parts hanging by one link turn or draw in round the class they hang from, and whole groups slide toward the middle, kept only if the drawing gets smaller with no more problems (`_ogPullIn`) |
| "The loop should go where nothing is" | Self-link loops placed on the most open of 12 places round the class |

## The contract, for adapting it
**1. The algorithm reports its steps.** Give the algorithm one global recorder that is `null` in normal use, so recording costs nothing when off:
```js
let _ogTr = null;                                   // the recorder, or null
function _ogTraced(sink, fn) { const prev = _ogTr; _ogTr = sink; try { return fn(); } finally { _ogTr = prev; } }
// inside the algorithm, after a step changes the state:
if (_ogTr) _ogTr.snap("stage-name", state, extra);  // extra: anything an overlay needs (here: target distances)
```
The sink decides what to keep: the playback copies the state into a frame `{ key, P, ms, run, note?, ov?, routes?, moved? }`. `ms` is the wall time since the previous frame. `ov` carries what the overlays draw, such as the grid or the slices.

Optional hooks for an algorithm that tries several variants and keeps one:
- `begin(name, ...)` and `restart(r)` mark the start of a variant or a restart;
- `score(name, s)` records how a variant scored;
- `chosen(name)` marks the variant that was kept.

The playback lists the variants that were not kept, hidden by default.

**2. Steps can be switched off and reordered from outside.** A settings object, empty in normal use, is read by the algorithm (`_OG_TUNE` here). The examples here:
- `skip` leaves placement steps out (`{ cross, thru, tight }`);
- `order` gives the order of those placement steps;
- `noSwap`, `noFence`, `noNudge`, `noPull` switch the passes after the clean-up off.

The clean-up takes its own options, `order`, `spread`, `groups` and `finish`.

The playback sets these flags, reruns, and restores them.

**3. A time budget the algorithm respects.** Budgets here are counted in units of work, not seconds (`_ogNow`), so the same input gives the same output on any computer. `_ogSetTimeLimit(ms)` scales every budget, and that is what the time-limit slider calls.

**4. The page's own tables.** In `playback.html`:
- `STEPS`: one row per frame key: `[key, group, title, plain description, color, can be left out]`.
- `OVL` and `overlays()`: one entry per overlay (color, name, meaning) and the SVG drawn for a frame.
- The frame builder (`recordRun`, and `recordEngine` for the open-source layouts): runs the algorithm through `_ogTraced` with a sink, then appends frames for later phases, such as the link routing replayed one bend per frame.
- `routeMetrics` gives the counts shown on each frame. Swap in the measures your algorithm is judged by.

**5. The sync between the two pages.** Both pages use one `BroadcastChannel('layout-sync')`:
| Message | Sender | Meaning |
|---|---|---|
| `{ type: 'frame', graph, algo, n, j, of, key, step, group, P, H }` | playback | The current frame: positions `P`, link bends `H` |
| `{ type: 'hello' }` | lab | Send me the current frame |
| `{ type: 'edit', graph, n, P, H }` | lab | The person moved something: this is the new state |

The frame the lab opens on is left in `localStorage['layout-sync:frame']`, because a new tab can miss a broadcast.

## What is specific to diagrams
These parts would change for another kind of algorithm:
- **The drawing.** The drawing code is classes as boxes and links as straight lines or curves.
- **The overlays.** Grid, slices, group side, stress rings, drawing extent and link clearance belong to these layouts.
- **The measures.** The measures are crossings, links through classes, sharp crossings and names over things.
- **The graphs.** The graphs are in `models*.js`.

## Running it
On Windows, double-click `Start Layout Lab.cmd` at the repository root. It starts a page server (on the first free port from 8611) and the receiver (port 8613), and opens the playback.

By hand:
1. Run `node tools/layout-bench/build_base.mjs`.
2. Serve the repository root with any static server.
3. Open `/tools/layout-bench/playback.html`.
4. Run `python tools/recv.py` if Lab sessions should be saved to `_temp/`.
