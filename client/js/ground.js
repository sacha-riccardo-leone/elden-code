// The height of the ground underfoot. The islands, the bridges and the arena all lie at 0; a place
// whose ground is higher or lower (the training yard below the Hold and the steps down to it,
// yard.js) registers a level, { contains(x, z), y(x, z) }, and whoever stands there stands on it:
// the characters (npc.js), the camera (main.js), a click on the ground (input.js). Where two hold a
// point the first registered wins; one registered `first` goes before the rest (the tutorial's
// stairs, climb.js, which run up out of the training yard's own), and one may be taken away again.

const levels = [];

export function addLevel(level, first = false) {
  if (first) levels.unshift(level);
  else levels.push(level);
  return level;
}

export function removeLevel(level) {
  const i = levels.indexOf(level);
  if (i >= 0) levels.splice(i, 1);
}

export function groundAt(x, z) {
  for (const l of levels) if (l.contains(x, z)) return l.y(x, z);
  return 0;
}
