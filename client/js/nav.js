// Walkability grid over every island and bridge, with A* (binary heap) and line-of-sight
// smoothing. Rebuilt whenever a new region rises out of the mist.

import { ARENA } from './config.js';
import { YARD } from './yard.js';

const CELL = 0.5;
const MIN_Z = ARENA.z - ARENA.radius - 1; // as far north as the Arena of Trials
const MAX_Z = YARD.south + 1; // as far south as the training yard below the Hold

class Heap {
  constructor(score) {
    this.items = [];
    this.score = score;
  }
  get size() { return this.items.length; }
  push(v) {
    const a = this.items;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.score[a[p]] <= this.score[a[i]]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.score[a[l]] < this.score[a[m]]) m = l;
        if (r < a.length && this.score[a[r]] < this.score[a[m]]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export class Nav {
  constructor(world) {
    this.world = world;
    this.version = -1;
    this.rebuild();
  }

  rebuild() {
    const { minX, maxX } = this.world.extent();
    // (from west to east: every island, and the training yard, wider than the Hold above it)
    this.x0 = Math.min(minX, -YARD.halfW) - 1;
    this.z0 = MIN_Z;
    this.w = Math.ceil((Math.max(maxX, YARD.halfW) + 1 - this.x0) / CELL) + 1;
    this.h = Math.ceil((MAX_Z - MIN_Z) / CELL) + 1;
    this.blocked = new Uint8Array(this.w * this.h);
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const [x, z] = this.toWorld(i, j);
        const open = this.world.isWalkArea(x, z) && !this.world.isBlocked(x, z, 0.28);
        this.blocked[j * this.w + i] = open ? 0 : 1;
      }
    }
    this.version = this.world.version;
  }

  sync() {
    if (this.version !== this.world.version) this.rebuild();
  }

  toCell(x, z) {
    return [
      Math.max(0, Math.min(this.w - 1, Math.round((x - this.x0) / CELL))),
      Math.max(0, Math.min(this.h - 1, Math.round((z - this.z0) / CELL))),
    ];
  }

  toWorld(i, j) {
    return [this.x0 + i * CELL, this.z0 + j * CELL];
  }

  free(i, j) {
    return i >= 0 && j >= 0 && i < this.w && j < this.h && !this.blocked[j * this.w + i];
  }

  walkable(x, z) {
    const i = Math.round((x - this.x0) / CELL);
    const j = Math.round((z - this.z0) / CELL);
    return this.free(i, j);
  }

  nearestFree(x, z) {
    const [ci, cj] = this.toCell(x, z);
    if (this.free(ci, cj)) return [ci, cj];
    for (let r = 1; r < 16; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (this.free(ci + di, cj + dj)) return [ci + di, cj + dj];
        }
      }
    }
    return [ci, cj];
  }

  clampToWalkable(x, z) {
    if (this.walkable(x, z)) return [x, z];
    const [i, j] = this.nearestFree(x, z);
    return this.toWorld(i, j);
  }

  lineOfSight(a, b) {
    const [i0, j0] = this.toCell(a[0], a[1]);
    const [i1, j1] = this.toCell(b[0], b[1]);
    const steps = Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0)) * 2;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (!this.free(Math.round(i0 + (i1 - i0) * t), Math.round(j0 + (j1 - j0) * t))) return false;
    }
    return true;
  }

  // Returns [x, z] waypoints ending at the goal (or as close as reachable). `avoid`: circles
  // [x, z, r] to go round as if they were walls (characters standing in the way, crowd.js).
  path(from, to, avoid = null) {
    this.sync();
    if (avoid?.length) return this.around(avoid, () => this.path(from, to));
    if (this.lineOfSight(from, to) && this.walkable(to[0], to[1])) return [to];
    const [si, sj] = this.nearestFree(from[0], from[1]);
    const [gi, gj] = this.nearestFree(to[0], to[1]);
    const W = this.w;
    const N = this.w * this.h;
    const start = sj * W + si;
    const goal = gj * W + gi;
    const g = new Float32Array(N).fill(Infinity);
    const f = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const open = new Heap(f);
    const hfn = (n) => {
      const dx = Math.abs((n % W) - gi);
      const dz = Math.abs(Math.floor(n / W) - gj);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    g[start] = 0;
    f[start] = hfn(start);
    open.push(start);
    let found = false;
    let guard = 0;
    while (open.size && guard++ < 40000) {
      const cur = open.pop();
      if (closed[cur]) continue;
      if (cur === goal) { found = true; break; }
      closed[cur] = 1;
      const ci = cur % W;
      const cj = Math.floor(cur / W);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (!this.free(ni, nj)) continue;
          if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue;
          const n = nj * W + ni;
          if (closed[n]) continue;
          const cost = g[cur] + (di && dj ? 1.414 : 1);
          if (cost < g[n]) {
            g[n] = cost;
            f[n] = cost + hfn(n);
            came[n] = cur;
            open.push(n);
          }
        }
      }
    }
    if (!found) return Object.assign([to], { failed: true }); // (no way there: straight at it)
    const cells = [];
    for (let n = goal; n !== -1 && n !== start; n = came[n]) cells.push(this.toWorld(n % W, Math.floor(n / W)));
    cells.reverse();
    if (this.walkable(to[0], to[1])) cells[cells.length - 1] = to;
    const out = [];
    let anchor = from;
    for (let k = 0; k < cells.length; k++) {
      const next = cells[k + 1];
      if (next && this.lineOfSight(anchor, next)) continue;
      out.push(cells[k]);
      anchor = cells[k];
    }
    return out.length ? out : [to];
  }

  // `plan()` with the cells under each circle [x, z, r] blocked for the while, the grid as it was after.
  around(avoid, plan) {
    const taken = [];
    for (const [x, z, r] of avoid) {
      const [i0, j0] = this.toCell(x - r, z - r);
      const [i1, j1] = this.toCell(x + r, z + r);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const [cx, cz] = this.toWorld(i, j);
          const k = j * this.w + i;
          if ((cx - x) ** 2 + (cz - z) ** 2 > r * r || this.blocked[k]) continue;
          this.blocked[k] = 1;
          taken.push(k);
        }
      }
    }
    try {
      return plan();
    } finally {
      for (const k of taken) this.blocked[k] = 0;
    }
  }

  randomPoint(rand, rect) {
    for (let k = 0; k < 40; k++) {
      const x = rect.minX + rand() * (rect.maxX - rect.minX);
      const z = rect.minZ + rand() * (rect.maxZ - rect.minZ);
      if (this.walkable(x, z)) return [x, z];
    }
    return this.clampToWalkable((rect.minX + rect.maxX) / 2, (rect.minZ + rect.maxZ) / 2);
  }
}
