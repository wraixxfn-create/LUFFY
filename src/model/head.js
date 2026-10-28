/**
 * head.js — skull, face, hair and straw hat.
 * Analytic head surface so eyes, brows, mouth, scars, hair and hat conform to
 * exactly the same shape. Profile keys are normalized by head height.
 */
import * as THREE from 'three';
import { V3, TAU, curve, surface, tube, pathStations, gauss, smoothstep, clamp, lerp } from './lib/geom.js';
import { P } from './proportions.js';

const CHIN = P.chin;
const HH = P.headHeight;

const rxCurve = curve([
  [0.000, 0.0155], [0.028, 0.0385], [0.065, 0.0615], [0.115, 0.0780],
  [0.190, 0.0965], [0.290, 0.1100], [0.400, 0.1170], [0.500, 0.1215],
  [0.600, 0.1235], [0.690, 0.1230], [0.780, 0.1165], [0.860, 0.1050],
  [0.920, 0.0820], [0.960, 0.0580], [0.990, 0.0270], [1.000, 0.0055],
]);
const rzCurve = curve([
  [0.000, 0.0270], [0.028, 0.0400], [0.065, 0.0545], [0.115, 0.0645],
  [0.190, 0.0755], [0.290, 0.0840], [0.400, 0.0900], [0.500, 0.0945],
  [0.600, 0.1005], [0.690, 0.1005], [0.780, 0.0975], [0.860, 0.0905],
  [0.920, 0.0755], [0.960, 0.0555], [0.990, 0.0260], [1.000, 0.0055],
]);
const czCurve = curve([
  [0.000, 0.010], [0.150, 0.005], [0.400, 0.000], [0.700, -0.005],
  [0.880, -0.012], [1.000, -0.016],
]);

const FACE_E = 2.30;

const angDiff = (a, b) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

function headDeform(theta, y) {
  const t = clamp((y - CHIN) / HH, 0, 1);
  const th = Math.atan2(Math.sin(theta), Math.cos(theta));
  let d = 0;
  d += 0.0085 * gauss(th, 0.26) * gauss(t - 0.070, 0.055);                    // chin
  d += 0.0070 * gauss(angDiff(th, 0.95), 0.32) * gauss(t - 0.150, 0.060);     // jaw
  d += 0.0070 * gauss(angDiff(th, -0.95), 0.32) * gauss(t - 0.150, 0.060);
  d += 0.0065 * gauss(angDiff(th, 0.82), 0.36) * gauss(t - 0.380, 0.090);     // cheeks
  d += 0.0065 * gauss(angDiff(th, -0.82), 0.36) * gauss(t - 0.380, 0.090);
  d += 0.0060 * gauss(angDiff(th, 0.36), 0.28) * gauss(t - 0.655, 0.045);     // brow ridge
  d += 0.0060 * gauss(angDiff(th, -0.36), 0.28) * gauss(t - 0.655, 0.045);
  d -= 0.0042 * gauss(angDiff(th, 0.44), 0.24) * gauss(t - 0.560, 0.050);     // eye socket
  d -= 0.0042 * gauss(angDiff(th, -0.44), 0.24) * gauss(t - 0.560, 0.050);
  d += 0.0046 * gauss(th, 0.13) * gauss(t - 0.495, 0.075);                    // nose bridge
  d -= 0.0024 * gauss(th, 0.11) * gauss(t - 0.245, 0.045);                    // philtrum
  d -= 0.0026 * gauss(angDiff(th, 1.10), 0.30) * gauss(t - 0.720, 0.090);     // temples
  d += 0.0032 * gauss(angDiff(th, Math.PI), 0.70) * gauss(t - 0.780, 0.100);
  return d;
}

/** theta: 0 = face front (+Z), PI/2 = character's left (+X). */
export function headPoint(theta, y, off = 0) {
  const t = clamp((y - CHIN) / HH, 0, 1);
  const rx = rxCurve(t), rz = rzCurve(t), cz = czCurve(t);
  const s = Math.sin(theta), c = Math.cos(theta);
  const p = 2 / FACE_E;
  const x = rx * Math.sign(s) * Math.pow(Math.abs(s), p);
  const z = cz + rz * Math.sign(c) * Math.pow(Math.abs(c), p);
  let nx = x / (rx * rx), nz = (z - cz) / (rz * rz);
  const nl = Math.hypot(nx, nz) || 1;
  nx /= nl; nz /= nl;
  const d = headDeform(theta, y) + off;
  return V3(x + nx * d, y, z + nz * d);
}

/** Front-of-face point at lateral x and height y. */
export function facePoint(x, y, off = 0) {
  const t = clamp((y - CHIN) / HH, 0, 1);
  const rx = rxCurve(t);
  const q = clamp(Math.abs(x) / rx, 0, 0.999);
  const sinT = Math.pow(q, FACE_E / 2);
  const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
  const theta = Math.atan2(sinT * Math.sign(x || 1), cosT);
  return headPoint(theta, y, off);
}

export function faceNormal(x, y) {
  const e = 0.0015;
  const a = facePoint(x + e, y), b = facePoint(x - e, y);
  const c = facePoint(x, y + e), d = facePoint(x, y - e);
  const n = new THREE.Vector3().crossVectors(a.sub(b), c.sub(d)).normalize();
  if (n.z < 0) n.negate();
  return n;
}

export function buildHead() {
  const rings = [];
  const steps = 88;
  for (let i = 0; i <= steps; i++) {
    const y = lerp(CHIN + 0.0005, CHIN + HH, i / steps);
    const r = [];
    for (let j = 0; j < 64; j++) r.push(headPoint((j / 64) * TAU, y));
    rings.push(r);
  }
  return surface(rings, { loop: true, capStart: true, capEnd: true });
}

/* ------------------------------------------------------------------- eyes */
function ellipseRadius(a, shape) {
  const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
  return Math.pow(Math.pow(ca, shape) + Math.pow(sa, shape), -1 / shape);
}

function conformedPatch({ cx, cy, rx, ry, shape = 2, bulge = 0.004, rings = 8, seg = 40, tilt = 0 }) {
  const rows = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const pts = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * TAU;
      const r = ellipseRadius(a, shape);
      const u = Math.cos(a) * r * rx * t;
      const v = Math.sin(a) * r * ry * t;
      const u2 = u * Math.cos(tilt) - v * Math.sin(tilt);
      const v2 = u * Math.sin(tilt) + v * Math.cos(tilt);
      const h = bulge * Math.sqrt(Math.max(0, 1 - t * t));
      pts.push(facePoint(cx + u2, cy + v2, h));
    }
    rows.push(pts);
  }
  return surface(rows, { loop: true });
}

/** Upper lash line: thick at the outer corner, tapering inward. */
function lashLine({ cx, cy, rx, ry, tilt, sx, bulge = 0.0062, seg = 26 }) {
  const top = [], bot = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = Math.PI * (1.02 - 1.04 * t);           // inner corner -> outer corner
    const k = 1.0 + 0.02 * Math.sin(t * Math.PI);
    const u = Math.cos(a) * rx * k;
    const v = Math.sin(a) * ry * k;
    const rot = (uu, vv) => {
      const u2 = uu * Math.cos(tilt) - vv * Math.sin(tilt);
      const v2 = uu * Math.sin(tilt) + vv * Math.cos(tilt);
      return [cx + u2, cy + v2];
    };
    const thick = 0.0042 * (0.55 + 0.45 * t) + 0.0016;
    const [x1, y1] = rot(u, v + thick * 0.2);
    const [x2, y2] = rot(u, v - thick);
    top.push(facePoint(x1, y1, bulge));
    bot.push(facePoint(x2, y2, bulge));
  }
  return surface([top, bot], { loop: false });
}

export function buildEyes() {
  const out = { whites: [], iris: [], lids: [], brows: [], highlight: [] };
  const eyeY = P.eyeY;
  const eyeX = P.eyeX * 0.99;
  const rx = P.eyeRx, ry = P.eyeRy;

  for (const sx of [-1, 1]) {
    const cx = sx * eyeX;
    const tilt = sx * 0.06;
    out.whites.push(conformedPatch({ cx, cy: eyeY, rx: rx * 1.52, ry: ry * 1.34, shape: 1.85, bulge: 0.0058, rings: 10, seg: 46, tilt }));
    out.lids.push(lashLine({ cx, cy: eyeY, rx: rx * 1.42, ry: ry * 1.26, tilt, sx, bulge: 0.0072 }));

    const ix = cx + sx * 0.0016, iy = eyeY + 0.0012;
    out.iris.push(conformedPatch({ cx: ix, cy: iy, rx: 0.0200, ry: 0.0218, shape: 1.60, bulge: 0.0090, rings: 8, seg: 34 }));
    out.highlight.push(conformedPatch({
      cx: ix - sx * 0.0050, cy: iy + 0.0058, rx: 0.0040, ry: 0.0042, shape: 1.5, bulge: 0.0100, rings: 4, seg: 16,
    }));

    {
      const n = 12;
      const top = [], bot = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const u = sx * lerp(0.012, 0.0845, t);
        const y = P.browY + 0.0035 + lerp(-0.0092, 0.0128, Math.pow(t, 0.85)) + Math.sin(t * Math.PI) * 0.0024;
        const thick = 0.0048 * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.5) * Math.PI * 0.5)) * (1 - 0.32 * t);
        top.push(facePoint(u, y + thick * 0.5, 0.0034));
        bot.push(facePoint(u, y - thick * 0.5, 0.0034));
      }
      out.brows.push(surface([top, bot], { loop: false }));
    }
  }
  return out;
}

/* ------------------------------------------------------------------- nose */
export function buildNose() {
  const rows = [];
  const steps = 10;
  const yTop = P.noseY + 0.031, yBot = P.noseY - 0.005;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = lerp(yTop, yBot, t);
    const w = 0.0060 + 0.0135 * Math.pow(t, 1.35);
    const out = 0.0010 + 0.0105 * Math.pow(t, 1.6);
    const pts = [];
    for (let j = 0; j < 20; j++) {
      const a = (j / 20) * TAU;
      const px = Math.cos(a) * w;
      const depth = out * Math.cos(a) * 0.5 + out * 0.55 - Math.abs(Math.cos(a)) * 0.0013;
      pts.push(facePoint(px, y + Math.sin(a) * w * 0.55, Math.max(0, depth)));
    }
    rows.push(pts);
  }
  return surface(rows, { loop: true, capStart: true, capEnd: true });
}

/* ------------------------------------------------------------------ mouth */
export function buildMouth() {
  const N = 44;
  const yc = P.mouthY;
  const halfW = 0.0605;
  const up = [], low = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = lerp(-halfW, halfW, u);
    const corner = Math.pow(Math.abs(2 * u - 1), 2.0) * 0.0175;
    const open = Math.sin(Math.PI * u);
    const yU = yc + corner + 0.0016 * open;
    const yL = yc + corner - 0.0105 * Math.pow(open, 0.8);
    up.push(facePoint(x, yU, 0.0011));
    low.push(facePoint(x, yL, 0.0011));
  }
  return {
    interior: surface([up, low], { loop: false }),
    // thin white tooth row along the upper edge of the smile
    teeth: surface([
      up.slice(6, up.length - 6).map((p) => p.clone()),
      up.slice(6, up.length - 6).map((p) => p.clone().add(V3(0, -0.0024, 0))),
    ], { loop: false }),
  };
}

/* ---------------------------------------------------------- face scars */
export function buildFaceScar() {
  const geoms = [];
  const cx = 0.0700, cy = P.eyeY - 0.0300;
  const main = [];
  const N = 6;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    main.push(facePoint(cx + lerp(-0.0026, 0.0056, t), cy + lerp(0.0105, -0.0085, t), 0.0020));
  }
  geoms.push(surface([
    main.map((p) => p.clone().add(V3(0.0017, 0, 0))),
    main.map((p) => p.clone().add(V3(-0.0017, 0, 0))),
  ], { loop: false }));

  const ribbon = (a, b, w) => {
    const rows = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      rows.push([facePoint(x - w, y, 0.0022), facePoint(x + w, y, 0.0022)]);
    }
    return surface(rows, { loop: false });
  };
  geoms.push(ribbon([cx - 0.0050, cy + 0.0058], [cx + 0.0046, cy + 0.0010]));
  geoms.push(ribbon([cx - 0.0046, cy - 0.0030], [cx + 0.0050, cy - 0.0082]));
  return geoms;
}

/* ------------------------------------------------------------------- ears */
export function buildEars() {
  const geoms = [];
  const earY = P.earY;
  for (const sx of [-1, 1]) {
    const cx = sx * 0.1105;
    const rows = [];
    const NS = 18;
    for (let i = 0; i <= NS; i++) {
      const t = i / NS;
      const bulge = Math.sin(t * Math.PI) * 0.0080;
      const w = 0.0160 * Math.sin(Math.min(1, t * 1.25) * Math.PI) + 0.001;
      const h = 0.0410 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.92) + 0.002;
      const pts = [];
      for (let j = 0; j < 18; j++) {
        const b = (j / 18) * TAU;
        const y = earY - 0.004 + Math.sin(b) * h;
        const z = -0.013 + Math.cos(b) * w;
        const x = cx + sx * (bulge * Math.cos(b) * 0.55 + 0.002);
        pts.push(V3(x, y, z));
      }
      rows.push(pts);
    }
    geoms.push(surface(rows, { loop: true, capStart: true, capEnd: true }));

    const inner = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const pts = [];
      for (let j = 0; j < 16; j++) {
        const b = (j / 16) * TAU;
        const k = 0.30 + 0.62 * t;
        pts.push(V3(
          cx + sx * (0.0048 + 0.0024 * t) + sx * Math.cos(b) * 0.0018,
          earY - 0.006 + Math.sin(b) * 0.028 * k,
          -0.011 + Math.cos(b) * 0.0105 * k,
        ));
      }
      inner.push(pts);
    }
    geoms.push(surface(inner, { loop: true, capStart: true, capEnd: true }));
  }
  return geoms;
}

/* ------------------------------------------------------------------- hair */
/**
 * Flattened hair clump that hugs a surface: a lens-shaped cross-section swept
 * along a path, tapering to a point. frameFn(t) -> {c, tangent, normal, w, th}
 */
function clump({ rows, radial = 12 }) {
  const rings = [];
  for (const { c, tangent, normal, w, th } of rows) {
    const pts = [];
    const bin = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * TAU;
      const cu = Math.cos(a), su = Math.sin(a);
      // squarish lens so the clump has a flat face and a defined edge
      const r = Math.pow(Math.pow(Math.abs(cu), 2.6) + Math.pow(Math.abs(su), 2.6), -1 / 2.6);
      pts.push(c.clone()
        .addScaledVector(bin, cu * r * w)
        .addScaledVector(normal, su * r * th));
    }
    rings.push(pts);
  }
  return surface(rings, { loop: true, capStart: true, capEnd: true });
}

function faceFrame(x, y, off) {
  const c = facePoint(x, y, off);
  const n = faceNormal(x, y);
  const tangent = V3(1, 0, 0);
  tangent.sub(n.clone().multiplyScalar(tangent.dot(n))).normalize();
  return { c, tangent, normal: n };
}

/** A fringe strand running down the forehead from (x0,y0) to (x1,y1). */
function fringeStrand(x0, y0, x1, y1, { w0 = 0.021, lift = 0.011, steps = 8 } = {}) {
  // sample the spine first, then derive a proper frame along the travel direction
  const spine = [], normals = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = lerp(x0, x1, t) + Math.sin(t * Math.PI) * 0.004 * Math.sign(x1 - x0 || 1);
    const y = lerp(y0, y1, Math.pow(t, 0.95));
    const off = 0.004 + lift * Math.pow(t, 1.7);
    spine.push(facePoint(x, y, off));
    normals.push(faceNormal(x, y));
  }
  const rows = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(steps, i + 1)];
    const tangent = b.clone().sub(a).normalize();
    let n = normals[i].clone();
    n.sub(tangent.clone().multiplyScalar(n.dot(tangent))).normalize();
    const taper = t < 0.60 ? 1 - 0.08 * t : lerp(0.95, 0.05, (t - 0.60) / 0.40);
    rows.push({
      c: spine[i], tangent, normal: n,
      w: w0 * taper,
      th: lerp(0.0110, 0.0024, Math.pow(t, 0.8)),
    });
  }
  return clump({ rows });
}

/** A clump on the side/back of the head running from (theta0,y0) to (theta1,y1). */
function sideStrand(th0, y0, th1, y1, { w0 = 0.019, w1 = 0.004, lift = 0.010, steps = 6 } = {}) {
  const rows = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const th = lerp(th0, th1, t);
    const y = lerp(y0, y1, Math.pow(t, 0.95));
    const off = 0.005 + lift * Math.pow(t, 1.5);
    const c = headPoint(th, y, off);
    const n = c.clone().sub(V3(0, y, 0)).setY(0).normalize();
    const tangent = V3(0, 1, 0).sub(n.clone().multiplyScalar(n.y)).normalize().negate();
    const taper = t < 0.55 ? 1 - 0.12 * t : lerp(0.93, 0.0, (t - 0.55) / 0.45);
    const w = w0 * taper;
    const th_ = lerp(0.0105, 0.0022, Math.pow(t, 0.8));
    rows.push({ c, tangent, normal: n, w, th: th_ });
  }
  return clump({ rows });
}

/** Height of the hairline for a given angle around the head. */
function hairlineY(theta) {
  const a = Math.abs(angDiff(theta, 0));
  let y = 1.712;
  y -= 0.050 * smoothstep(0.45, 1.45, a);
  y -= 0.115 * smoothstep(1.30, 2.85, a);
  y += 0.010 * Math.cos(a * 3.1);
  return y;
}

export function buildHair() {
  const geoms = [];
  const NU = 100, NV = 20;
  const capRows = [];
  const topY = CHIN + HH + 0.008;
  for (let i = 0; i <= NV; i++) {
    const v = i / NV;
    const pts = [];
    for (let j = 0; j < NU; j++) {
      const th = (j / NU) * TAU;
      const y0 = hairlineY(th);
      const y = lerp(y0, topY - 0.008 * (1 - v), Math.pow(v, 0.85));
      const grow = 0.0065 + 0.0135 * Math.pow(v, 0.8);
      pts.push(headPoint(th, Math.min(y, CHIN + HH + 0.006), grow));
    }
    capRows.push(pts);
  }
  geoms.push(surface(capRows, { loop: true, capStart: false, capEnd: true }));

  // thickness at the hairline
  {
    const rim = [
      capRows[0].map((p) => p.clone()),
      capRows[0].map((p) => {
        const n = p.clone().sub(V3(0, p.y, 0)).normalize();
        return p.clone().addScaledVector(n, -0.010).add(V3(0, 0.004, 0));
      }),
    ];
    geoms.push(surface(rim, { loop: true }));
  }

  // ---- fringe: broad strands sweeping down over the forehead
  const fringe = [
    // x0, y0, x1, y1, root width
    [-0.108, 1.702, -0.106, 1.690, 0.036],
    [-0.078, 1.708, -0.072, 1.697, 0.042],
    [-0.046, 1.713, -0.038, 1.706, 0.042],
    [-0.014, 1.716, -0.006, 1.708, 0.038],
    [0.018, 1.714, 0.014, 1.702, 0.038],
    [0.048, 1.712, 0.056, 1.704, 0.042],
    [0.078, 1.708, 0.090, 1.694, 0.042],
    [0.106, 1.702, 0.116, 1.688, 0.036],
  ];
  for (const [x0, y0, x1, y1, w] of fringe) {
    geoms.push(fringeStrand(x0, y0, x1, y1, { w0: w, lift: 0.007 }));
  }
  // longer locks in front of the ears
  for (const sx of [-1, 1]) {
    geoms.push(fringeStrand(sx * 0.104, 1.696, sx * 0.118, 1.632, { w0: 0.028, lift: 0.009 }));
  }

  // ---- side & back clumps that flick outward
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    if (Math.abs(angDiff(a, 0)) < 1.15) continue;
    const y0 = hairlineY(a) + 0.030;
    const y1 = hairlineY(a) - 0.030 + (i % 3) * 0.012;
    const flare = 0.10 + 0.05 * ((i * 7) % 5) / 5;
    geoms.push(sideStrand(a, y0, a + flare, y1, { w0: 0.028, w1: 0.006, lift: 0.012 }));
    geoms.push(sideStrand(a + 0.17, y0 - 0.020, a + 0.28, y1 - 0.008, { w0: 0.024, w1: 0.005, lift: 0.011 }));
  }
  // sharp spikes breaking the silhouette above the ears
  for (const sx of [-1, 1]) {
    for (const [aa, yy, ll] of [[1.30, 1.716, 0.048], [1.55, 1.694, 0.044], [1.75, 1.676, 0.040], [1.05, 1.730, 0.040]]) {
      const th = sx * aa;
      const p = headPoint(th, yy, 0.010);
      const out = V3(Math.sin(th), 0.24, Math.cos(th)).normalize();
      const pts = [], radii = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        pts.push(p.clone().addScaledVector(out, ll * t).add(V3(sx * 0.012 * t * t, -0.030 * t * t, -0.010 * t * t)));
        radii.push(0.0155 * Math.pow(1 - t, 0.62) + 0.0006);
      }
      const st = pathStations(pts, radii, { up: V3(0, 1, 0) });
      geoms.push(tube(st, 10, { capStart: true, capEnd: true }));
    }
  }

  // ---- crown tufts: short, swept back, hugging the skull
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.3;
    const p = headPoint(a, CHIN + HH * 0.945, 0.012);
    const out = V3(Math.sin(a), 0, Math.cos(a));
    const dir = out.clone().multiplyScalar(0.72).add(V3(0, 0.42, 0)).normalize();
    const pts = [], radii = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      pts.push(p.clone()
        .addScaledVector(dir, 0.030 * t)
        .addScaledVector(out, -0.010 * t * t)
        .add(V3(0, -0.004 * t * t, 0)));
      radii.push(0.0115 * Math.pow(1 - t, 0.7) + 0.0006);
    }
    const st = pathStations(pts, radii, { up: V3(0, 1, 0) });
    geoms.push(tube(st, 10, { capStart: true, capEnd: true }));
  }
  return geoms;
}

/* -------------------------------------------------------------- straw hat */
export const HAT = { tilt: 0.030, brimY: 1.8060, cz: -0.016, crownR: 0.1125, brimR: 0.2465 };

export function buildHat() {
  const parts = { straw: [], band: [] };
  const tiltM = new THREE.Matrix4().makeRotationX(HAT.tilt);
  const pivot = V3(0, HAT.brimY, HAT.cz);
  const place = (p) => p.clone().sub(pivot).applyMatrix4(tiltM).add(pivot);

  // ---- crown
  const crownProfile = [
    [0.1120, 1.7935], [0.1145, 1.8050], [0.1165, 1.8185], [0.1175, 1.8340],
    [0.1168, 1.8495], [0.1135, 1.8640], [0.1062, 1.8765], [0.0948, 1.8865],
    [0.0782, 1.8938], [0.0572, 1.8978], [0.0316, 1.8992], [0.0080, 1.8972],
  ];
  {
    const rings = [];
    for (const [r, y] of crownProfile) {
      const pts = [];
      for (let j = 0; j < 72; j++) {
        const a = (j / 72) * TAU;
        const wob = 1 + 0.0045 * Math.sin(a * 11 + y * 90);
        pts.push(place(V3(Math.cos(a) * r * wob, y, Math.sin(a) * r * wob + HAT.cz)));
      }
      rings.push(pts);
    }
    parts.straw.push(surface(rings, { loop: true, capStart: false, capEnd: true }));

    // modelled weave ridges around the crown
    for (let k = 0; k < 26; k++) {
      const y = lerp(1.8040, 1.9110, k / 25);
      // local crown radius at this height
      let rr = 0.1045;
      for (let i = 0; i < crownProfile.length - 1; i++) {
        const [r0, y0] = crownProfile[i], [r1, y1] = crownProfile[i + 1];
        if (y >= y0 && y <= y1) { rr = lerp(r0, r1, (y - y0) / (y1 - y0)); break; }
        rr = crownProfile[crownProfile.length - 1][0];
      }
      const pts = [];
      for (let j = 0; j < 72; j++) {
        const a = (j / 72) * TAU;
        pts.push(place(V3(Math.cos(a) * (rr + 0.0012), y, Math.sin(a) * (rr + 0.0012) + HAT.cz)));
      }
      const pts2 = [];
      for (let j = 0; j < 72; j++) {
        const a = (j / 72) * TAU;
        pts2.push(place(V3(Math.cos(a) * (rr + 0.0034), y + 0.0038, Math.sin(a) * (rr + 0.0034) + HAT.cz)));
      }
      parts.straw.push(surface([pts, pts2], { loop: true }));
    }
  }

  // ---- brim
  {
    const steps = 20, SEG = 120, rIn = 0.1195, rOut = HAT.brimR;
    const topRings = [], botRings = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = lerp(rIn, rOut, t);
      const ro = [], rb = [];
      for (let j = 0; j < SEG; j++) {
        const a = (j / SEG) * TAU;
        const droop = -0.052 * Math.pow(t, 1.90);
        const wave = 0.0105 * t * t * Math.sin(a * 2.0 + 0.7) + 0.0045 * t * t * Math.sin(a * 3.0 - 0.4);
        const y = 1.8090 + droop + wave;
        const thick = 0.0038 - 0.0022 * t;
        const wob = 1 + 0.0035 * Math.sin(a * 15);
        const x = Math.cos(a) * r * wob;
        const z = Math.sin(a) * r * wob + HAT.cz;
        ro.push(place(V3(x, y + thick, z)));
        rb.push(place(V3(x, y - thick, z)));
      }
      topRings.push(ro);
      botRings.push(rb);
    }
    parts.straw.push(surface([...topRings, ...botRings.slice().reverse()], { loop: true, capStart: false, capEnd: false }));

    // radial weave ridges on the brim
    for (let k = 0; k < 56; k++) {
      const a = (k / 56) * TAU;
      const pts = [], pts2 = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const r = lerp(0.105, rOut - 0.002, t);
        const droop = -0.052 * Math.pow(t, 1.90);
        const wave = 0.0105 * t * t * Math.sin(a * 2.0 + 0.7) + 0.0045 * t * t * Math.sin(a * 3.0 - 0.4);
        const y = 1.8090 + droop + wave;
        pts.push(place(V3(Math.cos(a) * r, y + 0.0042, Math.sin(a) * r + HAT.cz)));
        pts2.push(place(V3(Math.cos(a + 0.035) * r, y + 0.0016, Math.sin(a + 0.035) * r + HAT.cz)));
      }
      parts.straw.push(surface([pts, pts2], { loop: false }));
    }
  }

  // ---- red band
  {
    const rows = [[1.7880, 0.1232], [1.8050, 0.1247], [1.8220, 0.1252]];
    const rings = [];
    for (const [y, r] of rows) {
      const pts = [];
      for (let j = 0; j < 72; j++) {
        const a = (j / 72) * TAU;
        pts.push(place(V3(Math.cos(a) * r, y, Math.sin(a) * r + HAT.cz)));
      }
      rings.push(pts);
    }
    parts.band.push(surface(rings, { loop: true }));
    for (const [y, r, flip] of [[1.7880, 0.1232, false], [1.8220, 0.1252, true]]) {
      const a1 = [], a2 = [];
      for (let j = 0; j < 72; j++) {
        const a = (j / 72) * TAU;
        a1.push(place(V3(Math.cos(a) * (r - 0.0060), y, Math.sin(a) * (r - 0.0060) + HAT.cz)));
        a2.push(place(V3(Math.cos(a) * r, y, Math.sin(a) * r + HAT.cz)));
      }
      parts.band.push(surface(flip ? [a2, a1] : [a1, a2], { loop: true }));
    }
  }
  return parts;
}
