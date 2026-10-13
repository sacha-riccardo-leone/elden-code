// One-way link to the bridge. Server-Sent Events only flow from the bridge to this page;
// the game has no channel back to Claude Code.

export function connect({ onSnapshot, onEvent, onStatus }) {
  const source = new EventSource('/stream');
  source.addEventListener('open', () => onStatus(true));
  source.addEventListener('error', () => onStatus(false));
  source.addEventListener('snapshot', (e) => {
    try { onSnapshot(JSON.parse(e.data).sessions || []); } catch (err) { console.error('bad snapshot', err); }
  });
  source.addEventListener('ev', (e) => {
    try {
      const { ev, session } = JSON.parse(e.data);
      onEvent(ev, session);
    } catch (err) {
      console.error('bad event', err);
    }
  });
  return source;
}
