/**
 * clothes.js — red vest + bell sleeves, blue shorts with frayed hem, yellow
 * sash, straw sandals. Garments are conformed to the body surfaces so nothing
 * floats or clips.
 */
import * as THREE from 'three';
import { V3, TAU, surface, shell, tube, pathStations, gauss, smoothstep, clamp, lerp } from './lib/geom.js';
import { torsoPoint, torsoNormal, torsoRadii } from './body.js';
import { P } from './proportions.js';

const angAbs = (theta) => Math.abs(Math.atan2(Math.sin(theta), Math.cos(theta)));

/* ------------------------------------------------------------------- vest */
const VEST_GAP = 0.50;
const VEST_BOTTOM = 0.975;      // front panel hem (hangs to the hip)
const VEST_TOP = 1.472;         // collar

const vestTop = (theta) => {
  const a = angAbs(theta);
  // high at the collar, sweeping smoothly down into the armhole
  return VEST_TOP - 0.030 * smoothstep(0.40, 1.30, a) - 0.050 * smoothstep(1.30, 2.30, a)
    + 0.010 * smoothstep(2.30, 3.14, a);
};

const vestBottom = (theta) => {
  const a = angAbs(theta);
  // long at the open front panels, short across the back (sash shows through)
  const long = 1 - smoothstep(0.55, 2.15, a);
  const base = lerp(1.212, VEST_BOTTOM, long);
  const edge = smoothstep(VEST_GAP + 0.9, VEST_GAP, a);
  return base - 0.030 * edge + 0.008 * Math.sin(a * 3.4 + 0.5) + 0.004 * Math.sin(a * 9.0);
};

export function buildVest() {
  const NU = 112, NV = 40;
  const outer = [], inner = [];
  for (let i = 0; i <= NV; i++) {
    const v = i / NV;
    const ro = [], ri = [];
    for (let j = 0; j <= NU; j++) {
      const u = j / NU;
      const theta = lerp(VEST_GAP, TAU - VEST_GAP, u);
      const yb = vestBottom(theta);
      const yt = vestTop(theta);
      const y = lerp(yb, yt, Math.pow(v, 0.92));
      const armhole = gauss(angAbs(theta) - Math.PI / 2, 0.34);
      const lowHang = smoothstep(1.24, 1.04, y) * (1 - smoothstep(1.95, 2.90, angAbs(theta)));
      const flare = 0.0055 + 0.0090 * Math.pow(1 - v, 2.6) + 0.020 * lowHang
        + 0.0022 * Math.sin(theta * 6.0) * (1 - v);
      const off = 0.0085 + flare - 0.0035 * armhole * (1 - v);
      ro.push(torsoPoint(theta, y, off + 0.0036));
      ri.push(torsoPoint(theta, y, off - 0.0036));
    }
    outer.push(ro); inner.push(ri);
  }
  return shell(outer, inner, { loop: false });
}

/** Four buttons on his right-hand vest panel. */
export function buildButtons() {
  const geoms = [];
  for (const y of [1.380, 1.305, 1.230, 1.155]) {
    const th = -0.50;
    const c = torsoPoint(th, y, 0.0175);
    const n = torsoNormal(th, y);
    const u = new THREE.Vector3(0, 1, 0).cross(n).normalize();
    const w = new THREE.Vector3().crossVectors(n, u);
    const rings = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const r = 0.0072 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5);
      const pts = [];
      for (let j = 0; j < 16; j++) {
        const a = (j / 16) * TAU;
        pts.push(c.clone()
          .addScaledVector(u, Math.cos(a) * r)
          .addScaledVector(w, Math.sin(a) * r)
          .addScaledVector(n, t * 0.0044));
      }
      rings.push(pts);
    }
    geoms.push(surface(rings, { loop: true, capStart: true, capEnd: true }));
  }
  return geoms;
}

/* ---------------------------------------------------------------- sleeves */
const armPathPoint = (side, y) => {
  const pts = [
    [0.170, 1.402], [0.185, 1.350], [0.193, 1.285], [0.199, 1.215], [0.205, 1.145],
    [0.209, 1.090], [0.213, 1.030], [0.218, 0.965], [0.222, 0.912], [0.225, 0.872],
  ];
  let i = 0;
  while (i < pts.length - 2 && y < pts[i + 1][1]) i++;
  const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
  const t = clamp((y - y0) / (y1 - y0), 0, 1);
  return V3(side * lerp(x0, x1, t), y, lerp(-0.004, 0.013, (1.402 - y) / 0.57));
};

export function buildSleeve(side) {
  // y, radius — the top ring tucks under the vest collar, then the sleeve runs
  // down the arm and flares into a bell cuff at the elbow.
  const prof = [
    [1.452, 0.0150], [1.442, 0.0330], [1.428, 0.0570], [1.414, 0.0725],
    [1.400, 0.0810], [1.370, 0.0815], [1.330, 0.0790], [1.280, 0.0762],
    [1.225, 0.0725], [1.180, 0.0695], [1.140, 0.0685], [1.105, 0.0700],
    [1.075, 0.0755], [1.048, 0.0830], [1.026, 0.0900],
  ];
  const NU = 52, NV = 34;
  const outer = [], inner = [];
  const dirDown = V3(side * 0.10, -1, 0.03).normalize();
  const u = new THREE.Vector3().crossVectors(dirDown, V3(0, 0, 1)).normalize();
  const w = new THREE.Vector3().crossVectors(u, dirDown).normalize();
  for (let i = 0; i <= NV; i++) {
    const v = i / NV;
    const fi = v * (prof.length - 1);
    const k = Math.min(prof.length - 2, Math.floor(fi));
    const tt = fi - k;
    const y = lerp(prof[k][0], prof[k + 1][0], tt);
    const rad = lerp(prof[k][1], prof[k + 1][1], tt);
    const c = armPathPoint(side, Math.min(y, 1.372)).add(V3(0, Math.max(0, y - 1.372), 0));
    const ro = [], ri = [];
    const ruffle = Math.pow(smoothstep(0.55, 1.0, v), 1.5);
    for (let j = 0; j <= NU; j++) {
      const a = (j / NU) * TAU;
      // shoulder section squashed slightly front-to-back, cuff rounder
      const rzScale = lerp(0.90, 0.97, smoothstep(1.40, 1.20, y));
      const rr = rad * (1 + ruffle * (0.11 * Math.sin(a * 5 + 0.6) + 0.045 * Math.sin(a * 11 + 2.1)) - 0.010 * Math.pow(v, 2));
      ro.push(c.clone().addScaledVector(u, Math.cos(a) * rr).addScaledVector(w, Math.sin(a) * rr * rzScale));
      const r2 = rr - 0.0065;
      ri.push(c.clone().addScaledVector(u, Math.cos(a) * r2).addScaledVector(w, Math.sin(a) * r2 * rzScale));
    }
    outer.push(ro); inner.push(ri);
  }
  return shell(outer, inner, { loop: true });
}

/* ------------------------------------------------------------------ shorts */
export function buildShorts() {
  const G = { waist: [], legs: [], hem: [] };
  const NU = 64;

  // ---- waistband fold (conformed to the body, tucked under the sash)
  {
    const rr = [];
    for (const [y, off] of [[1.094, 0.0100], [1.084, 0.0150], [1.070, 0.0185]]) {
      const o = [];
      for (let j = 0; j < NU; j++) o.push(torsoPoint((j / NU) * TAU, y, off));
      rr.push(o);
    }
    G.waist.push(shell(rr, rr.map((r) => r.map((p) => p.clone().multiplyScalar(0.95))), { loop: true }));
  }

  // ---- shorts body: two cones that start concentric at the waist and separate
  //      into the leg tubes at the hem (the fork is therefore always closed)
  const HEM_TOP = 0.660, HEM_BOT = 0.622;
  const legProf = [
    // y, centre x, radius, z-radius factor
    [1.088, 0.0000, 0.1235, 0.930],
    [1.050, 0.0040, 0.1295, 0.930],
    [1.010, 0.0125, 0.1355, 0.905],
    [0.968, 0.0250, 0.1380, 0.885],
    [0.924, 0.0420, 0.1370, 0.880],
    [0.880, 0.0560, 0.1305, 0.895],
    [0.838, 0.0675, 0.1210, 0.920],
    [0.795, 0.0780, 0.1005, 0.955],
    [0.755, 0.0845, 0.0920, 0.985],
    [0.712, 0.0890, 0.0865, 1.000],
    [0.686, 0.0905, 0.0848, 1.000],
    [0.664, 0.0915, 0.0835, 1.000],
  ];
  for (const side of [-1, 1]) {
    const ro = [], ri = [];
    for (const [y, cx, r, zf] of legProf) {
      const o = [], i2 = [];
      for (let j = 0; j < NU; j++) {
        const a = (j / NU) * TAU;
        // flatten the fabric slightly at the inside seam
        const inner = Math.max(0, -Math.cos(a)) * (1 - Math.min(1, cx / 0.08)) * 0.0;
        o.push(V3(side * cx + Math.cos(a) * r * 1.01, y, 0.002 - Math.sin(a) * r * zf));
        i2.push(V3(side * cx + Math.cos(a) * (r * 1.01 - 0.0085), y, 0.002 - Math.sin(a) * (r * zf - 0.0085 * zf)));
      }
      ro.push(o); ri.push(i2);
    }
    G.legs.push(shell(ro, ri, { loop: true }));

    const hemR = legProf[legProf.length - 1][2];
    const hemCx = legProf[legProf.length - 1][1];

    // ---- frayed white hem
    const hemRowsO = [], hemRowsI = [];
    const NHEM = 76, rowsH = 4;
    for (let i = 0; i <= rowsH; i++) {
      const t = i / rowsH;
      const o = [], i2 = [];
      for (let j = 0; j < NHEM; j++) {
        const a = (j / NHEM) * TAU;
        const jag = 0.0034 * Math.sin(a * 7 + i * 2.3) + 0.0018 * Math.sin(a * 17 + 1.1);
        const y = lerp(HEM_TOP, HEM_BOT, t) + (i === rowsH ? jag : 0);
        const base = hemR + 0.0020 + 0.0050 * Math.sin(a * 6 + 1.4) * t + 0.0020 * t;
        o.push(V3(side * hemCx + Math.cos(a) * base * 1.01, y, 0.002 - Math.sin(a) * base));
        i2.push(V3(side * hemCx + Math.cos(a) * (base * 1.01 - 0.0075), y, 0.002 - Math.sin(a) * (base - 0.0075)));
      }
      hemRowsO.push(o); hemRowsI.push(i2);
    }
    G.hem.push(shell(hemRowsO, hemRowsI, { loop: true }));

  }
  return G;
}

/* -------------------------------------------------------------------- sash */
export function buildSash() {
  const parts = { band: [], knot: [], tails: [] };
  const NU = 84;

  const rows = [
    [1.182, 0.0155], [1.168, 0.0205], [1.145, 0.0225], [1.120, 0.0230],
    [1.095, 0.0225], [1.072, 0.0195], [1.054, 0.0135],
  ];
  const ro = [], ri = [];
  for (const [y, off] of rows) {
    const o = [], i2 = [];
    for (let j = 0; j < NU; j++) {
      const a = (j / NU) * TAU;
      const tilt = 0.018 * Math.cos(a);
      const wob = 0.0018 * Math.sin(a * 7 + y * 40);
      o.push(torsoPoint(a, y + tilt, off + wob));
      i2.push(torsoPoint(a, y + tilt, off + wob - 0.0080));
    }
    ro.push(o); ri.push(i2);
  }
  parts.band.push(shell(ro, ri, { loop: true }));

  // knot on his left hip
  const knotTheta = 1.15, knotY = 1.115;
  const kp = torsoPoint(knotTheta, knotY, 0.032);
  const n = torsoNormal(knotTheta, knotY);
  const tang = new THREE.Vector3(0, 1, 0).cross(n).normalize();
  const bit = new THREE.Vector3().crossVectors(n, tang).normalize();
  {
    const rings = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const phi = -Math.PI / 2 + Math.PI * t;
      const rr = 0.020 * Math.cos(phi * 0.85);
      const yy = Math.sin(phi) * 0.020;
      const pts = [];
      for (let j = 0; j < 22; j++) {
        const a = (j / 22) * TAU;
        pts.push(kp.clone()
          .addScaledVector(tang, Math.cos(a) * rr * 0.95)
          .addScaledVector(bit, Math.sin(a) * rr * 0.62 + 0.004)
          .addScaledVector(V3(0, 1, 0), yy));
      }
      rings.push(pts);
    }
    parts.knot.push(surface(rings, { loop: true, capStart: true, capEnd: true }));
  }

  // broad ribbon tail draping down the front of his left thigh
  {
    const STEPS = 22, ACROSS = 6;
    const center = (v) => {
      const y = 1.086 - v * 0.330;
      const x = 0.112 + 0.040 * Math.min(1, v * 1.5) - 0.010 * v * v;
      const z = 0.082 + 0.010 * Math.sqrt(Math.min(1, v * 2.0)) - 0.020 * v;
      return V3(x, y, z);
    };
    const rowsPts = [];
    for (let i = 0; i <= STEPS; i++) {
      const v = i / STEPS;
      const c = center(v);
      const halfW = (0.0250 + 0.0125 * Math.sin(Math.min(1, v * 2.0) * Math.PI * 0.5)) * (1 - 0.78 * Math.pow(v, 2.6));
      const row = [];
      for (let j = 0; j <= ACROSS; j++) {
        const u = j / ACROSS - 0.5;
        const bulge = 0.008 * (1 - Math.pow(u * 2, 2));
        row.push(V3(
          c.x + u * halfW * 2,
          c.y + Math.cos(u * 2.4) * 0.002,
          c.z + bulge + Math.sin(v * 2.6 + u) * 0.006 * v,
        ));
      }
      rowsPts.push(row);
    }
    parts.tails.push(surface(rowsPts, { loop: false }));
    const back = rowsPts.map((row) => row.map((p) => p.clone().add(V3(0, 0, -0.0075))));
    parts.tails.push(surface(back.slice().reverse(), { loop: false }));
    const left = rowsPts.map((r) => r[0]), leftB = back.map((r) => r[0]);
    const right = rowsPts.map((r) => r[r.length - 1]), rightB = back.map((r) => r[r.length - 1]);
    parts.tails.push(surface([left, leftB], { loop: false }));
    parts.tails.push(surface([rightB, right], { loop: false }));
  }
  return parts;
}

/* ----------------------------------------------------------------- sandals */


const OUTLINE = [
  // z, half width  (heel -> toe)
  [-0.104, 0.011], [-0.098, 0.024], [-0.088, 0.034], [-0.070, 0.042],
  [-0.046, 0.047], [-0.016, 0.051], [0.016, 0.054], [0.050, 0.056],
  [0.084, 0.057], [0.114, 0.058], [0.142, 0.056], [0.162, 0.050],
  [0.174, 0.039], [0.180, 0.023], [0.183, 0.004],
];

export function buildSandal(side) {
  const parts = { sole: [], soleDark: [], strap: [] };
  const baseX = side * P.ankleX;
  const TOP = 0.0315, BOT = 0.005;
  const N = OUTLINE.length;
  const SAMPLES = 120;

  // closed outline: +x side heel->toe, across the toe, -x side toe->heel
  const raw = [];
  const half = Math.floor(SAMPLES / 2);
  for (let k = 0; k < half; k++) {
    const t = (k / (half - 1));
    const f = t * (N - 1);
    const i = Math.min(N - 2, Math.floor(f));
    const frac = f - i;
    const z = lerp(OUTLINE[i][0], OUTLINE[i + 1][0], frac);
    const w = lerp(OUTLINE[i][1], OUTLINE[i + 1][1], frac);
    raw.push([w, z]);
  }
  for (let k = 0; k < SAMPLES - half; k++) {
    const t = k / (SAMPLES - half - 1);
    const f = (1 - t) * (N - 1);
    const i = Math.min(N - 2, Math.floor(f));
    const frac = f - i;
    const z = lerp(OUTLINE[i][0], OUTLINE[i + 1][0], frac);
    const w = lerp(OUTLINE[i][1], OUTLINE[i + 1][1], frac);
    raw.push([-w, z]);
  }
  const smooth = [];
  for (let k = 0; k < SAMPLES; k++) {
    let ax = 0, az = 0, ws = 0;
    for (let d = -4; d <= 4; d++) {
      const w = Math.exp(-(d * d) / 8);
      const q = raw[(k + d + SAMPLES) % SAMPLES];
      ax += q[0] * w; az += q[1] * w; ws += w;
    }
    smooth.push([ax / ws, az / ws]);
  }

  const rz = 0.008; // sandal sits slightly forward of the ankle
  const ringTop = smooth.map(([x, z]) => V3(baseX + x * 1.03, TOP, z + rz));
  const ringLip = smooth.map(([x, z]) => V3(baseX + x * 1.055, TOP - 0.0055, z + rz));
  const ringMid = smooth.map(([x, z]) => V3(baseX + x, (TOP + BOT) * 0.5, z + rz));
  const ringBot = smooth.map(([x, z]) => V3(baseX + x * 0.975, BOT + 0.002, z + rz));
  parts.sole.push(surface([ringTop, ringLip, ringMid, ringBot], { loop: true, capStart: true, capEnd: true }));

  const d1 = smooth.map(([x, z]) => V3(baseX + x * 0.975, BOT + 0.0022, z + rz));
  const d2 = smooth.map(([x, z]) => V3(baseX + x * 0.93, BOT, z + rz));
  parts.soleDark.push(surface([d1, d2], { loop: true, capStart: true, capEnd: true }));

  // ---- thong straps: two arcs meeting at a toe post between the big toe and the second toe
  const postX = baseX - side * 0.019;
  const strapR = 0.0078;
  const mkStrap = (waypoints) => {
    // smooth the polyline so the rubber strap has a natural bend
    const pts = [], radii = [];
    const N2 = 18;
    for (let i = 0; i <= N2; i++) {
      const t = i / N2;
      const f = t * (waypoints.length - 1);
      const k = Math.min(waypoints.length - 2, Math.floor(f));
      const u = f - k;
      const p0 = waypoints[Math.max(0, k - 1)], p1 = waypoints[k], p2 = waypoints[k + 1];
      const p3 = waypoints[Math.min(waypoints.length - 1, k + 2)];
      // Catmull-Rom
      const p = new THREE.Vector3()
        .addScaledVector(p1, 2)
        .addScaledVector(p2.clone().sub(p0), u)
        .addScaledVector(p0.clone().multiplyScalar(2).addScaledVector(p1, -5).addScaledVector(p2, 4).sub(p3), u * u)
        .addScaledVector(p0.clone().multiplyScalar(-1).addScaledVector(p1, 3).addScaledVector(p2, -3).add(p3), u * u * u)
        .multiplyScalar(0.5);
      pts.push(p);
      radii.push([strapR, strapR * 0.55]);
    }
    const st = pathStations(pts, radii, { up: V3(0, 1, 0) });
    return tube(st, 12, { capStart: true, capEnd: true });
  };
  // outer arc (lateral side of the foot)
  parts.strap.push(mkStrap([
    V3(baseX + side * 0.054, TOP - 0.002, 0.010),
    V3(baseX + side * 0.050, TOP + 0.030, 0.040),
    V3(baseX + side * 0.034, TOP + 0.048, 0.076),
    V3(baseX + side * 0.010, TOP + 0.050, 0.106),
    V3(postX, TOP + 0.022, 0.124),
  ]));
  // inner arc (medial side)
  parts.strap.push(mkStrap([
    V3(baseX - side * 0.050, TOP - 0.002, 0.028),
    V3(baseX - side * 0.044, TOP + 0.026, 0.058),
    V3(baseX - side * 0.030, TOP + 0.044, 0.092),
    V3(postX, TOP + 0.020, 0.122),
  ]));
  // toe post through the gap between the first two toes
  {
    const pts = [], radii = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      pts.push(V3(postX, TOP + 0.020 * t, 0.122 - 0.006 * t));
      radii.push([0.0075 * (1 - 0.15 * t), 0.0045]);
    }
    const st = pathStations(pts, radii, { up: V3(0, 0, 1) });
    parts.strap.push(tube(st, 10, { capStart: true, capEnd: true }));
  }
  return parts;
}

/* ----------------------------------------------------------------- sandals */



/* --------------------------------------------------------------- chest scar */
export function buildChestScar() {
  const geoms = [];
  const bands = [
    { a: [-0.64, 1.246], b: [0.68, 1.322] },
    { a: [-0.68, 1.323], b: [0.64, 1.244] },
  ];
  for (const { a, b } of bands) {
    const NU = 30, NV = 6;
    const outerRows = [], innerRows = [];
    for (let i = 0; i <= NV; i++) {
      const v = i / NV;
      const o = [], i2 = [];
      for (let j = 0; j <= NU; j++) {
        const u = j / NU;
        const theta = lerp(a[0], b[0], u);
        const y = lerp(a[1], b[1], u);
        const halfW = 0.0102 + 0.0042 * Math.sin(u * 5.2 + 0.7) + 0.0018 * Math.sin(u * 17);
        const edgeFade = Math.min(1, Math.min(u, 1 - u) * 6.0);
        const off = (v - 0.5) * 2 * halfW * (0.35 + 0.65 * edgeFade);
        const bump = 0.0028 * Math.cos((v - 0.5) * Math.PI) * edgeFade;
        o.push(torsoPoint(theta, y + off, 0.0024 + bump));
        i2.push(torsoPoint(theta, y + off, 0.0002));
      }
      outerRows.push(o); innerRows.push(i2);
    }
    geoms.push(shell(outerRows, innerRows, { loop: false }));
  }
  return geoms;
}
