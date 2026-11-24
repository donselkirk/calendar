import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changeEvent, createEvent, events, InputError, openDatabase, validateEvent } from './db.mjs';
import { readConfig } from './config.mjs';
import { feeds } from './feeds.mjs';
import { invokedDirectly } from './entrypoint.mjs';
import { holidaysForYear } from '../web/js/holiday-dates.js';

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.mp4': 'video/mp4', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const json = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload == null ? undefined : JSON.stringify(payload));
};

async function body(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16_384) throw new InputError(413, 'Event too large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks)); }
  catch { throw new InputError(400, 'Invalid JSON'); }
}

function staticFile(root, path, req, res) {
  const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
  if (!file.startsWith(root + sep)) throw new InputError(404, 'Not found');
  const type = mime[extname(file)];
  const stat = statSync(file, { throwIfNoEntry: false });
  if (!type || !stat?.isFile()) throw new InputError(404, 'Not found');
  const headers = { 'Content-Type': type, 'Content-Length': stat.size };
  let range;
  if (extname(file) === '.mp4') {
    headers['Accept-Ranges'] = 'bytes';
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      const start = match?.[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match?.[2]));
      const end = match?.[1] && match[2] ? Math.min(stat.size - 1, Number(match[2])) : stat.size - 1;
      if (!match || !Number.isSafeInteger(start) || start > end || !stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      range = { start, end };
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      headers['Content-Length'] = end - start + 1;
    }
  }
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD') return res.end();
  createReadStream(file, range).on('error', () => res.destroy()).pipe(res);
}

export function makeServer({ config, db, root, port = config.port, host = config.host, version, maintenance, request }) {
  root = resolve(root);
  const upstream = feeds(db, config, request);
  const ids = config.publicConfig.people.map(p => p.id);
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const authority = `${host}:${port || req.socket.localPort}`;
      if (req.headers.host !== authority && !(port === 80 && req.headers.host === host)) {
        throw new InputError(403, 'Invalid host');
      }
      if (!req.url?.startsWith('/') || req.url.startsWith('//')) throw new InputError(400, 'Invalid URL');
      const url = new URL(req.url, 'http://' + authority);
      const path = decodeURIComponent(url.pathname);
      const read = req.method === 'GET' || req.method === 'HEAD';
      if (!read && (req.headers.origin !== `http://${req.headers.host}` ||
          req.headers['x-homehq-client'] !== '1' ||
          req.headers['content-type']?.split(';')[0] !== 'application/json')) {
        throw new InputError(403, 'Use a same-origin JSON request');
      }
      if (path === '/healthz' && read) return json(res, 200, { version });
      if (maintenance && existsSync(maintenance)) throw new InputError(503, 'Calendar maintenance');
      if (path === '/readyz' && read) {
        db.prepare('SELECT 1 FROM events LIMIT 1').get();
        if (!existsSync(resolve(root, 'index.html'))) throw new InputError(503, 'Dashboard unavailable');
        return json(res, 200, { product: 'homehq-service', kioskProtocol: 1, version });
      }
      if (path === '/api/v1/bootstrap' && read) return json(res, 200, {
        ...config.publicConfig, serviceVersion: version, epoch: Date.now(), timeZone: 'America/Toronto',
      });
      if (path === '/api/v1/time' && read) return json(res, 200, { epoch: Date.now() });
      if (path === '/api/v1/weather' && read) return json(res, 200, await upstream.weather());
      if (path === '/api/v1/waste' && read) return json(res, 200, await upstream.waste());
      if (path === '/api/v1/holidays' && read) {
        const year = Number(url.searchParams.get('year'));
        if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new InputError(400, 'Invalid year');
        return json(res, 200, holidaysForYear(year));
      }
      if (path === '/api/v1/events' && read) {
        const list = events(db);
        const etag = '"' + createHash('sha256').update(JSON.stringify(list)).digest('hex') + '"';
        res.setHeader('ETag', etag);
        return json(res, req.headers['if-none-match'] === etag ? 304 : 200,
          req.headers['if-none-match'] === etag ? null : { events: list });
      }
      if (path === '/api/v1/events' && req.method === 'POST') {
        const event = createEvent(db, validateEvent(await body(req), ids), req.headers['idempotency-key']);
        return json(res, 201, event);
      }
      const item = /^\/api\/v1\/events\/([a-z0-9-]{1,80})(\/restore)?$/.exec(path);
      if (item) {
        const op = item[2] ? { POST: 'restore' } : { PUT: 'update', DELETE: 'delete' };
        const action = op[req.method];
        if (!action) throw new InputError(405, 'Unsupported event operation');
        const input = action === 'update' ? validateEvent(await body(req), ids) : undefined;
        return json(res, 200, changeEvent(db, item[1], req.headers['if-match'], action, input));
      }
      if (!read || path.startsWith('/api/') || path.startsWith('/__')) throw new InputError(404, 'Not found');
      return staticFile(root, path, req, res);
    } catch (error) {
      if (res.headersSent || res.destroyed) return res.destroy();
      if (!error.status && !(error instanceof URIError)) console.error('Home HQ request failed');
      return json(res, error.status ?? (error instanceof URIError ? 400 : 500),
        { error: error.status ? error.message : 'Request failed' });
    }
  });
}

if (invokedDirectly(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const config = readConfig(process.env.HOMEHQ_CONFIG ?? '/etc/homehq/config.json');
  const db = openDatabase(process.env.HOMEHQ_DB ?? '/var/lib/homehq/homehq.sqlite3', process.argv[2] === 'migrate');
  if (process.argv[2] === 'migrate') db.close();
  else {
    const port = Number(process.env.HOMEHQ_PORT ?? config.port);
    const host = process.env.HOMEHQ_LISTEN ?? config.host;
    const root = process.env.HOMEHQ_WEB ?? resolve(here, '../web/dist');
    const version = readFileSync(resolve(here, 'version.properties'), 'utf8').match(/^VERSION_NAME=(.+)$/m)[1];
    const server = makeServer({ config, db, port, host, root,
      version, maintenance: process.env.HOMEHQ_MAINTENANCE });
    server.listen(port, host);
    process.on('SIGTERM', () => server.close(() => db.close()));
  }
}
