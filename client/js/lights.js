// What lights the world besides its lamps (world.js pools them all): an effect's light, for a
// moment (flash: a bolt striking) or for as long as it lasts (carry: a meteor falling, an arrow in
// flight), and a character's glowing parts (lamp: npc.js). Each is placed in its own space
// (`space`: what it's set in; the yard's effects lie on its lowered floor, the arena's on its risen
// one, the rest in the world itself) and lights the world from there. main.js hands it the world.

import * as THREE from 'three';

let world = null;
export function setLights(w) { world = w; }

const P = new THREE.Vector3();
function inWorld(space, x, y, z) {
  P.set(x, y, z);
  if (space?.isObject3D) space.localToWorld(P);
  return P;
}

// A flash at `at` [x, y, z] (world.flash's look: its colour, power, reach, life…).
export function flash(space, at, look) {
  if (!world) return;
  const p = inWorld(space, at[0], at[1], at[2]);
  world.flash([p.x, p.y, p.z], look);
}

// A light carried along (world.glow's look): moved with at(x, y, z) in its space, brightened or
// dimmed with `level`, let go with end(fade).
export function carry(space, at, look) {
  if (!world) return { at() {}, level: 0, end() {} };
  const p = inWorld(space, at[0], at[1], at[2]);
  const g = world.glow([p.x, p.y, p.z], look);
  return {
    at(x, y, z) {
      const q = inWorld(space, x, y, z);
      g.at(q.x, q.y, q.z);
    },
    get level() { return g.level; },
    set level(v) { g.level = v; },
    end(fade) { g.end(fade); },
  };
}

// A character's own light (npc.js), pooled as the world's lamps are: a source its owner sets
// from moment to moment (pos, in the world; color; intensity), `reach` far; gone with unlamp.
export function lamp(reach, decay = 1.5) {
  if (!world) return null;
  return world.addLightSource({ pos: new THREE.Vector3(), color: new THREE.Color(), distance: reach, decay, intensity: 0 });
}
export function unlamp(src) {
  if (src) world?.removeLightSource(src);
}
// (a point of a character's space, in the world's: set straight into its lamp)
export function placeLamp(src, space, x, y, z) {
  src.pos.copy(inWorld(space, x, y, z));
}
