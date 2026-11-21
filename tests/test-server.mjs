// Testserver voor de browser, poort 5181. Start: node tests/test-server.mjs
//   /       de echte pagina (praat met de echte Supabase: alleen kijken, niet testen met echte data)
//   /stub   dezelfde pagina met een nagebootste Supabase voor één gebruiker (tests/stub.js, wachtwoord "goed")
//   /stub2  nagebootste Supabase met meerdere gebruikers en Delen (tests/stub2.js, wachtwoord "goed")
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const TYPES = { js: 'text/javascript', svg: 'image/svg+xml', png: 'image/png', webmanifest: 'application/manifest+json' };
const CDN = /<script src="https:\/\/cdn[^>]*><\/script>/;
createServer((req, res) => {
  const p = req.url.split('?')[0];
  const send = (file, type) => { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(readFileSync(file)); };
  if (/^\/(sw\.js|manifest\.webmanifest|icon\.svg|[\w-]+\.png)$/.test(p)) return send(join(root, p), TYPES[p.split('.').pop()]);
  if (p === '/stub.js' || p === '/stub2.js') return send(join(here, p), TYPES.js);
  let html = readFileSync(join(root, 'index.html'), 'utf8');
  if (p === '/stub') html = html.replace(CDN, '<script src="/stub.js"></script>');
  if (p === '/stub2') html = html.replace(CDN, '<script src="/stub2.js"></script>');
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
}).listen(5181, () => console.log('testserver op http://localhost:5181 (/stub en /stub2 met nep-database)'));
