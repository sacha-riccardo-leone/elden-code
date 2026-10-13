// Raw view of the bridge stream: every event and the session table, as the game sees them.

const statusEl = document.getElementById('status');
const tbody = document.querySelector('#sessions tbody');
const log = document.getElementById('log');
const sessions = new Map();

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function renderSessions() {
  tbody.replaceChildren();
  for (const s of sessions.values()) {
    const tr = document.createElement('tr');
    tr.className = `state-${s.state}`;
    tr.append(
      cell(s.sid),
      cell(s.project),
      cell(s.state),
      cell(s.tool || '—'),
      cell(String(s.toolTotal)),
      cell(String(s.spirits)),
      cell(new Date(s.lastAt).toLocaleTimeString()),
    );
    tbody.append(tr);
  }
}

function addLog(ev) {
  const li = document.createElement('li');
  const time = document.createElement('time');
  time.textContent = new Date(ev.ts).toLocaleTimeString();
  const code = document.createElement('code');
  code.textContent = JSON.stringify(ev);
  li.append(time, code);
  log.prepend(li);
  while (log.children.length > 300) log.lastChild.remove();
}

const source = new EventSource('/stream');
source.addEventListener('open', () => { statusEl.textContent = 'connected'; statusEl.dataset.ok = '1'; });
source.addEventListener('error', () => { statusEl.textContent = 'disconnected — retrying'; statusEl.dataset.ok = ''; });
source.addEventListener('snapshot', (e) => {
  const { sessions: list } = JSON.parse(e.data);
  sessions.clear();
  for (const s of list) sessions.set(s.sid, s);
  renderSessions();
});
source.addEventListener('ev', (e) => {
  const { ev, session } = JSON.parse(e.data);
  if (session.state === 'gone') sessions.delete(session.sid);
  else sessions.set(session.sid, session);
  renderSessions();
  addLog(ev);
});
