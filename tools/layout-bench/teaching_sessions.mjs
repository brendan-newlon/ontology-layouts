// The Layout Lab sessions in which the clean-up was taught, made compact for the lab edition of the write-up: per graph,
// the notes and the moves in order (classes moved, the counts before and after), the clean-up runs, and the last drawing.
// Undone and ignored steps, selections, views and timestamps are left out.
// node teaching_sessions.mjs <folder with lab_*.json> [out.json]   (default out: teaching_sessions.json)
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2], out = process.argv[3] || new URL('teaching_sessions.json', import.meta.url);
if (!dir) throw new Error('usage: node teaching_sessions.mjs <folder> [out.json]');
const files = fs.readdirSync(dir).filter((f) => /^lab_(?!journal).+\.json$/.test(f)).sort();
const byGraph = {};
const c = (m) => (m ? [m.cross, m.thru] : null);
for (const f of files) {
  const S = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), ev = S.events || [];
  const g = (byGraph[S.graph] = byGraph[S.graph] || { graph: S.graph, labels: S.labels, steps: [], last: null });
  for (const e of ev) {
    if (e.undone || e.ignored) continue;
    if (e.kind === 'note' && e.text && e.text.trim()) g.steps.push(['note', e.text.trim()]);
    else if (e.kind === 'move') g.steps.push(['move', e.classes, c(e.before), c(e.after)]);
    else if (e.kind === 'cleanup') g.steps.push(['cleanup', (e.steps || []).length, c(e.before), c(e.after)]);
    else if (e.kind === 'layout' && !g.steps.length) g.steps.push(['start', S.algo === 'auto' ? 'Best Read' : e.algo || S.algo, c(e.after)]);
    const P = e.state && e.state.P; if (P && P.length === S.labels.length) g.last = P.map((p) => [Math.round(p.x ?? p[0]), Math.round(p.y ?? p[1])]);
  }
}
const list = Object.values(byGraph).filter((g) => g.steps.some((s) => s[0] === 'note' || s[0] === 'move'));
fs.writeFileSync(out, JSON.stringify(list));
console.log(list.length, 'graphs,', list.reduce((a, g) => a + g.steps.length, 0), 'steps,', list.reduce((a, g) => a + g.steps.filter((s) => s[0] === 'note').length, 0), 'notes,', (JSON.stringify(list).length / 1024).toFixed(0), 'KB');
