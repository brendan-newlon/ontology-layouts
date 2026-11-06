# Tidy Stress and Mycelium: layouts for readable ontology diagrams

Two layout algorithms for node-link diagrams with labelled rectangular nodes, built for ontologies (classes joined by subclass and relationship links), and **Best Read**, a selector that runs them and keeps the more readable result.

- **Tidy Stress** suits models of up to a few dozen classes. It lays a model out by stress majorization, then tidies it with local moves that remove crossings, links running through class boxes and needlessly long links, never making any of those worse.
- **Mycelium** suits large models and hub-heavy models. It draws groups of closely linked classes as compact pods joined by longer threads, gives each hub a ring of room for its neighbours, and fans single-link classes out around the class they hang from.
- **Best Read** is not a layout algorithm. It runs the variants of Tidy Stress and Mycelium that suit the model's size and keeps the best by a readability score.

On a benchmark of 19 models (13 to 537 classes) against eleven widely used open-source layouts, Best Read ranks first overall on readability. It also has the fewest crossed links and the fewest links running through classes: about 2–3× fewer than the best open-source layout on mid-size and hub-heavy models. At the largest size tested (537 classes), WebCola draws somewhat fewer crossings but takes over a hundred times as long. Details, limits and every number are below.

## Foundations and credit

Both algorithms are built from published techniques, and this work depends on them:

| Technique | Authors | Used for |
|---|---|---|
| Stress majorization | Gansner, Koren and North, *Graph Drawing by Stress Majorization*, 2004, building on Kamada and Kawai, 1989 | Initial placement in both algorithms |
| Pivot MDS | Brandes and Pich, *Eigensolver Methods for Progressive Multidimensional Scaling of Large Data*, 2006 | A repeatable starting placement |
| Louvain community detection | Blondel, Guillaume, Lambiotte and Lefebvre, *Fast Unfolding of Communities in Large Networks*, 2008 | Finding the pods in Mycelium |
| Link lengths that depend on graph structure | e.g. Dwyer et al., WebCola (2009 onwards), and Noack's LinLog energy model, 2007 | The idea behind pod-dependent link lengths |
| Readability measures (crossings, edge length, node–edge overlap) | Purchase, *Which aesthetic has the greatest effect on human understanding?*, 1997, and later work | The metrics used for scoring |
| Choosing a layout per graph by predicted quality | e.g. Kwon, Crnovrsanin and Ma, *What Would a Graph Look Like in This Layout?*, 2018 | The idea behind Best Read |

What is new here is the design of the parts below, the order in which they run, and the measurement that chose each setting. None of the individual building blocks is claimed as new.

## What Tidy Stress and Mycelium add

1. **Safe tidy-up passes.** After stress placement, four local searches run in a tested order. Each refuses any move that would add a crossing, a link through a box or an overlap:
   1. Swap two classes, or move one beside a neighbour, when that reduces crossings.
   2. Move a class off links that run through it.
   3. Pull each class toward its neighbours to shorten long links, then shrink the whole drawing evenly as far as the boxes allow.
   4. Move classes off links once more.

   Plain stress majorization (as in Graphviz `neato`) leaves typically 2–3× as many links through classes and about twice as many crossings.
2. **Hub rings (Mycelium).** A link at a class with k neighbours gets an ideal length of at least Σ(neighbour width + 20 px) / 2π. That is the radius of a ring that holds the neighbours side by side. On a 53-class clinical-record model with three super-hubs, links through classes fall from about 80 to about 43 with this rule alone.
3. **Pods (Mycelium).** Links inside a Louvain group are drawn at 0.85× the base length and links between groups at 1.6×. The stress placement then separates the groups without hard constraints, so a class shared between groups can still sit between them.
4. **Leaf fanning with label room (both).** Classes with a single neighbour are laid out last:
   - Each is placed around its neighbour by searching 48 directions at the nearest free distances, minimising 100 × crossings + 80 × links touching it + distance.
   - Each keeps max(40 px, label width + 16 px) from its neighbour, so the link's text fits.
   - A final pass re-places any whose link ended up crossed or touched.

   This matters for ontologies, where many classes are leaf subclasses.
5. **A readability score that resists sprawl.** Best Read scores each result on:
   - 10 × crossings,
   - 8 × links through boxes,
   - 2 × near-touching link pairs,
   - 40 × overlapping boxes,
   - mean link length,
   - area beyond eight times the area of the boxes,
   - links more than 1.8 × the median length.

   Without the last two terms, a score built from crossings alone favours drawings that avoid crossings by spreading out enormously, or by stretching a few links across the whole drawing.

## How they run

```
boxes  := each class box + 16 × 12 px margin
leaves := classes with exactly one distinct neighbour, whose neighbour has others
core   := all classes − leaves                       (Tidy Stress variants may keep leaves in the core)
for each core link (u, v):
    len := L (170 px; subclass links 0.9 L; Mycelium uses L = 260 px from 100 classes)
    Mycelium:  len := max(len, min(3 L, ring(u), ring(v)))        ring(x) = Σ(neighbour width + 20) / 2π
               len *= 0.85 inside a Louvain group, 1.6 between groups
    labelled link: len := max(len, (w_u + w_v)/2 + label width + 24)
D := all-pairs shortest-path lengths (Dijkstra)
place: pivot MDS start (plus random restarts while time allows), stress majorization on D, push overlapping boxes apart
tidy-up passes (time-boxed), fan the leaves out, tidy-up once more, re-place any leaf that is crossed or touched
```

Tidy Stress tries up to four variants within 1.5 s and keeps the best by the score:
- plain stress with random starts;
- pivot-MDS start with a final leaf improvement;
- hub rings with leaf fanning;
- leaf fanning alone.

Above 60 classes it runs only the second, because sharing the time starves each variant's tidy-up.

Mycelium refuses models of fewer than 8 classes; its budget is 1 s.

## Benchmark

**Models.** 19 shapes:
- Ontologies written from the published structure of PROV-O, SOSA/SSN, W3C ORG, the Pizza tutorial ontology and a FIBO-like loan model.
- Invented models of typical domains: university, hotel booking, HR, clinical trial, telecom network, supply chain, customer 360 (one large hub), schema.org-style core types, a clinical record with three super-hubs, a 115-class biomedical taxonomy and a 179-class bank.
- A 400-node scale-free graph, and three banks joined (537 classes).

**Boxes.** Sized from label length.

**Seeds.** Two per layout.

**Contenders.** Graphviz `neato`, `fdp` and `sfdp` (through viz.js, with Graphviz's own overlap removal), ELK stress, force and layered, WebCola, d3-force, dagre, and Cytoscape `cose` and `fcose`. They ran with sensible general settings, not tuned per model.

**Fairness.** Every layout received the same boxes, the same 170 px target link length where the library takes one, and afterwards the same overlap removal.

**Environment.** All ran in one browser tab on one machine. Times are comparable with each other, not absolute.

### Scoreboard

Average rank among 14 layouts across the 19 models (1 = best; ties share a rank). Best Read takes the better of Tidy Stress and Mycelium, so it shares ranks with them. "Wins" counts first places on the readability score, with Best Read left out.

| Layout | Readability score: all | Score: ≤ 30 classes | Score: 31–100 classes | Score: > 100 classes | Crossings | Links through classes | Area | Very long links | Wins | Median time |
|---|---|---|---|---|---|---|---|---|---|---|
| **Best Read** | **1.3** | 1.1 | **1.0** | 2.3 | **1.5** | **1.6** | 6.2 | 9.5 | – | 359 ms |
| **Tidy Stress** | 1.8 | **1.0** | 1.8 | 3.5 | 2.1 | 3.0 | 5.6 | 8.5 | 14 | 288 ms |
| **Mycelium** | 3.6 | 4.0 | 4.1 | **1.8** | 1.8 | 2.4 | 7.6 | 11.9 | 4 | 88 ms |
| Graphviz sfdp | 6.1 | 4.7 | 5.8 | 9.0 | 6.4 | 4.9 | 7.2 | 7.7 | 0 | 8 ms |
| ELK stress | 6.1 | 6.4 | 6.0 | 5.8 | 5.8 | 6.8 | 7.3 | **1.1** | 0 | 152 ms |
| WebCola | 6.2 | 9.7 | 5.0 | 2.5 | 5.2 | 4.9 | 10.9 | 3.6 | 1 | 97 ms |
| Graphviz neato | 6.5 | 6.6 | 4.9 | 9.8 | 5.7 | 4.1 | 10.4 | 5.5 | 0 | 7 ms |
| d3-force | 7.7 | 8.9 | 8.0 | 5.3 | 8.3 | 7.6 | 9.6 | 2.0 | 0 | 22 ms |
| Cytoscape fcose | 8.3 | 6.9 | 9.0 | 9.3 | 8.5 | 9.3 | 5.4 | 1.2 | 0 | 6 ms |
| ELK layered | 8.9 | 8.3 | 9.5 | 8.7 | 8.1 | 8.7 | 9.6 | 12.4 | 0 | 35 ms |
| dagre (layered) | 9.6 | 8.3 | 10.6 | 10.0 | 9.6 | 11.3 | 4.5 | 11.3 | 0 | 19 ms |
| ELK force | 12.2 | 11.4 | 12.4 | 13.3 | 13.2 | 10.8 | 11.1 | 3.9 | 0 | 143 ms |
| Cytoscape cose | 12.8 | 13.9 | 13.1 | 10.3 | 11.4 | 13.9 | **1.1** | 10.4 | 0 | 23 ms |
| Graphviz fdp | 12.9 | 13.0 | 13.3 | 12.3 | 13.6 | 11.7 | 7.6 | 3.5 | 0 | 10 ms |

How to read it:
- **Strengths.** Tidy Stress and Mycelium lead clearly on the two measures that most affect reading: crossed links and links that pass through a class (which make two classes look connected when they are not).
- **Costs.**
  - They are not the most compact. `cose` and dagre pack tighter, `cose` by letting links run through boxes.
  - Mycelium's threads between pods are long by design, so it ranks low on "very long links".
  - They are slower than the C and native libraries, though within a second or two at every size tested.

### Per model

Crossed links / links through classes (average of two seeds), and the best open-source result on the readability score for the same model.

| Model | Classes / links | Best Read | Tidy Stress | Mycelium | Best open-source on score |
|---|---|---|---|---|---|
| University | 14 / 20 | 1 / 1 | 1 / 1 | 0 / 1 | Graphviz sfdp 4 / 3 |
| Hotel booking | 13 / 16 | 0 / 0 | 0 / 0 | 0 / 1 | Graphviz sfdp 1 / 0 |
| HR | 20 / 24 | 0 / 0 | 0 / 0 | 0 / 0 | ELK layered 0 / 3 |
| W3C ORG | 15 / 20 | 0 / 0 | 0 / 0 | 0 / 0 | ELK stress 4 / 1 |
| Brewery IoT | 23 / 37 | 1 / 0 | 1 / 0 | 1 / 0 | Graphviz sfdp 2 / 1 |
| Clinical trial | 24 / 28 | 1 / 0 | 1 / 0 | 2 / 0 | Graphviz sfdp 4 / 2 |
| PROV-O | 30 / 62 | 35 / 10 | 35 / 10 | 28 / 12 | ELK stress 66 / 30 |
| Telecom network | 34 / 86 | 30 / 6 | 32 / 7 | 36 / 4 | Graphviz neato 79 / 10 |
| SOSA/SSN | 36 / 63 | 12 / 8 | 12 / 8 | 14 / 5 | ELK stress 35 / 16 |
| Customer 360 | 31 / 49 | 8 / 7 | 8 / 7 | 6 / 7 | Graphviz sfdp 27 / 13 |
| Supply chain | 39 / 76 | 17 / 2 | 15 / 3 | 18 / 1 | Graphviz sfdp 42 / 19 |
| schema.org core | 49 / 102 | 111 / 29 | 110 / 36 | 58 / 47 | Graphviz neato 215 / 36 |
| Clinical record (3 super-hubs) | 53 / 129 | 161 / 25 | 210 / 97 | 161 / 25 | Graphviz neato 435 / 66 |
| FIBO-like loans | 59 / 77 | 14 / 6 | 14 / 6 | 14 / 4 | Graphviz neato 25 / 13 |
| Pizza (taxonomy) | 90 / 94 | 2 / 26 | 2 / 26 | 10 / 38 | d3-force 12 / 35 |
| Biomedical taxonomy | 115 / 139 | 22 / 9 | 32 / 20 | 22 / 9 | WebCola 57 / 29 |
| Bank | 179 / 285 | 67 / 23 | 148 / 132 | 59 / 15 | WebCola 128 / 77 |
| Scale-free 400 | 400 / 482 | 760 / 223 | 1058 / 583 | 764 / 212 | WebCola 847 / 401 |
| Three banks joined | 537 / 915 | 2254 / 965 | 3931 / 2283 | 2250 / 969 | WebCola 2096 / 774 |

Times at the large end (same tab): Best Read 1.3–1.5 s for 179–537 classes. WebCola took 2.8 s, 41 s and 219 s for 179, 400 and 537 classes. ELK stress took 14 s to 3.5 minutes; Graphviz `sfdp` took 0.5–2 s and `neato` 0.6–4.7 s.

### Limits
- **Our measures and our score.** The score is our own, and the layouts were tuned against it. The crossing and through-class counts are standard measures that the score does not hide, and they tell the same story. Still, no study with people reading the diagrams has been done.
- **Contender settings.** The contenders used general-purpose settings. Each could probably do better if tuned per model, as ours were tuned for ontologies.
- **Models.** The models are reconstructions and inventions of typical shapes, not a public corpus of real ontologies. Commercial engines (yFiles, Tom Sawyer) were not tested.
- **Largest sizes.** At about 500 classes and up, WebCola draws fewer crossings when given minutes to run. Within a time budget of a couple of seconds, Mycelium is the stronger choice there.
- **Hub-heavy models stay hard.** On the clinical-record model, a 20-second exhaustive search reaches only about 150 crossings, against 161 in one second. Big further gains there need a different kind of drawing, such as bundled links or repeating a hub, rather than a better placement.

## What did not work
- **Stretching the drawing** about a class until every single-link neighbour has a clean spot. Without a limit this produced drawings millions of pixels wide on hub-heavy models; even capped at 2.5× it doubled the area for little gain.
- **Pulling hubs together toward the centre.** No gain.
- **Other stress weights and link lengths:** 1/d weights instead of 1/d², and link lengths scaled by degree or by neighbourhood overlap. No gain.
- **Alternatives to plain Louvain pods:**
  - Overlapping membership (a class also joins any group holding 30 % of its links).
  - Coarser and finer resolutions (γ = 0.7, 1.5).

  None did better on average across 14 mid-size and large models; each won on some models and lost on others. Because the pods only bias link lengths, how exactly the groups are drawn matters less than whether there are groups at all. Removing them costs the most on large and hub-heavy models: on the bank model, crossings rise from 73 to 128 and links through classes from 53 to 103.
- **Splitting a fixed time budget** between several variants on large models. It starves each variant's tidy-up, and the result is worse than one variant given all the time.

## Using the code
The reference implementation is plain JavaScript with no dependencies, about 500 lines. Input is box sizes `[{w, h}]` and links `[[i, j, weight, labelWidth?]]` (weight 2 for subclass links); output is box centres `[{x, y}]`.

| Function | Algorithm |
|---|---|
| `_ogCompactLayout(items, edges, opts)` | Tidy Stress |
| `_ogGroupedLayout(items, edges, opts)` | Mycelium |
| `_ogAutoLayout(items, edges, opts)` | Best Read |
| `_ogStressLayout(items, edges, cfg, opts)` | One run, with `cfg` options for each technique |
| `_ogPlacementMetrics`, `_ogPlacementScore` | The measures and the score |

All arithmetic is on unrounded floats.

The benchmark scripts and model definitions are available on request.
