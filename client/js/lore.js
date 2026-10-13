// Names, epithets and the small talk of idle Tarnished. Who says what comes from voices.js (each
// character's own way of talking); the news they trade is each session's real activity (tool
// counts, project, time awake), so the chatter means something.

import { hashStr } from './pixel.js';
import { speak, voiceOf } from './voices.js';

const NAMES = [
  'Aldric', 'Bertholt', 'Caedmon', 'Doran', 'Edda', 'Fenwick', 'Gisela', 'Hroth', 'Isolde', 'Jorvik',
  'Kestrel', 'Leofric', 'Maren', 'Nyx', 'Osric', 'Perrin', 'Quill', 'Rhosyn', 'Sigrun', 'Tamsin',
  'Ulric', 'Vesper', 'Wynn', 'Ysolde', 'Brannoc', 'Corvin', 'Elowen', 'Garrick', 'Hesper', 'Ingram',
  'Lisbet', 'Morrow', 'Odile', 'Rowan', 'Seraphine', 'Thane', 'Varek', 'Wendeline',
];

const EPITHETS = [
  'the Ashen', 'of the Hollow Vale', 'the Lantern-bearer', 'of Gloam', 'the Twice-Risen', 'the Grey',
  'of the Ember Keep', 'the Hushed', 'Rune-scribe', 'the Wanderer', 'of the Thornwood', 'the Unbowed',
  'of the Sunken Choir', 'the Patient', 'Quill-hand', 'of the Pale Marsh', 'the Oathless', 'Bell-warden',
];

const CLASS_TITLE = {
  knight: 'Knight', sorcerer: 'Sorcerer', ranger: 'Ranger', pilgrim: 'Pilgrim',
  vagabond: 'Vagabond', noble: 'Noble', monk: 'Prophet', hunter: 'Hunter',
};

export function nameFor(sid) {
  const h = hashStr(`name:${sid}`);
  return { first: NAMES[h % NAMES.length], epithet: EPITHETS[(h >>> 8) % EPITHETS.length] };
}

export function classTitle(cls) {
  return CLASS_TITLE[cls] || 'Tarnished';
}

function sum(tools, names) {
  return names.reduce((n, k) => n + (tools[k] || 0), 0);
}

export function stats(session) {
  const t = session.tools || {};
  return {
    forged: sum(t, ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']),
    read: sum(t, ['Read', 'Grep', 'Glob', 'LS']),
    rituals: sum(t, ['Bash', 'PowerShell']),
    ravens: sum(t, ['WebSearch', 'WebFetch']) + Object.keys(t).filter((k) => k.startsWith('mcp__')).reduce((n, k) => n + t[k], 0),
    spirits: sum(t, ['Agent', 'Task']),
    total: session.toolTotal || 0,
    prompts: session.prompts || 0,
    hours: Math.max(0, (Date.now() - (session.startedAt || Date.now())) / 3.6e6),
  };
}

// What `npc` has to tell of its quest, from the session's real tallies: one of its deeds, in its
// own voice ("I struck the anvil 12 times for Elden-Code"), or that there is naught yet.
function news(npc, to) {
  const s = stats(npc.session);
  const deeds = [
    ['forged', s.forged], ['read', s.read], ['rituals', s.rituals], ['ravens', s.ravens], ['spirits', s.spirits],
    ['prompts', s.prompts > 3 ? s.prompts : 0], ['hours', Math.floor(s.hours)],
  ].filter(([, n]) => n > 0);
  if (!deeds.length) return speak(npc, 'news_none', to);
  const [key, n] = deeds[Math.floor(Math.random() * deeds.length)];
  return speak(npc, `news_${key}`, to, { n });
}

const busy = (n) => stats(n.session).total > 0;

// What two idle Tarnished talk about: the opener (A) and the other (B) take turns through the
// base lines (see voices.js); [x, y] picks one of the two. Weights follow what they're up to.
const TOPICS = [
  { steps: ['hail', 'hail_back', 'ask_news', 'news', ['impressed', 'scoff'], 'bye'], weight: () => 3 },
  { steps: ['ask_news', 'news', ['impressed', 'scoff']], weight: (a, b) => (busy(b) ? 3 : 0.5) },
  { steps: ['tired', 'rest_advice', 'thanks'], weight: (a) => 1 + Math.min(3, stats(a.session).hours) + (busy(a) ? 1 : 0) },
  { steps: ['hungry', 'food_reply', 'thanks'], weight: () => 1 },
  { steps: ['bored', 'idle_reply'], weight: (a) => (busy(a) ? 0.3 : 2) },
  { steps: ['muse', 'muse_reply'], weight: () => 2 },
  { steps: ['compliment', 'compliment_reply'], weight: () => 1 },
  { steps: ['challenge', ['accept_duel', 'decline_duel']], weight: () => 0.7 },
];

const QUIET = 0.2; // a voice less chatty than this barely speaks

// An exchange between two idle characters, each in their own voice: [speaker, text] pairs
// (0 = a, 1 = b). The chattier one tends to open; a quiet one gets teased for it; a terse one
// may cut it short.
export function conversation(a, b) {
  const ca = voiceOf(a).chatty;
  const cb = voiceOf(b).chatty;
  const [p, q] = Math.random() * (ca + cb) < ca ? [a, b] : [b, a];
  const total = TOPICS.reduce((n, t) => n + t.weight(p, q), 0);
  let r = Math.random() * total;
  const topic = TOPICS.find((t) => (r -= t.weight(p, q)) <= 0) || TOPICS[0];
  let steps = topic.steps;
  if (voiceOf(q).chatty < QUIET) steps = voiceOf(p).chatty < QUIET ? ['hail', 'hail_back'] : [steps[0], steps[1], 'quiet_reply'];
  const lines = [];
  for (let i = 0; i < steps.length; i++) {
    const [speaker, listener] = i % 2 ? [q, p] : [p, q];
    if (i >= 3 && Math.random() > 0.35 + voiceOf(speaker).chatty * 0.6) break;
    const step = Array.isArray(steps[i]) ? steps[i][Math.floor(Math.random() * steps[i].length)] : steps[i];
    const text = step === 'news' ? news(speaker, listener) : speak(speaker, step, listener);
    lines.push([speaker === a ? 0 : 1, text]);
  }
  return lines;
}
