import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const workspace = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
export async function startServer({ root = path.join(workspace, 'dist/site'), port = 0 } = {}) {
  const headerFile = await readFile(path.join(root, '_headers'), 'utf8');
  const policy = headerFile.match(/^  Content-Security-Policy: (.+)$/m)?.[1];
  if (!policy) throw new Error('Build the security headers before starting the server.');
  const server = http.createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const target = path.resolve(root, relative);
      if (!target.startsWith(path.resolve(root) + path.sep) || !types[path.extname(target)]) { response.writeHead(404); response.end(); return; }
      const body = await readFile(target);
      response.writeHead(200, { 'Content-Type': types[path.extname(target)], 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': policy });
      response.end(body);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf('--port'), port = at < 0 ? 3000 : Number(process.argv[at + 1]);
  const server = await startServer({ port });
  console.log(`QuantRush: http://localhost:${server.address().port}/`);
}
