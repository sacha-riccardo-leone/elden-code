// Makes a sprite's fallback background transparent and leaves its colours as they are, for art that
// isn't a hero's (a training dummy, a prop): a flat white or black background, or a painted
// grey-and-white checkerboard, flooded in from the edges, and the checkerboard's enclosed pockets
// (backgroundMask, image-io.mjs). Every other pixel comes out fully opaque. Written next to the
// input as <name>-clear.png, unless an output path is given. --dark N: how near a black
// background a pixel must be to go with it (the summed differences of red, green and blue; 24 by
// default); lower it when the outline is drawn nearly black on black, so that the outline stays.
//
//   node scripts/clear-background.mjs <image> [out.png] [--dark N]

import fs from 'node:fs';
import { decode, png, backgroundMask } from './image-io.mjs';

const argv = process.argv.slice(2);
const darkAt = argv.indexOf('--dark');
const dark = darkAt >= 0 ? Number(argv.splice(darkAt, 2)[1]) : 24;
const [input, out = input && input.replace(/\.[^./\\]+$/, '') + '-clear.png'] = argv;
if (!input || Number.isNaN(dark)) {
  console.error('usage: node scripts/clear-background.mjs <image> [out.png] [--dark N]');
  process.exit(1);
}
const img = decode(input);
const mask = backgroundMask(img, { dark });
const rgba = Buffer.alloc(img.w * img.h * 4);
let kept = 0;
for (let i = 0; i < img.w * img.h; i++) {
  if (mask[i]) continue;
  rgba[i * 4] = img.buf[i * 4 + 2];
  rgba[i * 4 + 1] = img.buf[i * 4 + 1];
  rgba[i * 4 + 2] = img.buf[i * 4];
  rgba[i * 4 + 3] = 255;
  kept++;
}
fs.writeFileSync(out, png(img.w, img.h, rgba));
console.log(`${out}: ${img.w}x${img.h}, ${kept} sprite pixels kept, ${img.w * img.h - kept} made transparent`);
