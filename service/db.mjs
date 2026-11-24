import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export const schemaVersion = 1;
export class InputError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function openDatabase(file, migrate = false) {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON');
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version === 0 && migrate) {
    db.exec(`PRAGMA journal_mode=WAL;
      BEGIN IMMEDIATE;
      CREATE TABLE events (id TEXT PRIMARY KEY, body TEXT NOT NULL, revision INTEGER NOT NULL, deleted INTEGER DEFAULT 0);
      CREATE TABLE requests (id TEXT PRIMARY KEY, hash TEXT NOT NULL, response TEXT NOT NULL);
      CREATE TABLE cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, fetched INTEGER NOT NULL);
      PRAGMA user_version=1;
      COMMIT;`);
  } else if (version !== schemaVersion) {
    db.close();
    throw new Error('Unsupported database schema');
  }
  return db;
}

function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new InputError(400, 'Invalid event text');
  }
  return value.trim();
}

export function validateEvent(body, ids) {
  if (!body || typeof body.allDay !== 'boolean' || !Array.isArray(body.people) ||
      !body.people.length || body.people.some(id => !ids.includes(id)) ||
      !['', 'weekly', 'monthly', 'yearly'].includes(body.repeat ?? '')) {
    throw new InputError(400, 'Invalid event settings');
  }
  const format = body.allDay ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
  for (const value of [body.start, body.end]) {
    if (typeof value !== 'string' || !format.test(value) || !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value.slice(0, 10)) {
      throw new InputError(400, 'Invalid event date');
    }
  }
  if (Date.parse(body.end) <= Date.parse(body.start)) throw new InputError(400, 'Invalid event range');
  const travel = body.travel ?? 0;
  if (!Number.isInteger(travel) || travel < 0 || travel > 1440) throw new InputError(400, 'Invalid travel time');
  return {
    title: text(body.title, 200, true), people: [...new Set(body.people)], allDay: body.allDay,
    start: body.start, end: body.end, repeat: body.repeat ?? '',
    loc: text(body.loc ?? '', 300), notes: text(body.notes ?? '', 4000), travel,
  };
}

export function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const event = row => ({ ...JSON.parse(row.body), id: row.id, revision: row.revision });
export function events(db) {
  return db.prepare('SELECT * FROM events WHERE deleted = 0 ORDER BY id').all().map(event);
}
export function createEvent(db, input, key) {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(key ?? '')) throw new InputError(400, 'Missing request key');
  const body = JSON.stringify(input);
  const hash = createHash('sha256').update(body).digest('hex');
  return transaction(db, () => {
    const prior = db.prepare('SELECT * FROM requests WHERE id = ?').get(key);
    if (prior) {
      if (prior.hash !== hash) throw new InputError(409, 'Request key already used');
      return JSON.parse(prior.response);
    }
    const id = randomUUID();
    const result = { ...input, id, revision: 1 };
    db.prepare('INSERT INTO events (id, body, revision) VALUES (?, ?, 1)').run(id, body);
    db.prepare('INSERT INTO requests VALUES (?, ?, ?)').run(key, hash, JSON.stringify(result));
    return result;
  });
}
export function changeEvent(db, id, match, operation, input) {
  return transaction(db, () => {
    const row = db.prepare('SELECT * FROM events WHERE id=?').get(id);
    if (!row) throw new InputError(404, 'Event not found');
    if (match !== `"${row.revision}"` || Boolean(row.deleted) !== (operation === 'restore')) {
      throw new InputError(409, 'The event changed. Refresh and try again.');
    }
    const body = input ? JSON.stringify(input) : row.body;
    db.prepare('UPDATE events SET body=?, revision=revision+1, deleted=? WHERE id=?')
      .run(body, operation === 'delete' ? 1 : 0, id);
    return event({ ...row, body, revision: row.revision + 1 });
  });
}
