// ?felled in the address (main.js): Morvane felled again and again, to watch and hear his fall. As
// thou settest out, his fight is called and thou art set in his arena (where nothing can fell thee);
// he comes straight in his second form (no first form, no change: MorvaneMind.flameNow), stands a
// while, his arena burning, and falls as he does in the fight (MORVANE.felled: seen whole, then
// fading out with all that's his); and just before he'd be gone, he stands again where he fell
// (MorvaneMind.rise), on and on. Nothing of it is remembered: he's never felled for good.
// How long he stands each time (seconds, once he's whole), and how long before his fall's end he
// stands again.
const LOOP = { stand: 3, early: 0.1 };

export function felledLoop({ fight, pilot, world }) {
  let phase = 'call';
  let t = 0;
  let last = performance.now();
  const inArena = () => {
    const me = pilot.npc;
    const A = world.arena;
    if (!fight.inArena(me)) me.pos.set(A.cx, A.cz + 6);
  };
  const tick = (now) => {
    requestAnimationFrame(tick);
    t += Math.min(0.1, Math.max(0, now - last) / 1000);
    last = now;
    const b = fight.boss;
    if (pilot.npc) pilot.hp = pilot.maxHp; // (never felled himself)
    switch (phase) {
      case 'call':
        // (once his art has loaded: before, another great enemy would come instead)
        if (pilot.npc && fight.state === 'idle' && fight.kinds().includes('morvane') && fight.start('felled', [], 'morvane')) phase = 'arena';
        break;
      case 'arena':
        // (once the arena has risen: on it, so that he comes)
        if (fight.state === 'gathering' || fight.state === 'fighting') {
          inArena();
          if (b?.mind?.flameNow) {
            b.mind.flameNow();
            phase = 'stand';
            t = 0;
          }
        }
        break;
      case 'stand':
        if (!b) { phase = 'call'; break; }
        b.cd = 999; // (he doesn't strike)
        if (b.state !== 'ready' || b.mind.gone) t = 0; // (counted from when he's whole)
        else if (t >= LOOP.stand) {
          b.hp = 1;
          b.damage(1);
          phase = 'fall';
        }
        break;
      case 'fall': {
        if (!b) { phase = 'call'; break; }
        const { hold, fade } = b.mind.felled();
        if (b.state === 'dying' && b.t >= hold + fade - LOOP.early) {
          b.mind.rise();
          fight.t = 0; // (the fight never runs out of time)
          phase = 'stand';
          t = 0;
        }
        break;
      }
      default:
        break;
    }
  };
  requestAnimationFrame(tick);
}
