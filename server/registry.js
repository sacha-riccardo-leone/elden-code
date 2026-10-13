'use strict';
// In-memory picture of every session the bridge has heard from, so a freshly opened
// game tab can place everyone immediately instead of waiting for their next event.

const STALE_WORKING_MS = 10 * 60 * 1000; // no news while "working" -> probably interrupted
const FORGET_MS = 3 * 60 * 60 * 1000;    // no news at all -> session is long gone
const MAX_TOOL_KEYS = 40;

class Registry {
  constructor() {
    this.sessions = new Map();
  }

  get size() {
    return this.sessions.size;
  }

  list() {
    return [...this.sessions.values()].map(snapshot);
  }

  apply(ev) {
    let s = this.sessions.get(ev.sid);
    if (ev.event === 'SessionEnd') {
      this.sessions.delete(ev.sid);
      return { ...(s ? snapshot(s) : blank(ev)), state: 'gone' };
    }
    if (!s) {
      s = blank(ev);
      this.sessions.set(ev.sid, s);
    }
    s.lastAt = ev.ts;
    if (ev.project && ev.project !== 'Unknown') s.project = ev.project;
    if (ev.model) s.model = ev.model;

    // Hooks run asynchronously, so two events from the same instant can land swapped.
    // Counters always update; the state only follows events that are newer than the last one applied.
    const fresh = !ev.at || ev.at >= s.stateAt;
    if (fresh && ev.at) s.stateAt = ev.at;
    const setState = (state) => { if (fresh) s.state = state; };

    if (ev.agent) {
      // A subagent's own tool calls: credit the session, but the main character keeps its pose.
      if (ev.event === 'PreToolUse' && ev.tool) countTool(s, ev.tool);
      if (ev.event === 'SubagentStart') s.spirits = Math.min(s.spirits + 1, 8);
      if (ev.event === 'SubagentStop') s.spirits = Math.max(0, s.spirits - 1);
      return snapshot(s);
    }

    switch (ev.event) {
      case 'SessionStart':
        setState('idle');
        s.tool = null;
        s.spirits = 0;
        break;
      case 'UserPromptSubmit':
      case 'UserPromptExpansion':
        setState('working');
        s.tool = null;
        if (ev.event === 'UserPromptSubmit') s.prompts += 1;
        s.questStartedAt = ev.ts;
        break;
      case 'PreToolUse':
        setState('working');
        if (fresh) s.tool = ev.tool || null;
        if (ev.tool) countTool(s, ev.tool);
        break;
      case 'PostToolUse':
      case 'PostToolUseFailure':
      case 'PermissionDenied':
        if (s.state === 'waiting') setState('working');
        break;
      case 'PermissionRequest':
        setState('waiting');
        break;
      case 'Notification':
        if (ev.kind === 'permission') setState('waiting');
        break;
      case 'SubagentStart':
        s.spirits = Math.min(s.spirits + 1, 8);
        break;
      case 'SubagentStop':
        s.spirits = Math.max(0, s.spirits - 1);
        break;
      case 'Stop':
      case 'StopFailure':
        setState('idle');
        s.tool = null;
        s.questStartedAt = null;
        break;
      default:
        break;
    }
    return snapshot(s);
  }

  // Returns synthetic changes for sessions that went quiet.
  sweep(now) {
    const changes = [];
    for (const s of this.sessions.values()) {
      if (now - s.lastAt > FORGET_MS) {
        this.sessions.delete(s.sid);
        changes.push({ ev: { event: 'Gone', sid: s.sid, ts: now }, session: { ...snapshot(s), state: 'gone' } });
      } else if ((s.state !== 'idle' || s.spirits) && now - s.lastAt > STALE_WORKING_MS) {
        s.state = 'idle';
        s.tool = null;
        s.spirits = 0;
        changes.push({ ev: { event: 'Idle', sid: s.sid, ts: now }, session: snapshot(s) });
      }
    }
    return changes;
  }
}

function countTool(s, tool) {
  if (s.tools[tool] || Object.keys(s.tools).length < MAX_TOOL_KEYS) s.tools[tool] = (s.tools[tool] || 0) + 1;
  s.toolTotal += 1;
}

function blank(ev) {
  return {
    sid: ev.sid,
    project: ev.project || 'Unknown',
    model: null,
    state: 'idle',
    stateAt: 0,
    tool: null,
    tools: {},
    toolTotal: 0,
    prompts: 0,
    spirits: 0,
    startedAt: ev.ts,
    lastAt: ev.ts,
    questStartedAt: null,
  };
}

function snapshot(s) {
  return { ...s, tools: { ...s.tools } };
}

module.exports = { Registry };
