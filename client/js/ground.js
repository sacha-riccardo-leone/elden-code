// The height of the ground underfoot. The islands, the bridges and the arena all lie at 0; a place
// whose ground is higher or lower (the training yard below the Hold and the steps down to it,
// yard.js) registers a level, { contains(x, z), y(x, z) }, and whoever stands there stands on it:
// the characters (npc.js), the camera (main.js), a click on the ground (input.js).

const levels = [];

export function addLevel(level) {
  levels.push(level);
}

export function groundAt(x, z) {
  for (const l of levels) if (l.contains(x, z)) return l.y(x, z);
  return 0;
}
