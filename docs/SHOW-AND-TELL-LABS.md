# Show and tell: turning a person's intuition into a program, with an AI

The clean-up in this repository was not designed from the literature. Brendan Newlon, who could tidy an ontology diagram at a glance but could not have written down the rules, designed a lab in which to teach them: he tidied drawings there by hand while explaining how he recognizes problems, which to fix first and how he approaches each. At his direction, an AI assistant, Claude (Opus 5.5), turned that practice and those explanations into definitions, measures and code, and tested every rule on graphs he never saw. The result beats every open-source layout we measured on the problems it was taught to fix (see the [write-up](ONTOLOGY-LAYOUT-ALGORITHMS.html#learned)).

This guide covers the method behind that result and the tools that made it work: the Layout Lab and the Layout Playback. They are first-class parts of this repository, not leftovers from building the layouts. Use them in three ways:
- **Try your hand** at the layouts here, and teach them something new.
- **Copy the lab** for a different problem: anything a person can look at and fix better than they can describe.
- **Use the method** without a lab: the loop below works wherever a person can demonstrate and explain.

## Why it works
People are very good at some problems they cannot explain. Tidying a diagram, packing a van, arranging a schedule and laying out a floor plan are examples. Ask for the rules and you get vague answers ("give it room", "keep the groups together"). Watch the person work and ask why at each step, and the reasons are specific and usually right. What was missing was a way to turn many such reasons into a procedure that runs without the person, and to check that each one is right for more than the case it was shown on.

An AI coding assistant fills that gap well:
- it reads a long record of moves and comments without tiring;
- it proposes a precise definition for a vague word ("open space" became a grid of empty cells);
- it writes the code;
- it benchmarks the rule on every test case;
- it explains back, in the person's own words, why a rule failed.

The person stays the source of the ideas. The AI is the distiller and the tester.

## The loop
1. **Make the work visible.** Draw the state the algorithm works on, and show the measures it is judged by on every frame. Here, these are crossed links, links through classes, sharp crossings and cramped classes. If a person cannot see a problem, they cannot teach how to fix it.
2. **Show and tell.** The person fixes cases by hand in the lab. Before each move they type what they are about to do and why. The moves matter less than the reasons:
   - what they look at first;
   - what they count as a problem and what as harmless;
   - which move they reach for, and when they give up on one.
3. **Distill.** The AI reads the recorded sessions and writes each recurring reason as a principle, in the person's words. It then proposes how a program could recognize the situation and carry out the move. Metaphors are welcome and often the best part: "open space is a resource", "push the crowd outward in pizza slices", "don't fence me in".
4. **Test on everything.** Each rule is implemented and measured on every test case, including cases kept back that nobody has looked at. A rule is kept only if it helps across them. Most of the first ideas fail here, and that is the point of the step.
5. **Walk through and critique.** The algorithm replays its own steps in the playback, with overlays that draw the ideas it uses (the open-space grid, the slices, the regions it worked on). The person marks the steps the way a teacher marks a student's work: "why didn't the leaf go to the right, where there was room?" Each critique becomes the next rule, or a fix to an existing one.
6. **Plain words both ways.** The AI explains, in the person's own terms, where a rule is slow or does not work. For example: "a push always looks worse at first; only the repairs after it make it pay off." The person then refines the principle. Neither side needs the other's vocabulary.

Repeat from step 2 or 5. The write-up has a [table of the principles](ONTOLOGY-LAYOUT-ALGORITHMS.html#learned), each in the person's words beside what the code now does.

## Try your hand here
**In a browser, nothing installed.** Open the [lab edition of the write-up](ONTOLOGY-LAYOUT-ALGORITHMS-LAB.html#lab) and unfold the lab:
1. Pick a graph and the drawing to start from (one of ours, or any of the eleven open-source layouts).
2. Before each move, type in the note box what you are about to do and why, then press Enter. Drag a class to move it; Ctrl- or Shift-click to move several together. The counts update after each move.
3. **Run our clean-up** on your drawing at any point to see what the program would do from there; Undo takes it back.
4. Work on as many graphs as you like. **Download the session**: one Markdown file with every graph you worked on, your notes and moves with the counts before and after, and the drawings at the start and the end. It starts with a brief for an AI assistant, which says what happened and what to do next: distill your reasons into rules, try them in the code, measure them on graphs nobody tuned on, and report back in plain words.
5. Give the file and a copy of this repository to your AI assistant. If a rule holds up, please send it back as a pull request with the session attached.

Under the lab, **The sessions that taught the clean-up** shows Brendan Newlon's own sessions: his notes in his words and the moves he kept, graph by graph. Each can be opened in the lab at the point where he left it.

**With the playback.** The full lab and the Layout Playback run from this repository:
1. Double-click `Start Layout Lab.cmd` (Windows), or follow [PLAYBACK-AND-LAB.md](PLAYBACK-AND-LAB.md#running-it). The playback opens.
2. Pick a graph and a layout, and watch it play. Switch steps off, reorder them, or change the time limit to see what each step is worth.
3. Click **Open in Layout Lab** on a frame where something looks wrong. Move classes until the drawing reads well. Before each move, type in the note box what you are doing and why.
4. Your session is saved in the browser and, if `tools/recv.py` is running, to `_temp/lab_<graph>_<time>.json`.
5. Give the sessions to an AI assistant with the prompts below, and ask it to propose rules. Measure them with the benches in `tools/layout-bench/` (its README lists them).

A new principle that holds up on the graphs nobody tuned on is a contribution worth sending back.

## Build a lab for your own problem
You need four things:
- **A state you can draw.** Positions, assignments, a schedule, a packing.
- **Measures a person agrees with.** Counts of what is wrong, shown on every frame. A person who disagrees with the measures will teach something the measures cannot see.
- **An algorithm that works in steps** and can report the state after each one. This can be a simple one; the lab is for improving it.
- **Test cases in two sets:** cases to develop on, and cases nobody looks at until the end.

The technical contract (the recorder, switching steps off, the time budget, the sync between the two pages) is in [PLAYBACK-AND-LAB.md](PLAYBACK-AND-LAB.md#the-contract-for-adapting-it). [BEYOND-LAYOUT.md](BEYOND-LAYOUT.md) discusses which problems are good candidates: warehouse slotting, scheduling, bin packing, routing and dependency solving.

### Working with an AI to adapt it
These are the prompts that worked, in order. Give the assistant this repository and this guide, and say what your problem is.
1. "Read `tools/layout-bench/playback.html`, `lab.html` and `docs/PLAYBACK-AND-LAB.md`. List what is specific to diagrams and what is the reusable pattern. Then propose how each specific part maps to my problem: the drawing, the overlays, the measures and the test cases."
2. "Build the smallest version first: draw my state, show my measures on every frame, let me move things by hand, and save each move with my note and the measures before and after."
3. "Add the recorder to my algorithm, and play its steps back in real time. For each step, add a switch to run without it."
4. *(After some sessions.)* "Read my sessions in `_temp/`. Leave out undone and ignored steps. List the principles you see, each in my words, with the sessions that show it. For each one, propose a definition a program can test, and the smallest code that carries it out."
5. "Implement the first principle. Measure it on the development cases and then on the held-out cases. Keep it only if it helps on both, and tell me in plain words what it did, where it failed, and why."
6. "Replay your steps in the playback, with an overlay that draws the idea each step uses, so I can critique them."

### Lessons from doing it here
- **Ask why before each move, not after.** Reasons given before a move are about the situation. Reasons given after are often justifications.
- **Never replay the person's moves.** They only fit the case they were made on. The reasons generalize; the positions do not.
- **Judge every rule on cases nobody looked at.** Several rules that looked right on the cases they came from did nothing elsewhere. The write-up lists them under "What did not work".
- **A move can look worse before it pays off.** Some principles only work with the repairs that follow them. Judge them after the repairs, not on their immediate effect.
- **Keep the measures honest.** A lab teaches what its measures can see. When the person says a drawing looks wrong and the counts say it is fine, the measures are missing something. Add a measure; do not overrule the person.
- **One person's taste is one data point.** The clean-up here was taught by one person on eight ontologies. A second teacher would find other principles, and some might disagree.

## Credit
The principles of the clean-up and their metaphors came from Brendan Newlon, who designed the teaching method and specified the lab and the playback, tidied the drawings by hand in the lab, explained each move, and critiqued every step of the clean-up. Claude (Opus 5.5), an AI coding assistant from Anthropic, distilled the principles into definitions and code, built the lab and the playback to his specification, and ran the benchmarks.
