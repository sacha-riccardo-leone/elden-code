'use strict';
// Allowlist validation for events arriving from the hook. Anything not listed here is dropped,
// so even a buggy or tampered hook cannot push prompt text or file contents to the game.

const EVENTS = new Set([
  'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'UserPromptExpansion',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest', 'PermissionDenied',
  'Notification', 'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop',
  'PreCompact', 'PostCompact', 'PostModelSwitch',
]);

const SOURCES = new Set(['startup', 'resume', 'clear', 'compact', 'fork']);
const MODELS = new Set(['opus', 'sonnet', 'haiku', 'fable', 'other']);
const TRIGGERS = new Set(['manual', 'auto']);
const KINDS = new Set(['permission', 'idle', 'other']);

function pick(value, re, max) {
  return typeof value === 'string' && value.length <= max && re.test(value) ? value : undefined;
}

function cleanLabel(value) {
  if (typeof value !== 'string') return 'Unknown';
  const s = value.replace(/[\u0000-\u001f\u007f<>"'`]/g, '').trim().slice(0, 48);
  return s || 'Unknown';
}

function validateEvent(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!EVENTS.has(raw.event)) return null;
  const sid = pick(raw.sid, /^[a-f0-9]{12}$/, 12);
  if (!sid) return null;

  const ev = { event: raw.event, sid, project: cleanLabel(raw.project) };
  const tool = pick(raw.tool, /^[A-Za-z0-9_.:-]+$/, 80);
  const command = pick(raw.command, /^[A-Za-z0-9_.:-]+$/, 48);
  const skill = pick(raw.skill, /^[A-Za-z0-9_.:-]+$/, 64);
  const agentType = pick(raw.agentType, /^[A-Za-z0-9_.:-]+$/, 48);
  const agent = pick(raw.agent, /^[a-f0-9]{8}$/, 8);
  const reason = pick(raw.reason, /^[A-Za-z0-9_-]+$/, 32);
  if (tool) ev.tool = tool;
  if (command) ev.command = command;
  if (skill) ev.skill = skill;
  if (agentType) ev.agentType = agentType;
  if (agent) ev.agent = agent;
  if (reason) ev.reason = reason;
  if (SOURCES.has(raw.source)) ev.source = raw.source;
  if (TRIGGERS.has(raw.trigger)) ev.trigger = raw.trigger;
  if (KINDS.has(raw.kind)) ev.kind = raw.kind;
  if (MODELS.has(raw.model)) ev.model = raw.model;
  if (raw.failed === true) ev.failed = true;
  // Hook-side clock, used only to ignore state changes that arrive out of order.
  if (Number.isFinite(raw.at) && Math.abs(raw.at - Date.now()) < 864e5) ev.at = raw.at;
  return ev;
}

module.exports = { validateEvent, EVENTS };
