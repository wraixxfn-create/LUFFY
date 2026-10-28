/**
 * luffy.js — assembles the complete post-timeskip Monkey D. Luffy model.
 *
 * Character's left is +X, front is +Z, up is +Y, feet at y ≈ 0, ~1.80 m tall
 * including the straw hat. The model is centred on the origin in X/Z.
 */
import * as THREE from 'three';
import { createMaterials, tintGeometry } from './lib/materials.js';
import {
  buildTorso, buildNeck, buildArm, buildDeltoid, buildHand, buildLeg, buildFoot,
} from './body.js';
import {
  buildHead, buildEyes, buildNose, buildMouth, buildFaceScar, buildEars, buildHair, buildHat,
} from './head.js';
import {
  buildVest, buildButtons, buildSleeve, buildShorts, buildSash, buildSandal, buildChestScar,
} from './clothes.js';
import { mergeGeoms } from './lib/geom.js';

function skinShade(x, y, z) {
  // gentle ambient-occlusion style darkening
  let v = 1.0;
  v -= 0.10 * Math.max(0, 1 - Math.abs(y - 1.30) / 0.10) * 0.6;      // under the chin
  v -= 0.06 * Math.exp(-Math.pow((y - 1.17) / 0.05, 2));              // pit of the stomach
  v -= 0.05 * Math.exp(-Math.pow((Math.abs(x) - 0.14) / 0.05, 2)) * Math.exp(-Math.pow((y - 1.30) / 0.06, 2)); // armpit
  v = Math.max(0.80, v);
  return [v, v * 0.995, v * 0.985];
}

export function createLuffy() {
  const M = createMaterials();
  const root = new THREE.Group();
  root.name = 'Luffy';

  const add = (geom, mat, name, parent = root, tint = false) => {
    if (tint) tintGeometry(geom, skinShade);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  /* ---------------------------------------------------------------- body */
  add(buildTorso(), M.skin, 'Torso', root, true);
  add(buildNeck(), M.skin, 'Neck', root, true);

  for (const side of [-1, 1]) {
    const label = side > 0 ? 'L' : 'R';
    add(mergeGeoms([buildArm(side), buildDeltoid(side)]), M.skin, `Arm_${label}`, root, true);
    const handGeoms = buildHand(side);
    add(mergeGeoms(handGeoms), M.skin, `Hand_${label}`, root, true);
    add(buildLeg(side), M.skin, `Leg_${label}`, root, true);
    add(mergeGeoms(buildFoot(side)), M.skin, `Foot_${label}`, root, true);
  }

  /* ---------------------------------------------------------------- head */
  const head = new THREE.Group();
  head.name = 'Head';
  // slightly oversized head, kept anchored at the chin, for the anime silhouette
  head.scale.setScalar(1.115);
  head.position.y = 1.505 * (1 - 1.115);
  root.add(head);

  add(buildHead(), M.skin, 'Skull', head, true);
  for (const g of buildEars()) add(g, M.skin, 'Ear', head, true);

  const eyes = buildEyes();
  add(mergeGeoms(eyes.whites), M.eyeWhite, 'EyeWhites', head);
  add(mergeGeoms(eyes.iris), M.iris, 'Irises', head);
  add(mergeGeoms(eyes.lids), M.iris, 'Eyelids', head);
  add(mergeGeoms(eyes.brows), M.hair, 'Eyebrows', head);
  add(mergeGeoms(eyes.highlight), M.eyeWhite, 'EyeHighlights', head);
  add(buildNose(), M.skin, 'Nose', head, true);
  const mouth = buildMouth();
  add(mouth.interior, M.mouth, 'Mouth', head);
  add(mouth.teeth, M.teeth, 'Teeth', head);
  add(mergeGeoms(buildFaceScar()), M.faceScar, 'FaceScar', head);

  add(mergeGeoms(buildHair()), M.hair, 'Hair', head);

  const hatParts = buildHat();
  const hat = new THREE.Group();
  hat.name = 'StrawHat';
  head.add(hat);
  add(mergeGeoms(hatParts.straw), M.straw, 'HatStraw', hat);
  add(mergeGeoms(hatParts.band), M.strawBand, 'HatBand', hat);

  /* ------------------------------------------------------------- clothes */
  add(buildVest(), M.vest, 'Vest');
  add(mergeGeoms(buildButtons()), M.button, 'Buttons');
  for (const side of [-1, 1]) {
    add(buildSleeve(side), M.vest, `Sleeve_${side > 0 ? 'L' : 'R'}`);
  }

  const shorts = buildShorts();
  add(mergeGeoms(shorts.waist), M.shorts, 'ShortsWaist');
  add(mergeGeoms(shorts.legs), M.shorts, 'ShortsLegs');
  add(mergeGeoms(shorts.hem), M.hem, 'ShortsHem');

  const sash = buildSash();
  add(mergeGeoms(sash.band), M.sash, 'Sash');
  add(mergeGeoms(sash.knot), M.sash, 'SashKnot');
  add(mergeGeoms(sash.tails), M.sash, 'SashTails');

  for (const side of [-1, 1]) {
    const s = buildSandal(side);
    const label = side > 0 ? 'L' : 'R';
    add(mergeGeoms(s.sole), M.sole, `Sole_${label}`);
    add(mergeGeoms(s.soleDark), M.soleDark, `SoleDark_${label}`);
    add(mergeGeoms(s.strap), M.strap, `Straps_${label}`);
  }

  /* ---------------------------------------------------------------- scars */
  add(mergeGeoms(buildChestScar()), M.scar, 'ChestScar');

  root.userData.materials = M;
  return root;
}
