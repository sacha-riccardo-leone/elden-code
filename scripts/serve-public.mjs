// Serves the public demo build (dist/elden-code-demo) as Vercel would, with its vercel.json headers,
// to try it before deploying:   npm run build:public && npm run preview:public   (port 7788)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'elden-code-demo');
const PORT = Number(process.env.PORT) || 7788;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
};
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const headersFor = (url) => Object.fromEntries(config.headers
  .filter((h) => new RegExp(`^${h.source.replace('(.*)', '.*')}$`).test(url))
  .flatMap((h) => h.headers.map(({ key, value }) => [key, value])));

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }
  // (Vercel's default for static files: always revalidate, unless vercel.json says otherwise)
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=0, must-revalidate', ...headersFor(url) });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`Public demo preview: http://127.0.0.1:${PORT}`));
