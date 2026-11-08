# Beyond diagrams: where these methods could carry over

A basis for discussion, written 2026-11-08. Nothing here has been tried outside diagram layout.

## The problem underneath
Drawing an ontology readably is an optimization problem with these features:
- **Mixed variables.** The positions are continuous. Crossings, links through classes and the side a loop goes on are discrete.
- **Several objectives.** Crossings, links through classes, sharp crossings, area and name clutter pull against each other. They are traded by fixed weights and by "no worse on any of them".
- **NP-hard core.** Even minimizing crossings alone is NP-hard, so every practical method is a heuristic under a time limit.
- **Quality judged by a person.** The measures are stand-ins for "can I follow every link?"

Most of the work here is not a new solver. It is the practice round the solver: how time is counted, how moves are chosen and accepted, how a person's judgment becomes rules, and how the result is checked on cases never seen. That practice is what carries over best.

Some of these ideas have known relatives elsewhere; they are named below so the discussion starts from what exists.

## The methods, in general terms
| Here | In general | Known relatives |
|---|---|---|
| **Work clock.** Time limits counted in units of work, so the same input gives the same answer on any computer. | Deterministic anytime search: reproducible results, debuggable runs, the same answer in tests and production. | Deterministic time limits in MIP solvers (CPLEX ticks, Gurobi work units). |
| **Best Read.** Run two different methods and keep the more readable drawing. | A portfolio judged by the user-facing measure, not each method's own objective. | Algorithm portfolios in SAT and planning. |
| **Clean-up taught by demonstration.** A person fixes drawings and says why; each recurring fix becomes a rule, and is kept only if it measures better on held-out cases. | Turn an expert's manual corrections into a post-optimization pass. | Programming by demonstration; dispatchers' rules of thumb in scheduling. |
| **Open-space grid.** A grid of cells holding nothing gives candidate places for a move. | Index the free capacity, then try moves only into it. | Free-space lists in packing; skyline and maximal-rectangle methods. |
| **Leaf units.** A part that hangs from the rest by one link can turn or move freely round its anchor without disturbing anything else. | Find the pieces joined to the rest at a single point, and optimize them on their own, after the core. | Articulation points and block decomposition. |
| **Pull in from the edge.** Parts at the edge move inward into open space, kept only if the bounding box shrinks with no more problems; the edge first, so the most valuable moves come first when time runs short. | Compaction: shrink the extent (makespan, number of bins, distance travelled) by moving what lies on the boundary into interior slack. | Left-shift and gap filling in scheduling; compaction in chip layout; VM consolidation. |
| **Don't fence me in / push off the line.** One element moves to the most open nearby spot, or just far enough off a conflict, judged by its own conflicts only. | Cheap local repair of one conflict at a time, with a local cost delta. | Min-conflicts heuristics. |
| **Retry only after a change nearby.** A class that could not be improved is tried again only once something near it moves. | Skip the work that cannot pay off. | "Don't look bits" in 2-opt for the TSP. |
| **Held-out graphs.** Rules tuned on 15 graphs, judged on 36 never seen. | Guard heuristics against overfitting to the instances they were tuned on. | Standard in machine learning, less common for hand-built heuristics. |
| **Playback and Lab.** Watch every step at its real speed, switch steps off, edit by hand, record why. | Observability for any optimizer whose state can be drawn: see where it wastes time and what a person would do instead. | Solver logs and search visualizers, though rarely with hand edits feeding back. See [PLAYBACK-AND-LAB.md](PLAYBACK-AND-LAB.md). |

## Obvious candidates
These need little more than the methods as they are:
- **Warehouse slotting and facility layout.** This is placing boxes in 2D so that things used together sit close, the same problem as stress placement with flows as link weights. Aisles add constraints that play the role of links through classes. Pull-in maps to consolidating stock off the far racks.
- **Floor plans, seating and equipment layout.** Rooms or desks with sizes and adjacency wishes: the layouts, the overlap removal and the open-space grid apply as they are.
- **Map and chart labeling.** Placing names where they cover nothing is already one step of the link routing here (name over a class or name, link across a name).
- **Diagrams of other graphs.** Data lineage, query plans, service dependencies, network topology and organization charts are graphs with boxes and named links. The whole pipeline applies, with the measures re-weighted.

These need an analogy:
- **Scheduling and timetabling.** A Gantt chart is a drawing:
  - the makespan is the drawing's width;
  - idle time is open space inside the drawing;
  - resource conflicts play the role of crossings.

  Pull-in becomes moving tasks from the end of the schedule into gaps earlier on, kept only if the makespan drops with no new conflict. A task with one predecessor and one resource is a leaf unit. The work clock gives the same schedule on every run, which planners need in order to trust what changed between two runs.
- **Bin packing and cloud consolidation.** The bins at the edge are the lightly filled ones. Pull-in drains them into slack in the full ones, kept only if a bin empties and no constraint breaks. Most valuable first means the bins closest to empty.
- **Vehicle routing.** Customers on a spur, reached by one road, are leaf units. They can be re-sequenced on their own, after the main tour. Pulling in from the edge maps to taking the outlying stops of a long route into a nearby route's slack. This is a known move in route improvement; the gain is mostly in the practice: the work clock, held-out instances, and dispatchers' corrections turned into rules.
- **Dependency solving (packages, builds, plans).** The analogy is weaker, because there is no space, but some parts carry over:
  - The work clock and the portfolio apply directly: reproducible builds need a reproducible solver, and two strategies judged by the user's measure beat one.
  - A package that only one other package needs is a leaf unit: choose its version last, on its own.
  - The playback (each step, its time, what it changed) would show why a solver chose a version, which is a common question.

## What would not carry over
- **The layout itself.** Stress placement assumes that geometric distance should match path distance in the graph. Most problems above have no such target.
- **The weights.** The weights (6 per crossing, 10 per link through a class) were tuned for reading diagrams. Each domain needs its own weights, and its own held-out set to check them.
- **Measures stand in for judgment.** Here a person can look at the result and say what is wrong. In scheduling or routing, the expert's corrections still exist (the dispatcher who always moves the same job), but they must be recorded on purpose. The Lab's "edit and say why" is the part to build first.

## Possible next steps
1. **Pick one candidate** with a person who corrects its output by hand today, and real cases. Scheduling or warehouse slotting are the closest.
2. **Rebuild the practice before the solver:**
   - a work clock;
   - a held-out set;
   - a playback of the existing solver;
   - a way to record the expert's corrections with reasons.
3. **Only then turn the corrections into rules**, as was done here, and keep each only where it measures better on cases nobody tuned on.
