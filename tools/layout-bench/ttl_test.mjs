// Checks for ttl.js (OntologyTTL): parser features, graph builder, error reporting.
// Usage: node ttl_test.mjs [file.ttl ...]   (extra files are parsed as a smoke test; counts only)
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
vm.runInThisContext(fs.readFileSync(path.join(here, 'ttl.js'), 'utf8'), { filename: 'ttl.js' });
const T = globalThis.OntologyTTL;

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const EX = 'http://example.org/';
let pass = 0, fail = 0;
function check(name, fn) {
  try {
    const r = fn();
    if (r === true) { pass++; console.log('PASS', name); }
    else { fail++; console.log('FAIL', name, r === false ? '' : JSON.stringify(r)); }
  } catch (e) { fail++; console.log('FAIL', name, '-', e.message); }
}
const has = (ts, s, p, o) => ts.some(t => t[0] === s && t[1] === p &&
  (typeof o === 'object' ? JSON.stringify(t[2]) === JSON.stringify(o) : t[2] === o));
const lit = (value, datatype = XSD + 'string', lang = null) => ({ value, lang, datatype });
const errLine = (src) => { try { T.parse(src); return 'no error'; } catch (e) { return e.message; } };

// ---------- parser ----------
check('prefixes, a, ; and , lists', () => {
  const ts = T.parse(`@prefix ex: <${EX}> .
    ex:s a ex:C ; ex:p ex:o1 , ex:o2 ;
       ex:q "x" ; .`);
  return ts.length === 4 && has(ts, EX + 's', RDF + 'type', EX + 'C') && has(ts, EX + 's', EX + 'p', EX + 'o2')
    && has(ts, EX + 's', EX + 'q', lit('x')) || ts;
});
check('SPARQL PREFIX/BASE and relative IRIs', () => {
  const ts = T.parse(`BASE <http://a.org/dir/file>
    prefix ex: <x#>
    <#me> ex:knows <../other> , </root> , <sub/y?q=1> .
    @base <http://b.org/> .
    <z> ex:p <//c.org/w> .`);
  return has(ts, 'http://a.org/dir/file#me', 'http://a.org/dir/x#knows', 'http://a.org/other')
    && has(ts, 'http://a.org/dir/file#me', 'http://a.org/dir/x#knows', 'http://a.org/root')
    && has(ts, 'http://a.org/dir/file#me', 'http://a.org/dir/x#knows', 'http://a.org/dir/sub/y?q=1')
    && has(ts, 'http://b.org/z', 'http://a.org/dir/x#p', 'http://c.org/w') || ts;
});
check('empty prefix, dots/dashes in names, escapes, trailing dot', () => {
  const ts = T.parse(`@prefix : <${EX}> . @prefix my-ns.v2: <${EX}v2/> .
    :a.b-c my-ns.v2:has_part :x\\,y\\#z.
    :n :p :e%20f , :123 .`);
  return has(ts, EX + 'a.b-c', EX + 'v2/has_part', EX + 'x,y#z') && has(ts, EX + 'n', EX + 'p', EX + 'e%20f')
    && has(ts, EX + 'n', EX + 'p', EX + '123') && ts.length === 3 || ts;
});
check('string literals: four quote styles, long strings, escapes', () => {
  const ts = T.parse(`@prefix ex: <${EX}> .
    ex:s ex:p "dq \\"q\\" \\t\\u00e9\\U0001F600", 'sq \\'x\\'', """long
line "with" quotes""", '''single
long''', """ends in quote"""" .`);
  const v = ts.map(t => t[2].value);
  return v[0] === 'dq "q" \té\u{1F600}' && v[1] === "sq 'x'" && v[2] === 'long\nline "with" quotes'
    && v[3] === 'single\nlong' && v[4] === 'ends in quote"' || v;
});
check('numbers, booleans, language tags, datatypes', () => {
  const ts = T.parse(`@prefix ex: <${EX}> . @prefix xsd: <${XSD}> .
    ex:s ex:p 42, -3.5, 1.2e3, +7, true, false, "chat"@fr, "colour"@en-GB,
      "2024-01-01"^^xsd:date, "5"^^<${XSD}int> ; ex:last 9.`);
  const o = ts.map(t => t[2]);
  return JSON.stringify(o) === JSON.stringify([
    lit('42', XSD + 'integer'), lit('-3.5', XSD + 'decimal'), lit('1.2e3', XSD + 'double'), lit('+7', XSD + 'integer'),
    lit('true', XSD + 'boolean'), lit('false', XSD + 'boolean'), lit('chat', RDF + 'langString', 'fr'),
    lit('colour', RDF + 'langString', 'en-GB'), lit('2024-01-01', XSD + 'date'), lit('5', XSD + 'int'), lit('9', XSD + 'integer')]) || o;
});
check('blank node property lists and labels', () => {
  const ts = T.parse(`@prefix ex: <${EX}> .
    ex:s ex:p [ ex:q [ ex:r "deep" ] ; ex:t ex:u ] .
    [ ex:a ex:b ] .
    [] ex:c _:x . _:x ex:d _:x .`);
  const b1 = ts.find(t => t[0] === EX + 's')[2];
  const inner = ts.find(t => t[0] === b1 && t[1] === EX + 'q')[2];
  const x = ts.find(t => t[1] === EX + 'c')[2];
  return /^_:b\d+$/.test(b1) && has(ts, inner, EX + 'r', lit('deep')) && has(ts, b1, EX + 't', EX + 'u')
    && ts.some(t => t[1] === EX + 'a') && has(ts, x, EX + 'd', x) && ts.length === 7 || ts;
});
check('collections expand to rdf:first/rdf:rest', () => {
  const ts = T.parse(`@prefix ex: <${EX}> . ex:s ex:list (ex:a "b" (ex:c)) ; ex:empty () .`);
  const head = ts.find(t => t[1] === EX + 'list')[2];
  const walk = (n) => { const out = []; while (n !== RDF + 'nil') { out.push(ts.find(t => t[0] === n && t[1] === RDF + 'first')[2]); n = ts.find(t => t[0] === n && t[1] === RDF + 'rest')[2]; } return out; };
  const items = walk(head);
  return items.length === 3 && items[0] === EX + 'a' && items[1].value === 'b' && walk(items[2])[0] === EX + 'c'
    && has(ts, EX + 's', EX + 'empty', RDF + 'nil') || items;
});
check('comments, # inside IRIs and strings', () => {
  const ts = T.parse(`# header
    @prefix ex: <${EX}> . # trailing
    ex:s ex:p <http://x.org/a#b> ; # mid
      ex:q "not # a comment" .`);
  return ts.length === 2 && has(ts, EX + 's', EX + 'q', lit('not # a comment')) && has(ts, EX + 's', EX + 'p', 'http://x.org/a#b') || ts;
});
check('N-Triples', () => {
  const ts = T.parse(`<${EX}s> <${EX}p> <${EX}o> .
_:n1 <${EX}p> "v\\n"@en .
<${EX}s> <${EX}q> "3"^^<${XSD}integer> .
`);
  return ts.length === 3 && has(ts, ts[1][0], EX + 'p', lit('v\n', RDF + 'langString', 'en')) && ts[2][2].datatype === XSD + 'integer' || ts;
});
check('error: undeclared prefix gives line 3', () => /line 3\b.*undeclared prefix "foo:".*foo:bar/.test(errLine(`@prefix ex: <${EX}> .
ex:a ex:b ex:c .
ex:a ex:b foo:bar .`)) || errLine(''));
check('error: unterminated string gives its line', () => /line 2\b.*line break/.test(errLine(`@prefix ex: <${EX}> .
ex:a ex:b "oops
.`)));
check('error: missing dot gives line 4', () => {
  const m = errLine(`@prefix ex: <${EX}> .

ex:a ex:b ex:c
ex:d ex:e ex:f .`);
  return /line 4\b.*expected "\."/.test(m) || m;
});
check('error: missing ] reported', () => /line 1\b.*expected "\]"/.test(errLine(`@prefix ex: <${EX}> . ex:a ex:b [ ex:c ex:d .`)) || errLine(`@prefix ex: <${EX}> . ex:a ex:b [ ex:c ex:d .`));

// ---------- graph builder ----------
const ONTO = `@prefix :     <http://example.org/zoo#> .
@prefix owl:  <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

:Animal a owl:Class ; rdfs:label "Animal"@en , "Tier"@de , "animal" .
:Mammal a owl:Class ; rdfs:subClassOf :Animal , owl:Thing ; rdfs:label "Mammal"@en-US .
:Bird rdfs:subClassOf :Animal ; rdfs:label "Vogel"@de .
:Keeper a owl:Class ; skos:prefLabel "Zoo keeper"@en .
:Enclosure a owl:Class .
:Food a rdfs:Class .
:Lion rdfs:subClassOf :Mammal ,
    [ a owl:Restriction ; owl:onProperty :eats ; owl:someValuesFrom :Food ] ,
    [ a owl:Restriction ; owl:onProperty :legCount ; owl:hasValue 4 ] .
:Fish a owl:Class ; owl:disjointUnionOf ( :Shark :Trout ) .

:caresFor a owl:ObjectProperty ; rdfs:label "cares for"@en , "pflegt"@de ;
  rdfs:domain :Keeper ; rdfs:range [ a owl:Class ; owl:unionOf ( :Mammal :Bird ) ] .
:livesIn rdfs:domain :Animal ; rdfs:range :Enclosure .
:eats a owl:ObjectProperty ; rdfs:domain :Animal ; rdfs:range :Food .
:eats rdfs:range :Food .
:mentors a owl:ObjectProperty ; rdfs:domain :Keeper ; rdfs:range :Keeper .
:name a owl:DatatypeProperty ; rdfs:domain :Animal ; rdfs:range xsd:string .
:nickname rdfs:domain :Animal ; rdfs:range rdfs:Literal .
:orphan a owl:ObjectProperty ; rdfs:domain :Animal .
:everything a owl:ObjectProperty ; rdfs:domain owl:Thing ; rdfs:range :Animal .
`;
const Z = 'http://example.org/zoo#';
const edge = (g, a, b, kind, name) => g.edges.some(e => g.labels[e.s] === a && g.labels[e.t] === b && e.kind === kind && e.name === name);

check('graph: classes and labels (lang en)', () => {
  const g = T.load(ONTO);
  const want = 8; // Shark and Trout appear only in a disjointUnionOf, so they are not classes
  return g.labels.includes('Mammal') && g.labels.includes('Vogel') && g.labels.includes('Zoo keeper')
    && g.labels.includes('Enclosure') && g.labels.includes('Food') && g.labels.includes('Lion') && g.labels.includes('Fish')
    && !g.iris.includes('http://www.w3.org/2002/07/owl#Thing') && !g.iris.some(x => x.startsWith(XSD))
    && !g.iris.includes('http://www.w3.org/2000/01/rdf-schema#Literal') && g.labels.length === 8
    && g.iris.length === g.labels.length && g.iris[g.labels.indexOf('Animal')] === Z + 'Animal' || { labels: g.labels, want };
});
check('graph: label language preference (de, then no-lang, then any)', () => {
  const de = T.load(ONTO, { lang: 'de' }), fr = T.load(ONTO, { lang: 'fr' });
  return de.labels.includes('Tier') && fr.labels.includes('animal') && fr.labels.includes('Vogel')
    && de.labels.includes('Mammal') && edge(de, 'Zoo keeper', 'Mammal', 'rel', 'pflegt') || [de.labels, fr.labels];
});
check('graph: subclass links (owl:Thing dropped)', () => {
  const g = T.load(ONTO);
  return edge(g, 'Mammal', 'Animal', 'sub', '') && edge(g, 'Vogel', 'Animal', 'sub', '') && edge(g, 'Lion', 'Mammal', 'sub', '')
    && g.stats.subclassLinks === 3 || g.edges;
});
check('graph: union range expands; property labels; self-link; dedupe', () => {
  const g = T.load(ONTO);
  return edge(g, 'Zoo keeper', 'Mammal', 'rel', 'cares for') && edge(g, 'Zoo keeper', 'Vogel', 'rel', 'cares for')
    && edge(g, 'Animal', 'Enclosure', 'rel', 'livesIn') && edge(g, 'Zoo keeper', 'Zoo keeper', 'rel', 'mentors')
    && g.edges.filter(e => e.name === 'eats' && g.labels[e.s] === 'Animal').length === 1 || g.edges;
});
check('graph: restriction edge and skipped count', () => {
  const g = T.load(ONTO);
  // skipped: hasValue restriction, :orphan (no range), :everything (domain only owl:Thing)
  return edge(g, 'Lion', 'Food', 'rel', 'eats') && g.stats.relationshipLinks === 6 && g.stats.skipped === 3 || g.stats;
});
check('graph: restrictions:false and keepThing', () => {
  const a = T.load(ONTO, { restrictions: false }), b = T.load(ONTO, { keepThing: true });
  return !edge(a, 'Lion', 'Food', 'rel', 'eats') && a.stats.skipped === 4
    && b.labels.includes('Thing') && edge(b, 'Mammal', 'Thing', 'sub', '') && edge(b, 'Thing', 'Animal', 'rel', 'everything')
    && b.stats.skipped === 2 || [a.stats, b.stats];
});
check('graph: edges index into labels; stats consistent', () => {
  const g = T.load(ONTO);
  return g.edges.every(e => Number.isInteger(e.s) && Number.isInteger(e.t) && e.s < g.labels.length && e.t < g.labels.length)
    && g.stats.classes === g.labels.length && g.stats.subclassLinks + g.stats.relationshipLinks === g.edges.length;
});
check('graph: rdfs-only schema with local names from / IRIs', () => {
  const g = T.load(`@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    <http://ex.org/onto/Person> a rdfs:Class . <http://ex.org/onto/Org/> a rdfs:Class .
    <http://ex.org/onto/worksFor> rdfs:domain <http://ex.org/onto/Person> ; rdfs:range <http://ex.org/onto/Org/> .`);
  return g.labels.join() === 'Person,Org' && edge(g, 'Person', 'Org', 'rel', 'worksFor') || g;
});

check('predeclared common prefixes; file declarations override', () => {
  const ts = T.parse(`<${EX}a> a owl:Class ; rdfs:label "A" . @prefix owl: <${EX}myowl#> . <${EX}b> a owl:Class .`);
  return ts[0][2] === 'http://www.w3.org/2002/07/owl#Class' && ts[2][2] === EX + 'myowl#Class' || ts;
});
check('graph: schema.org domainIncludes/rangeIncludes count as domain/range', () => {
  const g = T.load(`@prefix so: <https://schema.org/> . @prefix : <${EX}> .
    :Driver a owl:Class . :Route a owl:Class .
    :drives a owl:ObjectProperty ; rdfs:label "drives route" ; so:domainIncludes :Driver ; so:rangeIncludes :Route .
    :name a owl:DatatypeProperty ; so:domainIncludes :Driver ; so:rangeIncludes xsd:string .`);
  return edge(g, 'Driver', 'Route', 'rel', 'drives route') && g.stats.skipped === 0 && g.labels.length === 2 || g;
});

console.log(`\n${pass} passed, ${fail} failed`);

// ---------- optional smoke test on real files ----------
for (const f of process.argv.slice(2)) {
  try {
    const t0 = Date.now(), text = fs.readFileSync(f, 'utf8'), triples = T.parse(text), g = T.toGraph(triples);
    console.log(`SMOKE ${path.basename(f)}: ${triples.length} triples, ${g.stats.classes} classes, ${g.stats.subclassLinks} subclass, ${g.stats.relationshipLinks} rel, ${g.stats.skipped} skipped, ${Date.now() - t0} ms`);
  } catch (e) { console.log(`SMOKE ${path.basename(f)}: ERROR ${e.message}`); }
}
process.exitCode = fail ? 1 : 0;
