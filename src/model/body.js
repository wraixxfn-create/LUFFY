/**
 * body.js — Luffy's bare anatomy.
 *
 * The torso is defined analytically (torsoPoint) so clothing, scars and the
 * sash can conform to exactly the same surface. Limbs are lofted along spline
 * paths with parallel-transport frames. Head lives in head.js.
 */
import * as THREE from 'three';
import { V3, TAU, curve, surface, tube, pathStations, gauss, smoothstep, clamp, lerp } from './lib/geom.js';
import { P } from './proportions.js';

export const TORSO_SEG = 64;

const rxCurve = curve([
  [0.790, 0.068], [0.820, 0.079], [0.845, 0.089], [0.870, 0.099],
  [0.895, 0.111], [0.920, 0.127], [0.950, 0.145], [0.985, 0.142],
  [1.020, 0.132], [1.055, 0.126], [1.090, 0.127], [1.130, 0.133],
  [1.170, 0.141], [1.215, 0.150], [1.260, 0.163], [1.300, 0.170],
  [1.335, 0.182], [1.365, 0.182], [1.390, 0.170], [1.412, 0.140],
  [1.432, 0.092], [1.446, 0.055],
]);
const rzCurve = curve([
  [0.790, 0.056], [0.820, 0.061], [0.845, 0.067], [0.870, 0.073],
  [0.895, 0.079], [0.920, 0.085], [0.950, 0.095], [0.985, 0.097],
  [1.020, 0.091], [1.055, 0.088], [1.090, 0.088], [1.130, 0.091],
  [1.170, 0.096], [1.215, 0.102], [1.260, 0.107], [1.300, 0.111],
  [1.335, 0.113], [1.365, 0.110], [1.390, 0.103], [1.412, 0.092],
  [1.432, 0.074], [1.446, 0.050],
]);

const angDiff = (a, b) => {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

/** Surface deformation (metres along the outward radial direction). */
function torsoDeform(theta, y) {
  const th = Math.atan2(Math.sin(theta), Math.cos(theta)); // -PI..PI, 0 = front
  let d = 0;

  // ---- pectorals
  const pecY = smoothstep(1.245, 1.325, y) * (1 - smoothstep(1.385, 1.425, y));
  d += 0.0290 * gauss(angDiff(th, 0.50), 0.42) * pecY;
  d += 0.0290 * gauss(angDiff(th, -0.50), 0.42) * pecY;
  d -= 0.0078 * gauss(th, 0.10) * smoothstep(1.26, 1.33, y) * (1 - smoothstep(1.38, 1.42, y)); // sternum
  d -= 0.0040 * gauss(th, 0.52) * gauss(y - 1.278, 0.017);  // pec underline

  // ---- abdominals (three rows)
  for (const ay of [1.150, 1.215, 1.278]) {
    const row = gauss(y - ay, 0.024) * smoothstep(1.085, 1.125, y);
    d += 0.0080 * gauss(angDiff(th, 0.30), 0.19) * row;
    d += 0.0080 * gauss(angDiff(th, -0.30), 0.19) * row;
  }
  d -= 0.0034 * gauss(th, 0.075) * smoothstep(1.10, 1.15, y) * (1 - smoothstep(1.28, 1.33, y)); // linea alba

  // ---- obliques / serratus
  d += 0.0048 * gauss(angDiff(th, 1.08), 0.30) * gauss(y - 1.20, 0.060);
  d += 0.0048 * gauss(angDiff(th, -1.08), 0.30) * gauss(y - 1.20, 0.060);
  d -= 0.0032 * gauss(angDiff(th, 1.35), 0.22) * gauss(y - 1.17, 0.038);

  // ---- buttocks
  const by = smoothstep(0.925, 0.975, y) * (1 - smoothstep(1.010, 1.055, y));
  d += 0.020 * gauss(angDiff(th, Math.PI - 0.44), 0.36) * by;
  d += 0.020 * gauss(angDiff(th, -Math.PI + 0.44), 0.36) * by;
  d -= 0.008 * gauss(angDiff(th, Math.PI), 0.11) * by;

  // ---- collar bones & trapezius
  d -= 0.0048 * gauss(angDiff(th, 0.66), 0.26) * gauss(y - 1.400, 0.013);
  d -= 0.0048 * gauss(angDiff(th, -0.66), 0.26) * gauss(y - 1.400, 0.013);
  d += 0.0062 * gauss(angDiff(th, Math.PI - 0.6), 0.42) * gauss(y - 1.425, 0.032);

  // ---- small of the back
  d -= 0.0042 * gauss(angDiff(th, Math.PI), 0.55) * gauss(y - 1.07, 0.038);
  return d;
}

/** Point on the torso skin. theta: 0 = front, PI/2 = character's left (+X). */
export function torsoPoint(theta, y, off = 0) {
  const rx = rxCurve(y), rz = rzCurve(y);
  const e = 2.30;
  const s = Math.sin(theta), c = Math.cos(theta);
  const p = 2 / e;
  const x = rx * Math.sign(s) * Math.pow(Math.abs(s), p);
  const z = rz * Math.sign(c) * Math.pow(Math.abs(c), p);
  let nx = x / (rx * rx), nz = z / (rz * rz);
  const nl = Math.hypot(nx, nz) || 1;
  nx /= nl; nz /= nl;
  const d = torsoDeform(theta, y) + off;
  return V3(x + nx * d, y, z + nz * d);
}

/** Approximate silhouette radii of the torso at height y. */
export function torsoRadii(y) {
  return { rx: rxCurve(y), rz: rzCurve(y) };
}

export function torsoNormal(theta, y) {
  const a = torsoPoint(theta + 0.02, y + 0.004);
  const b = torsoPoint(theta - 0.02, y - 0.004);
  const c = torsoPoint(theta + 0.02, y - 0.004);
  const d = torsoPoint(theta - 0.02, y + 0.004);
  const n = new THREE.Vector3().crossVectors(a.sub(b), c.sub(d)).normalize();
  const p = torsoPoint(theta, y);
  if (n.dot(V3(p.x, 0, p.z)) < 0) n.negate();
  return n;
}

export function buildTorso() {
  const rings = [];
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const y = lerp(0.788, 1.447, i / steps);
    const r = [];
    for (let j = 0; j < TORSO_SEG; j++) r.push(torsoPoint((j / TORSO_SEG) * TAU, y));
    rings.push(r);
  }
  return surface(rings, { loop: true, capStart: true, capEnd: true });
}

export function buildNeck() {
  const stations = [];
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = lerp(1.392, 1.520, t);
    const r = lerp(0.086, 0.062, Math.pow(t, 0.75));
    stations.push({
      p: V3(0, y, -0.010 - 0.006 * t),
      u: V3(1, 0, 0), v: V3(0, 0, 1),
      rx: r * 1.05, rz: r,
    });
  }
  return tube(stations, 32, { capStart: true, capEnd: true });
}

/* ------------------------------------------------------------------ arms */
const ARM_PATH = [
  [0.176, 1.402, -0.004, 0.0690],
  [0.190, 1.350, -0.004, 0.0690],
  [0.197, 1.285, -0.002, 0.0630],
  [0.202, 1.215, 0.001, 0.0560],
  [0.206, 1.145, 0.004, 0.0490],
  [0.209, 1.090, 0.007, 0.0428],
  [0.213, 1.030, 0.010, 0.0438],
  [0.218, 0.965, 0.012, 0.0392],
  [0.222, 0.912, 0.013, 0.0337],
  [0.225, 0.872, 0.013, 0.0307],
  [0.227, 0.848, 0.013, 0.0297],
];

export const WRIST = { x: 0.227, y: 0.848, z: 0.013 };

export function buildArm(side) {
  const pts = [], radii = [];
  for (const [x, y, z, r] of ARM_PATH) {
    pts.push(V3(side * x, y, z));
    radii.push([r, r * 0.94]);
  }
  const stations = pathStations(pts, radii, { up: V3(0, 0, 1) });
  return tube(stations, 30, { capStart: true, capEnd: false });
}

/** Deltoid cap blended over the shoulder joint. */
export function buildDeltoid(side) {
  const rings = [];
  const steps = 16;
  const cx = side * 0.172, cy = 1.372, cz = -0.004;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const phi = (t * Math.PI) / 2;
    const r = 0.064 * Math.cos(phi) + 0.004;
    const off = 0.062 * Math.sin(phi);
    const pts = [];
    for (let j = 0; j < 28; j++) {
      const th = (j / 28) * TAU;
      const lx = Math.cos(th) * r * 0.86;
      const lz = Math.sin(th) * r * 1.04;
      pts.push(V3(cx + side * off * 0.95, cy + lx + 0.012, cz + lz));
    }
    rings.push(pts);
  }
  return surface(rings, { loop: true, capStart: true, capEnd: true });
}

/* ------------------------------------------------------------------ hands */
/**
 * Hand built in a wrist frame: a palm that widens from the wrist to the
 * knuckles, four tapering fingers that start inside the palm, and a thumb
 * that grows out of the radial side. Everything overlaps so it reads as one
 * continuous surface.
 */
export function buildHand(side) {
  const s = side;
  const wrist = V3(s * WRIST.x, WRIST.y, WRIST.z);
  const down = V3(s * 0.055, -1, 0.035).normalize();          // finger direction
  const palm = V3(-s * 0.55, 0, -0.84);                       // palm faces back / inward
  palm.sub(down.clone().multiplyScalar(palm.dot(down))).normalize();
  const fwd = new THREE.Vector3().crossVectors(down, palm).normalize(); // across the fingers
  const geoms = [];

  const palmLen = 0.092;

  // ---- palm: rounded, widening slab
  const palmRings = [];
  const PT = 18;
  for (let i = 0; i <= PT; i++) {
    const t = i / PT;
    // wrist (0) -> knuckles (1)
    const tEnd = smoothstep(0.84, 1.0, t);
    const w = lerp(0.0300, 0.0450, Math.pow(t, 0.55)) * (1 - 0.42 * tEnd);
    const th = lerp(0.0152, 0.0172, Math.sin(t * Math.PI * 0.8)) * (1 - 0.05 * t) * (1 - 0.35 * tEnd);
    const c = wrist.clone().addScaledVector(down, t * palmLen)
      .addScaledVector(palm, -0.0025 * Math.sin(t * Math.PI));
    const pts = [];
    for (let j = 0; j < 26; j++) {
      const a = (j / 26) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const r = Math.pow(Math.pow(Math.abs(ca), 2.6) + Math.pow(Math.abs(sa), 2.6), -1 / 2.6);
      pts.push(c.clone()
        .addScaledVector(palm, ca * r * th)
        .addScaledVector(fwd, sa * r * w));
    }
    palmRings.push(pts);
  }
  geoms.push(surface(palmRings, { loop: true, capStart: true, capEnd: true }));

  // ---- fingers
  const fingerDefs = [
    // across-hand offset, length, radius, lateral splay
    [-0.0305, 0.064, 0.0112, -0.05],
    [-0.0102, 0.071, 0.0118, -0.015],
    [0.0106, 0.066, 0.0114, 0.02],
    [0.0302, 0.055, 0.0104, 0.06],
  ];
  for (const [zo, len, rad, splay] of fingerDefs) {
    const knuckle = wrist.clone()
      .addScaledVector(down, palmLen - 0.030)
      .addScaledVector(fwd, zo);
    const dir = down.clone().addScaledVector(fwd, splay * 0.5).normalize();
    const curl = palm.clone().multiplyScalar(-1);
    const segs = 9;
    const pts = [], radii = [];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const bend = 0.42 * t * t;                       // natural relaxed curl
      const d2 = dir.clone().addScaledVector(curl, bend).normalize();
      const p = knuckle.clone().addScaledVector(d2, (len + 0.030) * t);
      pts.push(p);
      // slight bulge over the knuckle, taper to a rounded tip
      const profile = t < 0.30 ? lerp(0.80, 1.0, t / 0.30) : 1.0;
      radii.push(rad * profile * (1 - 0.26 * Math.pow(t, 1.4)));
    }
    const st = pathStations(pts, radii, { up: fwd });
    geoms.push(tube(st, 14, { capStart: true, capEnd: true }));
  }

  // ---- thumb: radial side, angled forward and down
  {
    const base = wrist.clone()
      .addScaledVector(down, palmLen * 0.26)
      .addScaledVector(fwd, 0.030)
      .addScaledVector(palm, 0.002);
    const dir = down.clone().multiplyScalar(0.72).addScaledVector(fwd, 0.60).normalize();
    const segs = 8;
    const pts = [], radii = [];
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const d2 = dir.clone().addScaledVector(down, 0.55 * t * t).normalize();
      pts.push(base.clone().addScaledVector(d2, 0.050 * t));
      radii.push(0.0128 * (1 - 0.22 * Math.pow(t, 1.2)));
    }
    const st = pathStations(pts, radii, { up: palm });
    geoms.push(tube(st, 14, { capStart: true, capEnd: true }));
  }
  return geoms;
}

/* ------------------------------------------------------------------- legs */
const LEG_PATH = [
  [0.090, 0.910, 0.004, 0.0990],
  [0.092, 0.860, 0.004, 0.0965],
  [0.094, 0.790, 0.003, 0.0875],
  [0.095, 0.710, 0.002, 0.0815],
  [0.094, 0.630, 0.001, 0.0745],
  [0.092, 0.550, 0.000, 0.0675],
  [0.090, 0.480, -0.002, 0.0615],
  [0.089, 0.425, -0.007, 0.0685],
  [0.088, 0.365, -0.010, 0.0685],
  [0.087, 0.300, -0.009, 0.0555],
  [0.086, 0.238, -0.006, 0.0460],
  [0.086, 0.182, -0.002, 0.0382],
  [0.0855, 0.140, 0.001, 0.0350],
  [0.0850, 0.100, 0.004, 0.0338],
  [0.0845, 0.062, 0.008, 0.0300],
  [0.0840, 0.062, 0.008, 0.0285],
];

export function buildLeg(side) {
  const pts = [], radii = [];
  for (const [x, y, z, r] of LEG_PATH) {
    pts.push(V3(side * x, y, z));
    radii.push([r * 0.94, r]);
  }
  const stations = pathStations(pts, radii, { up: V3(0, 0, 1) });
  return tube(stations, 32, { capStart: true, capEnd: false });
}

/* ------------------------------------------------------------------- feet */
const SOLE_Y = 0.028;

// z, half width, top height  (heel -> ball of the foot)
const FOOT_STATIONS = [
  // z, half width, top height  (heel -> ball; the toes are added separately)
  [-0.090, 0.016, 0.070],
  [-0.076, 0.027, 0.086],
  [-0.058, 0.034, 0.094],
  [-0.034, 0.038, 0.095],
  [-0.008, 0.040, 0.090],
  [0.020, 0.043, 0.081],
  [0.048, 0.046, 0.070],
  [0.074, 0.048, 0.060],
  [0.096, 0.049, 0.053],
  [0.112, 0.048, 0.048],
];

/** Flat-bottomed foot: rounded on top, sitting on the sandal sole. */
export function buildFoot(side) {
  const geoms = [];
  const baseX = side * P.ankleX;

  const rings = [];
  for (const [z, rx, top] of FOOT_STATIONS) {
    const h = top - SOLE_Y;
    const pts = [];
    for (let j = 0; j < 30; j++) {
      const a = (j / 30) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const x = rx * ca * (0.98 + 0.05 * Math.max(0, -sa));
      const y = sa >= 0
        ? SOLE_Y + h * Math.pow(sa, 0.85)
        : SOLE_Y - 0.0012 * Math.pow(-sa, 0.6);
      pts.push(V3(baseX + x, y, z + 0.008));
    }
    rings.push(pts);
  }
  geoms.push(surface(rings, { loop: true, capStart: true, capEnd: true }));

  // toes — index 0 is the big toe, on the medial side
  const toeDefs = [
    // [medial offset, radius, length, height]
    [0.0330, 0.0138, 0.036, 0.0160],
    [0.0105, 0.0118, 0.032, 0.0142],
    [-0.0110, 0.0106, 0.028, 0.0128],
    [-0.0285, 0.0094, 0.023, 0.0114],
    [-0.0410, 0.0082, 0.018, 0.0100],
  ];
  for (const [mo, rad, len, hgt] of toeDefs) {
    const cx = baseX - side * mo;
    const z0 = 0.104 + 0.008;
    const steps = 9;
    const rows = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cz = z0 + t * len;
      const rr = rad * Math.pow(Math.max(0.02, 1 - t * t), 0.55);
      const pts = [];
      for (let j = 0; j < 16; j++) {
        const a = (j / 16) * TAU;
        const ca = Math.cos(a), sa = Math.sin(a);
        const y = SOLE_Y + hgt * (0.55 + 0.45 * sa) * (1 - 0.35 * t)
          + 0.0016 * Math.max(0, -sa);
        pts.push(V3(cx + ca * rr, Math.max(SOLE_Y - 0.001, y), cz + sa * rr * 0.9));
      }
      rows.push(pts);
    }
    geoms.push(surface(rows, { loop: true, capStart: true, capEnd: true }));
  }
  return geoms;
}

export { SOLE_Y };
