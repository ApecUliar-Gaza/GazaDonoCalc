// Minimal local server: serves public/ and runs the functions, no Netlify CLI needed.
//   node --env-file-if-exists=.env scripts/dev-server.mjs   (then open http://localhost:8888)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const routes = {
  '/api/parse': () => import('../netlify/functions/parse.mjs'),
  '/api/prices': () => import('../netlify/functions/prices.mjs'),
  '/api/email': () => import('../netlify/functions/email.mjs'),
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (routes[url.pathname]) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
      const response = await (await routes[url.pathname]()).default(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const path = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
    const body = await readFile(join(root, 'public', path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500);
    res.end(err.code === 'ENOENT' ? 'Not found' : String(err));
  }
}).listen(process.env.PORT || 8888, () => console.log(`http://localhost:${process.env.PORT || 8888}`));
