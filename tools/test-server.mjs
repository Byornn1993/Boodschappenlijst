// Testserver op http://localhost:5181
//   /       de echte pagina (echte Supabase, inloggen nodig)
//   /stub   dezelfde pagina met een nagebootste Supabase (één gebruiker, wachtwoord 'goed')
//   /stub2  dezelfde pagina met een nagebootste Supabase voor meerdere gebruikers en Delen
// Starten: node tools/test-server.mjs  (vanuit de projectmap)
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tools = fileURLToPath(new URL('./', import.meta.url));
const TYPES = { js: 'text/javascript', svg: 'image/svg+xml', png: 'image/png', webmanifest: 'application/manifest+json' };
const send = (res, file, type) => { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(readFileSync(file)); };

createServer((req, res) => {
  const p = req.url.split('?')[0];
  try {
    if (/^\/(sw\.js|manifest\.webmanifest|icon\.svg|[\w-]+\.png)$/.test(p)) return send(res, root + p.slice(1), TYPES[p.split('.').pop()]);
    if (p === '/stub.js' || p === '/stub2.js') return send(res, tools + p.slice(1), TYPES.js);
    let html = readFileSync(root + 'index.html', 'utf8');
    const stub = p === '/stub' ? '/stub.js' : p === '/stub2' ? '/stub2.js' : null;
    if (stub) html = html.replace(/<script src="https:\/\/cdn[^>]*><\/script>/, `<script src="${stub}"></script>`);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  } catch (e) {
    res.writeHead(404); res.end('niet gevonden');
  }
}).listen(5181, () => console.log('testserver op http://localhost:5181 (/, /stub, /stub2)'));
