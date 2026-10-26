// ?morvane in the address (main.js): one of Morvane's moves again and again, to watch and hear it
// without fighting him: the Frenzied Eye, or the one named (?morvane=slash, lunge, fly or throw). As
// thou settest out, his fight is called and thou art set in his arena (where nothing can fell thee);
// he comes straight in his second form (no first form, no change: MorvaneMind.flameNow) and makes
// that move and no other, at thee, a moment apart, on and on (the fight never runs out of time). As
// with ?felled (felled-loop.js), nothing of it is remembered.
// His moves to choose from; how long he waits before the first (his sounds are still being fetched
// as he comes, fight.start) and between one and the next, once he's ready again (seconds).
const MOVES = ['eye', 'slash', 'lunge', 'fly', 'throw'];
const LOOP = { first: 2.5, gap: 1.5 };

export function moveLoop({ fight, pilot, world }, name) {
  const move = MOVES.includes(name) ? name : 'eye';
  let phase = 'call';
  let t = 0;
  let wait = LOOP.first;
  let last = performance.now();
  const tick = (now) => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, Math.max(0, now - last) / 1000);
    last = now;
    const b = fight.boss;
    if (pilot.npc) pilot.hp = pilot.maxHp; // (never felled himself)
    switch (phase) {
      case 'call':
        // (once his art has loaded: before, another great enemy would come instead)
        if (pilot.npc && fight.state === 'idle' && fight.kinds().includes('morvane') && fight.start('move', [], 'morvane')) phase = 'arena';
        break;
      case 'arena':
        // (once the arena has risen: on it, so that he comes)
        if (fight.state === 'gathering' || fight.state === 'fighting') {
          const me = pilot.npc;
          const A = world.arena;
          if (!fight.inArena(me)) me.pos.set(A.cx, A.cz + 6);
          if (b?.mind?.flameNow) {
            b.mind.flameNow();
            phase = 'move';
            t = 0;
          }
        }
        break;
      case 'move':
        if (!b) { phase = 'call'; break; }
        b.cd = 999; // (no move of his own choosing)
        fight.t = 0;
        if (b.state !== 'ready' || b.mind.gone) { t = 0; break; } // (counted from when he's ready again)
        t += dt;
        if (t >= wait && b.mind.start(move)) {
          wait = LOOP.gap;
          t = 0;
        }
        break;
      default:
        break;
    }
  };
  requestAnimationFrame(tick);
}
