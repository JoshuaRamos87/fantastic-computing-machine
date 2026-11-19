const http = require('http');
const fs = require('fs');
const path = require('path');
const { REPO_ROOT } = require('./app-path');

const PORT = Number(process.env.TEST_SERVER_PORT || 4173);
const HOST = '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${HOST}:${PORT}`);
  const relPath = decodeURIComponent(urlObj.pathname).replace(/^\/+/, '') || 'index.html';
  const fullPath = path.resolve(REPO_ROOT, relPath);

  if (!fullPath.startsWith(REPO_ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    fs.createReadStream(fullPath).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Static test server listening at http://${HOST}:${PORT}`);
});
