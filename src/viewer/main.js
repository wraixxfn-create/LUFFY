/**
 * Viewer — loads the exported glTF of the Luffy model and presents it with
 * studio lighting, orbit controls, preset cameras, wireframe and turntable.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

// soft studio environment for believable fabric/skin response
const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 1.05, 3.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 0.6;
controls.maxDistance = 7;
controls.maxPolarAngle = Math.PI * 0.56;
controls.minPolarAngle = Math.PI * 0.06;
controls.autoRotateSpeed = 0.9;

/* ------------------------------------------------------------------ lights */
const key = new THREE.DirectionalLight(0xfff4e6, 2.5);
key.position.set(-1.9, 3.1, 2.6);
scene.add(key);

const fill = new THREE.DirectionalLight(0xdfeaff, 1.05);
fill.position.set(2.6, 1.5, 1.4);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffd9c2, 2.1);
rim.position.set(1.2, 2.2, -2.8);
scene.add(rim);

const bounce = new THREE.DirectionalLight(0xbcd3ff, 0.5);
bounce.position.set(-0.4, -1.2, 1.2);
scene.add(bounce);

scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2b2f36, 0.55));

/* ------------------------------------------------------------------- model */
const loading = document.querySelector('#loading');
const statTris = document.querySelector('#stat-tris');
const statParts = document.querySelector('#stat-parts');

let model = null;
const restEmissive = new Map();

const loader = new GLTFLoader();
loader.load('/luffy.glb', (gltf) => {
  model = gltf.scene;
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) o.material.envMapIntensity = 0.5;
    }
  });
  // centre horizontally and sit on y = 0
  const box = new THREE.Box3().setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  model.position.x -= centre.x;
  model.position.z -= centre.z;
  model.position.y -= box.min.y;
  scene.add(model);
  frameAll();
  updateStats();
  loading.classList.add('is-hidden');
}, undefined, (err) => {
  console.error(err);
  loading.querySelector('.label').textContent = 'Could not load luffy.glb — run npm run export';
});

function updateStats() {
  let tris = 0;
  let parts = 0;
  model.traverse((o) => {
    if (o.isMesh) {
      parts += 1;
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  statTris.textContent = Math.round(tris).toLocaleString();
  statParts.textContent = String(parts);
}

/* ------------------------------------------------------------------ camera */
const VIEWS = {
  front: { pos: [0, 1.02, 3.35], target: [0, 0.95, 0] },
  threeq: { pos: [2.05, 1.15, 2.6], target: [0, 0.95, 0] },
  side: { pos: [3.3, 1.05, 0.02], target: [0, 0.95, 0] },
  back: { pos: [0, 1.05, -3.35], target: [0, 0.95, 0] },
  face: { pos: [0, 1.63, 0.86], target: [0, 1.62, 0] },
  feet: { pos: [0.75, 0.42, 1.1], target: [0, 0.16, 0] },
};

let tween = null;
function goToView(name, duration = 750) {
  const v = VIEWS[name];
  if (!v) return;
  tween = {
    t: 0,
    duration,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: new THREE.Vector3(...v.pos),
    toTarget: new THREE.Vector3(...v.target),
  };
  document.querySelectorAll('.views .pill').forEach((b) => b.classList.toggle('is-on', b.dataset.view === name));
}

function frameAll() {
  if (!model) return;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const height = size.y;
  const dist = (height * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  VIEWS.front.pos = [0, height * 0.55, dist * 1.16];
  VIEWS.front.target = [0, height * 0.5, 0];
  VIEWS.threeq.pos = [dist * 0.78, height * 0.6, dist * 0.92];
  VIEWS.side.pos = [dist * 1.18, height * 0.55, 0.02];
  VIEWS.back.pos = [0, height * 0.55, -dist * 1.16];
  VIEWS.face.pos = [0, height * 0.88, 0.86];
  VIEWS.face.target = [0, height * 0.86, 0];
  VIEWS.feet.pos = [0.8, 0.42, 1.15];
  VIEWS.feet.target = [0, 0.16, 0];
  goToView('front', 1);
}

/* -------------------------------------------------------------------- ui */
document.querySelectorAll('.views .pill').forEach((btn) => {
  btn.addEventListener('click', () => goToView(btn.dataset.view));
});

const btnWire = document.querySelector('#btn-wire');
let wire = false;
btnWire.addEventListener('click', () => {
  wire = !wire;
  btnWire.classList.toggle('is-on', wire);
  if (!model) return;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) m.wireframe = wire;
  });
});

const btnSpin = document.querySelector('#btn-spin');
let spin = true;
controls.autoRotate = spin;
btnSpin.addEventListener('click', () => {
  spin = !spin;
  controls.autoRotate = spin;
  btnSpin.classList.toggle('is-on', spin);
});

window.addEventListener('keydown', (e) => {
  const map = { 1: 'front', 2: 'threeq', 3: 'side', 4: 'back', 5: 'face', 6: 'feet' };
  if (map[e.key]) goToView(map[e.key]);
  if (e.key === 'w' || e.key === 'W') btnWire.click();
  if (e.key === 'r' || e.key === 'R') btnSpin.click();
});

/* ------------------------------------------------------------------- loop */
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (tween) {
    tween.t += dt * 1000;
    const k = Math.min(1, tween.t / tween.duration);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
    if (k >= 1) tween = null;
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});
