// Types for dist/ontology-layouts.js and dist/ontology-layouts.mjs. Written by hand; see docs/DEVELOPER-GUIDE.md.

/** A point in the drawing's coordinates (px; y grows downward). */
export interface Point { x: number; y: number; }

/**
 * What the layout must keep clear for one class: the bounding box of everything you draw for it (shape, icon, label),
 * centered on the point where its links meet it. Draw the class centered on the position you get back.
 */
export interface Box {
  w: number;
  h: number;
  /** Where paths end: on the box (default), or on a circle or ellipse drawn inside it. The layout still keeps the whole box clear. */
  shape?: 'box' | 'circle' | 'ellipse';
  /** Radius of the circle when shape is 'circle' (default: half the smaller side). */
  r?: number;
  /** A relationship drawn as a class (reification): keep it on the line between these two classes. */
  between?: [number, number];
}

/** [source, target, kind, nameWidth?]. kind 2: source is a subclass of target; 1: any other link. nameWidth: px reserved for the link's name. */
export type Link = [number, number, 1 | 2, number?];

export interface RouteOptions {
  /** Bend links round classes they would run through (default true). */
  bends?: boolean;
  /** Also bend a link when that removes crossings (default true). */
  crossBends?: boolean;
  /** No bends round classes; parallel links stay arcs and self-links loops (default false). */
  straight?: boolean;
  /** Repeated and reciprocal links between two classes as arcs side by side (default true); false: parallel straight lines. */
  arcs?: boolean;
  /** Spacing of parallel links in px (default 24). */
  sep?: number;
  /** Spread link ends along the sides of classes with at least this many links (default 3; 0 = off, best for circles: ends then meet the center). */
  ports?: number;
  /** Place link names (default true; needs nameWidth on the links). */
  labels?: boolean;
  /** Names may go beside their link when they would cover something on it (default true). */
  labelSide?: boolean;
  /** Push a class off a link that still runs through it (default true). false keeps every class where it is. */
  settle?: boolean;
  /** Margin in px a link keeps from classes it passes (default 9). */
  pad?: number;
}

export interface Route {
  /** Bends as (t along the straight line, d to the side), drawn as a smooth curve through them. */
  bends: { t: number; d: number }[];
  /** Offsets of the two link ends from the class centers, or null. */
  ports: [Point | null, Point | null] | null;
  /** A self-link's loop, as points relative to the class center, or null. */
  loop: Point[] | null;
  /** Where to draw the link's name (center and size), when names are placed. */
  label?: { x: number; y: number; w: number; h: number } | null;
}

export interface Path {
  /** From the start class's border to the end class's border (or arrowhead base), as a polyline. */
  points: Point[];
  /** Where an arrowhead's point touches the end class. */
  tip: Point;
  /** The arrowhead's direction in radians. */
  angle: number;
}

export interface DrawOptions {
  /**
   * Which layout places the classes. 'auto' (default): Best Read, the more readable of Tidy Stress and Mycelium.
   * 'compact': Tidy Stress. 'grouped': Mycelium (falls back to Tidy Stress under 8 classes). 'tree': every subclass below
   * its superclass. 'given': your positions (start), then the clean-up and the routing.
   */
  layout?: 'auto' | 'compact' | 'grouped' | 'tree' | 'given';
  /** Positions from your own layout, one per box; implies layout 'given'. */
  start?: Point[];
  /** Run the clean-up after the layout (default true). */
  cleanUp?: boolean;
  /** Work limit for this call in ms of the reference laptop (default: setTimeLimit's, 1000). Same input and limit: same drawing anywhere. */
  timeLimit?: number;
  /** Random seed (default 1). */
  seed?: number;
  /** About 30% more room between classes. */
  roomy?: boolean;
  /** Stop paths this many px short of the end class for an arrowhead (default 0). */
  arrow?: number;
  /** Options for the link routing. */
  route?: RouteOptions;
  /** An earlier drawing's positions (null for each new class): new classes are placed round the old ones. */
  keep?: (Point | null)[];
  /** With keep: no old class moves at all (no clean-up; the routing moves no class). */
  exact?: boolean;
}

export interface Drawing {
  /** Where to draw each class (final: the routing may have moved a class off a link). */
  pos: Point[];
  routes: Route[];
  /** One path per link, ready to draw. */
  paths: Path[];
  /** A group number per class (closely linked classes), for hulls or background areas. */
  groups: number[];
  /** Which layout drew it: 'compact', 'grouped', 'tree', 'given', 'keep' or 'single'. */
  algo: string;
}

export interface Measures {
  cross: number; thru: number; sharp: number; labelOver: number; labelCrossed: number; bends: number; area: number; [k: string]: number;
}

export interface OntologyLayouts {
  /** Everything in one call: layout, clean-up, link routing, paths and groups. */
  draw(boxes: Box[], links: Link[], opts?: DrawOptions): Drawing;
  /** Classes with a position in keep stay; each null is placed round the classes it links to. */
  placeNew(keep: (Point | null)[], boxes: Box[], links: Link[]): Point[];
  /** Boxes with between: [a, b] onto the line from a to b. */
  inline(pos: Point[], boxes: Box[], links: Link[]): Point[];
  bestRead(boxes: Box[], links: Link[], opts?: { seed?: number; roomy?: boolean }): { pos: Point[]; algo: string };
  tidyStress(boxes: Box[], links: Link[], opts?: { seed?: number; roomy?: boolean }): { pos: Point[]; algo: string };
  /** null under 8 classes. */
  mycelium(boxes: Box[], links: Link[], opts?: { seed?: number; roomy?: boolean }): { pos: Point[]; algo: string } | null;
  /** startedAt: now() read before your layout ran (the clean-up gets what is left of the limit, at most a third of it). topDown: keep subclasses below. */
  cleanUp(pos: Point[], boxes: Box[], links: Link[], startedAt: number, topDown?: boolean): Point[];
  routeLinks(pos: Point[], boxes: Box[], links: Link[], opts?: RouteOptions): { routes: Route[]; pos: Point[]; stats: Record<string, unknown> };
  routePaths(pos: Point[], boxes: Box[], links: Link[], routes: Route[] | null, opts?: { arrow?: number; samples?: number }): Path[];
  groups(n: number, links: Link[]): number[];
  routeMetrics(pos: Point[], boxes: Box[], links: Link[], routes: Route[] | null, pad?: number): Measures;
  metrics(pos: Point[], boxes: Box[], links: { s: number; t: number }[]): Record<string, number>;
  score(metrics: Record<string, number>): number;
  /** Sets the default work limit (ms of the reference laptop) and returns the previous one. */
  setTimeLimit(ms: number): number;
  /** ms on the work clock. */
  now(): number;
}

declare const OntologyLayouts: OntologyLayouts;
export default OntologyLayouts;
export const draw: OntologyLayouts['draw'];
export const placeNew: OntologyLayouts['placeNew'];
export const inline: OntologyLayouts['inline'];
export const bestRead: OntologyLayouts['bestRead'];
export const tidyStress: OntologyLayouts['tidyStress'];
export const mycelium: OntologyLayouts['mycelium'];
export const cleanUp: OntologyLayouts['cleanUp'];
export const routeLinks: OntologyLayouts['routeLinks'];
export const routePaths: OntologyLayouts['routePaths'];
export const groups: OntologyLayouts['groups'];
export const routeMetrics: OntologyLayouts['routeMetrics'];
export const metrics: OntologyLayouts['metrics'];
export const score: OntologyLayouts['score'];
export const setTimeLimit: OntologyLayouts['setTimeLimit'];
export const now: OntologyLayouts['now'];
