import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { get, request as httpRequest } from 'node:http';
import { test } from 'node:test';
import { readConfig } from './config.mjs';
import { openDatabase, events } from './db.mjs';
import { makeServer } from './server.mjs';
import { importLegacy } from './import.mjs';
import { feeds } from './feeds.mjs';
import { instant, wallTime, eventToWire, TorontoDate } from '../web/js/toronto.js';

const sample = { title: 'Example', people: ['person-1'], allDay: true, repeat: 'yearly',
  start: '2026-11-24', end: '2026-11-25' };
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'homehq-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'events.sqlite3');
  const db = openDatabase(file, true);
  const config = readConfig(join(dir, 'missing-config'));
  return { dir, file, db, config };
}

test('weather cache refreshes at Toronto midnight even before its normal expiry', async t => {
  const { db, config } = await fixture(t);
  t.after(() => db.close());
  let time = Date.parse('2026-11-24T04:55:00Z');
  t.mock.method(Date, 'now', () => time);
  let requests = 0;
  const weather = feeds(db, config, async () => {
    requests++;
    const day = requests === 1 ? '2026-11-23' : '2026-11-24';
    return Response.json({ current: { temperature_2m: 4 }, daily: { time: [day], temperature_2m_max: [6] } });
  }).weather;
  assert.equal((await weather()).data.daily.time[0], '2026-11-23');
  time = Date.parse('2026-11-24T04:59:59Z');
  assert.equal((await weather()).data.daily.time[0], '2026-11-23');
  time = Date.parse('2026-11-24T05:00:00Z');
  assert.equal((await weather()).data.daily.time[0], '2026-11-24');
  assert.equal(requests, 2);
});

test('HTTP contract shares data, rejects cross-origin writes and supports recovery checks', async t => {
  const { dir, db, config } = await fixture(t);
  await writeFile(join(dir, 'index.html'), '<title>Calendar</title>');
  await writeFile(join(dir, 'forecast.mp4'), '123456');
  let valid = true;
  const server = makeServer({ root: dir, config, db, port: 0, version: '1.0.0',
    maintenance: join(dir, 'maintenance'), request: async () => Response.json(valid ?
      { current: { temperature_2m: 4 }, daily: { temperature_2m_max: [2] } } : {}) });
  server.listen(0, config.host);
  await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const send = (path, options = {}) => fetch(origin + path, options);
  const headers = { 'Content-Type': 'application/json', 'X-HomeHQ-Client': '1', Origin: origin,
    'Idempotency-Key': 'test-request-key-01' };
  const list = '/api/v1/events';
  assert.equal((await (await send('/readyz')).json()).kioskProtocol, 1);
  const wrongHost = await new Promise((resolve, reject) => {
    get(origin + '/api/v1/time', { headers: { Host: 'untrusted.invalid' } }, reply => {
      reply.resume();
      resolve(reply.statusCode);
    }).on('error', reject);
  });
  assert.equal(wrongHost, 200);
  const proxyWrite = proxyOrigin => new Promise((resolve, reject) => {
    const request = httpRequest(origin + list, { method: 'POST', headers: { ...headers,
      Host: 'calendar.example.test', Origin: proxyOrigin } }, reply => {
      reply.resume();
      resolve(reply.statusCode);
    });
    request.on('error', reject);
    request.end('{');
  });
  assert.equal(await proxyWrite('https://calendar.example.test'), 400);
  assert.equal(await proxyWrite('http://calendar.example.test'), 400);
  assert.equal(await proxyWrite('https://evil.example.test'), 403);
  assert.equal((await send(list, { method: 'POST', headers: { ...headers, Origin: 'http://untrusted.invalid' },
    body: JSON.stringify(sample) })).status, 403);
  assert.equal((await send(list, { method: 'POST', headers, body: JSON.stringify({ ...sample, start: '2026-02-30' }) })).status, 400);
  const create = () => send(list, { method: 'POST', headers, body: JSON.stringify(sample) });
  const first = await (await create()).json();
  assert.equal((await (await create()).json()).id, first.id);
  const request = await send(list);
  assert.equal((await request.json()).events.length, 1);
  assert.equal((await send(list, { headers: { 'If-None-Match': request.headers.get('ETag') } })).status, 304);
  const route = list + '/' + first.id;
  assert.equal((await send(route, { method: 'DELETE', headers: { ...headers, 'If-Match': '"2"' } })).status, 409);
  const deleted = await (await send(route, { method: 'DELETE', headers: { ...headers, 'If-Match': '"1"' } })).json();
  assert.equal(deleted.revision, 2);
  const restored = await (await send(route + '/restore', { method: 'POST', headers: { ...headers, 'If-Match': '"2"' } })).json();
  assert.equal(restored.revision, 3);
  assert.equal((await send('/api/v1/holidays?year=2026')).status, 200);
  assert.equal((await send('/__device/v1/status')).status, 404);
  const video = await send('/forecast.mp4', { headers: { Range: 'bytes=1-3' } });
  assert.equal(video.status, 206);
  assert.equal(await video.text(), '234');
  assert.equal((await (await send('/api/v1/weather')).json()).data.current.temperature_2m, 4);
  db.exec('UPDATE cache SET fetched=1');
  valid = false;
  assert.equal((await (await send('/api/v1/weather')).json()).stale, true);
  await writeFile(join(dir, 'maintenance'), '');
  assert.equal((await send('/readyz')).status, 503);
  assert.equal((await create()).status, 503);
  assert.equal((await send('/healthz')).status, 200);
});

test('legacy import is dry-run friendly, atomic, repeatable and survives restart', async t => {
  const { file, db } = await fixture(t);
  const ids = ['person-1'];
  const legacy = { version: 2, events: [{ ...sample, id: 'example', people: ['personal'],
    start: '2026-11-24T05:00:00.000Z', end: '2026-11-25T05:00:00.000Z' }] };
  assert.equal(importLegacy(db, legacy, ids).newEvents, 1);
  assert.equal(events(db).length, 0);
  assert.equal(importLegacy(db, { events: [...legacy.events, { ...legacy.events[0], people: ['unknown'] }] },
    ids, true).problems.length, 1);
  assert.equal(events(db).length, 0);
  assert.equal(importLegacy(db, legacy, ids, true).applied, true);
  assert.equal(importLegacy(db, legacy, ids, true).duplicates, 1);
  db.close();
  const reopened = openDatabase(file);
  assert.equal(events(reopened)[0].start, '2026-11-24');
  reopened.close();
});

test('Toronto event encoding handles both DST disambiguations and exclusive all-day dates', () => {
  assert.equal(new Date(instant(Date.UTC(2026, 2, 8, 2, 30))).toISOString(), '2026-03-08T07:30:00.000Z');
  assert.equal(new Date(instant(Date.UTC(2026, 10, 1, 1, 30))).toISOString(), '2026-11-01T05:30:00.000Z');
  assert.equal(wallTime(Date.parse('2026-11-24T04:59:00Z')), Date.UTC(2026, 10, 23, 23, 59));
  assert.equal(eventToWire({ ...sample, start: new TorontoDate(2026, 2, 8),
    end: new TorontoDate(2026, 2, 9) }).end, '2026-03-09');
});
