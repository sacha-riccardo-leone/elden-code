// Phantoms: fake Claude Code sessions that live only in this tab. They feed the director the same
// event and session shapes the bridge sends, so the world can be seen working without (or before)
// real sessions.
//   - "Summon phantoms" (local): five sessions on five islands, until dismissed.
//   - The public demo (mode.js): an endless world of them. Sessions start and end, projects come
//     and go (an island nobody calls home any more sinks back into the mist, director.js), and they
//     work in realistic runs: exploring, implementing, debugging, researching, planning, shipping,
//     with slash commands, permission waits, subagents, model switches, compactions and now and then
//     a run of failures (which can bring a great enemy, fight.js).

const PROJECTS = ['Stormveil-UI', 'Raya-Lucaria', 'Leyndell-API', 'Liurnia-Docs', 'Caelid-Infra'];
// the public demo's projects: what real repositories tend to be called
const PUBLIC_PROJECTS = [
  'checkout-service', 'marketing-site', 'ios-app', 'billing-api', 'design-system', 'data-pipeline',
  'auth-gateway', 'docs-portal', 'search-indexer', 'infra-terraform', 'ml-recommender',
  'admin-dashboard', 'notifications-worker', 'cli-tools', 'game-server', 'analytics-sdk',
];
const MODELS = [['opus', 4], ['sonnet', 4], ['haiku', 1.5], ['fable', 0.6]];
const AGENTS = ['Explore', 'general-purpose', 'Plan'];
const SKILLS = ['frontend-design', 'pdf', 'xlsx', 'docx', 'webapp-testing', 'mcp-builder'];
const MCP = [
  'mcp__github__create_pull_request', 'mcp__github__get_issue', 'mcp__linear__get_issue', 'mcp__slack__post_message',
  'mcp__sentry__get_issue_details', 'mcp__notion__search', 'mcp__playwright__browser_navigate', 'mcp__postgres__query',
];
// Slash commands, now and then before a turn. compact, clear and model have their own events.
const COMMANDS = [
  ['code-review', 3], ['review', 2], ['security-review', 1], ['simplify', 1.5], ['loop', 0.6],
  ['compact', 2], ['clear', 1], ['model', 1.2],
];

// What a turn of work looks like, tool by tool ('?' may fail now and then, '!' fails in a bad run).
const n = (tool, a, b) => Array.from({ length: a + Math.floor(Math.random() * (b - a + 1)) }, () => tool);
const pickOf = (list) => list[Math.floor(Math.random() * list.length)];
const FLOWS = [ // [steps, how often]
  [() => ['Glob', ...n('Read', 2, 4), 'Grep', ...n('Read', 1, 2)], 4], // finding their way around
  [() => ['Read', 'Grep', ...n('Edit', 2, 5), 'Bash?', 'Edit', 'Bash?'], 5], // implementing, then the tests
  [() => ['Bash!', 'Read', 'Grep', 'Edit', 'Bash!', 'Read', 'Edit', 'Bash!'], 2.5], // debugging
  [() => ['WebSearch', 'WebFetch', 'WebFetch', 'Read', 'Write'], 1.5], // reading up on something
  [() => ['TodoWrite', 'Agent', 'Read', 'TodoWrite', ...n('Edit', 1, 3), 'TodoWrite'], 2], // planning a change
  [() => ['Read', 'Edit', 'Bash?', 'Bash', pickOf(MCP.slice(0, 2))], 1.5], // shipping it
  [() => ['Skill', 'Write', 'Edit', 'Bash?'], 1], // with a skill
  [() => [pickOf(MCP), 'Read', 'Edit', pickOf(MCP)], 1.2], // with other services
];
const REVIEW = () => ['Agent', 'Agent', 'Read', 'Grep', 'Read']; // /code-review and friends
// How long each kind of tool call takes (seconds).
const TAKES = { Read: [1.5, 4], Grep: [1.5, 3.5], Glob: [1, 2.5], Edit: [3, 7], Write: [3, 6], Bash: [4, 10], WebSearch: [3, 6], WebFetch: [3, 6], TodoWrite: [1.5, 3], Skill: [3, 6] };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const hex = (k) => Array.from({ length: k }, () => Math.floor(Math.random() * 16).toString(16)).join('');

function weighted(list) {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of list) if ((r -= w) <= 0) return v;
  return list[0][0];
}

function reduce(s, ev) {
  s.lastAt = Date.now();
  switch (ev.event) {
    case 'SessionStart': s.state = 'idle'; s.tool = null; break;
    case 'UserPromptSubmit': s.state = 'working'; s.tool = null; s.prompts += 1; break;
    case 'PreToolUse':
      if (ev.agent) break;
      s.state = 'working'; s.tool = ev.tool; s.toolTotal += 1; s.tools[ev.tool] = (s.tools[ev.tool] || 0) + 1;
      break;
    case 'PermissionRequest': s.state = 'waiting'; break;
    case 'PostToolUse': case 'PostToolUseFailure': case 'PermissionDenied': if (s.state === 'waiting') s.state = 'working'; break;
    case 'SubagentStart': s.spirits += 1; break;
    case 'SubagentStop': s.spirits = Math.max(0, s.spirits - 1); break;
    case 'Stop': case 'StopFailure': s.state = 'idle'; s.tool = null; break;
    case 'PostModelSwitch': s.model = ev.model; break;
    case 'SessionEnd': s.state = 'gone'; break;
    default: break;
  }
  return { ...s, tools: { ...s.tools } };
}

export class Demo {
  constructor(director) {
    this.director = director;
    this.active = false;
    this.endless = false;
    this.phantoms = [];
  }

  toggle() {
    if (this.active) this.stop();
    else this.start();
    return this.active;
  }

  // "Summon phantoms": five sessions, one per island, until dismissed.
  start(count = 5) {
    if (this.active) return;
    this.active = true;
    for (let i = 0; i < count; i++) this.spawn(PROJECTS[i % PROJECTS.length], { delay: i * 1400 });
  }

  stop() {
    this.active = false;
    for (const ph of this.phantoms) {
      ph.alive = false;
      this.emit(ph, { event: 'SessionEnd', reason: 'other' });
    }
    this.phantoms = [];
  }

  // The public demo: sessions come and go forever, a few at a time, over a handful of projects
  // that themselves come and go.
  startWorld() {
    if (this.active) return;
    this.active = true;
    this.endless = true;
    this.born = Date.now();
    const first = [...PUBLIC_PROJECTS].sort(() => Math.random() - 0.5).slice(0, 3);
    first.forEach((p, i) => this.spawn(p, { delay: 800 + i * 2200, fresh: false }));
    this.spawn(first[0], { delay: 9000, fresh: false });
    this.tend();
  }

  // Every few seconds: start a session when there are fewer than the world wants just now (the
  // number drifts slowly between three and seven), on an island already there or on a new one.
  async tend() {
    while (this.active && this.endless) {
      await sleep(rand(5000, 11000));
      const live = this.phantoms.filter((ph) => ph.alive);
      const minutes = (Date.now() - this.born) / 60000;
      const want = Math.round(4.5 + 2 * Math.sin(minutes / 4) + rand(-0.6, 0.6));
      if (live.length >= want) continue;
      const project = this.pickProject(live);
      if (project) this.spawn(project.name, { fresh: project.fresh });
    }
  }

  pickProject(live) {
    const { world } = this.director.ctx;
    const standing = (p) => { const r = world.regions.get(p); return r && !r.sinking && !r.sunk; };
    const busy = new Map();
    for (const ph of live) busy.set(ph.s.project, (busy.get(ph.s.project) || 0) + 1);
    const islands = PUBLIC_PROJECTS.filter(standing);
    const crowded = [...world.regions.values()].filter((r) => !r.sinking).length;
    // mostly more work where work is already going on; sometimes a new project rises
    const open = islands.filter((p) => (busy.get(p) || 0) < 3);
    const fresh = PUBLIC_PROJECTS.filter((p) => !world.regions.has(p));
    if (fresh.length && crowded < 5 && (Math.random() < 0.4 || !open.length)) return { name: pickOf(fresh), fresh: true };
    if (open.length) return { name: pickOf(open), fresh: false };
    return null;
  }

  spawn(project, { delay = 0, fresh = false } = {}) {
    const s = {
      sid: `demo${hex(8)}`, demo: true, project, model: weighted(MODELS),
      state: 'idle', tool: null, tools: {}, toolTotal: 0, prompts: 0, spirits: 0,
      startedAt: Date.now() - (fresh ? 0 : rand(5, 180) * 60000), lastAt: Date.now(),
    };
    // the public demo's sessions end after a while; "Summon phantoms" ones last till dismissed
    const ph = { s, alive: true, fresh, until: this.endless ? Date.now() + rand(4, 14) * 60000 : Infinity };
    this.phantoms.push(ph);
    setTimeout(() => this.run(ph), delay);
  }

  emit(ph, ev) {
    const full = { ...ev, sid: ph.s.sid, project: ph.s.project, ts: Date.now() };
    ph.s = reduce(ph.s, full);
    this.director.event(full, ph.s);
  }

  live(ph) {
    return ph.alive && this.active;
  }

  async run(ph) {
    if (!this.live(ph)) return;
    this.emit(ph, { event: 'SessionStart', source: 'startup', model: ph.s.model });
    await sleep(rand(4000, 9000));
    if (ph.fresh && Math.random() < 0.6) await this.turn(ph, 'init'); // a new project, a new oath
    while (this.live(ph) && Date.now() < ph.until) {
      await this.turn(ph);
      if (!this.live(ph)) return;
      // the person at the keyboard reads, thinks, types
      await sleep(this.endless ? rand(8000, 32000) : rand(15000, 45000));
    }
    if (!this.live(ph)) return;
    ph.alive = false;
    this.emit(ph, { event: 'SessionEnd', reason: Math.random() < 0.8 ? 'prompt_input_exit' : 'other' });
    this.phantoms = this.phantoms.filter((p) => p !== ph);
  }

  // One turn: a prompt (or a slash command), a run of tool calls, and its end.
  async turn(ph, command = null) {
    const cmd = command ?? (Math.random() < 0.14 ? weighted(COMMANDS) : null);
    if (cmd === 'compact') {
      this.emit(ph, { event: 'UserPromptExpansion', command: 'compact' });
      this.emit(ph, { event: 'PreCompact', trigger: 'manual' });
      await sleep(rand(2500, 4000));
      this.emit(ph, { event: 'PostCompact', trigger: 'manual' });
      return;
    }
    if (cmd === 'clear') {
      this.emit(ph, { event: 'UserPromptExpansion', command: 'clear' });
      this.emit(ph, { event: 'SessionStart', source: 'clear', model: ph.s.model });
      return;
    }
    if (cmd === 'model') {
      const model = weighted(MODELS.filter(([m]) => m !== ph.s.model));
      this.emit(ph, { event: 'UserPromptExpansion', command: 'model' });
      await sleep(rand(800, 1600));
      this.emit(ph, { event: 'PostModelSwitch', model });
      return;
    }
    if (cmd) this.emit(ph, { event: 'UserPromptExpansion', command: cmd });
    this.emit(ph, { event: 'UserPromptSubmit', command: cmd || undefined });
    await sleep(rand(1500, 3500));
    const steps = /review|simplify/.test(cmd || '') ? REVIEW() : weighted(FLOWS)();
    const bad = Math.random() < (this.endless ? 0.05 : 0.03); // a run where nothing works
    for (const step of steps) {
      if (!this.live(ph)) return;
      const tool = step.replace(/[?!]$/, '');
      if ((tool === 'Bash' || tool === 'Write' || tool.startsWith('mcp__')) && Math.random() < 0.22) {
        this.emit(ph, { event: 'PermissionRequest', tool });
        await sleep(rand(4000, 12000));
        if (!this.live(ph)) return;
        if (Math.random() < 0.08) { this.emit(ph, { event: 'PermissionDenied', tool }); continue; }
      }
      const agentType = tool === 'Agent' ? pickOf(AGENTS) : undefined;
      this.emit(ph, { event: 'PreToolUse', tool, agentType, skill: tool === 'Skill' ? pickOf(SKILLS) : undefined });
      if (tool === 'Agent') {
        const agent = hex(8);
        this.emit(ph, { event: 'SubagentStart', agent, agentType });
        for (let k = 0, m = Math.floor(rand(3, 7)); k < m && this.live(ph); k++) {
          await sleep(rand(1500, 3000));
          this.emit(ph, { event: 'PreToolUse', agent, tool: pickOf(['Read', 'Grep', 'Glob', 'Read']) });
        }
        this.emit(ph, { event: 'SubagentStop', agent, agentType });
      } else {
        const [a, b] = TAKES[tool] || [2.5, 6];
        await sleep(rand(a, b) * 1000);
      }
      if (!this.live(ph)) return;
      const fails = (step.endsWith('!') && bad) || (step.endsWith('?') && Math.random() < 0.15) || Math.random() < 0.02;
      if (fails) this.emit(ph, { event: 'PostToolUseFailure', tool, failed: true });
      else this.emit(ph, { event: 'PostToolUse', tool });
    }
    if (!this.live(ph)) return;
    if (Math.random() < 0.03) this.emit(ph, { event: 'StopFailure', reason: 'rate_limit', failed: true });
    else this.emit(ph, { event: 'Stop' });
    if (Math.random() < 0.06) {
      await sleep(rand(3000, 6000));
      this.emit(ph, { event: 'PreCompact', trigger: 'auto' });
      await sleep(2500);
      this.emit(ph, { event: 'PostCompact', trigger: 'auto' });
    }
  }
}
