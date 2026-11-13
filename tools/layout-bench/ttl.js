/* OntologyTTL: a small Turtle / N-Triples parser plus a builder that turns an
   ontology into the Layout Lab graph shape (class boxes, subclass and relationship links).
   No dependencies; works in the browser (global OntologyTTL) and in Node. */
(function () {
  'use strict';
  const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
  const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
  const OWL = 'http://www.w3.org/2002/07/owl#';
  const XSD = 'http://www.w3.org/2001/XMLSchema#';
  const SKOS = 'http://www.w3.org/2004/02/skos/core#';

  // ---------- IRI resolution (RFC 3986, simplified) ----------
  function resolve(ref, base) {
    if (!base || /^[A-Za-z][\w+.-]*:/.test(ref)) return ref;
    const noFrag = base.replace(/#.*$/, '');
    if (ref === '') return noFrag;
    if (ref[0] === '#') return noFrag + ref;
    const m = /^([A-Za-z][\w+.-]*:)(\/\/[^/?#]*)?([^?#]*)/.exec(base);
    if (!m) return base + ref;
    const scheme = m[1], auth = m[2] || '', path = m[3];
    if (ref.startsWith('//')) return scheme + ref;
    if (ref[0] === '?') return scheme + auth + path + ref;
    let p = ref[0] === '/' ? ref : (auth && !path ? '/' : path.replace(/[^/]*$/, '')) + ref;
    const q = p.search(/[?#]/), tail = q < 0 ? '' : p.slice(q);
    if (q >= 0) p = p.slice(0, q);
    const parts = p.split('/'), out = [];
    parts.forEach((s, k) => {
      const last = k === parts.length - 1;
      if (s === '.') { if (last) out.push(''); }
      else if (s === '..') { if (out.length > 1) out.pop(); if (last) out.push(''); }
      else out.push(s);
    });
    return scheme + auth + out.join('/') + tail;
  }

  // ---------- Parser ----------
  const NAME_CH = /[\w\-.:·À-￿]/;
  const LOCAL_ESC = "_~.-!$&'()*+,;=/?#@%";

  function parse(text) {
    const src = String(text).replace(/^﻿/, '');
    const n = src.length, out = [], bnodeLabels = Object.create(null);
    // Common prefixes are predeclared (as Stardog and other stores do); a file's own declarations win.
    const prefixes = Object.assign(Object.create(null), { rdf: RDF, rdfs: RDFS, owl: OWL, xsd: XSD, skos: SKOS, stardog: 'tag:stardog:api:' });
    let i = 0, base = '', nb = 0;

    function fail(msg) {
      const line = src.slice(0, i).split('\n').length;
      const ls = src.lastIndexOf('\n', i - 1) + 1;
      let le = src.indexOf('\n', i); if (le < 0) le = n;
      const ex = src.slice(Math.max(ls, i - 30), Math.min(le, i + 30)).trim();
      throw new Error(`Turtle syntax error on line ${line}: ${msg}${ex ? ` near "${ex}"` : ''}`);
    }
    function ws() {
      while (i < n) {
        const c = src[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
        else if (c === '#') { while (i < n && src[i] !== '\n') i++; }
        else break;
      }
    }
    function expect(ch) { ws(); if (src[i] !== ch) fail(`expected "${ch}"`); i++; }
    function match(re) { re.lastIndex = i; const m = re.exec(src); if (m) i = re.lastIndex; return m; }
    const fresh = () => `_:b${++nb}`;

    function uchar(len) {
      const h = src.substr(i, len);
      if (!/^[0-9A-Fa-f]+$/.test(h) || h.length !== len) fail('bad \\u escape');
      i += len;
      return String.fromCodePoint(parseInt(h, 16));
    }
    function iriRef() {
      i++; let v = '';
      for (;;) {
        if (i >= n) fail('unterminated IRI');
        const c = src[i];
        if (c === '>') { i++; break; }
        if (c === '\\') { i++; const e = src[i++]; if (e === 'u') v += uchar(4); else if (e === 'U') v += uchar(8); else fail('bad escape in IRI'); continue; }
        if (/[\s<"{}|^`]/.test(c)) fail('illegal character in IRI');
        v += c; i++;
      }
      return resolve(v, base);
    }
    const PREFIX_RE = /([A-Za-zÀ-￿](?:[\w\-.·À-￿]*[\w\-·À-￿])?)?:/y;
    function prefixedName() {
      const start = i, m = match(PREFIX_RE);
      if (!m) fail('expected an IRI, prefixed name or literal');
      const p = m[1] || '';
      if (!(p in prefixes)) { i = start; fail(`undeclared prefix "${p}:"`); }
      let local = '';
      while (i < n) {
        const c = src[i];
        if (c === '\\' && LOCAL_ESC.includes(src[i + 1])) { local += src[i + 1]; i += 2; }
        else if (c === '%' && /^[0-9A-Fa-f]{2}$/.test(src.substr(i + 1, 2))) { local += src.substr(i, 3); i += 3; }
        else if (NAME_CH.test(c)) { local += c; i++; }
        else break;
      }
      while (local.endsWith('.') && src[i - 1] === '.') { local = local.slice(0, -1); i--; }
      return prefixes[p] + local;
    }
    function iri() { ws(); return src[i] === '<' ? iriRef() : prefixedName(); }

    function string() {
      const q = src[i], q3 = q + q + q, long = src.startsWith(q3, i);
      i += long ? 3 : 1;
      let v = '';
      for (;;) {
        if (i >= n) fail('unterminated string');
        const c = src[i];
        if (long && src.startsWith(q3, i)) {
          while (src[i + 3] === q) { v += q; i++; }
          i += 3; break;
        }
        if (!long && c === q) { i++; break; }
        if (!long && (c === '\n' || c === '\r')) fail('line break inside a short string (use """ for multi-line)');
        if (c === '\\') {
          i++; const e = src[i++];
          const simple = { t: '\t', b: '\b', n: '\n', r: '\r', f: '\f', '"': '"', "'": "'", '\\': '\\' }[e];
          if (simple !== undefined) v += simple;
          else if (e === 'u') v += uchar(4);
          else if (e === 'U') v += uchar(8);
          else { i -= 2; fail('bad string escape'); }
          continue;
        }
        v += c; i++;
      }
      let lang = null, datatype = XSD + 'string';
      const lm = match(/@([a-zA-Z]+(?:-[a-zA-Z0-9]+)*)/y);
      if (lm) { lang = lm[1]; datatype = RDF + 'langString'; }
      else if (src.startsWith('^^', i)) { i += 2; datatype = iri(); }
      return { value: v, lang, datatype };
    }
    function collection() {
      i++; const items = [];
      for (;;) {
        ws();
        if (i >= n) fail('unterminated collection');
        if (src[i] === ')') { i++; break; }
        items.push(term(true));
      }
      if (!items.length) return RDF + 'nil';
      const nodes = items.map(fresh);
      items.forEach((it, k) => {
        out.push([nodes[k], RDF + 'first', it]);
        out.push([nodes[k], RDF + 'rest', k + 1 < items.length ? nodes[k + 1] : RDF + 'nil']);
      });
      return nodes[0];
    }
    function term(allowLiteral) {
      ws();
      const c = src[i];
      if (i >= n) fail('unexpected end of input');
      if (c === '<') return iriRef();
      if (c === '_' && src[i + 1] === ':') {
        const m = match(/_:([\wÀ-￿](?:[\w\-.·À-￿]*[\w\-·À-￿])?)/y);
        if (!m) fail('bad blank node label');
        return bnodeLabels[m[1]] || (bnodeLabels[m[1]] = fresh());
      }
      if (c === '[') {
        i++; ws();
        const b = fresh();
        if (src[i] === ']') { i++; return b; }
        predicateObjectList(b); expect(']');
        return b;
      }
      if (c === '(') return collection();
      if (c === '"' || c === "'") { if (!allowLiteral) fail('a literal cannot be a subject'); return string(); }
      if (allowLiteral) {
        const num = match(/[+-]?(?:(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)|(\d*\.\d+)|(\d+))/y);
        if (num) return { value: num[0], lang: null, datatype: XSD + (num[2] ? 'double' : num[3] ? 'decimal' : 'integer') };
        const bool = match(/(true|false)(?![\w\-:·À-￿])/y);
        if (bool) return { value: bool[1], lang: null, datatype: XSD + 'boolean' };
      }
      return prefixedName();
    }
    function verb() {
      ws();
      if (src[i] === 'a' && !NAME_CH.test(src[i + 1] || ' ')) { i++; return RDF + 'type'; }
      if (src[i] !== '<' && !PREFIX_RE.test((PREFIX_RE.lastIndex = i, src))) fail('expected a predicate');
      return iri();
    }
    function predicateObjectList(s) {
      for (;;) {
        const p = verb();
        for (;;) {
          out.push([s, p, term(true)]);
          ws();
          if (src[i] === ',') { i++; continue; }
          break;
        }
        if (src[i] !== ';') return;
        while (src[i] === ';') { i++; ws(); }
        if (src[i] === '.' || src[i] === ']' || i >= n) return;
      }
    }
    function directive() {
      if (match(/@prefix(?=[\s:])/y) || match(/PREFIX(?=[\s])/iy)) {
        const dotted = src[i - 7] === '@';
        ws();
        const m = match(PREFIX_RE);
        if (!m) fail('expected a prefix name ending in ":"');
        ws(); if (src[i] !== '<') fail('expected <IRI> after prefix');
        prefixes[m[1] || ''] = iriRef();
        if (dotted) expect('.');
        return true;
      }
      if (match(/@base(?=[\s<])/y) || match(/BASE(?=[\s<])/iy)) {
        const dotted = src[i - 5] === '@';
        ws(); if (src[i] !== '<') fail('expected <IRI> after base');
        base = iriRef();
        if (dotted) expect('.');
        return true;
      }
      return false;
    }

    for (ws(); i < n; ws()) {
      if (directive()) continue;
      const bracketed = src[i] === '[';
      const s = term(false);
      ws();
      if (bracketed && src[i] === '.') { i++; continue; }
      predicateObjectList(s);
      expect('.');
    }
    return out;
  }

  // ---------- Graph builder ----------
  function toGraph(triples, opts) {
    opts = Object.assign({ lang: 'en', keepThing: false, restrictions: true }, opts);
    const idx = new Map();
    for (const [s, p, o] of triples) {
      let m = idx.get(s); if (!m) idx.set(s, m = new Map());
      let a = m.get(p); if (!a) m.set(p, a = []);
      a.push(o);
    }
    const objs = (s, p) => (idx.get(s) && idx.get(s).get(p)) || [];
    const isIri = x => typeof x === 'string' && !x.startsWith('_:');
    const isBnode = x => typeof x === 'string' && x.startsWith('_:');
    const types = x => new Set(objs(x, RDF + 'type'));
    const isDatatype = x => x.startsWith(XSD) || x.startsWith(RDF) || x.startsWith(RDFS) || types(x).has(RDFS + 'Datatype');

    function listItems(node) {
      const items = [], seen = new Set();
      while (isBnode(node) && !seen.has(node)) {
        seen.add(node);
        items.push(...objs(node, RDF + 'first'));
        node = objs(node, RDF + 'rest')[0];
      }
      return items;
    }
    // Named classes a domain/range/restriction value stands for (unions expanded).
    function classTargets(x) {
      if (isIri(x)) return isDatatype(x) ? [] : [x];
      if (isBnode(x)) return objs(x, OWL + 'unionOf').flatMap(listItems).filter(y => isIri(y) && !isDatatype(y));
      return [];
    }

    const cls = new Set();
    // schema.org domainIncludes/rangeIncludes (used by Stardog Designer models) count as domain/range.
    const DOM = [RDFS + 'domain', 'http://schema.org/domainIncludes', 'https://schema.org/domainIncludes'];
    const RNG = [RDFS + 'range', 'http://schema.org/rangeIncludes', 'https://schema.org/rangeIncludes'];
    const SUB = RDFS + 'subClassOf';
    const objsOf = (s, ps) => ps.flatMap(p => objs(s, p));
    for (const [s, p, o] of triples) {
      if (p === RDF + 'type' && (o === OWL + 'Class' || o === RDFS + 'Class') && isIri(s)) cls.add(s);
      else if (p === SUB) { if (isIri(s)) cls.add(s); if (isIri(o)) cls.add(o); }
      else if (DOM.includes(p) || RNG.includes(p)) classTargets(o).forEach(c => cls.add(c));
    }
    if (!opts.keepThing) cls.delete(OWL + 'Thing');

    function pick(lits) {
      lits = lits.filter(l => l && typeof l === 'object');
      if (!lits.length) return null;
      const want = String(opts.lang || '').toLowerCase(), lg = l => (l.lang || '').toLowerCase();
      const l = (want && (lits.find(l => lg(l) === want) || lits.find(l => lg(l).startsWith(want + '-'))))
        || lits.find(l => !l.lang) || lits[0];
      return l.value.trim();
    }
    function localName(x) {
      const t = x.replace(/[#/]+$/, ''), m = /[^#/]*$/.exec(t);
      return (m && m[0]) || x;
    }
    const label = x => pick(objs(x, RDFS + 'label')) || pick(objs(x, SKOS + 'prefLabel')) || localName(x);

    const iris = [...cls], at = new Map(iris.map((c, k) => [c, k]));
    const labels = iris.map(label);
    const edges = [], seen = new Set();
    let skipped = 0;
    function addEdge(s, t, kind, name) {
      if (!at.has(s) || !at.has(t)) return false;
      const e = { s: at.get(s), t: at.get(t), kind, name };
      const key = `${e.s}|${e.t}|${kind}|${name}`;
      if (!seen.has(key)) { seen.add(key); edges.push(e); }
      return true;
    }

    // Subclass links, and relationship links from someValuesFrom/allValuesFrom restrictions.
    for (const [s, p, o] of triples) {
      if (p !== SUB) continue;
      if (!isIri(s)) { skipped++; continue; }
      if (isIri(o)) { addEdge(s, o, 'sub', ''); continue; }
      let drawn = false;
      if (opts.restrictions && isBnode(o) && types(o).has(OWL + 'Restriction')) {
        const prop = objs(o, OWL + 'onProperty').find(isIri);
        const targets = [...objs(o, OWL + 'someValuesFrom'), ...objs(o, OWL + 'allValuesFrom')].flatMap(classTargets);
        if (prop) for (const t of targets) if (addEdge(s, t, 'rel', label(prop))) drawn = true;
      }
      if (!drawn) skipped++;
    }

    // Relationship links from property domain/range.
    const props = new Set();
    for (const [s, p, o] of triples) {
      if (!isIri(s)) continue;
      if (DOM.includes(p) || RNG.includes(p) || (p === RDF + 'type' && o === OWL + 'ObjectProperty')) props.add(s);
    }
    for (const p of props) {
      const ty = types(p);
      if (ty.has(OWL + 'DatatypeProperty') || ty.has(OWL + 'AnnotationProperty')) continue;
      const rng = objsOf(p, RNG);
      if (rng.length && rng.every(r => isIri(r) && isDatatype(r))) continue;
      const doms = objsOf(p, DOM).flatMap(classTargets).filter(c => at.has(c));
      const rngs = rng.flatMap(classTargets).filter(c => at.has(c));
      if (!doms.length || !rngs.length) { skipped++; continue; }
      const name = label(p);
      for (const d of doms) for (const r of rngs) addEdge(d, r, 'rel', name);
    }

    const count = k => edges.filter(e => e.kind === k).length;
    return {
      labels, iris, edges,
      stats: { classes: labels.length, subclassLinks: count('sub'), relationshipLinks: count('rel'), skipped }
    };
  }

  const OntologyTTL = { parse, toGraph, load: (text, opts) => toGraph(parse(text), opts) };
  if (typeof module !== 'undefined' && module.exports) module.exports = OntologyTTL;
  if (typeof globalThis !== 'undefined') globalThis.OntologyTTL = OntologyTTL;
})();
