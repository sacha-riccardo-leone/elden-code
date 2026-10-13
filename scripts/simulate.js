'use strict';
// Plays fake Claude Code sessions through the real hook script (hooks/emit.js), exercising
// the exact path a real session takes: hook payload -> sanitizer -> bridge -> game.
// The payloads deliberately include prompt text and file contents to prove they never reach the game.

const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const EMIT = path.join(__dirname, '..', 'hooks', 'emit.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fire(payload) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [EMIT], { stdio: ['pipe', 'inherit', 'inherit'] });
    child.on('exit', resolve);
    child.stdin.end(JSON.stringify(payload));
  });
}

function session(cwd) {
  const session_id = crypto.randomUUID();
  const base = { session_id, cwd, transcript_path: 'C:/fake/transcript.jsonl' };
  const send = (hook_event_name, extra = {}) => fire({ ...base, hook_event_name, ...extra });
  const tool = async (tool_name, tool_input, pause = 900) => {
    await send('PreToolUse', { tool_name, tool_input });
    await sleep(pause);
    await send('PostToolUse', { tool_name, tool_input, tool_response: { ok: true } });
  };
  return { send, tool };
}

async function knight() {
  const s = session('C:/Users/someone/Desktop/IT/R2JC');
  await s.send('SessionStart', { source: 'startup', model: 'claude-opus-5-5' });
  await sleep(2500);
  await s.send('UserPromptSubmit', { prompt: 'SECRET-PROMPT-TEXT fix the login bug, password=hunter2' });
  await s.tool('Grep', { pattern: 'login', path: 'src' }, 2500);
  await s.tool('Read', { file_path: 'C:/Users/someone/secret/.env' }, 3000);
  await s.tool('Edit', { file_path: 'src/auth.ts', old_string: 'SECRET-FILE-CONTENT', new_string: 'x' }, 5000);
  await s.send('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'rm -rf build && npm test' } });
  await s.send('Notification', { message: 'Claude needs your permission to use Bash', notification_type: 'permission_prompt' });
  await sleep(6000);
  await s.tool('Bash', { command: 'npm test' }, 5000);
  await s.send('Stop', { stop_hook_active: false, last_assistant_message: 'SECRET-ASSISTANT-TEXT' });
  await sleep(4000);
  await s.send('UserPromptExpansion', { expansion_type: 'slash_command', command_name: 'code-review', command_args: 'SECRET-ARGS', prompt: '/code-review SECRET-ARGS' });
  await s.send('UserPromptSubmit', { prompt: '/code-review SECRET-ARGS' });
  await s.tool('Read', { file_path: 'src/auth.ts' }, 2500);
  await s.send('Stop', {});
}

async function scholar() {
  const s = session('C:/Users/someone/Desktop/Business/Ordine/Ordine/Ordine-AI/.claude/worktrees/amazing-nobel-a1b197');
  await sleep(1200);
  await s.send('SessionStart', { source: 'startup', model: 'claude-sonnet-5-5' });
  await sleep(3000);
  await s.send('UserPromptSubmit', { prompt: 'research the API' });
  await s.tool('WebSearch', { query: 'SECRET-QUERY' }, 3000);
  await s.tool('WebFetch', { url: 'https://example.com/SECRET' }, 3000);
  await s.tool('Agent', { subagent_type: 'Explore', prompt: 'SECRET-SUBAGENT-PROMPT' }, 300);
  const agent_id = crypto.randomUUID();
  await s.send('SubagentStart', { agent_id, agent_type: 'Explore' });
  await s.send('PreToolUse', { agent_id, agent_type: 'Explore', tool_name: 'Glob', tool_input: { pattern: '**/*.ts' } });
  await sleep(4000);
  await s.send('SubagentStop', { agent_id, agent_type: 'Explore', last_assistant_message: 'SECRET' });
  await s.tool('Write', { file_path: 'notes.md', content: 'SECRET-FILE-CONTENT' }, 3000);
  await s.send('Stop', {});
  await sleep(5000);
  await s.send('PreCompact', { trigger: 'manual', custom_instructions: null });
  await sleep(2500);
  await s.send('PostCompact', { trigger: 'manual', compact_summary: 'SECRET-SUMMARY' });
  await s.send('PostModelSwitch', { from_model: 'claude-sonnet-5-5', to_model: 'claude-opus-5-5', source: 'command' });
}

async function wanderer() {
  const s = session('C:/Users/someone/AppData/Roaming/Claude/scratch-workspaces/x/y/scratch-2026-10-12-abbc28');
  await sleep(2000);
  await s.send('SessionStart', { source: 'startup' });
  await sleep(20000);
  await s.send('UserPromptSubmit', { prompt: 'quick question' });
  await s.tool('Bash', { command: 'git status' }, 2000);
  await s.send('StopFailure', { error: 'rate_limit' });
  await sleep(8000);
  await s.send('SessionEnd', { reason: 'prompt_input_exit' });
}

(async () => {
  console.log('Simulating three sessions through hooks/emit.js ... (watch the game or /debug)');
  await Promise.all([knight(), scholar(), wanderer()]);
  console.log('Simulation finished.');
})();
