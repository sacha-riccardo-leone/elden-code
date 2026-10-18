// The weapons planted in the Round Table (hub.js): swords, greatswords, katanas, a scimitar, an
// estoc, war axes, a spear, a halberd, a great hammer, each driven into the wood at its own angle
// (and the same weapons stand in the training yard's racks, yard.js).
// Every one is built pointing up its local +Y from where it enters the table (y = 0): its point, or
// an axe's or a hammer's head, is buried below; the hilt or the haft rises out of the wood.

import * as THREE from 'three';

const MAT = {
  steel: new THREE.MeshLambertMaterial({ color: '#8a8f96' }),
  dark: new THREE.MeshLambertMaterial({ color: '#4a4643' }),
  bronze: new THREE.MeshLambertMaterial({ color: '#8a6a3a' }),
  gold: new THREE.MeshLambertMaterial({ color: '#a8823c' }),
  wood: new THREE.MeshLambertMaterial({ color: '#4a3424' }),
  grip: new THREE.MeshLambertMaterial({ color: '#2a1e18' }),
};

function part(g, geo, mat, x, y, z, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.z = rz;
  m.castShadow = true;
  g.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rod = (r, h, seg = 6) => new THREE.CylinderGeometry(r, r, h, seg);

// A straight sword: blade (`bury` of it below the wood), guard, grip, pommel.
function sword(g, { blade, width, guard, grip, bury, mat = MAT.steel, guardMat = MAT.bronze }) {
  part(g, box(width, blade, 0.018), mat, 0, blade / 2 - bury, 0);
  const top = blade - bury;
  part(g, box(guard, 0.05, 0.05), guardMat, 0, top + 0.025, 0);
  part(g, rod(0.022, grip), MAT.grip, 0, top + 0.05 + grip / 2, 0);
  part(g, new THREE.SphereGeometry(0.038, 6, 4), guardMat, 0, top + 0.07 + grip, 0);
}

// A curved blade (katana, scimitar): a few straight pieces, each turned a little more.
function curved(g, { blade, width, curve, grip, bury, guard }) {
  const n = 4;
  const seg = blade / n;
  let x = 0;
  let y = -bury;
  let a = -curve; // the buried end curls the other way
  for (let i = 0; i < n; i++) {
    const cx = x - Math.sin(a) * (seg / 2);
    const cy = y + Math.cos(a) * (seg / 2);
    part(g, box(width, seg + 0.01, 0.016), MAT.steel, cx, cy, 0, a);
    x -= Math.sin(a) * seg;
    y += Math.cos(a) * seg;
    a += (curve * 2) / (n - 1);
  }
  if (guard === 'tsuba') part(g, new THREE.CylinderGeometry(0.065, 0.065, 0.02, 10), MAT.dark, x, y + 0.01, 0);
  else part(g, box(0.2, 0.045, 0.045), MAT.bronze, x, y + 0.02, 0);
  part(g, rod(0.022, grip), MAT.grip, x, y + 0.03 + grip / 2, 0);
}

// A war axe struck into the wood: its head half sunk, the haft rising out of it.
function axe(g, { haft, head }) {
  part(g, rod(0.026, haft), MAT.wood, 0, haft / 2 - 0.05, 0);
  part(g, box(head * 0.85, head, 0.03), MAT.steel, head * 0.38, 0.02, 0);
  part(g, box(0.07, head * 0.4, 0.03), MAT.dark, -0.06, 0.02, 0); // the back of the head
  part(g, rod(0.032, 0.06), MAT.dark, 0, haft - 0.08, 0);
}

// A spear (or a halberd, with an axe blade below its point), its point in the wood.
function polearm(g, { shaft, blade = 0 }) {
  part(g, rod(0.02, shaft), MAT.wood, 0, shaft / 2, 0);
  part(g, new THREE.ConeGeometry(0.035, 0.25, 6), MAT.steel, 0, -0.05, 0, Math.PI);
  if (blade) part(g, box(blade, blade * 0.7, 0.025), MAT.steel, blade / 2, 0.16, 0);
  part(g, rod(0.026, 0.05), MAT.bronze, 0, 0.12, 0);
}

// A great hammer brought down: its head sunk into the wood, the handle up.
function hammer(g, { handle }) {
  part(g, box(0.28, 0.2, 0.2), MAT.dark, 0, 0.0, 0);
  part(g, rod(0.026, handle), MAT.wood, 0, handle / 2 + 0.08, 0);
  part(g, rod(0.032, 0.18), MAT.grip, 0, handle - 0.05, 0);
}

// The set, in the order they're planted round the ring (`pole`: a spear or a halberd, which a rack
// holds the other way up, on its butt).
const pole = (build) => Object.assign(build, { pole: true });
const KINDS = [
  (g) => sword(g, { blade: 1.0, width: 0.075, guard: 0.3, grip: 0.2, bury: 0.32 }),
  (g) => axe(g, { haft: 0.95, head: 0.26 }),
  (g) => curved(g, { blade: 0.95, width: 0.045, curve: 0.07, grip: 0.28, bury: 0.3, guard: 'tsuba' }),
  (g) => sword(g, { blade: 1.35, width: 0.13, guard: 0.44, grip: 0.3, bury: 0.4, mat: MAT.dark }),
  pole((g) => polearm(g, { shaft: 1.35 })),
  (g) => sword(g, { blade: 1.05, width: 0.035, guard: 0.16, grip: 0.18, bury: 0.32, guardMat: MAT.gold }), // an estoc
  (g) => hammer(g, { handle: 0.9 }),
  (g) => curved(g, { blade: 0.85, width: 0.075, curve: 0.16, grip: 0.18, bury: 0.28, guard: 'cross' }), // a scimitar
  (g) => sword(g, { blade: 1.1, width: 0.085, guard: 0.34, grip: 0.22, bury: 0.34, guardMat: MAT.gold }),
  pole((g) => polearm(g, { shaft: 1.3, blade: 0.22 })), // a halberd
  (g) => axe(g, { haft: 0.85, head: 0.22 }),
  (g) => curved(g, { blade: 1.0, width: 0.045, curve: 0.05, grip: 0.3, bury: 0.34, guard: 'tsuba' }),
];

// One of the set (the `i`th) as it stands in a weapon rack (yard.js): built as it would be planted,
// but a spear or a halberd on its butt, point up; and how far below y = 0 its lowest point lies
// (a blade's tip, an axe's or a hammer's head, a shaft's butt: `low`, negative), so that it stands
// on the rack's foot.
export function weapon(i, size = 1) {
  const g = new THREE.Group();
  const build = KINDS[i % KINDS.length];
  build(g);
  g.scale.setScalar(size);
  if (build.pole) g.rotation.z = Math.PI;
  g.updateMatrixWorld(true);
  return { g, low: new THREE.Box3().setFromObject(g).min.y };
}

// The ring of weapons round (x, z) on a tabletop at height `top`: each planted at its own place on
// the ring, leaning outward at its own angle and turned its own way. `r` is a seeded random().
export function plantedWeapons(x, z, top, radius, r, size = 1.35) {
  const ring = new THREE.Group();
  KINDS.forEach((build, i) => {
    const g = new THREE.Group();
    build(g);
    g.scale.setScalar(size * (0.9 + r() * 0.2));
    const a = (i / KINDS.length) * Math.PI * 2 + (r() - 0.5) * 0.3;
    const d = radius * (0.85 + r() * 0.3);
    const holder = new THREE.Group();
    holder.position.set(x + Math.cos(a) * d, top, z + Math.sin(a) * d * 0.9);
    holder.rotation.y = -a; // its local +X now points out from the centre
    g.rotation.z = -(0.35 + r() * 0.45); // leaning outward, hilt away from the centre
    g.rotation.y = (r() - 0.5) * 1.2; // turned on its own axis
    holder.add(g);
    ring.add(holder);
  });
  return ring;
}
