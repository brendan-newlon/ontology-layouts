# Converts the downloaded public graphs into tools/layout-bench/models6.js (classes and links, as the library would show them).
# python -P -E convert_public.py <download dir> models6.js   (needs rdflib; downloads listed in the README)
import sys, os, re, json, glob
import xml.etree.ElementTree as ET
from rdflib import Graph, URIRef, BNode, RDF, RDFS, OWL
from rdflib.collection import Collection

DL, OUT = sys.argv[1], sys.argv[2]
SKIP = {str(RDFS.Resource), str(RDFS.Literal), str(OWL.Thing), str(RDFS.Class), str(OWL.Class), 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'}

def local(u):
    return re.split(r'[#/]', u.rstrip('/#'))[-1]

def label_of(g, u):
    if re.search(r'_\d{5,}$', u):  # OBO-style ids read by their label
        for o in g.objects(URIRef(u), RDFS.label):
            if getattr(o, 'language', None) in (None, 'en'): return str(o)
    return local(u)

def members(g, x):
    if isinstance(x, URIRef): return [str(x)]
    out = []
    for p in (OWL.unionOf, OWL.intersectionOf):
        for lst in g.objects(x, p):
            for m in Collection(g, lst): out += members(g, m)
    return out

def from_rdf(path, fmt):
    g = Graph(); g.parse(path, format=fmt)
    classes = set()
    for t in (OWL.Class, RDFS.Class):
        for s in g.subjects(RDF.type, t):
            if isinstance(s, URIRef) and str(s) not in SKIP: classes.add(str(s))
    sub, prop = [], []
    for s, o in g.subject_objects(RDFS.subClassOf):
        if isinstance(s, URIRef) and isinstance(o, URIRef) and str(o) not in SKIP and str(s) not in SKIP and s != o:
            sub.append((str(s), str(o))); classes.update([str(s), str(o)])
    for p in set(g.subjects(RDFS.domain, None)) | set(g.subjects(RDFS.range, None)):
        if (p, RDF.type, OWL.DatatypeProperty) in g: continue
        ds = [d for x in g.objects(p, RDFS.domain) for d in members(g, x) if d not in SKIP]
        rs = [r for x in g.objects(p, RDFS.range) for r in members(g, x) if r not in SKIP and 'XMLSchema#' not in r]
        for d in ds:
            for r in rs:
                if d != r: prop.append((d, r)); classes.update([d, r])
    names = sorted(classes)
    idx = {u: i for i, u in enumerate(names)}
    labels = [label_of(g, u) for u in names]
    edges = [[idx[a], idx[b], 2] for a, b in sorted(set(sub))] + [[idx[a], idx[b], 1] for a, b in sorted(set(prop))]
    return labels, edges

def from_obo(path):
    terms, cur = {}, None
    for line in open(path, encoding='utf8'):
        line = line.strip()
        if line.startswith('['): cur = {} if line == '[Term]' else None; continue
        if cur is None or ':' not in line: continue
        k, v = line.split(':', 1); v = v.strip()
        if k == 'id': cur['id'] = v; terms[v] = cur
        elif k == 'name': cur['name'] = v
        elif k == 'is_obsolete' and v == 'true': cur['obs'] = True
        elif k == 'is_a': cur.setdefault('isa', []).append(v.split()[0])
        elif k == 'relationship': cur.setdefault('rel', []).append(v.split()[1])
    live = sorted(t for t, d in terms.items() if not d.get('obs') and 'name' in d)
    idx = {t: i for i, t in enumerate(live)}
    edges = []
    for t in live:
        for p in terms[t].get('isa', []):
            if p in idx: edges.append([idx[t], idx[p], 2])
        for p in terms[t].get('rel', []):
            if p in idx: edges.append([idx[t], idx[p], 1])
    return [terms[t]['name'] for t in live], edges

def from_graphml(path):
    root = ET.parse(path).getroot()
    tag = lambda el: el.tag.rsplit('}', 1)[-1]
    nodes = [n.get('id') for n in root.iter() if tag(n) == 'node']
    idx = {n: i for i, n in enumerate(nodes)}
    edges = [[idx[e.get('source')], idx[e.get('target')], 1] for e in root.iter() if tag(e) == 'edge']
    return ['Node ' + str(i + 1) for i in range(len(nodes))], edges

models = {}
for key, name, fn in [
    ('pb_foaf', 'FOAF', lambda: from_rdf(os.path.join(DL, 'onto/foaf.rdf'), 'xml')),
    ('pb_dcterms', 'Dublin Core terms', lambda: from_rdf(os.path.join(DL, 'onto/dcterms.ttl'), 'turtle')),
    ('pb_time', 'OWL-Time', lambda: from_rdf(os.path.join(DL, 'onto/time.ttl'), 'turtle')),
    ('pb_dcat', 'DCAT 3', lambda: from_rdf(os.path.join(DL, 'onto/dcat3.ttl'), 'turtle')),
    ('pb_bfo', 'BFO 2020', lambda: from_rdf(os.path.join(DL, 'onto/bfo.owl'), 'xml')),
    ('pb_dul', 'DOLCE+DnS Ultralite', lambda: from_rdf(os.path.join(DL, 'onto/dul.owl'), 'turtle')),
    ('pb_saref', 'SAREF core', lambda: from_rdf(os.path.join(DL, 'onto/saref.ttl'), 'turtle')),
    ('pb_gr', 'GoodRelations', lambda: from_rdf(os.path.join(DL, 'onto/gr.owl'), 'xml')),
    ('pb_cl', 'Cell Ontology', lambda: from_obo(os.path.join(DL, 'onto/cl-basic.obo'))),
]:
    labels, edges = fn()
    models[key] = {'name': f'Public: {name} ({len(labels)})', 'labels': labels, 'edges': edges}

# Rome graphs: the first two files (by graph number) for each size from 20 to 100 classes in steps of 10
files = glob.glob(os.path.join(DL, 'rome/x/rome/grafo*.graphml'))
by = {}
for f in files:
    m = re.match(r'grafo(\d+)\.(\d+)\.graphml', os.path.basename(f)); by.setdefault(int(m.group(2)), []).append((int(m.group(1)), f))
for n in range(20, 101, 10):
    for num, f in sorted(by.get(n, []))[:2]:
        labels, edges = from_graphml(f)
        models[f'pb_rome{num}'] = {'name': f'Public: Rome graph {num} ({len(labels)})', 'labels': labels, 'edges': edges}

for k, m in models.items(): print(k, len(m['labels']), 'classes', len(m['edges']), 'links', sum(1 for e in m['edges'] if e[2] == 2), 'subclass')
js = ['// Public benchmark graphs, held out like models5.js: never opened in the layout lab and never used to tune.',
      '// Converted on 2026-11-06 by a script from the Rome graphs (graphdrawing.org: two graphs per size, 20 to 100 nodes, the',
      '// lowest graph numbers) and from published ontologies (FOAF, Dublin Core terms, OWL-Time, DCAT 3, BFO 2020, DOLCE+DnS',
      '// Ultralite, SAREF core, GoodRelations, and the Cell Ontology in OBO form: is_a and relationships between its own terms): named classes; subclass links; a link from domain to range for each object property (unions expanded;',
      '// rdfs:Resource, owl:Thing and literal ranges left out).',
      'const PUBLIC_RAW = ' + json.dumps(models, separators=(',', ':')) + ';',
      'for (const [k, m] of Object.entries(PUBLIC_RAW)) MODELS[k] = { name: m.name, load: async () => ({ labels: m.labels, edges: m.edges.map(([s, t, w]) => ({ s, t, kind: w === 2 ? \'sub\' : \'prop\' })) }) };', '']
open(OUT, 'w', encoding='utf8').write('\n'.join(js))


