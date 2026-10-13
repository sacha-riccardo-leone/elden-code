// Tilted HD-2D camera on a rig: pans along the chain of islands, flies between areas, and
// zooming in lowers the camera for a more cinematic angle (zooming far out looks down more).

import * as THREE from 'three';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0.8, -1.5);
    this.cur = this.target.clone();
    this.min = 12;
    this.max = 72;          // furthest the scroll wheel goes
    this.overviewMax = 300; // furthest the overview may pull back to fit every island
    this.distGoal = 26;
    this.dist = this.distGoal;
    this.bounds = { minX: -6, maxX: 6 };
    camera.userData.target = this.cur;
    this.apply();
  }

  pitch() {
    const d = this.dist;
    if (d <= 44) return THREE.MathUtils.degToRad(19 + ((d - this.min) / (44 - this.min)) * 11);
    return THREE.MathUtils.degToRad(Math.min(46, 30 + ((d - 44) / 28) * 10));
  }

  zoom(delta) {
    const top = Math.max(this.max, Math.min(this.distGoal, this.overviewMax));
    this.distGoal = clamp(this.distGoal * (1 + delta * 0.0012), this.min, delta > 0 ? top : this.overviewMax);
  }

  setBounds(minX, maxX) {
    this.bounds = { minX: Math.min(minX + 8, 0), maxX: Math.max(maxX - 8, 0) };
    this.clamp();
  }

  clamp() {
    this.target.x = clamp(this.target.x, this.bounds.minX, this.bounds.maxX);
    this.target.z = clamp(this.target.z, -48, 7); // north as far as the Arena of Trials
  }

  flyTo(x, z, dist = null) {
    this.target.x = x;
    this.target.z = z;
    if (dist) this.distGoal = clamp(dist, this.min, this.overviewMax);
    this.clamp();
  }

  // A jolt (a great enemy's blow landing), dying away.
  shake(amount) {
    this.shakeAmt = Math.max(this.shakeAmt || 0, amount);
  }

  apply() {
    const p = this.pitch();
    this.camera.position.set(this.cur.x, this.cur.y + Math.sin(p) * this.dist, this.cur.z + Math.cos(p) * this.dist);
    this.camera.lookAt(this.cur);
    if (this.shakeAmt > 0.002) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmt;
    }
    this.camera.updateMatrixWorld();
  }

  snap() {
    this.cur.copy(this.target);
    this.dist = this.distGoal;
    this.apply();
  }

  update(dt) {
    const far = this.cur.distanceTo(this.target) > 20;
    const k = 1 - Math.exp(-dt * (far ? 3.5 : 8));
    this.cur.lerp(this.target, k);
    this.dist += (this.distGoal - this.dist) * (1 - Math.exp(-dt * 6));
    if (this.shakeAmt) this.shakeAmt *= Math.exp(-dt * 7);
    this.apply();
  }
}
