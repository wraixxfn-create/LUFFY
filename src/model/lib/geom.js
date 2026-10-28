/**
 * geom.js — small procedural modelling toolkit.
 *
 * Everything in the model is built from parametric "rings" (ordered point
 * loops). Rings can be lofted into a single-sided surface, or paired
 * inner/outer to build a real shell with thickness (garments).
 *
 * All resulting geometry is indexed quads turned into triangles, with
 * shared vertices along the seam so smooth normals stay continuous.
 */
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const gauss = (x, s) => Math.exp(-(x * x) / (2 * s * s));

/** Monotone cubic interpolation (Fritsch–Carlson) — smooth, no overshoot. */
export function curve(keys) {
  const pts = keys.slice().sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d = new Array(n - 1);
  const m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) * 0.5;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

/** Signed superellipse coordinate: t = 0 -> front (+Z), t = PI/2 -> +X. */
export function superellipse(t, rx, rz, e = 2) {
  const s = Math.sin(t);
  const c = Math.cos(t);
  const p = 2 / e;
  return [
    rx * Math.sign(s) * Math.pow(Math.abs(s), p),
    rz * Math.sign(c) * Math.pow(Math.abs(c), p),
  ];
}

/**
 * Build one ring of points.
 * opts: { origin, u, v, rx, rz, exp, warp(t, i) -> [dx, dz] extra offset }
 */
export function ring(n, { origin = V3(), u = V3(1, 0, 0), v = V3(0, 0, 1), rx = 1, rz = 1, exp = 2, warp = null } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    const [x, z] = superellipse(t, rx, rz, exp);
    const p = origin.clone().addScaledVector(u, x).addScaledVector(v, z);
    if (warp) {
      const [dx, dz] = warp(t, i) || [0, 0];
      p.addScaledVector(u, dx).addScaledVector(v, dz);
    }
    out.push(p);
  }
  return out;
}

/** Loft a list of equal-length point rings into a surface. */
export function surface(rings, { loop = true, capStart = false, capEnd = false } = {}) {
  const R = rings.length;
  const N = rings[0].length;
  const pos = [];
  for (const r of rings) for (const p of r) pos.push(p.x, p.y, p.z);
  const idx = [];
  const cols = loop ? N : N - 1;
  for (let r = 0; r < R - 1; r++) {
    for (let i = 0; i < cols; i++) {
      const j = (i + 1) % N;
      const a = r * N + i;
      const b = r * N + j;
      const c = (r + 1) * N + j;
      const d = (r + 1) * N + i;
      idx.push(a, b, c, a, c, d);
    }
  }
  const addCap = (ringIdx, flip) => {
    const base = pos.length / 3;
    const c = V3();
    const rr = rings[ringIdx];
    for (const p of rr) c.add(p);
    c.multiplyScalar(1 / N);
    pos.push(c.x, c.y, c.z);
    for (let i = 0; i < N; i++) {
      const a = ringIdx * N + i;
      const b = ringIdx * N + ((i + 1) % N);
      if (flip) idx.push(base, b, a);
      else idx.push(base, a, b);
    }
  };
  if (capStart) addCap(0, true);
  if (capEnd) addCap(R - 1, false);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Closed shell between an outer and an inner ring set (same ring count and
 * same points-per-ring). Produces thickness, rims and interior faces.
 */
export function shell(outer, inner, { loop = true, capStart = false, capEnd = false } = {}) {
  const R = outer.length;
  const N = outer[0].length;
  const pos = [];
  const push = (arr) => { for (const r of arr) for (const p of r) pos.push(p.x, p.y, p.z); };
  push(outer);
  push(inner);
  const off = R * N;
  const idx = [];
  const cols = loop ? N : N - 1;
  for (let r = 0; r < R - 1; r++) {
    for (let i = 0; i < cols; i++) {
      const j = (i + 1) % N;
      const a = r * N + i, b = r * N + j, c = (r + 1) * N + j, d = (r + 1) * N + i;
      // outer
      idx.push(a, b, c, a, c, d);
      // inner (reversed)
      idx.push(off + a, off + c, off + b, off + a, off + d, off + c);
    }
  }
  // rims at first and last ring
  for (let i = 0; i < cols; i++) {
    const j = (i + 1) % N;
    if (!capStart) {
      idx.push(i, off + i, off + j, i, off + j, j);
    }
    if (!capEnd) {
      const a = (R - 1) * N + i, b = (R - 1) * N + j;
      idx.push(a, b, off + b, a, off + b, off + a);
    }
  }
  // rims down the open sides (u open)
  if (!loop) {
    for (let r = 0; r < R - 1; r++) {
      const a = r * N, b = (r + 1) * N;
      idx.push(a, b, off + b, a, off + b, off + a);
      const a2 = r * N + (N - 1), b2 = (r + 1) * N + (N - 1);
      idx.push(a2, off + a2, off + b2, a2, off + b2, b2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Revolve a [radius, y] profile around Y. */
export function revolve(profile, segments = 48, { capBottom = false, capTop = false, exp = 2 } = {}) {
  const rings = profile.map(([r, y]) => ring(segments, { origin: V3(0, y, 0), rx: r, rz: r, exp }));
  return surface(rings, { loop: true, capStart: capBottom, capEnd: capTop });
}

/** Tube from a list of stations {p, rx, rz, u, v} with round caps option. */
export function tube(stations, segments = 20, opts = {}) {
  const rings = stations.map((s) => ring(segments, { origin: s.p, u: s.u, v: s.v, rx: s.rx, rz: s.rz, exp: s.exp ?? 2 }));
  return surface(rings, { loop: true, capStart: opts.capStart ?? true, capEnd: opts.capEnd ?? true });
}

/** Build a list of stations along a polyline using parallel-transport frames. */
export function pathStations(points, radii, { up = V3(0, 1, 0) } = {}) {
  const n = points.length;
  const frames = [];
  const tangents = [];
  for (let i = 0; i < n; i++) {
    let t;
    if (i === 0) t = points[1].clone().sub(points[0]);
    else if (i === n - 1) t = points[n - 1].clone().sub(points[n - 2]);
    else t = points[i + 1].clone().sub(points[i - 1]);
    t.normalize();
    tangents.push(t);
  }
  // initial frame
  let u = new THREE.Vector3().crossVectors(tangents[0], up);
  if (u.lengthSq() < 1e-6) u = new THREE.Vector3(1, 0, 0);
  u.normalize();
  let v = new THREE.Vector3().crossVectors(tangents[0], u).normalize();
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      // transport previous frame onto the new tangent
      const prevT = tangents[i - 1];
      const t = tangents[i];
      const axis = new THREE.Vector3().crossVectors(prevT, t);
      const len = axis.length();
      if (len > 1e-7) {
        axis.normalize();
        const ang = Math.acos(clamp(prevT.dot(t), -1, 1));
        u.applyAxisAngle(axis, ang);
        v.applyAxisAngle(axis, ang);
      }
    }
    // re-orthonormalise
    u.sub(tangents[i].clone().multiplyScalar(u.dot(tangents[i]))).normalize();
    v.crossVectors(tangents[i], u).normalize();
    const r = radii[i];
    const rx = typeof r === 'number' ? r : r[0];
    const rz = typeof r === 'number' ? r : r[1];
    frames.push({ p: points[i].clone(), u: u.clone(), v: v.clone(), rx, rz });
  }
  return frames;
}

export function mergeGeoms(geoms) {
  const pos = [];
  const idx = [];
  let off = 0;
  for (const g of geoms) {
    const p = g.getAttribute('position');
    const ix = g.getIndex();
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i), p.getZ(i));
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
    else for (let i = 0; i < p.count; i++) idx.push(i + off);
    off += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Rounded box-ish lofted blob. Used for palms, soles, small details. */
export function blob({ size = [1, 1, 1], segments = 24, ringsCount = 12, round = 0.5, taper = null } = {}) {
  const rings = [];
  for (let j = 0; j <= ringsCount; j++) {
    const v = j / ringsCount;
    const phi = (-Math.PI / 2) + Math.PI * v;
    const s = Math.cos(phi);
    const yy = Math.sin(phi);
    const p = Math.pow(Math.max(0, s), round);
    const k = taper ? taper(v) : 1;
    rings.push(ring(segments, {
      origin: V3(0, yy * size[1] * 0.5, 0),
      rx: size[0] * 0.5 * p * k,
      rz: size[2] * 0.5 * p * k,
    }));
  }
  rings[0] = rings[0].map(() => V3(0, -size[1] * 0.5, 0));
  rings[rings.length - 1] = rings[rings.length - 1].map(() => V3(0, size[1] * 0.5, 0));
  return surface(rings, { loop: true });
}

export function rotatePoint(p, axis, angle, origin = V3()) {
  return p.clone().sub(origin).applyAxisAngle(axis, angle).add(origin);
}

export function transformGeom(geom, matrix) {
  geom.applyMatrix4(matrix);
  return geom;
}
