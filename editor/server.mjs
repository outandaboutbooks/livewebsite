// Out and About Books: website editor for your own computer.
// Start it with the "Edit website" shortcut, or run: node editor/server.mjs
// The editor opens at http://localhost:3001 and the site preview at http://localhost:3000.
// It only listens on this computer (127.0.0.1); nobody else on your network can reach it.
// No npm packages needed.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDITOR_DIR = path.join(ROOT, 'editor');
const CONTENT = path.join(ROOT, 'content');
const MEDIA = path.join(CONTENT, 'media');
const SITE = path.join(ROOT, '_site');
const TRASH = path.join(EDITOR_DIR, 'trash');
const EDITOR_PORT = Number(process.env.EDITOR_PORT || 3001);
const PREVIEW_PORT = Number(process.env.PREVIEW_PORT || 3000);
const HOST = '127.0.0.1';

const COLLECTIONS = { books: 'books', merch: 'merch', pages: 'pages' };
const FILES = { home: 'home.json', settings: 'settings.json' };
const SAFE_NAME = /^[a-z0-9][a-z0-9-]{0,80}\.json$/;
const SAFE_MEDIA = /^[a-z0-9][a-z0-9-]{0,80}\.(jpe?g|png|webp|svg|mp3|m4a)$/;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'untitled';

const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  const data = type.startsWith('application/json') ? JSON.stringify(body) : body;
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(data);
}

function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('That file is too large.'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveStatic(res, baseDir, urlPath, { spa404 } = {}) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(baseDir + path.sep) && file !== baseDir) return send(res, 403, 'Not allowed', 'text/plain');
  let target = file;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    res.writeHead(301, { Location: urlPath.split('?')[0] + '/' }); return res.end();
  }
  if (!fs.existsSync(target)) {
    if (spa404 && fs.existsSync(path.join(baseDir, '404.html'))) target = path.join(baseDir, '404.html');
    else return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    res.writeHead(404, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
    return fs.createReadStream(target).pipe(res);
  }
  const type = TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream';
  const size = fs.statSync(target).size;
  // Byte ranges let audio players skip forward and back.
  const range = /^bytes=(\d*)-(\d*)$/.exec(res.req.headers.range || '');
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
    return fs.createReadStream(target, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
  fs.createReadStream(target).pipe(res);
}

let building = null;
function build() {
  if (building) return building;
  building = new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'build.mjs')], { cwd: ROOT, env: { ...process.env, OAB_DRAFTS: '1' } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => { building = null; resolve({ ok: code === 0, output: out.trim() }); });
  });
  return building;
}

function listCollection(name) {
  const dir = path.join(CONTENT, COLLECTIONS[name]);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    let d = {};
    try { d = readJSON(path.join(dir, f)); } catch { d = { title: f + ' (could not be read)' }; }
    return {
      file: f,
      title: d.title || d.name || f,
      sub: name === 'books' ? [d.author, d.series ? `${d.series}${d.series_number ? ' ' + d.series_number : ''}` : ''].filter(Boolean).join(' · ') : name === 'pages' ? `/${d.parent ? d.parent + '/' : ''}${d.slug || f.replace(/\.json$/, '')}/` + (d.layout && d.layout !== 'text' ? ` · ${{ image: 'Image and text', cards: 'Cards', gallery: 'Gallery', feature: 'Feature' }[d.layout] || ''}` : '') : '',
      sample: !!d.sample,
      cover: d.cover || d.image || '',
      draftFlag: name === 'pages' ? !!d.needs_review : false,
      parent: name === 'pages' ? (d.parent || '') : '',
      unpublished: d.published === false,
    };
  }).sort((a, b) => Number(a.sample) - Number(b.sample) || String(a.title).localeCompare(String(b.title)));
}

// Only accept requests from the editor page itself.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return origin === `http://localhost:${EDITOR_PORT}` || origin === `http://${HOST}:${EDITOR_PORT}`;
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).slice(1); // after "api"
  const method = req.method;
  if (method !== 'GET' && !sameOrigin(req)) return send(res, 403, { error: 'Not allowed.' });

  try {
    // GET /api/list/books
    if (method === 'GET' && parts[0] === 'list' && COLLECTIONS[parts[1]]) return send(res, 200, listCollection(parts[1]));

    // /api/item/books/some-book.json
    if (parts[0] === 'item' && COLLECTIONS[parts[1]]) {
      const file = parts[2] || '';
      if (!SAFE_NAME.test(file)) return send(res, 400, { error: 'Bad file name.' });
      const full = path.join(CONTENT, COLLECTIONS[parts[1]], file);
      if (method === 'GET') return fs.existsSync(full) ? send(res, 200, readJSON(full)) : send(res, 404, { error: 'Not found.' });
      if (method === 'PUT') {
        const data = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8'));
        if (typeof data !== 'object' || Array.isArray(data) || !data) return send(res, 400, { error: 'Bad data.' });
        if (!fs.existsSync(full)) return send(res, 404, { error: 'Not found.' });
        writeJSON(full, data);
        return send(res, 200, { ok: true });
      }
      if (method === 'DELETE') {
        if (!fs.existsSync(full)) return send(res, 404, { error: 'Not found.' });
        fs.mkdirSync(TRASH, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.renameSync(full, path.join(TRASH, `${parts[1]}--${stamp}--${file}`));
        return send(res, 200, { ok: true });
      }
    }

    // POST /api/new/books  { title }
    if (method === 'POST' && parts[0] === 'new' && COLLECTIONS[parts[1]]) {
      const body = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8') || '{}');
      const label = String(body.title || '').trim();
      if (!label) return send(res, 400, { error: 'Give it a name first.' });
      const dir = path.join(CONTENT, COLLECTIONS[parts[1]]);
      fs.mkdirSync(dir, { recursive: true });
      const base = slugify(label);
      let file = `${base}.json`; let n = 2;
      while (fs.existsSync(path.join(dir, file))) file = `${base}-${n++}.json`;
      if (parts[1] === 'pages' && ['books', 'series', 'shop', 'admin', 'media', 'assets', 'review', 'newsletter', 'contact', 'about', 'faq', 'privacy', 'cookies', 'terms', 'delivery-returns'].includes(base) && !fs.existsSync(path.join(dir, file)))
        return send(res, 400, { error: `The web address /${base}/ is already used by the site. Choose a different title.` });
      const data = body.data && typeof body.data === 'object' ? body.data : {};
      if (parts[1] === 'pages') data.slug = file.replace(/\.json$/, '');
      writeJSON(path.join(dir, file), data);
      return send(res, 200, { ok: true, file });
    }

    // /api/file/home  /api/file/settings
    if (parts[0] === 'file' && FILES[parts[1]]) {
      const full = path.join(CONTENT, FILES[parts[1]]);
      if (method === 'GET') return send(res, 200, readJSON(full));
      if (method === 'PUT') {
        const data = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8'));
        if (typeof data !== 'object' || Array.isArray(data) || !data) return send(res, 400, { error: 'Bad data.' });
        writeJSON(full, data);
        return send(res, 200, { ok: true });
      }
    }

    // POST /api/upload?name=my-cover.jpg   (raw file in the body)
    if (method === 'POST' && parts[0] === 'upload') {
      const original = String(url.searchParams.get('name') || 'image.jpg');
      const ext = (path.extname(original).toLowerCase() || '.jpg').replace('.jpeg', '.jpg');
      let name = slugify(path.basename(original, path.extname(original))) + ext;
      if (!SAFE_MEDIA.test(name)) return send(res, 400, { error: 'Use a JPG, PNG or WebP image, or an MP3 or M4A audio file.' });
      const data = await readBody(req, 60 * 1024 * 1024);
      fs.mkdirSync(MEDIA, { recursive: true });
      let n = 2; const stem = name.slice(0, -ext.length);
      while (fs.existsSync(path.join(MEDIA, name))) name = `${stem}-${n++}${ext}`;
      fs.writeFileSync(path.join(MEDIA, name), data);
      return send(res, 200, { ok: true, path: `/media/${name}`, bytes: data.length });
    }

    // POST /api/build
    if (method === 'POST' && parts[0] === 'build') {
      const result = await build();
      return send(res, result.ok ? 200 : 500, { ...result, preview: `http://localhost:${PREVIEW_PORT}/` });
    }

    // GET /api/info
    if (method === 'GET' && parts[0] === 'info') return send(res, 200, { preview: `http://localhost:${PREVIEW_PORT}/`, folder: ROOT });

    return send(res, 404, { error: 'Unknown request.' });
  } catch (err) {
    return send(res, err.status || 500, { error: err instanceof SyntaxError ? 'A file could not be read. It may have a typing mistake in it.' : err.message });
  }
}

// ----- editor (port 3001) -----
const editor = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${EDITOR_PORT}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  if (url.pathname.startsWith('/media/')) return serveStatic(res, MEDIA, url.pathname.slice('/media'.length));
  if (url.pathname.startsWith('/site-assets/')) return serveStatic(res, path.join(ROOT, 'src/assets'), url.pathname.slice('/site-assets'.length));
  return serveStatic(res, path.join(EDITOR_DIR, 'app'), url.pathname === '/' ? '/index.html' : url.pathname);
});

// ----- site preview (port 3000) -----
const preview = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PREVIEW_PORT}`);
  if (!fs.existsSync(SITE)) return send(res, 503, 'The preview is still being built. Refresh in a moment.', 'text/plain; charset=utf-8');
  return serveStatic(res, SITE, url.pathname, { spa404: true });
});

function listen(server, port, label) {
  return new Promise((resolve) => {
    server.once('error', (e) => {
      if (e.code === 'EADDRINUSE') console.log(`\n${label} couldn't start: something else is already using port ${port}.\nIf the editor is already open in another window, use that one, or close it and try again.`);
      else console.log(`\n${label} couldn't start: ${e.message}`);
      process.exit(1);
    });
    server.listen(port, HOST, resolve);
  });
}

const first = await build();
if (!first.ok) console.log('\nThe website could not be built yet:\n' + first.output + '\n(You can still open the editor and fix it.)');
await listen(editor, EDITOR_PORT, 'The editor');
await listen(preview, PREVIEW_PORT, 'The preview');
console.log(`\nOut and About Books editor is running.\n\n  Editor:   http://localhost:${EDITOR_PORT}\n  Preview:  http://localhost:${PREVIEW_PORT}\n\nLeave this window open while you work. Close it (or press Ctrl+C) to stop.\n`);
