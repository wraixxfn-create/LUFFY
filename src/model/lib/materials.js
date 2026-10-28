/**
 * materials.js — clean, anime-friendly materials.
 * Flat base colours + vertex-colour shading; no noisy image textures (the
 * straw weave is modelled as real geometry so it reads from every angle).
 */
import * as THREE from 'three';

export const COLORS = {
  skin: '#f5cca4',
  scar: '#cf8d77',
  faceScar: '#bd7f69',
  hair: '#141419',
  vest: '#bf2128',
  shorts: '#2b53a2',
  sash: '#efbb2b',
  hem: '#efece5',
  straw: '#dcb96d',
  strawBand: '#ae2a2a',
  sole: '#d3b583',
  button: '#d9b45c',
  soleDark: '#463527',
  strap: '#332419',
  eyeWhite: '#fcfcfc',
  iris: '#181920',
  mouth: '#7c3934',
};

export function createMaterials() {
  const M = {};
  M.skin = new THREE.MeshStandardMaterial({
    color: COLORS.skin, roughness: 0.60, metalness: 0.0, vertexColors: true,
  });
  M.scar = new THREE.MeshStandardMaterial({ color: COLORS.scar, roughness: 0.58, metalness: 0 });
  M.faceScar = new THREE.MeshStandardMaterial({ color: COLORS.faceScar, roughness: 0.62, metalness: 0 });
  M.hair = new THREE.MeshStandardMaterial({ color: COLORS.hair, roughness: 0.42, metalness: 0.0 });
  M.vest = new THREE.MeshStandardMaterial({ color: COLORS.vest, roughness: 0.74, metalness: 0, side: THREE.DoubleSide });
  M.shorts = new THREE.MeshStandardMaterial({ color: COLORS.shorts, roughness: 0.80, metalness: 0, side: THREE.DoubleSide });
  M.sash = new THREE.MeshStandardMaterial({ color: COLORS.sash, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
  M.hem = new THREE.MeshStandardMaterial({ color: COLORS.hem, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  M.straw = new THREE.MeshStandardMaterial({
    color: COLORS.straw, roughness: 0.86, metalness: 0, side: THREE.DoubleSide, vertexColors: true,
  });
  M.strawBand = new THREE.MeshStandardMaterial({ color: COLORS.strawBand, roughness: 0.72, metalness: 0 });
  M.button = new THREE.MeshStandardMaterial({ color: COLORS.button, roughness: 0.5, metalness: 0.05 });
  M.sole = new THREE.MeshStandardMaterial({ color: COLORS.sole, roughness: 0.82, metalness: 0 });
  M.soleDark = new THREE.MeshStandardMaterial({ color: COLORS.soleDark, roughness: 0.9, metalness: 0 });
  M.strap = new THREE.MeshStandardMaterial({ color: COLORS.strap, roughness: 0.55, metalness: 0.02 });
  M.eyeWhite = new THREE.MeshStandardMaterial({ color: COLORS.eyeWhite, roughness: 0.28, metalness: 0 });
  M.iris = new THREE.MeshStandardMaterial({ color: COLORS.iris, roughness: 0.20, metalness: 0 });
  M.mouth = new THREE.MeshStandardMaterial({ color: COLORS.mouth, roughness: 0.5, metalness: 0 });
  M.teeth = new THREE.MeshStandardMaterial({ color: '#f4f0e6', roughness: 0.35, metalness: 0 });
  return M;
}

/** Bake a per-vertex colour attribute. */
export function tintGeometry(geom, fn) {
  const pos = geom.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geom;
}
