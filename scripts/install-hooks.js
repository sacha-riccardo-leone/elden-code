'use strict';
// Adds Elden Code's hook to ~/.claude/settings.json (or removes it with --uninstall).
// Every other setting and hook is preserved, and a timestamped backup is written first.

const fs = require('fs');
const os = require('os');
const path = require('path');

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const EMIT = path.resolve(__dirname, '..', 'hooks', 'emit.js').replace(/\\/g, '/');
const COMMAND = `node "${EMIT}"`;
const OURS = /elden[-_ ]?code.*hooks\/emit\.js/i;

const TOOL_EVENTS = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest', 'PermissionDenied'];
const OTHER_EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit', 'UserPromptExpansion', 'Notification',
  'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop', 'PreCompact', 'PostCompact', 'PostModelSwitch',
];

const uninstall = process.argv.includes('--uninstall');

let settings = {};
let original = null;
if (fs.existsSync(SETTINGS)) {
  original = fs.readFileSync(SETTINGS, 'utf8');
  try {
    settings = JSON.parse(original);
  } catch (err) {
    console.error(`Could not parse ${SETTINGS}: ${err.message}\nFix it by hand first; nothing was changed.`);
    process.exit(1);
  }
}

// Drop any previous Elden Code entries so installing twice never duplicates them.
const hooks = settings.hooks && typeof settings.hooks === 'object' ? settings.hooks : {};
for (const event of Object.keys(hooks)) {
  if (!Array.isArray(hooks[event])) continue;
  hooks[event] = hooks[event]
    .map((group) => ({ ...group, hooks: (group.hooks || []).filter((h) => !OURS.test(String(h.command || ''))) }))
    .filter((group) => group.hooks.length > 0);
  if (hooks[event].length === 0) delete hooks[event];
}

if (!uninstall) {
  const handler = (event) => ({
    type: 'command',
    command: COMMAND,
    // Background hooks never make a session wait. SessionEnd runs in the foreground (it cannot
    // block anything) so the farewell is delivered before the session tears down.
    ...(event === 'SessionEnd' ? { timeout: 3 } : { async: true, timeout: 5 }),
  });
  for (const event of TOOL_EVENTS) {
    hooks[event] = [...(hooks[event] || []), { matcher: '*', hooks: [handler(event)] }];
  }
  for (const event of OTHER_EVENTS) {
    hooks[event] = [...(hooks[event] || []), { hooks: [handler(event)] }];
  }
}

if (Object.keys(hooks).length) settings.hooks = hooks;
else delete settings.hooks;

if (original !== null) {
  const backup = `${SETTINGS}.elden-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.writeFileSync(backup, original);
  console.log(`Backup written: ${backup}`);
}
fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');

console.log(uninstall
  ? `Removed Elden Code hooks from ${SETTINGS}`
  : `Installed Elden Code hooks in ${SETTINGS}\n  -> ${COMMAND}\nNew Claude Code sessions will appear in the courtyard while the bridge runs (npm start).`);
