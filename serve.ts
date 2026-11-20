// Tiny static server (Node stdlib only) for local play-testing of the game.
// Serves game/ at http://localhost:8080 (or $PORT), screenshots/ at /shots/
// for reviewing dossier shots, and shots.json at /shots.json.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(repoDir, 'game');
const shotsRoot = path.join(repoDir, 'screenshots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
};

const port = Number(process.env.PORT || 8080);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    let base = root;
    if (rel === '/shots.json') {
      const data = await readFile(path.join(repoDir, 'shots.json'));
      res.writeHead(200, { 'content-type': MIME['.json'] });
      res.end(data);
      return;
    }
    if (rel.startsWith('/shots/')) {
      base = shotsRoot;
      rel = rel.slice('/shots'.length);
    }
    if (rel === '/') rel = '/index.html';
    const file = path.join(base, rel);
    if (!file.startsWith(base)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(port, () => {
  console.log(`Velvet Bay serving game/ at http://localhost:${port}`);
  console.log(`Dossier shots at http://localhost:${port}/shots/1-start.jpg (and /shots.json)`);
});
