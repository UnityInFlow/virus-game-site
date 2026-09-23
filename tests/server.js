import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { extname, isAbsolute, normalize, relative, resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const requestPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = resolve(root, normalize(requestPath));
  const pathFromRoot = relative(root, file);
  if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('not found');
  }
}).listen(4173, '127.0.0.1');
