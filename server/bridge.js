'use strict';
// Elden Code bridge.
// Receives minimal, sanitized hook events from Claude Code (POST /event, token-protected)
// and streams them one-way to the game (GET /stream, Server-Sent Events).
// Listens on 127.0.0.1 only. Nothing here can send anything back into Claude Code.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateEvent } = require('./events');
const { Registry } = require('./registry');

const PORT = Number(process.env.ELDEN_PORT) || 7777;
const HOST = '127.0.0.1';
const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, '.elden');
const TOKEN_FILE = path.join(STATE_DIR, 'token');
const MAX_BODY = 16 * 1024;

// Requests must name us by our loopback address. Rejecting other Host headers
// defeats DNS-rebinding pages that try to reach this server through a domain they control.
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]);

const STATIC_ROUTES = [
  ['/vendor/three/build/', path.join(ROOT, 'node_modules/three/build')],
  ['/vendor/three/addons/', path.join(ROOT, 'node_modules/three/examples/jsm')],
  ['/vendor/fonts/cinzel/', path.join(ROOT, 'node_modules/@fontsource/cinzel/files')],
  ['/vendor/fonts/cormorant/', path.join(ROOT, 'node_modules/@fontsource/cormorant-garamond/files')],
  ['/', path.join(ROOT, 'client')],
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', // (the sounds: client/js/audio.js)
};

function loadToken() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  try {
    const t = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (/^[a-f0-9]{48}$/.test(t)) return t;
  } catch {}
  const t = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(TOKEN_FILE, t, { mode: 0o600 });
  return t;
}

const TOKEN = loadToken();
const TOKEN_BUF = Buffer.from(TOKEN);
const registry = new Registry();
const clients = new Set();

function tokenMatches(value) {
  if (typeof value !== 'string') return false;
  const buf = Buffer.from(value);
  return buf.length === TOKEN_BUF.length && crypto.timingSafeEqual(buf, TOKEN_BUF);
}

function baseHeaders(extra) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...extra,
  };
}

function send(res, status, body, headers) {
  res.writeHead(status, baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8', ...headers }));
  res.end(body);
}

// Inline import maps are the only inline scripts we ship; allow exactly those by hash.
function cspFor(html) {
  const hashes = [];
  const re = /<script type="importmap">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    hashes.push(`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
  }
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

function serveStatic(req, res, pathname) {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/debug') pathname = '/debug.html';
  for (const [prefix, dir] of STATIC_ROUTES) {
    if (!pathname.startsWith(prefix)) continue;
    let rel;
    try { rel = decodeURIComponent(pathname.slice(prefix.length)); } catch { return send(res, 400, 'Bad path'); }
    const file = path.resolve(dir, rel);
    if (file !== dir && !file.startsWith(dir + path.sep)) return send(res, 403, 'Forbidden');
    const type = MIME[path.extname(file).toLowerCase()];
    if (!type) return send(res, 404, 'Not found');
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
      if (type.startsWith('text/html')) headers['Content-Security-Policy'] = cspFor(data.toString('utf8'));
      res.writeHead(200, baseHeaders(headers));
      res.end(data);
    });
    return;
  }
  send(res, 404, 'Not found');
}

function broadcast(type, payload) {
  const frame = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) res.write(frame);
}

function handleStream(req, res) {
  res.writeHead(200, baseHeaders({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  }));
  res.write('retry: 2000\n\n');
  res.write(`event: snapshot\ndata: ${JSON.stringify({ sessions: registry.list(), now: Date.now() })}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

function handleEvent(req, res) {
  if (!tokenMatches(req.headers['x-elden-token'])) return send(res, 401, 'Unauthorized');
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, 'JSON only');
  let size = 0;
  const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) { send(res, 413, 'Too large'); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    if (res.writableEnded) return;
    let raw;
    try { raw = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return send(res, 400, 'Bad JSON'); }
    const ev = validateEvent(raw);
    if (!ev) return send(res, 422, 'Rejected');
    ev.ts = Date.now();
    const session = registry.apply(ev);
    broadcast('ev', { ev, session });
    send(res, 204, '');
  });
}

const server = http.createServer((req, res) => {
  if (!ALLOWED_HOSTS.has(String(req.headers.host || '').toLowerCase())) return send(res, 421, 'Misdirected');
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'POST' && url.pathname === '/event') return handleEvent(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  if (url.pathname === '/stream') return handleStream(req, res);
  if (url.pathname === '/api/health') {
    return send(res, 200, JSON.stringify({ ok: true, sessions: registry.size, viewers: clients.size }), {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
  }
  serveStatic(req, res, url.pathname);
});

setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 20000).unref();
setInterval(() => {
  for (const change of registry.sweep(Date.now())) broadcast('ev', change);
}, 30000).unref();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Is Elden Code already running? (set ELDEN_PORT to change it)`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`Elden Code bridge listening on http://${HOST}:${PORT}  (debug log: /debug)`);
});
