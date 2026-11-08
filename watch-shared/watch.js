// The robotic mechanical watch, built from code against "Futuristic White and Green Skeleton Watch.png".
//
// Frame: the wrist axis is X. The bracelet is a closed elliptical loop in the YZ plane (centre at y = G.Y0), the case
// sits on top of it with the dial facing +Y; the loop is a long oval reaching down behind the case. 12 o'clock points to -Z, 3 o'clock (the crowns) to +X, so the dial reads
// clockwise from above.
//
// Every part that comes apart is its own group with a named anchor (crystal, bezel, dial, hands, train, escapement,
// barrel, caseFlankR/L, lugs, crown, crown2, links[i], clasp, rotor). pose(state) sets the whole watch for one moment from
// state alone: the mechanism runs off state.t (a pure function of time), the teardown off state.open / state.explode.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {rng} from 'cutaway-kit/util.js';
import {coil, gearGeo, put, rbox, ring, tube} from './parts.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const D2R = Math.PI / 180;

// ------------------------------------------------------------------ proportions (dial radius = 1)
export const G = {
  RY: 2.3, // loop centreline half-height: a long oval reaching away behind the dial, as in the picture
  Y0: -0.8, // the loop's centre sits this far below the origin, so its crown stays at y = 1.5 under the case
  RZ: 1.74, // loop centreline half-depth
  T: 0.4, // band thickness (radial)
  W: 1.72, // band width (across the wrist, X)
  CA: 1.36, // cushion case half-width (X)
  CB: 1.3, // cushion case half-length (Z)
  YD: 2.5, // dial plane
  YB: 1.46, // case drum bottom
  R_DIAL: 1.0,
  R_BEZ: 1.17,
  TH_C: 0.9, // loop angle where the case's lugs meet the first link
};

// ------------------------------------------------------------------ materials
export function makeMaterials() {
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    shell: phys({color: '#f4f4f1', roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.035}),
    shellIn: phys({color: '#dcdcd8', roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.3}),
    green: phys({color: '#33b81f', roughness: 0.2, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.04, emissive: '#0d4a06', emissiveIntensity: 0.6}),
    greenGlow: phys({color: '#3ccf22', roughness: 0.15, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#2aa616', emissiveIntensity: 1.3}),
    lume: std({color: '#c8f5b4', emissive: '#58e03a', emissiveIntensity: 0.9, roughness: 0.4}),
    graphite: std({color: '#2a2d32', roughness: 0.34, metalness: 0.8}),
    gunmetal: std({color: '#4b5058', roughness: 0.24, metalness: 0.95}),
    black: phys({color: '#0c0d0f', roughness: 0.28, metalness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.1}),
    matteBlack: std({color: '#121315', roughness: 0.6, metalness: 0.3}),
    // the movement's floor: a deep black that barely takes the studio's reflections, so the dial reads dark like the picture
    void: std({color: '#060708', roughness: 0.85, metalness: 0.1, envMapIntensity: 0.15}),
    steel: std({color: '#d4d7dc', roughness: 0.16, metalness: 1}),
    brushed: std({color: '#b9bdc3', roughness: 0.32, metalness: 1}),
    brass: std({color: '#b09858', roughness: 0.26, metalness: 1}),
    ruby: phys({color: '#8e1235', roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, emissive: '#2a0410', emissiveIntensity: 0.4}),
    // the crown's black dome: the stage gives `lens` its dark studio
    lens: phys({color: '#020203', roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4}),
    // clear glass: thin, low haze — the movement under it must stay dark (the reference reads black through the crystal)
    glass: phys({color: '#ffffff', roughness: 0.0, metalness: 0, transmission: 1, thickness: 0.02, ior: 1.5, specularIntensity: 0.35, envMapIntensity: 0.35}),
    sapphire: phys({color: '#fbfdff', roughness: 0.0, metalness: 0, transmission: 1, thickness: 0.05, ior: 1.77, specularIntensity: 0.25, clearcoat: 0, envMapIntensity: 0.18}),
    jade: phys({color: '#e9f3e6', roughness: 0.42, metalness: 0, transmission: 0.82, thickness: 0.12, ior: 1.45, attenuationColor: '#b8deac', attenuationDistance: 0.35, clearcoat: 1, clearcoatRoughness: 0.04}),
    vein: std({color: '#9fcf8c', roughness: 0.4, metalness: 0, transparent: true, opacity: 0.8}),
  };
}

// ------------------------------------------------------------------ geometry helpers
const GEO = new Map();
const cached = (key, make) => {
  if (!GEO.has(key)) GEO.set(key, make());
  return GEO.get(key);
};
// a ring around +Y (the dial axis): y0..y1 tall, r0..r1 deep; optionally an arc from dial angle p0 to p1 (0 = 12 o'clock,
// clockwise seen from above)
function ringY(y0, y1, r0, r1, round = 0.01, p0 = null, p1 = null, segs = 96) {
  const opts = {segs};
  if (p0 !== null) Object.assign(opts, {a0: -p1 - Math.PI / 2, a1: -p0 - Math.PI / 2});
  return ring(y0, y1, r0, r1, round, opts).rotateZ(Math.PI / 2);
}
const dirAt = (p) => new V3(Math.sin(p), 0, -Math.cos(p)); // dial angle to an XZ direction
const cylY = (r0, r1, h, seg = 32) => new THREE.CylinderGeometry(r1, r0, h, seg);
const cylXg = (r, len, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(-Math.PI / 2);
const cylZg = (r, len, seg = 24) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
// a gear lying flat (axis +Y)
const gearY = (teeth, rOut, rRoot, w, hole = 0, spokes = 0) =>
  cached(`g${teeth}_${rOut}_${rRoot}_${w}_${hole}_${spokes}`, () => gearGeo(teeth, rOut, rRoot, w, hole, spokes).rotateX(-Math.PI / 2));
// a gear on +X (crown wheels, knurls)
const gearXg = (teeth, rOut, rRoot, w, hole = 0, spokes = 0) =>
  cached(`gx${teeth}_${rOut}_${rRoot}_${w}_${hole}_${spokes}`, () => gearGeo(teeth, rOut, rRoot, w, hole, spokes).rotateY(Math.PI / 2));

/** Sweep a rounded rectangle (w across `side`, h across the normal) along points. w and h may be functions of u. */
function sweepRect(points, side, w, h, r = 0.03, segs = 48, steps = 3, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new V3(...p))), closed, 'catmullrom', 0.5);
  const W = typeof w === 'function' ? w : () => w;
  const H = typeof h === 'function' ? h : () => h;
  const sideV = side.isVector3 ? side : new V3(...side);
  // profile corners (unit normals per point), CCW
  const prof = [];
  const corner = (cx, cy, a0) => {
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (k / steps) * (Math.PI / 2);
      prof.push({cx, cy, nx: Math.cos(a), ny: Math.sin(a)});
    }
  };
  corner(1, -1, -Math.PI / 2);
  corner(1, 1, 0);
  corner(-1, 1, Math.PI / 2);
  corner(-1, -1, Math.PI);
  const np = prof.length;
  const pos = [];
  const nor = [];
  const idx = [];
  const frames = [];
  const rings = closed ? segs : segs + 1;
  for (let i = 0; i < rings; i++) {
    const u = i / segs;
    const P = curve.getPointAt(u);
    const T = curve.getTangentAt(u);
    const S = sideV.clone().addScaledVector(T, -sideV.dot(T)).normalize();
    const N = new V3().crossVectors(T, S);
    const w2 = W(u) / 2;
    const h2 = H(u) / 2;
    const rr = Math.min(r, w2 * 0.98, h2 * 0.98);
    frames.push({P, T, S, N});
    for (const q of prof) {
      const a = q.cx * (w2 - rr) + q.nx * rr;
      const b = q.cy * (h2 - rr) + q.ny * rr;
      pos.push(P.x + S.x * a + N.x * b, P.y + S.y * a + N.y * b, P.z + S.z * a + N.z * b);
      nor.push(S.x * q.nx + N.x * q.ny, S.y * q.nx + N.y * q.ny, S.z * q.nx + N.z * q.ny);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < np; j++) {
      const a = i * np + j;
      const b = i * np + ((j + 1) % np);
      const i1 = (i + 1) % rings;
      const c = i1 * np + j;
      const d = i1 * np + ((j + 1) % np);
      idx.push(a, b, d, a, d, c);
    }
  }
  // caps
  for (const [i, sgn] of closed ? [] : [[0, -1], [segs, 1]]) {
    const {P, T} = frames[i];
    const c0 = pos.length / 3;
    pos.push(P.x, P.y, P.z);
    nor.push(T.x * sgn, T.y * sgn, T.z * sgn);
    const base = pos.length / 3;
    for (let j = 0; j < np; j++) {
      const k = (i * np + j) * 3;
      pos.push(pos[k], pos[k + 1], pos[k + 2]);
      nor.push(T.x * sgn, T.y * sgn, T.z * sgn);
    }
    for (let j = 0; j < np; j++) {
      const a = base + j;
      const b = base + ((j + 1) % np);
      if (sgn > 0) idx.push(c0, a, b);
      else idx.push(c0, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

// a flat bar between two points in a plane at height y (XZ), w wide, h thick: bridges, arms, links
function barXZ(a, b, y, w, h, r = 0.012) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const g = rbox(len, h, w, r);
  g.rotateY(-Math.atan2(dz, dx));
  g.translate((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
  return g;
}

// ------------------------------------------------------------------ the loop
const loopP = (th) => new V3(0, G.Y0 + G.RY * Math.cos(th), G.RZ * Math.sin(th));
const loopT = (th) => new V3(0, -G.RY * Math.sin(th), G.RZ * Math.cos(th)).normalize();
const loopN = (th) => new V3(0, Math.cos(th) / G.RY, Math.sin(th) / G.RZ).normalize();
// the frame of the band at loop angle th: X across, N outward, T along
function loopFrame(th) {
  const m = new THREE.Matrix4();
  m.makeBasis(new V3(1, 0, 0), loopN(th), loopT(th));
  m.setPosition(loopP(th));
  return m;
}
// loop angle -> arc length table (for even link pitch)
function arcTable(n = 2000) {
  const th = [];
  const s = [0];
  let prev = loopP(0);
  th.push(0);
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * TAU;
    const p = loopP(t);
    s.push(s[i - 1] + p.distanceTo(prev));
    th.push(t);
    prev = p;
  }
  const at = (len) => {
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid] < len) lo = mid;
      else hi = mid;
    }
    const k = (len - s[lo]) / (s[hi] - s[lo] || 1);
    return th[lo] + (th[hi] - th[lo]) * k;
  };
  const len = (t) => s[Math.round((t / TAU) * n)];
  return {at, len, total: s[n]};
}

// ==================================================================== the build
export function buildWatch() {
  const M = makeMaterials();
  const R = rng(20261108);
  const rr = (a, b) => a + (b - a) * R();
  const root = new THREE.Group();
  root.name = 'watch';
  const clear = [];
  const anchors = {};
  const parts = {}; // name -> {g, rest: Vector3, dir: Vector3} for the explode
  let small = 0; // a count of the small parts, for the record
  const part = (name, parent, dir = [0, 0, 0], anchor = [0, 0, 0]) => {
    const g = new THREE.Group();
    g.name = name;
    parent.add(g);
    parts[name] = {g, rest: new V3(), dir: new V3(...dir)};
    const a = new THREE.Object3D();
    a.position.set(...anchor);
    g.add(a);
    anchors[name] = {obj: a, at: new V3()};
    return g;
  };
  const mesh = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = put(parent, geo, mat, x, y, z);
    if (mat === M.glass || mat === M.sapphire || mat === M.jade) {
      m.castShadow = false;
      clear.push(m);
    }
    return m;
  };

  // ---------------------------------------------------- small parts: screws, pins, jewels, bearings
  const screwHead = cached('screwHead', () => {
    const p = [];
    const s = 16;
    for (let i = 0; i <= s; i++) {
      const a = (i / s) * (Math.PI / 2);
      p.push(new THREE.Vector2(Math.cos(a) * 1, Math.sin(a) * 0.55));
    }
    p.unshift(new THREE.Vector2(0, 0), new THREE.Vector2(1, 0));
    return new THREE.LatheGeometry(p.reverse().map((v) => new THREE.Vector2(v.x, v.y)), 20);
  });
  const slotGeo = cached('slot', () => new THREE.BoxGeometry(1.7, 0.5, 0.28));
  /** A slotted screw head on a surface: position p, surface normal n, head radius r. */
  const screw = (parent, p, n, r = 0.03, mat = M.gunmetal, slotA = null) => {
    const g = new THREE.Group();
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(new V3(0, 1, 0), n.clone().normalize());
    g.rotateY(slotA ?? R() * Math.PI);
    g.scale.setScalar(r);
    const h = put(g, screwHead, mat);
    h.castShadow = false;
    const s = put(g, slotGeo, M.matteBlack, 0, 0.42, 0);
    s.castShadow = false;
    parent.add(g);
    small++;
    return g;
  };
  /** A jewel bearing: steel chaton ring with a ruby. */
  const jewel = (parent, x, y, z, r = 0.035) => {
    mesh(parent, cached(`chaton${r}`, () => cylY(r, r, 0.018, 24)), M.steel, x, y, z);
    mesh(parent, cached(`ruby${r}`, () => new THREE.SphereGeometry(r * 0.55, 16, 8, 0, TAU, 0, Math.PI / 2)), M.ruby, x, y + 0.009, z);
    small++;
  };
  /** A pin through a plate along an axis: head + green-free shaft end. */
  const pinHead = (parent, p, n, r = 0.032) => {
    const g = new THREE.Group();
    g.position.copy(p);
    g.quaternion.setFromUnitVectors(new V3(0, 1, 0), n.clone().normalize());
    put(g, cached(`pin${r}`, () => cylY(r, r * 0.85, r * 0.9, 16)), M.black, 0, r * 0.45, 0);
    put(g, cached(`pinb${r}`, () => cylY(r * 0.45, r * 0.45, r * 0.5, 12)), M.steel, 0, r, 0);
    parent.add(g);
    small++;
    return g;
  };

  // =============================================================== CASE (sits on the loop's crown)
  const C = new V3(0, G.YD, 0);
  const watchCase = part('case', root);

  // ---- the case: a white cushion frame (a top deck, a bottom rail, vertical bands in 3 widths) holding clear sapphire
  // walls over a packed ring of mechanism; the round bezel sits on the deck
  const CA = G.CA;
  const CB = G.CB;
  const CN = 3.4;
  const cush = (u, k = 1, y = 0) => {
    const c = Math.cos(u);
    const s = Math.sin(u);
    return new V3(k * CA * Math.sign(c) * Math.abs(c) ** (2 / CN), y, k * CB * Math.sign(s) * Math.abs(s) ** (2 / CN));
  };
  const cushT = (u) => cush(u + 0.005).sub(cush(u - 0.005)).normalize();
  const cushN = (u) => {
    const t = cushT(u);
    return new V3(t.z, 0, -t.x);
  };
  const cushLoop = (k, y, n = 120) => Array.from({length: n}, (_, i) => cush((i / n) * TAU, k, y));
  const cushShape = (k, holeR = 0) => {
    const sh = new THREE.Shape(cushLoop(k, 0, 160).map((p) => new THREE.Vector2(p.x, -p.z)));
    if (holeR) {
      const h = new THREE.Path();
      h.absarc(0, 0, holeR, 0, TAU, true);
      sh.holes.push(h);
    }
    return sh;
  };
  const slab = (k, y0, h, holeR, bevel = 0.03) =>
    new THREE.ExtrudeGeometry(cushShape(k, holeR), {depth: h - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 48})
      .rotateX(-Math.PI / 2)
      .translate(0, y0 + bevel, 0);
  const drum = part('drum', watchCase, [0, 0, 0]);
  const yTop = G.YD - 0.17;
  const yBot = G.YB + 0.02;
  // the dark core and the movement container
  // (hollow: the movement lives inside it, down to the main plate)
  mesh(drum, slab(0.86, yBot, yTop - yBot, 1.0, 0.05), M.matteBlack);
  mesh(drum, ringY(yBot, yTop, 0.99, 1.03, 0.01), M.graphite);
  mesh(drum, cylY(1.0, 1.0, 0.04, 72), M.void, 0, G.YD - 0.72, 0);
  // the deck under the bezel, and its hairline green step
  // the deck is 6 white plates in 3 sizes with dark gaps between them over the black core
  {
    const GAP = 0.07;
    const cuts = [-0.42, 0.42, Math.PI / 2, Math.PI - 0.62, Math.PI + 0.62, 1.5 * Math.PI];
    const cs = [...cuts].sort((a, b) => a - b);
    for (let k = 0; k < cs.length; k++) {
      const u0 = cs[k] + GAP / 2;
      const u1 = (k + 1 < cs.length ? cs[k + 1] : cs[0] + TAU) - GAP / 2;
      const outer = [];
      for (let i = 0; i <= 40; i++) outer.push(cush(u0 + ((u1 - u0) * i) / 40, 1, 0));
      const sh = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, -p.z)));
      for (let i = 40; i >= 0; i--) {
        const p = outer[i];
        const a = Math.atan2(-p.z, p.x);
        sh.lineTo(Math.cos(a) * 0.97, Math.sin(a) * 0.97);
      }
      const b = 0.04;
      mesh(drum, new THREE.ExtrudeGeometry(sh, {depth: 0.17 - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: 0.02, bevelSegments: 3, curveSegments: 24}).rotateX(-Math.PI / 2).translate(0, yTop + b, 0), M.shell);
    }
    // the floor of each gap: graphite with a screw, so it reads as a joint over the mechanism
    mesh(drum, slab(0.995, yTop - 0.03, 0.06, 0.97, 0.01), M.graphite);
    for (const u of cuts) {
      const p = cush(u, 0.985, yTop + 0.03);
      screw(drum, p, new V3(0, 1, 0), 0.026, M.steel);
    }
  }
  mesh(drum, sweepRect(cushLoop(1.005, yTop + 0.005), new V3(0, 1, 0), 0.022, 0.022, 0.008, 160, 2, true), M.green);
  // the bottom rail
  mesh(drum, sweepRect(cushLoop(0.985, yBot + 0.06), new V3(0, 1, 0), 0.13, 0.16, 0.04, 160, 3, true), M.shell);
  // the sapphire wall
  mesh(drum, sweepRect(cushLoop(0.975, (yTop + yBot) / 2 + 0.02), new V3(0, 1, 0), yTop - yBot - 0.08, 0.012, 0.004, 160, 1, true), M.glass);
  // bands: 3 widths, bulging a touch, skipping the crowns
  const BANDS = [[-2.95, 0.3], [-2.45, 0.1], [-2.0, 0.18], [-1.57, 0.3], [-1.12, 0.1], [-0.78, 0.18], [-0.24, 0.08], [0.48, 0.18], [0.86, 0.1], [1.2, 0.3], [1.62, 0.1], [2.0, 0.18], [2.45, 0.1], [2.9, 0.18]];
  for (const [u, w] of BANDS) {
    const pts = [cush(u, 1.0, yBot + 0.05), cush(u, 1.035, (yTop + yBot) / 2), cush(u, 1.005, yTop + 0.02)];
    mesh(drum, sweepRect(pts, cushT(u), w, 0.09, 0.03, 12), M.shell);
    const n = cushN(u);
    for (const y of [yTop - 0.09, yBot + 0.14]) screw(drum, cush(u, 1.0, y).addScaledVector(n, w > 0.12 ? 0.06 : 0.055), n, w > 0.12 ? 0.03 : 0.024);
  }
  // the mechanism ring behind the sapphire: rods along each flat side, vertical drive cylinders and coils in the corners,
  // a wall of gears facing out
  {
    const ySpan = [yBot + 0.14, yTop - 0.1];
    // the big chrome pistons along both flanks (the picture's strongest mechanism): 3 per side in 3 sizes, in the bands
    // between the crown stems (y = YD-0.66, YD-0.42), each a chrome body, a black sleeve, a rod, rings and a clevis
    for (const sgn of [1, -1]) {
      const x = sgn * (CA - 0.12);
      [[1.7, 0.07, 1.15, 0.1], [1.96, 0.055, 0.95, -0.15], [2.19, 0.048, 1.05, 0.05]].forEach(([y, r, len, off], j) => {
        const z0 = off * sgn;
        mesh(drum, cylZg(r, len, 28), M.steel, x, y, z0);
        mesh(drum, cylZg(r * 1.22, len * 0.32, 28), M.black, x, y, z0 - sgn * len * 0.3);
        mesh(drum, cylZg(r * 0.42, 0.42, 16), M.brushed, x, y, z0 + sgn * (len / 2 + 0.17));
        mesh(drum, rbox(r * 1.6, r * 2.1, 0.07, 0.01), M.gunmetal, x, y, z0 + sgn * (len / 2 + 0.4));
        for (const f of [-0.1, 0.12, 0.3]) mesh(drum, cached(`prng${r}`, () => new THREE.TorusGeometry(r * 1.02, 0.007, 8, 28)), M.gunmetal, x, y, z0 + sgn * f * len);
        small += 5;
      });
    }
    for (const [ax, sgn] of [['x', 1], ['x', -1], ['z', 1], ['z', -1]]) {
      const nR = ax === 'x' ? 0 : 6; // the x flanks carry the pistons instead
      for (let i = 0; i < nR; i++) {
        const y = ySpan[0] + ((ySpan[1] - ySpan[0]) * (i + 0.2 + R() * 0.6)) / nR;
        const r = rr(0.026, 0.062);
        const len = rr(0.9, 1.7);
        const off = rr(-0.2, 0.2);
        const depth = (ax === 'x' ? CA : CB) - 0.14 + rr(-0.04, 0.05);
        const mat = [M.gunmetal, M.graphite, M.black, M.steel, M.graphite][i % 5];
        const pos = ax === 'x' ? [sgn * depth, y, off] : [off, y, sgn * depth];
        const g = ax === 'x' ? cylZg(r, len, 20) : cylXg(r, len, 20);
        mesh(drum, g, mat, ...pos);
        small++;
        if (i % 2 === 0) {
          const sl = rr(0.25, 0.5);
          const o = rr(-0.35, 0.35);
          mesh(drum, ax === 'x' ? cylZg(r * 1.5, sl, 22) : cylXg(r * 1.5, sl, 22), M.black, ...(ax === 'x' ? [pos[0], y, off + o] : [off + o, y, pos[2]]));
          small++;
        }
        if (i % 3 === 1) {
          const cg = coil(r * 1.45, 0.007, 9, 0.34, 160);
          const cm = mesh(drum, ax === 'x' ? cg.clone().rotateY(-Math.PI / 2) : cg, M.steel, ...(ax === 'x' ? [pos[0], y, off - len / 2 + 0.04] : [off - len / 2 + 0.04, y, pos[2]]));
          small++;
        }
        for (const e of [-1, 1]) {
          const at = ax === 'x' ? [pos[0], y, off + e * (len / 2 - 0.02)] : [off + e * (len / 2 - 0.02), y, pos[2]];
          mesh(drum, ax === 'x' ? cylZg(r * 1.3, 0.04, 18) : cylXg(r * 1.3, 0.04, 18), M.gunmetal, ...at);
          small++;
        }
      }
    }
    for (const u of [0.78, 2.36, 3.93, 5.5]) {
      for (let j = 0; j < 4; j++) {
        const p = cush(u + (j - 1.5) * 0.12, 0.9, 0);
        const h = rr(0.4, 0.75);
        const r = rr(0.035, 0.06);
        mesh(drum, cylY(r, r, h, 18), [M.steel, M.gunmetal, M.graphite][j % 3], p.x, rr(ySpan[0] + h / 2, ySpan[1] - h / 2), p.z);
        small++;
      }
      const p = cush(u, 0.86, 0);
      const c = mesh(drum, coil(0.07, 0.008, 8, 0.5, 160).rotateZ(Math.PI / 2), M.steel, p.x, ySpan[0] + 0.05, p.z);
      small++;
    }
    for (let i = 0; i < 16; i++) {
      const u = (i / 16) * TAU + 0.2;
      const n = cushN(u);
      const r = rr(0.1, 0.18);
      const g = mesh(drum, gearXg(Math.round(r * 120), r, r * 0.88, 0.035, r * 0.25, 5), i % 2 ? M.gunmetal : M.brass);
      g.position.copy(cush(u, 0.83, rr(ySpan[0] + 0.15, ySpan[1] - 0.15)));
      g.quaternion.setFromUnitVectors(new V3(1, 0, 0), n);
      g.userData.spin = {axis: 'x', w: rr(-0.4, 0.4)};
    }
  }

  // ---- the bezel: white with a precise thin green rim and a green inner flange; 6 screws
  const bezel = part('bezel', watchCase, [0, 2.6, 0], [0, G.YD + 0.08, 0]);
  mesh(bezel, ringY(G.YD, G.YD + 0.13, 0.99, G.R_BEZ, 0.035), M.shell);
  mesh(bezel, ringY(G.YD + 0.015, G.YD + 0.115, G.R_BEZ - 0.01, G.R_BEZ + 0.028, 0.012), M.green);
  mesh(bezel, ringY(G.YD + 0.1, G.YD + 0.142, 0.975, 1.02, 0.01), M.green);
  for (let i = 0; i < 6; i++) {
    const d = dirAt((i / 6) * TAU + Math.PI / 6);
    screw(bezel, d.clone().multiplyScalar(1.095).setY(G.YD + 0.132), new V3(0, 1, 0), 0.03, M.gunmetal);
  }
  // the crystal: a slightly domed sapphire
  const crystal = part('crystal', watchCase, [0, 3.2, 0], [0, G.YD + 0.22, 0]);
  {
    const rise = 0.09;
    const Rs = (1.0 + rise * rise) / (2 * rise);
    const cap = new THREE.SphereGeometry(Rs, 128, 12, 0, TAU, 0, Math.asin(1.0 / Rs));
    mesh(crystal, cap, M.sapphire, 0, G.YD + 0.13 + rise - Rs, 0);
    mesh(crystal, ringY(G.YD + 0.1, G.YD + 0.135, 0.96, 1.0, 0.004), M.sapphire);
  }

  // ---- the dial and movement (dial-local: origin at C)
  // the explode stacks the movement up the dial axis in order (dial-local, on top of the dial's own 0.5): train 0.2,
  // barrel 0.3, escapement 0.75, bridges 0.85, chapter 1.25, hands 1.65; then the bezel 2.6 and the crystal 3.2
  const dial = part('dial', root, [0, 0.5, 0], [0, G.YD, 0]);
  dial.position.copy(C);
  parts.dial.rest.copy(C);
  const train = part('train', dial, [0, 0.2, 0]);
  const esc = part('escapement', dial, [-0.15, 0.75, 0.15], [-0.3, -0.18, 0.5]);
  const barrelG = part('barrel', dial, [0, 0.3, -0.6], [0, -0.4, -0.39]);
  const hands = part('hands', dial, [0, 1.65, 0], [0, 0.05, 0]);
  const chapter = part('chapter', dial, [0, 1.25, 0]);
  const bridges = part('bridges', dial, [0, 0.85, 0]);
  // main plate (dark, deep), with a ring of steel bearings around it
  mesh(dial, cylY(0.98, 0.98, 0.05, 72), M.void, 0, -0.66, 0);
  mesh(dial, ringY(-0.64, -0.6, 0.62, 0.98, 0.01), M.graphite);
  for (let i = 0; i < 18; i++) {
    const d = dirAt((i / 18) * TAU);
    mesh(dial, cached('brg', () => ringY(0, 0.025, 0.02, 0.04, 0.005, null, null, 20)), M.steel, d.x * 0.88, -0.6, d.z * 0.88);
    small++;
  }
  // the going train: wheel A drives the pinion of the next. [name, x, z, y, Rwheel, teeth, rPinion, mat]
  const TR = [];
  const wheel = (parent, name, x, z, y, R0, teeth, rp, mat, spokes = 5) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    put(g, gearY(teeth, R0, R0 * 0.93, 0.03, R0 * 0.18, spokes), mat);
    if (rp) put(g, gearY(Math.max(6, Math.round(rp * 110)), rp, rp * 0.78, 0.07, 0.008), M.steel, 0, -0.06, 0);
    put(g, cached('arbor', () => cylY(0.012, 0.012, 0.3, 10)), M.steel, 0, -0.05, 0);
    const w = {name, g, R: R0, rp, x, z};
    TR.push(w);
    return w;
  };
  const mesh2 = (a, rA, ang, rB) => {
    const d = rA + rB - 0.018;
    return [a.x + Math.sin(ang) * d, a.z - Math.cos(ang) * d];
  };
  const barrelW = {x: 0, z: -0.42, R: 0.34};
  const centre = wheel(train, 'centre', 0, 0, -0.3, 0.29, 72, 0.07, M.brass, 6);
  const [x3, z3] = mesh2(centre, centre.R, 118 * D2R, 0.06);
  const third = wheel(train, 'third', x3, z3, -0.4, 0.23, 60, 0.06, M.brass, 5);
  const [x4, z4] = mesh2(third, third.R, 205 * D2R, 0.055);
  const fourth = wheel(train, 'fourth', x4, z4, -0.3, 0.2, 56, 0.055, M.gunmetal, 5);
  const [xe, ze] = mesh2(fourth, fourth.R, 255 * D2R, 0.045);
  // the barrel: a dark drum with a steel ratchet on top, the mainspring showing through its window
  {
    barrelG.position.set(barrelW.x, -0.43, barrelW.z);
    put(barrelG, gearY(84, 0.34, 0.325, 0.05, 0.05, 0), M.graphite);
    put(barrelG, cylY(0.31, 0.31, 0.12, 64), M.graphite, 0, -0.08, 0);
    const spring = [];
    for (let i = 0; i <= 260; i++) {
      const a = (i / 260) * TAU * 7;
      const r = 0.06 + (i / 260) * 0.22;
      spring.push(new V3(Math.sin(a) * r, 0.03, -Math.cos(a) * r));
    }
    put(barrelG, tube(spring, 0.005, 400, 5), M.steel);
    const ratchet = put(barrelG, gearY(40, 0.2, 0.18, 0.03, 0.03, 0), M.steel, 0, 0.07, 0);
    ratchet.name = 'ratchet';
    // the click and its spring
    put(barrelG, barXZ([0.17, -0.1], [0.26, -0.02], 0.08, 0.035, 0.02), M.steel);
    put(barrelG, tube([[0.27, 0.08, 0.02], [0.32, 0.08, -0.06], [0.28, 0.08, -0.14]], 0.006, 20, 6), M.greenGlow);
  }
  // escapement + balance (the regulating organ at 7 o'clock)
  const escW = {x: xe, z: ze};
  const escWheel = new THREE.Group();
  escWheel.position.set(xe, -0.2, ze);
  esc.add(escWheel);
  {
    // a club-tooth escape wheel, 15 teeth
    const sh = new THREE.Shape();
    const n = 15;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU;
      const da = TAU / n;
      const P = [[0.085, a0], [0.12, a0 + da * 0.15], [0.118, a0 + da * 0.32], [0.085, a0 + da * 0.55]];
      P.forEach(([r, a], k) => (i === 0 && k === 0 ? sh.moveTo(Math.cos(a) * r, Math.sin(a) * r) : sh.lineTo(Math.cos(a) * r, Math.sin(a) * r)));
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.06, 0, TAU, true);
    sh.holes.push(hole);
    const eg = new THREE.ExtrudeGeometry(sh, {depth: 0.018, bevelEnabled: false, curveSegments: 4}).rotateX(-Math.PI / 2);
    put(escWheel, eg, M.steel);
    put(escWheel, barXZ([-0.07, 0], [0.07, 0], 0.009, 0.014, 0.012), M.steel);
    put(escWheel, barXZ([0, -0.07], [0, 0.07], 0.009, 0.014, 0.012), M.steel);
    put(escWheel, gearY(8, 0.045, 0.035, 0.05, 0.006), M.steel, 0, -0.04, 0);
  }
  const balC = [-0.33, 0.5];
  const forkPivot = [(xe + balC[0]) / 2 + 0.015, (ze + balC[1]) / 2 - 0.05];
  const fork = new THREE.Group();
  fork.position.set(forkPivot[0], -0.19, forkPivot[1]);
  esc.add(fork);
  {
    const toEsc = [xe - forkPivot[0], ze - forkPivot[1]];
    const toBal = [balC[0] - forkPivot[0], balC[1] - forkPivot[1]];
    put(fork, barXZ([0, 0], [toBal[0] * 0.62, toBal[1] * 0.62], 0, 0.02, 0.014), M.steel);
    // the anchor's two arms with ruby pallets
    const nE = Math.hypot(...toEsc);
    const ex = toEsc[0] / nE;
    const ez = toEsc[1] / nE;
    for (const s of [-1, 1]) {
      const tip = [ex * 0.07 + -ez * s * 0.06, ez * 0.07 + ex * s * 0.06];
      put(fork, barXZ([0, 0], tip, 0, 0.018, 0.014), M.steel);
      mesh(fork, rbox(0.022, 0.016, 0.022, 0.004), M.ruby, tip[0], 0, tip[1]);
    }
    mesh(fork, cylY(0.016, 0.016, 0.03, 12), M.ruby, 0, 0.01, 0);
  }
  const balance = new THREE.Group();
  balance.position.set(balC[0], -0.17, balC[1]);
  esc.add(balance);
  {
    // a screwed balance: rim, 3 arms, 12 timing screws, the hairspring flat under it
    put(balance, ringY(-0.012, 0.012, 0.215, 0.245, 0.004), M.brass);
    for (let i = 0; i < 3; i++) put(balance, barXZ([0, 0], [Math.sin((i / 3) * TAU) * 0.22, -Math.cos((i / 3) * TAU) * 0.22], 0, 0.022, 0.016), M.brass);
    for (let i = 0; i < 12; i++) {
      const d = dirAt((i / 12) * TAU + 0.13);
      const m = put(balance, cached('tscrew', () => cylXg(0.011, 0.03, 10)), M.steel, d.x * 0.252, 0, d.z * 0.252);
      m.quaternion.setFromUnitVectors(new V3(1, 0, 0), d);
      small++;
    }
    put(balance, cylY(0.03, 0.03, 0.03, 16), M.steel);
    const hs = [];
    for (let i = 0; i <= 300; i++) {
      const a = (i / 300) * TAU * 11;
      const r = 0.035 + (i / 300) * 0.15;
      hs.push(new V3(Math.sin(a) * r, -0.035, -Math.cos(a) * r));
    }
    put(balance, tube(hs, 0.0028, 600, 4), M.greenGlow);
  }
  // balance cock (a curved white-steel bridge) and its jewel
  mesh(esc, barXZ([balC[0] - 0.5, balC[1] + 0.33], [balC[0], balC[1]], -0.12, 0.09, 0.03, 0.014), M.brushed);
  jewel(esc, balC[0], -0.105, balC[1], 0.04);
  screw(esc, new V3(balC[0] - 0.42, -0.1, balC[1] + 0.28), new V3(0, 1, 0), 0.028, M.graphite);
  // deeper decorative wheels so the movement has 3 visible levels everywhere
  const deco = [];
  for (const [x, z, y, Rw, t, mat] of [[-0.55, -0.35, -0.5, 0.26, 64, M.gunmetal], [0.55, -0.42, -0.52, 0.22, 52, M.brass], [0.6, 0.32, -0.55, 0.18, 44, M.gunmetal], [-0.62, 0.15, -0.55, 0.16, 40, M.brass], [0.18, 0.62, -0.5, 0.14, 36, M.graphite], [-0.2, -0.72, -0.5, 0.12, 30, M.graphite], [0.75, -0.05, -0.45, 0.1, 26, M.steel]]) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    train.add(g);
    put(g, gearY(t, Rw, Rw * 0.92, 0.028, Rw * 0.2, 5), mat);
    put(g, cached('arbor', () => cylY(0.012, 0.012, 0.3, 10)), M.steel, 0, 0.05, 0);
    deco.push({g, R: Rw});
  }
  // keyless works under the crown side: the crown wheel and the winding pinion (they turn with the crown)
  const crownWheel = new THREE.Group();
  crownWheel.position.set(0.62, -0.28, -0.14);
  train.add(crownWheel);
  put(crownWheel, gearY(30, 0.11, 0.095, 0.03, 0.02, 4), M.steel);
  const windPinion = new THREE.Group();
  windPinion.position.set(0.84, -0.33, 0.02);
  train.add(windPinion);
  put(windPinion, gearXg(16, 0.06, 0.05, 0.05, 0.01), M.steel);

  // the skeleton bridges: brushed steel arms from the rim to the arbors, each end screwed and jewelled
  {
    const y = -0.13;
    const B = [
      [[-0.92, -0.22], [0, -0.42], 0.08], // barrel bridge
      [[0.9, -0.36], [0, -0.42], 0.07],
      [[0, -0.42], [0, 0], 0.06], // centre
      [[0, 0], [third.x, third.z], 0.055],
      [[third.x, third.z], [0.88, 0.32], 0.06],
      [[third.x, third.z], [fourth.x, fourth.z], 0.05],
      [[fourth.x, fourth.z], [0.42, 0.82], 0.055],
      [[fourth.x, fourth.z], [escW.x, escW.z], 0.045],
      [[escW.x, escW.z], [-0.05, 0.92], 0.05],
      [[-0.92, 0.2], [-0.45, 0.05], 0.05],
      [[-0.45, 0.05], [0, 0], 0.045],
    ];
    for (const [a, b, w] of B) {
      mesh(bridges, barXZ(a, b, y, w, 0.03, 0.012), M.brushed);
      // a thin dark bevel line under each arm
      mesh(bridges, barXZ(a, b, y - 0.022, w * 0.6, 0.012, 0.004), M.graphite);
    }
    for (const [x, z] of [[0, -0.42], [0, 0], [third.x, third.z], [fourth.x, fourth.z], [escW.x, escW.z], [-0.45, 0.05]]) jewel(bridges, x, y + 0.015, z, 0.03);
    for (const [x, z] of [[-0.86, -0.24], [0.84, -0.35], [0.82, 0.31], [0.39, 0.77], [-0.06, 0.86], [-0.86, 0.19], [-0.2, -0.3], [0.2, -0.3]]) screw(bridges, new V3(x, y + 0.015, z), new V3(0, 1, 0), 0.024, M.graphite);
  }

  // the chapter ring: black, 12 applied white indices with green lume, 60 minute ticks; a dark rehaut
  {
    mesh(chapter, ringY(-0.05, -0.01, 0.82, 0.99, 0.006), M.void);
    mesh(chapter, ringY(-0.01, 0.07, 0.955, 0.995, 0.005), M.matteBlack);
    for (let i = 0; i < 60; i++) {
      const d = dirAt((i / 60) * TAU);
      const big = i % 5 === 0;
      if (big) {
        const g = new THREE.Group();
        g.position.set(d.x * 0.885, -0.005, d.z * 0.885);
        g.rotation.y = -(i / 60) * TAU;
        chapter.add(g);
        const len = i % 15 === 0 ? 0.13 : 0.1;
        put(g, rbox(0.05, 0.035, len, 0.008), M.steel);
        put(g, rbox(0.022, 0.012, len * 0.8, 0.004), M.lume, 0, 0.02, 0);
        small++;
      } else {
        const m = mesh(chapter, cached('tick', () => new THREE.BoxGeometry(0.008, 0.006, 0.03)), M.steel, d.x * 0.935, -0.008, d.z * 0.935);
        m.rotation.y = -(i / 60) * TAU;
      }
    }
  }
  // hands: skeleton steel frames with green lume inserts; a thin seconds needle with a green tip
  const mkHand = (len, w, y, lumeOn = true) => {
    const g = new THREE.Group();
    g.position.y = y;
    hands.add(g);
    const tail = len * 0.18;
    const sh = new THREE.Shape();
    sh.moveTo(-w * 0.35, tail);
    sh.lineTo(-w * 0.5, -len * 0.15);
    sh.lineTo(-w * 0.32, -len * 0.92);
    sh.lineTo(0, -len);
    sh.lineTo(w * 0.32, -len * 0.92);
    sh.lineTo(w * 0.5, -len * 0.15);
    sh.lineTo(w * 0.35, tail);
    sh.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-w * 0.22, -len * 0.2);
    hole.lineTo(-w * 0.16, -len * 0.84);
    hole.lineTo(w * 0.16, -len * 0.84);
    hole.lineTo(w * 0.22, -len * 0.2);
    hole.closePath();
    sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, {depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1}).rotateX(Math.PI / 2);
    put(g, geo, M.steel);
    if (lumeOn) put(g, rbox(w * 0.2, 0.008, len * 0.5, 0.003), M.lume, 0, 0.004, -len * 0.55);
    put(g, cylY(w * 0.38, w * 0.38, 0.02, 20), M.steel);
    return g;
  };
  const hHour = mkHand(0.52, 0.1, 0.02);
  const hMin = mkHand(0.8, 0.075, 0.045);
  const hSec = new THREE.Group();
  hSec.position.y = 0.07;
  hands.add(hSec);
  put(hSec, rbox(0.01, 0.008, 1.06, 0.003).translate(0, 0, -0.33), M.steel);
  put(hSec, rbox(0.016, 0.01, 0.16, 0.004).translate(0, 0.002, -0.78), M.greenGlow);
  put(hSec, cylY(0.04, 0.04, 0.012, 20).translate(0, 0, 0.17), M.steel);
  put(hands, ringY(0.075, 0.095, 0.025, 0.045, 0.004), M.green);
  put(hands, new THREE.SphereGeometry(0.03, 16, 8, 0, TAU, 0, Math.PI / 2), M.steel, 0, 0.085, 0);

  // ---- the lugs at ±Z: two broad white horns per end sweeping from the deck's corners down the loop to the first link,
  // a dark mechanism between them (cross shafts stepping down the curve, a piston pair), a screwed white bridge across
  const lugs = {};
  for (const e of [-1, 1]) {
    const name = e < 0 ? 'lug12' : 'lug6';
    const lg = part(name, watchCase, [0, 0.3, e * 1.0], [0, 1.6, e * 1.4]);
    lugs[name] = lg;
    const th = G.TH_C;
    const pEnd = loopP(e * th).add(loopN(e * th).multiplyScalar(0.05));
    const tEnd = loopT(e * th).multiplyScalar(e);
    const XH = G.W / 2 - 0.17;
    for (const sx of [-1, 1]) {
      const x = sx * XH;
      const pts = [
        new V3(x, G.YD - 0.1, e * (G.CB - 0.32)),
        new V3(x, G.YD - 0.14, e * (G.CB + 0.02)),
        new V3(x, pEnd.y + 0.62, e * (G.CB + 0.24)),
        new V3(x, pEnd.y + 0.2, pEnd.z - e * 0.05),
        new V3(x, pEnd.y + tEnd.y * 0.12, pEnd.z + tEnd.z * 0.12),
      ];
      const wFn = (u) => 0.4 - 0.08 * Math.sin(u * Math.PI);
      const curve = new THREE.CatmullRomCurve3(pts);
      // the horn is 3 white plates (long, medium, short) with dark joints between them over a graphite spine
      mesh(lg, sweepRect(Array.from({length: 13}, (_, k) => curve.getPointAt(0.02 + (k / 12) * 0.96)), new V3(1, 0, 0), (u) => wFn(u) * 0.55, 0.16, 0.04, 40), M.graphite);
      for (const [a, b] of [[0, 0.44], [0.49, 0.78], [0.83, 1]]) {
        const seg = Array.from({length: 9}, (_, k) => curve.getPointAt(a + (k / 8) * (b - a)));
        mesh(lg, sweepRect(seg, new V3(1, 0, 0), (u) => wFn(a + u * (b - a)), 0.22, 0.07, 24), M.shell);
      }
      // a green line along the outer flank of each horn, from below the deck to the hinge
      const edge = [];
      for (let k = 0; k <= 8; k++) edge.push(curve.getPointAt(0.18 + (k / 8) * 0.8).add(new V3(sx * (wFn(0.18 + (k / 8) * 0.8) / 2 + 0.004), 0, 0)));
      mesh(lg, sweepRect(edge, new V3(1, 0, 0), 0.016, 0.1, 0.006, 40), M.green);
      // 3 screws down the horn
      for (const u of [0.2, 0.52, 0.84]) {
        const p = curve.getPointAt(u);
        const t = curve.getTangentAt(u);
        const n = new V3().crossVectors(new V3(1, 0, 0), t).normalize().multiplyScalar(-e);
        screw(lg, p.clone().addScaledVector(n, 0.11), n, 0.032);
      }
    }
    const curveMid = new THREE.CatmullRomCurve3([new V3(0, G.YD - 0.32, e * (G.CB - 0.2)), new V3(0, G.YD - 0.45, e * (G.CB + 0.02)), new V3(0, pEnd.y + 0.45, e * (G.CB + 0.2)), new V3(0, pEnd.y + 0.06, pEnd.z - e * 0.1)]);
    for (let i = 0; i < 7; i++) {
      const u = 0.06 + i * 0.14;
      const p = curveMid.getPointAt(u);
      const r = [0.07, 0.045, 0.06, 0.04, 0.075, 0.05, 0.06][i];
      const len = 2 * XH - 0.4 - [0, 0.2, 0, 0.3, 0, 0.1, 0][i];
      mesh(lg, cylXg(r, len, 22), [M.steel, M.graphite, M.gunmetal, M.steel, M.graphite, M.steel, M.gunmetal][i], 0, p.y, p.z);
      if (i % 2 === 0) for (const sx of [-1, 1]) mesh(lg, cylXg(r * 1.35, 0.05, 20), M.black, sx * (len / 2 - 0.03), p.y, p.z);
      small += 2;
    }
    mesh(lg, rbox(2 * XH - 0.3, 0.5, 0.45, 0.05), M.matteBlack, 0, G.YD - 0.62, e * (G.CB - 0.05));
    for (const sx of [-1, 1]) {
      const a = new V3(sx * 0.32, G.YD - 0.3, e * (G.CB - 0.1));
      const b = new V3(sx * 0.32, pEnd.y + 0.24, pEnd.z - e * 0.2);
      const d = b.clone().sub(a);
      const cyl = new THREE.Mesh(cylY(0.06, 0.06, d.length() * 0.55, 20), M.black);
      cyl.position.copy(a).addScaledVector(d, 0.3);
      cyl.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
      lg.add(cyl);
      const rod = new THREE.Mesh(cylY(0.032, 0.032, d.length() * 0.5, 16), M.steel);
      rod.position.copy(a).addScaledVector(d, 0.72);
      rod.quaternion.copy(cyl.quaternion);
      lg.add(rod);
      small += 2;
    }
    const pb = curveMid.getPointAt(0.5);
    const tb = curveMid.getTangentAt(0.5);
    const nb = new V3().crossVectors(new V3(1, 0, 0), tb).normalize().multiplyScalar(-e);
    const br = mesh(lg, rbox(2 * XH - 0.3, 0.07, 0.17, 0.03), M.shell, ...pb.clone().addScaledVector(nb, 0.12).toArray());
    br.quaternion.setFromUnitVectors(new V3(0, 1, 0), nb);
    for (const sx of [-0.4, 0.4]) screw(lg, pb.clone().addScaledVector(nb, 0.16).add(new V3(sx, 0, 0)), nb, 0.025);
  }

  // ---- crowns at 3 o'clock: a white guard collar, a dark knurled grip, a glowing green ring, a black dome tip
  const mkCrown = (name, y, z, k, yaw) => {
    const cg = part(name, watchCase, [1.2, 0, 0], [G.CA + 0.4 * k, y, z]);
    const pivot = new THREE.Group();
    pivot.position.set(G.CA - 0.05, y, z);
    pivot.rotation.y = yaw;
    cg.add(pivot);
    put(pivot, cylXg(0.06 * k, 0.24 * k, 20), M.steel, 0.1 * k, 0, 0);
    put(pivot, ring(0.12 * k, 0.26 * k, 0.1 * k, 0.24 * k, 0.03 * k, {segs: 48}), M.shell);
    const spin = new THREE.Group();
    pivot.add(spin);
    put(spin, gearXg(36, 0.235 * k, 0.215 * k, 0.17 * k, 0.03, 0).clone().translate(0.36 * k, 0, 0), M.graphite);
    put(spin, ring(0.27 * k, 0.45 * k, 0.12 * k, 0.2 * k, 0.01 * k, {segs: 48}), M.gunmetal);
    put(spin, ring(0.445 * k, 0.49 * k, 0.17 * k, 0.245 * k, 0.012 * k, {segs: 48}), M.greenGlow);
    put(spin, ring(0.27 * k, 0.29 * k, 0.2 * k, 0.24 * k, 0.006 * k, {segs: 48}), M.green);
    const dome = new THREE.SphereGeometry(0.19 * k, 32, 16, 0, TAU, 0, Math.PI / 2).rotateZ(-Math.PI / 2).scale(0.7, 1, 1);
    put(spin, dome, M.lens, 0.48 * k, 0, 0);
    // the stem into the case
    put(pivot, cylXg(0.02, 0.5, 10), M.steel, -0.15, 0, 0);
    small += 4;
    return {g: cg, spin};
  };
  const crown = mkCrown('crown', G.YD - 0.66, 0.14, 1.3, 0.0);
  const crown2 = mkCrown('crown2', G.YD - 0.42, -0.68, 0.8, 0.32);

  // ---- the rotor on the back (inside the loop, seen through the case back)
  const rotor = part('rotor', watchCase, [0, -0.7, 0], [0, G.YB - 0.05, 0]);
  const rotorSpin = new THREE.Group();
  rotorSpin.position.set(0, G.YB - 0.05, 0);
  rotor.add(rotorSpin);
  {
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 0.88, 0, Math.PI, false);
    sh.lineTo(-0.12, 0);
    sh.absarc(0, 0, 0.12, Math.PI, 0, true);
    sh.closePath();
    put(rotorSpin, new THREE.ExtrudeGeometry(sh, {depth: 0.04, bevelEnabled: false, curveSegments: 48}).rotateX(Math.PI / 2), M.graphite);
    put(rotorSpin, ringY(-0.06, 0.0, 0.8, 0.9, 0.01, -Math.PI / 2, Math.PI / 2, 48), M.green);
    put(rotorSpin, cylY(0.1, 0.1, 0.06, 24), M.steel);
  }
  mesh(watchCase, cylY(1.0, 1.0, 0.02, 72), M.glass, 0, G.YB - 0.12, 0);

  // =============================================================== BRACELET: articulated links around the loop
  const bracelet = part('bracelet', root, [0, -0.4, 0]);
  const A = arcTable();
  const s0 = A.len(G.TH_C);
  const s1 = A.len(TAU - G.TH_C);
  const NL = 18; // keeps the link pitch of the shorter loop (~0.51)
  const pitch = (s1 - s0) / NL;
  const links = [];
  const clampMid = Math.floor(NL / 2);
  const mkLink = (i) => {
    const thA = A.at(s0 + pitch * i);
    const thB = A.at(s0 + pitch * (i + 1));
    const thM = A.at(s0 + pitch * (i + 0.5));
    const lg = part(`link${i}`, bracelet, [0, 0, 0], [0, 0, 0]);
    const frame = loopFrame(thM);
    lg.matrixAutoUpdate = true;
    frame.decompose(lg.position, lg.quaternion, lg.scale);
    parts[`link${i}`].rest.copy(lg.position);
    parts[`link${i}`].dir.copy(loopN(thM)).multiplyScalar(0.7);
    const L = loopP(thA).distanceTo(loopP(thB));
    const W2 = G.W / 2;
    const k = Math.min(i, NL - 1 - i); // distance from the case
    const clasp = i === clampMid;
    const type = clasp ? 'clasp' : k < 2 ? 'mech' : k % 2 === 0 ? 'panel' : 'mech';
    const jit = (a) => a * (0.85 + 0.3 * R());
    // inner plate (dark)
    // the inner face stays open: two dark cross straps and a thin steel tie, so the rods show from inside the loop
    put(lg, rbox(G.W - 0.3, 0.04, 0.07, 0.015), M.graphite, 0, -0.17, -L * 0.28);
    put(lg, rbox(G.W - 0.3, 0.04, 0.05, 0.015), M.graphite, 0, -0.17, L * 0.12);
    put(lg, cylXg(0.018, G.W - 0.32, 10), M.steel, 0, -0.15, -L * 0.08);
    // side rails: a graphite beam carrying 3 white plates (long, medium, short) with dark gaps; the order alternates
    for (const sx of [-1, 1]) {
      const zs = -L * 0.46;
      const hR = jit(0.36);
      const span = L * 0.92;
      put(lg, rbox(0.17, hR * 0.8, span, 0.03), M.graphite, sx * (W2 - 0.15), -0.03, 0);
      const fr = i % 2 === 0 ? [0.5, 0.3, 0.2] : [0.2, 0.3, 0.5];
      let z = zs;
      const plates = [];
      fr.forEach((f, j) => {
        const l = span * f - 0.05;
        const h = hR * [0.62, 0.55, 0.5][j];
        put(lg, rbox(0.25 - j * 0.015, h, l, 0.05), M.shell, sx * (W2 - 0.14), hR / 2 - h / 2, z + l / 2);
        plates.push({z0: z, l, h});
        z += l + 0.05;
      });
      const big = plates[fr.indexOf(0.5)];
      const l1 = big.l;
      // the green edge on the outer top edge of the long plate
      put(lg, rbox(0.018, 0.028, l1 * 0.9, 0.006), M.green, sx * (W2 - 0.012), hR / 2 - 0.03, big.z0 + l1 / 2);
      // screws on the plate tops, one per small plate, two on the long one
      for (const p of plates) for (const zz of p === big ? [p.z0 + 0.07, p.z0 + p.l - 0.07] : [p.z0 + p.l / 2]) screw(lg, new V3(sx * (W2 - 0.14), hR / 2 + 0.002, zz), new V3(0, 1, 0), 0.026);
      const split = big.z0 - zs + l1 / 2;
      // a pin through each plate's side
      pinHead(lg, new V3(sx * W2, -0.02, zs + split * 0.5), new V3(sx, 0, 0), 0.03);
    }
    // the centre
    const cx = W2 - 0.29; // inner half width
    const rodX = [-0.36, -0.12, 0.13, 0.37].map((x) => x * (cx / 0.5));
    rodX.forEach((x, j) => {
      const r = [0.05, 0.065, 0.045, 0.06][(j + i) % 4];
      put(lg, cylZg(r, L * rr(0.7, 0.9), 18), [M.steel, M.graphite, M.gunmetal, M.steel][(j + i) % 4], x, -0.06 + r * 0.3, rr(-0.03, 0.03));
      small++;
    });
    // a dark tray on the outer side, under the panels and bridges: seen from inside the loop the rods stand against
    // it, seen from outside it fills the gaps between the white plates (never see-through to the paper).
    // On mech links it is split around the spinning gear.
    const trayW = G.W - 0.36;
    const gx = rodX[0] + 0.12;
    const tray = (x0, x1) => put(lg, rbox(x1 - x0, 0.012, L * 0.86, 0.005), M.matteBlack, (x0 + x1) / 2, 0.093, 0);
    if (type === 'mech') {
      tray(-trayW / 2, gx - 0.035);
      tray(gx + 0.035, trayW / 2);
    } else tray(-trayW / 2, trayW / 2);
    if (type === 'panel') {
      // a frosted jade panel framed in green, over the rods; a few pale veins inside it
      const pw = cx * 2 - 0.04;
      const pl = L * 0.74;
      mesh(lg, rbox(pw, 0.06, pl, 0.025), M.jade, 0, 0.12, 0);
      put(lg, rbox(pw + 0.04, 0.03, 0.022, 0.008), M.green, 0, 0.12, pl / 2 + 0.012);
      put(lg, rbox(pw + 0.04, 0.03, 0.022, 0.008), M.green, 0, 0.12, -pl / 2 - 0.012);
      for (let v = 0; v < 5; v++) {
        const pts = [];
        let x = rr(-pw / 2, pw / 2);
        let z = -pl / 2;
        for (let q = 0; q < 6; q++) {
          pts.push(new V3(Math.max(-pw / 2, Math.min(pw / 2, x)), 0.1, z));
          x += rr(-0.15, 0.15);
          z += pl / 5;
        }
        put(lg, tube(pts, 0.004, 30, 4), M.vein);
      }
    } else if (type === 'mech') {
      // a white cross bridge, screwed; a piston with a spring; a small gear; a hose
      const zb = (i % 2 ? 0.12 : -0.12) * L;
      put(lg, rbox(cx * 2, 0.07, jit(0.15), 0.03), M.shell, 0, 0.12, zb);
      for (const x of [-cx * 0.6, cx * 0.6]) screw(lg, new V3(x, 0.157, zb), new V3(0, 1, 0), 0.024);
      put(lg, cylZg(0.05, L * 0.35, 20), M.black, rodX[1], 0.03, -zb * 1.8);
      put(lg, coil(0.05, 0.006, 8, L * 0.3, 140).rotateY(-Math.PI / 2), M.steel, rodX[2], 0.025, -L * 0.15);
      const gr = rr(0.08, 0.12);
      const gm = put(lg, gearXg(Math.round(gr * 140), gr, gr * 0.86, 0.03, 0.02, 4), M.gunmetal, rodX[0] + 0.12, 0.02, zb * -0.4);
      gm.userData.spin = {axis: 'x', w: rr(-0.6, 0.6)};
      put(lg, tube([[rodX[3], 0.035, -L * 0.4], [rodX[3] + 0.05, 0.066, 0], [rodX[3], 0.035, L * 0.4]], 0.018, 20, 8), M.graphite);
      small += 4;
    } else {
      // the clasp: a deployant fold, two green push buttons, a locking hook and its spring
      put(lg, rbox(cx * 2, 0.06, L * 0.8, 0.03), M.shell, 0, 0.13, 0);
      put(lg, rbox(cx * 1.2, 0.05, L * 0.5, 0.02), M.brushed, 0, 0.17, 0);
      put(lg, coil(0.04, 0.006, 10, cx * 1.3, 160), M.steel, -cx * 0.65, -0.1, 0);
      put(lg, barXZ([-0.2, -L * 0.2], [0.2, L * 0.2], -0.1, 0.05, 0.04), M.steel);
      for (const sx of [-1, 1]) {
        const b = put(lg, cylXg(0.07, 0.08, 24), M.greenGlow, sx * (W2 + 0.03), 0.0, 0);
        put(lg, cylXg(0.085, 0.03, 24), M.shell, sx * (W2 - 0.01), 0.0, 0);
        small += 2;
        b.name = 'button';
      }
      for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) screw(lg, new V3(x * cx * 2, 0.162, z * L), new V3(0, 1, 0), 0.022);
    }
    // the hinge at the far end: a dark barrel with 3 white knuckles, green joint rings, pins
    const z1 = L / 2;
    put(lg, cylXg(0.07, G.W - 0.04, 24), M.graphite, 0, -0.02, z1);
    for (const x of [-0.42, 0, 0.42]) {
      put(lg, cylXg(0.1, x ? 0.2 : 0.26, 24), x ? M.shell : M.gunmetal, x * (cx / 0.5), -0.02, z1);
    }
    for (const sx of [-1, 1]) {
      put(lg, cached('jring', () => new THREE.TorusGeometry(0.075, 0.012, 8, 24).rotateY(Math.PI / 2)), M.gunmetal, sx * (W2 - 0.005), -0.02, z1);
      pinHead(lg, new V3(sx * (W2 + 0.0), -0.02, z1), new V3(sx, 0, 0), 0.045);
    }
    links.push({g: lg, type, th: thM});
  };
  for (let i = 0; i < NL; i++) mkLink(i);
  // the end hinges at the lugs
  for (const e of [-1, 1]) {
    const f = loopFrame(e * G.TH_C);
    const h = new THREE.Group();
    f.decompose(h.position, h.quaternion, h.scale);
    lugs[e < 0 ? 'lug12' : 'lug6'].add(h);
    put(h, cylXg(0.08, G.W - 0.06, 24), M.graphite, 0, 0, 0);
    for (const sx of [-1, 1]) pinHead(h, new V3(sx * G.W / 2, 0, 0), new V3(sx, 0, 0), 0.045);
  }

  // rest positions of every part
  for (const k in parts) if (!parts[k].rest.lengthSq()) parts[k].rest.copy(parts[k].g.position);
  root.updateMatrixWorld(true);

  // ---------------------------------------------------------------- the mechanism as a pure function of time
  // the escapement beats at 4 Hz (28 800 vph): 8 beats a second; the escape wheel (15 teeth) steps 12° a beat
  const BEAT = 8;
  const ratio = (a, b) => a / b;
  const wEsc = 1 / 3.75; // rev/s
  const w4 = wEsc * ratio(0.045, fourth.R);
  const w3 = w4 * ratio(fourth.rp, third.R);
  const wC = w3 * ratio(third.rp, centre.R);
  const wB = wC * ratio(centre.rp, barrelW.R);
  const stepEase = (x) => {
    const f = x - Math.floor(x);
    const k = Math.min(1, f / 0.22);
    return Math.floor(x) + k * k * (3 - 2 * k);
  };
  const SHOW = 12; // the train turns this many times faster than real time so the camera sees it move

  const pose = (state = {}) => {
    const t = state.t ?? 0;
    const n = t * BEAT;
    const steps = stepEase(n);
    // balance: ±220° sine at 4 Hz
    balance.rotation.y = 220 * D2R * Math.sin(TAU * 4 * t);
    // pallet fork: locks one side per beat, the swing synced to the beat
    const ph = n - Math.floor(n);
    const side = Math.floor(n) % 2 ? 1 : -1;
    const sw = Math.min(1, ph / 0.18);
    fork.rotation.y = 9 * D2R * (ph < 0.18 ? -side + 2 * side * sw * sw * (3 - 2 * sw) : side);
    escWheel.rotation.y = -steps * (TAU / 30);
    const turns = (w) => -steps / BEAT * w * TAU * SHOW;
    fourth.g.rotation.y = -turns(w4 * 1);
    third.g.rotation.y = turns(w3);
    centre.g.rotation.y = -turns(wC);
    barrelG.rotation.y = turns(wB);
    deco.forEach((d, k) => (d.g.rotation.y = (k % 2 ? 1 : -1) * turns(w4 * (0.2 / d.R))));
    // hands: 10:09:30 at t = 0, seconds stepping 8 a second
    const secs = 10 * 3600 + 9 * 60 + 30 + steps / BEAT;
    hSec.rotation.y = -((secs % 60) / 60) * TAU;
    hMin.rotation.y = -((secs % 3600) / 3600) * TAU;
    hHour.rotation.y = -((secs % 43200) / 43200) * TAU;
    // rotor: a natural sway (a wrist that moves), the oscillating weight lagging behind
    rotorSpin.rotation.y = 0.7 * Math.sin(0.55 * t + 0.4) + 0.25 * Math.sin(1.37 * t + 1.1);
    // winding: the crown turns, its pinion and the crown wheel follow, the ratchet steps
    const wind = state.wind ?? 0;
    crown.spin.rotation.x = wind * TAU;
    windPinion.rotation.x = wind * TAU;
    crownWheel.rotation.y = -wind * TAU * (0.06 / 0.11);
    const ratchet = barrelG.getObjectByName('ratchet');
    ratchet.rotation.y = -Math.floor(wind * 40 * (0.06 / 0.11) * (0.11 / 0.2)) * (TAU / 40);
    // anything else that spins with the busy clock
    root.traverse((o) => {
      const sp = o.userData.spin;
      if (sp) o.rotation[sp.axis] = sp.w * t;
    });
    // the teardown: parts out along their own direction
    const ex = state.explode ?? 0;
    const open = state.open ?? {};
    for (const k in parts) {
      const p = parts[k];
      const kk = Math.max(ex, open[k] ?? 0);
      p.g.position.copy(p.rest).addScaledVector(p.dir, kk);
    }
  };

  // label points on the moving pieces themselves (the parts' own anchors sit at their explode centres)
  anchors.balance = {obj: balance, at: new V3(0, 0.02, 0)};
  anchors.escWheel = {obj: escWheel, at: new V3()};
  anchors.movement = {obj: dial, at: new V3(0.55, -0.45, 0.3)};
  anchors.piston = {obj: drum, at: new V3(G.CA - 0.12, 1.96, 0.25)};
  anchors.dialFace = {obj: dial, at: new V3()};

  const anchorAt = (key, out = new V3()) => {
    root.updateMatrixWorld(true);
    return anchors[key].obj.getWorldPosition(out);
  };
  return {root, pose, clear, M, anchors, anchorAt, parts, links, small: () => small, G};
}
