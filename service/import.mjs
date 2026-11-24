import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { openDatabase, transaction, validateEvent } from './db.mjs';
import { readConfig } from './config.mjs';
import { invokedDirectly } from './entrypoint.mjs';
import { wallTime } from '../web/js/toronto.js';

const legacySlots = ['personal', 'familycal', 'work', 'other'];
export function importLegacy(db, exportData, ids, apply = false) {
  if (!Array.isArray(exportData?.events) || ![undefined, 1, 2].includes(exportData.version)) {
    throw new Error('Unsupported legacy export');
  }
  return transaction(db, () => {
    const pending = new Map();
    const report = { newEvents: 0, recurring: 0, duplicates: 0, problems: [], applied: false };
    const find = db.prepare('SELECT body FROM events WHERE id=?');
    exportData.events.forEach((input, index) => {
      try {
        if (!input || typeof input.id !== 'string' || !input.id || !Array.isArray(input.people) ||
            !input.people.length || typeof input.allDay !== 'boolean') throw new Error('Invalid legacy record');
        const people = input.people.map(id => ids.includes(id) ? id : ids[legacySlots.indexOf(id)]);
        if (people.some(id => !id)) throw new Error('Unknown calendar');
        const date = value => {
          if (typeof value !== 'string' || !/Z$/.test(value)) throw new Error('Invalid legacy timestamp');
          const epoch = Date.parse(value);
          return input.allDay ? new Date(wallTime(epoch)).toISOString().slice(0, 10) : new Date(epoch).toISOString();
        };
        const event = validateEvent({ ...input, start: date(input.start), end: date(input.end), people }, ids);
        const id = 'legacy-' + createHash('sha256').update(input.id).digest('hex');
        const body = JSON.stringify(event);
        const known = pending.get(id) ?? find.get(id)?.body;
        if (known != null) {
          if (known !== body) throw new Error('Conflicting existing event');
          report.duplicates++;
        } else {
          pending.set(id, body);
          report.newEvents++;
          if (event.repeat) report.recurring++;
        }
      } catch (error) {
        report.problems.push({ row: index + 1, reason: error.message });
      }
    });
    if (apply && !report.problems.length) {
      const insert = db.prepare('INSERT INTO events (id, body, revision) VALUES (?, ?, 1)');
      for (const [id, body] of pending) insert.run(id, body);
      report.applied = true;
    }
    return report;
  });
}

if (invokedDirectly(import.meta.url)) {
  const [, , file, mode] = process.argv;
  if (!file || !['--dry-run', '--apply'].includes(mode)) throw new Error('Provide an export and --dry-run or --apply');
  const config = readConfig(process.env.HOMEHQ_CONFIG ?? '/etc/homehq/config.json');
  if (!config.publicConfig.configured) throw new Error('Configure the household calendar IDs before importing');
  const db = openDatabase(process.env.HOMEHQ_DB ?? '/var/lib/homehq/homehq.sqlite3');
  try {
    const report = importLegacy(db, JSON.parse(readFileSync(file, 'utf8')),
      config.publicConfig.people.map(p => p.id), mode === '--apply');
    console.log(JSON.stringify(report, null, 2));
    if (report.problems.length) process.exitCode = 1;
  } finally { db.close(); }
}
