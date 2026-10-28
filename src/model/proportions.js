/**
 * proportions.js — single source of truth for every landmark, derived from
 * measurements taken off the reference sheets (heights as fractions of the
 * figure). Units: metres; feet on y = 0, up = +Y, front = +Z, left = +X.
 *
 * Figure ≈ 6.3 heads tall; skull top at 1.79, hat top ≈ 1.85.
 */
export const P = {
  sole: 0.0,
  ankle: 0.160,
  knee: 0.480,
  crotch: 0.860,
  hipJoint: 0.885,
  sashBottom: 1.058,
  sashTop: 1.170,
  navel: 1.120,
  waist: 1.075,
  pecBottom: 1.270,
  nipple: 1.305,
  chest: 1.335,
  shoulder: 1.398,
  deltoidTop: 1.442,
  neckBase: 1.436,
  chin: 1.505,
  headHeight: 0.245,
  skullTop: 1.750,
  // arms
  elbow: 1.075,
  wrist: 0.760,
  shoulderX: 0.158,
  elbowX: 0.196,
  wristX: 0.214,
  // legs
  hipX: 0.092,
  ankleX: 0.088,
  // head detail
  get eyeY() { return this.chin + 0.600 * this.headHeight; },    // 1.652
  get earY() { return this.chin + 0.505 * this.headHeight; },    // 1.6287
  get mouthY() { return this.chin + 0.190 * this.headHeight; },  // 1.5516
  get noseY() { return this.chin + 0.345 * this.headHeight; },   // 1.5895
  get browY() { return this.chin + 0.715 * this.headHeight; },   // 1.6802
  headHalfWidth: 0.115,
  eyeX: 0.0465,
  eyeRx: 0.0228,
  eyeRy: 0.0252,
};

export const sideName = (s) => (s > 0 ? 'L' : 'R');
