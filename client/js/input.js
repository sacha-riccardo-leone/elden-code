// Pointer and keyboard, for whoever thou art (Maren, or whoever thou hast become; pilot.js): WASD /
// arrows walk (Shift runs), left click strikes (a mage casts), right click casts (whoever casts:
// Fortuna, the mages; Ulric throws his spear), R looses thine ultimate once it's full, C crouches, B
// opens thy fan of gestures (B alone: a click on thyself is a blow, as on the ground), number keys
// gesture, E uses what's in reach (interact.js), M shows the map, V turns the sound off and on
// (audio.js). Click another Tarnished to inspect it and open its fan, which offers to become them;
// drag it to carry it elsewhere; scroll to zoom. Z/X travel by grace between areas, H to Roundtable Hold. In the
// thick of a fight on the arena (fight.js) nobody can be clicked: every click is a blow. In the
// tutorial (tutorial.js) only what its step teaches gets through (`allows`): walking, then blows,
// the dodge, the ultimate, a click on the one hero there (`pickable`).
// Everything here is cosmetic: nothing is ever sent back to Claude Code.

import * as THREE from 'three';
import { GESTURES } from './director.js';
import { MOVE_KEYS } from './pilot.js';

const DRAG_THRESHOLD = 6;

export class Input {
  constructor({ canvas, camera, rig, director, ui, travel, keys, actions, active = () => true, battle = () => false, floor = () => 0, allows = () => true, pickable = () => true }) {
    this.travel = travel;
    this.active = active; // whether the world is being played (not while the title screen stands over it)
    this.allows = allows; // whether a kind of thing may be done just now ('move', 'travel', 'pick', 'drag', …)
    this.pickable = pickable; // whether someone may be clicked, to inspect and become
    this.battle = battle; // whether thou art fighting on the arena
    this.floor = floor; // how high the ground lies under thee (ground.js): a click on the ground is on it
    this.keys = keys; // held movement keys, read by the player every frame
    this.actions = actions; // thine own: emote(key), attack(groundPoint), spell(groundPoint), ult(groundPoint), crouch(), fan(), interact()
    this.canvas = canvas;
    this.camera = camera;
    this.rig = rig;
    this.director = director;
    this.ui = ui;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.press = null;
    this.dragging = null;
    this.hovered = null;
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hit = new THREE.Vector3();

    canvas.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); rig.zoom(e.deltaY); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  setRay(e) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
  }

  pick(e) {
    if (this.battle()) return null;
    this.setRay(e);
    const npcs = [...this.director.npcs.values()].filter((n) => !n.dead && n.intent.kind !== 'leave' && !n.spectre?.hidden && !n.spectre?.vanishing);
    const hits = this.ray.intersectObjects(npcs.map((n) => n.body.mesh), false);
    for (const h of hits) {
      const npc = h.object.userData.npc;
      if (npc && h.uv && npc.body.hitTest(h.uv)) return npc;
    }
    return null;
  }

  groundAt(e, height = this.floor()) {
    this.setRay(e);
    this.plane.constant = -height;
    return this.ray.ray.intersectPlane(this.plane, this.hit) ? this.hit.clone() : null;
  }

  // Where thou pointest, aiming: the ground there, carrying the pointer's ray (`ray`), so that an
  // attack can be aimed at the height it goes at (combat.js, aimOf).
  aimAt(e) {
    const p = this.groundAt(e);
    if (p) p.ray = this.ray.ray.clone();
    return p;
  }

  down(e) {
    if (e.button !== 0 && e.button !== 2) return;
    this.canvas.setPointerCapture?.(e.pointerId);
    const npc = e.button === 0 ? this.pick(e) : null;
    this.press = { npc, x: e.clientX, y: e.clientY, moved: false };
  }

  move(e) {
    this.pointer = { clientX: e.clientX, clientY: e.clientY }; // (where thou pointest: an aimed ultimate goes that way)
    const p = this.press;
    if (p) {
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (dist > DRAG_THRESHOLD) p.moved = true;
      if (p.npc && p.moved && !this.dragging && !p.npc.piloted && !p.npc.spectre && this.allows('drag')) { // thou canst not carry thyself, nor a spectre
        this.dragging = p.npc;
        p.npc.pickUp();
        this.ui.hideFan();
        this.canvas.style.cursor = 'grabbing';
      }
      if (this.dragging) {
        // Hold the character by its middle, so the sprite stays under the cursor while lifted.
        const at = this.groundAt(e, 1.0 + this.dragging.lift);
        if (at) this.dragging.dragTo(at.x, at.z);
        return;
      }
    }
    if (e.target !== this.canvas) return;
    const h = this.pick(e);
    if (h !== this.hovered) {
      if (this.hovered) this.hovered.hovered = false;
      this.hovered = h;
      if (h) h.hovered = true;
      this.ui.hovered = h;
      this.canvas.style.cursor = h && !h.piloted ? 'pointer' : 'default'; // (thyself: nothing to click)
    }
  }

  up(e) {
    const p = this.press;
    this.press = null;
    if (!p) return;
    if (this.dragging) {
      const npc = this.dragging;
      this.dragging = null;
      npc.drop();
      this.canvas.style.cursor = 'pointer';
      if (this.director.selected === npc) this.ui.showFan();
      return;
    }
    // the right button: a spell toward where it was pressed
    if (e.button === 2) {
      if (!p.moved) this.actions.spell?.(this.aimAt(e));
      return;
    }
    if (p.moved || e.button !== 0) return;
    if (this.battle()) {
      // mid-fight, a click is a blow, even with a fan open (it just folds)
      if (this.director.selected || this.ui.fanOwner) { this.director.select(null); this.ui.closeFan(); }
      this.actions.attack(this.aimAt(e));
      return;
    }
    // (thyself, or someone who may not be clicked just now, in the tutorial: the click is a blow, as
    // on the ground; thy fan of gestures opens with B alone)
    const npc = p.npc && !p.npc.piloted && this.allows('pick') && this.pickable(p.npc) ? p.npc : null;
    if (npc) {
      this.director.select(npc === this.director.selected ? null : npc);
    } else if (this.director.selected || this.ui.fanOwner) {
      // a click away from an open fan just folds it
      this.director.select(null);
      this.ui.closeFan();
    } else {
      this.actions.attack(this.aimAt(e));
    }
  }

  key(e) {
    if (!this.active()) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (MOVE_KEYS.has(e.code)) {
      if (this.allows('move')) this.keys.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault(); // walk, don't scroll the page
      return;
    }
    if (e.code === 'Space') e.preventDefault(); // (never a click on whatever button has the focus)
    if (e.repeat) return;
    if (e.key === 'Escape') { this.director.select(null); this.ui.closeFan(); this.ui.closeTable(); this.ui.closeGrace(); }
    const travel = this.allows('travel');
    if (travel && (e.code === 'KeyZ' || e.key === '[')) this.travel.cycle(-1);
    if (travel && (e.code === 'KeyX' || e.key === ']')) this.travel.cycle(1);
    if (e.code === 'KeyE') this.actions.interact();
    if (e.code === 'Space') this.actions.dodge();
    if (travel && (e.code === 'KeyH' || e.key === 'Home')) this.travel.home();
    if (travel && (e.code === 'KeyM' || e.key === '0')) this.travel.overview();
    if (e.code === 'KeyC') this.actions.crouch();
    if (e.code === 'KeyQ') this.actions.focus();
    if (e.code === 'KeyR') this.actions.ult?.(this.pointer ? this.aimAt(this.pointer) : null);
    if (e.code === 'KeyB') this.actions.fan();
    if (e.code === 'KeyV') this.actions.sound?.();
    const n = Number(e.key);
    if (n >= 1 && n <= GESTURES.length) this.actions.emote(GESTURES[n - 1].key); // only thou gesturest
    if (e.key === '+' || e.key === '=') this.rig.zoom(-200);
    if (e.key === '-') this.rig.zoom(200);
  }
}
