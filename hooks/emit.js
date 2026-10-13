#!/usr/bin/env node
'use strict';
// Elden Code hook. Claude Code pipes the hook payload to stdin; we keep only an allowlist of
// harmless fields (event name, tool name, slash-command name, project folder label) and POST
// them to the local bridge. Prompt text, tool inputs, file contents and messages never leave here.
// It writes nothing to stdout and always exits 0, so it can never block or steer a session.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.ELDEN_PORT) || 7777;
const TOKEN_FILE = path.join(__dirname, '..', '.elden', 'token');

const done = () => process.exit(0);
setTimeout(done, 1500);
process.on('uncaughtException', done);

let token;
try { token = fs.readFileSync(TOKEN_FILE, 'utf8').trim(); } catch { done(); }

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { if (raw.length < 4e6) raw += c; });
process.stdin.on('end', () => {
  let p;
  try { p = JSON.parse(raw); } catch { return done(); }
  const ev = extract(p);
  if (!ev) return done();
  post(ev);
});

const hash = (s, n) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, n);
const NAME = /^[A-Za-z0-9_.:-]{1,64}$/;
const name = (v) => (typeof v === 'string' && NAME.test(v) ? v : undefined);

// The project root: CLAUDE_PROJECT_DIR when the session is still inside it, otherwise the
// nearest folder above cwd that looks like a project (has .git or package.json).
function projectRoot(cwd) {
  const norm = (d) => path.resolve(d).toLowerCase();
  const dir = process.env.CLAUDE_PROJECT_DIR;
  if (!cwd) return dir || '';
  if (dir && (norm(cwd) + path.sep).startsWith(norm(dir) + path.sep)) return dir;
  const home = norm(require('os').homedir());
  let d = path.resolve(cwd);
  for (let i = 0; i < 8; i++) {
    if (norm(d) === home) break;
    if (fs.existsSync(path.join(d, '.git')) || fs.existsSync(path.join(d, 'package.json'))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return cwd;
}

function projectLabel(cwd) {
  if (typeof cwd !== 'string' || !cwd) return 'Unknown';
  const parts = cwd.replace(/\\/g, '/').split('/').filter(Boolean);
  const wt = parts.lastIndexOf('worktrees');
  if (wt >= 2 && parts[wt - 1] === '.claude') return parts[wt - 2];
  const last = parts[parts.length - 1] || 'Unknown';
  if (/^scratch-\d{4}-\d{2}-\d{2}/.test(last)) return 'Scratch';
  return last;
}

function modelFamily(id) {
  const m = /(opus|sonnet|haiku|fable)/i.exec(String(id || ''));
  return m ? m[1].toLowerCase() : 'other';
}

function slashCommand(prompt) {
  if (typeof prompt !== 'string') return undefined;
  const m = /^\s*\/([A-Za-z0-9][A-Za-z0-9_.:-]{0,47})(?=\s|$)/.exec(prompt)
    || /<command-name>\/?([A-Za-z0-9][A-Za-z0-9_.:-]{0,47})<\/command-name>/.exec(prompt);
  return m ? m[1] : undefined;
}

function notificationKind(p) {
  const t = String(p.notification_type || '');
  if (/permission/i.test(t)) return 'permission';
  if (/idle/i.test(t)) return 'idle';
  const msg = String(p.message || '');
  if (/permission/i.test(msg)) return 'permission';
  if (/waiting for your input/i.test(msg)) return 'idle';
  return 'other';
}

function extract(p) {
  if (!p || typeof p !== 'object' || !p.session_id || !p.hook_event_name) return null;
  const ev = {
    event: String(p.hook_event_name),
    sid: hash(p.session_id, 12),
    // The project root, not whatever subfolder the session has cd'd into.
    project: projectLabel(projectRoot(p.cwd)),
    at: Date.now(),
  };
  if (p.agent_id) ev.agent = hash(p.agent_id, 8);
  if (p.agent_type) ev.agentType = name(p.agent_type);

  switch (ev.event) {
    case 'PreToolUse':
    case 'PostToolUse':
    case 'PermissionRequest':
    case 'PermissionDenied':
      ev.tool = name(p.tool_name);
      if (p.tool_name === 'Skill' && p.tool_input) ev.skill = name(p.tool_input.skill);
      if ((p.tool_name === 'Agent' || p.tool_name === 'Task') && p.tool_input) ev.agentType = name(p.tool_input.subagent_type);
      break;
    case 'PostToolUseFailure':
      ev.tool = name(p.tool_name);
      ev.failed = true;
      if (p.is_interrupt) ev.reason = 'interrupt';
      break;
    case 'UserPromptSubmit':
      ev.command = slashCommand(p.prompt);
      break;
    case 'UserPromptExpansion':
      ev.command = name(p.command_name) || slashCommand(p.prompt);
      break;
    case 'Notification':
      ev.kind = notificationKind(p);
      break;
    case 'SessionStart':
      ev.source = p.source;
      if (p.model) ev.model = modelFamily(p.model);
      break;
    case 'SessionEnd':
      ev.reason = name(p.reason);
      break;
    case 'PreCompact':
    case 'PostCompact':
      ev.trigger = p.trigger;
      break;
    case 'StopFailure':
      ev.reason = name(typeof p.error === 'string' ? p.error : p.error && p.error.type);
      ev.failed = true;
      break;
    case 'PostModelSwitch':
      ev.model = modelFamily(p.to_model);
      break;
    default:
      break;
  }
  for (const k of Object.keys(ev)) if (ev[k] === undefined) delete ev[k];
  return ev;
}

function post(ev) {
  const body = JSON.stringify(ev);
  const req = http.request({
    host: '127.0.0.1',
    port: PORT,
    path: '/event',
    method: 'POST',
    timeout: 1000,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-Elden-Token': token,
    },
  }, (res) => { res.resume(); res.on('end', done); });
  req.on('error', done);
  req.on('timeout', () => { req.destroy(); done(); });
  req.end(body);
}
