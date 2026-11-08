// Link names for the benchmark graphs, which carry none: "has" + the target class; a second link the same way between the
// same classes gets "relatedTo" + target, then "ownedBy", "partOf", "uses". Subclass links get no name.
const VERBS = ['has', 'relatedTo', 'ownedBy', 'partOf', 'uses'];
export function names(labels, edges) { const seen = new Map(); return edges.map(([s, t, sub]) => { if (sub) return ''; const key = s + '>' + t, i = seen.get(key) || 0; seen.set(key, i + 1); return VERBS[i % VERBS.length] + labels[t]; }); }
