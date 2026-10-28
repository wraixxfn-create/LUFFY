/**
 * render.js — tiny software rasteriser used to preview the model headlessly
 * (no GPU / browser needed). Gouraud shading, z-buffer, 2x supersampling.
 *
 * usage: node tools/render.js [--views=front,...] [--out=dir] [--size=900x1200]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import * as THREE from 'three';
import { createLuffy } from '../src/model/luffy.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? 'true'];
}));
const outDir = args.out || 'renders';
const [W, H] = (args.size || '900x1200').split('x').map(Number);
const SS = Number(args.ss || 2);

const LIGHTS = [
  { dir: new THREE.Vector3(-0.45, 0.55, 0.85).normalize(), col: [1.0, 0.98, 0.95], i: 0.85 },
  { dir: new THREE.Vector3(0.75, 0.25, 0.45).normalize(), col: [0.95, 0.97, 1.0], i: 0.45 },
  { dir: new THREE.Vector3(0.1, 0.4, -0.9).normalize(), col: [0.9, 0.92, 1.0], i: 0.35 },
];
const AMBIENT = [0.30, 0.31, 0.34];

function srgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function renderView(root, { yaw, pitch = 0.06, dist = 4.3, fov = 26, target = [0, 0.93, 0], width, height }) {
  const widthPx = width * SS, heightPx = height * SS;
  const color = new Float32Array(widthPx * heightPx * 3);
  const cover = new Float32Array(widthPx * heightPx);
  const depth = new Float32Array(widthPx * heightPx).fill(Infinity);

  // background gradient
  for (let y = 0; y < heightPx; y++) {
    const t = y / heightPx;
    const top = [0.62, 0.72, 0.82], bot = [0.93, 0.94, 0.95];
    const r = top[0] + (bot[0] - top[0]) * t;
    const g = top[1] + (bot[1] - top[1]) * t;
    const b = top[2] + (bot[2] - top[2]) * t;
    for (let x = 0; x < widthPx; x++) {
      const i = (y * widthPx + x) * 3;
      color[i] = r; color[i + 1] = g; color[i + 2] = b;
    }
  }

  const cam = new THREE.PerspectiveCamera(fov, widthPx / heightPx, 0.1, 60);
  const tgt = new THREE.Vector3(...target);
  const eye = new THREE.Vector3(
    tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    tgt.y + Math.sin(pitch) * dist,
    tgt.z + Math.cos(yaw) * Math.cos(pitch) * dist,
  );
  cam.position.copy(eye);
  cam.lookAt(tgt);
  cam.updateMatrixWorld(true);
  const viewProj = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);

  const meshes = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });

  const v4 = new THREE.Vector4();
  const nMat = new THREE.Matrix3();

  for (const mesh of meshes) {
    const g = mesh.geometry;
    const pos = g.getAttribute('position');
    const nrm = g.getAttribute('normal');
    const colAttr = g.getAttribute('color');
    const idx = g.getIndex();
    const matColor = mesh.material.color;
    const mw = mesh.matrixWorld;
    nMat.getNormalMatrix(mw);

    const P = new Float32Array(pos.count * 3);
    const N = new Float32Array(pos.count * 3);
    const C = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v4.set(pos.getX(i), pos.getY(i), pos.getZ(i), 1).applyMatrix4(mw);
      P[i * 3] = v4.x; P[i * 3 + 1] = v4.y; P[i * 3 + 2] = v4.z;
      const n = new THREE.Vector3(nrm ? nrm.getX(i) : 0, nrm ? nrm.getY(i) : 1, nrm ? nrm.getZ(i) : 0)
        .applyMatrix3(nMat).normalize();
      N[i * 3] = n.x; N[i * 3 + 1] = n.y; N[i * 3 + 2] = n.z;
      const cr = colAttr ? colAttr.getX(i) : 1;
      const cg = colAttr ? colAttr.getY(i) : 1;
      const cb = colAttr ? colAttr.getZ(i) : 1;
      C[i * 3] = cr; C[i * 3 + 1] = cg; C[i * 3 + 2] = cb;
    }

    const sx = new Float32Array(pos.count), sy = new Float32Array(pos.count), sz = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      v4.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], 1).applyMatrix4(viewProj);
      const w = v4.w || 1e-6;
      sx[i] = (v4.x / w * 0.5 + 0.5) * widthPx;
      sy[i] = (1 - (v4.y / w * 0.5 + 0.5)) * heightPx;
      sz[i] = v4.z / w; // ndc depth
    }

    const triCount = idx ? idx.count / 3 : pos.count / 3;
    for (let t = 0; t < triCount; t++) {
      const ia = idx ? idx.getX(t * 3) : t * 3;
      const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;

      const x0 = sx[ia], y0 = sy[ia], x1 = sx[ib], y1 = sy[ib], x2 = sx[ic], y2 = sy[ic];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) continue;
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
      const maxX = Math.min(widthPx - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
      const maxY = Math.min(heightPx - 1, Math.ceil(Math.max(y0, y1, y2)));
      if (maxX < minX || maxY < minY) continue;

      const inv = 1 / area;
      const z0 = sz[ia], z1 = sz[ib], z2 = sz[ic];

      for (let y = minY; y <= maxY; y++) {
        const py = y + 0.5;
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          let w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv;
          let w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv;
          let w2 = 1 - w0 - w1;
          if (w0 < -0.002 || w1 < -0.002 || w2 < -0.002) continue;
          const z = w0 * z0 + w1 * z1 + w2 * z2;
          const di = y * widthPx + x;
          if (z >= depth[di] || z < -1.2) continue;
          depth[di] = z;

          let nx = w0 * N[ia * 3] + w1 * N[ib * 3] + w2 * N[ic * 3];
          let ny = w0 * N[ia * 3 + 1] + w1 * N[ib * 3 + 1] + w2 * N[ic * 3 + 1];
          let nz = w0 * N[ia * 3 + 2] + w1 * N[ib * 3 + 2] + w2 * N[ic * 3 + 2];
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl; ny /= nl; nz /= nl;

          // two-sided shading
          const vx = eye.x - (w0 * P[ia * 3] + w1 * P[ib * 3] + w2 * P[ic * 3]);
          const vy = eye.y - (w0 * P[ia * 3 + 1] + w1 * P[ib * 3 + 1] + w2 * P[ic * 3 + 1]);
          const vz = eye.z - (w0 * P[ia * 3 + 2] + w1 * P[ib * 3 + 2] + w2 * P[ic * 3 + 2]);
          if (nx * vx + ny * vy + nz * vz < 0) { nx = -nx; ny = -ny; nz = -nz; }

          let r = AMBIENT[0], gg = AMBIENT[1], b = AMBIENT[2];
          for (const L of LIGHTS) {
            const d = Math.max(0, nx * L.dir.x + ny * L.dir.y + nz * L.dir.z);
            r += L.col[0] * L.i * d;
            gg += L.col[1] * L.i * d;
            b += L.col[2] * L.i * d;
          }
          // subtle rim light
          const rim = Math.pow(1 - Math.max(0, Math.abs(nx * vx / (Math.hypot(vx, vy, vz) || 1) +
            ny * vy / (Math.hypot(vx, vy, vz) || 1) + nz * vz / (Math.hypot(vx, vy, vz) || 1))), 3) * 0.12;
          r += rim; gg += rim; b += rim;

          const cr = w0 * C[ia * 3] + w1 * C[ib * 3] + w2 * C[ic * 3];
          const cg = w0 * C[ia * 3 + 1] + w1 * C[ib * 3 + 1] + w2 * C[ic * 3 + 1];
          const cb = w0 * C[ia * 3 + 2] + w1 * C[ib * 3 + 2] + w2 * C[ic * 3 + 2];

          cover[di] = 1;
          color[di * 3] = r * matColor.r * cr;
          color[di * 3 + 1] = gg * matColor.g * cg;
          color[di * 3 + 2] = b * matColor.b * cb;
        }
      }
    }
  }

  // downsample + tonemap + write
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy2 = 0; sy2 < SS; sy2++) {
        for (let sx2 = 0; sx2 < SS; sx2++) {
          const i = ((y * SS + sy2) * widthPx + (x * SS + sx2)) * 3;
          r += color[i]; g += color[i + 1]; b += color[i + 2];
        }
      }
      const n = SS * SS;
      const o = (y * width + x) * 4;
      png.data[o] = Math.max(0, Math.min(255, srgb(r / n) * 255));
      png.data[o + 1] = Math.max(0, Math.min(255, srgb(g / n) * 255));
      png.data[o + 2] = Math.max(0, Math.min(255, srgb(b / n) * 255));
      let cov = 0;
      for (let sy2 = 0; sy2 < SS; sy2++) {
        for (let sx2 = 0; sx2 < SS; sx2++) cov += cover[((y * SS + sy2) * widthPx + (x * SS + sx2))];
      }
      png.data[o + 3] = Math.round((cov / n) * 255);
    }
  }
  return png;
}

const model = createLuffy();
if (args.only) {
  const keep = args.only.split(',');
  const drop = [];
  model.traverse((o) => { if (o.isMesh && !keep.some((k) => o.name.startsWith(k))) drop.push(o); });
  for (const o of drop) o.parent.remove(o);
}
fs.mkdirSync(outDir, { recursive: true });

const views = (args.views || 'front,side,back,threeq').split(',');
const PRESETS = {
  feet: { yaw: 0.5, pitch: 0.22, dist: 1.0, target: [0, 0.14, 0.04] },
  hands: { yaw: 0.35, pitch: 0.05, dist: 0.9, target: [0.24, 0.72, 0.02] },
  chest: { yaw: 0.0, pitch: 0.05, dist: 1.15, target: [0, 1.22, 0] },
  crotch: { yaw: 0.0, pitch: 0.02, dist: 0.95, target: [0, 0.80, 0] },
};
const ANGLES = {
  front: 0, threeq: Math.PI * 0.25, side: Math.PI * 0.5, back: Math.PI,
  backthreeq: Math.PI * 0.75, left: -Math.PI * 0.5, face: 0,
};
for (const v of views) {
  const preset = PRESETS[v];
  const png = renderView(model, {
    yaw: preset ? preset.yaw : (ANGLES[v] ?? Number(v)),
    pitch: preset ? preset.pitch : (v === 'face' ? 0.10 : 0.06),
    dist: preset ? preset.dist : (v === 'face' ? 1.1 : 4.75),
    fov: 26,
    target: preset ? preset.target : (v === 'face' ? [0, 1.62, 0] : [0, 0.97, 0]),
    width: W, height: H,
  });
  const p = path.join(outDir, `${v}.png`);
  png.pack().pipe(fs.createWriteStream(p));
  await new Promise((r) => setTimeout(r, 0));
  console.log('wrote', p);
}
